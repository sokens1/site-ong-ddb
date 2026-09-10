import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Widget Cloudflare Turnstile (anti-bot, gratuit, invisible/managed).
 *
 * Config : mettre la clé de site dans .env
 *   VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
 * et le secret côté Supabase (Edge Function) :
 *   supabase secrets set TURNSTILE_SECRET_KEY=0x4AAAAAAA...
 *
 * Si VITE_TURNSTILE_SITE_KEY n'est pas défini, le composant ne rend
 * rien et renvoie un token vide : les formulaires continuent de
 * fonctionner (l'Edge Function n'exige alors pas le token non plus).
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve) => {
    window.onTurnstileLoad = () => resolve();
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  /** Reçoit le token à chaque résolution (ou '' si Turnstile non configuré / expiré). */
  onToken: (token: string) => void;
  /** Incrémente cette valeur pour forcer un nouveau token (après un échec d'envoi). */
  resetSignal?: number;
  className?: string;
}

export default function Turnstile({ onToken, resetSignal = 0, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) {
      cb.current(''); // pas configuré : on débloque le formulaire
      return;
    }
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(''),
        'error-callback': () => cb.current(''),
        theme: 'light',
        action: 'submit',
      });
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* noop */ }
      }
    };
  }, []);

  // Un token Turnstile est à usage unique : après un échec d'envoi,
  // le formulaire incrémente resetSignal pour en obtenir un neuf.
  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      cb.current('');
      try { window.turnstile.reset(widgetId.current); } catch { /* noop */ }
    }
  }, [resetSignal]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className={className} />;
}

/**
 * Vérifie côté serveur : token Turnstile + format email + domaine jetable.
 * Renvoie { ok: true } ou { ok: false, reason }.
 */
export async function verifySubmission(
  params: { token: string; email: string },
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-submission', { body: params });
    if (error) return { ok: false, reason: 'network' };
    return data as { ok: boolean; reason?: string };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export const VERIFY_MESSAGES: Record<string, string> = {
  captcha: 'Vérification anti-robot échouée. Rechargez la page et réessayez.',
  email_format: 'Cette adresse email n\'est pas valide.',
  email_disposable: 'Merci d\'utiliser une adresse email permanente (pas une adresse jetable).',
  network: 'Vérification indisponible. Réessayez dans un instant.',
  server_error: 'Une erreur est survenue pendant la vérification.',
};
