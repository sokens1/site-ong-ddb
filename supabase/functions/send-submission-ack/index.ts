// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { checkRateLimit, getClientIp } from "../_shared/rateLimit.ts"
import { getGmailConfig, getGmailAccessToken, buildRawMessage, htmlToText, sendGmailRaw } from "../_shared/gmail.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-submission-ack' bootstrapped (Gmail API).")

serve(async (req: Request) => {
    const { method } = req
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Relais de spam potentiel sans ça : n'importe qui peut faire
        // envoyer un email à n'importe quelle adresse via notre compte.
        const allowed = await checkRateLimit('send-submission-ack', getClientIp(req))
        if (!allowed) {
            return new Response(JSON.stringify({ error: 'rate_limited' }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const bodyText = await req.text()
        if (!bodyText) throw new Error('No body provided in request')

        let body
        try {
            body = JSON.parse(bodyText)
        } catch (e) {
            throw new Error(`Invalid JSON: ${bodyText.substring(0, 50)}...`)
        }

        const { email, fullname } = body
        if (!email || !fullname) throw new Error('Email or Fullname missing in JSON')

        const cfg = getGmailConfig()

        const hour = new Date().getHours();
        const greeting = hour >= 18 ? 'Bonsoir' : 'Bonjour';

        const htmlContent = `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #166534; font-size: 24px; margin: 0;">ONG DDB</h1>
                        <p style="text-transform: uppercase; font-size: 12px; letter-spacing: 2px; color: #6b7280; margin-top: 5px;">Organisation Non Gouvernementale</p>
                    </div>
                    <p>${greeting} ${fullname},</p>
                    <p>Nous avons l'honneur d'accuser réception de votre candidature au sein de notre organisation, l'<b>ONG DDB</b>. Votre intérêt pour nos actions et votre volonté de contribuer à nos projets en faveur du développement durable sont vivement appréciés.</p>
                    <p>Votre dossier est actuellement en cours d'examen par notre département des ressources humaines. Cette phase d'analyse vise à évaluer la cohérence entre votre profil et les besoins opérationnels de nos missions en cours.</p>
                    <p>Nous ne manquerons pas de revenir vers vous dans les meilleurs délais pour vous informer de la suite donnée à votre demande. Si votre candidature est retenue pour une phase d'entretien, vous serez contacté directement via les coordonnées fournies dans votre formulaire.</p>
                    <p>Nous vous remercions de la confiance que vous portez à l'ONG DDB et vous prions d'agréer, l'expression de nos salutations distinguées.</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    <div style="font-size: 12px; color: #9ca3af; text-align: center;">
                        ceci est un message automatique, merci de ne pas y répondre directement.
                    </div>
                </div>
                `;

        if (cfg.simulate) {
            console.log(`[SIMULATION] send-submission-ack → ${email}. Configurez GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/SMTP_USER pour un envoi réel.`)
            return new Response(JSON.stringify({ success: true, simulated: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const accessToken = await getGmailAccessToken(cfg)
        const plainText = htmlToText(htmlContent)
        const raw = buildRawMessage({
            from: cfg.senderEmail, fromName: cfg.senderName,
            to: email, toName: fullname,
            subject: 'Accusé de réception de votre candidature - ONG DDB',
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
