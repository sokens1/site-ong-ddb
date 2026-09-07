import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FileText, ClipboardList, Ticket, Award, Sparkles, Check,
  Plus, Trash2, Building2, Handshake, ChevronUp, ChevronDown, Star, Loader2,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import ImageUpload from './ImageUpload';
import RichTextEditor from './RichTextEditor';
import FieldBuilder, { FormField } from './FieldBuilder';
import MultiLogoUpload from './MultiLogoUpload';
import TicketPreviewCard from './TicketPreviewCard';
import CertificatePreviewCard from './CertificatePreviewCard';
import PosterPreviewCard from './PosterPreviewCard';
import { generateSlug, EVENT_TYPES } from '../../utils/eventHelpers';
import { TicketTemplate } from '../../utils/ticketPdf';
import { CertificateTemplate } from '../../utils/certificatePdf';
import { PosterTemplate } from '../../utils/posterTemplates';

interface FeedbackConfig {
  show_stars: boolean;
  fields: FormField[];
}

interface ProgramItem {
  id: string;
  time?: string;
  title: string;
  speaker?: string;
  description?: string;
}

interface TicketTier {
  id: string;
  label: string;
  price: number | null;
  description?: string;
}

export interface WizardEvent {
  id?: number;
  title: string;
  theme?: string;
  description: string;
  event_date: string;
  location: string;
  image_url: string;
  max_slots: number | null;
  price?: number | null;
  status: 'draft' | 'published' | 'cancelled';
  form_fields: FormField[];
  feedback_config: FeedbackConfig;
  event_dates: { date: string; label?: string }[];
  logo_url: string;
  organizer_logos: string[];
  partner_logos: string[];
  slug?: string;
  poster_enabled: boolean;
  event_type: string;
  program: ProgramItem[];
  ticket_tiers: TicketTier[];
  ticket_template: TicketTemplate;
  invitation_text?: string;
  invitation_subtext?: string;
  certificate_enabled: boolean;
  certificate_template: CertificateTemplate;
  poster_template: PosterTemplate;
}

const getCurrentDateTime = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const emptyEvent = (): WizardEvent => ({
  title: '', theme: '', description: '', event_date: getCurrentDateTime(),
  location: '', image_url: '', max_slots: null, price: 0,
  status: 'published',
  form_fields: [],
  feedback_config: { show_stars: true, fields: [] },
  event_dates: [], logo_url: '',
  organizer_logos: [], partner_logos: [],
  poster_enabled: true,
  event_type: 'conference',
  program: [],
  ticket_tiers: [],
  ticket_template: 'classic',
  invitation_text: '',
  invitation_subtext: '',
  certificate_enabled: false,
  certificate_template: 'classic',
  poster_template: 'classic',
});

const STEPS = [
  { key: 'info', label: 'Informations', sub: 'Détails & médias', icon: FileText },
  { key: 'questionnaires', label: 'Questionnaires', sub: 'Inscription & avis', icon: ClipboardList },
  { key: 'program', label: 'Programme & Billetterie', sub: 'Agenda & billets', icon: Ticket },
  { key: 'certificates', label: 'Certificats', sub: 'Attestations', icon: Award },
  { key: 'poster', label: "Visuel J'y serai", sub: 'Affiche personnalisée', icon: Sparkles },
] as const;

type StepKey = typeof STEPS[number]['key'];

interface EventWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: number;
  onSaved?: (event: any) => void;
}

const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${checked ? 'bg-green-600' : 'bg-gray-300'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; sub?: string }> = ({ icon: Icon, title, sub }) => (
  <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-6">
    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
      <Icon size={18} className="text-green-700" />
    </div>
    <div>
      <h2 className="text-base font-bold text-gray-800">{title}</h2>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
);

const EventWizardModal: React.FC<EventWizardModalProps> = ({ isOpen, onClose, eventId, onSaved }) => {
  const isEditing = !!eventId;
  const [step, setStep] = useState<StepKey>('info');
  const [formData, setFormData] = useState<WizardEvent>(emptyEvent());
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slugTouched = React.useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep('info');
    setError(null);
    if (eventId) {
      setFetching(true);
      supabase.from('events').select('*').eq('id', eventId).single().then(({ data, error: fetchError }) => {
        if (!fetchError && data) {
          let dateValue = getCurrentDateTime();
          if (data.event_date) {
            const d = new Date(data.event_date);
            if (!isNaN(d.getTime())) {
              dateValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
          }
          setFormData({
            ...emptyEvent(),
            ...data,
            theme: data.theme || '',
            event_date: dateValue,
            form_fields: data.form_fields || [],
            feedback_config: data.feedback_config ?? { show_stars: true, fields: [] },
            event_dates: data.event_dates || [],
            organizer_logos: Array.isArray(data.organizer_logos) ? data.organizer_logos : [],
            partner_logos: Array.isArray(data.partner_logos) ? data.partner_logos : [],
            poster_enabled: data.poster_enabled !== false,
            event_type: data.event_type || 'conference',
            program: Array.isArray(data.program) ? data.program : [],
            ticket_tiers: Array.isArray(data.ticket_tiers) ? data.ticket_tiers : [],
            ticket_template: data.ticket_template || 'classic',
            invitation_text: data.invitation_text || '',
            invitation_subtext: data.invitation_subtext || '',
            certificate_enabled: !!data.certificate_enabled,
            certificate_template: data.certificate_template || 'classic',
            poster_template: data.poster_template || 'classic',
          });
          slugTouched.current = true;
        }
        setFetching(false);
      });
    } else {
      setFormData(emptyEvent());
      slugTouched.current = false;
    }
  }, [isOpen, eventId]);

  const stepIndex = STEPS.findIndex(s => s.key === step);

  const goToStep = (key: StepKey) => setStep(key);
  const goNext = () => {
    if (step === 'info') {
      if (!formData.title.trim()) { setError("Le titre de l'événement est obligatoire."); return; }
      if (!formData.event_date) { setError('La date est obligatoire.'); return; }
    }
    setError(null);
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };
  const goPrev = () => {
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) { setError("Le titre de l'événement est obligatoire."); setStep('info'); return; }
    if (!formData.event_date) { setError('La date est obligatoire.'); setStep('info'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        title: formData.title,
        theme: formData.theme?.trim() || null,
        description: formData.description || '',
        event_date: formData.event_date,
        location: formData.location || '',
        image_url: formData.image_url || '',
        max_slots: formData.max_slots ? parseInt(String(formData.max_slots)) : null,
        price: formData.price ? parseFloat(String(formData.price)) : 0,
        status: formData.status || 'draft',
        form_fields: formData.form_fields || [],
        feedback_config: formData.feedback_config ?? { show_stars: true, fields: [] },
        event_dates: formData.event_dates || [],
        logo_url: formData.logo_url || null,
        organizer_logos: formData.organizer_logos || [],
        partner_logos: formData.partner_logos || [],
        slug: formData.slug?.trim() || generateSlug(formData.title || '') || undefined,
        poster_enabled: formData.poster_enabled !== false,
        event_type: formData.event_type || 'conference',
        program: formData.program || [],
        ticket_tiers: formData.ticket_tiers || [],
        ticket_template: formData.ticket_template || 'classic',
        invitation_text: formData.invitation_text?.trim() || null,
        invitation_subtext: formData.invitation_subtext?.trim() || null,
        certificate_enabled: !!formData.certificate_enabled,
        certificate_template: formData.certificate_template || 'classic',
        poster_template: formData.poster_template || 'classic',
      };

      let result;
      if (isEditing && eventId) {
        let { data, error: updErr } = await supabase.from('events').update(payload).eq('id', eventId).select().single();
        if (updErr && (updErr.message?.includes('theme') || updErr.message?.includes('invitation_'))) {
          delete payload.theme;
          delete payload.invitation_text;
          delete payload.invitation_subtext;
          const retry = await supabase.from('events').update(payload).eq('id', eventId).select().single();
          if (retry.error) throw retry.error;
          data = retry.data;
        } else if (updErr) {
          throw updErr;
        }
        result = data;
      } else {
        let { data, error: insErr } = await supabase.from('events').insert(payload).select().single();
        if (insErr && (insErr.message?.includes('theme') || insErr.message?.includes('invitation_'))) {
          delete payload.theme;
          delete payload.invitation_text;
          delete payload.invitation_subtext;
          const retry = await supabase.from('events').insert(payload).select().single();
          if (retry.error) throw retry.error;
          data = retry.data;
        } else if (insErr) {
          throw insErr;
        }
        result = data;
      }
      onSaved?.(result);
      onClose();
    } catch (err: any) {
      console.error('Erreur enregistrement événement:', err);
      setError(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  // ── Programme : add / remove / reorder ──────────────────────────────────
  const addProgramItem = () => {
    setFormData(prev => ({ ...prev, program: [...prev.program, { id: Date.now().toString(), time: '', title: '', speaker: '', description: '' }] }));
  };
  const updateProgramItem = (idx: number, patch: Partial<ProgramItem>) => {
    setFormData(prev => ({ ...prev, program: prev.program.map((p, i) => i === idx ? { ...p, ...patch } : p) }));
  };
  const removeProgramItem = (idx: number) => {
    setFormData(prev => ({ ...prev, program: prev.program.filter((_, i) => i !== idx) }));
  };
  const moveProgramItem = (idx: number, dir: -1 | 1) => {
    setFormData(prev => {
      const arr = [...prev.program];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, program: arr };
    });
  };

  // ── Tarifs : add / remove ────────────────────────────────────────────────
  const addTicketTier = () => {
    setFormData(prev => ({ ...prev, ticket_tiers: [...prev.ticket_tiers, { id: Date.now().toString(), label: '', price: 0, description: '' }] }));
  };
  const updateTicketTier = (idx: number, patch: Partial<TicketTier>) => {
    setFormData(prev => ({ ...prev, ticket_tiers: prev.ticket_tiers.map((t, i) => i === idx ? { ...t, ...patch } : t) }));
  };
  const removeTicketTier = (idx: number) => {
    setFormData(prev => ({ ...prev, ticket_tiers: prev.ticket_tiers.filter((_, i) => i !== idx) }));
  };

  const fc = formData.feedback_config ?? { show_stars: true, fields: [] };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel — glisse de la droite vers la gauche */}
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-white w-full max-w-6xl h-full flex shadow-2xl"
        >
          {/* ── Timeline latérale ── */}
          <div className="hidden md:flex w-64 flex-shrink-0 bg-gray-50 border-r border-gray-100 flex-col py-8 px-5">
            <div className="mb-8 px-1">
              <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">
                {isEditing ? 'Modifier' : 'Nouvel événement'}
              </p>
              <h1 className="text-lg font-bold text-gray-800 leading-snug line-clamp-2">
                {formData.title || 'Sans titre'}
              </h1>
            </div>

            <div className="flex-1 relative">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const isActive = s.key === step;
                const isDone = idx < stepIndex;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => goToStep(s.key)}
                    className="relative flex items-start gap-3 pb-8 last:pb-0 w-full text-left group"
                  >
                    {idx < STEPS.length - 1 && (
                      <div className={`absolute left-[15px] top-8 bottom-0 w-0.5 transition-colors ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs transition-all ${
                      isActive ? 'bg-green-600 text-white shadow-md shadow-green-200 scale-110'
                        : isDone ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-400 border-2 border-gray-200 group-hover:border-gray-300'
                    }`}>
                      {isDone ? <Check size={14} /> : <Icon size={14} />}
                    </div>
                    <div className="pt-1 min-w-0">
                      <p className={`text-sm font-semibold transition-colors ${isActive ? 'text-gray-900' : isDone ? 'text-gray-600' : 'text-gray-400'}`}>
                        {s.label}
                      </p>
                      <p className="text-[11px] text-gray-400">{s.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Contenu ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar */}
            <div className="h-16 flex items-center justify-between px-5 sm:px-8 border-b border-gray-100 flex-shrink-0">
              <div className="md:hidden">
                <p className="text-xs font-bold text-green-600">{isEditing ? 'Modifier' : 'Nouvel événement'}</p>
                <p className="text-sm font-bold text-gray-800">Étape {stepIndex + 1}/{STEPS.length} — {STEPS[stepIndex].label}</p>
              </div>
              <div className="hidden md:block text-sm text-gray-400 font-medium">
                Étape {stepIndex + 1} sur {STEPS.length}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || fetching}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-50 text-sm"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  Enregistrer
                </button>
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {fetching ? (
                <div className="flex items-center justify-center h-full py-24">
                  <Loader2 size={28} className="animate-spin text-green-500" />
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18 }}
                    className="px-5 sm:px-8 py-8"
                  >
                    {error && (
                      <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                        {error}
                      </div>
                    )}

                    {/* ══ Étape 1 : Informations ══ */}
                    {step === 'info' && (
                      <div className="space-y-8">
                        <SectionHeader icon={FileText} title="Informations générales" sub="Renseignez les détails de votre événement." />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="sm:col-span-2 space-y-3">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Titre de l'événement *</label>
                              <input type="text" value={formData.title}
                                onChange={(e) => {
                                  const title = e.target.value;
                                  const updates: Partial<WizardEvent> = { title };
                                  if (!slugTouched.current) updates.slug = generateSlug(title);
                                  setFormData({ ...formData, ...updates });
                                }}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                placeholder="Ex: Conférence annuelle DDB 2025" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Lien personnalisé (slug)</label>
                              <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
                                <span className="px-3 py-2.5 text-xs text-gray-400 bg-gray-100 border-r border-gray-200 whitespace-nowrap select-none">/events/</span>
                                <input type="text" value={formData.slug || ''}
                                  onChange={(e) => { slugTouched.current = true; setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') }); }}
                                  className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm text-gray-700"
                                  placeholder="conference-annuelle-ddb-2025" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Thème de l'événement <span className="text-xs font-normal text-gray-400">(optionnel · s'affichera sur le visuel)</span>
                              </label>
                              <input
                                type="text"
                                value={formData.theme || ''}
                                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                placeholder="Ex: Identité et responsabilités de la jeunesse"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Type d'événement</label>
                            <select value={formData.event_type} onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all">
                              {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Date et heure (Début) *</label>
                            <input type="datetime-local" value={formData.event_date}
                              onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                          </div>

                          <div className="sm:col-span-2 border border-gray-200 p-4 rounded-xl bg-gray-50/50 space-y-4">
                            <div>
                              <label className="block text-sm font-bold text-gray-700">Dates additionnelles</label>
                              <p className="text-xs text-gray-400">Événement sur plusieurs jours.</p>
                            </div>
                            <div className="space-y-3">
                              {formData.event_dates.map((dateEntry, idx) => (
                                <div key={idx} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                  <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Libellé</label>
                                    <input type="text" value={dateEntry.label || ''}
                                      onChange={(e) => { const nd = [...formData.event_dates]; nd[idx] = { ...nd[idx], label: e.target.value }; setFormData({ ...formData, event_dates: nd }); }}
                                      placeholder={`Jour ${idx + 2}`}
                                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Date et heure</label>
                                    <input type="datetime-local" value={dateEntry.date || ''}
                                      onChange={(e) => { const nd = [...formData.event_dates]; nd[idx] = { ...nd[idx], date: e.target.value }; setFormData({ ...formData, event_dates: nd }); }}
                                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                  </div>
                                  <button type="button" onClick={() => setFormData({ ...formData, event_dates: formData.event_dates.filter((_, i) => i !== idx) })}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg mt-5 transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                              <button type="button"
                                onClick={() => setFormData({ ...formData, event_dates: [...formData.event_dates, { date: '', label: `Jour ${formData.event_dates.length + 2}` }] })}
                                className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-bold py-1.5 px-3 rounded-lg border border-dashed border-green-200 hover:bg-green-50/50 transition-colors">
                                <Plus size={14} /> Ajouter une date additionnelle
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Lieu</label>
                            <input type="text" value={formData.location}
                              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                              placeholder="Ex: Salle des fêtes, Lomé" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de places</label>
                            <input type="number" min="1" value={formData.max_slots === null ? '' : formData.max_slots}
                              onChange={(e) => setFormData({ ...formData, max_slots: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Laisser vide = illimité"
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Statut</label>
                            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as WizardEvent['status'] })}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all">
                              <option value="published">Publié (Visible)</option>
                              <option value="draft">Brouillon (Caché)</option>
                              <option value="cancelled">Annulé</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                          <RichTextEditor value={formData.description}
                            onChange={(html) => setFormData({ ...formData, description: html })}
                            placeholder="Description détaillée de l'événement..." rows={8} />
                        </div>

                        <div className="h-px bg-gray-100" />

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Image de couverture</label>
                          <p className="text-xs text-gray-400 mb-3">Illustre l'événement sur la page publique.</p>
                          <ImageUpload value={formData.image_url} onChange={(url) => setFormData({ ...formData, image_url: url })} bucket="ong-backend" folder="events" />
                        </div>

                        <div className="h-px bg-gray-100" />

                        {/* Logos — le logo de l'événement rejoint les autres logos */}
                        <div className="space-y-6">
                          <div>
                            <label className="block text-sm font-bold text-gray-700">Logos</label>
                            <p className="text-xs text-gray-400">Le logo de l'événement, des organisateurs et des partenaires — affichés sur le billet, le certificat et le visuel "J'y serai".</p>
                          </div>
                          <MultiLogoUpload
                            value={formData.logo_url ? [formData.logo_url] : []}
                            onChange={(urls) => setFormData({ ...formData, logo_url: urls[urls.length - 1] || '' })}
                            label="Logo de l'événement"
                            description="Le logo principal affiché en priorité."
                            icon={Sparkles}
                          />
                          <MultiLogoUpload
                            value={formData.organizer_logos}
                            onChange={(urls) => setFormData({ ...formData, organizer_logos: urls })}
                            label="Logos des organisateurs"
                            description="Apparaîtront sur le billet, le certificat et le poster J'y serai."
                            icon={Building2}
                          />
                          <MultiLogoUpload
                            value={formData.partner_logos}
                            onChange={(urls) => setFormData({ ...formData, partner_logos: urls })}
                            label="Logos des partenaires"
                            description="Partenaires & sponsors de l'événement."
                            icon={Handshake}
                          />
                        </div>
                      </div>
                    )}

                    {/* ══ Étape 2 : Questionnaires ══ */}
                    {step === 'questionnaires' && (
                      <div className="space-y-10">
                        <div>
                          <SectionHeader icon={ClipboardList} title="Formulaire d'inscription" sub="Nom, Email et Téléphone sont toujours inclus." />
                          <FieldBuilder fields={formData.form_fields}
                            onChange={(fields) => setFormData({ ...formData, form_fields: fields })}
                            addLabel="+ Ajouter une question" />
                        </div>

                        <div className="h-px bg-gray-100" />

                        <div>
                          <SectionHeader icon={Star} title="Avis post-événement" sub="Formulaire affiché aux visiteurs une fois l'événement terminé." />
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 mb-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-yellow-100 rounded-full flex items-center justify-center">
                                <Star size={18} className="text-yellow-500" fill="currentColor" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800 text-sm">Notation par étoiles</p>
                                <p className="text-xs text-gray-500">Afficher un sélecteur de 1 à 5 étoiles</p>
                              </div>
                            </div>
                            <Toggle checked={fc.show_stars} onChange={() => setFormData({ ...formData, feedback_config: { ...fc, show_stars: !fc.show_stars } })} />
                          </div>
                          <FieldBuilder fields={fc.fields}
                            onChange={(fields) => setFormData({ ...formData, feedback_config: { ...fc, fields } })}
                            addLabel="+ Ajouter une question d'avis" />
                        </div>
                      </div>
                    )}

                    {/* ══ Étape 3 : Programme & Billetterie ══ */}
                    {step === 'program' && (
                      <div className="space-y-10">
                        <div>
                          <SectionHeader icon={ClipboardList} title="Programme" sub="Agenda détaillé de l'événement." />
                          <div className="space-y-3">
                            {formData.program.map((item, idx) => (
                              <div key={item.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center gap-2 p-3 bg-gray-50 border-b border-gray-100">
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Étape {idx + 1}</span>
                                  <div className="ml-auto flex items-center gap-1">
                                    <button type="button" onClick={() => moveProgramItem(idx, -1)} disabled={idx === 0}
                                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-30 transition-colors">
                                      <ChevronUp size={14} />
                                    </button>
                                    <button type="button" onClick={() => moveProgramItem(idx, 1)} disabled={idx === formData.program.length - 1}
                                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-30 transition-colors">
                                      <ChevronDown size={14} />
                                    </button>
                                    <button type="button" onClick={() => removeProgramItem(idx)}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className="p-4 space-y-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-600 mb-1">Heure</label>
                                      <input type="text" value={item.time || ''} onChange={e => updateProgramItem(idx, { time: e.target.value })}
                                        placeholder="09h00"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                    </div>
                                    <div className="sm:col-span-2">
                                      <label className="block text-xs font-semibold text-gray-600 mb-1">Titre</label>
                                      <input type="text" value={item.title} onChange={e => updateProgramItem(idx, { title: e.target.value })}
                                        placeholder="Ex: Ouverture officielle"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Intervenant</label>
                                    <input type="text" value={item.speaker || ''} onChange={e => updateProgramItem(idx, { speaker: e.target.value })}
                                      placeholder="Ex: M. Kodjo Aziabou"
                                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                                    <textarea value={item.description || ''} onChange={e => updateProgramItem(idx, { description: e.target.value })}
                                      rows={2} placeholder="Courte description de cette partie du programme…"
                                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button type="button" onClick={addProgramItem}
                              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-semibold hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all flex items-center justify-center gap-2">
                              <Plus size={16} /> Ajouter une étape au programme
                            </button>
                          </div>
                        </div>

                        <div className="h-px bg-gray-100" />

                        <div>
                          <SectionHeader icon={Ticket} title="Billetterie" sub="Créez vos tarifs, puis choisissez le modèle de billet." />

                          <div className="mb-8">
                            <p className="text-sm font-bold text-gray-700 mb-3">Tarifs</p>
                            <div className="space-y-3">
                              {formData.ticket_tiers.map((tier, idx) => (
                                <div key={tier.id} className="border border-gray-200 rounded-xl bg-white shadow-sm p-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-start">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-600 mb-1">Libellé du tarif</label>
                                      <input type="text" value={tier.label} onChange={e => updateTicketTier(idx, { label: e.target.value })}
                                        placeholder="Ex: Standard, VIP, Étudiant…"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-600 mb-1">Prix (FCFA)</label>
                                      <input type="number" min="0" value={tier.price ?? ''} onChange={e => updateTicketTier(idx, { price: e.target.value ? parseFloat(e.target.value) : 0 })}
                                        placeholder="0 = gratuit"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                    </div>
                                    <button type="button" onClick={() => removeTicketTier(idx)}
                                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-5 justify-self-end">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                  <div className="mt-3">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optionnel)</label>
                                    <input type="text" value={tier.description || ''} onChange={e => updateTicketTier(idx, { description: e.target.value })}
                                      placeholder="Ex: Accès à toutes les sessions + déjeuner"
                                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                  </div>
                                </div>
                              ))}
                              <button type="button" onClick={addTicketTier}
                                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-semibold hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all flex items-center justify-center gap-2">
                                <Plus size={16} /> Ajouter un tarif
                              </button>
                            </div>
                          </div>

                          <p className="text-sm font-bold text-gray-700 mb-3">Modèle de billet / carton d'invitation — aperçu en direct</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {(['classic', 'modern', 'invitation'] as TicketTemplate[]).map(tpl => (
                              <TicketPreviewCard
                                key={tpl}
                                template={tpl}
                                selected={formData.ticket_template === tpl}
                                onSelect={() => setFormData({ ...formData, ticket_template: tpl })}
                                eventTitle={formData.title}
                                eventDate={formData.event_date}
                                location={formData.location}
                                invitationText={formData.invitation_text}
                                invitationSubtext={formData.invitation_subtext}
                              />
                            ))}
                          </div>

                          {/* Options spécifiques au carton d'invitation */}
                          {formData.ticket_template === 'invitation' && (
                            <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/70 via-rose-50/40 to-amber-50/70 space-y-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                                  <FileText size={15} />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                                    Personnalisation du texte de l'invitation
                                  </h4>
                                  <p className="text-[11px] text-amber-800/80">
                                    Adaptez le message selon le contexte (Dîner de gala, Cérémonie, Soirée VIP, Assemblée générale...)
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-3 pt-1">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold text-gray-800">
                                      Texte ou formule principale d'invitation
                                    </label>
                                    <span className="text-[10px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded font-mono">
                                      {'{name}'} ou [nom] pour le participant
                                    </span>
                                  </div>
                                  <textarea
                                    rows={2}
                                    value={formData.invitation_text || ''}
                                    onChange={e => setFormData({ ...formData, invitation_text: e.target.value })}
                                    placeholder={`Ex: « M./Mme {name}, nous avons le plaisir de vous convier à cette grande occasion... » (laisser vide pour la formule par défaut)`}
                                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed"
                                  />
                                  <p className="text-[10.5px] text-gray-500 mt-1">
                                    Si vous laissez ce champ vide, le texte par défaut sera automatique : <em>« À l'occasion de « {formData.title || "l'événement"} » »</em>.
                                  </p>
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                                    Message de bienvenue / mention calligraphique du bas
                                  </label>
                                  <input
                                    type="text"
                                    value={formData.invitation_subtext || ''}
                                    onChange={e => setFormData({ ...formData, invitation_subtext: e.target.value })}
                                    placeholder="Ex: Soyez les bienvenus · Tenue de soirée exigée"
                                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none"
                                  />
                                  <p className="text-[10.5px] text-gray-500 mt-1">
                                    S'affiche au bas du carton avec une typographie élégante bordeaux (par défaut : <em>« Soyez les bienvenus »</em>).
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ══ Étape 4 : Certificats ══ */}
                    {step === 'certificates' && (
                      <div className="space-y-6">
                        <SectionHeader icon={Award} title="Certificats de participation" sub="Générez une attestation téléchargeable par les participants après l'événement." />
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                              <Award size={18} className="text-green-700" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">Activer les certificats</p>
                              <p className="text-xs text-gray-500">Les inscrits pourront récupérer leur certificat une fois l'événement terminé.</p>
                            </div>
                          </div>
                          <Toggle checked={formData.certificate_enabled} onChange={() => setFormData({ ...formData, certificate_enabled: !formData.certificate_enabled })} />
                        </div>

                        {formData.certificate_enabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            {(['classic', 'modern'] as CertificateTemplate[]).map(tpl => (
                              <CertificatePreviewCard
                                key={tpl}
                                template={tpl}
                                selected={formData.certificate_template === tpl}
                                onSelect={() => setFormData({ ...formData, certificate_template: tpl })}
                                eventTitle={formData.title}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ══ Étape 5 : Visuel J'y serai ══ */}
                    {step === 'poster' && (
                      <div className="space-y-6">
                        <SectionHeader icon={Sparkles} title="Visuel « J'y serai »" sub="Permet aux inscrits de générer une affiche personnalisée à partager." />
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                              <Sparkles size={18} className="text-green-700" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">Activer le visuel "J'y serai"</p>
                              <p className="text-xs text-gray-500">Affiche un bouton de génération d'affiche sur la page publique.</p>
                            </div>
                          </div>
                          <Toggle checked={formData.poster_enabled} onChange={() => setFormData({ ...formData, poster_enabled: !formData.poster_enabled })} />
                        </div>

                        {formData.poster_enabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            {(['classic', 'modern'] as PosterTemplate[]).map(tpl => (
                              <PosterPreviewCard
                                key={tpl}
                                template={tpl}
                                selected={formData.poster_template === tpl}
                                onSelect={() => setFormData({ ...formData, poster_template: tpl })}
                                event={{
                                  title: formData.title,
                                  image_url: formData.image_url || null,
                                  logo_url: formData.logo_url,
                                  event_date: formData.event_date,
                                  event_dates: formData.event_dates,
                                  organizer_logos: formData.organizer_logos,
                                  partner_logos: formData.partner_logos,
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {/* Footer navigation */}
            <div className="border-t border-gray-100 px-5 sm:px-8 py-4 flex items-center justify-between flex-shrink-0 bg-white">
              <button type="button" onClick={goPrev} disabled={stepIndex === 0}
                className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all text-sm">
                Étape précédente
              </button>
              <div className="flex items-center gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || fetching}
                  className="flex items-center gap-2 px-4 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-50 text-sm"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  Enregistrer
                </button>
              </div>
              {stepIndex < STEPS.length - 1 ? (
                <button type="button" onClick={goNext}
                  className="flex items-center gap-2 px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md text-sm">
                  Suivant
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              ) : (
                <button type="button" onClick={handleSave} disabled={saving || fetching}
                  className="hidden sm:flex items-center gap-2 px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 text-sm">
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {isEditing ? 'Enregistrer les modifications' : "Créer l'événement"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EventWizardModal;
