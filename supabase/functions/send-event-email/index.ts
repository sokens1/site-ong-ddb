// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
// @ts-ignore
import { verifyAdminRequest } from "../_shared/verifyAdmin.ts"
import { getGmailConfig, getGmailAccessToken, buildRawMessage, htmlToText, sendGmailRaw } from "../_shared/gmail.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-event-email' bootstrapped (Gmail API).")

// Envoi groupé en BCC par lots — économise les appels API par rapport à un envoi
// individuel.
const CHUNK_SIZE = 30;
const DELAY_BETWEEN_CHUNKS_MS = 400;

serve(async (req: Request) => {
    const { method } = req
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Réservé aux comptes admin/charge_communication (composeur mail de l'admin) —
    // sans ce contrôle, n'importe qui avec la clé "anon" publique pouvait déclencher
    // des envois de mails en masse arbitraires via notre compte.
    const authError = await verifyAdminRequest(req, ['admin', 'charge_communication'], corsHeaders, 'send-event-email')
    if (authError) return authError

    try {
        const bodyText = await req.text()
        if (!bodyText) throw new Error('Empty request body')

        const { eventTitle, eventLogoUrl, targetGroup, subject, htmlContent, recipientEmails } = JSON.parse(bodyText)

        if (!subject || !htmlContent || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
            throw new Error('Champs manquants : subject, htmlContent et recipientEmails (non vide) sont requis.')
        }

        const cfg = getGmailConfig()

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

        if (cfg.simulate) {
            console.log(`[SIMULATION] send-event-email → groupe="${targetGroup}", ${recipientEmails.length} destinataire(s), sujet="${subject}". Configurez GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/SMTP_USER pour un envoi réel.`)
            return new Response(JSON.stringify({ success: true, simulated: true, sent: recipientEmails.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const accessToken = await getGmailAccessToken(cfg)
        const plainText = htmlToText(wrappedHtml)

        let totalSent = 0
        const errors: string[] = []

        for (let i = 0; i < recipientEmails.length; i += CHUNK_SIZE) {
            const chunk = recipientEmails.slice(i, i + CHUNK_SIZE)
            const raw = buildRawMessage({ from: cfg.senderEmail, fromName: cfg.senderName, bcc: chunk, subject, html: wrappedHtml, text: plainText })
            const result = await sendGmailRaw(accessToken, raw)
            if (!result.ok) errors.push(`Lot ${i / CHUNK_SIZE + 1}: ${result.error}`)
            else totalSent += chunk.length

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
