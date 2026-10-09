import JSZip from 'jszip';
import { supabase } from '../supabaseClient';

export interface PosterFileItem {
  id: string;
  name: string;
  participantName: string;
  url: string;
  createdAt: string;
  size: number;
}

/**
 * Enregistre automatiquement une affiche générée sur Supabase Storage (compressée en JPEG ~180 Ko).
 */
export const uploadGeneratedPoster = async (
  eventId: number | string | undefined,
  participantName: string,
  canvas: HTMLCanvasElement
): Promise<string | null> => {
  if (!canvas || !eventId) return null;

  return new Promise((resolve) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }

        try {
          const safeName = participantName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/gi, '_')
            .slice(0, 30) || 'participant';

          const timestamp = Date.now();
          const filePath = `posters/${eventId}/${safeName}_${timestamp}.jpg`;

          const { error: uploadErr } = await supabase.storage
            .from('ong-backend')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr) {
            console.error('Erreur upload poster:', uploadErr);
            resolve(null);
            return;
          }

          const { data } = supabase.storage
            .from('ong-backend')
            .getPublicUrl(filePath);

          const publicUrl = data?.publicUrl || null;

          // Essayer de lier au participant s'il existe dans event_registrations
          if (publicUrl && participantName) {
            try {
              const { data: regList } = await supabase
                .from('event_registrations')
                .select('id, custom_data')
                .eq('event_id', eventId)
                .ilike('fullname', participantName.trim())
                .limit(1);

              if (regList && regList.length > 0) {
                const reg = regList[0];
                const updatedCustom = {
                  ...(reg.custom_data || {}),
                  poster_url: publicUrl,
                  poster_saved_at: new Date().toISOString(),
                };
                await supabase
                  .from('event_registrations')
                  .update({ custom_data: updatedCustom })
                  .eq('id', reg.id);
              }
            } catch {
              // Non bloquant
            }
          }

          resolve(publicUrl);
        } catch (err) {
          console.error('Exception upload poster:', err);
          resolve(null);
        }
      },
      'image/jpeg',
      0.85
    );
  });
};

/**
 * Récupère la liste de tous les visuels "J'y serai" stockés pour un événement.
 */
export const getEventPosters = async (
  eventId: number | string
): Promise<PosterFileItem[]> => {
  try {
    const folder = `posters/${eventId}`;
    const { data: files, error } = await supabase.storage
      .from('ong-backend')
      .list(folder, {
        limit: 500,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error || !files) {
      return [];
    }

    return files
      .filter((f) => f.name && !f.name.startsWith('.'))
      .map((f) => {
        const { data } = supabase.storage
          .from('ong-backend')
          .getPublicUrl(`${folder}/${f.name}`);

        // Extraction du nom à partir du nom de fichier (format: nom_participant_timestamp.jpg)
        const parts = f.name.replace(/\.[^/.]+$/, '').split('_');
        let pName = 'Participant';
        if (parts.length > 1) {
          pName = parts.slice(0, -1).join(' ');
          pName = pName.charAt(0).toUpperCase() + pName.slice(1);
        }

        return {
          id: f.id || f.name,
          name: f.name,
          participantName: pName,
          url: data.publicUrl,
          createdAt: f.created_at || new Date().toISOString(),
          size: f.metadata?.size || 0,
        };
      });
  } catch (err) {
    console.error('Erreur récupération posters:', err);
    return [];
  }
};

/**
 * Télécharge toutes les affiches sous forme d'une archive ZIP compacte et prête à l'emploi.
 */
export const downloadAllPostersZip = async (
  posters: PosterFileItem[],
  eventTitle: string,
  onProgress?: (percent: number, current: number, total: number) => void
): Promise<void> => {
  if (!posters || posters.length === 0) {
    throw new Error('Aucun visuel à télécharger.');
  }

  const zip = new JSZip();
  const folderName = `visuels-jy-serai-${(eventTitle || 'evenement')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 30)}`;
  const root = zip.folder(folderName) || zip;

  let loaded = 0;
  const total = posters.length;

  for (const item of posters) {
    try {
      const response = await fetch(item.url, { mode: 'cors' });
      const blob = await response.blob();
      const safeFilename = `${item.participantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${item.name}`;
      root.file(safeFilename, blob);
    } catch (err) {
      console.warn(`Échec téléchargement visuel ${item.name}:`, err);
    }
    loaded++;
    if (onProgress) {
      onProgress(Math.round((loaded / total) * 100), loaded, total);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = `${folderName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/**
 * Purge et libère l'espace de stockage Supabase pour un événement donné.
 */
export const purgeEventPostersFromStorage = async (
  eventId: number | string
): Promise<{ success: boolean; count: number }> => {
  try {
    const folder = `posters/${eventId}`;
    const { data: files, error: listErr } = await supabase.storage
      .from('ong-backend')
      .list(folder, { limit: 1000 });

    if (listErr || !files || files.length === 0) {
      return { success: true, count: 0 };
    }

    const pathsToDelete = files
      .filter((f) => f.name && !f.name.startsWith('.'))
      .map((f) => `${folder}/${f.name}`);

    if (pathsToDelete.length > 0) {
      const { error: delErr } = await supabase.storage
        .from('ong-backend')
        .remove(pathsToDelete);

      if (delErr) {
        throw delErr;
      }
    }

    // Vider les URLs dans event_registrations
    try {
      const { data: regList } = await supabase
        .from('event_registrations')
        .select('id, custom_data')
        .eq('event_id', eventId);

      if (regList) {
        for (const reg of regList) {
          if (reg.custom_data?.poster_url) {
            const { poster_url, ...rest } = reg.custom_data;
            await supabase
              .from('event_registrations')
              .update({ custom_data: rest })
              .eq('id', reg.id);
          }
        }
      }
    } catch {
      // Nettoyage DB optionnel
    }

    return { success: true, count: pathsToDelete.length };
  } catch (err: any) {
    console.error('Erreur purge posters:', err);
    throw new Error(err.message || 'Échec de la suppression des visuels');
  }
};
