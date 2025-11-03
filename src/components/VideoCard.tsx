import React, { useEffect, useMemo, useState } from 'react';
import type { VideoItem } from '../data/videos';
import { supabase } from '../supabaseClient';

const DEFAULT_VIDEO_BUCKET = import.meta.env.VITE_SUPABASE_VIDEO_BUCKET || 'videos';

interface VideoCardProps {
  video: VideoItem;
}

const preferPublicUrl = (bucket: string, path: string): string | null => {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const { data } = supabase.storage.from(bucket).getPublicUrl(normalized);
  return data?.publicUrl || null;
};

const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const resolve = async () => {
      // 1) URL directe fournie
      if (video.video_url) {
        if (active) setPlayableUrl(video.video_url);
        return;
      }
      // 2) Bucket + storage_path → essayer URL publique, sinon URL signée
      const bucketName = video.bucket || DEFAULT_VIDEO_BUCKET;
      if (video.storage_path) {
        // si storage_path est déjà une URL
        if (/^https?:\/\//i.test(video.storage_path)) {
          if (active) setPlayableUrl(video.storage_path);
          return;
        }
        const publicUrl = preferPublicUrl(bucketName, video.storage_path);
        if (publicUrl) {
          if (active) setPlayableUrl(publicUrl);
          return;
        }
        // Générer une URL signée si le fichier n'est pas public
        const { data, error } = await supabase
          .storage
          .from(bucketName)
          .createSignedUrl(video.storage_path, 60 * 60); // 1h
        if (!error && data?.signedUrl) {
          if (active) setPlayableUrl(data.signedUrl);
          return;
        }
      }
      if (active) setPlayableUrl(null);
    };
    resolve();
    return () => {
      active = false;
    };
  }, [video]);

  const isYouTube = (url: string) => /youtube\.com|youtu\.be/.test(url);
  const isVimeo = (url: string) => /vimeo\.com/.test(url);
  const isGoogleDrive = (url: string) => /drive\.google\.com/.test(url);
  const isDirectVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);

  const getYouTubeEmbed = (url: string) => {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.slice(1);
        return `https://www.youtube.com/embed/${id}`;
      }
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : url;
    } catch {
      return url;
    }
  };

  const getVimeoEmbed = (url: string) => {
    try {
      const u = new URL(url);
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    } catch {
      return url;
    }
  };

  const getDriveEmbed = (url: string) => {
    try {
      // Supporte /file/d/{id}/view et les liens partage standard
      const directMatch = url.match(/\/file\/d\/([^/]+)\//);
      const id = directMatch?.[1];
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
      const u = new URL(url);
      const ucId = u.searchParams.get('id');
      if (ucId) return `https://drive.google.com/file/d/${ucId}/preview`;
      return url;
    } catch {
      return url;
    }
  };

  return (
    <>
      <div className="action-card bg-white rounded-lg overflow-hidden shadow-md relative hover:shadow-lg transition-shadow duration-300">
        <div className="h-48 overflow-hidden bg-gray-100">
          {video.thumbnail_url ? (
            (() => {
              const isUrl = /^https?:\/\//i.test(video.thumbnail_url as string);
              const src = isUrl
                ? (video.thumbnail_url as string)
                : preferPublicUrl(video.bucket || DEFAULT_VIDEO_BUCKET, (video.thumbnail_url as string));
              return (
                <img src={src || undefined} alt={video.title} className="w-full h-full object-cover" />
              );
            })()
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <i className="fas fa-video text-4xl" />
            </div>
          )}
        </div>
        <div className="p-4 sm:p-6">
          {video.date && (
            <div className="text-green-600 font-bold mb-2 text-sm">{video.date}</div>
          )}
          <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-3 line-clamp-2">{video.title}</h3>
          {video.description && (
            <p className="text-gray-700 mb-4 text-sm sm:text-base line-clamp-3">{video.description}</p>
          )}
          <div className="flex items-center gap-3 mt-4">
            <button
              disabled={!playableUrl}
              onClick={() => setIsOpen(true)}
              className={`font-medium transition-colors duration-200 ${
                playableUrl ? 'text-green-600 hover:text-green-800' : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Regarder →
            </button>
            <div className="ml-auto flex space-x-3">
              <button
                onClick={() => {
                  const shareUrl = window.location.href;
                  if ((navigator as any).share) {
                    (navigator as any).share({
                      title: video.title,
                      text: video.description || undefined,
                      url: shareUrl,
                    }).catch(() => {});
                  } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareUrl);
                    alert('Lien copié !');
                  }
                }}
                className="text-gray-500 hover:text-green-600 transition-colors duration-200 p-1"
                title="Partager"
              >
                <i className="fas fa-share text-sm"></i>
              </button>
              <button
                onClick={() => {
                  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
                  window.open(fbUrl, '_blank', 'width=600,height=400');
                }}
                className="text-gray-500 hover:text-blue-600 transition-colors duration-200 p-1"
                title="Partager sur Facebook"
              >
                <i className="fab fa-facebook-f text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isOpen && playableUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-5xl w-full relative overflow-hidden">
            <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-green-800">{video.title}</h2>
                {video.date && <p className="text-green-600 text-xs sm:text-sm">{video.date}</p>}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors duration-200"
                title="Fermer"
              >
                ×
              </button>
            </div>
            <div className="aspect-video bg-black">
              {isYouTube(playableUrl) ? (
                <iframe
                  src={getYouTubeEmbed(playableUrl)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={`Vidéo: ${video.title}`}
                />
              ) : isVimeo(playableUrl) ? (
                <iframe
                  src={getVimeoEmbed(playableUrl)}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={`Vidéo: ${video.title}`}
                />
              ) : isGoogleDrive(playableUrl) ? (
                <iframe
                  src={getDriveEmbed(playableUrl)}
                  className="w-full h-full"
                  allow="autoplay"
                  allowFullScreen
                  title={`Vidéo: ${video.title}`}
                />
              ) : (
                <>
                  <video
                    src={playableUrl}
                    className="w-full h-full"
                    controls
                    onError={() => setVideoFailed(true)}
                  />
                  {videoFailed && (
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                      <div className="bg-white/90 rounded-lg p-4 text-center max-w-md">
                        <p className="text-gray-800 mb-3">Impossible de lire la vidéo directement.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoCard;


