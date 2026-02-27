// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'notify-new-submission' bootstrapped.")

serve(async (req: Request) => {
    const { method } = req
    console.log(`Method: ${method}`)

    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
        const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'sokensdigital@gmail.com'
        const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'ONG DDB'
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const APP_URL = Deno.env.get('APP_URL') || 'https://votre-site.com'

        if (!BREVO_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Missing critical environment variables')
        }

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
            .select('email, full_name')
            .in('role', ['admin', 'charge_communication'])

        if (dbError) throw dbError

        const recipients = (admins || []).map((a: any) => ({
            email: a.email,
            name: a.full_name || a.email
        }))

        if (recipients.length === 0) {
            return new Response(JSON.stringify({ message: "No admins to notify" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log(`Notifying ${recipients.length} admins...`)

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                to: recipients,
                subject: `🔔 Nouvelle candidature: ${candidateName}`,
                htmlContent: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #166534;">🔔 Nouvelle Candidature</h2>
            <p><b>Nom:</b> ${candidateName}</p>
            <p><b>Email:</b> ${candidateEmail}</p>
            <p><b>Domaine:</b> ${interest || 'Non spécifié'}</p>
            <br>
            <a href="${APP_URL}/admin/submissions" style="padding: 10px 20px; background: #166534; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Voir sur l'administration
            </a>
          </div>
        `
            }),
        })

        const brevoData = await res.text()
        return new Response(brevoData, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error: any) {
        console.error(`Error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
