// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Domaines jetables les plus courants (liste courte, volontairement).
const DISPOSABLE = new Set([
  'yopmail.com', 'mailinator.com', 'guerrillamail.com', 'guerrillamail.info',
  'sharklasers.com', 'grr.la', 'trashmail.com', 'trashmail.net', '10minutemail.com',
  'temp-mail.org', 'tempmail.com', 'tempmailo.com', 'getnada.com', 'nada.email',
  'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'mohmal.com', 'moakt.com',
  'throwawaymail.com', 'mailnesia.com', 'emailondeck.com', 'spam4.me', 'tmpmail.org',
  'discard.email', 'mailcatch.com', 'inboxbear.com', 'tempr.email', 'burnermail.io',
  'jetable.org', 'wegwerfmail.de', 'byom.de',
])

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Rate limiting : fenêtre glissante, tous formulaires confondus.
const WINDOW_MINUTES = 10
const MAX_PER_IP = 8
const MAX_PER_EMAIL = 3

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function checkTurnstile(token: string): Promise<{ pass: boolean; codes?: string[] }> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) return { pass: true, codes: ['no-secret'] }
  if (!token) return { pass: false, codes: ['missing-input-response'] }

  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)

  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form,
    })
    const data = await r.json()
    console.log('siteverify:', JSON.stringify(data))
    return { pass: data.success === true, codes: data['error-codes'] }
  } catch (e) {
    console.error('siteverify fetch failed:', e)
    return { pass: false, codes: ['fetch-failed'] }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  try {
    const { token, email, kind } = await req.json().catch(() => ({}))
    const e = String(email ?? '').trim().toLowerCase()
    const submissionKind = String(kind ?? 'unknown').slice(0, 40)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip') || null

    // ── 1. Rate limiting — AVANT tout le reste, tous formulaires confondus ──
    if (SUPABASE_URL && SERVICE_KEY) {
      const svcHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' }
      const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()

      const [ipHits, emailHits] = await Promise.all([
        ip
          ? fetch(`${SUPABASE_URL}/rest/v1/submission_log?ip=eq.${encodeURIComponent(ip)}&created_at=gte.${since}&select=created_at&order=created_at.desc&limit=${MAX_PER_IP}`,
            { headers: svcHeaders }).then(r => r.json()).catch(() => [])
          : Promise.resolve([]),
        e
          ? fetch(`${SUPABASE_URL}/rest/v1/submission_log?email=eq.${encodeURIComponent(e)}&created_at=gte.${since}&select=created_at&order=created_at.desc&limit=${MAX_PER_EMAIL}`,
            { headers: svcHeaders }).then(r => r.json()).catch(() => [])
          : Promise.resolve([]),
      ])

      const limited = (Array.isArray(ipHits) && ipHits.length >= MAX_PER_IP)
        || (Array.isArray(emailHits) && emailHits.length >= MAX_PER_EMAIL)

      // On journalise TOUJOURS la tentative (même bloquée), best-effort.
      fetch(`${SUPABASE_URL}/rest/v1/submission_log`, {
        method: 'POST', headers: { ...svcHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify([{ kind: submissionKind, email: e || null, ip }]),
      }).catch(() => {})

      if (limited) {
        const hits = (ipHits.length >= MAX_PER_IP ? ipHits : emailHits)
        const oldest = new Date(hits[hits.length - 1].created_at).getTime()
        const retryAfterSeconds = Math.max(0, Math.ceil((oldest + WINDOW_MINUTES * 60_000 - Date.now()) / 1000))
        console.log(`rate limited: kind=${submissionKind} ip=${ip} email=${e}`)
        return json({ ok: false, reason: 'rate_limited', retryAfterSeconds })
      }
    }

    // ── 2. Email : format + domaine jetable (toujours bloquant) ──
    if (!EMAIL_RE.test(e)) return json({ ok: false, reason: 'email_format' })
    if (DISPOSABLE.has(e.split('@')[1])) return json({ ok: false, reason: 'email_disposable' })

    // ── 3. Turnstile ──
    // Mode strict seulement si TURNSTILE_ENFORCE=true. Sinon on
    // journalise le résultat mais on ne bloque pas le visiteur
    // (un widget cassé par un navigateur strict ne doit pas
    // empêcher une vraie inscription) — le rate limiting ci-dessus
    // est le vrai frein contre l'abus en masse.
    const ts = await checkTurnstile(token ?? '')
    const enforce = (Deno.env.get('TURNSTILE_ENFORCE') ?? '').toLowerCase() === 'true'
    if (!ts.pass) {
      console.log(`turnstile fail (enforce=${enforce}) codes=${JSON.stringify(ts.codes)}`)
      if (enforce) return json({ ok: false, reason: 'captcha', codes: ts.codes })
    }

    return json({ ok: true, turnstile: ts.pass })
  } catch (err: any) {
    console.error('verify-submission error:', err?.message)
    // En cas d'erreur interne, on ne bloque pas non plus.
    return json({ ok: true, turnstile: false, softError: err?.message })
  }
})
