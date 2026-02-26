import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
        const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'sokensdigital@gmail.com'
        const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'ONG DDB'

        const { email, fullname } = await req.json()

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
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
            <div style="background: #166534; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">ONG DDB</h1>
            </div>
            <div style="padding: 30px;">
              <h2 style="color: #166534;">Bonjour ${fullname},</h2>
              <p>Nous avons bien reçu votre candidature et nous vous remercions de votre intérêt.</p>
              <p>Notre équipe l'étudiera avec attention et reviendra vers vous prochainement.</p>
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
