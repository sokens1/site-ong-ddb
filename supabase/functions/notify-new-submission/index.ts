// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { checkRateLimit, getClientIp } from "../_shared/rateLimit.ts"
import { getGmailConfig, getGmailAccessToken, buildRawMessage, htmlToText, sendGmailRaw } from "../_shared/gmail.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'notify-new-submission' bootstrapped (Gmail API).")

serve(async (req: Request) => {
    const { method } = req
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Destinataires fixes (les admins), mais le contenu du message est
        // 100% fourni par l'appelant — sans limite, ça reste un vecteur de
        // spam interne / faux signalements en boucle.
        const allowed = await checkRateLimit('notify-new-submission', getClientIp(req))
        if (!allowed) {
            return new Response(JSON.stringify({ error: 'rate_limited' }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const APP_URL = Deno.env.get('APP_URL') || 'https://votre-site.com'
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing critical environment variables')

        const bodyText = await req.text()
        if (!bodyText) throw new Error('No body provided')

        let body
        try {
            body = JSON.parse(bodyText)
        } catch (e) {
            throw new Error(`Invalid JSON received`)
        }

        const { candidateName, candidateEmail, interest } = body

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        const { data: admins, error: dbError } = await supabase
            .from('user_profiles')
            .select('email')
            .in('role', ['admin', 'charge_communication'])

        if (dbError) throw dbError

        const recipients: string[] = (admins || []).map((a: any) => a.email).filter(Boolean)

        if (recipients.length === 0) {
            return new Response(JSON.stringify({ message: "No admins to notify" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const cfg = getGmailConfig()

        const htmlContent = `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #166534;">🔔 Nouvelle Candidature</h2>
            <p><b>Nom:</b> ${candidateName}</p>
            <p><b>Email:</b> ${candidateEmail}</p>
            <p><b>Domaine:</b> ${interest || 'Non spécifié'}</p>
            <br>
            <a href="${APP_URL}/espace-ddb/submissions" style="padding: 10px 20px; background: #166534; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Voir sur l'administration
            </a>
          </div>
        `

        if (cfg.simulate) {
            console.log(`[SIMULATION] notify-new-submission → ${recipients.length} admin(s). Configurez GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/SMTP_USER pour un envoi réel.`)
            return new Response(JSON.stringify({ success: true, simulated: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const accessToken = await getGmailAccessToken(cfg)
        const plainText = htmlToText(htmlContent)
        const raw = buildRawMessage({
            from: cfg.senderEmail, fromName: cfg.senderName,
            bcc: recipients,
            subject: `🔔 Nouvelle candidature: ${candidateName}`,
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
