import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
        const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'sokensdigital@gmail.com'
        const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'ONG DDB'
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const APP_URL = Deno.env.get('APP_URL') || 'https://votre-site.com'

        const { candidateName, candidateEmail, interest, city } = await req.json()

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        const { data: admins } = await supabase
            .from('user_profiles')
            .select('email, full_name')
            .in('role', ['admin', 'charge_communication'])

        if (!admins || admins.length === 0) {
            return new Response(JSON.stringify({ message: 'No admins found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const adminRecipients = admins.map(a => ({ email: a.email, name: a.full_name || a.email }))

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                to: adminRecipients,
                subject: `🔔 Nouvelle candidature: ${candidateName}`,
                htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #166534;">🔔 Nouvelle Candidature Reçue</h2>
            <p><b>Candidat :</b> ${candidateName}</p>
            <p><b>Email :</b> ${candidateEmail}</p>
            <p><b>Domaine :</b> ${interest || 'Non spécifié'}</p>
            <p><b>Ville :</b> ${city || 'Non spécifié'}</p>
            <br>
            <a href="${APP_URL}/admin/submissions" style="padding: 12px 24px; background: #166534; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Voir sur l'administration
            </a>
          </div>
        `,
            }),
        })

        const result = await res.json()
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
