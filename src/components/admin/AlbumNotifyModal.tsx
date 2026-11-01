import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Send, Loader2, Check, AlertTriangle, Users, UserCheck, RotateCcw, Info, ListChecks, Search, Plus,
} from 'lucide-react';
import {
  AlbumAccessMode, BulkSendResult, ParticipantContact, listAlbumShares, listParticipantContacts, sendAlbumToParticipants,
} from '../../utils/albumMedia';
import { logAdminActivity } from '../../utils/securityLog';

/** Au-delà, l'envoi risque de dépasser la limite quotidienne d'un compte Gmail gratuit. */
const GMAIL_DAILY_WARNING = 400;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface AlbumNotifyModalProps {
  eventId: number;
  eventTitle: string;
  accessMode: AlbumAccessMode;
  onClose: () => void;
  /** Appelé après un envoi pour rafraîchir les compteurs de l'onglet. */
  onSent: () => void;
}

type Audience = 'registered' | 'attendees' | 'custom';

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const AlbumNotifyModal: React.FC<AlbumNotifyModalProps> = ({ eventId, eventTitle, accessMode, onClose, onSent }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [contacts, setContacts] = useState<ParticipantContact[]>([]);
  const [alreadyNotified, setAlreadyNotified] = useState<Set<string>>(new Set());
  const [audience, setAudience] = useState<Audience>(accessMode === 'attendees' ? 'attendees' : 'registered');
  const [skipNotified, setSkipNotified] = useState(true);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<BulkSendResult | null>(null);

  // Sélection manuelle
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [extraDraft, setExtraDraft] = useState('');
  const [extraError, setExtraError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listParticipantContacts(eventId), listAlbumShares(eventId)])
      .then(([list, shares]) => {
        setContacts(list);
        setAlreadyNotified(new Set(shares.filter((s) => s.notified_at).map((s) => s.email)));
        // Aucun billet scanné : on bascule sur les inscrits
        if (!list.some((c) => c.scanned)) setAudience((a) => (a === 'attendees' ? 'registered' : a));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [eventId]);

  const sending = progress !== null && result === null;

  // Empêche de fermer l'onglet en plein envoi
  useEffect(() => {
    if (!sending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [sending]);

  const registered = useMemo(() => contacts.map((c) => c.email), [contacts]);
  const attendees = useMemo(() => contacts.filter((c) => c.scanned).map((c) => c.email), [contacts]);

  const audienceList = audience === 'attendees' ? attendees : registered;
  const alreadyCount = useMemo(() => audienceList.filter((e) => alreadyNotified.has(e)).length, [audienceList, alreadyNotified]);
  const recipients = useMemo(() => {
    // Sélection manuelle : on envoie exactement ce qui est coché, même aux déjà notifiés
    if (audience === 'custom') return [...selected];
    return skipNotified ? audienceList.filter((e) => !alreadyNotified.has(e)) : audienceList;
  }, [audience, selected, audienceList, alreadyNotified, skipNotified]);

  const filteredContacts = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return contacts;
    return contacts.filter((c) => normalize(`${c.name || ''} ${c.email}`).includes(q));
  }, [contacts, search]);

  const toggle = (email: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selected.has(c.email));
  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      filteredContacts.forEach((c) => (allFilteredSelected ? next.delete(c.email) : next.add(c.email)));
      return next;
    });

  const addExtraEmail = () => {
    const email = extraDraft.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setExtraError('Adresse email invalide');
      return;
    }
    setExtraError(null);
    if (!contacts.some((c) => c.email === email) && !extraEmails.includes(email)) {
      setExtraEmails((prev) => [email, ...prev]);
    }
    setSelected((prev) => new Set(prev).add(email));
    setExtraDraft('');
  };

  const send = async (emails: string[]) => {
    setResult(null);
    setProgress({ done: 0, total: emails.length });
    const res = await sendAlbumToParticipants(eventId, emails, message, (done, total) => setProgress({ done, total }));
    setResult(res);
    setAlreadyNotified((prev) => {
      const next = new Set(prev);
      emails.filter((e) => !res.failed.includes(e)).forEach((e) => next.add(e));
      return next;
    });
    logAdminActivity('album_notify_participants', `events:${eventId}`, {
      audience, sent: res.sent, failed: res.failed.length, simulated: res.simulated,
    });
    onSent();
  };

  const close = () => !sending && onClose();

  const audienceOptions = [
    { key: 'registered' as const, Icon: Users, label: 'Tous les inscrits', count: registered.length },
    { key: 'attendees' as const, Icon: UserCheck, label: 'Participants présents (billet scanné)', count: attendees.length },
    { key: 'custom' as const, Icon: ListChecks, label: 'Choisir des participants', count: selected.size },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Envoyer l'album aux participants"
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-xl text-gray-900">Envoyer l'album aux participants</h2>
            <button onClick={close} disabled={sending} className="p-2 -mr-2 -mt-1 rounded-full hover:bg-gray-100 text-gray-600 disabled:opacity-40" aria-label="Fermer">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Chaque participant reçoit son lien personnel et ouvre l'album en un clic, sans code.
          </p>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin text-green-600" /> Chargement des participants…
            </div>
          ) : loadError ? (
            <p className="py-6 text-sm text-red-600 flex items-center gap-2"><AlertTriangle size={16} /> Impossible de charger la liste des participants.</p>
          ) : result ? (
            // ── Résultat ──
            <div className="space-y-4">
              {result.simulated ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  <p className="font-semibold mb-1">Envoi simulé</p>
                  Gmail n'est pas configuré sur les Edge Functions : les accès ont été accordés, mais aucun email n'est parti.
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-200">
                  <span className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0"><Check size={20} /></span>
                  <p className="text-sm text-green-900">
                    <strong>{result.sent}</strong> personne{result.sent > 1 ? 's ont' : ' a'} reçu {result.sent > 1 ? 'leur' : 'son'} lien vers l'album.
                  </p>
                </div>
              )}
              {result.failed.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
                  <p className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle size={16} /> {result.failed.length} envoi{result.failed.length > 1 ? 's' : ''} en échec
                  </p>
                  <p className="text-xs text-red-700 break-words max-h-24 overflow-y-auto">{result.failed.join(', ')}</p>
                  <button
                    onClick={() => send(result.failed)}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-red-200 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    <RotateCcw size={15} /> Réessayer
                  </button>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={onClose} className="px-7 py-2 rounded-full text-sm font-medium bg-green-600 text-white hover:bg-green-700">OK</button>
              </div>
            </div>
          ) : sending && progress ? (
            // ── Progression ──
            <div className="py-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-gray-800 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-green-600" /> Envoi en cours…
                </span>
                <span className="text-gray-500 tabular-nums">{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-3">Environ 2 emails par seconde. Ne fermez pas cette page.</p>
            </div>
          ) : (
            // ── Formulaire ──
            <div className="space-y-4">
              <div className="space-y-2">
                {audienceOptions.map(({ key, Icon, label, count }) => {
                  const disabled = key !== 'custom' && count === 0;
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                        audience === key ? 'border-green-600 bg-green-50/60 ring-1 ring-green-600' : 'border-gray-200 hover:bg-gray-50'
                      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <input
                        type="radio"
                        name="album-audience"
                        checked={audience === key}
                        onChange={() => setAudience(key)}
                        className="w-4 h-4 accent-green-600"
                      />
                      <Icon size={18} className="text-gray-500" />
                      <span className="flex-1 text-sm text-gray-900">{label}</span>
                      <span className="text-sm font-semibold text-gray-700 tabular-nums">
                        {key === 'custom' ? (count ? `${count} choisi${count > 1 ? 's' : ''}` : '') : count}
                      </span>
                    </label>
                  );
                })}
              </div>

              {audience === 'custom' ? (
                // ── Sélection manuelle ──
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="p-3 border-b border-gray-100 space-y-2.5 bg-gray-50/60">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un nom ou un email"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={extraDraft}
                        onChange={(e) => { setExtraDraft(e.target.value); setExtraError(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtraEmail(); } }}
                        placeholder="Ajouter une adresse (ex. la vôtre pour un test)"
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                      />
                      <button
                        type="button"
                        onClick={addExtraEmail}
                        className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-green-700 hover:bg-green-50 inline-flex items-center gap-1 flex-shrink-0"
                      >
                        <Plus size={15} /> Ajouter
                      </button>
                    </div>
                    {extraError && <p className="text-xs text-red-600">{extraError}</p>}
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                    <span>{filteredContacts.length} participant{filteredContacts.length > 1 ? 's' : ''}{search ? ' trouvé' + (filteredContacts.length > 1 ? 's' : '') : ''}</span>
                    {filteredContacts.length > 0 && (
                      <button type="button" onClick={toggleAllFiltered} className="font-medium text-green-700 hover:text-green-800">
                        {allFilteredSelected ? 'Tout décocher' : 'Tout cocher'}
                      </button>
                    )}
                  </div>

                  <ul className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {extraEmails.map((email) => (
                      <li key={email}>
                        <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={selected.has(email)} onChange={() => toggle(email)} className="w-4 h-4 rounded accent-green-600 flex-shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-gray-900 truncate">{email}</span>
                            <span className="block text-xs text-gray-500">Adresse ajoutée (hors inscrits)</span>
                          </span>
                        </label>
                      </li>
                    ))}
                    {filteredContacts.map((c) => (
                      <li key={c.email}>
                        <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={selected.has(c.email)} onChange={() => toggle(c.email)} className="w-4 h-4 rounded accent-green-600 flex-shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-gray-900 truncate">
                              {c.name || <span className="italic text-gray-500">Réservation groupée{c.tickets > 1 ? ` · ${c.tickets} billets` : ''}</span>}
                            </span>
                            <span className="block text-xs text-gray-500 truncate">{c.email}</span>
                          </span>
                          <span className="flex flex-col items-end gap-1 flex-shrink-0">
                            {c.scanned && <span className="px-1.5 py-0.5 rounded-md bg-green-100 text-green-800 text-[10px] font-semibold">Présent</span>}
                            {alreadyNotified.has(c.email) && <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-semibold">Déjà notifié</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                    {filteredContacts.length === 0 && extraEmails.length === 0 && (
                      <li className="px-3 py-6 text-center text-sm text-gray-500">
                        {contacts.length === 0 ? 'Aucun inscrit avec une adresse email pour cet événement.' : 'Aucun participant ne correspond.'}
                      </li>
                    )}
                  </ul>
                </div>
              ) : (
                alreadyCount > 0 && (
                  <label className="flex items-center gap-3 text-sm text-gray-800 cursor-pointer">
                    <input type="checkbox" checked={skipNotified} onChange={(e) => setSkipNotified(e.target.checked)} className="w-5 h-5 rounded accent-green-600" />
                    Ne pas renvoyer aux {alreadyCount} personne{alreadyCount > 1 ? 's' : ''} déjà notifiée{alreadyCount > 1 ? 's' : ''}
                  </label>
                )
              )}

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={`Message (facultatif) — ex. : Merci d'avoir fait de « ${eventTitle} » un moment inoubliable !`}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 resize-none"
              />

              <p className="text-xs text-gray-500 flex items-start gap-1.5">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                Les destinataires sont ajoutés aux « Personnes ayant accès », quel que soit l'accès général de l'album. Lien valable 30 jours.
              </p>
              {recipients.length > GMAIL_DAILY_WARNING && (
                <p className="text-xs text-amber-700 flex items-start gap-1.5">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  Un compte Gmail gratuit envoie environ 500 emails par jour : au-delà, les envois échoueront et pourront être relancés le lendemain.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="px-5 py-2 rounded-full text-sm font-medium text-green-700 hover:bg-green-50">Annuler</button>
                <button
                  onClick={() => send(recipients)}
                  disabled={recipients.length === 0}
                  className="px-5 py-2 rounded-full text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Send size={15} />
                  {recipients.length === 0
                    ? audience === 'custom' ? 'Cochez au moins une personne' : 'Tout le monde a déjà reçu le lien'
                    : `Envoyer à ${recipients.length} personne${recipients.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlbumNotifyModal;
