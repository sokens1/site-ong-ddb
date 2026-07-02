import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
import { isInAppBrowser, isAndroidDevice, openInExternalBrowser } from '../utils/inAppBrowser';

interface Props {
  message?: string;
  note?: string;
}

const InAppBrowserBanner: React.FC<Props> = ({ message, note }) => {
  const [copied, setCopied] = useState(false);
  if (!isInAppBrowser()) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-4 text-sm">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold mb-1">
            {message || "Le téléchargement ne fonctionne pas dans le navigateur intégré de Facebook / Instagram."}
          </p>
          <p className="mb-3 text-amber-700">
            Appuyez sur <strong>⋯</strong> (ou <strong>⋮</strong>) en haut à droite de l'écran, puis choisissez{' '}
            <strong>« Ouvrir dans le navigateur »</strong> (Safari ou Chrome) pour pouvoir télécharger.
          </p>
          <div className="flex flex-wrap gap-2">
            {isAndroidDevice() && (
              <button
                type="button"
                onClick={openInExternalBrowser}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors"
              >
                <ExternalLink size={14} /> Ouvrir dans le navigateur
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-amber-300 text-amber-700 font-semibold hover:bg-amber-100 transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Lien copié !' : 'Copier le lien'}
            </button>
          </div>
          {note && (
            <p className="mt-3 pt-3 border-t border-amber-200 text-amber-700 text-xs">
              {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default InAppBrowserBanner;
