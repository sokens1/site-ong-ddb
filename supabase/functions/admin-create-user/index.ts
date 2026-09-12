// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { verifyAdminRequest } from "../_shared/verifyAdmin.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_ROLES = ['admin', 'charge_communication', 'chef_projet', 'partenaire', 'membre']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Seul un admin peut créer des comptes staff. Remplace l'ancien
  // supabase.auth.signUp() public : n'importe qui pouvait créer un
  // compte directement via l'API REST avec juste la clé anon, sans
  // jamais passer par cette page ni être connecté.
  const denied = await verifyAdminRequest(req, ['admin'], corsHeaders, 'admin-create-user')
  if (denied) return denied

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'server_error' }, 500)

  try {
    const { email, password, full_name, role } = await req.json().catch(() => ({}))

    if (!email || !password || !role) {
      return json({ error: 'missing_fields' }, 400)
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return json({ error: 'invalid_role' }, 400)
    }
    if (String(password).length < 8) {
      return json({ error: 'weak_password' }, 400)
    }

    const svcHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' }

    // Création via l'API Admin (service role) — fonctionne même quand
    // "Allow new users to sign up" est désactivé au niveau du projet.
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: svcHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true, // créé par un admin -> pas besoin de cliquer un lien de confirmation
        user_metadata: { full_name: full_name || null, role },
      }),
    })
    const created = await createRes.json().catch(() => ({}))

    if (!createRes.ok) {
      return json({ error: created?.msg || created?.message || 'create_failed' }, createRes.status)
    }

    // Profil applicatif
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: { ...svcHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify([{
        id: created.id,
        email,
        full_name: full_name || null,
        role,
        is_active: true,
      }]),
    })

    if (!profileRes.ok) {
      const detail = await profileRes.text().catch(() => '')
      console.warn('admin-create-user: profil non créé', detail)
      return json({ ok: true, id: created.id, warning: 'profile_creation_failed' })
    }

    return json({ ok: true, id: created.id })
  } catch (err: any) {
    console.error('admin-create-user error:', err?.message)
    return json({ error: 'server_error' }, 500)
  }
})
