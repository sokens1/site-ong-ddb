/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Handshake,
  Heart,
  Check,
  CheckCircle2,
  Loader2,
  Send,
  UploadCloud,
  FileText,
  Trash2,
  ChevronDown,
  Coins,
  Package,
  HandHeart,
  Briefcase,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import Turnstile, { verifySubmission, VERIFY_MESSAGES } from './Turnstile';
import EditableText from './site-content/EditableText';
import { useSiteContent } from '../context/SiteContentContext';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.122 1.526 5.853L.05 23.95l6.254-1.638A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.88 9.88 0 01-5.034-1.374l-.36-.214-3.732.978.995-3.63-.235-.374A9.859 9.859 0 012.107 12c0-5.457 4.436-9.893 9.893-9.893 5.457 0 9.893 4.436 9.893 9.893 0 5.457-4.436 9.894-9.893 9.894z" />
  </svg>
);

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  return (
    <motion.div ref={ref} className={className} variants={containerVariants} initial="hidden" animate={isInView ? 'visible' : 'hidden'}>
      {children}
    </motion.div>
  );
};

// ===== Success modal, shared visual language ===============================
const SuccessModal: React.FC<{
  icon: React.ReactNode;
  title: string;
  message: string;
  children: React.ReactNode;
}> = ({ icon, title, message, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-ddb-950/50 p-4">
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0.05, duration: 0.3 }}
      className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ddb-50 text-ddb-600">
        {icon}
      </div>
      <h3 className="font-heading text-xl font-bold text-ddb-950">{title}</h3>
      <p className="mt-2 text-sm text-ddb-950/50">{message}</p>
      <div className="mt-6">{children}</div>
    </motion.div>
  </div>
);

// ===== Form step header ======================================================
const FormHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onBack: () => void;
}> = ({ icon, title, subtitle, onBack }) => (
  <div className="mb-6 flex items-center gap-3 border-b border-ddb-950/10 pb-5">
    <button
      onClick={onBack}
      title="Retour"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ddb-950/40 transition-colors hover:bg-ddb-50 hover:text-ddb-700"
    >
      <ArrowLeft size={16} />
    </button>
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ddb-50 text-ddb-700">
        {icon}
      </div>
      <div>
        <h3 className="font-heading text-lg font-bold leading-tight text-ddb-950">{title}</h3>
        <p className="text-xs text-ddb-950/40">{subtitle}</p>
      </div>
    </div>
  </div>
);

// Shared field classes
const inputCls =
  'w-full rounded-xl border border-ddb-950/10 bg-ddb-50/40 px-4 py-2.5 text-sm text-ddb-950 outline-none transition-colors focus:border-ddb-500 focus:bg-white focus:ring-2 focus:ring-ddb-500/20';
const labelCls = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-ddb-950/60';

type FormType = 'none' | 'membership' | 'partnership' | 'donation';

// ===== MEMBER FORM =====
const STEPS = [
  { n: 1, label: 'Infos', icon: Users },
  { n: 2, label: 'Profil', icon: Briefcase },
  { n: 3, label: 'Finaliser', icon: UploadCloud },
];

const MemberForm: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('joinFormData');
    return saved ? JSON.parse(saved) : { civility: '', fullname: '', email: '', phone: '', city: '', interest: '', skills: '', motivation: '', cv: null, captcha: false };
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData((prev: any) => ({ ...prev, [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) validateAndSetFile(f); };
  const validateAndSetFile = (file: File) => {
    const ok = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!ok.includes(file.type)) { alert('Format non supporté. PDF, DOC ou DOCX seulement.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Fichier trop volumineux. Max 5MB.'); return; }
    setFormData((prev: any) => ({ ...prev, cv: file })); setUploadProgress(0);
  };
  const removeFile = () => { setFormData((prev: any) => ({ ...prev, cv: null })); setUploadProgress(0); };
  const formatSize = (b: number) => { const k = 1024; const s = ['Bytes', 'KB', 'MB']; const i = Math.floor(Math.log(b) / Math.log(k)); return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + s[i]; };
  const nextStep = () => { if (currentStep < 3) setCurrentStep(s => s + 1); };
  const prevStep = () => { if (currentStep > 1) setCurrentStep(s => s - 1); };
  const isStepValid = (step: number) => {
    if (step === 1) return formData.civility && formData.fullname && formData.email && formData.phone && formData.city;
    if (step === 2) return formData.interest && formData.skills && formData.motivation;
    if (step === 3) return true;
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStepValid(3)) return;
    setIsSubmitting(true);
    setCaptchaError(null);

    const check = await verifySubmission({ token: captchaToken, email: formData.email, kind: 'membership' });
    if (!check.ok) {
      setCaptchaError(VERIFY_MESSAGES[check.reason ?? 'server_error'] || 'Vérification échouée.');
      setCaptchaNonce(n => n + 1);
      setIsSubmitting(false);
      return;
    }
    let cvUrl = null;
    if (formData.cv) {
      const ext = formData.cv.name.split('.').pop();
      const fn = `${Date.now()}.${ext}`;
      const pi = setInterval(() => setUploadProgress(p => p >= 90 ? (clearInterval(pi), 90) : p + 10), 100);
      try {
        const { error: ue } = await supabase.storage.from('cv-uploads').upload(fn, formData.cv);
        clearInterval(pi); setUploadProgress(100);
        if (!ue) { const { data } = supabase.storage.from('cv-uploads').getPublicUrl(fn); cvUrl = data.publicUrl; }
      } catch { clearInterval(pi); setUploadProgress(0); }
    }
    // Pas de .select() : l'anon n'a pas le droit de RELIRE form_submissions
    // (RLS #035). On insère seulement.
    const { error } = await supabase.from('form_submissions').insert([{
      civility: formData.civility, fullname: formData.fullname, email: formData.email,
      phone: formData.phone, city: formData.city, interest: formData.interest,
      skills: formData.skills, motivation: formData.motivation, cv_url: cvUrl,
      status: 'en_attente', type: 'membership'
    }]);
    if (!error) {
      // Notif admin : n'aboutit que si un staff est connecté (RLS notifications).
      try {
        const { data: admins } = await supabase.from('user_profiles').select('id').in('role', ['admin', 'charge_communication']);
        if (admins) await supabase.from('notifications').insert(admins.map(p => ({ user_id: p.id, type: 'new_submission', title: 'Nouvelle candidature membre', message: `${formData.fullname} a soumis une candidature.`, link: `/espace-ddb/submissions`, read: false })));
      } catch { /* silent */ }
      try { await supabase.functions.invoke('send-submission-ack', { body: { email: formData.email, fullname: formData.fullname } }); } catch { /* silent */ }
      try { await supabase.functions.invoke('notify-new-submission', { body: { candidateName: formData.fullname, candidateEmail: formData.email, interest: formData.interest } }); } catch { /* silent */ }
      setShowModal(true);
      setFormData({ civility: '', fullname: '', email: '', phone: '', city: '', interest: '', skills: '', motivation: '', cv: null, captcha: false });
      setUploadProgress(0); setCurrentStep(1); localStorage.removeItem('joinFormData');
    } else {
      setCaptchaNonce(n => n + 1);
      alert("Une erreur est survenue lors de l'envoi de votre candidature.");
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <FormHeader
        icon={<Users size={18} />}
        title="Devenir Membre"
        subtitle="Rejoignez l'équipe bénévole"
        onBack={onBack}
      />

      {/* Stepper */}
      <div className="mb-7">
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                    currentStep > s.n
                      ? 'border-ddb-600 bg-ddb-600 text-white'
                      : currentStep === s.n
                        ? 'border-ddb-600 bg-white text-ddb-600'
                        : 'border-ddb-950/10 bg-white text-ddb-950/25'
                  }`}
                >
                  {currentStep > s.n ? <Check size={15} /> : <s.icon size={15} />}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${currentStep >= s.n ? 'text-ddb-700' : 'text-ddb-950/25'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="mx-1.5 mb-4 h-0.5 flex-1 overflow-hidden rounded-full bg-ddb-950/10">
                  <motion.div
                    className="h-full rounded-full bg-ddb-600"
                    initial={false}
                    animate={{ width: currentStep > s.n ? '100%' : '0%' }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Civilité</label>
                  <select id="civility" value={formData.civility} onChange={handleInputChange} className={inputCls}>
                    <option value="">Sélectionnez</option>
                    <option value="M">Monsieur</option><option value="Mme">Madame</option><option value="Mlle">Mademoiselle</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nom complet *</label>
                  <input type="text" id="fullname" autoComplete="name" value={formData.fullname} onChange={handleInputChange} required className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" id="email" autoComplete="email" value={formData.email} onChange={handleInputChange} required className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Téléphone</label>
                  <input type="tel" id="phone" autoComplete="tel" value={formData.phone} onChange={handleInputChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ville</label>
                  <input type="text" id="city" autoComplete="address-level2" value={formData.city} onChange={handleInputChange} className={inputCls} />
                </div>
              </div>
            </motion.div>
          )}
          {currentStep === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-4">
              <div>
                <label className={labelCls}>Domaine d'intérêt *</label>
                <input type="text" id="interest" value={formData.interest} onChange={handleInputChange} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Compétences *</label>
                <textarea id="skills" rows={3} value={formData.skills} onChange={handleInputChange} required className={`${inputCls} resize-none`}></textarea>
              </div>
              <div>
                <label className={labelCls}>Motivation</label>
                <textarea id="motivation" rows={3} value={formData.motivation} onChange={handleInputChange} className={`${inputCls} resize-none`}></textarea>
              </div>
            </motion.div>
          )}
          {currentStep === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-4">
              <div>
                <label className={labelCls}>CV — <span className="font-normal normal-case text-ddb-950/40">PDF, DOC, DOCX. Max 5MB. Optionnel.</span></label>
                <div
                  className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                    isDragOver ? 'border-ddb-500 bg-ddb-50' : formData.cv ? 'border-ddb-400 bg-ddb-50/50' : 'border-ddb-950/10 hover:border-ddb-400 hover:bg-ddb-50/40'
                  }`}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}
                >
                  <input type="file" id="cv" onChange={handleFileChange} accept=".pdf,.doc,.docx" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                  {formData.cv ? (
                    <div className="space-y-1.5">
                      <FileText className="mx-auto h-6 w-6 text-ddb-600" />
                      <p className="text-xs font-bold text-ddb-950">{formData.cv.name}</p>
                      <p className="text-xs text-ddb-950/40">{formatSize(formData.cv.size)}</p>
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="h-1 w-full rounded-full bg-ddb-950/10">
                          <div className="h-1 rounded-full bg-ddb-600" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                      )}
                      <button type="button" onClick={e => { e.stopPropagation(); removeFile(); }} className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700">
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <UploadCloud className="mx-auto h-7 w-7 text-ddb-950/25" />
                      <p className="text-xs text-ddb-950/40">Glissez ou cliquez pour sélectionner</p>
                    </div>
                  )}
                </div>
              </div>
              <Turnstile onToken={setCaptchaToken} resetSignal={captchaNonce} className="mt-1" />
              {captchaError && <p className="text-xs font-medium text-red-500">{captchaError}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between border-t border-ddb-950/10 pt-5">
          {currentStep > 1 ? (
            <button type="button" onClick={prevStep} className="inline-flex items-center gap-1.5 text-sm font-bold text-ddb-950/50 transition-colors hover:text-ddb-950">
              <ArrowLeft size={14} /> Précédent
            </button>
          ) : <div />}
          {currentStep < 3 ? (
            <button
              type="button" onClick={nextStep} disabled={!isStepValid(currentStep)}
              className="inline-flex items-center gap-1.5 rounded-full bg-ddb-700 px-5 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-ddb-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Suivant <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="submit" disabled={!isStepValid(3) || isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-ddb-700 px-5 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-ddb-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Envoi...</> : <><Send size={14} /> Envoyer</>}
            </button>
          )}
        </div>
      </form>

      {showModal && (
        <SuccessModal icon={<CheckCircle2 size={28} />} title="Candidature envoyée !" message="Merci ! Votre candidature a bien été transmise à notre équipe.">
          <button onClick={() => setShowModal(false)} className="w-full rounded-full bg-ddb-700 py-3 font-heading font-bold text-white transition-colors hover:bg-ddb-800">
            Parfait !
          </button>
        </SuccessModal>
      )}
    </>
  );
};

// ===== PARTNER FORM =====
const PartnerForm: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [formData, setFormData] = useState({ fullname: '', email: '', phone: '', organization: '', sector: '', partnership_type: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({ ...prev, [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCaptchaError(null);
    const check = await verifySubmission({ token: captchaToken, email: formData.email, kind: 'partnership' });
    if (!check.ok) {
      setCaptchaError(VERIFY_MESSAGES[check.reason ?? 'server_error'] || 'Vérification échouée.');
      setCaptchaNonce(n => n + 1);
      setIsSubmitting(false);
      return;
    }
    // Pas de .select() : l'anon ne peut pas relire form_submissions (RLS #035)
    const { error } = await supabase.from('form_submissions').insert([{
      civility: '',
      fullname: formData.fullname, email: formData.email, phone: formData.phone,
      city: '',
      interest: `Secteur: ${formData.sector} | Type: ${formData.partnership_type} | Org: ${formData.organization}`,
      skills: '',
      motivation: formData.description, status: 'en_attente', type: 'partnership'
    }]);
    if (!error) {
      try {
        const { data: admins } = await supabase.from('user_profiles').select('id').in('role', ['admin', 'charge_communication']);
        if (admins) await supabase.from('notifications').insert(admins.map(p => ({ user_id: p.id, type: 'new_submission', title: 'Nouvelle demande de partenariat', message: `${formData.fullname} propose un partenariat.`, link: `/espace-ddb/submissions`, read: false })));
      } catch { /* silent */ }
      try { await supabase.functions.invoke('notify-new-submission', { body: { candidateName: formData.fullname, candidateEmail: formData.email, interest: `Partenariat — ${formData.organization}` } }); } catch { /* silent */ }
      setShowModal(true);
      setFormData({ fullname: '', email: '', phone: '', organization: '', sector: '', partnership_type: '', description: '' });
    } else {
      console.error("Supabase Error:", error);
      setCaptchaNonce(n => n + 1);
      alert("Une erreur est survenue.");
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <FormHeader
        icon={<Handshake size={18} />}
        title="Devenir Partenaire"
        subtitle="Proposez un partenariat stratégique"
        onBack={onBack}
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nom & Prénom *</label>
            <input type="text" id="fullname" autoComplete="name" value={formData.fullname} onChange={handleInputChange} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Organisation *</label>
            <input type="text" id="organization" autoComplete="organization" value={formData.organization} onChange={handleInputChange} required className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Email *</label>
            <input type="email" id="email" autoComplete="email" value={formData.email} onChange={handleInputChange} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Téléphone *</label>
            <input type="tel" id="phone" autoComplete="tel" value={formData.phone} onChange={handleInputChange} required className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Secteur d'activité *</label>
            <input type="text" id="sector" value={formData.sector} onChange={handleInputChange} required placeholder="Ex: Santé, Éducation…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Type de partenariat *</label>
            <select id="partnership_type" value={formData.partnership_type} onChange={handleInputChange} required className={inputCls}>
              <option value="">Sélectionnez</option>
              <option value="technique">Technique</option><option value="financier">Financement</option>
              <option value="logistique">Logistique</option><option value="communication">Communication</option>
              <option value="formation">Formation</option><option value="autre">Autre</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Description de la proposition *</label>
          <textarea id="description" rows={4} value={formData.description} onChange={handleInputChange} required placeholder="Décrivez votre proposition de partenariat…" className={`${inputCls} resize-none`}></textarea>
        </div>
        <div>
          <Turnstile onToken={setCaptchaToken} resetSignal={captchaNonce} />
          {captchaError && <p className="mt-1 text-xs font-medium text-red-500">{captchaError}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-ddb-950/10 pt-5">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-ddb-950/50 hover:text-ddb-950">
            <ArrowLeft size={14} /> Retour
          </button>
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-1.5 rounded-full bg-ddb-700 px-5 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-ddb-800 disabled:opacity-40">
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Envoi…</> : <><Handshake size={14} /> Soumettre</>}
          </button>
        </div>
      </form>
      {showModal && (
        <SuccessModal icon={<CheckCircle2 size={28} />} title="Proposition reçue !" message="Notre équipe examinera votre proposition et vous contactera prochainement.">
          <button onClick={() => setShowModal(false)} className="w-full rounded-full bg-ddb-700 py-3 font-heading font-bold text-white transition-colors hover:bg-ddb-800">
            Fermer
          </button>
        </SuccessModal>
      )}
    </>
  );
};

// ===== DONATION FORM =====
const DonationForm: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const WHATSAPP_NUMBER = '241077617776';
  const [formData, setFormData] = useState({ fullname: '', email: '', phone: '', donation_type: 'financier', amount: '', description: '', consent: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({ ...prev, [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent) return;
    setIsSubmitting(true);
    setCaptchaError(null);
    const check = await verifySubmission({ token: captchaToken, email: formData.email, kind: 'donation' });
    if (!check.ok) {
      setCaptchaError(VERIFY_MESSAGES[check.reason ?? 'server_error'] || 'Vérification échouée.');
      setCaptchaNonce(n => n + 1);
      setIsSubmitting(false);
      return;
    }
    await supabase.from('donations').insert([{
      fullname: formData.fullname, email: formData.email, phone: formData.phone || null,
      donation_type: formData.donation_type, amount: formData.amount || null,
      description: formData.description || null, status: 'en_attente'
    }]);

    let msg = `Bonjour ONG DDB ! Je souhaite faire un don.\n\n*Nom :* ${formData.fullname}\n*Email :* ${formData.email}\n`;
    if (formData.phone) msg += `*Téléphone :* ${formData.phone}\n`;
    msg += `*Type de don :* ${formData.donation_type}\n`;
    if (formData.amount) msg += `*Montant :* ${formData.amount} FCFA\n`;
    if (formData.description) msg += `*Détails :* ${formData.description}\n`;

    setWhatsappLink(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
    setIsSubmitting(false);
    setShowModal(true);
  };

  const donationTypes = [
    { v: 'financier', l: 'Financier', icon: Coins },
    { v: 'materiel', l: 'Matériel', icon: Package },
    { v: 'autre', l: 'Autre', icon: HandHeart },
  ];

  return (
    <>
      <FormHeader
        icon={<Heart size={18} />}
        title="Faire un Don"
        subtitle="Redirection vers WhatsApp après envoi"
        onBack={onBack}
      />
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-ddb-200 bg-ddb-50 p-3">
        <WhatsAppIcon className="h-5 w-5 shrink-0 text-[#25D366]" />
        <p className="text-xs text-ddb-800">Vous serez redirigé vers <strong>WhatsApp</strong> pour finaliser votre don avec notre équipe.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nom & Prénom *</label>
            <input type="text" id="fullname" autoComplete="name" value={formData.fullname} onChange={handleInputChange} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input type="email" id="email" autoComplete="email" value={formData.email} onChange={handleInputChange} required className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Téléphone</label>
          <input type="tel" id="phone" autoComplete="tel" value={formData.phone} onChange={handleInputChange} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Type de don *</label>
          <div className="grid grid-cols-3 gap-2">
            {donationTypes.map(opt => (
              <label key={opt.v} className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all ${formData.donation_type === opt.v ? 'border-ddb-500 bg-ddb-50' : 'border-ddb-950/10 hover:border-ddb-950/20'}`}>
                <input type="radio" name="dt" value={opt.v} checked={formData.donation_type === opt.v} onChange={() => setFormData(p => ({ ...p, donation_type: opt.v }))} className="sr-only" />
                <opt.icon size={18} className={`mx-auto mb-1 ${formData.donation_type === opt.v ? 'text-ddb-600' : 'text-ddb-950/25'}`} />
                <span className={`text-xs font-bold ${formData.donation_type === opt.v ? 'text-ddb-700' : 'text-ddb-950/40'}`}>{opt.l}</span>
              </label>
            ))}
          </div>
        </div>
        {formData.donation_type === 'financier' && (
          <div>
            <label className={labelCls}>Montant estimé (FCFA)</label>
            <input type="text" id="amount" value={formData.amount} onChange={handleInputChange} placeholder="Ex: 50000" className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls}>Description / Détails</label>
          <textarea id="description" rows={3} value={formData.description} onChange={handleInputChange} className={`${inputCls} resize-none`}></textarea>
        </div>
        <label htmlFor="consent" className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-ddb-50/60 p-3">
          <input type="checkbox" id="consent" checked={formData.consent} onChange={handleInputChange} className="h-4 w-4 accent-ddb-600" />
          <span className="text-sm text-ddb-950/70">Je confirme vouloir faire ce don</span>
        </label>
        <div>
          <Turnstile onToken={setCaptchaToken} resetSignal={captchaNonce} />
          {captchaError && <p className="mt-1 text-xs font-medium text-red-500">{captchaError}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-ddb-950/10 pt-5">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-ddb-950/50 hover:text-ddb-950">
            <ArrowLeft size={14} /> Retour
          </button>
          <button type="submit" disabled={!formData.consent || isSubmitting} className="inline-flex items-center gap-1.5 rounded-full bg-ddb-700 px-5 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-ddb-800 disabled:opacity-40">
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Traitement…</> : <><Send size={14} /> Soumettre</>}
          </button>
        </div>
      </form>

      {showModal && (
        <SuccessModal icon={<CheckCircle2 size={28} />} title="Don enregistré !" message="Merci pour votre générosité. Vous allez être redirigé vers WhatsApp pour finaliser votre don avec notre équipe.">
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                window.open(whatsappLink, '_blank');
                setShowModal(false);
                setFormData({ fullname: '', email: '', phone: '', donation_type: 'financier', amount: '', description: '', consent: false });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 font-heading font-bold text-white transition-colors hover:bg-[#20b858]"
            >
              <WhatsAppIcon className="h-4 w-4" /> Continuer sur WhatsApp
            </button>
            <button
              onClick={() => {
                setShowModal(false);
                setFormData({ fullname: '', email: '', phone: '', donation_type: 'financier', amount: '', description: '', consent: false });
              }}
              className="w-full rounded-full py-2 font-medium text-ddb-950/50 transition-colors hover:bg-ddb-50"
            >
              Fermer
            </button>
          </div>
        </SuccessModal>
      )}
    </>
  );
};

// ===== FAQ — édition (modale ajout/modif, uniquement en mode édition) =====
type FaqDraft = { id?: number; question: string; answer: string };

const FaqEditorModal: React.FC<{ draft: FaqDraft; onClose: () => void; onSaved: () => void }> = ({ draft, onClose, onSaved }) => {
  const [question, setQuestion] = useState(draft.question);
  const [answer, setAnswer] = useState(draft.answer);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    if (draft.id) {
      await supabase.from('faq').update({ question, answer }).eq('id', draft.id);
    } else {
      await supabase.from('faq').insert([{ question, answer }]);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-ddb-700">{draft.id ? 'Modifier la question' : 'Ajouter une question'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <label className={labelCls}>Question</label>
        <input
          autoFocus
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className={`${inputCls} mb-4`}
        />
        <label className={labelCls}>Réponse</label>
        <textarea
          rows={4}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className={`${inputCls} resize-none`}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving || !question.trim() || !answer.trim()}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== MAIN JOIN COMPONENT =====
const Join: React.FC = () => {
  const { editMode } = useSiteContent();
  const [activeForm, setActiveForm] = useState<FormType>('none');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [faqItems, setFaqItems] = useState<any[]>([]);
  const [contributionTypes, setContributionTypes] = useState<any[]>([]);
  const [faqDraft, setFaqDraft] = useState<FaqDraft | null>(null);

  const refreshFaq = () => {
    supabase.from('faq').select('*').order('id', { ascending: true }).then(({ data }) => { if (data) setFaqItems(data); });
  };

  useEffect(() => {
    refreshFaq();
    supabase.from('contribution_types').select('*').then(({ data }) => { if (data) setContributionTypes(data); });
  }, []);

  const handleDeleteFaq = async (id: number) => {
    if (!window.confirm('Supprimer cette question ?')) return;
    await supabase.from('faq').delete().eq('id', id);
    refreshFaq();
  };

  const selectionCards = [
    {
      type: 'membership' as FormType,
      icon: Users,
      title: 'Devenir Membre',
      sub: "Rejoignez notre équipe bénévole et participez à nos actions de terrain.",
    },
    {
      type: 'partnership' as FormType,
      icon: Handshake,
      title: 'Devenir Partenaire',
      sub: 'Proposez un partenariat technique, financier ou logistique.',
    },
    {
      type: 'donation' as FormType,
      icon: Heart,
      title: 'Faire un Don',
      sub: 'Soutenez financièrement ou matériellement nos missions.',
    },
  ];

  return (
    // -mt-24 : annule le spacer laissé par la navbar flottante (Header.tsx) sur
    // les pages non-accueil ; fond vert faible cohérent avec la page Événements.
    <section id="join" className="-mt-24 bg-ddb-50 pb-24 pt-32 sm:pt-36">
      <div className="container mx-auto max-w-6xl px-4">
        <AnimatedSection>
          <EditableText
            as={motion.h1}
            k="join_page.title"
            fallback="Rejoignez-nous"
            multiline={false}
            variants={itemVariants}
            className="font-heading text-4xl font-extrabold tracking-tight text-ddb-950 sm:text-5xl lg:text-6xl"
          />
          <EditableText
            as={motion.p}
            k="join_page.subtitle"
            fallback="Membre, partenaire ou donateur : chaque contribution compte pour faire avancer nos missions de développement durable."
            variants={itemVariants}
            className="mt-4 max-w-xl text-lg text-ddb-950/60"
          />
        </AnimatedSection>

        <div className="mt-14 flex flex-col gap-10 lg:flex-row lg:items-start">
          {/* Left column — contribution types + FAQ */}
          <div className="space-y-8 lg:w-2/5">
            <AnimatedSection>
              <motion.h3 variants={itemVariants} className="mb-5 font-heading text-xl font-bold text-ddb-950">
                Comment contribuer ?
              </motion.h3>
              <motion.div variants={containerVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {contributionTypes.map((type) => (
                  <motion.div key={type.id} variants={itemVariants} className="rounded-2xl border border-ddb-950/5 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-ddb-50 text-ddb-700">
                      <i className={type.icon}></i>
                    </div>
                    <h4 className="font-heading font-bold text-ddb-950">{type.title}</h4>
                    <p className="mt-1 text-sm text-ddb-950/50">{type.description}</p>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatedSection>

            <AnimatedSection className="rounded-3xl border border-ddb-950/5 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <motion.h4 variants={itemVariants} className="font-heading text-lg font-bold text-ddb-950">
                  Questions fréquentes
                </motion.h4>
                {editMode && (
                  <button
                    onClick={() => setFaqDraft({ question: '', answer: '' })}
                    className="inline-flex items-center gap-1 rounded-lg bg-ddb-50 px-2.5 py-1.5 text-xs font-bold text-ddb-700 hover:bg-ddb-100"
                  >
                    <Plus size={13} /> Ajouter
                  </button>
                )}
              </div>
              <motion.div variants={containerVariants} className="divide-y divide-ddb-950/5">
                {faqItems.map((item, index) => (
                  <motion.div key={item.id} variants={itemVariants} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex w-full items-center justify-between gap-3">
                      <button onClick={() => setOpenFAQ(openFAQ === index ? null : index)} className="flex flex-1 items-center justify-between gap-3 text-left font-semibold text-ddb-950">
                        <span className="text-sm">{item.question}</span>
                        <ChevronDown size={16} className={`shrink-0 text-ddb-950/40 transition-transform ${openFAQ === index ? 'rotate-180' : ''}`} />
                      </button>
                      {editMode && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => setFaqDraft({ id: item.id, question: item.question, answer: item.answer })}
                            className="rounded-md p-1.5 text-ddb-950/30 hover:bg-ddb-50 hover:text-ddb-700"
                            title="Modifier"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteFaq(item.id)}
                            className="rounded-md p-1.5 text-ddb-950/30 hover:bg-red-50 hover:text-red-500"
                            title="Supprimer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    {openFAQ === index && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 overflow-hidden border-l-2 border-ddb-200 pl-4 text-ddb-950/60">
                        <p className="text-sm leading-relaxed">{item.answer}</p>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
                {faqItems.length === 0 && (
                  <p className="py-3 text-sm text-ddb-950/40">Aucune question pour le moment.</p>
                )}
              </motion.div>
            </AnimatedSection>
          </div>

          {faqDraft && (
            <FaqEditorModal draft={faqDraft} onClose={() => setFaqDraft(null)} onSaved={refreshFaq} />
          )}

          {/* Right column — selection tiles + form */}
          <AnimatedSection className="overflow-hidden rounded-3xl border border-ddb-950/5 bg-white p-6 shadow-xl sm:p-8 lg:w-3/5">
            <AnimatePresence mode="wait">
              {activeForm === 'none' && (
                <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="font-heading text-2xl font-bold text-ddb-950">Choisissez votre démarche</h3>
                  <p className="mt-1 text-sm text-ddb-950/40">Sélectionnez l'une des options ci-dessous pour commencer.</p>

                  <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {selectionCards.map(card => (
                      <button
                        key={card.type}
                        onClick={() => setActiveForm(card.type)}
                        className="group relative flex flex-col items-start gap-3 rounded-2xl border-2 border-ddb-950/10 p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-ddb-400 hover:shadow-lg"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ddb-50 text-ddb-700 transition-colors group-hover:bg-ddb-600 group-hover:text-white">
                          <card.icon size={22} />
                        </div>
                        <div>
                          <p className="font-heading font-bold text-ddb-950">{card.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-ddb-950/50">{card.sub}</p>
                        </div>
                        <ArrowRight size={16} className="absolute right-4 top-4 text-ddb-950/20 transition-all group-hover:translate-x-0.5 group-hover:text-ddb-600" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              {activeForm === 'membership' && (
                <motion.div key="membership" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <MemberForm onBack={() => setActiveForm('none')} />
                </motion.div>
              )}
              {activeForm === 'partnership' && (
                <motion.div key="partnership" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <PartnerForm onBack={() => setActiveForm('none')} />
                </motion.div>
              )}
              {activeForm === 'donation' && (
                <motion.div key="donation" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <DonationForm onBack={() => setActiveForm('none')} />
                </motion.div>
              )}
            </AnimatePresence>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
};

export default Join;
