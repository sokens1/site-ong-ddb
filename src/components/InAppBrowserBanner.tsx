import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, Copy, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { isAndroidDevice, openInExternalBrowser } from '../utils/inAppBrowser';
import { useInAppBrowserBanner } from '../context/InAppBrowserContext';

/**
 * Bandeau d'information sticky (pas bloquant) affiché tout au long de la page
 * quand le site est ouvert dans le navigateur intégré de Facebook/Instagram/etc.
 * L'utilisateur reste libre de naviguer/s'inscrire ; seul le téléchargement de
 * fichiers ne fonctionnera pas dans ce contexte.
 */
const InAppBrowserBanner: React.FC = () => {
  const { visible, dismiss } = useInAppBrowserBanner();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!visible) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <div className="sticky top-0 z-40 bg-amber-50 border-b border-amber-200 text-amber-800 shadow-sm">
      <div className="container mx-auto px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <AlertTriangle size={16} className="flex-shrink-0 text-amber-600" />
          <p className="flex-1 min-w-0 text-[11px] sm:text-sm font-medium leading-tight truncate sm:whitespace-normal">
            Le téléchargement (billet, affiche) ne fonctionne pas dans ce navigateur intégré.
          </p>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors px-1.5 py-1 rounded-md hover:bg-amber-100"
          >
            <span className="hidden sm:inline">{expanded ? 'Réduire' : 'Comment faire ?'}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="flex-shrink-0 p-1 rounded-full text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {expanded && (
          <div className="pt-2.5 mt-2 border-t border-amber-200 text-[11px] sm:text-sm text-amber-700">
            <p className="mb-2.5 leading-relaxed">
              Vous pouvez continuer à naviguer et vous inscrire normalement, c'est uniquement le{' '}
              <strong>téléchargement de fichiers</strong> qui est bloqué ici. Pour télécharger : appuyez sur{' '}
              <strong>⋯</strong> (ou <strong>⋮</strong>) en haut à droite de l'écran, puis choisissez{' '}
              <strong>« Ouvrir dans le navigateur »</strong>.
            </p>
            <div className="flex flex-wrap gap-2">
              {isAndroidDevice() && (
                <button
                  type="button"
                  onClick={openInExternalBrowser}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors text-xs"
                >
                  <ExternalLink size={13} /> Ouvrir dans le navigateur
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 font-semibold hover:bg-amber-100 transition-colors text-xs"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Lien copié !' : 'Copier le lien'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InAppBrowserBanner;
