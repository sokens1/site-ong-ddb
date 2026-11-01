import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, MapPin, Download, Lock, Mail, Loader2, X, ChevronLeft, ChevronRight, Play, Images,
  ShieldCheck, Share2, Check, LogOut, Send, AlertCircle, Clock,
} from 'lucide-react';
import { useNoIndex } from '../utils/useNoIndex';
import {
  AlbumApiError, AlbumOpenResponse, PublicAlbumEvent, PublicMediaItem, ZipProgress, albumFileName,
  callAlbumFunction, downloadAlbumZip, downloadSignedFile, formatBytes, formatDuration, getAlbumToken,
  mergeAlbumResponse, readAlbumCache, setAlbumToken, writeAlbumCache, zipBaseName,
} from '../utils/albumMedia';

/** Nombre de vignettes ajoutées à chaque palier de défilement. */
const PAGE_SIZE = 48;
/** Vignettes chargées immédiatement (au-dessus de la ligne de flottaison). */
const EAGER_COUNT = 12;

type Granted = Extract<AlbumOpenResponse, { status: 'granted' | 'empty' }>;
type Locked = Extract<AlbumOpenResponse, { status: 'locked' }>;

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Trop de tentatives. Patientez quelques minutes puis réessayez.',
  invalid_email: 'Adresse email invalide.',
  code_expired: 'Ce code a expiré. Demandez-en un nouveau.',
  too_many_attempts: 'Trop d’essais incorrects. Demandez un nouveau code.',
  identity_required: 'Votre session a expiré. Confirmez à nouveau votre adresse email.',
  not_found: 'Album introuvable.',
};

const errorText = (err: unknown) => {
  if (err instanceof AlbumApiError) {
    if (err.code === 'invalid_code') {
      const remaining = Number(err.payload?.remaining);
      return Number.isFinite(remaining) && remaining > 0
        ? `Code incorrect. Encore ${remaining} essai${remaining > 1 ? 's' : ''}.`
        : 'Code incorrect.';
    }
    return ERROR_MESSAGES[err.code] || 'Une erreur est survenue. Vérifiez votre connexion et réessayez.';
  }
  return 'Une erreur est survenue. Vérifiez votre connexion et réessayez.';
};

const formatEventDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// ─── Page ────────────────────────────────────────────────────────────────────

const EventAlbumPage: React.FC = () => {
  useNoIndex();
  const { id: eventRef = '' } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const linkKey = searchParams.get('k');
  const inviteToken = searchParams.get('invite');

  const [data, setData] = useState<AlbumOpenResponse | null>(() => readAlbumCache(eventRef, linkKey)?.data ?? null);
  const [loading, setLoading] = useState(!data);
  const [loadError, setLoadError] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const applyResponse = useCallback((res: AlbumOpenResponse) => {
    if ('token' in res && res.token) setAlbumToken(eventRef, res.token);
    if (res.status === 'locked' && res.token_invalid) setAlbumToken(eventRef, null);
    const merged = mergeAlbumResponse(dataRef.current, res);
    writeAlbumCache(eventRef, linkKey, merged);
    setData(merged);
  }, [eventRef, linkKey]);

  const fetchAlbum = useCallback(async (invite?: string | null) => {
    try {
      const res = await callAlbumFunction<AlbumOpenResponse>({
        action: 'open', event: eventRef, k: linkKey, token: getAlbumToken(eventRef), invite: invite || undefined,
      });
      applyResponse(res);
      setLoadError(false);
    } catch {
      if (!dataRef.current) setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventRef, linkKey, applyResponse]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const cached = readAlbumCache(eventRef, linkKey);
    if (inviteToken) {
      // Le lien d'invitation est échangé contre une session puis retiré de l'URL
      fetchAlbum(inviteToken).then(() => setSearchParams((p) => { p.delete('invite'); return p; }, { replace: true }));
      return;
    }
    // Cache récent : aucun appel réseau. Sinon affichage instantané du cache
    // et rafraîchissement silencieux en arrière-plan.
    if (cached && Date.now() - cached.savedAt < 5 * 60_000) return;
    fetchAlbum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventRef, linkKey]);

  // Renouvelle les URLs signées avant leur expiration si la page reste ouverte
  const expiresAt = data && (data.status === 'granted' || data.status === 'empty') ? data.expires_at : null;
  useEffect(() => {
    if (!expiresAt) return;
    const delay = new Date(expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => fetchAlbum(), Math.max(5_000, delay));
    return () => clearTimeout(timer);
  }, [expiresAt, fetchAlbum]);

  const signOut = () => {
    setAlbumToken(eventRef, null);
    writeAlbumCache(eventRef, linkKey, null);
    setLoading(true);
    setData(null);
    fetchAlbum();
  };

  if (loading && !data) return <AlbumSkeleton />;

  if (loadError || !data || data.status === 'not_found') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <Images size={56} className="mx-auto text-white/20 mb-5" />
          <h1 className="font-heading text-2xl font-bold text-white mb-2">
            {loadError ? 'Album momentanément indisponible' : 'Album introuvable'}
          </h1>
          <p className="text-white/60 mb-8">
            {loadError ? 'Vérifiez votre connexion puis réessayez.' : "Cet album n'existe pas ou n'est pas encore disponible."}
          </p>
          {loadError ? (
            <button onClick={() => { setLoading(true); fetchAlbum(); }} className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold">
              Réessayer
            </button>
          ) : (
            <Link to={data && 'event' in data && data.event ? `/events/${eventRef}` : '/events'} className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold inline-block">
              Retour aux événements
            </Link>
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AlbumHeader event={data.event} eventRef={eventRef} />
      {data.status === 'locked' ? (
        <AlbumGate
          key={data.viewer?.email || 'anonymous'}
          data={data}
          eventRef={eventRef}
          linkKey={linkKey}
          onResponse={applyResponse}
          onSignOut={signOut}
        />
      ) : (
        <AlbumGallery data={data} onSignOut={data.viewer ? signOut : undefined} />
      )}
    </PageShell>
  );
};

export default EventAlbumPage;

// ─── Mise en page ────────────────────────────────────────────────────────────

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-ddb-950 pt-24 sm:pt-28 pb-20">{children}</div>
);

const AlbumHeader: React.FC<{ event: PublicAlbumEvent; eventRef: string }> = ({ event, eventRef }) => (
  <div className="container mx-auto max-w-6xl px-4 mb-6 sm:mb-8">
    <Link to={`/events/${eventRef}`} className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-4">
      <ArrowLeft size={16} /> Retour à l'événement
    </Link>
    <p className="text-ddb-300 text-xs sm:text-sm font-bold uppercase tracking-widest mb-2">Album photos & vidéos</p>
    <h1 className="font-heading text-2xl sm:text-4xl font-bold text-white leading-tight">{event.title}</h1>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-sm text-white/60">
      <span className="inline-flex items-center gap-1.5"><Calendar size={15} /> {formatEventDate(event.event_date)}</span>
      {event.location && <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {event.location}</span>}
    </div>
  </div>
);

const AlbumSkeleton: React.FC = () => (
  <PageShell>
    <div className="container mx-auto max-w-6xl px-4 animate-pulse">
      <div className="h-4 w-32 bg-white/10 rounded mb-6" />
      <div className="h-9 w-2/3 bg-white/10 rounded mb-3" />
      <div className="h-4 w-48 bg-white/10 rounded mb-10" />
      <div className="flex flex-wrap gap-1.5">
        {[1.5, 0.75, 1.33, 1, 1.5, 0.8, 1.33, 1.2, 0.75, 1.5, 1, 1.33].map((r, i) => (
          <div key={i} className="bg-white/[0.06] rounded-lg h-[120px] sm:h-[200px]" style={{ flexGrow: r * 100, flexBasis: `${r * 160}px` }} />
        ))}
      </div>
    </div>
  </PageShell>
);

// ─── Accès requis (équivalent de l'écran "Vous avez besoin d'une autorisation") ─

const GATE_TEXT: Record<Locked['access_mode'], string> = {
  restricted: "Cet album est partagé uniquement avec certaines personnes. Confirmez votre adresse email pour l'ouvrir.",
  participants: "Cet album est réservé aux personnes inscrites à l'événement. Entrez l'adresse email utilisée lors de votre inscription.",
  attendees: "Cet album est réservé aux participants présents à l'événement (billet scanné à l'entrée). Entrez l'adresse email utilisée lors de votre inscription.",
  public: '',
};

const AlbumGate: React.FC<{
  data: Locked;
  eventRef: string;
  linkKey: string | null;
  onResponse: (res: AlbumOpenResponse) => void;
  onSignOut: () => void;
}> = ({ data, eventRef, linkKey, onResponse, onSignOut }) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [message, setMessage] = useState('');
  const [requested, setRequested] = useState(data.request_pending);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setError(ERROR_MESSAGES.invalid_email);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callAlbumFunction({ action: 'send_code', event: eventRef, email: clean });
      setEmail(clean);
      setStep('code');
      setCode('');
      setResendIn(30);
      setTimeout(() => codeInputRef.current?.focus(), 50);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await callAlbumFunction<AlbumOpenResponse>({ action: 'verify_code', event: eventRef, email, code: value, k: linkKey });
      onResponse(res); // accès accordé → galerie ; refusé → écran "Demander l'accès"
    } catch (err) {
      setError(errorText(err));
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const requestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await callAlbumFunction({ action: 'request_access', event: eventRef, token: getAlbumToken(eventRef), message });
      setRequested(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const card = 'max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-6 sm:p-8';

  // Identité confirmée mais pas d'accès → "Demander l'accès"
  if (data.viewer) {
    return (
      <div className="container mx-auto max-w-6xl px-4">
        <div className={card}>
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5">
            <Lock size={26} />
          </div>
          {requested ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Demande envoyée</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                L'équipe de l'ONG DDB a été prévenue. Vous recevrez un email à <strong>{data.viewer.email}</strong> dès que l'accès vous sera accordé.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Vous avez besoin d'une autorisation</h2>
              <p className="text-gray-600 text-sm leading-relaxed mb-5">
                L'adresse <strong>{data.viewer.email}</strong> n'a pas accès à cet album. Demandez l'accès ou utilisez une autre adresse.
              </p>
              <form onSubmit={requestAccess} className="space-y-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Message (facultatif) — ex. : j'étais bénévole lors de l'événement"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20 resize-none"
                />
                {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p>}
                <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />} Demander l'accès
                </button>
              </form>
            </>
          )}
          <button onClick={onSignOut} className="mt-5 w-full text-sm text-gray-500 hover:text-gray-800 inline-flex items-center justify-center gap-1.5">
            <LogOut size={15} /> Utiliser une autre adresse email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4">
      <div className={card}>
        <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center mb-5">
          {step === 'email' ? <Lock size={26} /> : <Mail size={26} />}
        </div>

        {step === 'email' ? (
          <form onSubmit={sendCode}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Album privé</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-5">{GATE_TEXT[data.access_mode]}</p>
            <label htmlFor="album-email" className="sr-only">Adresse email</label>
            <input
              id="album-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            />
            {error && <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p>}
            <button type="submit" disabled={busy} className="mt-4 w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {busy && <Loader2 size={18} className="animate-spin" />} Recevoir un code
            </button>
            <p className="mt-4 text-xs text-gray-400 flex items-start gap-1.5">
              <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
              Un code à 6 chiffres vous sera envoyé pour vérifier que l'adresse vous appartient. Vous resterez connecté 30 jours sur cet appareil.
            </p>
          </form>
        ) : (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Vérifiez vos emails</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-5">
              Si un compte correspond, un code a été envoyé à <strong>{email}</strong>. Pensez à regarder dans les spams.
            </p>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                if (v.length === 6) verify(v); // validation automatique au 6e chiffre
              }}
              placeholder="••••••"
              aria-label="Code à 6 chiffres"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-center text-2xl font-bold tracking-[0.5em] text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20 disabled:bg-gray-50"
            />
            {busy && <p className="mt-2 text-sm text-gray-500 flex items-center gap-1.5"><Loader2 size={15} className="animate-spin" /> Vérification…</p>}
            {error && <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p>}
            <div className="mt-5 flex items-center justify-between text-sm">
              <button onClick={() => { setStep('email'); setError(null); }} className="text-gray-500 hover:text-gray-800">
                Modifier l'adresse
              </button>
              <button onClick={() => sendCode()} disabled={resendIn > 0 || busy} className="font-semibold text-green-700 hover:text-green-800 disabled:text-gray-400">
                {resendIn > 0 ? `Renvoyer (${resendIn} s)` : 'Renvoyer le code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Galerie ─────────────────────────────────────────────────────────────────

const GalleryTile = memo(function GalleryTile({
  item, eager, onOpen,
}: { item: PublicMediaItem; eager: boolean; onOpen: (id: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  // Ratio borné : un panorama ou une photo très verticale ne casse pas la ligne
  const ratio = Math.min(2.2, Math.max(0.6, item.width && item.height ? item.width / item.height : 1));
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      style={{ flexGrow: ratio * 100, flexBasis: `calc(var(--row-h) * ${ratio})` }}
      className="group relative overflow-hidden rounded-md sm:rounded-lg bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ddb-300"
      aria-label={item.caption || (item.kind === 'video' ? 'Ouvrir la vidéo' : 'Ouvrir la photo')}
    >
      <span className="block" style={{ paddingBottom: `${100 / ratio}%` }} />
      {item.placeholder && (
        <img src={item.placeholder} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-xl scale-110" />
      )}
      {item.thumb_url ? (
        <img
          src={item.thumb_url}
          alt={item.caption || ''}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.04] ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        !item.placeholder && <span className="absolute inset-0 flex items-center justify-center text-white/30"><Play size={30} /></span>
      )}
      {item.kind === 'video' && (
        <>
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-12 h-12 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Play size={20} fill="currentColor" className="ml-0.5" />
            </span>
          </span>
          {item.duration ? (
            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[11px] font-semibold">
              {formatDuration(item.duration)}
            </span>
          ) : null}
        </>
      )}
      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
    </button>
  );
});

const AlbumGallery: React.FC<{ data: Granted; onSignOut?: () => void }> = ({ data, onSignOut }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [zip, setZip] = useState<ZipProgress | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const openedHereRef = useRef(false);

  const { media, event, album } = data;
  const photoCount = media.filter((m) => m.kind === 'image').length;
  const videoCount = media.length - photoCount;
  const totalBytes = media.reduce((acc, m) => acc + (m.size || 0), 0);
  const filtered = useMemo(() => (filter === 'all' ? media : media.filter((m) => m.kind === filter)), [media, filter]);
  const globalIndex = useMemo(() => new Map(media.map((m, i) => [m.id, i])), [media]);

  useEffect(() => setVisible(PAGE_SIZE), [filter]);

  // Rendu progressif : on ajoute des vignettes à l'approche du bas de page
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visible >= filtered.length) return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setVisible((v) => v + PAGE_SIZE),
      { rootMargin: '1200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, filtered.length]);

  // Visionneuse pilotée par l'URL (?m=id) : lien direct vers une photo et
  // bouton "retour" du téléphone qui ferme la visionneuse au lieu de quitter la page.
  const openId = searchParams.get('m');
  const lightboxList = openId && !filtered.some((m) => m.id === openId) ? media : filtered;
  const lightboxIndex = openId ? lightboxList.findIndex((m) => m.id === openId) : -1;

  const openMedia = useCallback((id: string) => {
    openedHereRef.current = true;
    setSearchParams((p) => { p.set('m', id); return p; });
  }, [setSearchParams]);

  const goTo = useCallback((id: string) => {
    setSearchParams((p) => { p.set('m', id); return p; }, { replace: true });
  }, [setSearchParams]);

  const closeLightbox = useCallback(() => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
    } else {
      setSearchParams((p) => { p.delete('m'); return p; }, { replace: true });
    }
  }, [navigate, setSearchParams]);

  const handleZip = async () => {
    setZipError(null);
    setZip({ done: 0, total: media.length, part: 1, parts: 1 });
    try {
      await downloadAlbumZip(
        media.map((m, i) => ({ url: m.url, name: albumFileName(event.title, i, m), size: m.size })),
        zipBaseName(event.title),
        setZip,
      );
    } catch {
      setZipError("Le téléchargement a été interrompu. Réessayez, ou téléchargez les fichiers un par un.");
    } finally {
      setZip(null);
    }
  };

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('m');
    url.searchParams.delete('invite');
    const shareUrl = url.toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Album — ${event.title}`, url: shareUrl });
        return;
      } catch {
        /* partage annulé : on copie le lien */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  if (data.status === 'empty') {
    return (
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center py-20 border border-dashed border-white/15 rounded-3xl">
          <Clock size={44} className="mx-auto text-white/25 mb-4" />
          <p className="text-white font-bold text-lg">Les photos arrivent bientôt</p>
          <p className="text-white/50 text-sm mt-1">L'équipe prépare l'album de cet événement. Revenez dans quelques jours !</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-2 sm:px-4">
      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-2 sm:px-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {photoCount > 0 && videoCount > 0 ? (
            ([
              ['all', `Tout · ${media.length}`],
              ['image', `Photos · ${photoCount}`],
              ['video', `Vidéos · ${videoCount}`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  filter === key ? 'bg-white text-ddb-900' : 'bg-white/10 text-white/80 hover:bg-white/15'
                }`}
              >
                {label}
              </button>
            ))
          ) : (
            <span className="text-sm text-white/60">
              {photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? 's' : ''}` : `${videoCount} vidéo${videoCount > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold">
            {copied ? <Check size={16} /> : <Share2 size={16} />} {copied ? 'Lien copié' : 'Partager'}
          </button>
          {album.allow_download && (
            <button
              onClick={handleZip}
              disabled={!!zip}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold disabled:opacity-80"
            >
              {zip ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {zip.done}/{zip.total}{zip.parts > 1 ? ` · partie ${zip.part}/${zip.parts}` : ''}
                </>
              ) : (
                <>
                  <Download size={16} /> Tout télécharger <span className="font-normal text-white/75 hidden sm:inline">· {formatBytes(totalBytes)}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {zipError && <p className="mb-4 mx-2 sm:mx-0 text-sm text-red-300 flex items-center gap-1.5"><AlertCircle size={15} /> {zipError}</p>}

      {/* Grille justifiée (lignes de hauteur égale, sans calcul JS) */}
      <div className="flex flex-wrap gap-1 sm:gap-1.5 [--row-h:110px] sm:[--row-h:180px] lg:[--row-h:220px] after:content-[''] after:grow-[999999]">
        {filtered.slice(0, visible).map((m, i) => (
          <GalleryTile key={m.id} item={m} eager={i < EAGER_COUNT} onOpen={openMedia} />
        ))}
      </div>
      {visible < filtered.length && <div ref={sentinelRef} className="h-px" aria-hidden />}

      {data.viewer && onSignOut && (
        <p className="mt-10 text-center text-xs text-white/40">
          Connecté en tant que {data.viewer.email} ·{' '}
          <button onClick={onSignOut} className="underline hover:text-white/70">Se déconnecter</button>
        </p>
      )}

      {lightboxIndex >= 0 && (
        <Lightbox
          items={lightboxList}
          index={lightboxIndex}
          allowDownload={album.allow_download}
          fileNameFor={(m) => albumFileName(event.title, globalIndex.get(m.id) ?? 0, m)}
          onNavigate={goTo}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
};

// ─── Visionneuse plein écran ─────────────────────────────────────────────────

const Lightbox: React.FC<{
  items: PublicMediaItem[];
  index: number;
  allowDownload: boolean;
  fileNameFor: (m: PublicMediaItem) => string;
  onNavigate: (id: string) => void;
  onClose: () => void;
}> = ({ items, index, allowDownload, fileNameFor, onNavigate, onClose }) => {
  const item = items[index];
  // Lié à l'id : une photo HD déjà en cache peut finir de charger avant tout effet de réinitialisation
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const fullLoaded = loadedId === item?.id;
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const prev = useCallback(() => hasPrev && onNavigate(items[index - 1].id), [hasPrev, items, index, onNavigate]);
  const next = useCallback(() => hasNext && onNavigate(items[index + 1].id), [hasNext, items, index, onNavigate]);

  // Bloque le défilement de la page derrière la visionneuse
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  // Préchargement des photos voisines en HD : navigation instantanée
  useEffect(() => {
    for (const m of [items[index + 1], items[index - 1], items[index + 2]]) {
      if (m && m.kind === 'image') {
        const img = new Image();
        img.decoding = 'async';
        img.src = m.url;
      }
    }
  }, [items, index]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex flex-col select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse"
      onTouchStart={(e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const start = touchRef.current;
        touchRef.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0) next();
          else prev();
        } else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) {
          onClose(); // glisser vers le bas pour fermer
        }
      }}
    >
      <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3 text-white bg-gradient-to-b from-black/70 to-transparent absolute top-0 inset-x-0 z-10">
        <span className="text-sm text-white/70 tabular-nums">{index + 1} / {items.length}</span>
        <div className="flex items-center gap-1">
          {allowDownload && (
            <button
              onClick={() => downloadSignedFile(item.url, fileNameFor(item))}
              className="p-2.5 rounded-full hover:bg-white/10"
              title="Télécharger"
              aria-label="Télécharger"
            >
              <Download size={20} />
            </button>
          )}
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-white/10" aria-label="Fermer"><X size={22} /></button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center min-h-0">
        {item.kind === 'video' ? (
          <video
            key={item.id}
            src={item.url}
            poster={item.thumb_url || undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            {...(allowDownload ? {} : { controlsList: 'nodownload' })}
            className="max-w-full max-h-full"
          />
        ) : (
          <div key={item.id} className="absolute inset-0">
            {/* Miniature (déjà en cache) affichée tout de suite, la HD la remplace en fondu */}
            {(item.thumb_url || item.placeholder) && (
              <img
                src={item.thumb_url || item.placeholder || ''}
                alt=""
                aria-hidden
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${fullLoaded ? 'opacity-0' : 'opacity-100'}`}
              />
            )}
            <img
              src={item.url}
              alt={item.caption || ''}
              decoding="async"
              onLoad={() => setLoadedId(item.id)}
              onContextMenu={allowDownload ? undefined : (e) => e.preventDefault()}
              className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${fullLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {!fullLoaded && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Loader2 className="w-7 h-7 text-white/70 animate-spin" />
              </span>
            )}
          </div>
        )}

        {hasPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="hidden sm:flex absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Précédent"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {hasNext && (
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="hidden sm:flex absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Suivant"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {item.caption && (
        <div className="absolute bottom-0 inset-x-0 px-4 py-4 bg-gradient-to-t from-black/80 to-transparent text-center pointer-events-none">
          <p className="text-white text-sm sm:text-base max-w-2xl mx-auto">{item.caption}</p>
        </div>
      )}
    </div>
  );
};
