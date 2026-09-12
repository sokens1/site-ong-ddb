# Sécurité — checklist & doctrine

Document vivant. Chaque fois qu'on corrige une vraie faille (ici ou sur un
autre projet Supabase/Vite/Vercel), on l'ajoute ici : le problème, comment le
détecter, comment le corriger, un exemple concret. Objectif : ne plus jamais
refaire deux fois le même audit à partir de zéro.

**Convention** : chaque item a un statut sur *ce* projet (✅ corrigé / ⚠️ à
faire / ➖ non applicable) et une recette générique réutilisable ailleurs.

---

## Doctrine générale

- **Defense in depth** : chaque donnée sensible est protégée à *plusieurs*
  niveaux indépendants (client + RLS + contrainte SQL), jamais un seul. Si le
  client est contourné (appel direct à l'API REST), la base doit quand même
  tenir.
- **Fail-open sur les formulaires publics, fail-closed sur l'admin.** Un faux
  positif anti-bot qui bloque un vrai visiteur sur un formulaire de don coûte
  cher (conversion perdue) ; un faux négatif qui laisse passer un bot coûte
  peu (une ligne à supprimer). Sur l'authentification c'est l'inverse : un
  verrou de connexion doit tenir même si ça gêne un admin de temps en temps.
- **Le vrai anti-brute-force, c'est le rate limiting côté serveur, jamais un
  captcha seul.** Un captcha ralentit un humain, il n'arrête pas un script qui
  a le temps. Le captcha est un bonus, la limite de tentatives est le frein
  réel.
- **Aucun secret ne doit pouvoir être lu depuis le navigateur.** Une clé
  publique (`anon key`, `VITE_*`, Site Key Turnstile) peut être dans le
  bundle JS sans problème — c'est fait pour. Une clé privée (`service_role`,
  Secret Key, clé API tierce) ne doit **jamais** avoir de préfixe exposé au
  build (`VITE_`, `NEXT_PUBLIC_`, etc.) et ne vit que côté Edge
  Function / serveur.
- **Toute écriture publique passe une vérification serveur avant d'atteindre
  la table.** RLS + une Edge Function de garde valent mieux qu'une validation
  uniquement côté React.
- **Chaque correctif de sécurité en base = une migration numérotée,
  idempotente (`IF EXISTS`/`IF NOT EXISTS`), avec un commentaire qui explique
  le *avant* et le *pourquoi*.** Pas de `DROP`/`ALTER` one-shot non tracé.

---

## 1. Row Level Security (RLS) — Supabase / Postgres

| # | Point | Statut ici |
|---|---|---|
| 1.1 | Toute table exposée par l'API REST a `ENABLE ROW LEVEL SECURITY` | ✅ (audit `035`) |
| 1.2 | Aucune policy `FOR ALL USING (true)` sur une table publique | ✅ (`038`, `site_visits`) |
| 1.3 | Les policies `SELECT` publiques ne renvoient que les colonnes/lignes nécessaires (pas de "authenticated = tout voir" par facilité) | ✅ (`010`, `030`) |
| 1.4 | Un `INSERT` public autorisé (`anon`) n'implique PAS un `SELECT` public — vérifier que le code ne fait pas `.insert().select()` derrière une policy SELECT restreinte | ✅ (bug trouvé et corrigé, voir §7) |
| 1.5 | Table RLS activée mais **sans aucune policy** = verrou total involontaire — à distinguer d'un verrou voulu | à vérifier périodiquement (bloc 13 de `AUDIT.sql`) |

### 1.6 Routes admin/login prévisibles

| # | Point | Statut ici |
|---|---|---|
| 1.6.a | Les routes d'admin/login évitent les noms de dictionnaire (`/admin`, `/login`, `/wp-admin`, `/dashboard`) que les scanners automatisés essaient en premier | ✅ (`/espace-ddb`, `/espace-ddb/connexion`) |
| 1.6.b | Ce renommage est de l'obscurité, **pas une protection en soi** — le vrai frein reste le rate limiting côté serveur (§2). Sans lui, renommer la route ne fait que retarder un attaquant qui lit le bundle JS (les routes y sont en clair, une SPA ne peut pas les cacher complètement) | ✅ rate limiting fait en parallèle |
| 1.6.c | Le contenu protégé (layout + Outlet) ne s'affiche **jamais** avant que la vérification de session soit terminée — sinon flash visible de l'interface admin avant la redirection vers le login | ✅ (état `authChecked`, écran de chargement le temps du check) |

**Piège classique (§1.6.c)** : un composant de layout protégé (`<Outlet/>` ou
équivalent) qui se monte immédiatement avec `user = null` pendant qu'un
`useEffect` vérifie la session en asynchrone, et ne redirige qu'une fois la
promesse résolue. Entre les deux, React a déjà rendu le contenu protégé au
moins une frame — visible à l'œil nu sur un rechargement direct de l'URL
protégée. **Fix** : un état `authChecked` (faux au départ), ne rendre le
contenu réel (ou l'`<Outlet/>`) que lorsque `authChecked && user`, un loader
sinon.

**Comment auditer** : `database/AUDIT.sql`, blocs 1, 2, 12, 13. Générique,
réutilisable tel quel sur n'importe quel projet Supabase (adapter juste les
noms de table dans les blocs 15/16/18/19 si besoin).

**Piège classique (§1.4)** : `supabase.from('t').insert([...]).select('id').single()`
depuis un client anonyme. Si la policy `SELECT` est restreinte à
`authenticated`/un rôle staff, PostgREST refuse **toute** la requête (le
`RETURNING` est soumis à la policy SELECT) — même si l'`INSERT` lui-même
était autorisé. Symptôme : `401` uniquement en prod, jamais détecté en local
si on teste connecté en admin. **Fix** : ne jamais `.select()` après un
insert public ; si l'id est nécessaire côté client, le générer côté client
(`crypto.randomUUID()`) avant l'insert plutôt que de le relire.

---

## 2. Authentification & anti brute-force

| # | Point | Statut ici |
|---|---|---|
| 2.1 | Le formulaire de login n'appelle jamais `signInWithPassword` en direct depuis le composant — passe par un point d'entrée serveur qui peut compter les échecs | ✅ (`041` + edge function `admin-login`) |
| 2.2 | Verrouillage par **email** ET par **IP** (un attaquant qui change d'email pour un email fixe, et un attaquant qui essaie plusieurs emails depuis la même IP, doivent tous les deux être freinés) | ✅ |
| 2.3 | Message d'erreur générique — ne jamais révéler si l'email existe ("email introuvable" vs "mot de passe incorrect" = fuite d'énumération de comptes) | ✅ |
| 2.4 | Table de compteur de tentatives : RLS activée, **aucune policy** (ni lecture ni écriture depuis le navigateur, même connecté) — sinon un attaquant peut lire qui a déjà tenté, ou purger ses propres échecs | ✅ |
| 2.5 | Alerte (log `security_events` ou équivalent) au-delà d'un seuil, pas seulement un blocage silencieux | ✅ |
| 2.6 | Vérifier qu'aucun email public (footer, page contact) n'est aussi l'identifiant d'un compte à privilèges sans mot de passe fort dédié | ⚠️ à confirmer par le client |
| 2.8 | Aucune création de compte via `supabase.auth.signUp()` public — cet endpoint est appelable par n'importe qui avec la seule clé `anon` (visible dans le bundle), **même si aucune page du site n'expose de formulaire d'inscription**. Les comptes staff doivent être créés via une Edge Function service role + vérification du rôle appelant | ✅ (`admin-create-user`, remplace `signUp()` dans `UsersAdmin.tsx`) |
| 2.9 | "Allow new users to sign up" désactivé dans Supabase Auth Settings dès que plus aucun flux légitime n'en dépend | ⚠️ **à faire par le client** dans le Dashboard, une fois `admin-create-user` déployée |
| 2.10 | **Ne jamais activer "Enable Captcha protection" native de Supabase Auth** tant que `admin-login` n'envoie pas de `captcha_token` à GoTrue — elle est tout-ou-rien : sans ce champ, TOUTES les connexions par mot de passe échouent en 400 (`captcha_failed`), sans rate limiting ni message clair, et sans lien avec notre Turnstile applicatif (qui la vérifie séparément, avant l'appel à GoTrue) | ✅ vécu en incident réel (12/09) — désactivée. Notre système (Turnstile + rate limiting + `login_attempts`) couvre déjà ce besoin, en plus tolérant et plus visible |
| 2.7 | MFA/TOTP sur les comptes admin — seul levier qui tient même si le mot de passe fuite (phishing, réutilisation…) ; Supabase Auth le supporte nativement, gratuit | ⚠️ **reporté, à faire** — décidé avec le client : reste à trancher si obligatoire pour tous les rôles admin ou seulement `admin` |

**Recette générique** : une Edge Function (ou route serveur) qui (1) compte
les échecs récents en base via une clé qui contourne RLS, (2) refuse
*avant* même d'appeler le provider d'auth si le seuil est dépassé, (3)
authentifie réellement, (4) journalise le résultat, (5) ne renvoie jamais le
détail de la cause d'échec au client.

---

## 3. Formulaires publics — validation & anti-bot

| # | Point | Statut ici |
|---|---|---|
| 3.1 | Format email vérifié **côté serveur**, pas seulement `type="email"` HTML | ✅ (`verify-submission`) |
| 3.2 | Contrainte `CHECK` de format email **en base**, en plus du serveur applicatif (dernier filet si l'Edge Function est contournée) | ✅ (`040`, `NOT VALID` pour ne pas casser l'historique) |
| 3.3 | Blocklist de domaines email jetables (yopmail, mailinator…) sur les formulaires à fort enjeu (candidatures, dons) | ✅ |
| 3.4 | Un vrai anti-bot (Cloudflare Turnstile / hCaptcha), pas une case à cocher "je ne suis pas un robot" (ça n'arrête aucun bot) | ✅ |
| 3.5 | Le token anti-bot est à usage unique — le widget doit se réinitialiser après un échec d'envoi, sinon le visiteur reste bloqué au 2e essai | ✅ (bug trouvé, `resetSignal`) |
| 3.6 | Un formulaire à fort enjeu de conversion (don, inscription) **ne bloque jamais** un vrai visiteur à cause d'un souci technique du captcha (navigateur avec tracking prevention strict, extension, etc.) — l'anti-bot doit être consultatif par défaut, activable en strict via une variable d'env si abus constaté | ✅ (`TURNSTILE_ENFORCE`) |
| 3.7 | Contrainte d'unicité (email par event, email newsletter…) pour éviter les doublons/spam de masse | ✅ (`024`) |
| 3.9 | Rate limiting **par IP et par email, tous formulaires publics confondus** — une contrainte d'unicité (§3.7) empêche seulement le doublon exact, pas un script qui varie l'email à chaque envoi | ✅ (`042`, table `submission_log`, même principe que le verrou login §2) |
| 3.10 | Double opt-in newsletter (email de confirmation avant activation) — seule vraie façon de vérifier qu'une boîte mail existe, la regex ne le peut pas | ⚠️ **reporté, à faire** — colonne `is_active` déjà prête sur `newsletter_subscribers` |
| 3.8 | Limite de capacité appliquée **en base** avec verrou anti race-condition (`SELECT ... FOR UPDATE`), pas seulement affichée côté UI | ✅ (`039`, trigger `event_capacity`) |

**Piège classique (§3.5)** : un token Turnstile/reCAPTCHA consommé une fois
(succès OU échec de la vérification serveur) doit déclencher
`turnstile.reset(widgetId)` avant le prochain essai, sinon Cloudflare renvoie
`timeout-or-duplicate` indéfiniment.

---

## 4. Secrets & variables d'environnement

| # | Point | Statut ici |
|---|---|---|
| 4.1 | `.env` dans `.gitignore`, jamais commité | ✅ |
| 4.2 | `.env.example` présent et à jour, avec un commentaire par variable expliquant si elle est publique ou secrète | ✅ |
| 4.3 | Toute variable préfixée `VITE_`/`NEXT_PUBLIC_` est **assumée publique** — jamais une clé qui donne des droits d'écriture élevés | ✅ |
| 4.4 | Les secrets serveur (Edge Functions) vivent dans les secrets de la plateforme (`supabase secrets set`), jamais dans le code ni dans une variable `VITE_` | ✅ |
| 4.5 | Une clé collée en clair dans une conversation/un ticket est considérée comme grillée — la régénérer dès que possible | ⚠️ pratique à appliquer systématiquement |

---

## 5. Edge Functions / API

| # | Point | Statut ici |
|---|---|---|
| 5.1 | Toute fonction qui déclenche une action sensible (envoi d'email en masse, écriture admin) vérifie l'identité ET le rôle de l'appelant côté serveur, pas seulement côté UI | ✅ (`verifyAdminRequest`, `_shared/`) |
| 5.2 | CORS : `Access-Control-Allow-Origin` large (`*`) acceptable seulement si la fonction ne fait rien de sensible sans vérification interne (elle ne doit pas faire confiance à l'origine de la requête) | ✅ pattern du projet |
| 5.3 | Erreurs renvoyées au client : génériques, sans stack trace ni détail de schéma DB | ✅ sur les fonctions d'auth ; ⚠️ à vérifier au cas par cas sur les autres |
| 5.4 | Logging serveur (`console.log`) suffisant pour diagnostiquer sans avoir à redéployer à chaque fois qu'on cherche un bug | ✅ (`verify-submission`, `admin-login`) |
| 5.5 | **Auditer TOUTES les Edge Functions une par une**, pas seulement celles qu'on vient d'écrire — une fonction créée il y a des mois sans `verifyAdminRequest` reste appelable par n'importe qui avec la clé anon, indéfiniment | ✅ audit complet fait (12/09) : 4 fonctions d'envoi d'email (`send-event-confirmation`, `send-event-certificate`, `send-submission-ack`, `notify-new-submission`) n'avaient AUCUNE protection — relais de spam/phishing potentiel (email + pièce jointe arbitraire vers n'importe quelle adresse via notre compte Brevo/Gmail). Corrigé avec un rate limit par IP (`_shared/rateLimit.ts`, réutilise la table `submission_log` de la migration 042) — ces fonctions doivent rester appelables par un visiteur non connecté (déclenchées juste après une action publique), donc pas de `verifyAdminRequest` possible, seulement un plafond de fréquence |

---

## 6. Frontend — exposition d'information

| # | Point | Statut ici |
|---|---|---|
| 6.1 | Pas de source maps en production (`build.sourcemap` désactivé/absent) | ✅ (défaut Vite) |
| 6.2 | Aucun `console.log`/`console.error` n'affiche de mot de passe, token, ou payload complet en prod | ✅ (nettoyé dans `useCrud`) |
| 6.3 | Les messages d'erreur affichés à l'utilisateur ne révèlent pas la structure interne (noms de colonnes, contraintes SQL brutes) | ✅ sur les formulaires publics traités |
| 6.4 | Pas de CSP mal configurée qui bloquerait des scripts tiers légitimes (Turnstile, etc.) — ou au minimum, vérifier qu'aucune CSP maison ne traîne | ✅ (aucune CSP sur ce projet, donc rien à casser) |

---

## 7. Stockage de fichiers (Supabase Storage / S3-like)

| # | Point | Statut ici |
|---|---|---|
| 7.1 | Policies de bucket cohérentes avec les policies de table (pas de bucket "public en écriture" pour des documents sensibles) | ✅ (`030`, `cv-uploads`) |
| 7.2 | Purge périodique des fichiers orphelins (référencés nulle part en base) | outillage prêt (`scripts/purge-storage.mjs`), non automatisé |
| 7.3 | `DELETE FROM storage.objects` en SQL brut est bloqué par Supabase (`storage.protect_delete`) — utiliser l'API Storage (SDK ou script), jamais le SQL Editor pour supprimer des fichiers | ✅ documenté |

---

## 8. En-têtes HTTP de sécurité

| # | Point | Statut ici |
|---|---|---|
| 8.1 | `Content-Security-Policy` présente, avec un allowlist explicite (pas de `unsafe-eval`, `unsafe-inline` seulement sur `style-src` si des libs l'exigent) | ✅ (`vercel.json`) |
| 8.2 | `X-Frame-Options: SAMEORIGIN` (ou `DENY`) — anti clickjacking | ✅ |
| 8.3 | `X-Content-Type-Options: nosniff` — anti MIME-sniffing | ✅ |
| 8.4 | `Referrer-Policy: strict-origin-when-cross-origin` — évite de fuiter l'URL complète (avec tokens en query string) vers des sites tiers | ✅ |
| 8.5 | `Permissions-Policy` restreint les API navigateur non utilisées (caméra/micro/géoloc/paiement), autorise explicitement celles dont le site a besoin (`camera=(self)` si scan QR) | ✅ |
| 8.6 | `Strict-Transport-Security` (HSTS) — généralement déjà géré par l'hébergeur (Vercel l'ajoute par défaut) | ➖ déjà fourni par Vercel |

**Recette générique (site statique/SPA sur Vercel, pas de serveur Node)** :
ajouter un bloc `headers` dans `vercel.json` (routes `/(.*)`) — c'est la seule
option sans backend pour injecter des en-têtes sur toutes les réponses.

**Construire la CSP sans rien casser** : avant d'écrire la moindre valeur,
lister *tous* les domaines externes réellement appelés par le front :
```bash
grep -rhoE "https?://[a-zA-Z0-9.-]+" src index.html | sort -u
```
Puis classer chacun par directive selon comment il est utilisé dans le code
(`<script src>` → `script-src`, `fetch()/WebSocket` → `connect-src`,
`<img>` → `img-src`, `<iframe>` → `frame-src`, feuille de style →
`style-src`/`font-src`). Un lien `<a href="https://...">` simple (réseaux
sociaux, wa.me, mailto) n'a besoin d'aucune directive — CSP ne bloque pas la
navigation, seulement les sous-ressources chargées automatiquement.
Exclure les domaines qui n'apparaissent que côté Edge Functions/serveur
(Deno, APIs tierces appelées depuis le backend) : la CSP du site ne les
concerne pas, seul ce qui tourne **dans le navigateur** compte.

Toujours re-tester après déploiement les flux qui touchent une ressource
externe (widget anti-bot, lecteurs vidéo embarqués, scan QR caméra,
génération de PDF/QR avec fallback API) — une CSP trop stricte casse
silencieusement ces features sans erreur visible pour l'utilisateur final,
seulement dans la console.

---

## 9. Process d'audit récurrent

Réutiliser **`database/AUDIT.sql`** (read-only, sans danger) sur n'importe
quel projet Supabase :

1. Bloc 1-2 : inventaire des tables + RLS active/inactive → repère les
   tables sans protection.
2. Bloc 5 : colonnes 100 % NULL → schéma archaïque à nettoyer.
3. Bloc 7-8 : FK sans index / index jamais utilisés → perf.
4. Bloc 12-13 : policies RLS + tables verrouillées sans policy.
5. Bloc 14/18/19 : poids storage + fichiers orphelins.
6. Bloc 17 : taille de la base vs quota du plan.

Fréquence recommandée : à chaque changement de schéma notable, et une fois
avant/après un pic de trafic attendu (lancement, événement).

---

## Changelog de ce document

- **2026-09-11** — création initiale, à partir de l'audit complet du site
  ONG DDB (RLS, egress, anti brute-force, Turnstile, validation email,
  capacité événements, purge storage).
- **2026-09-11** — ajout §8 En-têtes HTTP de sécurité, suite à un audit
  externe (Hexaro) pointant CSP/X-Frame-Options/X-Content-Type-Options/
  Referrer-Policy/Permissions-Policy absents. Corrigé via `vercel.json`.
- **2026-09-12** — ajout §2.8/2.9 : comptes suspects trouvés dans
  Authentication → Users (créés via l'endpoint public `signUp()`, jamais
  passés par une page du site). Remplacé par une Edge Function
  `admin-create-user` (service role + `verifyAdminRequest`) ; à
  désactiver côté Supabase : "Allow new users to sign up".
- **2026-09-11** — ajout §1.6 : renommage `/admin` → `/espace-ddb`,
  `/admin/login` → `/espace-ddb/connexion` (réduit le bruit des scanners
  automatisés — pas une protection à elle seule). Corrigé le flash du
  dashboard admin visible avant la redirection vers le login (garde
  `authChecked` avant de rendre l'`<Outlet/>`).
