import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, X, CheckCircle, ChevronLeft, Star, MessageSquare, ChevronRight, Share2, Copy, Check, Loader2, AlertCircle, Clock, User, Plus, Minus, CreditCard, Phone, ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import PosterGeneratorModal from '../components/events/PosterGeneratorModal';
import InAppBrowserBanner from '../components/InAppBrowserBanner';
import { InAppBrowserProvider, useInAppBrowserBanner } from '../context/InAppBrowserContext';
import { isInAppBrowser } from '../utils/inAppBrowser';
import { generateTicketPDF } from '../utils/ticketPdf';
import { generateCertificatePDF } from '../utils/certificatePdf';
import Turnstile, { verifySubmission, VERIFY_MESSAGES } from '../components/Turnstile';
import { fetchPaymentSettings, DEFAULT_PAYMENT_SETTINGS, PaymentSettings } from '../utils/paymentSettings';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  options?: string[];
  required: boolean;
}

interface FeedbackConfig {
  show_stars: boolean;
  fields: FormField[];
}

interface Event {
  id: number;
  title: string;
  theme?: string;
  description: string;
  event_date: string;
  location: string;
  image_url: string | null;
  max_slots: number | null;
  status: string;
  form_fields?: FormField[];
  feedback_config?: FeedbackConfig;
  event_dates?: { date: string; label?: string }[];
  logo_url?: string;
  organizer_logos?: string[];
  partner_logos?: string[];
  slug?: string;
  poster_enabled?: boolean;
  event_type?: string;
  program?: { id: string; time?: string; title: string; speaker?: string; description?: string }[];
  ticket_tiers?: { id: string; label: string; price: number | null; description?: string }[];
  ticket_template?: 'classic' | 'modern' | 'invitation';
  invitation_text?: string;
  invitation_subtext?: string;
  certificate_enabled?: boolean;
  certificate_template?: 'classic' | 'modern';
  poster_template?: 'classic' | 'modern';
}

// ─── Registration Modal (Step-by-step) ───────────────────────────────────────


// ─── Configuration Paiement Mobile Gabon ────────────────────────────────────

const PAYMENT_CONFIG = {
  airtel: {
    id: 'airtel' as const,
    name: 'Airtel Money',
    number: '+241 77 65 00 15',
    rawNumber: '077650015',
    accountName: 'ONG DDB',
    prefix: '077 / 074',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    headerBg: 'bg-gradient-to-r from-red-600 to-rose-700',
    color: '#E60000',
  },
  moov: {
    id: 'moov' as const,
    name: 'Moov Money',
    number: '+241 66 12 34 56',
    rawNumber: '066123456',
    accountName: 'ONG DDB',
    prefix: '066 / 062',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-700',
    color: '#005CA9',
  },
  whatsappNumber: '241077617776',
};

// ─── Registration Modal (Gratuit & Payant avec Airtel / Moov) ────────────────

const EventRegistrationModal: React.FC<{
  event: Event;
  onClose: () => void;
  onGeneratePoster: (name: string) => void;
}> = ({ event, onClose, onGeneratePoster }) => {
  const { reactivate: reactivateInAppBanner } = useInAppBrowserBanner();

  // Détection si l'événement est payant
  const isPaidEvent = Boolean(
    (event.price && event.price > 0) ||
    (event.ticket_tiers && event.ticket_tiers.some(t => t.price && t.price > 0))
  );

  // Tarifs
  const paidTiers = (event.ticket_tiers || []).filter(t => t.price && t.price > 0);
  const allTiers = event.ticket_tiers || [];
  const defaultTier = paidTiers[0] || allTiers[0];
  const [selectedTierId, setSelectedTierId] = useState<string>(defaultTier?.id || '');
  const activeTier = allTiers.find(t => t.id === selectedTierId);
  const unitPrice = activeTier ? (activeTier.price || 0) : (event.price || 0);

  // Champs personnalisés
  const customFields = (event.form_fields || []).filter((f: any) => f && f.label && f.label.trim() !== '');
  const hasCustomFields = customFields.length > 0;
  
  // Champs par défaut pour flux gratuit
  const allFields = hasCustomFields
    ? customFields
    : [
        { id: 'fullname', label: 'Votre nom & prénom', type: 'text', required: true, hint: 'Comment doit-on vous appeler ?' },
        { id: 'email', label: 'Votre adresse email', type: 'email', required: true, hint: 'Pour recevoir votre billet de confirmation.' }
      ];

  const fieldsPerPage = 4;
  const totalSteps = Math.ceil(allFields.length / fieldsPerPage);
  const [freeStep, setFreeStep] = useState(0);

  // État formulaire gratuit
  const [formData, setFormData] = useState({ fullname: '', email: '' });
  const [customData, setCustomData] = useState<Record<string, any>>({});

  // État formulaire payant (Panier + Participants + Paiement)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [placesCount, setPlacesCount] = useState<number>(1);
  const [participantNames, setParticipantNames] = useState<string[]>(['']);
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [payerPhone, setPayerPhone] = useState<string>('');
  const [paymentOperator, setPaymentOperator] = useState<'airtel' | 'moov'>('airtel');
  const [copiedOperator, setCopiedOperator] = useState<'airtel' | 'moov' | null>(null);
  const [paidFlowStep, setPaidFlowStep] = useState<'details' | 'payment'>('details');
  const [whatsappLink, setWhatsappLink] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    fetchPaymentSettings().then(res => {
      if (isMounted) setPaymentSettings(res);
    });
    return () => { isMounted = false; };
  }, []);

  const currentPaymentConfig = {
    airtel: {
      id: 'airtel' as const,
      name: 'Airtel Money',
      number: paymentSettings.airtelNumber || PAYMENT_CONFIG.airtel.number,
      rawNumber: paymentSettings.airtelRawNumber || PAYMENT_CONFIG.airtel.rawNumber,
      accountName: paymentSettings.airtelAccountName || PAYMENT_CONFIG.airtel.accountName,
      prefix: '077 / 074',
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
      headerBg: 'bg-gradient-to-r from-red-600 to-rose-700',
      color: '#E60000',
    },
    moov: {
      id: 'moov' as const,
      name: 'Moov Money',
      number: paymentSettings.moovNumber || PAYMENT_CONFIG.moov.number,
      rawNumber: paymentSettings.moovRawNumber || PAYMENT_CONFIG.moov.rawNumber,
      accountName: paymentSettings.moovAccountName || PAYMENT_CONFIG.moov.accountName,
      prefix: '066 / 062',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-700',
      color: '#005CA9',
    },
    whatsappNumber: paymentSettings.whatsappNumber || PAYMENT_CONFIG.whatsappNumber,
  };

  const totalAmount = unitPrice * placesCount;

  // États globaux soumission
  const [registeredName, setRegisteredName] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaNonce, setCaptchaNonce] = useState(0);

  // ── Vérification doublon email en temps réel ──────────────────────────────
  type EmailDupStatus = 'idle' | 'checking' | 'duplicate' | 'ok';
  const [emailDupStatus, setEmailDupStatus] = useState<EmailDupStatus>('idle');
  const emailDupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFieldChange = (id: string, value: any) => {
    if (id === 'fullname' || id === 'email') {
      setFormData(prev => ({ ...prev, [id]: value }));
    } else {
      setCustomData(prev => ({ ...prev, [id]: value }));
    }
  };

  const handlePlacesChange = (newCount: number) => {
    const maxSlots = event.max_slots ? Math.min(10, event.max_slots) : 10;
    const count = Math.max(1, Math.min(maxSlots, newCount));
    setPlacesCount(count);
    setParticipantNames(prev => {
      const next = [...prev];
      while (next.length < count) next.push('');
      return next.slice(0, count);
    });
  };

  const handleParticipantChange = (index: number, val: string) => {
    setParticipantNames(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleCopyNumber = (rawNum: string, op: 'airtel' | 'moov') => {
    navigator.clipboard.writeText(rawNum);
    setCopiedOperator(op);
    setTimeout(() => setCopiedOperator(null), 2500);
  };

  // ── Vérification avant étape paiement (Flux payant) ───────────────────────
  const handleProceedToPayment = () => {
    setError(null);

    // Vérifier les participants
    for (let i = 0; i < participantNames.length; i++) {
      if (!participantNames[i].trim()) {
        setError(placesCount === 1 
          ? "Veuillez renseigner le nom complet du participant." 
          : `Veuillez renseigner le nom complet du participant ${i + 1}.`);
        return;
      }
    }

    // Vérifier l'email du payeur
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim())) {
      setError("Veuillez renseigner une adresse email valide pour recevoir vos billets.");
      return;
    }

    // Vérifier le téléphone du payeur
    if (!payerPhone.trim()) {
      setError("Veuillez renseigner votre numéro de téléphone (celui qui effectuera le paiement).");
      return;
    }

    // Vérifier champs personnalisés requis
    for (const field of customFields) {
      if (field.required) {
        const val = customData[field.id];
        if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
          setError(`Veuillez renseigner : ${field.label}`);
          return;
        }
      }
    }

    setPaidFlowStep('payment');
  };

  // ── Soumission payante : Enregistrement en attente + Redirection WhatsApp ───
  // Note : L'envoi du billet par email se fait après validation par l'administrateur en back-office.
  const handlePaidSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const check = await verifySubmission({ token: captchaToken, email: buyerEmail.trim(), kind: 'event_registration' });
    if (!check.ok) {
      setError(VERIFY_MESSAGES[check.reason ?? 'server_error'] || 'Vérification de sécurité échouée.');
      setCaptchaNonce(n => n + 1);
      setIsSubmitting(false);
      return;
    }

    const finalBuyerEmail = buyerEmail.trim();
    const finalPayerPhone = payerPhone.trim();
    const cleanParticipants = participantNames.map((n, i) => n.trim() || `Participant ${i + 1}`);
    const orderRef = `CMD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    try {
      // 1. Enregistrer chaque participant dans la base de données avec statut "pending"
      for (let i = 0; i < cleanParticipants.length; i++) {
        const pName = cleanParticipants[i];
        // Pour respecter la contrainte d'unicité, le 1er garde l'email pur, les suivants un alias
        const regEmail = i === 0 ? finalBuyerEmail : `${finalBuyerEmail.split('@')[0]}+p${i + 1}@${finalBuyerEmail.split('@')[1]}`;
        const { error: insErr } = await supabase.from('event_registrations').insert([{
          event_id: event.id,
          fullname: pName,
          email: regEmail,
          phone: finalPayerPhone || null,
          custom_data: {
            ...customData,
            order_ref: orderRef,
            is_paid_booking: true,
            payment_status: 'pending', // En attente de validation back-office
            unit_price: unitPrice,
            total_amount: totalAmount,
            ticket_tier: activeTier?.label || null,
            buyer_email: finalBuyerEmail,
            payer_phone: finalPayerPhone,
            payment_operator: paymentOperator,
            participant_index: i + 1,
            group_size: placesCount,
            all_participants: cleanParticipants,
          },
        }]);

        if (insErr && insErr.code === '23505') {
          setError('Une inscription existe déjà pour cette adresse email.');
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Message WhatsApp pré-rempli pour la confirmation
      let messageText = '';
      if (placesCount <= 1) {
        messageText = `Bonjour,\n\nJe viens de payer ma réservation :\n\n→ Numéro payeur : ${finalPayerPhone}\n→ Nom du participant : ${cleanParticipants[0]}\n→ Montant : ${totalAmount.toLocaleString('fr-FR')} XAF\n→ Événement : ${event.title}\n\nMerci de vérifier le paiement et de valider mon billet officiel.\n\nCordialement`;
      } else {
        const participantsList = cleanParticipants.map(p => `   • ${p}`).join('\n');
        messageText = `Bonjour,\n\nJe viens de payer ${placesCount} places pour l'événement "${event.title}" :\n\n→ Numéro du payeur : ${finalPayerPhone}\n→ Montant payé : ${totalAmount.toLocaleString('fr-FR')} XAF\n→ Participants :\n${participantsList}\n\nMerci de vérifier le paiement et de valider nos ${placesCount} billets officiels.\n\nCordialement`;
      }

      const targetWaNumber = currentPaymentConfig.whatsappNumber || '241077617776';
      const waUrl = `https://wa.me/${targetWaNumber}?text=${encodeURIComponent(messageText)}`;
      setWhatsappLink(waUrl);

      setRegisteredName(cleanParticipants[0]);
      setRegisteredEmail(finalBuyerEmail);
      setSuccess(true);
      setIsSubmitting(false);

      // Redirection immédiate vers WhatsApp
      try {
        window.open(waUrl, '_blank');
      } catch {}
    } catch (err: any) {
      console.error('Erreur paiement réservation:', err);
      setError(err?.message || 'Une erreur est survenue lors de la validation.');
      setIsSubmitting(false);
    }
  };

  // ── Soumission gratuite standard ──────────────────────────────────────────
  const isLastFreeStep = freeStep === totalSteps - 1;
  const progress = totalSteps > 0 ? ((freeStep + 1) / totalSteps) * 100 : 100;
  const pageFields = allFields.slice(freeStep * fieldsPerPage, (freeStep + 1) * fieldsPerPage);

  const canAdvanceFree = () => {
    if (emailDupStatus === 'duplicate') return false;
    for (const field of pageFields) {
      if (field.id === 'fullname') {
        if (!formData.fullname.trim()) return false;
      } else if (field.id === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return false;
      } else {
        if (field.required) {
          const val = customData[field.id];
          if (val === undefined || val === null) return false;
          if (Array.isArray(val) && val.length === 0) return false;
          if (typeof val === 'string' && val.trim() === '') return false;
        }
      }
    }
    return true;
  };

  const handleFreeSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    let ticketName = formData.fullname.trim();
    let ticketEmail = formData.email.trim();

    if (hasCustomFields) {
      const emailField = customFields.find((f: any) =>
        f.label.toLowerCase().includes('email') ||
        f.label.toLowerCase().includes('courriel') ||
        f.label.toLowerCase().includes('mail')
      );
      if (emailField) ticketEmail = (customData[emailField.id] || '').trim();

      const nameFields = customFields.filter((f: any) =>
        f.label.toLowerCase().includes('nom') ||
        f.label.toLowerCase().includes('prénom') ||
        f.label.toLowerCase().includes('fullname')
      );
      if (nameFields.length > 0) {
        ticketName = nameFields.map((f: any) => customData[f.id] || '').filter(Boolean).join(' ').trim();
      }
    }

    const finalName = ticketName || 'Participant';
    const finalEmail = ticketEmail;

    const check = await verifySubmission({ token: captchaToken, email: finalEmail, kind: 'event_registration' });
    if (!check.ok) {
      setError(VERIFY_MESSAGES[check.reason ?? 'server_error'] || 'Vérification échouée.');
      setCaptchaNonce(n => n + 1);
      setIsSubmitting(false);
      return;
    }

    if (finalEmail) {
      const { data: existing } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', event.id)
        .ilike('email', finalEmail.trim())
        .limit(1);
      if (existing && existing.length > 0) {
        setError('Vous êtes déjà inscrit à cet événement avec cette adresse email.');
        setIsSubmitting(false);
        return;
      }
    }

    const { error: insertError } = await supabase.from('event_registrations').insert([{
      event_id: event.id,
      fullname: finalName,
      email: finalEmail || 'visiteur@ong-ddb.org',
      phone: customData.phone || null,
      custom_data: customData,
    }]);

    if (insertError) {
      if (insertError.code === '23505') {
        setError('Vous êtes déjà inscrit à cet événement avec cette adresse email.');
      } else {
        setError(`Erreur lors de l'inscription : ${insertError.message}`);
      }
      setCaptchaNonce(n => n + 1);
      setIsSubmitting(false);
      return;
    }

    setRegisteredName(finalName);
    setRegisteredEmail(finalEmail);
    setSuccess(true);
    setIsSubmitting(false);

    if (isInAppBrowser()) reactivateInAppBanner();
    const cleanTitle = event.title.replace(/[^a-z0-9]/gi, '_');
    let pdfBase64 = '';
    try {
      const doc = await generateTicketPDF(
        finalName,
        event.title,
        event.event_date,
        event.location,
        event.organizer_logos,
        event.event_dates,
        event.ticket_template || 'classic',
        event.invitation_text,
        event.invitation_subtext
      );
      doc.save(`Billet_${cleanTitle}.pdf`);
      pdfBase64 = doc.output('datauristring').split('base64,')[1];
    } catch (pdfErr) {
      console.error('Erreur génération PDF:', pdfErr);
    }

    supabase.functions.invoke('send-event-confirmation', {
      body: {
        email: finalEmail || 'visiteur@ong-ddb.org',
        fullname: finalName,
        eventTitle: event.title,
        eventDate: event.event_date,
        eventLocation: event.location,
        pdfBase64,
        pdfName: `Billet_${cleanTitle}.pdf`,
      },
    }).catch(err => console.error('Erreur envoi email (non bloquant):', err));

    setEmailSent(true);
  };

  // ── Rendu champ dynamique (customFields) ───────────────────────────────────
  const renderField = (field: any) => {
    const value = field.id === 'fullname' ? formData.fullname : field.id === 'email' ? formData.email : customData[field.id];
    const onChange = (val: any) => handleFieldChange(field.id, val);

    return (
      <div key={field.id} className="space-y-1.5">
        <label className="block text-sm font-bold text-gray-800">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        {field.hint && <p className="text-xs text-gray-400">{field.hint}</p>}
        
        {field.id === 'fullname' && (
          <input
            autoFocus={freeStep === 0}
            type="text"
            value={formData.fullname}
            onChange={e => onChange(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white text-sm transition-all"
            placeholder="Ex: Jean Kofi"
          />
        )}

        {field.id === 'email' && (
          <div className="space-y-1">
            <div className="relative">
              <input
                type="email"
                value={formData.email}
                onChange={e => onChange(e.target.value)}
                className={`w-full px-4 py-2.5 pr-10 rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 focus:bg-white text-sm transition-all
                  ${emailDupStatus === 'duplicate'
                    ? 'border-red-400 focus:ring-red-300'
                    : emailDupStatus === 'ok'
                    ? 'border-green-400 focus:ring-green-500'
                    : 'border-gray-200 focus:ring-green-500'}`}
                placeholder="exemple@email.com"
              />
              {emailDupStatus === 'checking' && (
                <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
              )}
              {emailDupStatus === 'ok' && (
                <CheckCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
              )}
              {emailDupStatus === 'duplicate' && (
                <AlertCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
              )}
            </div>
            {emailDupStatus === 'duplicate' && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                <AlertCircle size={12} />
                Vous êtes déjà inscrit à cet événement avec cette adresse email.
              </p>
            )}
          </div>
        )}

        {field.id !== 'fullname' && field.id !== 'email' && (
          <>
            {field.type === 'text' && (
              <input
                type="text"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder="Votre réponse"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white text-sm transition-all"
              />
            )}
            {field.type === 'textarea' && (
              <textarea
                rows={2}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white text-sm transition-all resize-none"
              />
            )}
            {field.type === 'select' && (
              <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="">Sélectionner...</option>
                {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {field.type === 'radio' && (
              <div className="space-y-1.5">
                {field.options?.map((opt: string) => (
                  <label key={opt} className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${value === opt ? 'border-green-500 bg-green-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${value === opt ? 'border-green-500' : 'border-gray-300'}`}>
                      {value === opt && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                    </span>
                    <input type="radio" className="hidden" checked={value === opt} onChange={() => onChange(opt)} />
                    <span className="text-gray-800 text-xs font-medium">{opt}</span>
                  </label>
                ))}
              </div>
            )}
            {field.type === 'checkbox' && (
              <div className="space-y-1.5">
                {field.options?.map((opt: string) => {
                  const checked = (value || []).includes(opt);
                  return (
                    <label key={opt} className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-green-500 bg-green-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                        {checked && <CheckCircle size={10} className="text-white" />}
                      </span>
                      <input type="checkbox" className="hidden" checked={checked} onChange={e => {
                        const current = value || [];
                        if (e.target.checked) onChange([...current, opt]);
                        else onChange(current.filter((v: string) => v !== opt));
                      }} />
                      <span className="text-gray-800 text-xs font-medium">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '95vh' }}
      >
        {/* Header */}
        <div className="bg-green-800 text-white px-6 pt-6 pb-5 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
          {!success && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-green-300 uppercase tracking-widest font-semibold">
                  {isPaidEvent ? 'Réservation & Billetterie' : 'Inscription'}
                </span>
                {isPaidEvent && unitPrice > 0 && (
                  <span className="bg-white/15 px-2 py-0.5 rounded-full text-[11px] font-bold text-white">
                    {unitPrice.toLocaleString('fr-FR')} XAF / place
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold leading-tight pr-8 line-clamp-2">{event.title}</h3>
              
              {isPaidEvent ? (
                <div className="flex items-center gap-2 mt-3 text-xs text-green-200">
                  <span className={`px-2 py-0.5 rounded-full font-bold ${paidFlowStep === 'details' ? 'bg-white text-green-900' : 'bg-white/20 text-white'}`}>
                    1. Participants
                  </span>
                  <span>→</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${paidFlowStep === 'payment' ? 'bg-white text-green-900' : 'bg-white/20 text-white'}`}>
                    2. Paiement Airtel / Moov
                  </span>
                </div>
              ) : (
                <>
                  <div className="mt-4 bg-white/20 rounded-full h-1.5 overflow-hidden">
                    <motion.div className="h-full bg-green-300 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <p className="text-xs text-green-300 mt-1.5">Étape {freeStep + 1} sur {totalSteps}</p>
                </>
              )}
            </>
          )}
          {success && (
            <h3 className="text-lg font-bold">
              {isPaidEvent ? 'Réservation transmise avec succès !' : 'Inscription confirmée !'}
            </h3>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 140px)' }}>
          {success ? (
            <div className="text-center py-4">
              {isPaidEvent ? (
                <>
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="text-amber-600" size={32} />
                  </div>
                  <p className="text-gray-900 font-bold text-lg mb-1">
                    Réservation enregistrée avec succès !
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mb-3">
                    <Clock size={13} />
                    En attente de validation du paiement
                  </div>
                  <p className="text-gray-600 text-sm mb-4">
                    Votre déclaration de paiement sur <strong className="text-gray-900">{paymentOperator === 'airtel' ? 'Airtel Money' : 'Moov Money'}</strong> a bien été enregistrée pour <strong>{placesCount} place{placesCount > 1 ? 's' : ''}</strong>.
                  </p>

                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 text-left mb-5 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-blue-950">Validation & envoi des billets :</p>
                        <p className="text-blue-800 mt-0.5">
                          Dès que l'administration aura validé votre transaction, vos billets officiels avec QR Code seront automatiquement envoyés par email à l'adresse :
                        </p>
                        <p className="font-bold text-gray-900 mt-1 bg-white px-2.5 py-1 rounded-lg border border-blue-200 inline-block font-mono">
                          {registeredEmail}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bouton direct WhatsApp pour événement payant */}
                  {whatsappLink && (
                    <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl p-4 mb-5 text-left">
                      <p className="text-xs font-bold text-[#128C7E] uppercase tracking-wide mb-1">Confirmation WhatsApp</p>
                      <p className="text-xs text-gray-700 mb-3">
                        Pour accélérer la validation, merci d'envoyer votre message de confirmation pré-rempli sur WhatsApp si la discussion ne s'est pas ouverte :
                      </p>
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20b858] text-white font-bold py-3 px-4 rounded-xl shadow-sm text-sm transition-all"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.122 1.526 5.853L.05 23.95l6.254-1.638A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.88 9.88 0 01-5.034-1.374l-.36-.214-3.732.978.995-3.63-.235-.374A9.859 9.859 0 012.107 12c0-5.457 4.436-9.893 9.893-9.893 5.457 0 9.893 4.436 9.893 9.893 0 5.457-4.436 9.894-9.893 9.894z"/></svg>
                        Ouvrir la discussion WhatsApp
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-green-600" size={32} />
                  </div>
                  <p className="text-gray-900 font-bold text-lg mb-1">
                    Inscription confirmée !
                  </p>
                  <p className="text-gray-600 text-sm mb-4">
                    Votre billet PDF a été téléchargé automatiquement.
                  </p>

                  <div className="flex items-center justify-center gap-2 text-sm text-green-700 mb-5 bg-green-50 rounded-xl py-2.5 px-4 border border-green-100">
                    <CheckCircle size={15} className="flex-shrink-0" />
                    {registeredEmail ? `Billet envoyé à ${registeredEmail}` : 'Billet envoyé par email'}
                  </div>
                </>
              )}

              {event.poster_enabled !== false && (
                <div className="bg-green-50 rounded-xl p-4 mb-4 border border-green-100 text-left">
                  <p className="font-bold text-green-800 mb-1 text-sm">Faites le savoir !</p>
                  <p className="text-xs text-green-700 mb-3">Générez votre affiche officielle et partagez-la sur vos réseaux.</p>
                  <button
                    onClick={() => { onClose(); onGeneratePoster(registeredName || participantNames[0]); }}
                    className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-green-700 transition-colors text-sm"
                  >
                    Générer mon visuel "J'y serai"
                  </button>
                </div>
              )}
              <button onClick={onClose} className="text-gray-400 text-sm hover:text-gray-600 transition-colors">
                Fermer
              </button>
            </div>
          ) : isPaidEvent ? (
            /* ══════════════════════════════════════════════════════════════════════
               PARCOURS ÉVÉNEMENT PAYANT : 1. DÉTAILS/PARTICIPANTS -> 2. PAIEMENT
               ══════════════════════════════════════════════════════════════════════ */
            <div>
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4 font-medium">{error}</div>}

              {paidFlowStep === 'details' && (
                <div className="space-y-5">
                  {/* Choix du tarif (si plusieurs tarifs proposés) */}
                  {paidTiers.length > 1 && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Sélectionnez votre tarif
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {paidTiers.map(tier => (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => setSelectedTierId(tier.id)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              selectedTierId === tier.id
                                ? 'border-green-600 bg-green-50/50 ring-2 ring-green-500/20 shadow-sm'
                                : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                            }`}
                          >
                            <p className="font-bold text-sm text-gray-900">{tier.label}</p>
                            <p className="text-xs font-bold text-green-700 mt-0.5">
                              {tier.price ? `${tier.price.toLocaleString('fr-FR')} XAF` : 'Gratuit'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sélecteur du nombre de places */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Nombre de places</p>
                        <p className="text-xs text-gray-500">
                          {unitPrice > 0 ? `${unitPrice.toLocaleString('fr-FR')} XAF par personne` : 'Tarif standard'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => handlePlacesChange(placesCount - 1)}
                          disabled={placesCount <= 1}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-extrabold text-base text-gray-900 w-6 text-center">{placesCount}</span>
                        <button
                          type="button"
                          onClick={() => handlePlacesChange(placesCount + 1)}
                          disabled={placesCount >= 10}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Total sur une seule ligne */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-200/70 text-xs">
                      <span className="text-gray-500 font-medium">Total :</span>
                      <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                        {totalAmount.toLocaleString('fr-FR')} XAF
                      </span>
                    </div>
                  </div>

                  {/* Noms des participants (dynamique selon placesCount) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {placesCount === 1 ? 'Participant' : `Participants (${placesCount})`}
                      </label>
                      <span className="text-[11px] text-gray-400">1 ticket officiel par nom</span>
                    </div>

                    <div className="space-y-2.5">
                      {participantNames.map((name, idx) => (
                        <div key={idx} className="relative">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-green-100 text-green-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={name}
                              onChange={e => handleParticipantChange(idx, e.target.value)}
                              placeholder={idx === 0 ? "Votre nom & prénom complet" : `Participant ${idx + 1} : Nom & prénom complet`}
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white text-sm transition-all"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coordonnées du payeur */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Coordonnées de l'acheteur
                    </label>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-600">
                        Votre adresse email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={buyerEmail}
                        onChange={e => setBuyerEmail(e.target.value)}
                        placeholder="votre@email.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white text-sm transition-all"
                      />
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Tous les billets électroniques seront envoyés à cette adresse email.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-600">
                        Votre numéro de téléphone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={payerPhone}
                        onChange={e => setPayerPhone(e.target.value)}
                        placeholder="Ex: +241 77 12 34 56 ou 077 12 34 56"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white text-sm transition-all"
                      />
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Le numéro utilisé pour envoyer le paiement Airtel Money ou Moov Money.
                      </p>
                    </div>
                  </div>

                  {/* Champs dynamiques supplémentaires éventuels */}
                  {customFields.length > 0 && (
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                      {customFields.map((field: any) => renderField(field))}
                    </div>
                  )}

                  {/* Bouton passer au paiement */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleProceedToPayment}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-base active:scale-95"
                    >
                      Procéder au paiement ({totalAmount.toLocaleString('fr-FR')} XAF)
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {paidFlowStep === 'payment' && (
                <div className="space-y-5">
                  {/* Bannière montant total */}
                  <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Montant total à régler</p>
                    <p className="text-3xl font-extrabold text-emerald-950 mt-1">
                      {totalAmount.toLocaleString('fr-FR')} <span className="text-base font-semibold">XAF</span>
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      {placesCount} place{placesCount > 1 ? 's' : ''} {activeTier?.label ? `(${activeTier.label})` : ''} · {(unitPrice).toLocaleString('fr-FR')} XAF / place
                    </p>
                  </div>

                  {/* Choix opérateur Airtel / Moov */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Choisissez votre moyen de paiement
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['airtel', 'moov'] as const).map(opKey => {
                        const op = currentPaymentConfig[opKey];
                        const isSelected = paymentOperator === opKey;
                        return (
                          <button
                            key={opKey}
                            type="button"
                            onClick={() => setPaymentOperator(opKey)}
                            className={`p-3.5 rounded-2xl border-2 text-left transition-all relative ${
                              isSelected
                                ? opKey === 'airtel'
                                  ? 'border-red-600 bg-red-50/60 ring-2 ring-red-500/20'
                                  : 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                                : 'border-gray-200 hover:border-gray-300 bg-gray-50/40'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`w-3 h-3 rounded-full ${opKey === 'airtel' ? 'bg-red-600' : 'bg-blue-600'}`} />
                              {isSelected && <Check size={14} className={opKey === 'airtel' ? 'text-red-700' : 'text-blue-700'} />}
                            </div>
                            <p className="font-bold text-sm text-gray-900">{op.name}</p>
                            <p className="text-[11px] text-gray-500">{op.prefix}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Carte Numéro marchand + bouton copier */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500 font-medium">
                          Numéro marchand {currentPaymentConfig[paymentOperator].name} :
                        </p>
                        <p className="text-lg font-bold font-mono text-gray-900 tracking-wide mt-0.5">
                          {currentPaymentConfig[paymentOperator].number}
                        </p>
                        <p className="text-xs text-gray-500">
                          Titulaire : <strong className="text-gray-800">{currentPaymentConfig[paymentOperator].accountName}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyNumber(currentPaymentConfig[paymentOperator].rawNumber, paymentOperator)}
                        className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex-shrink-0 ${
                          copiedOperator === paymentOperator
                            ? 'bg-green-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        {copiedOperator === paymentOperator ? <Check size={15} /> : <Copy size={15} />}
                        {copiedOperator === paymentOperator ? 'Numéro copié !' : 'Copier'}
                      </button>
                    </div>

                    {/* Instructions claires */}
                    <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-amber-950">
                        <ShieldCheck size={14} className="text-amber-700 flex-shrink-0" />
                        Instructions de paiement :
                      </p>
                      <p>1. Ouvrez votre application <strong>{currentPaymentConfig[paymentOperator].name}</strong> sur votre téléphone.</p>
                      <p>2. Payez exactement le montant de <strong>{totalAmount.toLocaleString('fr-FR')} XAF</strong> vers le numéro ci-dessus.</p>
                      <p>3. Cliquez ci-dessous sur <strong>« J’ai effectué le paiement »</strong> pour finaliser.</p>
                    </div>
                  </div>

                  {/* Numéro du payeur */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Numéro du payeur (votre numéro) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={payerPhone}
                      onChange={e => setPayerPhone(e.target.value)}
                      placeholder="Ex: +241 77 123 456"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm transition-all"
                    />
                    <p className="text-[11px] text-gray-400">Le numéro qui a effectué le transfert d'argent.</p>
                  </div>

                  {/* Récapitulatif commande */}
                  <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-2">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Récapitulatif de la réservation</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p><span className="font-semibold text-gray-800">Événement :</span> {event.title}</p>
                      <p><span className="font-semibold text-gray-800">Participants ({placesCount}) :</span></p>
                      <ul className="pl-4 list-disc space-y-0.5 text-gray-700">
                        {participantNames.map((n, i) => (
                          <li key={i}><strong className="text-gray-900">{n || `Participant ${i + 1}`}</strong></li>
                        ))}
                      </ul>
                      <p className="pt-1 text-[11px] text-gray-500">
                        Billets envoyés à : <strong className="text-gray-800">{buyerEmail}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Anti-bot Turnstile */}
                  <div className="mt-4">
                    <Turnstile onToken={setCaptchaToken} resetSignal={captchaNonce} />
                  </div>

                  {/* Boutons retour & validation */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPaidFlowStep('details')}
                      className="px-4 py-3 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={handlePaidSubmit}
                      disabled={isSubmitting || !payerPhone.trim()}
                      className="flex-1 bg-[#25D366] hover:bg-[#20b858] text-white font-bold py-3.5 rounded-xl transition-all shadow-md disabled:opacity-40 flex items-center justify-center gap-2 text-sm sm:text-base active:scale-95"
                    >
                      {isSubmitting ? (
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.122 1.526 5.853L.05 23.95l6.254-1.638A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.88 9.88 0 01-5.034-1.374l-.36-.214-3.732.978.995-3.63-.235-.374A9.859 9.859 0 012.107 12c0-5.457 4.436-9.893 9.893-9.893 5.457 0 9.893 4.436 9.893 9.893 0 5.457-4.436 9.894-9.893 9.894z"/></svg>
                          J’ai effectué le paiement
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════════════
               PARCOURS ÉVÉNEMENT GRATUIT : STEP-BY-STEP HABITUEL
               ══════════════════════════════════════════════════════════════════════ */
            <div>
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

              <div className="space-y-5">
                {pageFields.map((field: any) => renderField(field))}
              </div>

              {isLastFreeStep && <div className="mt-5"><Turnstile onToken={setCaptchaToken} resetSignal={captchaNonce} /></div>}

              <div className="flex gap-3 mt-6">
                {freeStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setFreeStep(s => s - 1)}
                    className="px-5 py-3 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Retour
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!canAdvanceFree()) return;
                    if (isLastFreeStep) handleFreeSubmit();
                    else setFreeStep(s => s + 1);
                  }}
                  disabled={!canAdvanceFree() || isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isLastFreeStep ? (
                    'Confirmer mon inscription'
                  ) : (
                    <>Suivant <ChevronRight size={18} /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Feedback Form ────────────────────────────────────────────────────────────

const FeedbackModal: React.FC<{ event: Event; onClose: () => void }> = ({ event, onClose }) => {
  const config: FeedbackConfig = event.feedback_config ?? { show_stars: true, fields: [] };

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleCustomChange = (id: string, value: any) => setCustomAnswers(p => ({ ...p, [id]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (config.show_stars && rating === 0) return;
    setStatus('submitting');
    const { error } = await supabase.from('event_feedbacks').insert([{
      event_id: event.id,
      rating: config.show_stars ? rating : null,
      custom_answers: customAnswers,
    }]);
    setStatus(error ? 'error' : 'success');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '95vh' }}
      >
        <div className="bg-green-800 text-white px-6 pt-6 pb-5 relative">
          <button onClick={onClose} aria-label="Fermer" className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-green-300">
              <MessageSquare size={20} />
            </div>
            <div>
              <p className="text-xs text-green-300 uppercase tracking-widest font-semibold mb-0.5">Votre avis</p>
              <h3 className="text-lg font-bold leading-tight pr-8 line-clamp-2">{event.title}</h3>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 110px)' }}>
          {status === 'success' ? (
            <div className="text-center py-4">
              <CheckCircle className="mx-auto mb-2 text-green-500" size={32} />
              <p className="font-bold text-gray-800">Merci pour votre retour !</p>
              <p className="mt-1 text-sm text-gray-500">Votre avis a bien été enregistré.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {status === 'error' && <p className="text-sm text-red-500">Une erreur s'est produite. Veuillez réessayer.</p>}

              {/* Stars */}
              {config.show_stars && (
                <div>
                  <label className="mb-3 block text-sm font-bold text-gray-700">Note globale *</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star} type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          size={36}
                          className={(hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-200'}
                          fill={(hoverRating || rating) >= star ? 'currentColor' : 'none'}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom fields */}
              {config.fields.map(field => (
                <div key={field.id}>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  {field.type === 'text' && (
                    <input required={field.required} type="text" value={customAnswers[field.id] || ''}
                      onChange={e => handleCustomChange(field.id, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                  )}
                  {field.type === 'textarea' && (
                    <textarea required={field.required} rows={3} value={customAnswers[field.id] || ''}
                      onChange={e => handleCustomChange(field.id, e.target.value)}
                      className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                  )}
                  {field.type === 'select' && (
                    <select required={field.required} value={customAnswers[field.id] || ''}
                      onChange={e => handleCustomChange(field.id, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500">
                      <option value="">Sélectionner...</option>
                      {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  )}
                  {field.type === 'radio' && (
                    <div className="space-y-2">
                      {field.options?.map(opt => (
                        <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${customAnswers[field.id] === opt ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                          <input type="radio" className="w-4 h-4 text-green-600" checked={customAnswers[field.id] === opt} onChange={() => handleCustomChange(field.id, opt)} />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {field.type === 'checkbox' && (
                    <div className="space-y-2">
                      {field.options?.map(opt => {
                        const checked = (customAnswers[field.id] || []).includes(opt);
                        return (
                          <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checked ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                            <input type="checkbox" className="w-4 h-4 rounded text-green-600 border-gray-300" checked={checked} onChange={e => {
                              const current = customAnswers[field.id] || [];
                              if (e.target.checked) handleCustomChange(field.id, [...current, opt]);
                              else handleCustomChange(field.id, current.filter((v: string) => v !== opt));
                            }} />
                            <span className="text-sm">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={(config.show_stars && rating === 0) || status === 'submitting'}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {status === 'submitting' ? 'Envoi en cours...' : 'Soumettre mon avis'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [otherEvents, setOtherEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [seatsTaken, setSeatsTaken] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [posterState, setPosterState] = useState<{isOpen: boolean; name: string}>({ isOpen: false, name: '' });
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const recoveryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [certRecoveryOpen, setCertRecoveryOpen] = useState(false);
  const [certRecoveryEmail, setCertRecoveryEmail] = useState('');
  const [certRecoveryLoading, setCertRecoveryLoading] = useState(false);
  const [certRecoveryError, setCertRecoveryError] = useState<string | null>(null);
  const certRecoveryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const fetchEventData = async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      // Essai par slug d'abord, puis par ID numérique (rétrocompatibilité)
      let eventData: Event | null = null;
      const isNumericId = /^\d+$/.test(id);

      if (!isNumericId) {
        const { data } = await supabase.from('events').select('*').eq('slug', id).single();
        if (data) eventData = data;
      }
      if (!eventData) {
        const query = isNumericId
          ? supabase.from('events').select('*').eq('id', id).single()
          : supabase.from('events').select('*').eq('slug', id).single();
        const { data } = await query;
        if (data) eventData = data;
      }

      setEvent(eventData);

      if (eventData) {
        // Cartes "autres événements" : seules ces colonnes sont affichées
        const { data: othersData } = await supabase
          .from('events').select('id, slug, title, event_date, image_url')
          .eq('status', 'published').neq('id', eventData.id)
          .order('event_date', { ascending: false }).limit(8);
        if (othersData) setOtherEvents(othersData as unknown as Event[]);

        // Nombre d'inscrits (uniquement si l'event a une limite de places)
        if (eventData.max_slots) {
          const { count } = await supabase
            .from('event_registrations')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', eventData.id);
          setSeatsTaken(count ?? 0);
        }
      }
    } catch (err) {
      console.error('Error fetching event:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventStatus = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (eventDay === today) return { label: 'En cours', color: 'bg-emerald-600' };
    if (eventDate.getTime() > now.getTime()) return { label: 'Bientôt', color: 'bg-green-600' };
    return { label: 'Terminé', color: 'bg-gray-500' };
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchEventData();
  }, [id]);

  // Vérification automatique dès que l'email est valide (debounce 700ms)
  // Placé avant les early returns pour respecter les Rules of Hooks
  useEffect(() => {
    if (!recoveryOpen || !event) return;
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail.trim());
    if (!isValidEmail) { setRecoveryError(null); return; }
    if (recoveryDebounce.current) clearTimeout(recoveryDebounce.current);
    recoveryDebounce.current = setTimeout(async () => {
      setRecoveryLoading(true);
      setRecoveryError(null);
      const { data: name, error } = await supabase.rpc('get_registration_name', {
        p_event_id: event.id,
        p_email: recoveryEmail.trim(),
      });
      setRecoveryLoading(false);
      if (!error && name) {
        setRecoveryOpen(false);
        setPosterState({ isOpen: true, name: String(name) });
      } else {
        setRecoveryError('Aucune inscription trouvée pour cet email.');
      }
    }, 700);
    return () => { if (recoveryDebounce.current) clearTimeout(recoveryDebounce.current); };
  }, [recoveryEmail, recoveryOpen, event]);

  // Vérification automatique pour la récupération du certificat (debounce 700ms)
  useEffect(() => {
    if (!certRecoveryOpen || !event) return;
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(certRecoveryEmail.trim());
    if (!isValidEmail) { setCertRecoveryError(null); return; }
    if (certRecoveryDebounce.current) clearTimeout(certRecoveryDebounce.current);
    certRecoveryDebounce.current = setTimeout(async () => {
      setCertRecoveryLoading(true);
      setCertRecoveryError(null);
      const { data: name, error } = await supabase.rpc('get_registration_name', {
        p_event_id: event.id,
        p_email: certRecoveryEmail.trim(),
      });
      setCertRecoveryLoading(false);
      if (!error && name) {
        setCertRecoveryOpen(false);
        try {
          const doc = await generateCertificatePDF(String(name), event.title, event.event_date, event.certificate_template || 'classic', event.logo_url);
          const cleanTitle = event.title.replace(/[^a-z0-9]/gi, '_');
          doc.save(`Certificat_${cleanTitle}.pdf`);
        } catch (certErr) {
          console.error('Erreur génération certificat:', certErr);
        }
      } else {
        setCertRecoveryError('Aucune inscription trouvée pour cet email.');
      }
    }, 700);
    return () => { if (certRecoveryDebounce.current) clearTimeout(certRecoveryDebounce.current); };
  }, [certRecoveryEmail, certRecoveryOpen, event]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center py-20">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 py-20">
        <div className="container mx-auto px-4 text-center">
          <Calendar size={64} className="mx-auto text-gray-300 mb-6" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Événement introuvable</h1>
          <p className="text-gray-500 mb-8">Cet événement n'existe pas ou a été archivé.</p>
          <Link to="/#evenements" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl transition-colors inline-block">
            Tous les événements
          </Link>
        </div>
      </div>
    );
  }

  const status = getEventStatus(event.event_date);
  const isPast = status.label === 'Terminé';
  const isFull = event.max_slots != null && seatsTaken != null && seatsTaken >= event.max_slots;
  const feedbackConfig: FeedbackConfig = event.feedback_config ?? { show_stars: true, fields: [] };
  const hasFeedback = feedbackConfig.show_stars || feedbackConfig.fields.length > 0;

  return (
    <InAppBrowserProvider>
    <div className="min-h-screen bg-ddb-900 pb-28 lg:pb-20">
      <InAppBrowserBanner />

      {/* ── Hero : mobile = image + tout superposé dessus ; desktop = image à gauche, éléments à droite ── */}
      <div className="relative -mt-24 bg-ddb-900 pt-24 lg:grid lg:grid-cols-2 lg:items-stretch">
        {/* Image */}
        <div className="relative h-[75vh] min-h-[480px] w-full overflow-hidden sm:h-[620px] lg:h-auto lg:min-h-[640px]">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`absolute inset-0 flex items-center justify-center bg-ddb-900 ${event.image_url ? 'hidden' : ''}`}
          >
            <Calendar size={64} className="text-white/20" />
          </div>

          {/* Contrôles + titre superposés — mobile/tablette uniquement */}
          <div className="absolute inset-0 bg-gradient-to-t from-ddb-900 via-black/10 to-black/40 lg:hidden" />
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ddb-900 to-transparent lg:hidden" />

          {/* Fondus haut/bas/droite — desktop aussi, pour fondre avec le vert autour */}
          <div className="absolute inset-x-0 top-0 hidden h-24 bg-gradient-to-b from-ddb-900 to-transparent lg:block" />
          <div className="absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-t from-ddb-900 to-transparent lg:block" />
          <div className="absolute inset-y-0 right-0 hidden w-24 bg-gradient-to-l from-ddb-900 to-transparent lg:block" />
          <div className="absolute inset-0 flex flex-col justify-between pb-6 pt-6 sm:pt-8 lg:hidden">
            <div className="container mx-auto max-w-5xl px-4">
              <div className="flex items-center justify-between">
                <Link
                  to="/"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft size={20} />
                </Link>
                <span className="font-heading text-xs font-bold uppercase tracking-widest text-white/50">
                  Détails
                </span>
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/events/${event.slug || event.id}`;
                    if (navigator.share) {
                      navigator.share({ title: event.title, url: shareUrl }).catch(() => {});
                    } else {
                      setShareOpen(v => !v);
                    }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  aria-label="Partager"
                >
                  <Share2 size={17} />
                </button>
              </div>
            </div>
            <div className="container mx-auto max-w-5xl px-4">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-white ${status.color}`}>
                {status.label}
              </span>
              <h1 className="mt-3 font-heading text-2xl font-extrabold leading-tight text-white drop-shadow-md sm:text-4xl">
                {event.title}
              </h1>
            </div>
          </div>
        </div>

        {/* Panneau à droite — desktop uniquement : tous les éléments */}
        <div className="hidden flex-col justify-center gap-6 bg-ddb-900 p-10 lg:flex xl:p-16">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition-colors hover:text-white"
            >
              <ChevronLeft size={16} />
              Retour aux événements
            </Link>
            <div className="relative">
              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}/events/${event.slug || event.id}`;
                  if (navigator.share) {
                    navigator.share({ title: event.title, url: shareUrl }).catch(() => {});
                  } else {
                    setShareOpen(v => !v);
                  }
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Partager"
              >
                <Share2 size={17} />
              </button>

              {shareOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Partager cet événement</p>
                  <div className="mb-3 flex items-center gap-2">
                    <input
                      readOnly
                      value={`${window.location.origin}/events/${event.slug || event.id}`}
                      className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/events/${event.slug || event.id}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className={`flex-shrink-0 rounded-lg p-2 transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${event.title} — ${window.location.origin}/events/${event.slug || event.id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-2 flex w-full items-center gap-3 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#20b858]"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.122 1.526 5.853L.05 23.95l6.254-1.638A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.88 9.88 0 01-5.034-1.374l-.36-.214-3.732.978.995-3.63-.235-.374A9.859 9.859 0 012.107 12c0-5.457 4.436-9.893 9.893-9.893 5.457 0 9.893 4.436 9.893 9.893 0 5.457-4.436 9.894-9.893 9.894z"/></svg>
                    WhatsApp
                  </a>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/events/${event.slug || event.id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center gap-3 rounded-xl bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1565d8]"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </a>
                  <button onClick={() => setShareOpen(false)} className="absolute right-3 top-3 text-gray-300 transition-colors hover:text-gray-500">
                    <X size={14} />
                  </button>
                </div>
              )}
              {shareOpen && <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />}
            </div>
          </div>

          <div>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-white ${status.color}`}>
              {status.label}
            </span>
            <h1 className="mt-4 font-heading text-4xl font-extrabold leading-[1.1] text-white xl:text-5xl">
              {event.title}
            </h1>
          </div>

          {/* Ligne d'infos */}
          <div className="grid grid-cols-1 gap-5 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40">
                <Calendar size={13} />
                Date
              </p>
              <div className="mt-1 text-sm font-semibold text-white">
                {(() => {
                  const extras = (event.event_dates || []).filter(d => d.date);
                  const fmtD = (d: string) =>
                    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
                  if (extras.length > 0) {
                    const last = extras[extras.length - 1].date;
                    return <>Du {fmtD(event.event_date)} au {fmtD(last)}</>;
                  }
                  return <>{new Date(event.event_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</>;
                })()}
              </div>
            </div>

            {event.location && (
              <div className="sm:border-l sm:border-white/10 sm:pl-5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40">
                  <MapPin size={13} />
                  Lieu
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{event.location}</p>
              </div>
            )}

            <div className="sm:border-l sm:border-white/10 sm:pl-5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40">
                <Users size={13} />
                Places
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {event.max_slots ? `${seatsTaken ?? 0} / ${event.max_slots} inscrits` : 'Entrée libre'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              disabled={isPast || isFull}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full py-3.5 font-heading text-base font-bold transition-all ${
                isPast || isFull
                  ? 'cursor-not-allowed bg-white/10 text-white/30'
                  : 'bg-white text-ddb-950 hover:-translate-y-0.5 active:scale-95'
              }`}
            >
              {isPast ? 'Événement terminé' : isFull ? 'Complet' : "S'inscrire"}
              {!isPast && !isFull && <Calendar size={18} />}
            </button>
            {isPast && hasFeedback && (
              <button
                onClick={() => setFeedbackOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 py-3.5 px-5 font-heading text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-95"
              >
                <MessageSquare size={16} />
                Donner mon avis
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ligne d'infos — mobile/tablette uniquement (le panneau desktop l'affiche déjà) */}
      <div className="container mx-auto max-w-5xl px-4 lg:hidden">
        <div className="mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5 p-4">
          {event.location && (
            <div className="px-1 first:pl-0 last:pr-0">
              <p className="text-xs font-bold text-white sm:text-sm">Lieu</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-white/60 sm:text-xs">
                <MapPin size={12} className="shrink-0 text-ddb-300" />
                <span className="truncate">{event.location}</span>
              </p>
            </div>
          )}

          <div className="px-1 first:pl-0 last:pr-0">
            <p className="text-xs font-bold text-white sm:text-sm">Date</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-white/60 sm:text-xs">
              <Calendar size={12} className="shrink-0 text-ddb-300" />
              <span className="truncate">
                {new Date(event.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            </p>
          </div>

          <div className="px-1 first:pl-0 last:pr-0">
            <p className="text-xs font-bold text-white sm:text-sm">Places</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-white/60 sm:text-xs">
              <Users size={12} className="shrink-0 text-ddb-300" />
              <span className="truncate">
                {event.max_slots ? `${seatsTaken ?? 0}/${event.max_slots}` : 'Libre'}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-8 relative z-30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Main Content — pas de carte blanche, écritures directement sur le vert */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="font-heading text-2xl font-bold text-white">À propos de l'événement</h2>

              {(() => {
                const plainDesc = (event.description || '').replace(/<[^>]+>/g, '').trim();
                const PREVIEW_LEN = 220;
                const isLong = plainDesc.length > PREVIEW_LEN;
                const shown = descExpanded || !isLong ? plainDesc : plainDesc.slice(0, PREVIEW_LEN).trimEnd();

                return (
                  <p className="mt-4 whitespace-pre-line leading-relaxed text-white/70">
                    {shown}
                    {isLong && !descExpanded && '… '}
                    {isLong && (
                      <button
                        onClick={() => setDescExpanded(v => !v)}
                        className="ml-1 font-heading text-sm font-bold text-ddb-300 transition-colors hover:text-white"
                      >
                        {descExpanded ? 'Réduire' : 'Lire plus'}
                      </button>
                    )}
                  </p>
                );
              })()}

              {/* ── Programme de l'événement ── */}
              {event.program && event.program.length > 0 && (
                <div className="mt-10 pt-8 border-t border-white/10">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-ddb-300 flex-shrink-0">
                        <Clock size={20} />
                      </div>
                      <div>
                        <h3 className="font-heading text-xl font-bold text-white">Programme de l'événement</h3>
                        <p className="text-xs text-white/50">Déroulement et interventions prévues</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white/80 border border-white/10">
                      {event.program.length} étape{event.program.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="relative pl-6 sm:pl-8 space-y-4 sm:space-y-5 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-white/15">
                    {event.program.map((item, idx) => (
                      <div key={item.id || idx} className="relative group">
                        {/* Bulle numérotée timeline */}
                        <div className="absolute -left-6 sm:-left-8 top-3 w-6 h-6 rounded-full bg-ddb-900 border-2 border-ddb-300 flex items-center justify-center text-[11px] font-bold text-ddb-300 shadow-sm group-hover:scale-110 group-hover:bg-ddb-400 group-hover:text-ddb-950 transition-all">
                          {idx + 1}
                        </div>

                        <div className="bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-2xl p-4 sm:p-5 transition-all">
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                            <h4 className="font-heading text-base sm:text-lg font-bold text-white group-hover:text-ddb-200 transition-colors">
                              {item.title}
                            </h4>
                            {item.time && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-xs font-bold whitespace-nowrap">
                                <Clock size={12} />
                                {item.time}
                              </span>
                            )}
                          </div>

                          {item.speaker && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 mb-2">
                              <User size={12} className="text-ddb-300" />
                              <span className="font-medium">{item.speaker}</span>
                            </div>
                          )}

                          {item.description && (
                            <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

                {event.ticket_tiers && event.ticket_tiers.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-white/10">
                    <h3 className="font-heading text-lg font-bold text-white mb-4">Tarifs</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {event.ticket_tiers.map(tier => (
                        <div key={tier.id} className="flex items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{tier.label || 'Tarif'}</p>
                            {tier.description && <p className="text-xs text-white/50 mt-0.5">{tier.description}</p>}
                          </div>
                          <p className="font-bold text-ddb-300 text-sm whitespace-nowrap">
                            {tier.price ? `${tier.price.toLocaleString('fr-FR')} FCFA` : 'Gratuit'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center sm:justify-end gap-3 sm:gap-6">
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Share button */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          const shareUrl = `${window.location.origin}/events/${event.slug || event.id}`;
                          if (navigator.share) {
                            navigator.share({ title: event.title, url: shareUrl }).catch(() => {});
                          } else {
                            setShareOpen(v => !v);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 text-sm font-semibold transition-all"
                        title="Partager"
                      >
                        <Share2 size={18} />
                      </button>
                      {shareOpen && (
                        <div className="absolute right-0 bottom-full mb-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Partager cet événement</p>
                          <div className="flex items-center gap-2 mb-3">
                            <input
                              readOnly
                              value={`${window.location.origin}/events/${event.slug || event.id}`}
                              className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 outline-none truncate"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/events/${event.slug || event.id}`);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className={`flex-shrink-0 p-2 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                            >
                              {copied ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`${event.title} — ${window.location.origin}/events/${event.slug || event.id}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20b858] text-white text-sm font-semibold transition-colors mb-2"
                          >
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.122 1.526 5.853L.05 23.95l6.254-1.638A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.88 9.88 0 01-5.034-1.374l-.36-.214-3.732.978.995-3.63-.235-.374A9.859 9.859 0 012.107 12c0-5.457 4.436-9.893 9.893-9.893 5.457 0 9.893 4.436 9.893 9.893 0 5.457-4.436 9.894-9.893 9.894z"/></svg>
                            WhatsApp
                          </a>
                          <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/events/${event.slug || event.id}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#1565d8] text-white text-sm font-semibold transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            Facebook
                          </a>
                          <button onClick={() => setShareOpen(false)} className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      {shareOpen && <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />}
                    </div>
                    <button
                      onClick={() => setShowModal(true)}
                      disabled={isPast || isFull}
                      className={`flex-1 sm:flex-initial font-bold py-3 px-4 sm:py-3.5 sm:px-10 rounded-xl transition-all text-sm sm:text-lg flex justify-center items-center gap-2 whitespace-nowrap ${
                        isPast || isFull ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-white hover:-translate-y-0.5 text-ddb-950 shadow-md active:scale-95'
                      }`}
                    >
                      {isPast ? 'Événement terminé' : isFull ? 'Complet' : "S'inscrire"}
                      {!isPast && !isFull && <Calendar size={16} className="hidden sm:block" />}
                    </button>
                  </div>
                    {isPast && hasFeedback && (
                      <button
                        onClick={() => setFeedbackOpen(true)}
                        className="w-full sm:w-auto font-bold py-3 px-3 sm:py-3.5 sm:px-6 rounded-xl transition-all text-sm sm:text-base flex justify-center items-center gap-2 border border-white/20 bg-white/5 text-white hover:bg-white/10 active:scale-95 whitespace-nowrap"
                      >
                        <MessageSquare size={16} />
                        Donner mon avis
                      </button>
                    )}
                  </div>
                </div>

                {/* Récupération affiche J'y serai */}
                {!isPast && event.poster_enabled !== false && (
                  <div className="mt-4">
                    {!recoveryOpen ? (
                      <button
                        onClick={() => { setRecoveryOpen(true); setRecoveryError(null); setRecoveryEmail(''); }}
                        className="text-sm text-ddb-300 hover:text-white transition-colors underline underline-offset-2"
                      >
                        Déjà inscrit ? Récupérez votre affiche J'y serai
                      </button>
                    ) : (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-white">Récupérer mon affiche</p>
                          <button onClick={() => setRecoveryOpen(false)} className="text-white/40 hover:text-white transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                        <p className="text-xs text-white/50 mb-3">Entrez l'adresse email utilisée lors de votre inscription.</p>
                        <div className="relative">
                          <input
                            type="email"
                            id="recovery-email"
                            name="recovery-email"
                            autoComplete="email"
                            value={recoveryEmail}
                            onChange={e => setRecoveryEmail(e.target.value)}
                            placeholder="votre@email.com"
                            autoFocus
                            className={`w-full px-4 py-2.5 pr-10 rounded-xl border bg-white/5 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 transition-all ${
                              recoveryError
                                ? 'border-red-400/40 focus:ring-red-400/40'
                                : 'border-white/15 focus:ring-ddb-400'
                            }`}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {recoveryLoading && (
                              <span className="w-4 h-4 border-2 border-ddb-300 border-t-transparent rounded-full animate-spin block" />
                            )}
                            {!recoveryLoading && recoveryError && (
                              <X size={16} className="text-red-300" />
                            )}
                          </div>
                        </div>
                        {recoveryError && (
                          <p className="mt-2 text-xs text-red-300 font-medium">{recoveryError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Récupération du certificat */}
                {isPast && event.certificate_enabled && (
                  <div className="mt-4">
                    {!certRecoveryOpen ? (
                      <button
                        onClick={() => { setCertRecoveryOpen(true); setCertRecoveryError(null); setCertRecoveryEmail(''); }}
                        className="text-sm text-ddb-300 hover:text-white transition-colors underline underline-offset-2"
                      >
                        Récupérer mon certificat de participation
                      </button>
                    ) : (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-white">Récupérer mon certificat</p>
                          <button onClick={() => setCertRecoveryOpen(false)} className="text-white/40 hover:text-white transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                        <p className="text-xs text-white/50 mb-3">Entrez l'adresse email utilisée lors de votre inscription.</p>
                        <div className="relative">
                          <input
                            type="email"
                            id="cert-recovery-email"
                            name="cert-recovery-email"
                            autoComplete="email"
                            value={certRecoveryEmail}
                            onChange={e => setCertRecoveryEmail(e.target.value)}
                            placeholder="votre@email.com"
                            autoFocus
                            className={`w-full px-4 py-2.5 pr-10 rounded-xl border bg-white/5 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 transition-all ${
                              certRecoveryError
                                ? 'border-red-400/40 focus:ring-red-400/40'
                                : 'border-white/15 focus:ring-ddb-400'
                            }`}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {certRecoveryLoading && (
                              <span className="w-4 h-4 border-2 border-ddb-300 border-t-transparent rounded-full animate-spin block" />
                            )}
                            {!certRecoveryLoading && certRecoveryError && (
                              <X size={16} className="text-red-300" />
                            )}
                          </div>
                        </div>
                        {certRecoveryError && (
                          <p className="mt-2 text-xs text-red-300 font-medium">{certRecoveryError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Calendar className="text-ddb-300" size={24} />
                Autres événements
              </h3>

              {otherEvents.length === 0 ? (
                <p className="text-white/50 text-sm">Aucun autre événement programmé pour le moment.</p>
              ) : (
                <div className="space-y-3">
                  {otherEvents.map(other => (
                    <Link
                      key={other.id}
                      to={`/events/${other.slug || other.id}`}
                      className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm hover:shadow-md hover:border-ddb-300 transition-all group"
                    >
                      {other.image_url ? (
                        <img src={other.image_url} alt={other.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-ddb-50 flex items-center justify-center flex-shrink-0">
                          <Calendar size={20} className="text-ddb-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                        <h4 className="font-bold text-gray-800 text-sm truncate group-hover:text-ddb-700 transition-colors">
                          {other.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {new Date(other.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white ${getEventStatus(other.event_date).color}`}>
                            {getEventStatus(other.event_date).label}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <EventRegistrationModal
            event={event}
            onClose={() => setShowModal(false)}
            onGeneratePoster={(name) => setPosterState({ isOpen: true, name })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {feedbackOpen && (
          <FeedbackModal event={event} onClose={() => setFeedbackOpen(false)} />
        )}
      </AnimatePresence>

      {posterState.isOpen && (
        <PosterGeneratorModal
          event={event}
          defaultName={posterState.name}
          onClose={() => setPosterState({ isOpen: false, name: '' })}
        />
      )}
    </div>
    </InAppBrowserProvider>
  );
};

export default EventDetailPage;
