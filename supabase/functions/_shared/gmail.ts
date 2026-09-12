declare const Deno: any;

/**
 * Envoi d'email via l'API Gmail (OAuth2) — canal unique pour tout le
 * projet, Brevo retiré. Factorisé à partir de send-event-email /
 * send-event-certificate (dupliqué à l'identique dans les deux avant).
 *
 * Variables d'environnement requises (Supabase secrets) :
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, SMTP_USER
 *   EMAIL_FROM_NAME (optionnel, "ONG DDB" par défaut)
 * Si l'une manque, getGmailConfig().simulate = true : les fonctions
 * appelantes doivent alors simuler l'envoi (succès sans email réel).
 */

export interface GmailConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  senderEmail: string
  senderName: string
  simulate: boolean
}

export function getGmailConfig(): GmailConfig {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET') ?? ''
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN') ?? ''
  const senderEmail = Deno.env.get('SMTP_USER') ?? ''
  const senderName = Deno.env.get('EMAIL_FROM_NAME') || 'ONG DDB'
  return {
    clientId, clientSecret, refreshToken, senderEmail, senderName,
    simulate: !clientId || !clientSecret || !refreshToken || !senderEmail,
  }
}

export async function getGmailAccessToken(cfg: GmailConfig): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Échec du rafraîchissement du token Gmail: ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

export function base64url(input: string): string {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
}

/** Version texte brut à partir du HTML (multipart/alternative anti-spam). */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Message simple (1 destinataire direct en "To", ou plusieurs en BCC —
 * masqués les uns aux autres, cas des envois groupés). Toujours en
 * multipart/alternative (texte + HTML), signal de légitimité anti-spam.
 */
export function buildRawMessage(opts: {
  from: string; fromName: string
  to?: string; toName?: string
  bcc?: string[]
  subject: string; html: string; text: string
}): string {
  const boundary = `bnd_${crypto.randomUUID().replace(/-/g, '')}`
  const headerLines = [
    `From: ${opts.fromName} <${opts.from}>`,
    opts.to
      ? `To: ${opts.toName ? `${opts.toName} <${opts.to}>` : opts.to}`
      : `To: ${opts.from}`, // envoi groupé : "To" = soi-même, vrais destinataires en Bcc
    ...(opts.bcc && opts.bcc.length ? [`Bcc: ${opts.bcc.join(', ')}`] : []),
    `Subject: ${encodeSubject(opts.subject)}`,
    'MIME-Version: 1.0',
    ...(opts.bcc ? [
      `List-Unsubscribe: <mailto:${opts.from}?subject=unsubscribe>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    ] : []),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.html,
    '',
    `--${boundary}--`,
  ].join('\r\n')

  return base64url(`${headerLines.join('\r\n')}\r\n\r\n${body}`)
}

/** Message avec pièce jointe (billet/certificat PDF), 1 destinataire direct. */
export function buildRawMessageWithAttachment(opts: {
  from: string; fromName: string; to: string; toName: string
  subject: string; html: string; text: string
  attachmentBase64: string; attachmentName: string
}): string {
  const mixedBoundary = `mix_${crypto.randomUUID().replace(/-/g, '')}`
  const altBoundary = `alt_${crypto.randomUUID().replace(/-/g, '')}`

  const headers = [
    `From: ${opts.fromName} <${opts.from}>`,
    `To: ${opts.toName} <${opts.to}>`,
    `Subject: ${encodeSubject(opts.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ].join('\r\n')

  const chunkedAttachment = (opts.attachmentBase64.match(/.{1,76}/g) || []).join('\r\n')

  const body = [
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.text,
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.html,
    '',
    `--${altBoundary}--`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: application/pdf; name="${opts.attachmentName}"`,
    `Content-Disposition: attachment; filename="${opts.attachmentName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    chunkedAttachment,
    '',
    `--${mixedBoundary}--`,
  ].join('\r\n')

  return base64url(`${headers}\r\n\r\n${body}`)
}

/** Envoie un message brut (base64url) déjà construit. */
export async function sendGmailRaw(accessToken: string, raw: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) return { ok: false, error: await res.text() }
  const data = await res.json()
  return { ok: true, id: data.id }
}
