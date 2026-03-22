// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-event-confirmation' bootstrapped.")

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
        if (!bodyText) throw new Error('Empty request body')

        const { email, fullname, eventTitle, eventDate, eventLocation } = JSON.parse(bodyText)

        if (!email || !fullname || !eventTitle || !eventDate) {
            throw new Error('Missing required fields for event ticket')
        }

        console.log(`Sending event ticket to ${email} for event ${eventTitle}...`)

        // Format Date
        const dateObj = new Date(eventDate);
        const formattedDate = dateObj.toLocaleDateString('fr-FR', { 
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });

        // Generate dynamic QR Code Data
        const qrData = encodeURIComponent(`ONG DDB Ticket\nName: ${fullname}\nEvent: ${eventTitle}\nDate: ${formattedDate}`);
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&color=0f5132&bgcolor=ffffff`;

        const finalHtmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px; }
                .ticket-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
                .ticket-header { background-color: #14532d; color: #ffffff; padding: 30px; text-align: center; }
                .ticket-header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
                .ticket-header p { margin: 5px 0 0 0; color: #bbf7d0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
                .ticket-body { padding: 40px 30px; text-align: center; }
                .greeting { font-size: 20px; font-weight: bold; color: #111827; margin-bottom: 20px; }
                .message { font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 30px; }
                .event-card { background-color: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 25px; margin-bottom: 30px; }
                .event-title { font-size: 22px; font-weight: bold; color: #166534; margin: 0 0 15px 0; }
                .event-detail { font-size: 15px; color: #14532d; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; }
                .event-detail strong { margin-right: 5px; }
                .qr-section { margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb; }
                .qr-code { width: 150px; height: 150px; border: 4px solid #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; }
                .qr-text { font-size: 12px; color: #6b7280; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
                .ticket-footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e5e7eb; }
              </style>
            </head>
            <body>
              <div class="ticket-container">
                <div class="ticket-header">
                  <h1>Billet d'entrée</h1>
                  <p>ONG DDB Événements</p>
                </div>
                
                <div class="ticket-body">
                  <div class="greeting">Bonjour ${fullname},</div>
                  <div class="message">
                    Votre inscription a été confirmée avec succès. Veuillez présenter ce billet (sur votre téléphone ou imprimé) lors de votre arrivée à l'événement.
                  </div>
                  
                  <div class="event-card">
                    <h2 class="event-title">${eventTitle}</h2>
                    <div class="event-detail">
                      <strong>Date :</strong> ${formattedDate}
                    </div>
                    ${eventLocation ? `
                    <div class="event-detail">
                      <strong>Lieu :</strong> ${eventLocation}
                    </div>
                    ` : ''}
                  </div>
                  
                  <div class="qr-section">
                    <img src="${qrCodeUrl}" alt="QR Code Billet" class="qr-code" />
                    <div class="qr-text">Billet Personnel - Ne pas partager</div>
                  </div>
                </div>
                
                <div class="ticket-footer">
                  Ce billet vous donne accès à l'événement indiqué. L'accès peut être refusé si le billet n'est pas valide ou s'il a déjà été scanné.<br><br>
                  © ${new Date().getFullYear()} ONG DDB. Tous droits réservés.
                </div>
              </div>
            </body>
          </html>
        `;

        const payload = {
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: email, name: fullname }],
            subject: `Votre Billet : ${eventTitle}`,
            htmlContent: finalHtmlContent
        };

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': BREVO_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Brevo API error:', errorText);
            throw new Error(`Brevo API error: ${errorText}`);
        }

        const data = await res.json();
        console.log("Ticket email sent successfully.");

        return new Response(JSON.stringify({ success: true, messageId: data.messageId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error: any) {
        console.error(`Edge function error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
