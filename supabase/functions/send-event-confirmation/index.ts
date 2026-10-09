// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { checkRateLimit, getClientIp } from "../_shared/rateLimit.ts"
import { getGmailConfig, getGmailAccessToken, buildRawMessageWithAttachment, htmlToText, sendGmailRaw } from "../_shared/gmail.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-event-confirmation' bootstrapped (Gmail API).")

serve(async (req: Request) => {
    const { method } = req
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Sans ça, n'importe qui peut envoyer un email avec une pièce jointe
        // arbitraire (le PDF) à n'importe quelle adresse via notre compte —
        // relais de spam/phishing potentiel. Rate limit par IP.
        const allowed = await checkRateLimit('send-event-confirmation', getClientIp(req))
        if (!allowed) {
            return new Response(JSON.stringify({ error: 'rate_limited' }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const bodyText = await req.text()
        if (!bodyText) throw new Error('Empty request body')

        const { email, fullname, eventTitle, eventDate, pdfBase64, pdfName, attachments, participantNames } = JSON.parse(bodyText)

        if (!email || !fullname || !eventTitle || !eventDate) {
            throw new Error('Missing required fields for event ticket')
        }

        // Collecter les pièces jointes (soit un tableau multi-billets, soit le format unitaire)
        const finalAttachments: Array<{ base64: string; name: string }> =
            Array.isArray(attachments) && attachments.length > 0
                ? attachments
                : pdfBase64 && pdfBase64.length >= 100
                ? [{ base64: pdfBase64, name: pdfName || `Billet_${eventTitle.replace(/[^a-z0-9]/gi, '_')}.pdf` }]
                : []

        if (finalAttachments.length === 0) {
            throw new Error('Aucun billet PDF valide fourni en pièce jointe.')
        }

        const cfg = getGmailConfig()

        const dateObj = new Date(eventDate);
        const formattedDate = dateObj.toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const isMulti = finalAttachments.length > 1;
        const subject = isMulti
            ? `🎟️ Vos ${finalAttachments.length} billets officiels — ${eventTitle}`
            : `🎟️ Votre billet d'entrée — ${eventTitle}`;

        const participantsListHtml = Array.isArray(participantNames) && participantNames.length > 0
            ? `<div style="margin:16px 0;padding:14px 18px;background-color:#f3f4f6;border-radius:10px;border:1px solid #e5e7eb;">
                 <p style="margin:0 0 8px 0;font-weight:bold;font-size:13px;color:#374151;">Participants inscrits (${finalAttachments.length}) :</p>
                 <ul style="margin:0;padding-left:20px;font-size:14px;color:#4b5563;line-height:1.6;">
                   ${participantNames.map((n: string) => `<li><strong>${n}</strong></li>`).join('')}
                 </ul>
               </div>`
            : '';

        const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:20px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;border-radius:12px;background-color:#f9fafb;border:1px solid #e5e7eb;">
    <p style="font-size:16px;color:#1f2937;line-height:1.6;margin:0;">
      Bonjour ${fullname} 👋,<br><br>
      Votre réservation pour l'événement <strong>${eventTitle}</strong> (${formattedDate}) a été validée avec succès !<br><br>
      ${isMulti 
        ? `Vous trouverez ci-joint vos <strong>${finalAttachments.length} billets officiels</strong> au format PDF. Chaque participant doit présenter son propre billet muni de son QR code à l'entrée :` 
        : `Votre billet d'entrée officiel est joint à cet e-mail en pièce jointe (PDF). Présentez-le à l'entrée de l'événement :`}
    </p>
    ${participantsListHtml}
    <p style="font-size:13px;color:#6b7280;line-height:1.5;margin-top:16px;">
      💡 Pensez à enregistrer ou imprimer les billets PDF avant votre arrivée.
    </p>
    <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
    <p style="font-size:12px;color:#6b7280;margin:0;text-align:center;">
      ONG Développement Durable et Bien-Être — Gabon 🌱
    </p>
  </div>
</body>
</html>`;

        if (cfg.simulate) {
            console.log(`[SIMULATION] send-event-confirmation → ${email} pour "${eventTitle}" (${finalAttachments.length} billet(s)). Configurez GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/SMTP_USER pour un envoi réel.`)
            return new Response(JSON.stringify({ success: true, simulated: true, emailSent: false, count: finalAttachments.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const accessToken = await getGmailAccessToken(cfg)
        const plainText = htmlToText(htmlContent)
        const raw = buildRawMessageWithAttachment({
            from: cfg.senderEmail, fromName: cfg.senderName,
            to: email, toName: fullname,
            subject,
            html: htmlContent, text: plainText,
            attachments: finalAttachments,
        })
        const result = await sendGmailRaw(accessToken, raw)

        return new Response(JSON.stringify({
            success: true,
            emailSent: result.ok,
            emailError: result.error || null,
            messageId: result.id || null,
            count: finalAttachments.length,
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
