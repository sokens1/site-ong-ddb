declare const Deno: any;

/**
 * Vérifie que l'appelant est authentifié ET que son rôle (table user_profiles)
 * fait partie de allowedRoles. Sans cette vérification, n'importe qui
 * connaissant l'URL de la fonction + la clé publique "anon" (visible dans le
 * bundle JS du site) peut l'invoquer directement — même sans être connecté —
 * ce qui permettait par exemple de déclencher des envois d'emails en masse
 * arbitraires via notre compte Gmail/Brevo.
 *
 * Utilise la Service Role Key (injectée automatiquement par Supabase dans
 * chaque Edge Function via SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) pour
 * résoudre l'utilisateur et son rôle indépendamment des policies RLS.
 *
 * Retourne `null` si la requête est autorisée, ou une Response d'erreur
 * (401/403/500) à renvoyer telle quelle sinon.
 */
/** Insère un événement suspect dans security_events (best-effort, ne doit jamais lever). */
async function logSuspiciousAccess(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: string,
  req: Request,
  reason: string,
  severity: 'warning' | 'critical',
  actorEmail?: string,
) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/security_events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([{
        category: 'suspicious_access',
        severity,
        action: 'edge_function_denied',
        actor_email: actorEmail || null,
        target: functionName,
        details: { reason },
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
        user_agent: req.headers.get('user-agent') || null,
      }]),
    });
  } catch (err) {
    console.warn('logSuspiciousAccess: échec silencieux', err);
  }
}

export async function verifyAdminRequest(
  req: Request,
  allowedRoles: string[],
  corsHeaders: Record<string, string>,
  functionName = 'unknown',
): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[SÉCURITÉ] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants pour la vérification admin.');
    return new Response(JSON.stringify({ error: 'Configuration serveur incomplète.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!token) {
    await logSuspiciousAccess(supabaseUrl, serviceRoleKey, functionName, req, 'Aucun token fourni', 'warning');
    return new Response(JSON.stringify({ error: 'Authentification requise.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 1. Résout l'utilisateur à partir de son token de session
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceRoleKey },
  });
  if (!userRes.ok) {
    await logSuspiciousAccess(supabaseUrl, serviceRoleKey, functionName, req, 'Token invalide ou expiré', 'warning');
    return new Response(JSON.stringify({ error: 'Session invalide ou expirée.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const user = await userRes.json();

  // 2. Résout son rôle dans user_profiles (via Service Role, indépendant de RLS)
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/user_profiles?id=eq.${user.id}&select=role`,
    { headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } },
  );
  const profiles = await profileRes.json().catch(() => []);
  const role = profiles?.[0]?.role || 'membre';

  if (!allowedRoles.includes(role)) {
    console.warn(`[SÉCURITÉ] Accès refusé — user=${user.email || user.id} role=${role} rôles_requis=${allowedRoles.join(',')}`);
    await logSuspiciousAccess(
      supabaseUrl, serviceRoleKey, functionName, req,
      `Rôle '${role}' insuffisant (requis: ${allowedRoles.join(', ')})`, 'critical', user.email,
    );
    return new Response(JSON.stringify({ error: 'Accès refusé : privilèges insuffisants.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return null; // autorisé
}
