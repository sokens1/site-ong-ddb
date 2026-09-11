import { useEffect } from 'react';

/**
 * Empêche l'indexation de la page courante (balise <meta name="robots">).
 *
 * Contrairement à un `Disallow` dans robots.txt — un fichier PUBLIC que
 * n'importe qui peut lire sans être un moteur de recherche — cette balise
 * n'existe que dans le HTML de la page elle-même. Elle ne révèle donc
 * jamais l'existence de la route à quelqu'un qui n'a pas déjà l'URL.
 *
 * À poser sur les pages qu'on ne veut pas voir apparaître dans une
 * recherche Google (login admin, dashboard) sans les lister nulle part
 * publiquement.
 */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);
}
