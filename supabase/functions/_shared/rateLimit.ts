declare const Deno: any;

/**
 * Rate limiting minimal pour les Edge Functions publiques qui déclenchent
 * un envoi d'email (billet, certificat, accusé de réception...). Ces
 * fonctions acceptent nécessairement un destinataire/contenu fourni par
 * l'appelant (impossible de faire autrement : elles sont invoquées juste
 * après une action publique, avant que l'utilisateur soit authentifié) —
 * sans limite, n'importe qui peut s'en servir comme relais de spam/phishing
 * via notre compte Brevo/Gmail. On journalise dans la même table que les
 * formulaires publics (migration 042) et on plafonne par IP.
 *
 * Retourne true si l'appel est autorisé (sous la limite), false sinon.
 * Fail-open si la config est absente (ne bloque jamais par accident).
 */
export async function checkRateLimit(
  kind: string,
  ip: string | null,
  maxPerIp = 6,
  windowMinutes = 10,
): Promise<boolean> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SERVICE_KEY || !ip) return true

  const svcHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' }
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()

  try {
    const hits = await fetch(
      `${SUPABASE_URL}/rest/v1/submission_log?ip=eq.${encodeURIComponent(ip)}&kind=eq.${encodeURIComponent(kind)}&created_at=gte.${since}&select=created_at&limit=${maxPerIp}`,
      { headers: svcHeaders },
    ).then((r) => r.json()).catch(() => [])

    // Journalise cet appel, best-effort, ne bloque jamais dessus.
    fetch(`${SUPABASE_URL}/rest/v1/submission_log`, {
      method: 'POST',
      headers: { ...svcHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify([{ kind, ip, email: null }]),
    }).catch(() => {})

    return !(Array.isArray(hits) && hits.length >= maxPerIp)
  } catch {
    return true
  }
}

export function getClientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || null
}
