import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, X, CheckCircle, ChevronLeft, Star, MessageSquare, ChevronRight, Share2, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import PosterGeneratorModal from '../components/events/PosterGeneratorModal';
import InAppBrowserBanner from '../components/InAppBrowserBanner';
import { InAppBrowserProvider, useInAppBrowserBanner } from '../context/InAppBrowserContext';
import { isInAppBrowser } from '../utils/inAppBrowser';
import { generateTicketPDF } from '../utils/ticketPdf';
import { generateCertificatePDF } from '../utils/certificatePdf';
import Turnstile, { verifySubmission, VERIFY_MESSAGES } from '../components/Turnstile';

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


const EventRegistrationModal: React.FC<{
  event: Event;
  onClose: () => void;
  onGeneratePoster: (name: string) => void;
}> = ({ event, onClose, onGeneratePoster }) => {
  const { reactivate: reactivateInAppBanner } = useInAppBrowserBanner();
  const customFields = (event.form_fields || []).filter((f: any) => f && f.label && f.label.trim() !== '');
  const hasCustomFields = customFields.length > 0;
  
  // If there are custom fields, only display them. Otherwise show default name and email.
  const allFields = hasCustomFields
    ? customFields
    : [
        { id: 'fullname', label: 'Votre nom & prénom', type: 'text', required: true, hint: 'Comment doit-on vous appeler ?' },
        { id: 'email', label: 'Votre adresse email', type: 'email', required: true, hint: 'Pour recevoir votre billet de confirmation.' }
      ];

  const fieldsPerPage = 4;
  const totalSteps = Math.ceil(allFields.length / fieldsPerPage);
  const [step, setStep] = useState(0);

  const [formData, setFormData] = useState({ fullname: '', email: '' });
  const [customData, setCustomData] = useState<Record<string, any>>({});
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

  const isLastStep = step === totalSteps - 1;
  const progress = totalSteps > 0 ? ((step + 1) / totalSteps) * 100 : 100;

  // Get fields for the current page
  const pageFields = allFields.slice(step * fieldsPerPage, (step + 1) * fieldsPerPage);

  const canAdvance = () => {
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
        // Custom email field format validation
        if (field.label.toLowerCase().includes('email') || field.label.toLowerCase().includes('courriel')) {
          const val = customData[field.id];
          if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!canAdvance()) return;
    if (isLastStep) {
      handleSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    // Extraire nom et email depuis les champs custom ou les champs par défaut
    let ticketName = '';
    let ticketEmail = '';

    if (hasCustomFields) {
      const emailField = customFields.find(f =>
        f.label.toLowerCase().includes('email') ||
        f.label.toLowerCase().includes('courriel') ||
        f.label.toLowerCase().includes('mail')
      );
      if (emailField) ticketEmail = customData[emailField.id] || '';

      const nameFields = customFields.filter(f =>
        f.label.toLowerCase().includes('nom') ||
        f.label.toLowerCase().includes('prénom') ||
        f.label.toLowerCase().includes('prenom') ||
        f.label.toLowerCase().includes('name') ||
        f.label.toLowerCase().includes('fullname')
      );
      if (nameFields.length > 0) {
        ticketName = nameFields.map(f => customData[f.id] || '').filter(Boolean).join(' ');
      }

      if (!ticketEmail) {
        const found = Object.values(customData).find(val => typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val));
        ticketEmail = (found as string) || '';
      }
      if (!ticketName) {
        const firstText = customFields.find(f => f.type === 'text');
        if (firstText) ticketName = customData[firstText.id] || '';
      }
    } else {
      ticketName = formData.fullname;
      ticketEmail = formData.email;
    }

    const finalName = ticketName.trim() || 'Participant';
    const finalEmail = ticketEmail.trim();

    // ── Vérif serveur : anti-bot + format email + domaine jetable ──────────
    const check = await verifySubmission({ token: captchaToken, email: finalEmail, kind: 'event_registration' });
    if (!check.ok) {
      setError(VERIFY_MESSAGES[check.reason ?? 'server_error'] || 'Vérification échouée.');
      setCaptchaNonce(n => n + 1);
      setIsSubmitting(false);
      return;
    }

    // ── Vérifier doublon inscription (vérification préalable côté client) ───
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
      // 23505 = unique_violation: the database constraint blocked a duplicate
      if (insertError.code === '23505') {
        setError('Vous êtes déjà inscrit à cet événement avec cette adresse email.');
      } else if (/complet/i.test(insertError.message)) {
        // trigger enforce_event_capacity : plus de places
        setError('Cet événement est complet, les inscriptions sont closes.');
      } else if (insertError.code === '23514') {
        setError('Cette adresse email n\'est pas valide.');
      } else {
        console.error('Insert error:', insertError);
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

    // ── Génération PDF + envoi email en arrière-plan ────────────────────────
    if (isInAppBrowser()) reactivateInAppBanner(); // le téléchargement du billet démarre : on rappelle la carte tout de suite
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

    // Déclenche l'envoi sans attendre la réponse de Brevo (fire-and-forget)
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
            autoFocus={step === 0}
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
            {field.type === 'text' && (() => {
              const isEmail = field.label.toLowerCase().includes('email') || field.label.toLowerCase().includes('courriel');
              if (isEmail) {
                return (
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        type="email"
                        value={value || ''}
                        onChange={e => onChange(e.target.value)}
                        placeholder="exemple@email.com"
                        className={`w-full px-4 py-2.5 pr-10 rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 focus:bg-white text-sm transition-all
                          ${emailDupStatus === 'duplicate'
                            ? 'border-red-400 focus:ring-red-300'
                            : emailDupStatus === 'ok'
                            ? 'border-green-400 focus:ring-green-500'
                            : 'border-gray-200 focus:ring-green-500'}`}
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
                );
              }
              return (
                <input
                  type="text"
                  value={value || ''}
                  onChange={e => onChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white text-sm transition-all"
                />
              );
            })()}
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

  // ── Vérification doublon email en temps réel (debounce 700ms) ───────────
  useEffect(() => {
    let typedEmail = '';
    if (hasCustomFields) {
      const emailField = customFields.find((f: any) =>
        f.label.toLowerCase().includes('email') ||
        f.label.toLowerCase().includes('courriel') ||
        f.label.toLowerCase().includes('mail')
      );
      typedEmail = emailField ? String(customData[emailField.id] || '') : '';
    } else {
      typedEmail = formData.email;
    }
    typedEmail = typedEmail.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedEmail)) {
      setEmailDupStatus('idle');
      if (emailDupDebounce.current) clearTimeout(emailDupDebounce.current);
      return;
    }

    setEmailDupStatus('checking');
    if (emailDupDebounce.current) clearTimeout(emailDupDebounce.current);
    emailDupDebounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', event.id)
        .ilike('email', typedEmail)
        .limit(1);
      setEmailDupStatus(data && data.length > 0 ? 'duplicate' : 'ok');
    }, 700);

    return () => { if (emailDupDebounce.current) clearTimeout(emailDupDebounce.current); };
  }, [formData.email, customData, hasCustomFields]);

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
        {/* Header */}
        <div className="bg-green-800 text-white px-6 pt-6 pb-5 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
          {!success && (
            <>
              <p className="text-xs text-green-300 uppercase tracking-widest font-semibold mb-1">Inscription</p>
              <h3 className="text-lg font-bold leading-tight pr-8 line-clamp-2">{event.title}</h3>
              {/* Progress bar */}
              <div className="mt-4 bg-white/20 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-green-300 rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-green-300 mt-1.5">Étape {step + 1} sur {totalSteps}</p>
            </>
          )}
          {success && (
            <h3 className="text-lg font-bold">Inscription confirmée !</h3>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 140px)' }}>
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <p className="text-gray-700 font-semibold mb-1">Inscription confirmée !</p>
              <p className="text-gray-500 text-sm mb-4">
                Votre billet PDF a été téléchargé automatiquement.
              </p>

              {isInAppBrowser() && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl py-2.5 px-4 mb-4">
                  Pas d'inquiétude si le téléchargement n'a pas démarré : votre inscription est déjà enregistrée et votre billet vous a été envoyé par email.
                </p>
              )}

              {/* État envoi email */}
              {!emailSent ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-5 bg-gray-50 rounded-xl py-2.5 px-4 border border-gray-100">
                  <span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  Envoi de votre billet par email en cours…
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-green-700 mb-5 bg-green-50 rounded-xl py-2.5 px-4 border border-green-100">
                  <CheckCircle size={15} className="flex-shrink-0" />
                  {registeredEmail ? `Billet envoyé à ${registeredEmail}` : 'Billet envoyé par email'}
                </div>
              )}

              {event.poster_enabled !== false && (
                <div className="bg-green-50 rounded-xl p-5 mb-4 border border-green-100 text-left">
                  <p className="font-bold text-green-800 mb-1 text-sm">Faites le savoir !</p>
                  <p className="text-xs text-green-700 mb-3">Générez votre affiche et partagez sur les réseaux sociaux.</p>
                  <button
                    onClick={() => { onClose(); onGeneratePoster(registeredName || formData.fullname); }}
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
          ) : (
            <div>
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

              <div className="space-y-5">
                {pageFields.map(field => renderField(field))}
              </div>

              {isLastStep && <div className="mt-5"><Turnstile onToken={setCaptchaToken} resetSignal={captchaNonce} /></div>}

              <div className="flex gap-3 mt-6">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(s => s - 1)}
                    className="px-5 py-3 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Retour
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canAdvance() || isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isLastStep ? (
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
