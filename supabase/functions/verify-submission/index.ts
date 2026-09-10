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

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const { token, email } = await req.json().catch(() => ({}))

    // ── 1. Email : format + domaine jetable (toujours bloquant) ──
    const e = String(email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(e)) return json({ ok: false, reason: 'email_format' })
    if (DISPOSABLE.has(e.split('@')[1])) return json({ ok: false, reason: 'email_disposable' })

    // ── 2. Turnstile ──
    // Mode strict seulement si TURNSTILE_ENFORCE=true. Sinon on
    // journalise le résultat mais on ne bloque pas le visiteur
    // (un widget cassé par un navigateur strict ne doit pas
    // empêcher une vraie inscription).
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
