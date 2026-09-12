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

console.log("Edge Function 'send-interview-invite' bootstrapped (Gmail API).")

serve(async (req: Request) => {
    const { method } = req
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Réservé aux comptes admin/charge_communication (planification d'entretien).
    const authError = await verifyAdminRequest(req, ['admin', 'charge_communication'], corsHeaders, 'send-interview-invite')
    if (authError) return authError

    try {
        const bodyText = await req.text()
        if (!bodyText) throw new Error('Empty body')
        const { email, fullname, date, location, type, notes } = JSON.parse(bodyText)
        if (!email || !fullname || !date) throw new Error('Champs manquants : email, fullname et date sont requis.')

        const cfg = getGmailConfig()

        const hour = new Date().getHours();
        const greeting = hour >= 18 ? 'Bonsoir' : 'Bonjour';

        const formattedDate = new Date(date).toLocaleString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })

        const htmlContent = `
          <div style="font-family: Arial; border: 1px solid #eee; border-radius: 10px; padding: 25px;">
            <h2 style="color: #166534;">${greeting} ${fullname},</h2>
            <p>Vous êtes convié à un entretien suite à votre candidature :</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><b>📅 Date :</b> ${formattedDate}</p>
              <p><b>📍 Modalité :</b> ${type === 'visio' ? '📹 Visioconférence' : '🏢 Présentiel'}</p>
              ${location ? `<p><b>🔗 Lieu/Lien :</b> ${location}</p>` : ''}
              ${notes ? `<p><b>📝 Notes :</b> ${notes}</p>` : ''}
            </div>
            <p>Merci de nous confirmer votre présence en répondant à ce mail.</p>
            <br>
            <p>L'équipe ONG DDB</p>
          </div>
        `;

        if (cfg.simulate) {
            console.log(`[SIMULATION] send-interview-invite → ${email}. Configurez GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/SMTP_USER pour un envoi réel.`)
            return new Response(JSON.stringify({ success: true, simulated: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const accessToken = await getGmailAccessToken(cfg)
        const plainText = htmlToText(htmlContent)
        const raw = buildRawMessage({
            from: cfg.senderEmail, fromName: cfg.senderName,
            to: email, toName: fullname,
            subject: '📅 Invitation à un entretien - ONG DDB',
            html: htmlContent, text: plainText,
        })
        const result = await sendGmailRaw(accessToken, raw)

        return new Response(JSON.stringify({ success: result.ok, messageId: result.id, error: result.error }), {
            status: result.ok ? 200 : 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error: any) {
        console.error(`Error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
