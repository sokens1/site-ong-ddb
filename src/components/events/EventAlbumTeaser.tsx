import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Images, Lock, ArrowRight, Play } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import type { AlbumAccessMode } from '../../utils/albumMedia';

interface AlbumSummary {
  general_access: AlbumAccessMode;
  photo_count: number;
  video_count: number;
}

const ACCESS_BADGE: Partial<Record<AlbumAccessMode, string>> = {
  restricted: 'Sur invitation',
  participants: 'Réservé aux participants',
  attendees: 'Réservé aux participants présents',
};

// Précharge le code de la page album au survol : l'ouverture devient instantanée
const prefetchAlbumPage = () => { import('../../pages/EventAlbumPage'); };

/**
 * Carte "Album photos & vidéos" sur la page d'un événement terminé.
 * Un seul appel RPC léger (compteurs uniquement) ; rien ne s'affiche si
 * l'album est vide ou partagé uniquement par lien.
 */
const EventAlbumTeaser: React.FC<{ eventId: number; eventRef: string; coverUrl?: string | null }> = ({ eventId, eventRef, coverUrl }) => {
  const [summary, setSummary] = useState<AlbumSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_event_album_summary', { p_event_id: eventId }).then(({ data, error }) => {
      if (cancelled || error || !Array.isArray(data) || !data[0]) return;
      setSummary(data[0] as AlbumSummary);
    });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!summary) return null;
  const badge = ACCESS_BADGE[summary.general_access];
  const parts = [
    summary.photo_count ? `${summary.photo_count} photo${summary.photo_count > 1 ? 's' : ''}` : null,
    summary.video_count ? `${summary.video_count} vidéo${summary.video_count > 1 ? 's' : ''}` : null,
  ].filter(Boolean);

  return (
    <Link
      to={`/album/${eventRef}`}
      onMouseEnter={prefetchAlbumPage}
      onTouchStart={prefetchAlbumPage}
      className="group relative block overflow-hidden rounded-3xl border border-white/10 bg-ddb-800 p-5 sm:p-6 shadow-lg transition-all hover:border-ddb-400/50 hover:shadow-xl"
    >
      {coverUrl && (
        <>
          <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-30 blur-[2px] scale-105 transition-transform duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-r from-ddb-900 via-ddb-900/85 to-ddb-900/40" />
        </>
      )}
      <div className="relative flex items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 text-ddb-200 ring-1 ring-white/15">
          <Images size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg sm:text-xl font-bold text-white">Album photos & vidéos</h3>
            {badge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80">
                <Lock size={11} /> {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/65">
            {summary.video_count > 0 && <Play size={12} className="flex-shrink-0" />}
            {parts.join(' · ')} — revivez l'événement
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ddb-900 transition-transform group-hover:translate-x-0.5">
          Voir l'album <ArrowRight size={16} />
        </span>
        <ArrowRight size={20} className="sm:hidden flex-shrink-0 text-white/70" />
      </div>
    </Link>
  );
};

export default EventAlbumTeaser;
