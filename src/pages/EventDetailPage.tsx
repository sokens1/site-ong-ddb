import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, X, CheckCircle, ChevronLeft, Star, MessageSquare, ChevronRight } from 'lucide-react';
import PosterGeneratorModal from '../components/events/PosterGeneratorModal';
import { jsPDF } from 'jspdf';

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
}

// ─── Registration Modal (Step-by-step) ───────────────────────────────────────

/** Helper to get a QR code image as a base64 data URI */
const getQRCodeDataUri = async (text: string): Promise<string> => {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}&color=14532d&bgcolor=ffffff`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch QR code');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Failed to generate QR code data URI:', err);
    return '';
  }
};

/** Generate PDF ticket in the browser using jsPDF */
const generateTicketPDF = async (
  fullname: string,
  eventTitle: string,
  eventDate: string,
  eventLocation?: string
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 100] });

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

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
  doc.text("BILLET D'ENTRÉE — ONG Développement Durable et Bien-Être", 105, 14, { align: 'center' });

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
  if (formattedDate) doc.text(`Date : ${formattedDate}`, 10, 62);
  if (eventLocation) doc.text(`Lieu : ${eventLocation}`, 10, 72);

  // Fine print
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('Ce billet est personnel et non cessible.', 10, 92);

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
  const customFields = event.form_fields || [];
  
  // Default fields: only fullname and email (required for ticket & visual)
  // Phone is removed from default fields
  const allFields = [
    { id: 'fullname', label: 'Votre nom & prénom', type: 'text', required: true, hint: 'Comment doit-on vous appeler ?' },
    { id: 'email', label: 'Votre adresse email', type: 'email', required: true, hint: 'Pour recevoir votre billet de confirmation.' },
    ...customFields
  ];

  const fieldsPerPage = 4;
  const totalSteps = Math.ceil(allFields.length / fieldsPerPage);
  const [step, setStep] = useState(0);

  const [formData, setFormData] = useState({ fullname: '', email: '' });
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const { error: insertError } = await supabase.from('event_registrations').insert([{
      event_id: event.id,
      fullname: formData.fullname,
      email: formData.email,
      phone: customData.phone || null,
      custom_data: customData,
    }]);

    if (insertError) {
      console.error("Insert error:", insertError);
      setError(`Erreur lors de l'inscription : ${insertError.message}`);
      setIsSubmitting(false);
      return;
    }

    // Inscription réussie en base → débloquer l'UI immédiatement
    setSuccess(true);
    setIsSubmitting(false);

    // Générer le PDF dans le navigateur et déclencher le téléchargement immédiatement
    const cleanTitle = event.title.replace(/[^a-z0-9]/gi, '_');
    let pdfBase64 = '';
    try {
      const doc = await generateTicketPDF(
        formData.fullname,
        event.title,
        event.event_date,
        event.location
      );
      // Téléchargement sécurisé et natif sans corruption
      doc.save(`Billet_${cleanTitle}.pdf`);
      
      // Extraction base64 pour la pièce jointe Brevo
      const dataUri = doc.output('datauristring');
      pdfBase64 = dataUri.split('base64,')[1];
    } catch (pdfErr) {
      console.error('Erreur génération PDF (non bloquant):', pdfErr);
    }

    // Envoyer le mail avec le PDF en pièce jointe en arrière-plan
    try {
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 25000)
      );
      const invokePromise = supabase.functions.invoke('send-event-confirmation', {
        body: {
          email: formData.email,
          fullname: formData.fullname,
          eventTitle: event.title,
          eventDate: event.event_date,
          eventLocation: event.location,
          pdfBase64: pdfBase64, // PDF généré côté client
          pdfName: `Billet_${cleanTitle}.pdf`,
        }
      });
      await Promise.race([invokePromise, timeoutPromise]);
    } catch (err) {
      console.error("Erreur lors de l'envoi du mail (non bloquant):", err);
    }
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
          <input
            type="email"
            value={formData.email}
            onChange={e => onChange(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white text-sm transition-all"
            placeholder="exemple@email.com"
          />
        )}

        {field.id !== 'fullname' && field.id !== 'email' && (
          <>
            {field.type === 'text' && (
              <input
                type="text"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
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
              <p className="text-gray-600 mb-6 text-sm">
                Vous êtes bien inscrit à <strong>{event.title}</strong>. Votre billet PDF a été téléchargé automatiquement.
              </p>

              <div className="bg-green-50 rounded-xl p-5 mb-4 border border-green-100 text-left">
                <p className="font-bold text-green-800 mb-1 text-sm">Faites le savoir !</p>
                <p className="text-xs text-green-700 mb-3">Générez votre affiche et partagez sur les réseaux sociaux.</p>
                <button
                  onClick={() => { onClose(); onGeneratePoster(formData.fullname); }}
                  className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-green-700 transition-colors text-sm"
                >
                  Générer mon visuel "J'y serai"
                </button>
              </div>
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

  const fetchEventData = async () => {
    setLoading(true);
    if (!id) return;
    try {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (!error && data) setEvent(data);

      const { data: othersData } = await supabase
        .from('events').select('*').eq('status', 'published').neq('id', id)
        .order('event_date', { ascending: false }).limit(8);
      if (othersData) setOtherEvents(othersData);
    } catch (err) {
      console.error("Error fetching event:", err);
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Header */}
      <div className="bg-green-900 border-b border-green-800 relative z-10 pt-24 pb-16 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[150%] rounded-full bg-white blur-3xl transform rotate-12" />
          <div className="absolute -bottom-[20%] -left-[10%] w-[40%] h-[100%] rounded-full bg-white blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-20">
          <Link to="/" className="inline-flex items-center gap-2 text-green-300 hover:text-white mb-6 transition-colors text-sm font-medium">
            <ChevronLeft size={16} />
            Retour à l'accueil
          </Link>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight max-w-4xl drop-shadow-md">
            {event.title}
          </h1>

          <div className="flex flex-wrap gap-4 md:gap-8 bg-white/10 backdrop-blur-md border border-white/20 p-4 md:p-6 rounded-2xl w-fit">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center">
                <Calendar size={20} className="text-green-300" />
              </div>
              <div>
                <p className="text-xs text-green-200 uppercase tracking-widest font-semibold mb-0.5">Date</p>
                <p className="font-medium text-sm md:text-base">
                  {new Date(event.event_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
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
                  dangerouslySetInnerHTML={{ __html: event.description || '' }}
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
                  <button
                    onClick={() => setShowModal(true)}
                    disabled={isPast}
                    className={`w-full sm:w-auto font-bold py-3.5 px-10 rounded-xl transition-all text-lg flex justify-center items-center gap-2 ${
                      isPast ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white shadow-md active:scale-95'
                    }`}
                  >
                    {isPast ? 'Événement terminé' : "S'inscrire"}
                    {!isPast && <Calendar size={18} />}
                  </button>
                </div>

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
                      to={`/events/${other.id}`}
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
  );
};

export default EventDetailPage;
