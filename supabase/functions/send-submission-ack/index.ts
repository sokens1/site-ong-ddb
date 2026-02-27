// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-submission-ack' bootstrapped.")

serve(async (req: Request) => {
    const { method } = req
    console.log(`Method: ${method}`)

    // Handle CORS Preflight
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
        const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'sokensdigital@gmail.com'
        const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'ONG DDB'

        if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY is not set')

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

        console.log(`Sending ack to ${email}...`)

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': BREVO_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                to: [{ email, name: fullname }],
                subject: 'Accusé de réception de votre candidature - ONG DDB',
                htmlContent: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #166534; font-size: 24px; margin: 0;">ONG DDB</h1>
                        <p style="text-transform: uppercase; font-size: 12px; letter-spacing: 2px; color: #6b7280; margin-top: 5px;">Organisation Non Gouvernementale</p>
                    </div>
                    
                    <p>Madame, Monsieur,</p>
                    
                    <p>Nous avons l'honneur d'accuser réception de votre candidature au sein de notre organisation, l'<b>ONG DDB</b>. Votre intérêt pour nos actions et votre volonté de contribuer à nos projets en faveur du développement durable sont vivement appréciés.</p>
                    
                    <p>Votre dossier est actuellement en cours d'examen par notre département des ressources humaines. Cette phase d'analyse vise à évaluer la cohérence entre votre profil et les besoins opérationnels de nos missions en cours.</p>
                    
                    <p>Nous ne manquerons pas de revenir vers vous dans les meilleurs délais pour vous informer de la suite donnée à votre demande. Si votre candidature est retenue pour une phase d'entretien, vous serez contacté directement via les coordonnées fournies dans votre formulaire.</p>
                    
                    <p>Nous vous remercions de la confiance que vous portez à l'ONG DDB et vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
                    
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    
                    <div style="font-size: 12px; color: #9ca3af; text-align: center;">
                        ceci est un message automatique, merci de ne pas y répondre directement.
                    </div>
                </div>
                `,
            }),
        })

        const brevoData = await res.text()
        console.log(`Brevo Status: ${res.status}, Body: ${brevoData}`)

        return new Response(brevoData, {
            status: res.status,
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
