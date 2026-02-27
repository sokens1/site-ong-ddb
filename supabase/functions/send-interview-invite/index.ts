// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-interview-invite' bootstrapped.")

serve(async (req: Request) => {
    const { method } = req
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
        const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'sokensdigital@gmail.com'
        const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'ONG DDB'

        if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY missing')

        const bodyText = await req.text()
        if (!bodyText) throw new Error('Empty body')
        const { email, fullname, date, location, type, notes } = JSON.parse(bodyText)

        const formattedDate = new Date(date).toLocaleString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })

        console.log(`Sending interview invite to ${email}...`)

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                to: [{ email, name: fullname }],
                subject: '📅 Invitation à un entretien - ONG DDB',
                htmlContent: `
          <div style="font-family: Arial; border: 1px solid #eee; border-radius: 10px; padding: 25px;">
            <h2 style="color: #166534;">Bonjour ${fullname},</h2>
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
        `
            }),
        })

        const result = await res.text()
        return new Response(result, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
        console.error(`Error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
