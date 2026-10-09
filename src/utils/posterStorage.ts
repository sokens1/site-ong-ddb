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
 * Enregistre automatiquement une affiche générée sur Supabase Storage et dans la table `event_posters`.
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
          const cleanName = participantName.trim() || 'Participant';
          const safeName = cleanName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/gi, '_')
            .slice(0, 30) || 'participant';

          const timestamp = Date.now();
          const fileName = `${safeName}_${timestamp}.jpg`;
          const filePath = `posters/${eventId}/${fileName}`;

          // 1. Upload vers Supabase Storage
          const { error: uploadErr } = await supabase.storage
            .from('ong-backend')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr) {
            console.warn('Supabase Storage upload warning:', uploadErr.message);
          }

          const { data } = supabase.storage
            .from('ong-backend')
            .getPublicUrl(filePath);

          const publicUrl = data?.publicUrl || null;

          // 2. Enregistrer dans la table event_posters (si créée)
          if (publicUrl) {
            try {
              await supabase.from('event_posters').insert({
                event_id: Number(eventId),
                participant_name: cleanName,
                file_name: fileName,
                image_url: publicUrl,
                file_size: blob.size,
              });
            } catch (dbErr) {
              console.warn('event_posters table insert skipped:', dbErr);
            }
          }

          // 3. Essayer de lier au participant dans event_registrations s'il existe
          if (publicUrl && cleanName) {
            try {
              const { data: regList } = await supabase
                .from('event_registrations')
                .select('id, custom_data')
                .eq('event_id', eventId)
                .ilike('fullname', cleanName)
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
      0.88
    );
  });
};

/**
 * Récupère la liste de tous les visuels "J'y serai" stockés pour un événement.
 * Combine la table `event_posters`, le bucket Storage Supabase et `event_registrations`.
 */
export const getEventPosters = async (
  eventId: number | string
): Promise<PosterFileItem[]> => {
  const itemsMap = new Map<string, PosterFileItem>();

  // 1. Source 1 : Table `event_posters`
  try {
    const { data: dbPosters, error: dbErr } = await supabase
      .from('event_posters')
      .select('*')
      .eq('event_id', Number(eventId))
      .order('created_at', { ascending: false });

    if (!dbErr && Array.isArray(dbPosters)) {
      for (const row of dbPosters) {
        if (row.image_url) {
          itemsMap.set(row.image_url, {
            id: String(row.id || row.file_name),
            name: row.file_name || 'affiche.jpg',
            participantName: row.participant_name || 'Participant',
            url: row.image_url,
            createdAt: row.created_at || new Date().toISOString(),
            size: Number(row.file_size) || 180000,
          });
        }
      }
    }
  } catch (e) {
    console.warn('Lecture event_posters:', e);
  }

  // 2. Source 2 : Supabase Storage (dossier posters/${eventId})
  try {
    const folder = `posters/${eventId}`;
    const { data: files, error } = await supabase.storage
      .from('ong-backend')
      .list(folder, {
        limit: 500,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (!error && files && Array.isArray(files)) {
      for (const f of files) {
        if (!f.name || f.name.startsWith('.')) continue;

        const { data } = supabase.storage
          .from('ong-backend')
          .getPublicUrl(`${folder}/${f.name}`);

        const url = data?.publicUrl;
        if (url && !itemsMap.has(url)) {
          // Extraction du nom à partir du nom de fichier (format: nom_participant_timestamp.jpg)
          const parts = f.name.replace(/\.[^/.]+$/, '').split('_');
          let pName = 'Participant';
          if (parts.length > 1) {
            pName = parts.slice(0, -1).join(' ');
            pName = pName.charAt(0).toUpperCase() + pName.slice(1);
          }

          itemsMap.set(url, {
            id: f.id || f.name,
            name: f.name,
            participantName: pName,
            url,
            createdAt: f.created_at || new Date().toISOString(),
            size: f.metadata?.size || 180000,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Lecture Supabase Storage posters:', err);
  }

  // 3. Source 3 : `event_registrations` (custom_data.poster_url)
  try {
    const { data: regList, error: regErr } = await supabase
      .from('event_registrations')
      .select('id, fullname, custom_data, created_at')
      .eq('event_id', Number(eventId));

    if (!regErr && Array.isArray(regList)) {
      for (const reg of regList) {
        const pUrl = reg.custom_data?.poster_url;
        if (pUrl && !itemsMap.has(pUrl)) {
          itemsMap.set(pUrl, {
            id: `reg_${reg.id}`,
            name: `affiche_${reg.id}.jpg`,
            participantName: reg.fullname || 'Participant',
            url: pUrl,
            createdAt: reg.custom_data?.poster_saved_at || reg.created_at || new Date().toISOString(),
            size: 180000,
          });
        }
      }
    }
  } catch (e) {
    console.warn('Lecture event_registrations posters:', e);
  }

  // Conversion en tableau trié par date décroissante
  return Array.from(itemsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 30)}`;
  const root = zip.folder(folderName) || zip;

  let loaded = 0;
  const total = posters.length;

  for (const item of posters) {
    try {
      const response = await fetch(item.url, { mode: 'cors' });
      const blob = await response.blob();
      const safeParticipant = item.participantName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_');
      const safeFilename = `${safeParticipant}_${item.name.replace(/[^a-z0-9._-]/gi, '_')}`;
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
    let deletedCount = 0;

    // 1. Supprimer dans Supabase Storage
    const folder = `posters/${eventId}`;
    const { data: files } = await supabase.storage
      .from('ong-backend')
      .list(folder, { limit: 1000 });

    if (files && files.length > 0) {
      const pathsToDelete = files
        .filter((f) => f.name && !f.name.startsWith('.'))
        .map((f) => `${folder}/${f.name}`);

      if (pathsToDelete.length > 0) {
        await supabase.storage.from('ong-backend').remove(pathsToDelete);
        deletedCount = pathsToDelete.length;
      }
    }

    // 2. Nettoyer la table event_posters
    try {
      const { data: delPosters } = await supabase
        .from('event_posters')
        .delete()
        .eq('event_id', Number(eventId))
        .select('id');

      if (delPosters && delPosters.length > deletedCount) {
        deletedCount = delPosters.length;
      }
    } catch {
      // Ignorer si la table n'existe pas encore
    }

    // 3. Vider les URLs dans event_registrations
    try {
      const { data: regList } = await supabase
        .from('event_registrations')
        .select('id, custom_data')
        .eq('event_id', Number(eventId));

      if (regList) {
        for (const reg of regList) {
          if (reg.custom_data?.poster_url) {
            const { poster_url, poster_saved_at, ...rest } = reg.custom_data;
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

    return { success: true, count: deletedCount };
  } catch (err: any) {
    console.error('Erreur purge posters:', err);
    throw new Error(err.message || 'Échec de la suppression des visuels');
  }
};
