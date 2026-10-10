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
 * Normalise un nom de participant pour la clé de déduplication.
 */
export const normalizeParticipantKey = (name?: string): string => {
  return (name || 'participant')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 40) || 'participant';
};

/**
 * Enregistre une affiche générée sur Supabase Storage et dans la table `event_posters`.
 * GARANTIE STRICTE : Un seul visuel conservé par personne pour chaque événement.
 * L'ancien fichier de la même personne est automatiquement écrasé (upsert) pour préserver l'espace de stockage.
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
          const safeName = normalizeParticipantKey(cleanName);

          // Nom de fichier STRICTEMENT UNIQUE par personne pour cet événement
          // Ne contient PAS de timestamp pour permettre l'écrasement sur Supabase Storage (upsert)
          const fileName = `${safeName}.jpg`;
          const filePath = `posters/${eventId}/${fileName}`;

          // 1. Upload vers Supabase Storage avec écrasement en place (upsert: true)
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

          // 2. Supprimer les anciens fichiers horodatés éventuels de ce même participant (ex: aminata_174000.jpg)
          try {
            const folder = `posters/${eventId}`;
            const { data: existingFiles } = await supabase.storage
              .from('ong-backend')
              .list(folder, { search: safeName });

            if (existingFiles && existingFiles.length > 0) {
              const stalePaths = existingFiles
                .filter(f => f.name && f.name !== fileName && f.name.startsWith(safeName))
                .map(f => `${folder}/${f.name}`);

              if (stalePaths.length > 0) {
                await supabase.storage.from('ong-backend').remove(stalePaths);
              }
            }
          } catch {
            // Nettoyage en arrière-plan non bloquant
          }

          const { data } = supabase.storage
            .from('ong-backend')
            .getPublicUrl(filePath);

          const publicUrl = data?.publicUrl || null;

          // 3. Enregistrer ou mettre à jour dans la table event_posters (unicité par participant)
          if (publicUrl) {
            try {
              // Vérifier si une entrée existe déjà pour ce participant ou ce nom de fichier
              const { data: existingPosters } = await supabase
                .from('event_posters')
                .select('id, file_name, created_at')
                .eq('event_id', Number(eventId))
                .or(`file_name.eq.${fileName},participant_name.ilike.${cleanName}`)
                .order('created_at', { ascending: false });

              if (existingPosters && existingPosters.length > 0) {
                // Mettre à jour l'entrée existante la plus récente
                const primaryId = existingPosters[0].id;
                await supabase
                  .from('event_posters')
                  .update({
                    participant_name: cleanName,
                    file_name: fileName,
                    image_url: publicUrl,
                    file_size: blob.size,
                    created_at: new Date().toISOString(),
                  })
                  .eq('id', primaryId);

                // Nettoyer les doublons résiduels s'il y en avait
                if (existingPosters.length > 1) {
                  const toDeleteIds = existingPosters.slice(1).map(r => r.id);
                  await supabase.from('event_posters').delete().in('id', toDeleteIds);
                }
              } else {
                // Première affiche pour ce participant : insertion
                await supabase.from('event_posters').insert({
                  event_id: Number(eventId),
                  participant_name: cleanName,
                  file_name: fileName,
                  image_url: publicUrl,
                  file_size: blob.size,
                });
              }
            } catch (dbErr) {
              console.warn('event_posters table upsert note:', dbErr);
            }
          }

          // 4. Lier au participant dans event_registrations s'il existe
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
 * GARANTIE STRICTE : Déduplication intégrée pour ne renvoyer qu'un seul visuel par personne (le plus récent).
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
          const item: PosterFileItem = {
            id: String(row.id || row.file_name),
            name: row.file_name || 'affiche.jpg',
            participantName: row.participant_name || 'Participant',
            url: row.image_url,
            createdAt: row.created_at || new Date().toISOString(),
            size: Number(row.file_size) || 180000,
          };
          itemsMap.set(row.image_url, item);
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
        limit: 1000,
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
          // Extraction propre du nom à partir du nom de fichier
          const rawBase = f.name.replace(/\.[^/.]+$/, '');
          const parts = rawBase.split('_');
          let pName = 'Participant';

          // Gérer format ancien nom_timestamp ou nouveau format nom
          if (parts.length > 1 && !isNaN(Number(parts[parts.length - 1]))) {
            pName = parts.slice(0, -1).join(' ');
          } else {
            pName = parts.join(' ');
          }
          pName = pName.charAt(0).toUpperCase() + pName.slice(1);

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

  // ── DÉDUPLICATION STRICTE PAR PARTICIPANT : UN SEUL VISUEL PAR PERSONNE ────
  const dedupedByParticipant = new Map<string, PosterFileItem>();

  for (const item of itemsMap.values()) {
    const pKey = normalizeParticipantKey(item.participantName);
    const existing = dedupedByParticipant.get(pKey);

    if (!existing) {
      dedupedByParticipant.set(pKey, item);
    } else {
      // Conserver l'affiche la plus récente
      const timeExisting = new Date(existing.createdAt).getTime();
      const timeCurrent = new Date(item.createdAt).getTime();
      if (timeCurrent > timeExisting) {
        dedupedByParticipant.set(pKey, item);
      }
    }
  }

  // Conversion en tableau trié par date décroissante
  return Array.from(dedupedByParticipant.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

/**
 * Nettoie les fichiers et entrées en doublon dans Supabase Storage et la table `event_posters`
 * pour un événement, afin de libérer l'espace disque immédiatement.
 */
export const cleanupDuplicatePosters = async (
  eventId: number | string
): Promise<{ success: boolean; removedCount: number }> => {
  let removedCount = 0;
  try {
    // 1. Lister tous les fichiers Storage
    const folder = `posters/${eventId}`;
    const { data: files } = await supabase.storage
      .from('ong-backend')
      .list(folder, { limit: 1000 });

    if (files && files.length > 0) {
      // Grouper par nom normalisé
      const groupedFiles = new Map<string, typeof files>();
      for (const f of files) {
        if (!f.name || f.name.startsWith('.')) continue;
        const rawBase = f.name.replace(/\.[^/.]+$/, '');
        const parts = rawBase.split('_');
        const pKey = (!isNaN(Number(parts[parts.length - 1])) && parts.length > 1)
          ? parts.slice(0, -1).join('_')
          : rawBase;

        if (!groupedFiles.has(pKey)) groupedFiles.set(pKey, []);
        groupedFiles.get(pKey)!.push(f);
      }

      const pathsToDelete: string[] = [];
      for (const [_, list] of groupedFiles.entries()) {
        if (list.length > 1) {
          // Trier par date décroissante et ne garder que le plus récent
          list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const redundant = list.slice(1);
          redundant.forEach(f => pathsToDelete.push(`${folder}/${f.name}`));
        }
      }

      if (pathsToDelete.length > 0) {
        await supabase.storage.from('ong-backend').remove(pathsToDelete);
        removedCount += pathsToDelete.length;
      }
    }

    // 2. Nettoyer les doublons dans la table event_posters
    try {
      const { data: dbPosters } = await supabase
        .from('event_posters')
        .select('id, participant_name, created_at')
        .eq('event_id', Number(eventId))
        .order('created_at', { ascending: false });

      if (dbPosters && dbPosters.length > 0) {
        const seenNames = new Set<string>();
        const redundantIds: string[] = [];

        for (const row of dbPosters) {
          const pKey = normalizeParticipantKey(row.participant_name);
          if (seenNames.has(pKey)) {
            redundantIds.push(row.id);
          } else {
            seenNames.add(pKey);
          }
        }

        if (redundantIds.length > 0) {
          await supabase.from('event_posters').delete().in('id', redundantIds);
          removedCount += redundantIds.length;
        }
      }
    } catch { /* non bloquant */ }

    return { success: true, removedCount };
  } catch (err: any) {
    console.error('Erreur nettoyage doublons posters:', err);
    return { success: false, removedCount };
  }
};

/**
 * Télécharge toutes les affiches sous forme d'une archive ZIP compacte et prête à l'emploi.
 * Ne contient qu'une seule affiche par personne.
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
      const safeParticipant = normalizeParticipantKey(item.participantName);
      const safeFilename = `${safeParticipant}.jpg`;
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
