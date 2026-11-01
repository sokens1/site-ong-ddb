import React, { useEffect, useRef, useState } from 'react';
import {
  X, Lock, Users, UserCheck, Link2, Globe, ChevronDown, Check, Settings, ArrowLeft, Loader2, Mail, RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import {
  ACCESS_MODES, AlbumAccessMode, AlbumAccessRequest, AlbumSettings, AlbumShare,
  albumShareUrl, inviteToAlbum, listAlbumShares, newLinkKey, rejectAccessRequest, removeAlbumShare,
  updateAlbumSettings,
} from '../../utils/albumMedia';
import { logAdminActivity } from '../../utils/securityLog';

const MODE_ICONS: Record<AlbumAccessMode, LucideIcon> = {
  restricted: Lock,
  participants: Users,
  attendees: UserCheck,
  link: Link2,
  public: Globe,
};

const MODE_ORDER: AlbumAccessMode[] = ['restricted', 'participants', 'attendees', 'link', 'public'];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const AVATAR_COLORS = ['bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600', 'bg-indigo-600'];
const avatarColor = (email: string) =>
  AVATAR_COLORS[[...email].reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const Avatar: React.FC<{ email: string }> = ({ email }) => (
  <span className={`w-9 h-9 rounded-full ${avatarColor(email)} text-white text-sm font-bold flex items-center justify-center flex-shrink-0 uppercase`}>
    {email[0]}
  </span>
);

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
};

/** Petit menu déroulant façon Drive (ferme au clic extérieur / Échap). */
const useDismiss = (open: boolean, close: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
};

const ShareRoleMenu: React.FC<{ onRemove: () => void; disabled?: boolean }> = ({ onRemove, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        Lecteur <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-800">
            <Check size={15} className="text-green-600" /> Lecteur
          </div>
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={() => { setOpen(false); onRemove(); }}
            className="w-full text-left px-3 py-2 pl-9 text-sm text-gray-700 hover:bg-gray-50"
          >
            Supprimer l'accès
          </button>
        </div>
      )}
    </div>
  );
};

interface AlbumShareModalProps {
  event: { id: number; slug?: string | null; title: string };
  settings: AlbumSettings;
  requests: AlbumAccessRequest[];
  onSettingsChange: (s: AlbumSettings) => void;
  onRequestsChange: (r: AlbumAccessRequest[]) => void;
  onClose: () => void;
}

const AlbumShareModal: React.FC<AlbumShareModalProps> = ({
  event, settings, requests, onSettingsChange, onRequestsChange, onClose,
}) => {
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [shares, setShares] = useState<AlbumShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(true);
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modeMenuRef = useDismiss(modeMenuOpen, () => setModeMenuOpen(false));
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    listAlbumShares(event.id)
      .then(setShares)
      .catch(() => setError('Impossible de charger les personnes ayant accès.'))
      .finally(() => setSharesLoading(false));
    return () => clearTimeout(toastTimer.current);
  }, [event.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !modeMenuOpen) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, modeMenuOpen]);

  // ── Saisie des emails en "puces" (Entrée, virgule, espace ou collage) ──
  const commitDraft = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    setChips((prev) => {
      const next = [...prev];
      for (const p of parts) if (!next.includes(p)) next.push(p);
      return next;
    });
    setDraft('');
  };

  const invalidChips = chips.filter((c) => !EMAIL_RE.test(c));
  const adding = chips.length > 0;

  const handleSend = async () => {
    if (invalidChips.length) {
      setError(`Adresse invalide : ${invalidChips.join(', ')}`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await inviteToAlbum(event.id, chips, notify, message);
      logAdminActivity('album_share_add', `events:${event.id}`, { emails: chips, notify });
      setShares(await listAlbumShares(event.id));
      onRequestsChange(requests.filter((r) => !chips.includes(r.email)));
      setChips([]);
      setMessage('');
      showToast(
        res.simulated
          ? 'Accès accordé (emails simulés : Gmail non configuré)'
          : res.failed?.length
          ? `Accès accordé — ${res.failed.length} email${res.failed.length > 1 ? 's' : ''} non envoyé${res.failed.length > 1 ? 's' : ''}`
          : notify
          ? `${res.added} personne${res.added > 1 ? 's' : ''} ajoutée${res.added > 1 ? 's' : ''} et notifiée${res.added > 1 ? 's' : ''}`
          : 'Accès accordé',
      );
    } catch {
      setError("L'ajout a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setSending(false);
    }
  };

  const handleRemoveShare = async (share: AlbumShare) => {
    setBusyId(share.id);
    const previous = shares;
    setShares((s) => s.filter((x) => x.id !== share.id)); // optimiste
    try {
      await removeAlbumShare(share.id);
      logAdminActivity('album_share_remove', `events:${event.id}`, { email: share.email });
      showToast(`Accès retiré à ${share.email}`);
    } catch {
      setShares(previous);
      setError("Impossible de retirer l'accès.");
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (req: AlbumAccessRequest) => {
    setBusyId(req.id);
    try {
      await inviteToAlbum(event.id, [req.email], true);
      logAdminActivity('album_request_approve', `events:${event.id}`, { email: req.email });
      onRequestsChange(requests.filter((r) => r.id !== req.id));
      setShares(await listAlbumShares(event.id));
      showToast(`${req.email} a maintenant accès`);
    } catch {
      setError("Impossible d'accepter la demande.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: AlbumAccessRequest) => {
    setBusyId(req.id);
    try {
      await rejectAccessRequest(req.id);
      onRequestsChange(requests.filter((r) => r.id !== req.id));
    } catch {
      setError('Impossible de refuser la demande.');
    } finally {
      setBusyId(null);
    }
  };

  const applySettings = async (patch: Partial<AlbumSettings>, successText: string) => {
    const previous = settings;
    onSettingsChange({ ...settings, ...patch }); // optimiste
    try {
      await updateAlbumSettings(event.id, patch);
      logAdminActivity('album_settings_update', `events:${event.id}`, { ...patch, link_key: undefined });
      showToast(successText);
    } catch {
      onSettingsChange(previous);
      setError("La modification n'a pas pu être enregistrée.");
    }
  };

  const handleCopyLink = async () => {
    await copyText(albumShareUrl(event, settings));
    showToast('Lien copié');
  };

  const ModeIcon = MODE_ICONS[settings.general_access];
  const modeIsOpen = settings.general_access === 'link' || settings.general_access === 'public';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Partager l'album ${event.title}`}
        className="relative bg-white w-full sm:max-w-[560px] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {view === 'settings' ? (
          // ── Paramètres de partage ──
          <div className="p-5 sm:p-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-5">
              <button onClick={() => setView('main')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600" aria-label="Retour">
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-xl text-gray-900">Paramètres de partage</h2>
            </div>

            <label className="flex items-start gap-3 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allow_download}
                onChange={(e) => applySettings(
                  { allow_download: e.target.checked },
                  e.target.checked ? 'Téléchargement autorisé' : 'Téléchargement désactivé',
                )}
                className="mt-0.5 w-5 h-5 rounded accent-green-600 flex-shrink-0"
              />
              <span>
                <span className="block text-sm text-gray-900">Les lecteurs peuvent voir l'option de téléchargement</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Boutons « Télécharger » et « Tout télécharger (ZIP) » sur l'album. Désactivé, les photos restent consultables (une capture d'écran reste toujours possible).
                </span>
              </span>
            </label>

            <div className="py-3 border-t border-gray-100 mt-2">
              <p className="text-sm text-gray-900">Réinitialiser le lien</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                L'ancien lien « Tous les utilisateurs disposant du lien » cessera de fonctionner. Les personnes ajoutées gardent leur accès.
              </p>
              <button
                onClick={() => applySettings({ link_key: newLinkKey() }, 'Nouveau lien généré')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw size={15} /> Générer un nouveau lien
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 sm:p-6 pb-3 flex items-start justify-between gap-3">
              <h2 className="text-xl text-gray-900 leading-snug">
                Partager « Album — {event.title} »
              </h2>
              <div className="flex items-center gap-1 -mr-2 -mt-1">
                <button onClick={() => setView('settings')} className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="Paramètres de partage" aria-label="Paramètres de partage">
                  <Settings size={20} />
                </button>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 sm:hidden" aria-label="Fermer">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="px-5 sm:px-6 overflow-y-auto flex-1">
              {/* Champ "Ajouter des personnes" */}
              <div
                className={`flex flex-wrap items-center gap-1.5 min-h-[52px] px-3 py-2 rounded-lg border transition-colors ${
                  adding ? 'border-green-600 ring-1 ring-green-600' : 'border-gray-300 focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-600'
                }`}
              >
                {chips.map((c) => (
                  <span
                    key={c}
                    className={`inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-sm ${
                      EMAIL_RE.test(c) ? 'bg-gray-100 text-gray-800' : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full ${avatarColor(c)} text-white text-xs font-bold flex items-center justify-center uppercase`}>{c[0]}</span>
                    {c}
                    <button onClick={() => setChips((p) => p.filter((x) => x !== c))} className="text-gray-500 hover:text-gray-800" aria-label={`Retirer ${c}`}>
                      <X size={14} />
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  value={draft}
                  autoFocus
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/[\s,;]$/.test(v)) commitDraft(v);
                    else setDraft(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitDraft(draft); }
                    if (e.key === 'Backspace' && !draft && chips.length) setChips((p) => p.slice(0, -1));
                  }}
                  onBlur={() => commitDraft(draft)}
                  onPaste={(e) => {
                    e.preventDefault();
                    commitDraft(`${draft} ${e.clipboardData.getData('text')}`);
                  }}
                  placeholder={chips.length ? '' : 'Ajouter des personnes (adresses email)'}
                  className="flex-1 min-w-[160px] py-1.5 text-[15px] text-gray-900 placeholder-gray-500 outline-none bg-transparent"
                />
                {adding && <span className="ml-auto text-sm text-gray-600 px-2 py-1 rounded-lg bg-gray-50">Lecteur</span>}
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              {adding ? (
                // ── Étape "Envoyer" (comme Drive après avoir saisi des adresses) ──
                <div className="mt-4 space-y-3 pb-2">
                  <label className="flex items-center gap-3 text-sm text-gray-800 cursor-pointer">
                    <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="w-5 h-5 rounded accent-green-600" />
                    Envoyer une notification
                  </label>
                  {notify && (
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      maxLength={1000}
                      placeholder="Message"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 resize-none"
                    />
                  )}
                  {notify && (
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Mail size={13} /> Chaque personne reçoit un lien personnel valable 30 jours.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Demandes d'accès */}
                  {requests.length > 0 && (
                    <div className="mt-5">
                      <h3 className="text-base font-medium text-gray-900 mb-2">
                        Demandes d'accès <span className="text-gray-500 font-normal">({requests.length})</span>
                      </h3>
                      <ul className="space-y-1">
                        {requests.map((r) => (
                          <li key={r.id} className="flex items-start gap-3 py-2">
                            <Avatar email={r.email} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{r.email}</p>
                              {r.message && <p className="text-xs text-gray-600 mt-0.5 italic break-words">« {r.message} »</p>}
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleReject(r)}
                                disabled={busyId === r.id}
                                className="px-3 py-1.5 rounded-full text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                              >
                                Refuser
                              </button>
                              <button
                                onClick={() => handleApprove(r)}
                                disabled={busyId === r.id}
                                className="px-3 py-1.5 rounded-full text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {busyId === r.id && <Loader2 size={13} className="animate-spin" />}
                                Partager
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Personnes ayant accès */}
                  <div className="mt-5">
                    <h3 className="text-base font-medium text-gray-900 mb-2">Personnes ayant accès</h3>
                    <ul className="space-y-0.5 max-h-64 overflow-y-auto -mx-2 px-2">
                      <li className="flex items-center gap-3 py-2">
                        <span className="w-9 h-9 rounded-full bg-ddb-800 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0">DDB</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">Équipe ONG DDB</p>
                          <p className="text-xs text-gray-500">Administrateurs et chargés de communication</p>
                        </div>
                        <span className="text-sm text-gray-500 px-2.5">Propriétaire</span>
                      </li>
                      {sharesLoading ? (
                        <li className="py-3 text-sm text-gray-500 flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Chargement…</li>
                      ) : (
                        shares.map((s) => (
                          <li key={s.id} className="flex items-center gap-3 py-2">
                            <Avatar email={s.email} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{s.email}</p>
                              <p className="text-xs text-gray-500">
                                {s.notified_at
                                  ? `Invitation envoyée le ${new Date(s.notified_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                                  : 'Ajouté sans notification'}
                              </p>
                            </div>
                            <ShareRoleMenu onRemove={() => handleRemoveShare(s)} disabled={busyId === s.id} />
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  {/* Accès général */}
                  <div className="mt-5 pb-2">
                    <h3 className="text-base font-medium text-gray-900 mb-2">Accès général</h3>
                    <div className="flex items-start gap-3 -mx-2 px-2 py-2 rounded-xl hover:bg-gray-50">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${modeIsOpen ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        <ModeIcon size={18} />
                      </span>
                      <div className="flex-1 min-w-0" ref={modeMenuRef}>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setModeMenuOpen((o) => !o)}
                            className="inline-flex items-center gap-1 -ml-2 px-2 py-1 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-200/70"
                            aria-haspopup="listbox"
                            aria-expanded={modeMenuOpen}
                          >
                            {ACCESS_MODES[settings.general_access].label} <ChevronDown size={15} />
                          </button>
                          {modeMenuOpen && (
                            <ul role="listbox" className="absolute left-0 top-full mt-1 w-[min(340px,80vw)] bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20">
                              {MODE_ORDER.map((m) => {
                                const Icon = MODE_ICONS[m];
                                const selected = m === settings.general_access;
                                return (
                                  <li key={m}>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected={selected}
                                      onClick={() => {
                                        setModeMenuOpen(false);
                                        if (!selected) applySettings({ general_access: m }, "Paramètres d'accès mis à jour");
                                      }}
                                      className={`w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 ${selected ? 'bg-green-50/60' : ''}`}
                                    >
                                      <span className="w-5 pt-0.5 flex-shrink-0">{selected && <Check size={16} className="text-green-600" />}</span>
                                      <Icon size={17} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                      <span>
                                        <span className="block text-sm text-gray-900">{ACCESS_MODES[m].label}</span>
                                        <span className="block text-xs text-gray-500 mt-0.5">{ACCESS_MODES[m].description}</span>
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{ACCESS_MODES[settings.general_access].description}</p>
                      </div>
                      {modeIsOpen && <span className="text-sm text-gray-500 pt-1">Lecteur</span>}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Pied de fenêtre */}
            <div className="px-5 sm:px-6 py-4 flex items-center justify-between gap-3 border-t border-gray-100 sm:border-0">
              {adding ? (
                <>
                  <span />
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setChips([]); setDraft(''); setError(null); }} className="px-5 py-2 rounded-full text-sm font-medium text-green-700 hover:bg-green-50">
                      Annuler
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      className="px-6 py-2 rounded-full text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {sending && <Loader2 size={15} className="animate-spin" />}
                      {notify ? 'Envoyer' : 'Partager'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-green-700 hover:bg-green-50"
                  >
                    <Link2 size={16} /> Copier le lien
                  </button>
                  <button onClick={onClose} className="px-7 py-2 rounded-full text-sm font-medium bg-green-600 text-white hover:bg-green-700">
                    OK
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {toast && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-20 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumShareModal;
