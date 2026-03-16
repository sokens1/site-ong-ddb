// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function 'send-bulk-newsletter' bootstrapped.")

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

        const { subject, htmlContent, targetEmails, attachmentUrl } = JSON.parse(bodyText)

        if (!targetEmails || !Array.isArray(targetEmails) || targetEmails.length === 0) {
            throw new Error('targetEmails is required and must be a non-empty array')
        }

        console.log(`Sending bulk newsletter to ${targetEmails.length} subscribers...`)

        let finalHtmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }
                .email-wrapper { background-color: #f3f4f6; padding: 40px 20px; }
                .email-content { background-color: #ffffff; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
                .email-subject { font-size: 16px; font-weight: bold; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #10b981; color: #111827; }
                .email-body { font-size: 15px; margin-bottom: 30px; white-space: pre-wrap; }
                .email-body p { margin-top: 0; margin-bottom: 1.2em; display: block; }
                .email-body ul, .email-body ol { margin-bottom: 1.2em; padding-left: 20px; }
                .email-body li { margin-bottom: 0.5em; }
                .attachment-block { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; }
                .attachment-button { display: inline-block; background-color: #10b981; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; }
                .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #f3f4f6; padding-top: 20px; }
              </style>
            </head>
            <body>
              <div class="email-wrapper">
                <div class="email-content">
                  <div class="email-subject">
                    Objet : ${subject}
                  </div>
                  <div class="email-body">
                    ${htmlContent}
                  </div>
                  
                  ${attachmentUrl ? `
                  <div class="attachment-block">
                    <p style="margin-bottom: 10px; font-size: 14px; font-weight: bold;">📎 Pièce jointe :</p>
                    <a href="${attachmentUrl}" class="attachment-button">Consulter le document</a>
                  </div>
                  ` : ''}

                  <div class="footer">
                    <p>Cet e-mail vous est envoyé par l'ONG DDB.</p>
                    <p>Pour vous désabonner, veuillez vous rendre sur notre site internet.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;

        // Split emails into chunks of 50 for BCC to avoid API limits and hide recipients
        const chunkSize = 50;
        const chunks = [];
        for (let i = 0; i < targetEmails.length; i += chunkSize) {
            chunks.push(targetEmails.slice(i, i + chunkSize));
        }

        const results = [];

        for (const chunk of chunks) {
            const bccList = chunk.map(email => ({ email }));

            const payload = {
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                to: [{ email: SENDER_EMAIL, name: "Abonnés ONG DDB" }], // Send to self as primary
                bcc: bccList, // Real targets are hidden in BCC
                subject: subject,
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
            results.push(data);
        }

        console.log("Newsletter sent successfully in " + chunks.length + " chunk(s).");

        return new Response(JSON.stringify({ success: true, results }), {
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
