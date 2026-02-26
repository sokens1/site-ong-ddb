# Guide d'Installation Final : Emails & Entretiens

Toutes les modifications de code (frontend) sont déjà en place. Voici comment finaliser la configuration côté Supabase pour que les emails fonctionnent.

## 1. Table SQL (Entretiens)
Copiez et exécutez ce code dans le **SQL Editor** de Supabase :

```sql
CREATE TABLE IF NOT EXISTS interview_schedules (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  interview_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  interview_type TEXT DEFAULT 'visio' CHECK (interview_type IN ('visio', 'presentiel')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public manage interviews" ON interview_schedules FOR ALL USING (true) WITH CHECK (true);
```

## 2. Secrets Supabase
Vérifiez que ces 4 clés sont présentes dans **Project Settings > Edge Functions > Secrets** :
- `BREVO_API_KEY` : votre clé `xkeysib-...`
- `SENDER_EMAIL` : `sokensdigital@gmail.com`
- `SENDER_NAME` : `ONG DDB`
- `APP_URL` : l'adresse de votre site

## 3. Déploiement des 3 Fonctions
Créez ces 3 fonctions dans l'onglet **Edge Functions** et copiez le code depuis les fichiers locaux :
1. `send-submission-ack` → code dans `supabase/functions/send-submission-ack/index.ts`
2. `notify-new-submission` → code dans `supabase/functions/notify-new-submission/index.ts`
3. `send-interview-invite` → code dans `supabase/functions/send-interview-invite/index.ts`

## ⚠️ ÉTAPE CRUCIALE (C'est la cause de l'erreur 500)
Pour CHAQUE fonction :
1. Cliquez sur le nom de la fonction dans Supabase.
2. Allez dans l'onglet **Settings**.
3. **DÉSACTIVEZ** l'option **"Enforce JWT"** (elle doit être sur **OFF** / Grisé).
   *Pourquoi ?* Les candidats n'ont pas de compte utilisateur, ils ne peuvent donc pas envoyer de jeton d'authentification. Si l'option est active, Supabase rejette tout appel.

## 4. Vérification Brevo
Assurez-vous que `sokensdigital@gmail.com` est bien validé dans votre compte Brevo (**Senders & IPs**).
