// @ts-ignore
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { checkRateLimit, getClientIp } from "../_shared/rateLimit.ts"
// @ts-ignore
import { verifyAdminRequest } from "../_shared/verifyAdmin.ts"
import { getGmailConfig, getGmailAccessToken, buildRawMessage, htmlToText, sendGmailRaw } from "../_shared/gmail.ts"

declare const Deno: any;

/**
 * Accès aux albums photos/vidéos des événements — modèle de partage Google Drive.
 *
 * Les fichiers sont dans le bucket PRIVÉ `event-albums` : cette fonction est le
 * seul chemin pour un visiteur. Elle vérifie les droits puis renvoie des URLs
 * signées (6 h). L'identité d'un visiteur est prouvée par un code à 6 chiffres
 * envoyé par email (équivalent de la connexion Google exigée par Drive), puis
 * mémorisée 30 jours via un jeton de session.
 *
 * Actions (POST { action, ... }) :
 *   open            { event, k?, token?, invite? }  → contenu de l'album ou écran "accès requis"
 *   send_code       { event, email }                → envoie le code par email
 *   verify_code     { event, email, code }          → session + contenu si autorisé
 *   request_access  { event, token, message? }      → "Demander l'accès" (notifie l'ONG)
 *   invite          { event_id, emails[], notify, message?, template? }  → ADMIN : ajoute des personnes
 *                   (template 'participants' : email "les photos sont en ligne", envoyé par lots de 20)
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUCKET = 'event-albums'
// URLs signées mémorisées 7 jours (migration 051) et partagées par tous les
// visiteurs : cache navigateur/CDN efficace. Renouvelées à 2 jours de l'échéance.
const SIGNED_URL_TTL_SEC = 7 * 86400
const SIGNED_URL_REFRESH_MS = 2 * 86400_000
const SESSION_DAYS = 30
const INVITE_DAYS = 30
const OTP_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

console.log("Edge Function 'album-access' bootstrapped.")

// ── Utilitaires ──────────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

async function sha256(text: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(bytes = 32): string {
    const a = new Uint8Array(bytes)
    crypto.getRandomValues(a)
    return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Alphabet des liens visibles : 32 caractères, sans l/o/0/1 (ambigus à l'écrit comme à l'oral). */
const KEY_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** Clé courte et lisible ; `& 31` = 5 bits aléatoires par caractère, sans biais. */
function randomKey(len: number): string {
    const bytes = new Uint8Array(len)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => KEY_ALPHABET[b & 31]).join('')
}

function randomCode(): string {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return String(a[0] % 1_000_000).padStart(6, '0')
}

/** Comparaison à temps constant (évite de deviner une clé caractère par caractère). */
function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let r = 0
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return r === 0
}

const normEmail = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : '')

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const appUrl = (req: Request) =>
    (Deno.env.get('APP_URL') || req.headers.get('origin') || '').replace(/\/+$/, '')

interface EventRow {
    id: number
    slug: string | null
    title: string
    event_date: string
    location: string | null
    image_url: string | null
    status: string
}

interface AlbumRow {
    general_access: 'restricted' | 'participants' | 'attendees' | 'link' | 'public'
    allow_download: boolean
    link_key: string
}

const EVENT_COLS = 'id, slug, title, event_date, location, image_url, status'

/** Résout un événement par slug ou id. Les brouillons ne sont jamais exposés. */
async function loadEvent(ref: unknown, includeDrafts = false): Promise<EventRow | null> {
    const s = String(ref ?? '').trim()
    if (!s || s.length > 160) return null
    const query = /^\d+$/.test(s)
        ? db.from('events').select(EVENT_COLS).eq('id', Number(s))
        : db.from('events').select(EVENT_COLS).eq('slug', s)
    const { data } = await query.maybeSingle()
    if (!data || (!includeDrafts && data.status === 'draft')) return null
    return data as EventRow
}

const publicEvent = (e: EventRow) => ({
    id: e.id, slug: e.slug, title: e.title, event_date: e.event_date, location: e.location, image_url: e.image_url,
})

async function loadAlbum(eventId: number): Promise<AlbumRow | null> {
    const { data } = await db.from('event_albums')
        .select('general_access, allow_download, link_key')
        .eq('event_id', eventId).maybeSingle()
    return (data as AlbumRow) ?? null
}

async function sessionEmail(eventId: number, token: unknown): Promise<string | null> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
    const { data } = await db.from('event_album_sessions')
        .select('email, expires_at')
        .eq('token_hash', await sha256(token)).eq('event_id', eventId).maybeSingle()
    if (!data || new Date(data.expires_at).getTime() < Date.now()) return null
    return data.email
}

async function createSession(eventId: number, email: string): Promise<string> {
    const token = randomToken()
    await db.from('event_album_sessions').insert({
        token_hash: await sha256(token),
        event_id: eventId,
        email,
        expires_at: new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString(),
    })
    return token
}

/**
 * L'appelant est-il un membre connecté de l'équipe (admin / charge_communication) ?
 * Comme le propriétaire d'un dossier Drive, il voit toujours l'album. Les
 * visiteurs envoient la clé anon (rôle "anon") : on les écarte sans requête.
 */
async function isStaff(req: Request): Promise<boolean> {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const part = token.split('.')[1]
    if (!part) return false
    try {
        const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
        const claims = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)))
        if (claims.role !== 'authenticated') return false
        const { data: { user } } = await db.auth.getUser(token)
        if (!user) return false
        const { data: profile } = await db.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
        return ['admin', 'charge_communication'].includes(profile?.role)
    } catch {
        return false
    }
}

async function hasAccess(eventId: number, album: AlbumRow, linkKey: unknown, email: string | null): Promise<boolean> {
    if (album.general_access === 'public') return true
    if (album.general_access === 'link' && typeof linkKey === 'string' && safeEqual(linkKey, album.link_key)) return true
    if (!email) return false
    const { data } = await db.rpc('album_email_has_access', { p_event_id: eventId, p_email: email })
    return data === true
}

interface MediaRow {
    id: string
    path: string
    thumb_path: string | null
    signed_url: string | null
    signed_thumb_url: string | null
    signed_until: string | null
    [key: string]: unknown
}

/**
 * Réutilise les URLs signées mémorisées ; ne re-signe que les fichiers nouveaux
 * ou dont l'URL expire bientôt (un appel Storage par tranche de 500 chemins),
 * puis mémorise le résultat en une seule requête.
 */
async function ensureSignedUrls(media: MediaRow[]): Promise<void> {
    const now = Date.now()
    const stale = media.filter((m) =>
        !m.signed_url ||
        (m.thumb_path && !m.signed_thumb_url) ||
        !m.signed_until ||
        new Date(m.signed_until).getTime() - now < SIGNED_URL_REFRESH_MS,
    )
    if (stale.length === 0) return

    const paths = stale.flatMap((m) => (m.thumb_path ? [m.path, m.thumb_path] : [m.path]))
    const signed = new Map<string, string>()
    for (let i = 0; i < paths.length; i += 500) {
        const { data } = await db.storage.from(BUCKET).createSignedUrls(paths.slice(i, i + 500), SIGNED_URL_TTL_SEC)
        for (const d of data ?? []) if (d.signedUrl && d.path) signed.set(d.path, d.signedUrl)
    }

    const until = new Date(now + SIGNED_URL_TTL_SEC * 1000).toISOString()
    const updates = []
    for (const m of stale) {
        const url = signed.get(m.path)
        if (!url) continue
        m.signed_url = url
        m.signed_thumb_url = m.thumb_path ? signed.get(m.thumb_path) ?? null : null
        m.signed_until = until
        updates.push({ id: m.id, url, thumb_url: m.signed_thumb_url, until })
    }
    if (updates.length) {
        const { error } = await db.rpc('store_event_media_signed_urls', { p_rows: updates })
        if (error) console.warn(`album-access: cache des URLs non enregistré: ${error.message}`)
    }
}

/** Contenu de l'album avec URLs signées (mémorisées 7 jours, communes à tous les visiteurs). */
async function grantedPayload(event: EventRow, album: AlbumRow, email: string | null) {
    const { data: rows } = await db.from('event_media')
        .select('id, kind, path, thumb_path, placeholder, width, height, duration, size_bytes, mime_type, caption, signed_url, signed_thumb_url, signed_until')
        .eq('event_id', event.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
    const media = (rows ?? []) as MediaRow[]
    await ensureSignedUrls(media)

    const ready = media.filter((m) => m.signed_url && m.signed_until)
    // Le client redemande l'album 1 h avant l'expiration de la première URL
    const firstExpiry = ready.reduce(
        (min, m) => Math.min(min, new Date(m.signed_until!).getTime()),
        Date.now() + SIGNED_URL_TTL_SEC * 1000,
    )

    return {
        status: ready.length ? 'granted' : 'empty',
        event: publicEvent(event),
        album: { general_access: album.general_access, allow_download: album.allow_download },
        viewer: email ? { email } : null,
        expires_at: new Date(firstExpiry - 3600_000).toISOString(),
        media: ready
            .map((m: any) => ({
                id: m.id,
                kind: m.kind,
                url: m.signed_url,
                thumb_url: m.thumb_path ? m.signed_thumb_url ?? null : null,
                placeholder: m.placeholder,
                width: m.width,
                height: m.height,
                duration: m.duration,
                size: m.size_bytes,
                mime: m.mime_type,
                caption: m.caption,
            })),
    }
}

/** Réponse commune à open / verify_code : contenu si autorisé, sinon écran "accès requis". */
async function resolve(event: EventRow, album: AlbumRow, email: string | null, linkKey: unknown) {
    if (await hasAccess(event.id, album, linkKey, email)) {
        return grantedPayload(event, album, email)
    }
    let pending = false
    if (email) {
        const { data } = await db.from('event_album_access_requests')
            .select('id').eq('event_id', event.id).eq('email', email).eq('status', 'pending').maybeSingle()
        pending = !!data
    }
    return {
        status: 'locked',
        event: publicEvent(event),
        // Un album "par lien" ouvert sans la clé se présente comme un album limité.
        access_mode: album.general_access === 'link' ? 'restricted' : album.general_access,
        viewer: email ? { email } : null,
        request_pending: pending,
    }
}

// ── Emails ───────────────────────────────────────────────────────────────────

async function sendMail(to: string, subject: string, html: string): Promise<{ sent: boolean; simulated: boolean }> {
    const cfg = getGmailConfig()
    if (cfg.simulate) {
        console.log(`[SIMULATION] album-access → ${to} : ${subject}`)
        return { sent: false, simulated: true }
    }
    const accessToken = await getGmailAccessToken(cfg)
    const raw = buildRawMessage({
        from: cfg.senderEmail, fromName: cfg.senderName,
        to, subject, html, text: htmlToText(html),
    })
    const res = await sendGmailRaw(accessToken, raw)
    if (!res.ok) console.error(`album-access: échec d'envoi à ${to}: ${res.error}`)
    return { sent: res.ok, simulated: false }
}

const emailLayout = (inner: string) => `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:20px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 24px;border-radius:14px;background-color:#f9fafb;border:1px solid #e5e7eb;">
    ${inner}
    <hr style="margin:24px 0 16px;border:none;border-top:1px solid #e5e7eb;">
    <p style="font-size:12px;color:#6b7280;margin:0;text-align:center;">ONG Développement Durable et Bien-Être — Gabon 🌱</p>
  </div>
</body>
</html>`

const buttonHtml = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;padding:12px 26px;border-radius:10px;background-color:#16a34a;color:#ffffff;font-weight:bold;font-size:15px;text-decoration:none;">${label}</a>`

// ── Actions ──────────────────────────────────────────────────────────────────

async function handleOpen(body: any, req: Request) {
    // Lectures indépendantes en parallèle : la latence est celle de la plus lente, pas la somme
    const [staff, found] = await Promise.all([isStaff(req), loadEvent(body.event, true)])
    const event = found && (found.status !== 'draft' || staff) ? found : null
    if (!event) return json({ status: 'not_found' })
    const [album, sessionMail] = await Promise.all([loadAlbum(event.id), sessionEmail(event.id, body.token)])
    if (!album) return json({ status: 'not_found', event: publicEvent(event) })
    if (staff) return json(await grantedPayload(event, album, null))

    let email = sessionMail
    const tokenInvalid = !!body.token && !email
    let newToken: string | undefined

    // Lien personnel reçu par email ("Envoyer une notification" côté admin)
    if (!email && typeof body.invite === 'string' && body.invite.length >= 16 && body.invite.length <= 100) {
        const { data: share } = await db.from('event_album_shares')
            .select('email, invite_expires_at')
            .eq('event_id', event.id).eq('invite_token_hash', await sha256(body.invite)).maybeSingle()
        if (share && (!share.invite_expires_at || new Date(share.invite_expires_at).getTime() > Date.now())) {
            email = share.email
            newToken = await createSession(event.id, share.email)
        }
    }

    const payload = await resolve(event, album, email, body.k)
    return json({ ...payload, token: newToken, token_invalid: tokenInvalid && !newToken })
}

async function handleSendCode(body: any, req: Request) {
    if (!(await checkRateLimit('album-code', getClientIp(req), 5, 15))) {
        return json({ error: 'rate_limited' }, 429)
    }
    const email = normEmail(body.email)
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'invalid_email' }, 400)
    const event = await loadEvent(body.event)
    if (!event || !(await loadAlbum(event.id))) return json({ error: 'not_found' }, 404)

    // Max 3 codes / 15 min pour une même adresse (anti-bombardement d'emails)
    const since = new Date(Date.now() - 15 * 60_000).toISOString()
    const { count } = await db.from('event_album_otps')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id).eq('email', email).gte('created_at', since)
    if ((count ?? 0) >= 3) return json({ error: 'rate_limited' }, 429)

    const code = randomCode()
    await db.from('event_album_otps').insert({
        event_id: event.id,
        email,
        code_hash: await sha256(`${event.id}:${email}:${code}`),
        expires_at: new Date(Date.now() + OTP_MINUTES * 60_000).toISOString(),
    })

    const title = escapeHtml(event.title)
    const result = await sendMail(email, `${code} — votre code d'accès à l'album « ${event.title} »`, emailLayout(`
    <p style="font-size:16px;color:#1f2937;line-height:1.6;margin:0 0 18px;">
      Bonjour 👋,<br><br>
      Voici votre code pour accéder à l'album photos &amp; vidéos de <strong>${title}</strong> :
    </p>
    <p style="font-size:34px;letter-spacing:10px;font-weight:800;color:#14532d;text-align:center;margin:8px 0 18px;font-family:'Courier New',monospace;">${code}</p>
    <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0;">
      Ce code expire dans ${OTP_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
    </p>`))

    // Ménage des codes/sessions expirés, sans bloquer la réponse
    db.rpc('cleanup_album_auth').then(() => {}, () => {})

    return json({ ok: true, simulated: result.simulated })
}

async function handleVerifyCode(body: any, req: Request) {
    if (!(await checkRateLimit('album-verify', getClientIp(req), 20, 15))) {
        return json({ error: 'rate_limited' }, 429)
    }
    const email = normEmail(body.email)
    const code = String(body.code ?? '').replace(/\D/g, '')
    if (!EMAIL_RE.test(email) || code.length !== 6) return json({ error: 'invalid_code' }, 400)
    const event = await loadEvent(body.event)
    const album = event ? await loadAlbum(event.id) : null
    if (!event || !album) return json({ error: 'not_found' }, 404)

    const { data: otp } = await db.from('event_album_otps')
        .select('id, code_hash, attempts, expires_at')
        .eq('event_id', event.id).eq('email', email).is('consumed_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (!otp || new Date(otp.expires_at).getTime() < Date.now()) return json({ error: 'code_expired' }, 400)
    if (otp.attempts >= OTP_MAX_ATTEMPTS) return json({ error: 'too_many_attempts' }, 429)

    if (!safeEqual(await sha256(`${event.id}:${email}:${code}`), otp.code_hash)) {
        await db.from('event_album_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id)
        return json({ error: 'invalid_code', remaining: Math.max(0, OTP_MAX_ATTEMPTS - otp.attempts - 1) }, 400)
    }

    await db.from('event_album_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id)
    const token = await createSession(event.id, email)
    const payload = await resolve(event, album, email, body.k)
    return json({ ...payload, token })
}

async function handleRequestAccess(body: any, req: Request) {
    if (!(await checkRateLimit('album-request', getClientIp(req), 5, 60))) {
        return json({ error: 'rate_limited' }, 429)
    }
    const event = await loadEvent(body.event)
    if (!event || !(await loadAlbum(event.id))) return json({ error: 'not_found' }, 404)
    const email = await sessionEmail(event.id, body.token)
    if (!email) return json({ error: 'identity_required' }, 401)

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : ''
    const { error } = await db.from('event_album_access_requests').insert({
        event_id: event.id, email, message: message || null,
    })
    // 23505 = une demande est déjà en attente pour cet email : rien à faire
    if (error && error.code !== '23505') throw new Error(error.message)

    if (!error) {
        const cfg = getGmailConfig()
        if (cfg.senderEmail) {
            const adminLink = `${appUrl(req)}/espace-ddb/events/edit/${event.id}?tab=album`
            await sendMail(cfg.senderEmail, `Demande d'accès à l'album « ${event.title} »`, emailLayout(`
    <p style="font-size:16px;color:#1f2937;line-height:1.6;margin:0 0 16px;">
      <strong>${escapeHtml(email)}</strong> demande l'accès à l'album photos &amp; vidéos de <strong>${escapeHtml(event.title)}</strong>.
    </p>
    ${message ? `<blockquote style="margin:0 0 18px;padding:12px 16px;background:#ffffff;border-left:4px solid #16a34a;border-radius:6px;color:#374151;font-size:14px;line-height:1.5;">${escapeHtml(message)}</blockquote>` : ''}
    <p style="text-align:center;margin:22px 0 4px;">${buttonHtml(adminLink, 'Gérer l\'accès')}</p>`))
        }
    }
    return json({ ok: true })
}

async function handleInvite(body: any, req: Request) {
    const authError = await verifyAdminRequest(req, ['admin', 'charge_communication'], corsHeaders, 'album-access:invite')
    if (authError) return authError

    const event = await loadEvent(body.event_id, true)
    if (!event) return json({ error: 'not_found' }, 404)

    const emails: string[] = Array.from(new Set(
        (Array.isArray(body.emails) ? body.emails : []).map(normEmail).filter((e: string) => EMAIL_RE.test(e) && e.length <= 254),
    )).slice(0, 50) as string[]
    if (emails.length === 0) return json({ error: 'invalid_email' }, 400)

    await db.from('event_albums').upsert({ event_id: event.id }, { onConflict: 'event_id', ignoreDuplicates: true })

    const notify = body.notify !== false
    const forParticipants = body.template === 'participants'
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : ''
    const base = appUrl(req)
    const albumPath = `/album/${encodeURIComponent(event.slug || String(event.id))}`
    let notified = 0
    let simulated = false
    const failed: string[] = []

    if (!notify) {
        const { error } = await db.from('event_album_shares').upsert(
            emails.map((email) => ({ event_id: event.id, email })),
            { onConflict: 'event_id,email', ignoreDuplicates: true },
        )
        if (error) throw new Error(error.message)
    } else {
        // Tous les accès du lot enregistrés en une seule requête, puis envoi des emails
        const now = new Date().toISOString()
        const expires = new Date(Date.now() + INVITE_DAYS * 86400_000).toISOString()
        // 20 caractères = 100 bits : lien court mais impossible à deviner
        const invites = emails.map((email) => ({ email, token: randomKey(20) }))
        const rows = await Promise.all(invites.map(async ({ email, token }) => ({
            event_id: event.id,
            email,
            invite_token_hash: await sha256(token),
            invite_expires_at: expires,
            notified_at: now,
        })))
        const { error } = await db.from('event_album_shares').upsert(rows, { onConflict: 'event_id,email' })
        if (error) throw new Error(error.message)

        // Séquentiel : l'API Gmail limite à ~2 envois/seconde par compte
        for (const { email, token } of invites) {
            const link = `${base}${albumPath}?invitation=${token}`
            const { subject, html } = inviteEmail(event, link, message, forParticipants)
            try {
                const res = await sendMail(email, subject, html)
                if (res.sent) notified++
                else if (!res.simulated) failed.push(email)
                if (res.simulated) simulated = true
            } catch (err: any) {
                console.error(`album-access: envoi à ${email} impossible: ${err?.message || err}`)
                failed.push(email)
            }
        }

        // Les échecs ne comptent pas comme "notifiés" : ils seront proposés au prochain envoi
        if (failed.length) {
            await db.from('event_album_shares').update({ notified_at: null })
                .eq('event_id', event.id).in('email', failed)
        }
    }

    // "Demander l'accès" : les demandes en attente de ces personnes sont acceptées
    await db.from('event_album_access_requests')
        .update({ status: 'approved', decided_at: new Date().toISOString() })
        .eq('event_id', event.id).eq('status', 'pending').in('email', emails)

    return json({ ok: true, added: emails.length, notified, failed, simulated })
}

const quoteHtml = (message: string) => message
    ? `<blockquote style="margin:0 0 18px;padding:12px 16px;background:#ffffff;border-left:4px solid #16a34a;border-radius:6px;color:#374151;font-size:14px;line-height:1.5;">${escapeHtml(message).replace(/\n/g, '<br>')}</blockquote>`
    : ''

/** Email d'invitation : partage individuel, ou envoi groupé aux participants de l'événement. */
function inviteEmail(event: EventRow, link: string, message: string, forParticipants: boolean) {
    const title = escapeHtml(event.title)
    const footer = `
    <p style="font-size:12px;color:#6b7280;line-height:1.5;margin:0;">
      Ce lien est personnel : ne le transférez pas. Il est valable ${INVITE_DAYS} jours ; ensuite, ouvrez l'album depuis la page de l'événement et confirmez votre adresse email.
    </p>`

    if (forParticipants) {
        return {
            subject: `📸 Les photos de « ${event.title} » sont en ligne`,
            html: emailLayout(`
    <p style="font-size:16px;color:#1f2937;line-height:1.6;margin:0 0 16px;">
      Bonjour 👋,<br><br>
      Merci d'avoir participé à <strong>${title}</strong> ! L'album photos &amp; vidéos de l'événement est disponible :
      revivez les meilleurs moments et téléchargez vos photos.
    </p>
    ${quoteHtml(message)}
    <p style="text-align:center;margin:22px 0;">${buttonHtml(link, 'Voir les photos')}</p>
    ${footer}`),
        }
    }

    return {
        subject: `ONG DDB a partagé un album avec vous : « ${event.title} »`,
        html: emailLayout(`
    <p style="font-size:16px;color:#1f2937;line-height:1.6;margin:0 0 16px;">
      Bonjour 👋,<br><br>
      L'ONG DDB vous a donné accès à l'album photos &amp; vidéos de <strong>${title}</strong>.
    </p>
    ${quoteHtml(message)}
    <p style="text-align:center;margin:22px 0;">${buttonHtml(link, 'Ouvrir l\'album')}</p>
    ${footer}`),
    }
}

// ── Routeur ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

    try {
        const body = await req.json().catch(() => ({}))
        switch (body?.action) {
            case 'open': return await handleOpen(body, req)
            case 'send_code': return await handleSendCode(body, req)
            case 'verify_code': return await handleVerifyCode(body, req)
            case 'request_access': return await handleRequestAccess(body, req)
            case 'invite': return await handleInvite(body, req)
            default: return json({ error: 'unknown_action' }, 400)
        }
    } catch (error: any) {
        console.error(`album-access error: ${error?.message || error}`)
        return json({ error: 'server_error' }, 500)
    }
})
