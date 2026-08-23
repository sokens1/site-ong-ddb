import { supabase } from '../supabaseClient';

/**
 * Enregistre une action admin sensible dans le journal de sécurité
 * (table security_events, catégorie 'admin_activity'). Best-effort :
 * un échec d'écriture du log ne doit jamais casser l'action elle-même.
 */
export const logAdminActivity = async (
  action: string,
  target?: string,
  details?: Record<string, unknown>,
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let role: string | undefined;
    try {
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
      role = profile?.role;
    } catch { /* ignore */ }

    await supabase.from('security_events').insert([{
      category: 'admin_activity',
      severity: 'info',
      action,
      actor_email: user.email,
      actor_role: role,
      target: target || null,
      details: details || null,
    }]);
  } catch (err) {
    // Ne jamais bloquer l'action admin en cours pour un souci de logging.
    console.warn('logAdminActivity: échec silencieux', err);
  }
};
