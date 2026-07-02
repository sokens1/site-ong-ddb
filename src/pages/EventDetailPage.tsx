import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, X, CheckCircle, ChevronLeft, Star, MessageSquare, ChevronRight, Share2, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import PosterGeneratorModal from '../components/events/PosterGeneratorModal';
import InAppBrowserBanner from '../components/InAppBrowserBanner';
import { InAppBrowserProvider, useInAppBrowserBanner } from '../context/InAppBrowserContext';
import { isInAppBrowser } from '../utils/inAppBrowser';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

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
}

// ─── Registration Modal (Step-by-step) ───────────────────────────────────────

/** Fetch any image URL as a base64 data URI */
const fetchImageAsBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

/** Génère un QR code localement (sans dépendance externe) */
const getQRCodeDataUri = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      width: 150,
      margin: 1,
      color: { dark: '#14532d', light: '#ffffff' },
    });
  } catch {
    // Fallback API si qrcode échoue (rare)
    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}&color=14532d&bgcolor=ffffff`;
      return await fetchImageAsBase64(url);
    } catch {
      return '';
    }
  }
};

/** Supprime les scripts et handlers d'événements du HTML avant rendu */
const sanitizeHTML = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on') || attr.value.toLowerCase().startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
  } catch {
    return '';
  }
};

/** Generate PDF ticket in the browser using jsPDF */
const generateTicketPDF = async (
  fullname: string,
  eventTitle: string,
  eventDate: string,
  eventLocation?: string,
  organizerLogos?: string[],
  eventDates?: { date: string; label?: string }[]
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 100] });

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  // Build date line — "Du X au X" si plusieurs dates, sinon date unique
  const validExtraDates = (eventDates || []).filter(d => d.date);
  const hasExtraDates = validExtraDates.length > 0;
  const lastExtraDate = hasExtraDates ? validExtraDates[validExtraDates.length - 1].date : null;
  const dateLine = hasExtraDates
    ? `Du ${fmtDate(eventDate)} au ${fmtDate(lastExtraDate!)}`
    : `Date : ${fmtDate(eventDate)}`;

  // QR code uses first date for backward compat
  const formattedDate = fmtDate(eventDate);

  // Background
  doc.setFillColor(240, 253, 244);
  doc.rect(0, 0, 210, 100, 'F');

  // Header bar
  doc.setFillColor(20, 83, 45);
  doc.rect(0, 0, 210, 22, 'F');

  // Header text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text("BILLET D'ENTRÉE OFFICIEL", 105, 14, { align: 'center' });

  // Divider
  doc.setDrawColor(74, 222, 128);
  doc.setLineWidth(0.5);
  doc.line(10, 28, 155, 28);

  // Event title
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(eventTitle, 138);
  doc.text(titleLines, 10, 36);

  // Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(`Participant : ${fullname}`, 10, 52);
  doc.text(dateLine, 10, 62);
  if (eventLocation) doc.text(`Lieu : ${eventLocation}`, 10, 72);

  // Fine print
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text('Ce billet est personnel et non cessible.', 10, 86);
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'italic');
  doc.text('ONG Développement Durable et Bien-Être', 10, 92);
  doc.setFont('helvetica', 'normal');

  // Organizer logos — bas à droite, ratio naturel préservé
  if (organizerLogos && organizerLogos.length > 0) {
    const targetH = 9; // mm — hauteur cible
    const gap = 2;
    const maxW = 148; // mm — zone gauche disponible avant le QR
    type LogoEntry = { base64: string; nw: number; nh: number };
    const loaded: LogoEntry[] = [];
    for (let i = 0; i < Math.min(organizerLogos.length, 6); i++) {
      try {
        const base64 = await fetchImageAsBase64(organizerLogos[i]);
        if (!base64) continue;
        const dims = await new Promise<{ nw: number; nh: number }>((res) => {
          const img = new Image();
          img.onload = () => res({ nw: img.naturalWidth, nh: img.naturalHeight });
          img.onerror = () => res({ nw: 1, nh: 1 });
          img.src = base64;
        });
        loaded.push({ base64, ...dims });
      } catch { /* silent */ }
    }
    if (loaded.length > 0) {
      const naturalWidths = loaded.map(l => (l.nw / l.nh) * targetH);
      const totalNatW = naturalWidths.reduce((a, b) => a + b, 0) + gap * (loaded.length - 1);
      let finalH = targetH;
      let finalWidths = naturalWidths;
      if (totalNatW > maxW) {
        finalH = targetH * (maxW / totalNatW);
        finalWidths = loaded.map(l => (l.nw / l.nh) * finalH);
      }
      const totalFinalW = finalWidths.reduce((a, b) => a + b, 0) + gap * (loaded.length - 1);
      // Aligné en bas à droite du billet (sous la QR box)
      let lx = 204 - totalFinalW;
      const ly = 97 - finalH;
      for (let i = 0; i < loaded.length; i++) {
        doc.addImage(loaded[i].base64, 'PNG', lx, ly, finalWidths[i], finalH);
        lx += finalWidths[i] + gap;
      }
    }
  }

  // QR box background
  doc.setDrawColor(20, 83, 45);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(162, 26, 38, 52, 3, 3, 'FD');

  // Fetch QR Code data URI and embed it
  const qrData = `ONG DDB\nParticipant: ${fullname}\nEvenement: ${eventTitle}\nDate: ${formattedDate}`;
  try {
    const qrDataUri = await getQRCodeDataUri(qrData);
    if (qrDataUri) {
      doc.addImage(qrDataUri, 'PNG', 165, 29, 32, 32);
    } else {
      // Fallback text if QR code couldn't be loaded
      doc.setTextColor(127, 29, 29);
      doc.setFontSize(8);
      doc.text('QR Code', 181, 44, { align: 'center' });
      doc.text('Non disponible', 181, 49, { align: 'center' });
    }
  } catch (qrErr) {
    console.error('Error adding QR code to PDF:', qrErr);
  }

  // Label text under QR box
  doc.setTextColor(20, 83, 45);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCÈS OFFICIEL', 181, 68, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text("Présenter à l'entrée", 181, 73, { align: 'center' });

  return doc;
};


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
      } else {
        console.error('Insert error:', insertError);
        setError(`Erreur lors de l'inscription : ${insertError.message}`);
      }
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
      const doc = await generateTicketPDF(finalName, event.title, event.event_date, event.location, event.organizer_logos, event.event_dates);
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

const FeedbackSection: React.FC<{ event: Event }> = ({ event }) => {
  const config: FeedbackConfig = event.feedback_config ?? { show_stars: true, fields: [] };
  const hasContent = config.show_stars || config.fields.length > 0;

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

  if (!hasContent) return null;

  return (
    <div className="mt-12 pt-8 border-t border-gray-100">
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 md:p-8 border border-green-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-green-200 text-green-700 rounded-full flex items-center justify-center flex-shrink-0">
            <MessageSquare size={20} />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Donnez votre avis</h3>
        </div>
        <p className="text-gray-500 text-sm mb-6 ml-13">Avez-vous participé à cet événement ? Votre retour nous aide à nous améliorer.</p>

        {status === 'success' ? (
          <div className="bg-white p-6 rounded-xl text-center border border-green-100 shadow-sm">
            <CheckCircle className="text-green-500 mx-auto mb-2" size={32} />
            <p className="font-bold text-gray-800">Merci pour votre retour !</p>
            <p className="text-gray-500 text-sm mt-1">Votre avis a bien été enregistré.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl border border-gray-100 space-y-5 shadow-sm">
            {status === 'error' && <p className="text-red-500 text-sm">Une erreur s'est produite. Veuillez réessayer.</p>}

            {/* Stars */}
            {config.show_stars && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Note globale *</label>
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
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {field.label}{field.required ? ' *' : ''}
                </label>
                {field.type === 'text' && (
                  <input required={field.required} type="text" value={customAnswers[field.id] || ''}
                    onChange={e => handleCustomChange(field.id, e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                )}
                {field.type === 'textarea' && (
                  <textarea required={field.required} rows={3} value={customAnswers[field.id] || ''}
                    onChange={e => handleCustomChange(field.id, e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" />
                )}
                {field.type === 'select' && (
                  <select required={field.required} value={customAnswers[field.id] || ''}
                    onChange={e => handleCustomChange(field.id, e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
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
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [otherEvents, setOtherEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [posterState, setPosterState] = useState<{isOpen: boolean; name: string}>({ isOpen: false, name: '' });
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const recoveryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const { data: othersData } = await supabase
          .from('events').select('*').eq('status', 'published').neq('id', eventData.id)
          .order('event_date', { ascending: false }).limit(8);
        if (othersData) setOtherEvents(othersData);
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

  return (
    <InAppBrowserProvider>
    <div className="min-h-screen bg-gray-50 pb-20">
      <InAppBrowserBanner />
      {/* Hero Header */}
      <div className="bg-green-900 border-b border-green-800 relative z-10 pt-24 pb-16 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[150%] rounded-full bg-white blur-3xl transform rotate-12" />
          <div className="absolute -bottom-[20%] -left-[10%] w-[40%] h-[100%] rounded-full bg-white blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-20">
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="inline-flex items-center gap-2 text-green-300 hover:text-white transition-colors text-sm font-medium">
              <ChevronLeft size={16} />
              Retour à l'accueil
            </Link>

            {/* Bouton partage */}
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold backdrop-blur-sm border border-white/20 transition-all"
              >
                <Share2 size={15} />
                Partager
              </button>

              {/* Popover desktop */}
              {shareOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Partager cet événement</p>

                  {/* Copy link */}
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

                  {/* WhatsApp */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${event.title} — ${window.location.origin}/events/${event.slug || event.id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20b858] text-white text-sm font-semibold transition-colors mb-2"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.122 1.526 5.853L.05 23.95l6.254-1.638A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.88 9.88 0 01-5.034-1.374l-.36-.214-3.732.978.995-3.63-.235-.374A9.859 9.859 0 012.107 12c0-5.457 4.436-9.893 9.893-9.893 5.457 0 9.893 4.436 9.893 9.893 0 5.457-4.436 9.894-9.893 9.894z"/></svg>
                    WhatsApp
                  </a>

                  {/* Facebook */}
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

              {/* Overlay pour fermer */}
              {shareOpen && <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />}
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight max-w-4xl drop-shadow-md">
            {event.title}
          </h1>

          <div className="flex flex-wrap gap-4 md:gap-8 bg-white/10 backdrop-blur-md border border-white/20 p-4 md:p-6 rounded-2xl w-fit">
            <div className="flex items-start gap-3 text-white">
              <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center mt-0.5">
                <Calendar size={20} className="text-green-300" />
              </div>
              <div>
                <p className="text-xs text-green-200 uppercase tracking-widest font-semibold mb-1">Date(s)</p>
                <div>
                  {(() => {
                    const extras = (event.event_dates || []).filter(d => d.date);
                    const fmtD = (d: string) =>
                      new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
                    if (extras.length > 0) {
                      const last = extras[extras.length - 1].date;
                      return (
                        <p className="font-medium text-sm md:text-base">
                          <span className="whitespace-nowrap">Du {fmtD(event.event_date)}</span>{' '}
                          <span className="whitespace-nowrap">au {fmtD(last)}</span>
                        </p>
                      );
                    }
                    return (
                      <p className="font-medium text-sm md:text-base">
                        {new Date(event.event_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>

            {event.location && (
              <>
                <div className="w-px bg-white/20 hidden md:block" />
                <div className="flex items-center gap-3 text-white">
                  <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center">
                    <MapPin size={20} className="text-green-300" />
                  </div>
                  <div>
                    <p className="text-xs text-green-200 uppercase tracking-widest font-semibold mb-0.5">Lieu</p>
                    <p className="font-medium text-sm md:text-base">{event.location}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-8 relative z-30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              {event.image_url && (
                <div className="relative w-full bg-gray-50 flex items-center justify-center overflow-hidden h-[250px] sm:h-[420px] border-b border-gray-100">
                  <img src={event.image_url} alt={event.title} className="max-w-full max-h-full object-contain" />
                </div>
              )}

              <div className="p-6 md:p-10">
                <div className="flex items-center gap-3 mb-6">
                  <span className={`px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest ${status.color}`}>
                    {status.label}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-800">À propos de l'événement</h2>
                </div>

                <div
                  className="prose prose-green max-w-none text-gray-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(event.description || '') }}
                />

                <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    {event.max_slots ? (
                      <p className="flex items-center gap-2 text-gray-500 font-medium bg-gray-100 px-4 py-2 rounded-xl">
                        <Users size={18} className="text-green-600" />
                        {event.max_slots} places disponibles
                      </p>
                    ) : (
                      <p className="flex items-center gap-2 text-green-600 font-medium bg-green-50 px-4 py-2 rounded-xl">
                        <CheckCircle size={18} />
                        Entrée libre
                      </p>
                    )}
                  </div>
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
                        className="flex items-center gap-2 px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-semibold transition-all"
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
                      disabled={isPast}
                      className={`flex-1 sm:flex-initial font-bold py-3.5 px-10 rounded-xl transition-all text-lg flex justify-center items-center gap-2 ${
                        isPast ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white shadow-md active:scale-95'
                      }`}
                    >
                      {isPast ? 'Événement terminé' : "S'inscrire"}
                      {!isPast && <Calendar size={18} />}
                    </button>
                  </div>
                </div>

                {/* Récupération affiche J'y serai */}
                {!isPast && event.poster_enabled !== false && (
                  <div className="mt-4">
                    {!recoveryOpen ? (
                      <button
                        onClick={() => { setRecoveryOpen(true); setRecoveryError(null); setRecoveryEmail(''); }}
                        className="text-sm text-green-600 hover:text-green-700 transition-colors underline underline-offset-2"
                      >
                        Déjà inscrit ? Récupérez votre affiche J'y serai
                      </button>
                    ) : (
                      <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-green-800">Récupérer mon affiche</p>
                          <button onClick={() => setRecoveryOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                        <p className="text-xs text-green-700 mb-3">Entrez l'adresse email utilisée lors de votre inscription.</p>
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
                            className={`w-full px-4 py-2.5 pr-10 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 transition-all ${
                              recoveryError
                                ? 'border-red-300 focus:ring-red-300'
                                : 'border-green-200 focus:ring-green-500'
                            }`}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {recoveryLoading && (
                              <span className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin block" />
                            )}
                            {!recoveryLoading && recoveryError && (
                              <X size={16} className="text-red-400" />
                            )}
                          </div>
                        </div>
                        {recoveryError && (
                          <p className="mt-2 text-xs text-red-500 font-medium">{recoveryError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Feedback section — driven by config */}
                {isPast && <FeedbackSection event={event} />}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sticky top-28">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Calendar className="text-green-600" size={24} />
                Autres événements
              </h3>

              {otherEvents.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun autre événement programmé pour le moment.</p>
              ) : (
                <div className="space-y-3">
                  {otherEvents.map(other => (
                    <Link
                      key={other.id}
                      to={`/events/${other.slug || other.id}`}
                      className="flex gap-3 rounded-xl border border-gray-100 p-3 hover:border-green-300 hover:bg-green-50 transition-all group"
                    >
                      {other.image_url ? (
                        <img src={other.image_url} alt={other.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Calendar size={20} className="text-green-600/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                        <h4 className="font-bold text-gray-800 text-sm truncate group-hover:text-green-700 transition-colors">
                          {other.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
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
