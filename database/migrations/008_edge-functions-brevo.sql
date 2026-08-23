-- =====================================================
-- Documentation: Supabase Edge Functions pour emails 
-- Service email: Brevo (brevosend.com)
-- =====================================================
--
-- 🚀 CONFIGURATION CRITIQUE DANS LE DASHBOARD SUPABASE :
-- 1. Allez dans Edge Functions > Cliquez sur votre fonction
-- 2. Allez dans l'onglet "Settings"
-- 3. INTERRUPTEUR "Enforce JWT" : Doit être DÉSACTIVÉ (OFF) ⚠️
--    (C'est indispensable car les candidats n'ont pas de compte/token)
--
-- =====================================================
-- 1. send-submission-ack
-- Accusé de réception envoyé au candidat
-- =====================================================
/*
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
    const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'sokensdigital@gmail.com'
    const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'ONG DDB'

    const { email, fullname } = await req.json()

    if (!email || !fullname) {
      return new Response(JSON.stringify({ error: 'email and fullname required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email, name: fullname }],
        subject: 'Candidature reçue - ONG DDB',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #166534; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">ONG DDB</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
              <h2 style="color: #166534;">Bonjour ${fullname},</h2>
              <p>Nous avons bien reçu votre candidature et nous vous remercions de votre intérêt.</p>
              <p>Notre équipe examinera votre profil et vous contactera rapidement.</p>
              <br>
              <p style="color: #6b7280; font-size: 14px;">Cordialement,<br>L'équipe ONG DDB</p>
            </div>
          </div>
        `,
      }),
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), { 
      status: res.status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
*/

-- =====================================================
-- 2. notify-new-submission
-- Notification email envoyée aux admins
-- =====================================================
/*
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
      return new Response(JSON.stringify({ message: 'No admins found' }), { headers: corsHeaders })
    }

    const adminRecipients = admins.map(a => ({ email: a.email, name: a.full_name || a.email }))

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: adminRecipients,
        subject: `🔔 Nouvelle candidature: ${candidateName}`,
        htmlContent: `<h2>🔔 Nouvelle Candidature</h2>
                      <p><b>Nom:</b> ${candidateName}</p>
                      <p><b>Email:</b> ${candidateEmail}</p>
                      <p><b>Intérêt:</b> ${interest}</p>
                      <br>
                      <a href="${APP_URL}/admin/submissions" style="padding: 10px 20px; background: #166534; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Voir la candidature</a>`,
      }),
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
*/

-- =====================================================
-- 3. send-interview-invite
-- Invitation envoyée au candidat pour l'entretien
-- =====================================================
/*
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

    const { email, fullname, date, location, type, notes } = await req.json()

    if (!email || !fullname || !date) {
      return new Response(JSON.stringify({ error: 'email, fullname and date required' }), { status: 400, headers: corsHeaders })
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email, name: fullname }],
        subject: '📅 Invitation à un entretien - ONG DDB',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
            <div style="background: #166534; color: white; padding: 20px; text-align: center;"><h1>ONG DDB</h1></div>
            <div style="padding: 30px;">
              <h2>Bonjour ${fullname},</h2>
              <p>Nous avons le plaisir de vous convier à un entretien.</p>
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><b>📅 Date :</b> ${new Date(date).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                <p><b>📍 Modalité :</b> ${type === 'visio' ? '📹 Visioconférence' : '🏢 Présentiel'}${location ? ` (${location})` : ''}</p>
                ${notes ? `<p><b>📝 Notes :</b> ${notes}</p>` : ''}
              </div>
              <p>Merci de nous confirmer votre disponibilité en répondant à ce mail.</p>
              <p>Cordialement,<br>L'équipe ONG DDB</p>
            </div>
          </div>
        `,
      }),
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
*/
