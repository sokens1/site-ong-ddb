import { supabase } from '../../supabaseClient';

const MAX_SITE_IMAGE_BYTES = 5 * 1024 * 1024;

/** Message d'erreur à afficher si le fichier n'est pas une image acceptable, sinon null. */
export const validateSiteImage = (file: File): string | null => {
  if (!file.type.startsWith('image/')) return 'Veuillez sélectionner une image.';
  if (file.size > MAX_SITE_IMAGE_BYTES) return "L'image ne doit pas dépasser 5MB.";
  return null;
};

/**
 * Envoie une image du contenu du site dans le bucket public et renvoie son URL.
 * `nameBase` sert à nommer le fichier (ex: la clé site_content qui l'utilise).
 */
export const uploadSiteImage = async (file: File, nameBase: string): Promise<string> => {
  const ext = file.name.split('.').pop();
  const fileName = `site-content/${nameBase.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('ong-backend').upload(fileName, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  return supabase.storage.from('ong-backend').getPublicUrl(fileName).data.publicUrl;
};
