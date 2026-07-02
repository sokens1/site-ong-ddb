import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ExternalLink, Copy, Check, X } from 'lucide-react';
import { isAndroidDevice, openInExternalBrowser } from '../utils/inAppBrowser';
import { useInAppBrowserBanner } from '../context/InAppBrowserContext';

/**
 * Petite carte flottante (fixed, comme le bouton "back to top") affichée quand
 * le site est ouvert dans le navigateur intégré de Facebook/Instagram/etc.
 * Purement informative : l'utilisateur reste libre de naviguer/s'inscrire,
 * seul le téléchargement de fichiers ne fonctionnera pas dans ce contexte.
 */
const InAppBrowserBanner: React.FC = () => {
  const { visible, dismiss } = useInAppBrowserBanner();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="fixed z-40 bottom-24 left-4 right-4 sm:right-auto sm:left-6 sm:w-96 bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-start gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-bold text-gray-800 leading-tight">Navigateur intégré détecté</p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Fermer"
                className="flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors -mt-1 -mr-1"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              Vous pouvez continuer à naviguer et vous inscrire normalement. Seul le{' '}
              <strong className="text-gray-700">téléchargement de fichiers</strong> (billet, affiche) ne fonctionne
              pas dans le navigateur de Facebook/Instagram. Pour télécharger : appuyez sur{' '}
              <strong className="text-gray-700">⋯</strong> (ou <strong className="text-gray-700">⋮</strong>) en haut
              de l'écran, puis <strong className="text-gray-700">« Ouvrir dans le navigateur »</strong>.
            </p>

            <div className="flex flex-wrap gap-2">
              {isAndroidDevice() && (
                <button
                  type="button"
                  onClick={openInExternalBrowser}
                  className="flex-1 min-w-[45%] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors text-xs"
                >
                  <ExternalLink size={13} /> Ouvrir dans le navigateur
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 min-w-[45%] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 font-semibold hover:bg-gray-100 transition-colors text-xs"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Lien copié !' : 'Copier le lien'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InAppBrowserBanner;
