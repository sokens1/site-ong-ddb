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

        if (!BREVO_API_KEY) {
            throw new Error('BREVO_API_KEY is not configured. Please set it in Supabase secrets.')
        }

        const bodyText = await req.text()
        if (!bodyText) throw new Error('Empty request body')

        const { email, fullname, eventTitle, eventDate, eventLocation, pdfBase64, pdfName } = JSON.parse(bodyText)

        if (!email || !fullname || !eventTitle || !eventDate) {
            throw new Error('Missing required fields for event ticket')
        }

        console.log(`Sending event ticket email to ${email} for event "${eventTitle}"...`)

        // Format Date
        const dateObj = new Date(eventDate);
        const formattedDate = dateObj.toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // QR Code URL
        const qrData = encodeURIComponent(`ONG DDB\nParticipant: ${fullname}\nEvenement: ${eventTitle}\nDate: ${formattedDate}`);
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&color=0f5132&bgcolor=ffffff`;

        // ── Beautiful Email HTML ─────────────────────────────────────────────
        const finalHtmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre billet d'entrée — ONG DDB</title>
</head>
<body style="margin:0;padding:20px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;border-radius:12px;background-color:#f9fafb;border:1px solid #e5e7eb;">
    <p style="font-size:16px;color:#1f2937;line-height:1.6;margin:0;">
      Bonjour ${fullname} 👋,<br><br>
      Votre inscription à l'événement <strong>${eventTitle}</strong> a été enregistrée avec succès. Votre billet d'entrée officiel est joint à cet e-mail en pièce jointe (PDF).
    </p>
    <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
    <p style="font-size:12px;color:#6b7280;margin:0;text-align:center;">
      ONG Développement Durable et Bien-Être — Gabon 🌱
    </p>
  </div>
</body>
</html>`;

        // ── Brevo Payload ────────────────────────────────────────────────────
        const payload: any = {
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: email, name: fullname }],
            subject: `🎟️ Votre billet — ${eventTitle}`,
            htmlContent: finalHtmlContent,
        };

        // Attach the PDF if provided (generated client-side)
        if (pdfBase64 && pdfBase64.length > 100) {
            payload.attachment = [{
                content: pdfBase64,
                name: pdfName || `Billet_${eventTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`,
            }];
            console.log(`PDF attachment included (${pdfBase64.length} chars base64).`);
        } else {
            console.log('No PDF attachment (pdfBase64 not provided or too short).');
        }

        let emailSent = false;
        let messageId = null;
        let emailError = null;
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`Brevo attempt ${attempt}/${MAX_RETRIES}...`);
                const res = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'api-key': BREVO_API_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    emailError = `Brevo error (attempt ${attempt}): ${errorText}`;
                    console.error(emailError);
                    if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 1000 * attempt));
                } else {
                    const data = await res.json();
                    messageId = data.messageId;
                    emailSent = true;
                    console.log(`✅ Email sent on attempt ${attempt}. messageId: ${messageId}`);
                    break;
                }
            } catch (err: any) {
                emailError = `Network error (attempt ${attempt}): ${err.message}`;
                console.error(emailError);
                if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }

        return new Response(JSON.stringify({
            success: true,
            emailSent,
            emailError,
            messageId,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error(`Edge function error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
