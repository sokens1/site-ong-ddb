/**
 * Utilitaires de conversion Date <-> input datetime-local
 * Empêche le décalage perpétuel d'heures (drift timezone UTC vs local)
 * lors de la sauvegarde et du rechargement des événements.
 */

/**
 * Convertit un timestamp Supabase/PostgreSQL (ex: '2026-10-30T07:30:00+00:00')
 * en valeur exploitable par un <input type="datetime-local" /> ('YYYY-MM-DDTHH:mm').
 */
export const toDatetimeLocalString = (dateInput?: string | Date | null): string => {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Convertit la valeur d'un <input type="datetime-local" /> ('YYYY-MM-DDTHH:mm')
 * en ISO 8601 complet ('YYYY-MM-DDTHH:mm:ss.sssZ') selon le fuseau horaire local.
 * De cette façon, Supabase TIMESTAMPTZ stocke l'heure absolue exacte
 * et la restitution locale d.getHours() redonne rigoureusement la même heure.
 */
export const fromDatetimeLocalString = (inputVal?: string | null): string | null => {
  if (!inputVal) return null;
  const trimmed = inputVal.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return trimmed;
  return d.toISOString();
};

/**
 * Retourne la date et heure actuelles au format 'YYYY-MM-DDTHH:mm'.
 */
export const getCurrentDatetimeLocal = (): string => {
  return toDatetimeLocalString(new Date());
};
