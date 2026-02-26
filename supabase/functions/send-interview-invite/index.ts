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
            return new Response(JSON.stringify({ error: 'email, fullname and date required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const formattedDate = new Date(date).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                to: [{ email, name: fullname }],
                subject: '📅 Invitation à un entretien - ONG DDB',
                htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <div style="background: #166534; color: white; padding: 25px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">ONG DDB</h1>
            </div>
            <div style="padding: 30px; line-height: 1.6; color: #374151;">
              <h2 style="color: #166534; margin-top: 0;">Bonjour ${fullname},</h2>
              <p>Nous avons le plaisir de vous convier à un entretien suite à votre candidature.</p>
              
              <div style="background: #f9fafb; padding: 20px; border-radius: 10px; border-left: 4px solid #166534; margin: 25px 0;">
                <p style="margin: 0 0 10px 0;"><b>📅 Date :</b> ${formattedDate}</p>
                <p style="margin: 0 0 10px 0;"><b>📍 Modalité :</b> ${type === 'visio' ? '📹 Visioconférence' : '🏢 Présentiel'}</p>
                ${location ? `<p style="margin: 0 0 10px 0;"><b>🔗 Lieu/Lien :</b> ${location}</p>` : ''}
                ${notes ? `<p style="margin: 0;"><b>📝 Notes :</b> ${notes}</p>` : ''}
              </div>
              
              <p>Merci de nous confirmer votre présence en répondant directement à cet email.</p>
              <br>
              <p>Excellent journée,<br><b>L'équipe ONG DDB</b></p>
            </div>
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
