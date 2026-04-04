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

        const { email, fullname, eventTitle, eventDate, eventLocation, ticketRef, price, pdfAttachment } = JSON.parse(bodyText)

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
        const qrData = ticketRef || `DDB-${fullname}-${eventTitle}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&color=064e3b&bgcolor=ffffff`;

        const finalHtmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 10px; color: #1e293b; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { color: #064e3b; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }
                .content { line-height: 1.6; font-size: 16px; }
                .event-box { background: #f0fdf4; border: 1px solid #dcfce7; padding: 20px; border-radius: 12px; margin: 25px 0; }
                .event-title { font-weight: 800; color: #064e3b; font-size: 18px; margin-bottom: 10px; }
                .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #64748b; }
                .btn { display: inline-block; background: #064e3b; color: white !important; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">ONG DDB</div>
                </div>
                <div class="content">
                  <p>Bonjour <strong>${fullname}</strong>,</p>
                  <p>Nous avons le plaisir de vous confirmer votre inscription pour l'événement suivant :</p>
                  
                  <div class="event-box">
                    <div class="event-title">${eventTitle}</div>
                    <div style="font-size: 14px; color: #166534;">
                      📅 ${formattedDate}<br>
                      📍 ${eventLocation || 'Lieu à confirmer'}
                    </div>
                  </div>

                  <p><strong>Votre billet officiel est joint à cet e-mail en format PDF.</strong></p>
                  <p>Veuillez le conserver sur votre téléphone ou l'imprimer pour le présenter à l'entrée.</p>
                  
                  <div style="text-align: center;">
                    <a href="https://ong-ddb.org/events" class="btn">Voir d'autres événements</a>
                  </div>
                </div>
                
                <div class="footer">
                  © ${new Date().getFullYear()} ONG DDB - Agissons pour un avenir durable.<br>
                  Contact : ${SENDER_EMAIL}
                </div>
              </div>
            </body>
          </html>
        `;

        const payload: any = {
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: email, name: fullname }],
            subject: `Votre Billet PDF : ${eventTitle} - ONG DDB`,
            htmlContent: finalHtmlContent
        };

        if (pdfAttachment) {
            payload.attachment = [
                {
                    content: pdfAttachment,
                    name: `Billet_${eventTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`
                }
            ];
        }

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
