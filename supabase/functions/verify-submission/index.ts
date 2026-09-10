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

async function verifyTurnstile(token: string): Promise<{ ok: boolean; codes?: string[] }> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) return { ok: true }           // pas configuré -> on n'exige pas le token
  if (!token) return { ok: false, codes: ['missing-input-response'] }

  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  // NB: pas de remoteip (optionnel, source d'échecs côté Deno/Supabase)

  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form,
    })
    const data = await r.json()
    console.log('siteverify:', JSON.stringify(data))
    return { ok: data.success === true, codes: data['error-codes'] }
  } catch (e) {
    console.error('siteverify fetch failed:', e)
    return { ok: false, codes: ['fetch-failed'] }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const { token, email } = await req.json().catch(() => ({}))

    // 1. Anti-bot
    const ts = await verifyTurnstile(token ?? '')
    if (!ts.ok) return json({ ok: false, reason: 'captcha', codes: ts.codes })

    // 2. Format email
    const e = String(email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(e)) return json({ ok: false, reason: 'email_format' })

    // 3. Domaine jetable
    const domain = e.split('@')[1]
    if (DISPOSABLE.has(domain)) return json({ ok: false, reason: 'email_disposable' })

    return json({ ok: true })
  } catch (err: any) {
    return json({ ok: false, reason: 'server_error', detail: err?.message }, 200)
  }
})
