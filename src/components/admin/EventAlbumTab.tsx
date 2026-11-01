import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Images, Upload, Share2, ExternalLink, Lock, Users, UserCheck, Link2, Globe, Trash2, Play, Check, X, Loader2,
  AlertTriangle, HardDrive, ChevronLeft, ChevronRight, Download, RotateCcw, Bell, GripVertical, Send, type LucideIcon,
} from 'lucide-react';
import AlbumShareModal from './AlbumShareModal';
import AlbumNotifyModal from './AlbumNotifyModal';
import { logAdminActivity } from '../../utils/securityLog';
import {
  ACCESS_MODES, AlbumAccessMode, AlbumAccessRequest, AlbumMediaRow, AlbumSettings, ImageProcessor,
  MAX_VIDEO_MB, STORAGE_QUOTA_BYTES, albumFileName, albumShareUrl, createImageProcessor,
  deleteAlbumMedia, downloadSignedFile, ensureAlbum, formatBytes, formatDuration, getStorageUsage,
  listAccessRequests, listAlbumMedia, listAlbumShares, reorderAlbumMedia, signAlbumPaths, updateMediaCaption, uploadAlbumItem,
  validateAlbumFile,
} from '../../utils/albumMedia';

const UPLOAD_CONCURRENCY = 3;

const MODE_ICONS: Record<AlbumAccessMode, LucideIcon> = {
  restricted: Lock, participants: Users, attendees: UserCheck, link: Link2, public: Globe,
};

interface QueueItem {
  key: string;
  file: File;
  status: 'queued' | 'processing' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

interface EventAlbumTabProps {
  eventId: number;
  eventTitle: string;
  eventSlug?: string | null;
}

// ── Vignette mémoïsée : la grille ne se redessine pas à chaque % d'upload ──
const MediaTile = memo(function MediaTile({
  item, thumbUrl, selected, selectionMode, dragging,
  onOpen, onToggle, onDragStart, onDragEnter, onDragEnd,
}: {
  item: AlbumMediaRow;
  thumbUrl: string | undefined;
  selected: boolean;
  selectionMode: boolean;
  dragging: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      draggable={!selectionMode}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(item.id); }}
      onDragEnter={() => onDragEnter(item.id)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      className={`group relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer select-none transition-all ${
        selected ? 'ring-4 ring-green-500 ring-offset-1' : ''
      } ${dragging ? 'opacity-40 scale-95' : ''}`}
      onClick={() => (selectionMode ? onToggle(item.id) : onOpen(item.id))}
    >
      {item.placeholder && (
        <img src={item.placeholder} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-md scale-110" />
      )}
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={item.caption || item.original_name || ''}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${selected ? 'scale-90 rounded-lg' : ''}`}
        />
      ) : (
        !item.placeholder && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            {item.kind === 'video' ? <Play size={28} /> : <Images size={28} />}
          </div>
        )
      )}

      {item.kind === 'video' && (
        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/65 text-white text-[11px] font-semibold">
          <Play size={10} fill="currentColor" /> {formatDuration(item.duration) || 'Vidéo'}
        </span>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
        className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
          selected
            ? 'bg-green-600 border-green-600 text-white opacity-100'
            : 'bg-black/20 border-white text-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
        }`}
        aria-label={selected ? 'Désélectionner' : 'Sélectionner'}
      >
        <Check size={14} strokeWidth={3} />
      </button>

      {!selectionMode && (
        <span className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" title="Glisser pour réordonner">
          <GripVertical size={14} />
        </span>
      )}
    </div>
  );
});

export const EventAlbumTab: React.FC<EventAlbumTabProps> = ({ eventId, eventTitle, eventSlug }) => {
  const [settings, setSettings] = useState<AlbumSettings | null>(null);
  const [media, setMedia] = useState<AlbumMediaRow[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<AlbumAccessRequest[]>([]);
  const [usage, setUsage] = useState<{ total: number; albums: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifiedCount, setNotifiedCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const processorRef = useRef<ImageProcessor | null>(null);
  const pendingRef = useRef<QueueItem[]>([]);
  const runningRef = useRef(0);
  const nextPositionRef = useRef(0);
  const blobUrlsRef = useRef<string[]>([]);
  const mediaBeforeDragRef = useRef<AlbumMediaRow[] | null>(null);
  const mediaRef = useRef<AlbumMediaRow[]>([]);
  mediaRef.current = media;
  const dragIdRef = useRef<string | null>(null);
  const dragDepthRef = useRef(0);
  const mountedRef = useRef(true);

  const event = useMemo(() => ({ id: eventId, slug: eventSlug, title: eventTitle }), [eventId, eventSlug, eventTitle]);

  // ── Chargement ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, rows, reqs, shares] = await Promise.all([
        ensureAlbum(eventId), listAlbumMedia(eventId), listAccessRequests(eventId), listAlbumShares(eventId),
      ]);
      if (!mountedRef.current) return;
      setSettings(s);
      setMedia(rows);
      setRequests(reqs);
      setNotifiedCount(shares.filter((x) => x.notified_at).length);
      nextPositionRef.current = rows.reduce((max, r) => Math.max(max, r.position + 1), 0);
      const signed = await signAlbumPaths(rows.flatMap((r) => (r.thumb_path ? [r.thumb_path] : [])), 6 * 3600);
      if (!mountedRef.current) return;
      const urls: Record<string, string> = {};
      for (const r of rows) if (r.thumb_path && signed.has(r.thumb_path)) urls[r.id] = signed.get(r.thumb_path)!;
      setThumbUrls(urls);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        /relation|does not exist|schema cache/i.test(msg)
          ? "La migration 049_event_albums.sql n'a pas encore été exécutée dans Supabase."
          : "Impossible de charger l'album.",
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    getStorageUsage().then((u) => mountedRef.current && setUsage(u));
  }, [eventId]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const blobUrls = blobUrlsRef.current; // même tableau, alimenté pendant toute la vie du composant
    return () => {
      mountedRef.current = false;
      processorRef.current?.dispose();
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [load]);

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => mountedRef.current && setNotice(null), 3500);
  };

  // ── File d'envoi ──
  const updateItem = (key: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const runOne = async (item: QueueItem, position: number) => {
    processorRef.current ??= createImageProcessor();
    let lastPaint = 0;
    try {
      const { row, localThumbUrl } = await uploadAlbumItem(eventId, item.file, position, processorRef.current, (stage, ratio) => {
        const now = performance.now();
        if (ratio < 1 && now - lastPaint < 150) return; // limite les rendus
        lastPaint = now;
        updateItem(item.key, { status: stage, progress: ratio });
      });
      if (!mountedRef.current) return;
      if (localThumbUrl) {
        blobUrlsRef.current.push(localThumbUrl);
        setThumbUrls((m) => ({ ...m, [row.id]: localThumbUrl }));
      }
      setMedia((m) => [...m, row].sort((a, b) => a.position - b.position));
      updateItem(item.key, { status: 'done', progress: 1 });
    } catch (err) {
      updateItem(item.key, { status: 'error', error: err instanceof Error ? err.message : "Échec de l'envoi" });
    }
  };

  const pump = () => {
    while (runningRef.current < UPLOAD_CONCURRENCY && pendingRef.current.length) {
      const next = pendingRef.current.shift()!;
      runningRef.current++;
      runOne(next, nextPositionRef.current++).finally(() => {
        runningRef.current--;
        pump();
        if (runningRef.current === 0 && pendingRef.current.length === 0) {
          getStorageUsage().then((u) => mountedRef.current && setUsage(u));
          // Les envois réussis disparaissent de la liste, les erreurs restent
          setTimeout(() => mountedRef.current && setQueue((q) => q.filter((i) => i.status !== 'done')), 2500);
        }
      });
    }
  };

  const addFiles = (list: FileList | File[]) => {
    // Ordre de prise de vue approximatif (date de modification du fichier)
    const files = Array.from(list).sort((a, b) => a.lastModified - b.lastModified);
    const items: QueueItem[] = files.map((file) => {
      const err = validateAlbumFile(file);
      return { key: crypto.randomUUID(), file, status: err ? 'error' : 'queued', progress: 0, error: err ?? undefined };
    });
    if (items.length === 0) return;
    setQueue((q) => [...q, ...items]);
    pendingRef.current.push(...items.filter((i) => i.status === 'queued'));
    pump();
    logAdminActivity('album_upload', `events:${eventId}`, { count: items.length });
  };

  const retryItem = (item: QueueItem) => {
    if (validateAlbumFile(item.file)) return;
    const fresh = { ...item, status: 'queued' as const, progress: 0, error: undefined };
    updateItem(item.key, fresh);
    pendingRef.current.push(fresh);
    pump();
  };

  const activeUploads = queue.filter((i) => i.status === 'queued' || i.status === 'processing' || i.status === 'uploading');
  const uploading = activeUploads.length > 0;

  // Avertit avant de quitter la page pendant un envoi
  useEffect(() => {
    if (!uploading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [uploading]);

  // ── Glisser-déposer de fichiers depuis l'ordinateur ──
  const onZoneDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    dragDepthRef.current++;
    setDropActive(true);
  };
  const onZoneDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDropActive(false);
  };
  const onZoneDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.files?.length) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setDropActive(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Réordonnancement par glisser-déposer des vignettes ──
  const handleTileDragStart = useCallback((id: string) => {
    dragIdRef.current = id;
    mediaBeforeDragRef.current = mediaRef.current;
    setDragId(id);
  }, []);

  const handleTileDragEnter = useCallback((overId: string) => {
    const current = dragIdRef.current;
    if (!current || current === overId) return;
    setMedia((m) => {
      const from = m.findIndex((x) => x.id === current);
      const to = m.findIndex((x) => x.id === overId);
      if (from < 0 || to < 0) return m;
      const next = [...m];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleTileDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDragId(null);
    const before = mediaBeforeDragRef.current;
    mediaBeforeDragRef.current = null;
    const current = mediaRef.current;
    if (!before || before.map((x) => x.id).join() === current.map((x) => x.id).join()) return;
    const reordered = current.map((x, i) => ({ ...x, position: i }));
    setMedia(reordered);
    reorderAlbumMedia(eventId, reordered.map((x) => x.id)).catch(() => {
      setMedia(before); // annule si l'enregistrement échoue
      setError("Le nouvel ordre n'a pas pu être enregistré.");
    });
  }, [eventId]);

  // ── Sélection & suppression ──
  const toggleSelect = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openPreview = useCallback((id: string) => setPreviewId(id), []);

  const handleDelete = async (ids: string[]) => {
    setDeleting(true);
    const rows = media.filter((m) => ids.includes(m.id));
    const previous = media;
    setMedia((m) => m.filter((x) => !ids.includes(x.id))); // optimiste
    setSelected(new Set());
    setConfirmDelete(null);
    setPreviewId(null);
    try {
      await deleteAlbumMedia(rows);
      logAdminActivity('album_delete', `events:${eventId}`, { count: rows.length });
      flash(`${rows.length} fichier${rows.length > 1 ? 's' : ''} supprimé${rows.length > 1 ? 's' : ''}`);
      getStorageUsage().then((u) => mountedRef.current && setUsage(u));
    } catch {
      setMedia(previous);
      setError('La suppression a échoué.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Statistiques ──
  const photoCount = media.filter((m) => m.kind === 'image').length;
  const videoCount = media.length - photoCount;
  const albumBytes = media.reduce((acc, m) => acc + (m.size_bytes || 0), 0);
  const usageRatio = usage ? usage.total / STORAGE_QUOTA_BYTES : 0;
  const overallProgress = activeUploads.length
    ? activeUploads.reduce((acc, i) => acc + (i.status === 'uploading' ? i.progress : 0), 0) / activeUploads.length
    : 0;
  const doneCount = queue.filter((i) => i.status === 'done').length;
  const errorItems = queue.filter((i) => i.status === 'error');
  const selectionMode = selected.size > 0;

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Chargement de l'album…</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-800 mb-1">{error}</p>
        <button onClick={load} className="mt-3 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
          Réessayer
        </button>
      </div>
    );
  }

  const ModeIcon = MODE_ICONS[settings.general_access];

  return (
    <div
      className="space-y-5 relative"
      onDragEnter={onZoneDragEnter}
      onDragLeave={onZoneDragLeave}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDrop={onZoneDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/quicktime,video/webm,.mov,.m4v"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* ── En-tête ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Images size={22} className="text-green-600" /> Album photos & vidéos
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {photoCount} photo{photoCount !== 1 ? 's' : ''} · {videoCount} vidéo{videoCount !== 1 ? 's' : ''} · {formatBytes(albumBytes)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
            title={ACCESS_MODES[settings.general_access].description}
          >
            <ModeIcon size={15} className="text-gray-500" />
            <span className="max-w-[180px] truncate">{ACCESS_MODES[settings.general_access].label}</span>
          </button>
          <a
            href={albumShareUrl(event, settings)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink size={15} /> <span className="hidden sm:inline">Voir l'album</span>
          </a>
          <button
            onClick={() => setShareOpen(true)}
            className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 shadow-sm"
          >
            <Share2 size={15} /> Partager
            {requests.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                {requests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 shadow-sm"
          >
            <Upload size={15} /> Ajouter
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0" /> <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Fermer"><X size={16} /></button>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
          <Check size={16} /> {notice}
        </div>
      )}

      {requests.length > 0 && (
        <button
          onClick={() => setShareOpen(true)}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/70 transition-colors"
        >
          <Bell size={18} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-900 flex-1">
            <strong>{requests.length} demande{requests.length > 1 ? 's' : ''} d'accès</strong> en attente : {requests.slice(0, 2).map((r) => r.email).join(', ')}
            {requests.length > 2 ? '…' : ''}
          </span>
          <span className="text-sm font-semibold text-amber-800">Examiner</span>
        </button>
      )}

      {/* ── Envoi aux participants : lien personnel = accès en un clic, sans code ── */}
      {media.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
          <span className="w-11 h-11 rounded-xl bg-green-600 text-white flex items-center justify-center flex-shrink-0">
            <Send size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Envoyer l'album aux participants</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Chaque participant reçoit un lien personnel par email : accès en un clic, sans code.
              {notifiedCount > 0 && <span className="font-medium text-green-700"> Déjà notifiées : {notifiedCount} personne{notifiedCount > 1 ? 's' : ''}.</span>}
            </p>
          </div>
          <button
            onClick={() => setNotifyOpen(true)}
            disabled={uploading}
            title={uploading ? "Attendez la fin de l'envoi des fichiers" : undefined}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex-shrink-0"
          >
            <Send size={15} /> {notifiedCount > 0 ? 'Envoyer aux nouveaux…' : 'Envoyer…'}
          </button>
        </div>
      )}

      {/* ── Jauge de stockage (plan gratuit Supabase : 1 Go) ── */}
      {usage && (
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-sm mb-2">
            <span className="flex items-center gap-2 text-gray-700 font-medium">
              <HardDrive size={16} className="text-gray-400" /> Stockage Supabase
            </span>
            <span className="text-gray-500 text-xs sm:text-sm">
              {formatBytes(usage.total)} / 1 Go <span className="hidden sm:inline">· albums : {formatBytes(usage.albums)}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usageRatio > 0.9 ? 'bg-red-500' : usageRatio > 0.75 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, usageRatio * 100).toFixed(1)}%` }}
            />
          </div>
          {usageRatio > 0.75 && (
            <p className="text-xs text-amber-700 mt-2">
              L'espace gratuit est presque plein. Téléchargez les anciens albums puis supprimez les vidéos les plus lourdes.
            </p>
          )}
        </div>
      )}

      {/* ── Progression des envois ── */}
      {queue.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-3">
          {uploading && (
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium text-gray-800 flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin text-green-600" />
                  Envoi en cours — {doneCount}/{doneCount + activeUploads.length}
                </span>
                <span className="text-xs text-gray-500">Ne fermez pas cette page</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${(((doneCount + overallProgress * activeUploads.length) / (doneCount + activeUploads.length)) * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          )}
          {!uploading && doneCount > 0 && errorItems.length === 0 && (
            <p className="text-sm text-green-700 flex items-center gap-2"><Check size={16} /> {doneCount} fichier{doneCount > 1 ? 's' : ''} ajouté{doneCount > 1 ? 's' : ''}</p>
          )}
          {errorItems.length > 0 && (
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {errorItems.map((i) => (
                <li key={i.key} className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 break-all">{i.file.name}</span>
                    <span className="block text-xs text-red-600">{i.error}</span>
                  </span>
                  {!validateAlbumFile(i.file) && (
                    <button onClick={() => retryItem(i)} className="p-1 text-gray-500 hover:text-green-700" title="Réessayer">
                      <RotateCcw size={15} />
                    </button>
                  )}
                  <button onClick={() => setQueue((q) => q.filter((x) => x.key !== i.key))} className="p-1 text-gray-400 hover:text-gray-700" title="Ignorer">
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Barre de sélection ── */}
      {selectionMode && (
        <div className="sticky top-28 z-10 flex items-center justify-between gap-3 p-3 rounded-2xl bg-gray-900 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Annuler la sélection"><X size={18} /></button>
            <span className="text-sm font-semibold">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set(media.map((m) => m.id)))}
              className="px-3 py-1.5 rounded-lg text-sm hover:bg-white/10 hidden sm:block"
            >
              Tout sélectionner
            </button>
            <button
              onClick={() => setConfirmDelete([...selected])}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold"
            >
              <Trash2 size={15} /> Supprimer
            </button>
          </div>
        </div>
      )}

      {/* ── Grille ── */}
      {media.length === 0 && !uploading ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-16 px-6 border-2 border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50/40 rounded-3xl text-center transition-colors"
        >
          <div className="w-16 h-16 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
            <Upload size={30} />
          </div>
          <p className="text-base font-bold text-gray-800">Glissez vos photos et vidéos ici</p>
          <p className="text-sm text-gray-500 mt-1">ou cliquez pour les sélectionner</p>
          <p className="text-xs text-gray-400 mt-4 max-w-md mx-auto">
            Les photos sont optimisées automatiquement (2048 px, ~400 Ko, position GPS supprimée).
            Vidéos MP4/MOV/WebM jusqu'à {MAX_VIDEO_MB} Mo.
          </p>
        </button>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 sm:gap-2">
          {media.map((m) => (
            <MediaTile
              key={m.id}
              item={m}
              thumbUrl={thumbUrls[m.id]}
              selected={selected.has(m.id)}
              selectionMode={selectionMode}
              dragging={dragId === m.id}
              onOpen={openPreview}
              onToggle={toggleSelect}
              onDragStart={handleTileDragStart}
              onDragEnter={handleTileDragEnter}
              onDragEnd={handleTileDragEnd}
            />
          ))}
          {activeUploads.map((i) => (
            <div key={i.key} className="relative aspect-square rounded-xl bg-gray-100 overflow-hidden flex flex-col items-center justify-center gap-2 p-2">
              <Loader2 size={18} className="text-green-600 animate-spin" />
              <span className="text-[10px] text-gray-500 font-medium">
                {i.status === 'queued' ? 'En attente' : i.status === 'processing' ? 'Optimisation…' : `${Math.round(i.progress * 100)} %`}
              </span>
              <div className="absolute bottom-0 inset-x-0 h-1 bg-gray-200">
                <div className="h-full bg-green-500 transition-all duration-200" style={{ width: `${i.progress * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {media.length > 1 && (
        <p className="text-xs text-gray-400 hidden sm:block">Astuce : glissez une vignette pour changer l'ordre d'affichage dans l'album.</p>
      )}

      {/* ── Zone de dépôt plein cadre ── */}
      {dropActive && (
        <div className="fixed inset-0 z-40 bg-green-600/15 backdrop-blur-[2px] border-4 border-dashed border-green-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-6 text-center">
            <Upload size={32} className="text-green-600 mx-auto mb-2" />
            <p className="font-bold text-gray-800">Déposez pour ajouter à l'album</p>
          </div>
        </div>
      )}

      {/* ── Aperçu ── */}
      {previewId && (
        <AdminPreview
          media={media}
          currentId={previewId}
          thumbUrls={thumbUrls}
          eventTitle={eventTitle}
          onNavigate={setPreviewId}
          onClose={() => setPreviewId(null)}
          onDelete={(id) => setConfirmDelete([id])}
          onCaptionSaved={(id, caption) => setMedia((m) => m.map((x) => (x.id === id ? { ...x, caption: caption || null } : x)))}
        />
      )}

      {/* ── Confirmation de suppression ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-3"><Trash2 size={22} /></div>
            <h3 className="text-lg font-bold text-gray-900">
              Supprimer {confirmDelete.length > 1 ? `${confirmDelete.length} fichiers` : 'ce fichier'} ?
            </h3>
            <p className="text-sm text-gray-500 mt-1">Suppression définitive de l'album et du stockage. Cette action est irréversible.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">Annuler</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {notifyOpen && (
        <AlbumNotifyModal
          eventId={eventId}
          eventTitle={eventTitle}
          accessMode={settings.general_access}
          onClose={() => setNotifyOpen(false)}
          onSent={() => listAlbumShares(eventId).then((s) => mountedRef.current && setNotifiedCount(s.filter((x) => x.notified_at).length)).catch(() => {})}
        />
      )}

      {shareOpen && (
        <AlbumShareModal
          event={event}
          settings={settings}
          requests={requests}
          onSettingsChange={setSettings}
          onRequestsChange={setRequests}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
};

// ── Aperçu admin : image HD / vidéo, légende, navigation ──
const AdminPreview: React.FC<{
  media: AlbumMediaRow[];
  currentId: string;
  thumbUrls: Record<string, string>;
  eventTitle: string;
  onNavigate: (id: string) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onCaptionSaved: (id: string, caption: string) => void;
}> = ({ media, currentId, thumbUrls, eventTitle, onNavigate, onClose, onDelete, onCaptionSaved }) => {
  const index = media.findIndex((m) => m.id === currentId);
  const item = media[index];
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const requestedRef = useRef<Set<string>>(new Set());
  const [caption, setCaption] = useState(item?.caption || '');
  const [savingCaption, setSavingCaption] = useState(false);

  useEffect(() => setCaption(item?.caption || ''), [item?.id, item?.caption]);

  // Signe à la demande la version HD de l'élément courant et de ses voisins
  useEffect(() => {
    const wanted = [media[index - 1], media[index], media[index + 1]].filter(
      (m): m is AlbumMediaRow => !!m && !requestedRef.current.has(m.id),
    );
    if (wanted.length === 0) return;
    wanted.forEach((m) => requestedRef.current.add(m.id));
    signAlbumPaths(wanted.map((m) => m.path), 3600).then((map) => {
      setFullUrls((prev) => {
        const next = { ...prev };
        for (const m of wanted) if (map.has(m.path)) next[m.id] = map.get(m.path)!;
        return next;
      });
    });
  }, [index, media]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(media[index - 1].id);
      if (e.key === 'ArrowRight' && index < media.length - 1) onNavigate(media[index + 1].id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, media, onClose, onNavigate]);

  if (!item) return null;
  const full = fullUrls[item.id];

  const saveCaption = async () => {
    if ((item.caption || '') === caption.trim()) return;
    setSavingCaption(true);
    try {
      await updateMediaCaption(item.id, caption);
      onCaptionSaved(item.id, caption.trim());
    } finally {
      setSavingCaption(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm text-white/70">{index + 1} / {media.length}</span>
        <div className="flex items-center gap-1">
          {full && (
            <button
              onClick={() => downloadSignedFile(full, albumFileName(eventTitle, index, item))}
              className="p-2.5 rounded-full hover:bg-white/10" title="Télécharger"
            >
              <Download size={19} />
            </button>
          )}
          <button onClick={() => onDelete(item.id)} className="p-2.5 rounded-full hover:bg-white/10 text-red-300" title="Supprimer">
            <Trash2 size={19} />
          </button>
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-white/10" aria-label="Fermer"><X size={21} /></button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center min-h-0 px-2 sm:px-16" onClick={(e) => e.stopPropagation()}>
        {item.kind === 'video' ? (
          full ? (
            <video key={item.id} src={full} poster={thumbUrls[item.id]} controls autoPlay playsInline className="max-w-full max-h-full rounded-lg" />
          ) : (
            <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
          )
        ) : (
          <img
            key={item.id}
            src={full || thumbUrls[item.id] || item.placeholder || ''}
            alt={item.caption || ''}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        )}
        {index > 0 && (
          <button onClick={() => onNavigate(media[index - 1].id)} className="absolute left-2 sm:left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Précédent">
            <ChevronLeft size={22} />
          </button>
        )}
        {index < media.length - 1 && (
          <button onClick={() => onNavigate(media[index + 1].id)} className="absolute right-2 sm:right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Suivant">
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      <div className="px-4 py-3 max-w-2xl w-full mx-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={saveCaption}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            maxLength={300}
            placeholder="Ajouter une légende…"
            className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white placeholder-white/40 text-sm outline-none focus:border-green-400"
          />
          {savingCaption && <Loader2 size={16} className="text-white/60 animate-spin" />}
        </div>
        <p className="text-[11px] text-white/40 mt-1.5 truncate">
          {item.original_name} · {formatBytes(item.size_bytes)}{item.width ? ` · ${item.width}×${item.height}` : ''}
        </p>
      </div>
    </div>
  );
};
