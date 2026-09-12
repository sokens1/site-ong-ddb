// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { verifyAdminRequest } from "../_shared/verifyAdmin.ts"
import { getGmailConfig, getGmailAccessToken, buildRawMessage, htmlToText, sendGmailRaw } from "../_shared/gmail.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-bulk-newsletter' bootstrapped (Gmail API).")

const CHUNK_SIZE = 30
const DELAY_BETWEEN_CHUNKS_MS = 400

serve(async (req: Request) => {
    const { method } = req
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Réservé aux comptes admin/charge_communication — sans ce contrôle, n'importe
    // qui avec la clé "anon" publique pouvait déclencher un envoi de newsletter
    // arbitraire à toute la liste d'abonnés.
    const authError = await verifyAdminRequest(req, ['admin', 'charge_communication'], corsHeaders, 'send-bulk-newsletter')
    if (authError) return authError

    try {
        const bodyText = await req.text()
        if (!bodyText) throw new Error('Empty request body')

        const { subject, htmlContent, targetEmails, attachmentUrl } = JSON.parse(bodyText)

        if (!subject || !htmlContent || !Array.isArray(targetEmails) || targetEmails.length === 0) {
            throw new Error('subject, htmlContent et targetEmails (non vide) sont requis.')
        }

        const cfg = getGmailConfig()

        const finalHtmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #ffffff; }
                .email-container { max-width: 800px; margin: 0; }
                .email-subject { font-size: 16px; font-weight: bold; margin-bottom: 25px; padding-bottom: 10px; border-bottom: 1px solid #10b981; color: #111827; }
                .email-body { font-size: 15px; margin-bottom: 30px; white-space: pre-wrap; }
                .email-body p { margin-top: 0; margin-bottom: 1.2em; display: block; }
                .email-body ul, .email-body ol { margin-bottom: 1.2em; padding-left: 20px; }
                .email-body li { margin-bottom: 0.5em; }
                .attachment-block { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; }
                .attachment-button { display: inline-block; background-color: #10b981; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; }
                .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #f3f4f6; color: #6b7280; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="email-container">
                <div class="email-subject">Objet : ${subject}</div>
                <div class="email-body">${htmlContent}</div>
                ${attachmentUrl ? `
                <div class="attachment-block">
                  <p style="margin-bottom: 10px; font-size: 14px; font-weight: bold;">📎 Pièce jointe :</p>
                  <a href="${attachmentUrl}" class="attachment-button">Consulter le document</a>
                </div>
                ` : ''}
                <div class="footer">
                  <p style="margin: 0;">Cet e-mail vous est envoyé par l'ONG DDB.</p>
                  <p style="margin: 5px 0 0 0;">Pour vous désabonner, veuillez vous rendre sur notre site internet.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        if (cfg.simulate) {
            console.log(`[SIMULATION] send-bulk-newsletter → ${targetEmails.length} destinataire(s). Configurez GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/SMTP_USER pour un envoi réel.`)
            return new Response(JSON.stringify({ success: true, simulated: true, sent: targetEmails.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const accessToken = await getGmailAccessToken(cfg)
        const plainText = htmlToText(finalHtmlContent)

        let totalSent = 0
        const errors: string[] = []

        for (let i = 0; i < targetEmails.length; i += CHUNK_SIZE) {
            const chunk = targetEmails.slice(i, i + CHUNK_SIZE)
            const raw = buildRawMessage({ from: cfg.senderEmail, fromName: cfg.senderName, bcc: chunk, subject, html: finalHtmlContent, text: plainText })
            const result = await sendGmailRaw(accessToken, raw)
            if (!result.ok) errors.push(`Lot ${i / CHUNK_SIZE + 1}: ${result.error}`)
            else totalSent += chunk.length

            if (i + CHUNK_SIZE < targetEmails.length) {
                await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS))
            }
        }

        console.log(`Newsletter envoyée : ${totalSent}/${targetEmails.length}, ${errors.length} erreur(s).`)

        return new Response(JSON.stringify({ success: errors.length === 0, sent: totalSent, errors }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error: any) {
        console.error(`Edge function error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
