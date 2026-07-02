import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { isInAppBrowser } from '../utils/inAppBrowser';

interface InAppBrowserContextValue {
  /** true si on est dans un navigateur intégré (FB/IG/...) ET que la bannière n'a pas été fermée */
  visible: boolean;
  dismiss: () => void;
  /** Rouvre la bannière (ex: après un clic sur un bouton de téléchargement) */
  reactivate: () => void;
}

const InAppBrowserContext = createContext<InAppBrowserContextValue | null>(null);

export const InAppBrowserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const detected = useMemo(() => isInAppBrowser(), []);
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => setDismissed(true), []);
  const reactivate = useCallback(() => setDismissed(false), []);

  const value = useMemo<InAppBrowserContextValue>(
    () => ({ visible: detected && !dismissed, dismiss, reactivate }),
    [detected, dismissed, dismiss, reactivate],
  );

  return <InAppBrowserContext.Provider value={value}>{children}</InAppBrowserContext.Provider>;
};

export const useInAppBrowserBanner = (): InAppBrowserContextValue => {
  const ctx = useContext(InAppBrowserContext);
  if (!ctx) return { visible: false, dismiss: () => {}, reactivate: () => {} };
  return ctx;
};
