/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { supabase } from '../supabaseClient';

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

type FormType = 'none' | 'membership' | 'partnership' | 'donation';

// ===== MEMBER FORM =====
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
    if (step === 3) return formData.captcha;
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStepValid(3)) return;
    setIsSubmitting(true);
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
    const { data: sub, error } = await supabase.from('form_submissions').insert([{
      civility: formData.civility, fullname: formData.fullname, email: formData.email,
      phone: formData.phone, city: formData.city, interest: formData.interest,
      skills: formData.skills, motivation: formData.motivation, cv_url: cvUrl,
      status: 'en_attente', type: 'membership'
    }]).select('id').single();
    if (!error && sub) {
      try {
        const { data: admins } = await supabase.from('user_profiles').select('id').in('role', ['admin', 'charge_communication']);
        if (admins) await supabase.from('notifications').insert(admins.map(p => ({ user_id: p.id, type: 'new_submission', title: 'Nouvelle candidature membre', message: `${formData.fullname} a soumis une candidature.`, link: `/admin/submissions?highlight=${sub.id}`, is_read: false, submission_id: sub.id })));
      } catch { /* silent */ }
      try { await supabase.functions.invoke('send-submission-ack', { body: { email: formData.email, fullname: formData.fullname } }); } catch { /* silent */ }
      setShowModal(true);
      setFormData({ civility: '', fullname: '', email: '', phone: '', city: '', interest: '', skills: '', motivation: '', cv: null, captcha: false });
      setUploadProgress(0); setCurrentStep(1); localStorage.removeItem('joinFormData');
    } else { alert("Une erreur est survenue lors de l'envoi de votre candidature."); }
    setIsSubmitting(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors" title="Retour">
          <i className="fas fa-arrow-left text-sm"></i>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center"><i className="fas fa-users text-green-700 text-xs"></i></div>
          <div>
            <h3 className="text-lg font-bold text-green-800 leading-tight">Devenir Membre</h3>
            <p className="text-xs text-gray-400">Rejoignez l'équipe bénévole</p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          {[{ n: 1, l: 'Infos' }, { n: 2, l: 'Profil' }, { n: 3, l: 'Fin' }].map((s, i) => (
            <React.Fragment key={s.n}>
              <div className={`flex items-center gap-1.5 ${currentStep >= s.n ? 'text-green-600' : 'text-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${currentStep >= s.n ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>{s.n}</div>
                <span className="text-xs font-medium hidden sm:inline">{s.l}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 ${currentStep > s.n ? 'bg-green-600' : 'bg-gray-200'}`}></div>}
            </React.Fragment>
          ))}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="bg-green-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(currentStep / 3) * 100}%` }}></div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Civilité</label>
                  <select id="civility" value={formData.civility} onChange={handleInputChange} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                    <option value="">Sélectionnez</option>
                    <option value="M">Monsieur</option><option value="Mme">Madame</option><option value="Mlle">Mademoiselle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nom complet *</label>
                  <input type="text" id="fullname" value={formData.fullname} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input type="email" id="email" value={formData.email} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone</label>
                  <input type="tel" id="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ville</label>
                  <input type="text" id="city" value={formData.city} onChange={handleInputChange} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>
            </motion.div>
          )}
          {currentStep === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Domaine d'intérêt *</label>
                <input type="text" id="interest" value={formData.interest} onChange={handleInputChange} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Compétences *</label>
                <textarea id="skills" rows={3} value={formData.skills} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"></textarea>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Motivation</label>
                <textarea id="motivation" rows={3} value={formData.motivation} onChange={handleInputChange} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"></textarea>
              </div>
            </motion.div>
          )}
          {currentStep === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CV — <span className="font-normal text-gray-400">PDF, DOC, DOCX. Max 5MB. Optionnel.</span></label>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${isDragOver ? 'border-green-500 bg-green-50' : formData.cv ? 'border-green-400 bg-green-50/50' : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'}`}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}
                >
                  <input type="file" id="cv" onChange={handleFileChange} accept=".pdf,.doc,.docx" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  {formData.cv ? (
                    <div className="space-y-1">
                      <i className="fas fa-file-pdf text-green-600 text-xl"></i>
                      <p className="text-xs font-medium text-gray-800">{formData.cv.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(formData.cv.size)}</p>
                      {uploadProgress > 0 && uploadProgress < 100 && <div className="w-full bg-gray-200 rounded-full h-1"><div className="bg-green-600 h-1 rounded-full" style={{ width: `${uploadProgress}%` }}></div></div>}
                      <button type="button" onClick={e => { e.stopPropagation(); removeFile(); }} className="text-red-500 text-xs hover:text-red-700"><i className="fas fa-trash mr-1"></i>Supprimer</button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <i className="fas fa-cloud-upload-alt text-gray-300 text-2xl"></i>
                      <p className="text-xs text-gray-400">Glissez ou cliquez pour sélectionner</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <input type="checkbox" id="captcha" checked={formData.captcha} onChange={handleInputChange} className="h-4 w-4 text-green-600 accent-green-600" />
                <label htmlFor="captcha" className="text-sm text-gray-700">Je ne suis pas un robot</label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between pt-4 border-t border-gray-100">
          {currentStep > 1 ? (
            <button type="button" onClick={prevStep} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors">
              <i className="fas fa-arrow-left text-xs"></i> Précédent
            </button>
          ) : <div />}
          {currentStep < 3 ? (
            <button type="button" onClick={nextStep} disabled={!isStepValid(currentStep)} className="btn btn-primary btn-enhanced text-white text-sm font-bold py-2 px-5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
              Suivant <i className="fas fa-arrow-right ml-1 text-xs"></i>
            </button>
          ) : (
            <button type="submit" disabled={!isStepValid(3) || isSubmitting} className="btn btn-primary btn-enhanced pulse-on-hover text-white text-sm font-bold py-2 px-5 rounded-lg disabled:opacity-50">
              {isSubmitting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Envoi...</> : <><i className="fas fa-paper-plane mr-2"></i>Envoyer</>}
            </button>
          )}
        </div>
      </form>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fas fa-check text-green-600 text-2xl"></i></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Candidature envoyée !</h3>
            <p className="text-gray-500 mb-6 text-sm">Merci ! Votre candidature a bien été transmise à notre équipe.</p>
            <button onClick={() => setShowModal(false)} className="btn btn-primary btn-enhanced text-white font-bold py-2 px-8 rounded-xl w-full">Parfait !</button>
          </motion.div>
        </div>
      )}
    </>
  );
};

// ===== PARTNER FORM =====
const PartnerForm: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [formData, setFormData] = useState({ fullname: '', email: '', phone: '', organization: '', sector: '', partnership_type: '', description: '', captcha: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({ ...prev, [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.captcha) return;
    setIsSubmitting(true);
    const { data: sub, error } = await supabase.from('form_submissions').insert([{
      civility: '',
      fullname: formData.fullname, email: formData.email, phone: formData.phone,
      city: '',
      interest: `Secteur: ${formData.sector} | Type: ${formData.partnership_type} | Org: ${formData.organization}`,
      skills: '',
      motivation: formData.description, status: 'en_attente', type: 'partnership'
    }]).select('id').single();
    if (error) {
       console.error("Supabase Error:", error);
    }
    if (!error && sub) {
      try {
        const { data: admins } = await supabase.from('user_profiles').select('id').in('role', ['admin', 'charge_communication']);
        if (admins) await supabase.from('notifications').insert(admins.map(p => ({ user_id: p.id, type: 'new_submission', title: 'Nouvelle demande de partenariat', message: `${formData.fullname} propose un partenariat.`, link: `/admin/submissions?highlight=${sub.id}`, is_read: false, submission_id: sub.id })));
      } catch { /* silent */ }
      setShowModal(true);
      setFormData({ fullname: '', email: '', phone: '', organization: '', sector: '', partnership_type: '', description: '', captcha: false });
    } else { alert("Une erreur est survenue."); }
    setIsSubmitting(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
          <i className="fas fa-arrow-left text-sm"></i>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center"><i className="fas fa-handshake text-green-700 text-xs"></i></div>
          <div>
            <h3 className="text-lg font-bold text-green-800 leading-tight">Devenir Partenaire</h3>
            <p className="text-xs text-gray-400">Proposez un partenariat stratégique</p>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nom & Prénom *</label>
            <input type="text" id="fullname" value={formData.fullname} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Organisation *</label>
            <input type="text" id="organization" value={formData.organization} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
            <input type="email" id="email" value={formData.email} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone *</label>
            <input type="tel" id="phone" value={formData.phone} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Secteur d'activité *</label>
            <input type="text" id="sector" value={formData.sector} onChange={handleInputChange} required placeholder="Ex: Santé, Éducation…" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Type de partenariat *</label>
            <select id="partnership_type" value={formData.partnership_type} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
              <option value="">Sélectionnez</option>
              <option value="technique">Technique</option><option value="financier">Financement</option>
              <option value="logistique">Logistique</option><option value="communication">Communication</option>
              <option value="formation">Formation</option><option value="autre">Autre</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Description de la proposition *</label>
          <textarea id="description" rows={4} value={formData.description} onChange={handleInputChange} required placeholder="Décrivez votre proposition de partenariat…" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"></textarea>
        </div>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" id="captcha" checked={formData.captcha} onChange={handleInputChange} className="h-4 w-4 accent-green-600" />
          <label htmlFor="captcha" className="text-sm text-gray-700">Je ne suis pas un robot</label>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
            <i className="fas fa-arrow-left text-xs"></i> Retour
          </button>
          <button type="submit" disabled={!formData.captcha || isSubmitting} className="bg-green-700 hover:bg-green-800 text-white text-sm font-bold py-2 px-5 rounded-lg disabled:opacity-50 transition-colors">
            {isSubmitting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Envoi…</> : <><i className="fas fa-handshake mr-2"></i>Soumettre</>}
          </button>
        </div>
      </form>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fas fa-check text-green-600 text-2xl"></i></div>
            <h3 className="text-xl font-bold mb-2">Proposition reçue !</h3>
            <p className="text-gray-500 mb-6 text-sm">Notre équipe examinera votre proposition et vous contactera prochainement.</p>
            <button onClick={() => setShowModal(false)} className="bg-green-700 text-white font-bold py-2 px-8 rounded-xl w-full hover:bg-green-800 transition-colors">Fermer</button>
          </motion.div>
        </div>
      )}
    </>
  );
};

// ===== DONATION FORM =====
const DonationForm: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const WHATSAPP_NUMBER = '241077617776';
  const [formData, setFormData] = useState({ fullname: '', email: '', phone: '', donation_type: 'financier', amount: '', description: '', captcha: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({ ...prev, [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.captcha) return;
    setIsSubmitting(true);
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

  return (
    <>
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"><i className="fas fa-arrow-left text-sm"></i></button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center"><i className="fas fa-heart text-green-600 text-xs"></i></div>
          <div>
            <h3 className="text-lg font-bold text-green-700 leading-tight">Faire un Don</h3>
            <p className="text-xs text-gray-400">Redirection vers WhatsApp après envoi</p>
          </div>
        </div>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2">
        <i className="fab fa-whatsapp text-green-500 text-lg"></i>
        <p className="text-xs text-green-700">Vous serez redirigé vers <strong>WhatsApp</strong> pour finaliser votre don avec notre équipe.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nom & Prénom *</label>
            <input type="text" id="fullname" value={formData.fullname} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
            <input type="email" id="email" value={formData.email} onChange={handleInputChange} required className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone</label>
          <input type="tel" id="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Type de don *</label>
          <div className="grid grid-cols-3 gap-2">
            {[{ v: 'financier', l: 'Financier', ic: 'fas fa-coins' }, { v: 'materiel', l: 'Matériel', ic: 'fas fa-box' }, { v: 'autre', l: 'Autre', ic: 'fas fa-hands-helping' }].map(opt => (
              <label key={opt.v} className={`cursor-pointer border-2 rounded-lg p-2.5 text-center transition-all ${formData.donation_type === opt.v ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="dt" value={opt.v} checked={formData.donation_type === opt.v} onChange={() => setFormData(p => ({ ...p, donation_type: opt.v }))} className="sr-only" />
                <i className={`${opt.ic} text-lg block mb-1 ${formData.donation_type === opt.v ? 'text-green-600' : 'text-gray-300'}`}></i>
                <span className={`text-xs font-medium ${formData.donation_type === opt.v ? 'text-green-700' : 'text-gray-400'}`}>{opt.l}</span>
              </label>
            ))}
          </div>
        </div>
        {formData.donation_type === 'financier' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Montant estimé (FCFA)</label>
            <input type="text" id="amount" value={formData.amount} onChange={handleInputChange} placeholder="Ex: 50000" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Description / Détails</label>
          <textarea id="description" rows={3} value={formData.description} onChange={handleInputChange} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"></textarea>
        </div>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" id="captcha" checked={formData.captcha} onChange={handleInputChange} className="h-4 w-4 accent-green-600" />
          <label htmlFor="captcha" className="text-sm text-gray-700">Je confirme vouloir faire ce don</label>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
            <i className="fas fa-arrow-left text-xs"></i> Retour
          </button>
          <button type="submit" disabled={!formData.captcha || isSubmitting} className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-5 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2">
            {isSubmitting ? <><i className="fas fa-spinner fa-spin"></i> Traitement…</> : <><i className="fas fa-paper-plane text-base"></i> Soumettre</>}
          </button>
        </div>
      </form>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border-t-8 border-green-500">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fas fa-check text-green-600 text-2xl"></i></div>
            <h3 className="text-xl font-bold mb-2 text-gray-800">Don enregistré !</h3>
            <p className="text-gray-600 mb-6 text-sm">Merci pour votre générosité. Vous allez être redirigé vers WhatsApp pour finaliser votre don avec notre équipe.</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  window.open(whatsappLink, '_blank');
                  setShowModal(false);
                  setFormData({ fullname: '', email: '', phone: '', donation_type: 'financier', amount: '', description: '', captcha: false });
                }} 
                className="bg-green-600 text-white font-bold py-3 px-8 rounded-xl w-full hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <i className="fab fa-whatsapp text-lg"></i> Continuer sur WhatsApp
              </button>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setFormData({ fullname: '', email: '', phone: '', donation_type: 'financier', amount: '', description: '', captcha: false });
                }} 
                className="text-gray-500 font-medium py-2 px-8 rounded-xl w-full hover:bg-gray-100 transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

// ===== MAIN JOIN COMPONENT =====
const Join: React.FC = () => {
  const [activeForm, setActiveForm] = useState<FormType>('none');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [faqItems, setFaqItems] = useState<any[]>([]);
  const [contributionTypes, setContributionTypes] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('faq').select('*').then(({ data }) => { if (data) setFaqItems(data); });
    supabase.from('contribution_types').select('*').then(({ data }) => { if (data) setContributionTypes(data); });
  }, []);

  const selectionCards = [
    {
      type: 'membership' as FormType,
      icon: 'fas fa-users',
      title: 'Devenir Membre',
      sub: 'Rejoignez notre équipe',
      accent: 'text-green-700',
      bg: 'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-400',
      iconBg: 'bg-green-100',
    },
    {
      type: 'partnership' as FormType,
      icon: 'fas fa-handshake',
      title: 'Devenir Partenaire',
      sub: 'Proposez un partenariat',
      accent: 'text-green-700',
      bg: 'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-400',
      iconBg: 'bg-green-100',
    },
    {
      type: 'donation' as FormType,
      icon: 'fas fa-heart',
      title: 'Faire un Don',
      sub: 'Soutenez nos actions',
      accent: 'text-green-700',
      bg: 'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-400',
      iconBg: 'bg-green-100',
    },
  ];

  return (
    <section id="join" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Rejoignez-nous</motion.h2>
          <motion.div variants={itemVariants} className="w-24 h-1 bg-green-600 mx-auto"></motion.div>
        </AnimatedSection>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Left column — contribution types + FAQ */}
          <div className="lg:w-1/2 space-y-8">
            <AnimatedSection>
              <motion.h3 variants={itemVariants} className="text-2xl font-bold text-green-800 mb-6">Comment contribuer ?</motion.h3>
              <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {contributionTypes.map((type) => (
                  <motion.div key={type.id} variants={itemVariants} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-800 mb-4"><i className={type.icon}></i></div>
                    <h4 className="text-lg font-bold text-green-800 mb-2">{type.title}</h4>
                    <p className="text-gray-700">{type.description}</p>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatedSection>

            <AnimatedSection className="bg-white p-6 rounded-lg shadow-sm">
              <motion.h4 variants={itemVariants} className="text-lg font-bold text-green-800 mb-4">FAQ</motion.h4>
              <motion.div variants={containerVariants} className="space-y-4">
                {faqItems.map((item, index) => (
                  <motion.div key={item.id} variants={itemVariants}>
                    <button onClick={() => setOpenFAQ(openFAQ === index ? null : index)} className="w-full flex justify-between items-center text-left font-medium text-green-800">
                      <span>{item.question}</span>
                      <i className={`fas fa-chevron-down transition-transform text-sm ${openFAQ === index ? 'rotate-180' : ''}`}></i>
                    </button>
                    {openFAQ === index && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 pl-4 text-gray-700 border-l-2 border-green-200 overflow-hidden">
                        <p className="text-sm">{item.answer}</p>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            </AnimatedSection>
          </div>

          {/* Right column — 3 small selection cards + form */}
          <AnimatedSection className="lg:w-1/2 bg-white p-8 rounded-lg shadow-md overflow-hidden">
            {/* 3 petites cartes de sélection en ligne */}
            <AnimatePresence mode="wait">
              {activeForm === 'none' && (
                <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.h3 variants={itemVariants} className="text-2xl font-bold text-green-800 mb-2">Choisissez votre démarche</motion.h3>
                  <p className="text-sm text-gray-400 mb-6">Sélectionnez l'une des options ci-dessous pour commencer.</p>
                  
                  {/* Linear row of cards */}
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                    {selectionCards.map(card => (
                      <button
                        key={card.type}
                        onClick={() => setActiveForm(card.type)}
                        className={`min-w-[160px] flex-1 flex flex-col items-center text-center gap-3 border-2 rounded-2xl p-5 transition-all duration-300 snap-center shadow-sm ${card.bg}`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
                          <i className={`${card.icon} ${card.accent} text-xl`}></i>
                        </div>
                        <div className="min-w-0">
                          <p className={`font-bold text-sm leading-tight ${card.accent}`}>{card.title}</p>
                          <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{card.sub}</p>
                        </div>
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