import { supabase } from '../supabaseClient';
import {
  processImage, ProcessedImage, fitWithin, resizeStepwise, encodeThumb, makePlaceholder, THUMB_MAX_EDGE,
} from './albumImageCore';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const ALBUM_BUCKET = 'event-albums';
/** Limite par fichier du plan gratuit Supabase (aussi fixée sur le bucket). */
export const MAX_VIDEO_MB = 50;
/** Taille max d'une photo brute avant compression (elle sera réduite à ~500 Ko). */
export const MAX_IMAGE_SOURCE_MB = 40;
/** Quota de stockage total du plan gratuit Supabase. */
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;
/** Au-delà, le ZIP est découpé en plusieurs parties (mémoire limitée sur mobile). */
const ZIP_PART_MAX_BYTES = 150 * 1024 * 1024;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlbumAccessMode = 'restricted' | 'participants' | 'attendees' | 'link' | 'public';

export const ACCESS_MODES: Record<AlbumAccessMode, { label: string; description: string }> = {
  restricted: {
    label: 'Limité',
    description: "Seules les personnes ajoutées peuvent ouvrir l'album",
  },
  participants: {
    label: 'Participants inscrits',
    description: "Toute personne inscrite à l'événement peut ouvrir l'album (vérification par email)",
  },
  attendees: {
    label: 'Participants présents',
    description: "Seules les personnes dont le billet a été scanné à l'entrée (vérification par email)",
  },
  link: {
    label: 'Tous les utilisateurs disposant du lien',
    description: "Toute personne sur Internet disposant du lien peut ouvrir l'album",
  },
  public: {
    label: 'Public',
    description: "Visible par tous, directement depuis la page de l'événement",
  },
};

export interface AlbumSettings {
  event_id: number;
  general_access: AlbumAccessMode;
  allow_download: boolean;
  link_key: string;
}

export interface AlbumMediaRow {
  id: string;
  event_id: number;
  kind: 'image' | 'video';
  path: string;
  thumb_path: string | null;
  placeholder: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  size_bytes: number;
  mime_type: string | null;
  original_name: string | null;
  caption: string | null;
  position: number;
  created_at: string;
  /** URLs signées mémorisées 7 jours (migration 051), communes à tous. */
  signed_url?: string | null;
  signed_thumb_url?: string | null;
  signed_until?: string | null;
}

export interface AlbumShare {
  id: string;
  email: string;
  role: 'viewer';
  notified_at: string | null;
  created_at: string;
}

export interface AlbumAccessRequest {
  id: string;
  email: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface PublicAlbumEvent {
  id: number;
  slug: string | null;
  title: string;
  event_date: string;
  location: string | null;
  image_url: string | null;
}

export interface PublicMediaItem {
  id: string;
  kind: 'image' | 'video';
  url: string;
  thumb_url: string | null;
  placeholder: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  size: number;
  mime: string | null;
  caption: string | null;
}

export type AlbumOpenResponse =
  | { status: 'not_found'; event?: PublicAlbumEvent }
  | {
      status: 'granted' | 'empty';
      event: PublicAlbumEvent;
      album: { general_access: AlbumAccessMode; allow_download: boolean };
      viewer: { email: string } | null;
      expires_at: string;
      media: PublicMediaItem[];
      token?: string;
    }
  | {
      status: 'locked';
      event: PublicAlbumEvent;
      access_mode: Exclude<AlbumAccessMode, 'link'>;
      viewer: { email: string } | null;
      request_pending: boolean;
      token?: string;
      token_invalid?: boolean;
    };

// ─── Edge Function ───────────────────────────────────────────────────────────

export class AlbumApiError extends Error {
  code: string;
  payload: Record<string, unknown> | null;
  constructor(code: string, payload: Record<string, unknown> | null = null) {
    super(code);
    this.code = code;
    this.payload = payload;
  }
}

export const callAlbumFunction = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('album-access', { body });
  if (error) {
    let payload: Record<string, unknown> | null = null;
    try {
      payload = await (error as { context?: Response }).context?.json();
    } catch {
      /* corps non JSON */
    }
    throw new AlbumApiError(String(payload?.error || 'network'), payload);
  }
  return data as T;
};

// ─── URLs ────────────────────────────────────────────────────────────────────

/** Adresse courte et lisible : /album/forum-jeunesse-2026 */
export const albumPagePath = (event: { slug?: string | null; id: number | string }) =>
  `/album/${encodeURIComponent(event.slug || String(event.id))}`;

/** En mode "lien" : /album/forum-jeunesse-2026?cle=k7mq2xpa9c */
export const albumShareUrl = (
  event: { slug?: string | null; id: number | string },
  settings?: Pick<AlbumSettings, 'general_access' | 'link_key'>,
) => {
  const base = `${window.location.origin}${albumPagePath(event)}`;
  return settings?.general_access === 'link' ? `${base}?cle=${settings.link_key}` : base;
};

const extensionForMime = (mime: string | null | undefined, kind: 'image' | 'video') => {
  if (mime === 'video/quicktime') return 'mov';
  if (mime === 'video/webm') return 'webm';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return kind === 'video' ? 'mp4' : 'jpg';
};

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'album';

/** Nom de fichier lisible et trié : "forum-jeunesse-2026-007.jpg". */
export const albumFileName = (
  eventTitle: string,
  index: number,
  item: { kind: 'image' | 'video'; mime?: string | null; mime_type?: string | null },
) => `${slugify(eventTitle)}-${String(index + 1).padStart(3, '0')}.${extensionForMime(item.mime ?? item.mime_type, item.kind)}`;

/**
 * Téléchargement direct. L'attribut `download` d'un <a> est ignoré pour une
 * URL d'un autre domaine : on demande à Supabase d'envoyer l'en-tête
 * Content-Disposition via le paramètre `download` de l'URL signée.
 */
export const downloadSignedFile = (signedUrl: string, fileName: string) => {
  const a = document.createElement('a');
  a.href = `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(fileName)}`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// ─── Traitement des fichiers (photos : Web Workers, vidéos : miniature) ──────

export interface ImageProcessor {
  run: (file: Blob) => Promise<ProcessedImage>;
  dispose: () => void;
}

const mainThreadCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * Pool de 1 à 3 Web Workers (selon les cœurs du processeur). Repli automatique
 * sur le thread principal si les workers/OffscreenCanvas ne sont pas disponibles
 * (anciens Safari) ou si un worker plante.
 *
 * Mémoire : une photo de 48 Mpx décodée occupe ~190 Mo. Sur un appareil de
 * 4 Go de RAM ou moins, un seul traitement à la fois pour éviter le crash de
 * l'onglet ; idem sur le thread principal (traitement en file).
 */
export const createImageProcessor = (): ImageProcessor => {
  const canUseWorkers = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const lowMemory = typeof deviceMemory === 'number' && deviceMemory <= 4;
  const poolSize = lowMemory ? 1 : Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
  const workers: Worker[] = [];
  const idle: Worker[] = [];
  const waiting: Array<() => void> = [];
  let workersBroken = !canUseWorkers;
  let seq = 0;
  let mainThreadQueue: Promise<unknown> = Promise.resolve();

  /** Thread principal : une photo à la fois (mémoire + interface réactive). */
  const runOnMainThread = (file: Blob) => {
    const job = mainThreadQueue.then(() => processImage(file, mainThreadCanvas));
    mainThreadQueue = job.catch(() => undefined);
    return job;
  };

  const acquire = async (): Promise<Worker> => {
    for (;;) {
      const free = idle.pop();
      if (free) return free;
      if (workers.length < poolSize) {
        const w = new Worker(new URL('../workers/albumImage.worker.ts', import.meta.url), { type: 'module' });
        workers.push(w);
        return w;
      }
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
  };

  const release = (w: Worker) => {
    idle.push(w);
    waiting.shift()?.();
  };

  const runInWorker = (w: Worker, file: Blob) =>
    new Promise<ProcessedImage>((resolve, reject) => {
      const id = ++seq;
      const cleanup = () => {
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
      };
      const onMessage = (e: MessageEvent) => {
        if (e.data?.id !== id) return;
        cleanup();
        if (e.data.ok) resolve(e.data.result as ProcessedImage);
        else reject(new Error(e.data.error));
      };
      const onError = (e: ErrorEvent) => {
        cleanup();
        workersBroken = true; // script du worker non chargé (CSP, navigateur...) → thread principal
        reject(new Error(e.message || 'worker'));
      };
      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError);
      w.postMessage({ id, file });
    });

  return {
    async run(file) {
      if (!workersBroken) {
        const w = await acquire();
        try {
          return await runInWorker(w, file);
        } catch {
          // Échec dans le worker : on retente sur le thread principal, qui sait
          // parfois décoder ce que le worker ne sait pas (ex. HEIC sur Safari).
        } finally {
          release(w);
        }
      }
      return runOnMainThread(file);
    },
    dispose() {
      workers.forEach((w) => w.terminate());
      workers.length = 0;
      idle.length = 0;
    },
  };
};

export interface ProcessedVideo {
  thumb: Blob | null;
  placeholder: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
}

const waitForEvent = (el: HTMLMediaElement, event: string, timeoutMs = 15000) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      el.removeEventListener(event, onEvent);
      reject(new Error('timeout'));
    }, timeoutMs);
    const onEvent = () => {
      clearTimeout(timer);
      resolve();
    };
    el.addEventListener(event, onEvent, { once: true });
  });

/**
 * Extrait durée, dimensions et une image (à ~10 % de la vidéo) pour la miniature.
 * Ne bloque jamais l'import : si le navigateur ne lit pas le codec (ex. HEVC
 * d'iPhone sous Chrome), la vidéo est quand même envoyée, sans miniature.
 */
export const processVideo = async (file: File): Promise<ProcessedVideo> => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await waitForEvent(video, 'loadedmetadata');
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    const width = video.videoWidth || null;
    const height = video.videoHeight || null;
    if (!width || !height) return { thumb: null, placeholder: null, width, height, duration };

    try {
      video.currentTime = Math.min(1.5, (duration || 1) * 0.1);
      await waitForEvent(video, 'seeked');
      const [tw, th] = fitWithin(width, height, THUMB_MAX_EDGE);
      const canvas = resizeStepwise(video, width, height, tw, th, mainThreadCanvas);
      const thumb = await encodeThumb(canvas);
      const placeholder = await makePlaceholder(canvas, tw, th, mainThreadCanvas);
      return { thumb, placeholder, width, height, duration };
    } catch {
      return { thumb: null, placeholder: null, width, height, duration };
    }
  } catch {
    return { thumb: null, placeholder: null, width: null, height: null, duration: null };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
};

const VIDEO_EXT_MIME: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
};

export const detectMediaKind = (file: File): 'image' | 'video' | null => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.type.startsWith('video/') || ext in VIDEO_EXT_MIME) return 'video';
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)) return 'image';
  return null;
};

const videoMime = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXT_MIME[ext] || (['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) ? file.type : 'video/mp4');
};

/** Vérifie un fichier avant traitement. Retourne un message d'erreur, ou null. */
export const validateAlbumFile = (file: File): string | null => {
  const kind = detectMediaKind(file);
  if (!kind) return 'Type de fichier non pris en charge (photos JPEG/PNG/WebP, vidéos MP4/MOV/WebM)';
  const mb = file.size / (1024 * 1024);
  if (kind === 'video' && mb > MAX_VIDEO_MB) {
    return `Vidéo trop lourde (${mb.toFixed(0)} Mo) : ${MAX_VIDEO_MB} Mo max sur le plan gratuit. Compressez-la (ex. HandBrake, préréglage « Fast 1080p30 ») ou découpez-la.`;
  }
  if (kind === 'image' && mb > MAX_IMAGE_SOURCE_MB) {
    return `Photo trop lourde (${mb.toFixed(0)} Mo, max ${MAX_IMAGE_SOURCE_MB} Mo)`;
  }
  return null;
};

// ─── Upload avec progression + nouvelles tentatives ──────────────────────────

class UploadError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Upload direct vers l'API Storage en XHR : contrairement à supabase-js, XHR
 * expose la progression, indispensable pour les vidéos de plusieurs dizaines
 * de Mo. Fichiers immuables (chemin unique) → cache navigateur/CDN d'un an.
 */
const uploadWithProgress = async (
  path: string,
  blob: Blob,
  contentType: string,
  onProgress?: (loaded: number) => void,
): Promise<void> => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new UploadError(401, 'Session expirée : reconnectez-vous.');

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${ALBUM_BUCKET}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('Cache-Control', 'max-age=31536000');
    xhr.setRequestHeader('x-upsert', 'true'); // rend les nouvelles tentatives sans risque
    xhr.upload.onprogress = (e) => onProgress?.(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let message = `Erreur d'envoi (${xhr.status})`;
        try {
          message = JSON.parse(xhr.responseText)?.message || message;
        } catch {
          /* réponse non JSON */
        }
        reject(new UploadError(xhr.status, message));
      }
    };
    xhr.onerror = () => reject(new UploadError(0, 'Connexion interrompue'));
    xhr.send(blob);
  });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 3 tentatives avec attente croissante, uniquement pour les erreurs réseau / serveur. */
const withRetry = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const status = err instanceof UploadError ? err.status : 0;
      const retryable = status === 0 || status === 429 || status >= 500;
      if (!retryable || i >= attempts - 1) throw err;
      await sleep(800 * 2 ** i);
    }
  }
};

export type UploadStage = 'processing' | 'uploading';

export interface UploadedAlbumItem {
  row: AlbumMediaRow;
  /** URL locale (blob:) de la miniature : affichage immédiat sans re-téléchargement. */
  localThumbUrl: string | null;
}

export const uploadAlbumItem = async (
  eventId: number,
  file: File,
  position: number,
  processor: ImageProcessor,
  onProgress: (stage: UploadStage, ratio: number) => void,
): Promise<UploadedAlbumItem> => {
  const kind = detectMediaKind(file);
  if (!kind) throw new Error('Type de fichier non pris en charge');

  onProgress('processing', 0);
  let main: Blob;
  let mainMime: string;
  let thumb: Blob | null;
  let placeholder: string | null;
  let width: number | null;
  let height: number | null;
  let duration: number | null = null;

  if (kind === 'image') {
    const r = await processor.run(file);
    main = r.full;
    mainMime = 'image/jpeg';
    ({ thumb, placeholder, width, height } = r);
  } else {
    const r = await processVideo(file);
    main = file;
    mainMime = videoMime(file);
    ({ thumb, placeholder, width, height, duration } = r);
  }

  const id = crypto.randomUUID();
  const base = `${eventId}/${id}`;
  const path = kind === 'image' ? `${base}/photo.jpg` : `${base}/video.${extensionForMime(mainMime, 'video')}`;
  const thumbPath = thumb ? `${base}/thumb.${thumb.type === 'image/webp' ? 'webp' : 'jpg'}` : null;

  const total = main.size + (thumb?.size ?? 0);
  let thumbLoaded = 0;
  let mainLoaded = 0;
  const report = () => onProgress('uploading', total ? Math.min(1, (thumbLoaded + mainLoaded) / total) : 1);
  report();

  // Miniature d'abord : elle s'affiche dans la grille dès la fin de l'envoi
  if (thumb && thumbPath) {
    const t = thumb;
    await withRetry(() => uploadWithProgress(thumbPath, t, t.type, (l) => { thumbLoaded = l; report(); }));
  }
  await withRetry(() => uploadWithProgress(path, main, mainMime, (l) => { mainLoaded = l; report(); }));

  const { data, error } = await supabase
    .from('event_media')
    .insert({
      id,
      event_id: eventId,
      kind,
      path,
      thumb_path: thumbPath,
      placeholder,
      width,
      height,
      duration,
      size_bytes: total,
      mime_type: mainMime,
      original_name: file.name.slice(0, 200),
      position,
    })
    .select('*')
    .single();

  if (error || !data) {
    // Pas de fichier orphelin si l'enregistrement en base échoue
    await supabase.storage.from(ALBUM_BUCKET).remove([path, ...(thumbPath ? [thumbPath] : [])]);
    throw new Error(error?.message || "Échec de l'enregistrement");
  }

  return { row: data as AlbumMediaRow, localThumbUrl: thumb ? URL.createObjectURL(thumb) : null };
};

// ─── Administration (RLS : admin / charge_communication) ─────────────────────

export const ensureAlbum = async (eventId: number): Promise<AlbumSettings> => {
  await supabase.from('event_albums').upsert({ event_id: eventId }, { onConflict: 'event_id', ignoreDuplicates: true });
  const { data, error } = await supabase
    .from('event_albums')
    .select('event_id, general_access, allow_download, link_key')
    .eq('event_id', eventId)
    .single();
  if (error || !data) throw new Error(error?.message || 'Album introuvable');
  return data as AlbumSettings;
};

export const updateAlbumSettings = async (
  eventId: number,
  patch: Partial<Pick<AlbumSettings, 'general_access' | 'allow_download' | 'link_key'>>,
) => {
  const { error } = await supabase
    .from('event_albums')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
};

/** 32 caractères sans l/o/0/1, ambigus à l'écrit comme à l'oral (même alphabet que gen_short_key en SQL). */
const KEY_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/**
 * Nouvelle clé courte (10 caractères = 50 bits aléatoires) : l'ancien lien
 * "Tous les utilisateurs disposant du lien" cesse de fonctionner.
 */
export const newLinkKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => KEY_ALPHABET[b & 31]).join('');
};

export const listAlbumMedia = async (eventId: number): Promise<AlbumMediaRow[]> => {
  const { data, error } = await supabase
    .from('event_media')
    .select('*')
    .eq('event_id', eventId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AlbumMediaRow[];
};

/** URLs signées en lot (1 requête pour 500 fichiers). */
export const signAlbumPaths = async (paths: string[], expiresInSec = 3600): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 500) {
    const { data } = await supabase.storage.from(ALBUM_BUCKET).createSignedUrls(paths.slice(i, i + 500), expiresInSec);
    for (const d of data ?? []) if (d.signedUrl && d.path) map.set(d.path, d.signedUrl);
  }
  return map;
};

// Mêmes règles que l'Edge Function album-access (migration 051)
const SIGNED_TTL_SEC = 7 * 86400;
const SIGNED_REFRESH_MS = 2 * 86400_000;

/**
 * URLs (HD + miniature) pour l'admin. Réutilise les URLs mémorisées en base —
 * identiques à celles des visiteurs, donc déjà dans le cache du navigateur — et
 * ne signe que les fichiers nouveaux ou dont l'URL expire bientôt, puis les
 * mémorise pour tout le monde.
 */
export const resolveAlbumUrls = async (
  rows: AlbumMediaRow[],
): Promise<Map<string, { url: string; thumb: string | null }>> => {
  const now = Date.now();
  const result = new Map<string, { url: string; thumb: string | null }>();
  const stale: AlbumMediaRow[] = [];
  for (const r of rows) {
    const fresh = r.signed_url && r.signed_until
      && new Date(r.signed_until).getTime() - now > SIGNED_REFRESH_MS
      && (!r.thumb_path || r.signed_thumb_url);
    if (fresh) result.set(r.id, { url: r.signed_url!, thumb: r.signed_thumb_url ?? null });
    else stale.push(r);
  }
  if (stale.length === 0) return result;

  const signed = await signAlbumPaths(stale.flatMap((r) => (r.thumb_path ? [r.path, r.thumb_path] : [r.path])), SIGNED_TTL_SEC);
  const until = new Date(now + SIGNED_TTL_SEC * 1000).toISOString();
  const updates: { id: string; url: string; thumb_url: string | null; until: string }[] = [];
  for (const r of stale) {
    const url = signed.get(r.path);
    if (!url) continue;
    const thumb = r.thumb_path ? signed.get(r.thumb_path) ?? null : null;
    result.set(r.id, { url, thumb });
    updates.push({ id: r.id, url, thumb_url: thumb, until });
  }
  if (updates.length) {
    // Best-effort : sans la migration 051, l'admin signe simplement à chaque chargement
    supabase.rpc('store_event_media_signed_urls', { p_rows: updates }).then(() => undefined, () => undefined);
  }
  return result;
};

export const deleteAlbumMedia = async (rows: Pick<AlbumMediaRow, 'id' | 'path' | 'thumb_path'>[]) => {
  if (rows.length === 0) return;
  const paths = rows.flatMap((r) => [r.path, ...(r.thumb_path ? [r.thumb_path] : [])]);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(ALBUM_BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from('event_media').delete().in('id', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
};

/**
 * À appeler AVANT de supprimer un événement : la suppression en cascade efface
 * les lignes en base, mais pas les fichiers du Storage.
 */
export const purgeEventAlbum = async (eventId: number): Promise<number> => {
  const { data } = await supabase.from('event_media').select('id, path, thumb_path').eq('event_id', eventId);
  const rows = data ?? [];
  await deleteAlbumMedia(rows);
  return rows.length;
};

export const reorderAlbumMedia = async (eventId: number, orderedIds: string[]) => {
  const { error } = await supabase.rpc('reorder_event_media', { p_event_id: eventId, p_ids: orderedIds });
  if (error) throw new Error(error.message);
};

export const updateMediaCaption = async (id: string, caption: string) => {
  const { error } = await supabase.from('event_media').update({ caption: caption.trim() || null }).eq('id', id);
  if (error) throw new Error(error.message);
};

export const listAlbumShares = async (eventId: number): Promise<AlbumShare[]> => {
  const { data, error } = await supabase
    .from('event_album_shares')
    .select('id, email, role, notified_at, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AlbumShare[];
};

export const removeAlbumShare = async (id: string) => {
  const { error } = await supabase.from('event_album_shares').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

export const listAccessRequests = async (eventId: number): Promise<AlbumAccessRequest[]> => {
  const { data, error } = await supabase
    .from('event_album_access_requests')
    .select('id, email, message, status, created_at')
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AlbumAccessRequest[];
};

export const rejectAccessRequest = async (id: string) => {
  const { error } = await supabase
    .from('event_album_access_requests')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
};

export const inviteToAlbum = (
  eventId: number,
  emails: string[],
  notify: boolean,
  message?: string,
  template?: 'participants',
) =>
  callAlbumFunction<{ ok: boolean; added: number; notified: number; failed?: string[]; simulated: boolean }>({
    action: 'invite', event_id: eventId, emails, notify, message, template,
  });

/** Adresse factice utilisée pour les inscriptions sur place sans email. */
const VISITOR_EMAIL = 'visiteur@ong-ddb.org';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface ParticipantContact {
  email: string;
  /** Nom du billet ; null si l'adresse n'est que celle de l'acheteur d'une réservation groupée. */
  name: string | null;
  /** Au moins un billet lié à cette adresse a été scanné à l'entrée. */
  scanned: boolean;
  tickets: number;
}

/**
 * Contacts des participants d'un événement (email du billet + email de
 * l'acheteur pour les réservations groupées), dédoublonnés par adresse.
 */
export const listParticipantContacts = async (eventId: number): Promise<ParticipantContact[]> => {
  const byEmail = new Map<string, ParticipantContact>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('email, fullname, custom_data, scanned_at')
      .eq('event_id', eventId)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    type Row = { email: string | null; fullname: string | null; custom_data: Record<string, unknown> | null; scanned_at: string | null };
    for (const r of (data ?? []) as Row[]) {
      const seenInRow = new Set<string>(); // billet de l'acheteur : email = buyer_email, compté une fois
      for (const [raw, isOwnTicket] of [[r.email, true], [r.custom_data?.buyer_email, false]] as const) {
        const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (!email || email === VISITOR_EMAIL || !EMAIL_RE.test(email) || seenInRow.has(email)) continue;
        seenInRow.add(email);
        const contact = byEmail.get(email) ?? { email, name: null, scanned: false, tickets: 0 };
        if (isOwnTicket && !contact.name && r.fullname?.trim()) contact.name = r.fullname.trim();
        contact.scanned ||= !!r.scanned_at;
        contact.tickets++;
        byEmail.set(email, contact);
      }
    }
    if (!data || data.length < PAGE) break;
  }
  return [...byEmail.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'fr'));
};

export interface BulkSendResult {
  sent: number;
  failed: string[];
  simulated: boolean;
}

/**
 * Envoie à chaque participant son lien personnel (accès en un clic, sans code).
 * Par lots de 20 : chaque appel reste court (l'API Gmail limite le débit) et
 * la progression s'affiche au fil de l'eau.
 */
export const sendAlbumToParticipants = async (
  eventId: number,
  emails: string[],
  message: string,
  onProgress: (done: number, total: number) => void,
): Promise<BulkSendResult> => {
  const BATCH = 20;
  const result: BulkSendResult = { sent: 0, failed: [], simulated: false };
  onProgress(0, emails.length);
  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    try {
      const r = await inviteToAlbum(eventId, batch, true, message, 'participants');
      result.sent += r.notified;
      result.failed.push(...(r.failed ?? []));
      result.simulated ||= r.simulated;
    } catch {
      result.failed.push(...batch);
    }
    onProgress(Math.min(i + BATCH, emails.length), emails.length);
  }
  return result;
};

export const getStorageUsage = async (): Promise<{ total: number; albums: number } | null> => {
  const { data, error } = await supabase.rpc('get_storage_usage');
  if (error || !Array.isArray(data)) return null;
  let total = 0;
  let albums = 0;
  for (const row of data as { bucket_id: string; total_bytes: number }[]) {
    total += Number(row.total_bytes) || 0;
    if (row.bucket_id === ALBUM_BUCKET) albums += Number(row.total_bytes) || 0;
  }
  return { total, albums };
};

export const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
};

export const formatDuration = (sec: number | null | undefined) => {
  if (!sec || !Number.isFinite(sec)) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ─── Téléchargement ZIP ──────────────────────────────────────────────────────

export interface ZipEntry {
  url: string;
  name: string;
  size: number;
}

export interface ZipProgress {
  done: number;
  total: number;
  part: number;
  parts: number;
}

/**
 * Archive ZIP construite dans le navigateur. Sans recompression (les JPEG/MP4
 * sont déjà compressés : STORE est instantané et n'économiserait rien), 4
 * téléchargements en parallèle, et découpage en parties de 150 Mo pour ne pas
 * saturer la mémoire d'un téléphone.
 */
export const downloadAlbumZip = async (
  entries: ZipEntry[],
  baseName: string,
  onProgress: (p: ZipProgress) => void,
): Promise<void> => {
  const parts: ZipEntry[][] = [];
  let current: ZipEntry[] = [];
  let currentSize = 0;
  for (const e of entries) {
    if (current.length > 0 && currentSize + e.size > ZIP_PART_MAX_BYTES) {
      parts.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(e);
    currentSize += e.size;
  }
  if (current.length) parts.push(current);

  // Chargée seulement au clic : la page album reste légère pour ceux qui ne font que regarder
  const { default: JSZip } = await import('jszip');

  let done = 0;
  for (let p = 0; p < parts.length; p++) {
    const zip = new JSZip();
    const queue = [...parts[p]];
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        const res = await fetch(entry.url);
        if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
        zip.file(entry.name, await res.blob(), { binary: true });
        done++;
        onProgress({ done, total: entries.length, part: p + 1, parts: parts.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = parts.length > 1 ? `${baseName}-partie-${p + 1}.zip` : `${baseName}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }
};

export const zipBaseName = (eventTitle: string) => `album-${slugify(eventTitle)}`;

// ─── Cache visiteur (jeton de session + réponse avec URLs signées) ───────────

const safeStorage = (kind: 'local' | 'session'): Storage | null => {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // navigation privée / navigateur intégré restrictif
  }
};

export const getAlbumToken = (eventRef: string) => {
  try {
    return safeStorage('local')?.getItem(`album-token:${eventRef}`) || null;
  } catch {
    return null;
  }
};

export const setAlbumToken = (eventRef: string, token: string | null) => {
  try {
    const s = safeStorage('local');
    if (!s) return;
    if (token) s.setItem(`album-token:${eventRef}`, token);
    else s.removeItem(`album-token:${eventRef}`);
  } catch {
    /* stockage plein ou bloqué */
  }
};

interface CachedOpen {
  savedAt: number;
  data: AlbumOpenResponse;
}

const cacheKey = (eventRef: string, linkKey: string | null) => `album-cache:${eventRef}:${linkKey || ''}`;

/** Réponse en cache tant que ses URLs signées sont encore valides. */
export const readAlbumCache = (eventRef: string, linkKey: string | null): CachedOpen | null => {
  try {
    const raw = safeStorage('session')?.getItem(cacheKey(eventRef, linkKey));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedOpen;
    if (cached.data.status !== 'granted' && cached.data.status !== 'empty') return null;
    if (new Date(cached.data.expires_at).getTime() < Date.now()) return null;
    return cached;
  } catch {
    return null;
  }
};

export const writeAlbumCache = (eventRef: string, linkKey: string | null, data: AlbumOpenResponse | null) => {
  try {
    const s = safeStorage('session');
    if (!s) return;
    if (!data || (data.status !== 'granted' && data.status !== 'empty')) {
      s.removeItem(cacheKey(eventRef, linkKey));
      return;
    }
    const { token: _omit, ...rest } = data;
    void _omit;
    s.setItem(cacheKey(eventRef, linkKey), JSON.stringify({ savedAt: Date.now(), data: rest }));
  } catch {
    /* quota dépassé : on se passe du cache */
  }
};

/**
 * Fusionne une réponse fraîche avec l'ancienne en conservant les anciennes URLs
 * signées encore valides : le navigateur les a déjà en cache, les images ne
 * sont donc pas re-téléchargées lors du rafraîchissement en arrière-plan.
 */
export const mergeAlbumResponse = (previous: AlbumOpenResponse | null, fresh: AlbumOpenResponse): AlbumOpenResponse => {
  if (
    !previous ||
    (previous.status !== 'granted' && previous.status !== 'empty') ||
    (fresh.status !== 'granted' && fresh.status !== 'empty') ||
    new Date(previous.expires_at).getTime() < Date.now() + 30 * 60_000
  ) {
    return fresh;
  }
  const old = new Map(previous.media.map((m) => [m.id, m]));
  return {
    ...fresh,
    expires_at: previous.expires_at < fresh.expires_at ? previous.expires_at : fresh.expires_at,
    media: fresh.media.map((m) => {
      const o = old.get(m.id);
      return o ? { ...m, url: o.url, thumb_url: o.thumb_url ?? m.thumb_url } : m;
    }),
  };
};
