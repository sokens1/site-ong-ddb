import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useSiteContent } from '../../context/SiteContentContext';

interface EditableImageProps {
  /** Clé unique dans site_content, ex: "hero.image_1". */
  k: string;
  /** Image par défaut (utilisée tant qu'aucun override n'existe). */
  fallback: string;
  alt?: string;
  /** Classes du conteneur (dimensions, arrondis...). */
  className?: string;
  /** Classes de l'élément <img> lui-même (par défaut: h-full w-full object-cover). */
  imgClassName?: string;
  /** Élément/composant pour le rendu normal (public) — 'img' par défaut, ou motion.img pour garder une animation. */
  as?: React.ElementType;
  /** Props supplémentaires transmises à `as` en mode normal (ex: animate/transition de framer-motion). */
  imgProps?: Record<string, any>;
}

const EditableImage: React.FC<EditableImageProps> = ({ k, fallback, alt = '', className = '', imgClassName, as: As = 'img', imgProps }) => {
  const { getImage, setValue, editMode } = useSiteContent();
  const src = getImage(k) ?? fallback;

  if (!editMode) {
    return <As src={src} alt={alt} loading="lazy" className={imgClassName || className} {...imgProps} />;
  }

  return <EditableImageEditMode k={k} src={src} alt={alt} className={className} imgClassName={imgClassName} setValue={setValue} />;
};

const EditableImageEditMode: React.FC<{
  k: string;
  src: string;
  alt: string;
  className: string;
  imgClassName?: string;
  setValue: (key: string, type: 'image', value: string) => Promise<void>;
}> = ({ k, src, alt, className, imgClassName, setValue }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 5MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `site-content/${k.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('ong-backend').upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('ong-backend').getPublicUrl(fileName);
      await setValue(k, 'image', data.publicUrl);
    } catch (err) {
      console.error('Erreur upload image site_content:', err);
      alert("Erreur lors de l'upload de l'image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`} onClick={() => inputRef.current?.click()}>
      <img src={src} alt={alt} className={imgClassName || 'h-full w-full object-cover'} />
      <div className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/45 hover:opacity-100">
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-white">
            <Camera className="h-6 w-6" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Changer</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
    </div>
  );
};

export default EditableImage;
