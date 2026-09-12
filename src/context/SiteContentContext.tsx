import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export type SiteContentType = 'text' | 'image';

interface SiteContentContextValue {
  /** Texte modifié pour cette clé, ou null si aucun override n'existe. */
  getText: (key: string) => string | null;
  /** Image modifiée pour cette clé, ou null si aucun override n'existe. */
  getImage: (key: string) => string | null;
  setValue: (key: string, type: SiteContentType, value: string) => Promise<void>;
  loading: boolean;
  /** true uniquement dans l'onglet Admin > Paramètres > Contenu du site web. */
  editMode: boolean;
}

const noop = async () => {};

const SiteContentContext = createContext<SiteContentContextValue>({
  getText: () => null,
  getImage: () => null,
  setValue: noop,
  loading: false,
  editMode: false,
});

export const SiteContentProvider: React.FC<{ children: React.ReactNode; editMode?: boolean }> = ({
  children,
  editMode = false,
}) => {
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await supabase.from('site_content').select('key, value');
      if (active && !error && data) {
        const m: Record<string, string> = {};
        data.forEach((row: any) => { m[row.key] = row.value; });
        setMap(m);
      }
      if (active) setLoading(false);
    })();

    // Reflète en direct les changements faits depuis l'admin (ou un autre
    // onglet) sans recharger la page.
    const channel = supabase
      .channel('site_content_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, (payload) => {
        setMap((prev) => {
          const next = { ...prev };
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as any;
            delete next[oldRow.key];
          } else {
            const row = payload.new as any;
            next[row.key] = row.value;
          }
          return next;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const getText = useCallback((key: string) => (key in map ? map[key] : null), [map]);
  const getImage = useCallback((key: string) => (key in map ? map[key] : null), [map]);

  const setValue = useCallback(async (key: string, type: SiteContentType, value: string) => {
    setMap((prev) => ({ ...prev, [key]: value }));
    await supabase.from('site_content').upsert({ key, type, value, updated_at: new Date().toISOString() });
  }, []);

  return (
    <SiteContentContext.Provider value={{ getText, getImage, setValue, loading, editMode }}>
      {children}
    </SiteContentContext.Provider>
  );
};

export const useSiteContent = () => useContext(SiteContentContext);
