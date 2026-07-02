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
          className="fixed z-40 bottom-40 left-3 right-3 sm:right-auto sm:left-6 sm:w-72 bg-white rounded-xl shadow-2xl border border-amber-200 overflow-hidden"
        >
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
              <p className="flex-1 min-w-0 text-xs font-bold text-gray-800 leading-tight">Téléchargement bloqué ici</p>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Fermer"
                className="flex-shrink-0 -m-1 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-[11px] text-gray-500 leading-snug mb-2.5">
              Vous pouvez vous inscrire normalement. Pour télécharger : appuyez sur <strong className="text-gray-700">⋯</strong> puis{' '}
              <strong className="text-gray-700">« Ouvrir dans le navigateur »</strong>.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {isAndroidDevice() && (
                <button
                  type="button"
                  onClick={openInExternalBrowser}
                  className="flex-1 min-w-[45%] inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors text-[11px]"
                >
                  <ExternalLink size={12} /> Ouvrir
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 min-w-[45%] inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 font-semibold hover:bg-gray-100 transition-colors text-[11px]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copié !' : 'Copier le lien'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InAppBrowserBanner;
