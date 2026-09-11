// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Fenêtre + seuils du verrouillage.
const WINDOW_MINUTES = 15
const MAX_FAIL_PER_EMAIL = 5
const MAX_FAIL_PER_IP = 20

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function checkTurnstile(token: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret || !token) return true // consultatif, cf. verify-submission
  try {
    const form = new URLSearchParams({ secret, response: token })
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    const data = await r.json()
    return data.success === true
  } catch {
    return true
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ ok: false, reason: 'server_error' }, 500)
  }

  try {
    const { email, password, token } = await req.json().catch(() => ({}))
    if (!email || !password) return json({ ok: false, reason: 'missing_fields' }, 400)

    const cleanEmail = String(email).trim().toLowerCase()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip') || null

    const svcHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' }
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()

    // ── 1. Verrou déjà actif ? (compte les échecs récents, AVANT de tenter l'auth) ──
    const [emailFails, ipFails] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/login_attempts?email=eq.${encodeURIComponent(cleanEmail)}&success=eq.false&created_at=gte.${since}&select=created_at&order=created_at.desc&limit=${MAX_FAIL_PER_EMAIL}`,
        { headers: svcHeaders }).then(r => r.json()).catch(() => []),
      ip
        ? fetch(`${SUPABASE_URL}/rest/v1/login_attempts?ip=eq.${encodeURIComponent(ip)}&success=eq.false&created_at=gte.${since}&select=created_at&order=created_at.desc&limit=${MAX_FAIL_PER_IP}`,
          { headers: svcHeaders }).then(r => r.json()).catch(() => [])
        : Promise.resolve([]),
    ])

    if (Array.isArray(emailFails) && emailFails.length >= MAX_FAIL_PER_EMAIL) {
      const oldest = new Date(emailFails[emailFails.length - 1].created_at).getTime()
      const retryAfterSeconds = Math.max(0, Math.ceil((oldest + WINDOW_MINUTES * 60_000 - Date.now()) / 1000))
      return json({ ok: false, reason: 'locked', retryAfterSeconds })
    }
    if (Array.isArray(ipFails) && ipFails.length >= MAX_FAIL_PER_IP) {
      const oldest = new Date(ipFails[ipFails.length - 1].created_at).getTime()
      const retryAfterSeconds = Math.max(0, Math.ceil((oldest + WINDOW_MINUTES * 60_000 - Date.now()) / 1000))
      return json({ ok: false, reason: 'locked', retryAfterSeconds })
    }

    // Turnstile : consultatif, ne bloque pas la connexion d'un admin légitime
    // gêné par son navigateur — le vrai frein au brute-force est le verrou ci-dessus.
    const human = await checkTurnstile(token ?? '')
    if (!human) console.log(`admin-login: turnstile échoué pour ${cleanEmail} (ip=${ip})`)

    // ── 2. Tentative d'authentification réelle (GoTrue) ──
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    })
    const authData = await authRes.json().catch(() => ({}))
    const success = authRes.ok && !!authData.access_token

    // ── 3. Journalisation (best-effort, ne doit jamais faire échouer la réponse) ──
    fetch(`${SUPABASE_URL}/rest/v1/login_attempts`, {
      method: 'POST', headers: { ...svcHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify([{ email: cleanEmail, ip, success }]),
    }).catch(() => {})

    if (!success) {
      const failCountNow = (Array.isArray(emailFails) ? emailFails.length : 0) + 1
      if (failCountNow >= MAX_FAIL_PER_EMAIL) {
        fetch(`${SUPABASE_URL}/rest/v1/security_events`, {
          method: 'POST', headers: { ...svcHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify([{
            category: 'suspicious_access', severity: 'critical', action: 'login_lockout',
            actor_email: cleanEmail, target: 'admin-login',
            details: { ip, failCountNow }, ip_address: ip,
          }]),
        }).catch(() => {})
      }
      // Message générique : ne révèle jamais si l'email existe ou non.
      return json({ ok: false, reason: 'invalid_credentials' })
    }

    return json({ ok: true, access_token: authData.access_token, refresh_token: authData.refresh_token })
  } catch (err: any) {
    console.error('admin-login error:', err?.message)
    return json({ ok: false, reason: 'server_error' }, 500)
  }
})
