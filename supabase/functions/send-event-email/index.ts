// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
// @ts-ignore
import { verifyAdminRequest } from "../_shared/verifyAdmin.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-event-email' bootstrapped.")

// ────────────────────────────────────────────────────────────────────────────
// Canal d'envoi séparé de Brevo, dédié aux mails "libres" envoyés aux
// volontaires/participants d'un événement (composeur admin). Objectif :
// ne pas consommer le quota Brevo réservé aux billets de confirmation.
//
// Utilise l'API Gmail via OAuth2 (pas de mot de passe SMTP classique).
// Variables d'environnement requises (Supabase secrets) :
//   GMAIL_CLIENT_ID       — ID client OAuth2 (Google Cloud Console)
//   GMAIL_CLIENT_SECRET   — Secret client OAuth2
//   GMAIL_REFRESH_TOKEN   — Refresh token généré avec le scope gmail.send
//   SMTP_USER             — Adresse Gmail d'envoi (doit correspondre au compte OAuth2)
//   EMAIL_FROM_NAME       — Nom d'affichage de l'expéditeur (optionnel, "ONG DDB" par défaut)
//
// Si l'une de ces variables manque, le service bascule en mode simulation :
// aucun email n'est réellement envoyé, mais la requête répond comme un succès
// (utile pour tester le reste du flux avant d'avoir les identifiants Gmail).
// ────────────────────────────────────────────────────────────────────────────

// Envoi groupé en BCC par lots — économise les appels API par rapport à un envoi
// individuel. Le souci de spam initial venait d'un "From" désaligné (SPF/DKIM/DMARC),
// pas du BCC en lui-même : une fois l'adresse d'expédition corrigée, le BCC groupé
// est de nouveau un choix raisonnable. À surveiller si la délivrabilité se dégrade
// à nouveau avec de plus gros volumes.
const CHUNK_SIZE = 30;
const DELAY_BETWEEN_CHUNKS_MS = 400;

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    if (!res.ok) {
        throw new Error(`Échec du rafraîchissement du token Gmail: ${await res.text()}`);
    }
    const data = await res.json();
    return data.access_token;
}

function base64url(input: string): string {
    return btoa(unescape(encodeURIComponent(input)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function encodeSubject(subject: string): string {
    return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
}

/** Génère une version texte brut à partir du HTML (pour le multipart/alternative anti-spam) */
function htmlToText(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// Un email en multipart/alternative (texte + HTML) est un signal de légitimité important
// pour les filtres anti-spam — un email HTML seul est un des marqueurs les plus courants du spam.
function buildRawMessage(opts: { from: string; fromName: string; bcc: string[]; subject: string; html: string; text: string }): string {
    const boundary = `bnd_${crypto.randomUUID().replace(/-/g, '')}`;
    const headers = [
        `From: ${opts.fromName} <${opts.from}>`,
        `To: ${opts.from}`, // envoi à soi-même ; les vrais destinataires sont en BCC (masqués les uns aux autres)
        `Bcc: ${opts.bcc.join(', ')}`,
        `Subject: ${encodeSubject(opts.subject)}`,
        'MIME-Version: 1.0',
        // Signal de légitimité attendu par la plupart des filtres anti-spam sur les envois groupés.
        `List-Unsubscribe: <mailto:${opts.from}?subject=unsubscribe>`,
        'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ].join('\r\n');

    const body = [
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        opts.text,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        opts.html,
        '',
        `--${boundary}--`,
    ].join('\r\n');

    return base64url(`${headers}\r\n\r\n${body}`);
}

serve(async (req: Request) => {
    const { method } = req
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Réservé aux comptes admin/charge_communication (composeur mail de l'admin) —
    // sans ce contrôle, n'importe qui avec la clé "anon" publique pouvait déclencher
    // des envois de mails en masse arbitraires via notre compte Gmail.
    const authError = await verifyAdminRequest(req, ['admin', 'charge_communication'], corsHeaders, 'send-event-email')
    if (authError) return authError

    try {
        const bodyText = await req.text()
        if (!bodyText) throw new Error('Empty request body')

        const { eventTitle, eventLogoUrl, targetGroup, subject, htmlContent, recipientEmails } = JSON.parse(bodyText)

        if (!subject || !htmlContent || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
            throw new Error('Champs manquants : subject, htmlContent et recipientEmails (non vide) sont requis.')
        }

        const clientId = Deno.env.get('GMAIL_CLIENT_ID')
        const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET')
        const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN')
        // Pas de fallback sur SENDER_EMAIL : ce secret est utilisé par les fonctions Brevo
        // pour une tout autre adresse. Un "From" qui ne correspond pas au compte Gmail
        // authentifié via OAuth2 casse l'alignement SPF/DKIM/DMARC → classement spam
        // systématique pour tout destinataire externe (le test à soi-même passe quand même,
        // Google étant plus permissif pour la livraison interne au même compte).
        const senderEmail = Deno.env.get('SMTP_USER')
        const senderName = Deno.env.get('EMAIL_FROM_NAME') || 'ONG DDB'

        const simulate = !clientId || !clientSecret || !refreshToken || !senderEmail

        // ── Email wrapper responsive (fluide sur mobile, logo de l'événement en en-tête) ──
        const wrappedHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  img { border: 0; outline: none; text-decoration: none; }
  @media screen and (max-width: 480px) {
    .email-card { padding: 18px 16px !important; border-radius: 0 !important; }
    .email-logo { max-width: 120px !important; max-height: 120px !important; }
    .email-body { font-size: 14px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:20px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <tr>
            <td class="email-card" style="padding:24px;border-radius:12px;background-color:#ffffff;border:1px solid #e5e7eb;">
              ${eventLogoUrl ? `<div style="text-align:center;margin-bottom:20px;"><img src="${eventLogoUrl}" alt="${eventTitle || ''}" class="email-logo" style="max-width:160px;max-height:160px;width:auto;height:auto;"></div>` : ''}
              ${eventTitle ? `<p style="text-align:center;font-size:12px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 16px;">${eventTitle}</p>` : ''}
              <div class="email-body" style="font-size:15px;line-height:1.6;color:#1f2937;word-break:break-word;">${htmlContent}</div>
              <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">
              <p style="font-size:12px;color:#6b7280;margin:0;text-align:center;">ONG Développement Durable et Bien-Être — Gabon 🌱</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        if (simulate) {
            console.log(`[SIMULATION] send-event-email → groupe="${targetGroup}", ${recipientEmails.length} destinataire(s), sujet="${subject}". Configurez GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/SMTP_USER pour un envoi réel.`)
            return new Response(JSON.stringify({ success: true, simulated: true, sent: recipientEmails.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const accessToken = await getAccessToken(clientId, clientSecret, refreshToken)
        const plainText = htmlToText(wrappedHtml)

        let totalSent = 0
        const errors: string[] = []

        for (let i = 0; i < recipientEmails.length; i += CHUNK_SIZE) {
            const chunk = recipientEmails.slice(i, i + CHUNK_SIZE)
            const raw = buildRawMessage({ from: senderEmail, fromName: senderName, bcc: chunk, subject, html: wrappedHtml, text: plainText })

            try {
                const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ raw }),
                })
                if (!res.ok) {
                    errors.push(`Lot ${i / CHUNK_SIZE + 1}: ${await res.text()}`)
                } else {
                    totalSent += chunk.length
                }
            } catch (err: any) {
                errors.push(`Lot ${i / CHUNK_SIZE + 1}: ${err.message}`)
            }

            // Pause légère entre les lots pour rester sous le rate-limit Gmail
            if (i + CHUNK_SIZE < recipientEmails.length) {
                await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS))
            }
        }

        return new Response(JSON.stringify({ success: errors.length === 0, sent: totalSent, errors }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error(`Edge function error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
