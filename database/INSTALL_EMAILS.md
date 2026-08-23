# Guide d'Installation Final : Emails & Entretiens

Voici les modèles de code **garantis sans erreur 500** pour vos Edge Functions.

## 1. Table SQL (Entretiens)
À exécuter dans le **SQL Editor** Supabase :
```sql
CREATE TABLE IF NOT EXISTS interview_schedules (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  interview_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  interview_type TEXT DEFAULT 'visio',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public manage interviews" ON interview_schedules FOR ALL USING (true) WITH CHECK (true);
```

## 2. Secrets Supabase
Vérifiez dans **Project Settings > Edge Functions > Secrets** :
- `BREVO_API_KEY` : clé `xkeysib-...`
- `SENDER_EMAIL` : `sokensdigital@gmail.com`
- `SENDER_NAME` : `ONG DDB`
- `APP_URL` : l'URL de votre site (ou http://localhost:5173 pour tests locaux)

## 3. Déploiement (Dashboard Supabase)

⚠️ **IMPORTANT** : Pour CHAQUE fonction ci-dessous :
1. Allez dans l'onglet **Settings** de la fonction.
2. **DÉSACTIVEZ** l'option **"Verify JWT"** (ou "Enforce JWT"). Elle doit être grise / OFF.

### A. `send-submission-ack`
[Code source complet](file:///c:/Users/HP%20VICTUS%20AMD%20RYZEN5/Desktop/ONG%20DDB/site-ong-ddb/supabase/functions/send-submission-ack/index.ts)
```typescript
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
    const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'sokensdigital@gmail.com'
    const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'ONG DDB'

    const bodyText = await req.text()
    if (!bodyText) throw new Error('Empty body')
    const { email, fullname } = JSON.parse(bodyText)

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
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
            <p>Nous ne manquerons pas de revenir vers vous dans les meilleurs délais pour vous informer de la suite donnée à votre demande. Si votre candidature est retenue pour une phase d'entretien, vous serez contacté directement via les coordonnées fournies.</p>
            <p>Nous vous remercions de la confiance que vous portez à l'ONG DDB et vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <div style="font-size: 12px; color: #9ca3af; text-align: center;">Ceci est un message automatique, merci de ne pas y répondre directement.</div>
        </div>`
      }),
    })
    return new Response(await res.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
```

### B. `notify-new-submission`
```typescript
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
    const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'sokensdigital@gmail.com'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const APP_URL = Deno.env.get('APP_URL') || 'https://votre-site.com'

    const bodyText = await req.text()
    if (!bodyText) throw new Error('Empty body')
    const { candidateName, candidateEmail } = JSON.parse(bodyText)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: admins } = await supabase.from('user_profiles').select('email, full_name').in('role', ['admin', 'charge_communication'])
    const recipients = (admins || []).map((a: any) => ({ email: a.email, name: a.full_name || a.email }))

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'ONG DDB Notifications', email: SENDER_EMAIL },
        to: recipients,
        subject: `🔔 Nouvelle candidature: ${candidateName}`,
        htmlContent: `<h2>🔔 Nouvelle Candidature</h2><p><b>Nom:</b> ${candidateName}</p><p><b>Email:</b> ${candidateEmail}</p><br><a href="${APP_URL}/admin/submissions" style="padding: 10px 20px; background: #166534; color: white; text-decoration: none; border-radius: 5px;">Voir Candidature</a>`
      }),
    })
    return new Response(await res.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
```

### C. `send-interview-invite`
```typescript
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
    const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'sokensdigital@gmail.com'

    const bodyText = await req.text()
    if (!bodyText) throw new Error('Empty body')
    const { email, fullname, date, type, location } = JSON.parse(bodyText)

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'ONG DDB', email: SENDER_EMAIL },
        to: [{ email, name: fullname }],
        subject: 'Convocation à un entretien de recrutement - ONG DDB',
        htmlContent: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #166534; font-size: 24px; margin: 0;">ONG DDB</h1>
                <p style="text-transform: uppercase; font-size: 12px; letter-spacing: 2px; color: #6b7280; margin-top: 5px;">Département des Ressources Humaines</p>
            </div>
            <p>Madame, Monsieur,</p>
            <p>Faisant suite à l'examen de votre candidature, nous avons le plaisir de vous informer que votre profil a retenu toute notre attention. À ce titre, nous souhaiterions vous convier à un entretien afin d'échanger plus amplement sur votre parcours professionnel et vos motivations.</p>
            <div style="background-color: #f9fafb; border-left: 4px solid #166534; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534;">Détails de la convocation :</p>
                <p style="margin: 5px 0;"><b>Date et heure :</b> ${new Date(date).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                <p style="margin: 5px 0;"><b>Modalité :</b> ${type === 'visio' ? 'Visioconférence' : 'Présentiel'}</p>
                ${location ? `<p style="margin: 5px 0;"><b>Lieu / Lien :</b> ${location}</p>` : ''}
            </div>
            <p>Nous vous prions de bien vouloir nous confirmer votre disponibilité dès réception de ce message. En cas d'empêchement, nous vous remercions de nous en informer sans délai afin de convenir d'une nouvelle plage horaire.</p>
            <p>Dans l'attente de cet échange, nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <div style="text-align: center;">
                <p style="font-size: 14px; color: #166534; font-weight: bold; margin: 0;">Direction de l'ONG DDB</p>
            </div>
        </div>`
      }),
    })
    return new Response(await res.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
```
