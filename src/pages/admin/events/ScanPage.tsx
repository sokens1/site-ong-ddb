import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { ScanLine, CheckCircle, XCircle, Search, User, Calendar, MapPin, RefreshCw, Camera, StopCircle, AlertTriangle, Award, Send, Download, Loader2, Ticket, Crown, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import { generateCertificatePDF, CertificateTemplate } from '../../../utils/certificatePdf';

const VISITOR_EMAIL = 'visiteur@ong-ddb.org';

interface ScanEventInfo {
  title: string;
  event_date: string;
  location?: string;
  logo_url?: string;
  organizer_logos?: string[];
  price?: number | null;
  ticket_tiers?: { id: string; label: string; price: number | null; description?: string }[];
  certificate_enabled?: boolean;
  certificate_template?: CertificateTemplate;
  certificate_title?: string;
  certificate_subtitle?: string;
  certificate_text?: string;
  certificate_signatory_name?: string;
  certificate_signatory_title?: string;
  certificate_signatory_signature?: string;
  certificate_signatory2_name?: string;
  certificate_signatory2_title?: string;
  certificate_signatory2_signature?: string;
  certificate_participant_quality?: string;
}

/** Extrait les informations de tarif / catégorie (VIP, Standard, Gratuit…) d'un billet scanné */
const getTicketTierInfo = (reg: ScanRegistration) => {
  const cd = reg.custom_data || {};
  const ev = reg.event;

  // Cherche un éventuel champ personnalisé lié à la catégorie / pass / tarif
  let customCategory = '';
  for (const [k, v] of Object.entries(cd)) {
    if (
      typeof v === 'string' &&
      v.trim() &&
      /^(categorie|catégorie|tarif|pass|formule|type_billet|vip)$/i.test(k)
    ) {
      customCategory = v.trim();
      break;
    }
  }

  const tierLabel: string =
    cd.ticket_tier ||
    cd.tier_label ||
    customCategory ||
    (cd.is_paid_booking ? 'Billet Standard' : (ev.price && ev.price > 0 ? 'Billet Payant' : 'Accès Gratuit'));

  const isVip = /\b(vip|vvip|premium|gold|or|honneur|officiel|privil[eè]ge)\b/i.test(tierLabel);
  const isPaidBooking = Boolean(cd.is_paid_booking || (ev.price && ev.price > 0) || (ev.ticket_tiers && ev.ticket_tiers.length > 0 && cd.unit_price > 0));
  const unitPrice: number | null =
    cd.unit_price != null ? Number(cd.unit_price) : ev.price != null && ev.price > 0 ? Number(ev.price) : null;
  const paymentStatus: 'paid' | 'pending' | 'free' = isPaidBooking
    ? cd.payment_status === 'paid'
      ? 'paid'
      : 'pending'
    : 'free';

  return {
    tierLabel,
    isVip,
    isPaidBooking,
    unitPrice,
    paymentStatus,
    orderRef: cd.order_ref as string | undefined,
    groupSize: cd.group_size as number | undefined,
    participantIndex: cd.participant_index as number | undefined,
  };
};

interface ScanRegistration {
  id: number;
  fullname: string;
  email: string;
  ticket_ref?: string;
  custom_data?: Record<string, any>;
  scanned_at?: string;
  certificate_sent_at?: string;
  event: ScanEventInfo;
  created_at: string;
}

interface ScanResult {
  status: 'valid' | 'already_scanned' | 'invalid' | 'idle';
  registration?: ScanRegistration;
  message?: string;
}

interface EventOption {
  id: number;
  title: string;
  event_date: string;
  status?: string;
}

/** Répare les chaînes UTF-8 décodées par erreur en Latin-1 par certains lecteurs QR */
const fixUtf8Mojibake = (str: string): string => {
  if (!/[\u00C2-\u00DF][\u0080-\u00BF]/.test(str)) return str;
  try {
    const bytes = new Uint8Array([...str].map(ch => ch.charCodeAt(0) & 0xff));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return str;
  }
};

const normalizeStr = (s: string): string =>
  fixUtf8Mojibake(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const ScanPage: React.FC = () => {
  const [scanInput, setScanInput] = useState('');
  const [result, setResult] = useState<ScanResult>({ status: 'idle' });
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanResult['registration'][]>([]);
  const [certSending, setCertSending] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  // Event filter state (persisted in localStorage across page reloads)
  const SCAN_EVENT_STORAGE_KEY = 'ddb_scan_selected_event_id';
  const [eventsList, setEventsList] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    try {
      return localStorage.getItem('ddb_scan_selected_event_id') || 'all';
    } catch {
      return 'all';
    }
  });
  const selectedEventIdRef = useRef<string>(selectedEventId);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, event_date, status')
        .order('event_date', { ascending: false });
      if (data && data.length > 0) {
        setEventsList(data);
        let savedId: string | null = null;
        try {
          savedId = localStorage.getItem(SCAN_EVENT_STORAGE_KEY);
        } catch {
          savedId = null;
        }
        const savedExists =
          savedId === 'all' || (savedId && data.some(e => String(e.id) === savedId));

        if (savedExists && savedId) {
          setSelectedEventId(savedId);
          selectedEventIdRef.current = savedId;
        } else {
          // Sélectionne par défaut l'événement publié le plus récent / à venir
          const published = data.find(e => e.status === 'published') || data[0];
          if (published) {
            const defaultId = String(published.id);
            setSelectedEventId(defaultId);
            selectedEventIdRef.current = defaultId;
            try {
              localStorage.setItem(SCAN_EVENT_STORAGE_KEY, defaultId);
            } catch {
              // ignore storage errors
            }
          }
        }
      }
    };
    loadEvents();
  }, []);

  // Mode d'onglet ('camera' | 'manual') dissocié de l'état flux vidéo cameraActive
  // pour ne jamais forcer le retour sur l'onglet Saisie manuelle après un scan caméra.
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  const getRecipientEmail = (reg: ScanRegistration): string => {
    if (reg.email && reg.email !== VISITOR_EMAIL) return reg.email;
    if (reg.custom_data?.buyer_email && reg.custom_data.buyer_email !== VISITOR_EMAIL) {
      return reg.custom_data.buyer_email;
    }
    return '';
  };

  const buildCertificateForReg = async (reg: ScanRegistration) => {
    const ev = reg.event;
    return generateCertificatePDF(
      reg.fullname,
      ev.title || '',
      ev.event_date || '',
      ev.certificate_template || 'classic',
      ev.logo_url,
      ev.organizer_logos,
      {
        title: ev.certificate_title,
        subtitle: ev.certificate_subtitle,
        text: ev.certificate_text,
        signatoryName: ev.certificate_signatory_name,
        signatoryTitle: ev.certificate_signatory_title,
        signatorySignature: ev.certificate_signatory_signature,
        signatory2Name: ev.certificate_signatory2_name,
        signatory2Title: ev.certificate_signatory2_title,
        signatory2Signature: ev.certificate_signatory2_signature,
        participantQuality: ev.certificate_participant_quality,
      },
    );
  };

  const handleDownloadCertificate = async (reg: ScanRegistration) => {
    try {
      const doc = await buildCertificateForReg(reg);
      const cleanTitle = (reg.event.title || 'evenement').replace(/[^a-z0-9]/gi, '_');
      const cleanName = (reg.fullname || 'participant').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Certificat_${cleanName}_${cleanTitle}.pdf`);
    } catch (err: any) {
      setCertError(err?.message || 'Erreur lors du téléchargement du certificat.');
    }
  };

  const handleSendCertificate = async (reg: ScanRegistration) => {
    const recipientEmail = getRecipientEmail(reg);
    if (!recipientEmail) {
      setCertError('Aucune adresse e-mail valide associée à ce billet.');
      return;
    }
    setCertSending(true);
    setCertError(null);
    try {
      const doc = await buildCertificateForReg(reg);
      const pdfBase64 = doc.output('datauristring').split('base64,')[1];
      const cleanTitle = (reg.event.title || 'evenement').replace(/[^a-z0-9]/gi, '_');

      const { data: fnData, error: fnError } = await supabase.functions.invoke('send-event-certificate', {
        body: {
          email: recipientEmail,
          fullname: reg.fullname,
          eventTitle: reg.event.title,
          pdfBase64,
          pdfName: `Certificat_${cleanTitle}.pdf`,
        },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      const sentAt = new Date().toISOString();
      await supabase
        .from('event_registrations')
        .update({ certificate_sent_at: sentAt })
        .eq('id', reg.id);

      setResult(prev =>
        prev.registration && prev.registration.id === reg.id
          ? { ...prev, registration: { ...prev.registration, certificate_sent_at: sentAt } }
          : prev
      );
    } catch (err: any) {
      console.error('Erreur envoi certificat:', err);
      setCertError(err?.message || "Erreur lors de l'envoi du certificat.");
    } finally {
      setCertSending(false);
    }
  };

  const performScan = async (rawInput: string) => {
    const decodedInput = fixUtf8Mojibake(rawInput || '').trim();
    if (!decodedInput) return;
    setLoading(true);
    setCertError(null);
    setResult({ status: 'idle' });

    const activeEventId = selectedEventIdRef.current;

    try {
      // Parse QR code format (supports multi-line and single-line classic, modern, and invitation QR formats)
      let fullname = '';
      let eventTitle = '';

      const participantMatch = decodedInput.match(
        /(?:Participant|Invit[ée])\s*:\s*(.+?)(?=\s*(?:\r?\n|(?:[EÉ]v[eé]nement|Date|Lieu)\s*:|$))/i
      );
      const eventMatch = decodedInput.match(
        /(?:[EÉ]v[eé]nement)\s*:\s*(.+?)(?=\s*(?:\r?\n|(?:Date|Lieu)\s*:|$))/i
      );

      if (participantMatch) fullname = participantMatch[1].trim();
      if (eventMatch) eventTitle = eventMatch[1].trim();

      let query = supabase
        .from('event_registrations')
        .select(`
          id,
          event_id,
          fullname,
          email,
          ticket_ref,
          custom_data,
          created_at,
          scanned_at,
          certificate_sent_at,
          events!inner (*)
        `)
        .order('created_at', { ascending: false })
        .limit(30);

      if (fullname && eventTitle) {
        query = query.ilike('fullname', `%${fullname}%`);
        if (activeEventId !== 'all') {
          query = query.eq('event_id', Number(activeEventId));
        }
      } else {
        const q = decodedInput;
        const numId = Number(q);
        if (activeEventId !== 'all') {
          query = query.eq('event_id', Number(activeEventId));
        }
        if (Number.isInteger(numId) && numId > 0 && /^\d+$/.test(q)) {
          query = query.eq('id', numId);
        } else {
          query = query.or(
            `ticket_ref.ilike.%${q}%,email.ilike.%${q}%,fullname.ilike.%${q}%,custom_data->>buyer_email.ilike.%${q}%`
          );
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      let candidates = (data || []) as any[];

      // Si le QR code mentionne un titre d'événement précis, vérifie la correspondance
      if (eventTitle) {
        const normQrEvent = normalizeStr(eventTitle);
        if (activeEventId !== 'all') {
          const selectedEv = eventsList.find(e => String(e.id) === activeEventId);
          if (selectedEv) {
            const normSelected = normalizeStr(selectedEv.title);
            if (
              normQrEvent &&
              normSelected &&
              !normSelected.includes(normQrEvent) &&
              !normQrEvent.includes(normSelected)
            ) {
              setResult({
                status: 'invalid',
                message: `Ce QR code correspond à un autre événement (« ${eventTitle} ») et non à « ${selectedEv.title} ».`,
              });
              return;
            }
          }
        } else {
          const matchingByTitle = candidates.filter(c => {
            const evTitle = normalizeStr(c.events?.title || '');
            return evTitle.includes(normQrEvent) || normQrEvent.includes(evTitle);
          });
          if (matchingByTitle.length > 0) {
            candidates = matchingByTitle;
          }
        }
      }

      // En mode "Tous les événements", si plusieurs inscriptions existent pour la même personne,
      // on privilégie l'événement le plus récent (et non scanné en priorité).
      if (candidates.length > 1 && activeEventId === 'all') {
        candidates.sort((a, b) => {
          const aScanned = a.scanned_at ? 1 : 0;
          const bScanned = b.scanned_at ? 1 : 0;
          if (aScanned !== bScanned) return aScanned - bScanned;
          const aDate = new Date(a.events?.event_date || a.created_at || 0).getTime();
          const bDate = new Date(b.events?.event_date || b.created_at || 0).getTime();
          return bDate - aDate;
        });
      }

      if (candidates.length === 0) {
        const selectedEv = activeEventId !== 'all' ? eventsList.find(e => String(e.id) === activeEventId) : null;
        setResult({
          status: 'invalid',
          message: selectedEv
            ? `Aucune inscription trouvée pour ce billet dans l'événement « ${selectedEv.title} ».`
            : 'Aucune inscription trouvée pour ce billet. Vérifiez le code ou réessayez.',
        });
      } else {
        const reg = candidates[0] as any;
        const ev = reg.events || {};
        const registration: ScanRegistration = {
          id: reg.id,
          fullname: reg.fullname,
          email: reg.email,
          ticket_ref: reg.ticket_ref,
          custom_data: reg.custom_data,
          scanned_at: reg.scanned_at,
          certificate_sent_at: reg.certificate_sent_at,
          created_at: reg.created_at,
          event: {
            title: ev.title || '—',
            event_date: ev.event_date || '',
            location: ev.location,
            logo_url: ev.logo_url,
            organizer_logos: Array.isArray(ev.organizer_logos) ? ev.organizer_logos : [],
            price: ev.price,
            ticket_tiers: Array.isArray(ev.ticket_tiers) ? ev.ticket_tiers : [],
            certificate_enabled: !!ev.certificate_enabled,
            certificate_template: ev.certificate_template || 'classic',
            certificate_title: ev.certificate_title,
            certificate_subtitle: ev.certificate_subtitle,
            certificate_text: ev.certificate_text,
            certificate_signatory_name: ev.certificate_signatory_name,
            certificate_signatory_title: ev.certificate_signatory_title,
            certificate_signatory_signature: ev.certificate_signatory_signature,
            certificate_signatory2_name: ev.certificate_signatory2_name,
            certificate_signatory2_title: ev.certificate_signatory2_title,
            certificate_signatory2_signature: ev.certificate_signatory2_signature,
            certificate_participant_quality: ev.certificate_participant_quality,
          },
        };

        if (reg.scanned_at) {
          // Already scanned ticket
          setResult({
            status: 'already_scanned',
            registration,
            message: `Ce billet a déjà été scanné le ${new Date(reg.scanned_at).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
            })}`
          });
        } else {
          // Mark ticket as scanned in the database immediately
          const scanTime = new Date().toISOString();
          const { error: updateError } = await supabase
            .from('event_registrations')
            .update({ scanned_at: scanTime })
            .eq('id', reg.id);

          if (updateError) throw updateError;

          registration.scanned_at = scanTime;
          setResult({ status: 'valid', registration });

          // Add to history
          setRecentScans(prev => {
            const exists = prev.some(item => item?.id === registration.id);
            if (exists) return prev;
            return [registration, ...prev.slice(0, 9)];
          });
        }
      }
    } catch (err: any) {
      setResult({ status: 'invalid', message: err.message || 'Erreur lors de la vérification.' });
    } finally {
      setLoading(false);
    }
  };

  // Setup / teardown scanner
  useEffect(() => {
    if (cameraActive) {
      setCameraError(null);
      const timeout = setTimeout(() => {
        try {
          const scanner = new Html5Qrcode("reader");
          qrScannerRef.current = scanner;

          scanner.start(
            { facingMode: "environment" },
            {
              fps: 15,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.75;
                return { width: size, height: size };
              }
            },
            (qrCodeMessage) => {
              performScan(qrCodeMessage);
              setCameraActive(false);
            },
            () => {
              // silent scan failures
            }
          ).catch(err => {
            console.error("Camera start error:", err);
            setCameraError("Impossible d'accéder à la caméra. Veuillez autoriser l'accès.");
            setCameraActive(false);
          });
        } catch (e: any) {
          console.error("Scanner init error:", e);
          setCameraError("Erreur d'initialisation de la caméra.");
          setCameraActive(false);
        }
      }, 300);

      return () => {
        clearTimeout(timeout);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [cameraActive]);

  const stopScanner = () => {
    if (qrScannerRef.current) {
      if (qrScannerRef.current.isScanning) {
        qrScannerRef.current.stop().catch(err => console.error("Stop scanner error", err));
      }
      qrScannerRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performScan(scanInput);
  };

  const handleReset = () => {
    setScanInput('');
    setResult({ status: 'idle' });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-4 md:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <ScanLine size={22} className="text-green-700" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Scan des billets</h1>
          <p className="text-xs md:text-sm text-gray-500">Vérifiez et validez les billets des participants.</p>
        </div>
      </div>

      {/* Sélecteur d'événement actif */}
      {eventsList.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Événement contrôlé
          </label>
          <select
            value={selectedEventId}
            onChange={e => {
              const val = e.target.value;
              setSelectedEventId(val);
              selectedEventIdRef.current = val;
              try {
                localStorage.setItem(SCAN_EVENT_STORAGE_KEY, val);
              } catch {
                // ignore storage errors
              }
              setResult({ status: 'idle' });
            }}
            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          >
            {eventsList.map(ev => (
              <option key={ev.id} value={String(ev.id)}>
                {ev.title}
                {ev.event_date
                  ? ` — ${new Date(ev.event_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
                  : ''}
              </option>
            ))}
            <option value="all">Tous les événements (détection automatique)</option>
          </select>
        </div>
      )}

      {/* Main scanner container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
        {/* Toggle Scan Mode */}
        <div className="flex border-b border-gray-100">
          <button
            type="button"
            onClick={() => {
              setScanMode('camera');
              setCameraActive(true);
            }}
            className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              scanMode === 'camera'
                ? 'border-green-600 text-green-700 bg-green-50/30'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Camera size={18} />
            Scanner par Caméra
          </button>
          <button
            type="button"
            onClick={() => {
              setScanMode('manual');
              setCameraActive(false);
            }}
            className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              scanMode === 'manual'
                ? 'border-green-600 text-green-700 bg-green-50/30'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search size={18} />
            Saisie manuelle
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {/* CAMERA SCANNER TAB */}
          {scanMode === 'camera' && (
            <div className="flex flex-col items-center justify-center">
              {cameraActive ? (
                <>
                  <div className="relative w-full max-w-sm aspect-square bg-black rounded-xl overflow-hidden shadow-inner border border-gray-200">
                    <div id="reader" className="w-full h-full object-cover"></div>
                    {/* Glowing scan target overlay */}
                    <div className="absolute inset-0 border-4 border-dashed border-green-500/40 pointer-events-none rounded-xl m-6 animate-pulse" />
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-green-500 shadow-[0_0_8px_#22c55e] animate-bounce pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCameraActive(false)}
                    className="mt-4 flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition-all"
                  >
                    <StopCircle size={14} /> Mettre en pause la caméra
                  </button>
                </>
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setResult({ status: 'idle' });
                      setCameraActive(true);
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-xl shadow-sm transition-all text-sm"
                  >
                    <Camera size={18} />
                    {result.status === 'idle' ? 'Activer la caméra pour scanner' : 'Scanner le billet suivant'}
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    Restez sur cet onglet pour enchaîner les scans rapidement.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* MANUAL INPUT TAB */}
          {scanMode === 'manual' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs md:text-sm text-gray-600">
                Entrez le <strong>contenu du QR Code</strong>, un <strong>ID d'inscription</strong> ou l'<strong>email</strong> du participant.
              </p>
              <div className="relative">
                <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
                <input
                  type="text"
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  placeholder="ID inscription (ex: 42) ou email..."
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none shadow-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !scanInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all disabled:opacity-50 text-sm shadow-sm"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ScanLine size={18} />
                  )}
                  {loading ? 'Vérification...' : 'Vérifier'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </form>
          )}

          {cameraError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              {cameraError}
            </div>
          )}
        </div>
      </div>

      {/* Result feedback */}
      <AnimatePresence mode="wait">
        {result.status === 'valid' && result.registration && (() => {
          const tierInfo = getTicketTierInfo(result.registration);
          return (
            <motion.div
              key="valid"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-white rounded-2xl shadow-sm border-2 border-emerald-400 p-4 sm:p-5 mb-6"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={24} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">Billet Valide ✓</p>
                    <p className="text-base font-bold text-gray-900">Accès autorisé</p>
                  </div>
                </div>

                {/* Badge Tarif / VIP bien visible dès le coup d'œil */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {tierInfo.isVip ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                      <Crown size={14} className="text-amber-600" />
                      {tierInfo.tierLabel}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Ticket size={13} />
                      {tierInfo.tierLabel}
                    </span>
                  )}
                </div>
              </div>

              {tierInfo.paymentStatus === 'pending' && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Paiement en attente de validation</p>
                    <p className="text-amber-700 mt-0.5">
                      Cette réservation payante n'a pas encore été marquée comme validée dans le back-office.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-emerald-50/50 rounded-xl p-4 space-y-3 text-xs md:text-sm">
                <div className="flex items-start gap-2.5">
                  <User size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Participant</p>
                    <p className="font-bold text-gray-900 text-sm sm:text-base">{result.registration.fullname}</p>
                    <p className="text-xs text-gray-500 break-all">{result.registration.email}</p>
                  </div>
                </div>

                {/* Catégorie / Tarif & Statut Paiement */}
                <div className="flex items-start gap-2.5">
                  <CreditCard size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Formule / Tarif</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className={`font-bold ${tierInfo.isVip ? 'text-amber-800' : 'text-gray-900'}`}>
                        {tierInfo.tierLabel}
                      </span>
                      {tierInfo.unitPrice != null && tierInfo.unitPrice > 0 && (
                        <span className="text-xs font-mono font-semibold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                          {tierInfo.unitPrice.toLocaleString('fr-FR')} XAF
                        </span>
                      )}
                      {tierInfo.isPaidBooking && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tierInfo.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {tierInfo.paymentStatus === 'paid' ? 'Payé & Validé' : 'Paiement à vérifier'}
                        </span>
                      )}
                      {tierInfo.groupSize && tierInfo.groupSize > 1 && (
                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          Place {tierInfo.participantIndex || 1}/{tierInfo.groupSize}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Événement</p>
                    <p className="font-bold text-gray-900 leading-snug">{result.registration.event.title}</p>
                    {result.registration.event.event_date && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(result.registration.event.event_date).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
                {result.registration.event.location && (
                  <div className="flex items-start gap-2.5">
                    <MapPin size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Lieu</p>
                      <p className="font-semibold text-gray-800 leading-snug">{result.registration.event.location}</p>
                    </div>
                  </div>
                )}
                <div className="pt-2.5 border-t border-emerald-100 flex items-center justify-between text-[10px] text-gray-400 flex-wrap gap-2">
                  <span>ID inscription: #{result.registration.id}</span>
                  {tierInfo.orderRef && <span>Réf: {tierInfo.orderRef}</span>}
                  <span>Inscrit le {new Date(result.registration.created_at).toLocaleDateString('fr-FR')}</span>
                </div>

                {result.registration.event.certificate_enabled && (
                  <div className="pt-3 border-t border-emerald-100 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                        <Award size={15} className="text-emerald-600" />
                        <span>Certificat :</span>
                        {certSending ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                            <Loader2 size={12} className="animate-spin" /> Envoi en cours…
                          </span>
                        ) : result.registration.certificate_sent_at ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px] font-bold">
                            <CheckCircle size={11} /> Envoyé par email
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">En attente</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadCertificate(result.registration!)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-all"
                        >
                          <Download size={13} /> PDF
                        </button>
                        {getRecipientEmail(result.registration) && (
                          <button
                            type="button"
                            onClick={() => handleSendCertificate(result.registration!)}
                            disabled={certSending}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            <Send size={13} /> {result.registration.certificate_sent_at ? 'Renvoyer' : 'Envoyer'}
                          </button>
                        )}
                      </div>
                    </div>
                    {certError && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                        {certError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}

        {result.status === 'already_scanned' && result.registration && (() => {
          const tierInfo = getTicketTierInfo(result.registration);
          return (
            <motion.div
              key="already_scanned"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-white rounded-2xl shadow-sm border-2 border-amber-400 p-4 sm:p-5 mb-6"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={24} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest leading-none">Déjà Scanné ⚠️</p>
                    <p className="text-base font-bold text-gray-900">Attention : Passage répété</p>
                  </div>
                </div>

                {/* Badge Tarif / VIP */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {tierInfo.isVip ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                      <Crown size={14} className="text-amber-600" />
                      {tierInfo.tierLabel}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">
                      <Ticket size={13} />
                      {tierInfo.tierLabel}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-amber-50/50 rounded-xl p-4 space-y-3 text-xs md:text-sm">
                <p className="text-amber-800 font-medium text-xs bg-amber-100/50 px-3 py-2 rounded-lg">
                  {result.message}
                </p>
                <div className="flex items-start gap-2.5 mt-2">
                  <User size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Participant</p>
                    <p className="font-bold text-gray-900">{result.registration.fullname}</p>
                    <p className="text-xs text-gray-500 break-all">{result.registration.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CreditCard size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Formule / Tarif</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="font-bold text-gray-900">{tierInfo.tierLabel}</span>
                      {tierInfo.unitPrice != null && tierInfo.unitPrice > 0 && (
                        <span className="text-xs font-mono font-semibold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                          {tierInfo.unitPrice.toLocaleString('fr-FR')} XAF
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Calendar size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Événement</p>
                    <p className="font-bold text-gray-900">{result.registration.event.title}</p>
                  </div>
                </div>

                {result.registration.event.certificate_enabled && (
                  <div className="pt-3 border-t border-amber-200/60 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                        <Award size={15} className="text-emerald-600" />
                        <span>Certificat :</span>
                        {certSending ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                            <Loader2 size={12} className="animate-spin" /> Envoi en cours…
                          </span>
                        ) : result.registration.certificate_sent_at ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px] font-bold">
                            <CheckCircle size={11} /> Envoyé par email
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">En attente</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadCertificate(result.registration!)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-all"
                        >
                          <Download size={13} /> PDF
                        </button>
                        {getRecipientEmail(result.registration) && (
                          <button
                            type="button"
                            onClick={() => handleSendCertificate(result.registration!)}
                            disabled={certSending}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            <Send size={13} /> {result.registration.certificate_sent_at ? 'Renvoyer' : 'Envoyer'}
                          </button>
                        )}
                      </div>
                    </div>
                    {certError && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                        {certError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}

        {result.status === 'invalid' && (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="bg-white rounded-2xl shadow-sm border-2 border-red-300 p-5 mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle size={24} className="text-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-none">Billet Invalide ✗</p>
                <p className="text-sm md:text-base font-bold text-gray-900 mt-0.5">Accès refusé</p>
                <p className="text-xs text-gray-500 mt-1">{result.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent scans list */}
      {recentScans.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
          <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Dernières vérifications</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentScans.map((reg, idx) => {
              const tierInfo = reg ? getTicketTierInfo(reg) : null;
              return (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={12} className="text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{reg?.fullname}</p>
                      <p className="text-[10px] text-gray-400 truncate">{reg?.event.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {tierInfo && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        tierInfo.isVip
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tierInfo.tierLabel}
                      </span>
                    )}
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Valide
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanPage;
