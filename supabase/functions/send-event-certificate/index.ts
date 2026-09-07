// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-event-certificate' bootstrapped (Gmail API).")

// ────────────────────────────────────────────────────────────────────────────
// Envoi des certificats via l'API Gmail (OAuth2) — même système que
// send-event-email (composeur mail participants/volontaires), pour garder
// un seul canal d'envoi et un alignement SPF/DKIM/DMARC cohérent.
// Un envoi individuel par certificat (pas de BCC groupé) car chaque PDF est
// personnalisé au nom du participant.
//
// Variables d'environnement requises (Supabase secrets) :
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, SMTP_USER
//   EMAIL_FROM_NAME (optionnel, "ONG DDB" par défaut)
// Si l'une manque, le service simule l'envoi (succès sans email réel envoyé).
// ────────────────────────────────────────────────────────────────────────────

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

function htmlToText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6])>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Construit un message MIME multipart/mixed (texte + HTML + pièce jointe PDF), encodé en base64url. */
function buildRawMessageWithAttachment(opts: {
    from: string; fromName: string; to: string; toName: string;
    subject: string; html: string; text: string;
    attachmentBase64: string; attachmentName: string;
}): string {
    const mixedBoundary = `mix_${crypto.randomUUID().replace(/-/g, '')}`;
    const altBoundary = `alt_${crypto.randomUUID().replace(/-/g, '')}`;

    const headers = [
        `From: ${opts.fromName} <${opts.from}>`,
        `To: ${opts.toName} <${opts.to}>`,
        `Subject: ${encodeSubject(opts.subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    ].join('\r\n');

    // Découpe la pièce jointe en lignes de 76 caractères (convention MIME)
    const chunkedAttachment = (opts.attachmentBase64.match(/.{1,76}/g) || []).join('\r\n');

    const body = [
        `--${mixedBoundary}`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        '',
        `--${altBoundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        opts.text,
        '',
        `--${altBoundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        opts.html,
        '',
        `--${altBoundary}--`,
        '',
        `--${mixedBoundary}`,
        `Content-Type: application/pdf; name="${opts.attachmentName}"`,
        `Content-Disposition: attachment; filename="${opts.attachmentName}"`,
        'Content-Transfer-Encoding: base64',
        '',
        chunkedAttachment,
        '',
        `--${mixedBoundary}--`,
    ].join('\r\n');

    return base64url(`${headers}\r\n\r\n${body}`);
}

serve(async (req: Request) => {
    const { method } = req
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const bodyText = await req.text()
        if (!bodyText) throw new Error('Empty request body')

        const { email, fullname, eventTitle, pdfBase64, pdfName } = JSON.parse(bodyText)

        if (!email || !fullname || !eventTitle) {
            throw new Error('Missing required fields for event certificate')
        }

        const clientId = Deno.env.get('GMAIL_CLIENT_ID')
        const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET')
        const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN')
        const senderEmail = Deno.env.get('SMTP_USER')
        const senderName = Deno.env.get('EMAIL_FROM_NAME') || 'ONG DDB'

        const simulate = !clientId || !clientSecret || !refreshToken || !senderEmail

        const attachmentName = pdfName || `Certificat_${eventTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`

        const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre certificat de participation — ONG DDB</title>
</head>
<body style="margin:0;padding:20px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;border-radius:12px;background-color:#f9fafb;border:1px solid #e5e7eb;">
    <p style="font-size:16px;color:#1f2937;line-height:1.6;margin:0;">
      Bonjour ${fullname} 🎓,<br><br>
      Merci pour votre participation à l'événement <strong>${eventTitle}</strong> ! Votre certificat de participation officiel est joint à cet e-mail en pièce jointe (PDF).
    </p>
    <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
    <p style="font-size:12px;color:#6b7280;margin:0;text-align:center;">
      ONG Développement Durable et Bien-Être — Gabon 🌱
    </p>
  </div>
</body>
</html>`;

        if (simulate) {
            console.log(`[SIMULATION] send-event-certificate → ${email} pour "${eventTitle}". Configurez GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/SMTP_USER pour un envoi réel.`)
            return new Response(JSON.stringify({ success: true, simulated: true, emailSent: false }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (!pdfBase64 || pdfBase64.length < 100) {
            throw new Error('Certificat PDF manquant ou invalide (pdfBase64).')
        }

        const accessToken = await getAccessToken(clientId, clientSecret, refreshToken)
        const plainText = htmlToText(htmlContent)

        const raw = buildRawMessageWithAttachment({
            from: senderEmail,
            fromName: senderName,
            to: email,
            toName: fullname,
            subject: `🎓 Votre certificat de participation — ${eventTitle}`,
            html: htmlContent,
            text: plainText,
            attachmentBase64: pdfBase64,
            attachmentName,
        })

        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw }),
        })

        if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`Gmail API error: ${errorText}`)
        }

        const data = await res.json()

        return new Response(JSON.stringify({
            success: true,
            emailSent: true,
            messageId: data.id || null,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error(`Edge function error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
