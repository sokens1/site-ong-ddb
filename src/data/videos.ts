import { supabase } from '../supabaseClient';

export interface VideoItem {
  id: number;
  title: string;
  description?: string | null;
  // URL directe (YouTube, Vimeo, Drive, lien public ou signé)
  video_url?: string | null;
  // Chemin de stockage Supabase (ex: "videos/monfichier.mp4")
  storage_path?: string | null;
  // Nom du bucket Supabase (par défaut: VITE_SUPABASE_VIDEO_BUCKET || 'videos')
  bucket?: string | null;
  // Vignette optionnelle
  thumbnail_url?: string | null;
  date?: string | null; // format libre
  category?: string | null;
  created_at?: string | null;
}

// Bucket par défaut configurable via .env
const DEFAULT_VIDEO_BUCKET = import.meta.env.VITE_SUPABASE_VIDEO_BUCKET || 'videos';

export const fetchVideos = async (): Promise<VideoItem[]> => {
  const { data, error } = await supabase
    .from('videos')
    .select('*');

  if (error) {
    console.error('Error fetching videos:', error);
    return [];
  }

  // Adapter le mapping à votre schéma: videourl, filepath, thumbnailpath
  const mapped: VideoItem[] = (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    date: row.date ?? null,
    created_at: row.created_at ?? null,
    video_url: row.videourl ?? null,
    storage_path: row.filepath ?? null,
    thumbnail_url: row.thumbnailpath ?? null,
    bucket: row.bucket ?? DEFAULT_VIDEO_BUCKET, // si vous avez une colonne bucket, sinon défaut
    category: row.category ?? null,
  }));

  return mapped;
};


