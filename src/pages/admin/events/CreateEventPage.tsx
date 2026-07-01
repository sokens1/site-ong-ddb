import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import ImageUpload from '../../../components/admin/ImageUpload';
import RichTextEditor from '../../../components/admin/RichTextEditor';
import {
  ArrowLeft, Users, Trash2, Plus, Star, X as XIcon, GripVertical,
  FileText, ClipboardList, MessageSquare, Download, Eye, Search,
  Building2, Handshake, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../supabaseClient';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';
import Modal from '../../../components/admin/Modal';

// ─── Interfaces ──────────────────────────────────────────────────────────────

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
  image_url: string;
  max_slots: number | null;
  price?: number | null;
  status: 'draft' | 'published' | 'cancelled';
  form_fields?: FormField[];
  feedback_config?: FeedbackConfig;
  created_at?: string;
  event_dates?: { date: string; label?: string }[];
  logo_url?: string;
  organizer_logos?: string[];
  partner_logos?: string[];
}

interface Registration {
  id: number;
  event_id: number;
  fullname: string;
  email: string;
  phone?: string;
  ticket_ref?: string;
  created_at?: string;
  custom_data?: Record<string, any>;
}

interface EventFeedback {
  id: number;
  participant_name: string;
  rating: number;
  comment: string;
  custom_answers?: Record<string, any>;
  created_at: string;
}

// ─── MultiLogoUpload ─────────────────────────────────────────────────────────

interface MultiLogoUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  label: string;
  description?: string;
  icon?: React.ElementType;
}

const MultiLogoUpload: React.FC<MultiLogoUploadProps> = ({ value, onChange, label, description, icon: Icon }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { alert('Fichier trop volumineux (max 5 Mo)'); continue; }
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `events/logo_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('ong-backend').upload(fileName, file);
      if (error) { alert(`Erreur d'upload : ${error.message}`); continue; }
      const { data } = supabase.storage.from('ong-backend').getPublicUrl(fileName);
      newUrls.push(data.publicUrl);
    }
    if (newUrls.length) onChange([...value, ...newUrls]);
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Icon size={14} className="text-green-700" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
        {value.map((url, idx) => (
          <div key={idx} className="relative group w-20 h-20 bg-white border-2 border-gray-200 rounded-xl overflow-hidden flex items-center justify-center shadow-sm">
            <img src={url} alt="" className="max-w-full max-h-full object-contain p-1.5" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center hidden group-hover:flex transition-all shadow"
            >
              <XIcon size={10} className="text-white" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all"
        >
          {uploading ? (
            <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Plus size={18} />
              <span className="text-[10px] mt-1 font-semibold">Ajouter</span>
            </>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      </div>
    </div>
  );
};

// ─── FieldBuilder ─────────────────────────────────────────────────────────────

interface FieldBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  addLabel?: string;
}

const FieldBuilder: React.FC<FieldBuilderProps> = ({ fields, onChange, addLabel = '+ Ajouter un champ' }) => {
  const updateField = (index: number, patch: Partial<FormField>) => {
    onChange(fields.map((f, i) => i === index ? { ...f, ...patch } : f));
  };

  const addOption = (index: number) => {
    updateField(index, { options: [...(fields[index].options || []), ''] });
  };

  const updateOption = (fieldIdx: number, optIdx: number, value: string) => {
    const opts = [...(fields[fieldIdx].options || [])];
    opts[optIdx] = value;
    updateField(fieldIdx, { options: opts });
  };

  const removeOption = (fieldIdx: number, optIdx: number) => {
    updateField(fieldIdx, { options: (fields[fieldIdx].options || []).filter((_, i) => i !== optIdx) });
  };

  const hasOptions = (type: string) => ['select', 'radio', 'checkbox'].includes(type);

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {fields.map((field, index) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-100">
              <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Champ {index + 1}</span>
              <button type="button" onClick={() => onChange(fields.filter((_, i) => i !== index))}
                className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <XIcon size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Libellé de la question</label>
                  <input type="text" value={field.label} onChange={e => updateField(index, { label: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Ex: Quelle est votre profession ?" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type de champ</label>
                  <select value={field.type}
                    onChange={e => updateField(index, { type: e.target.value as FormField['type'], options: hasOptions(e.target.value) ? (field.options ?? []) : undefined })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                    <option value="text">Texte court</option>
                    <option value="textarea">Texte long</option>
                    <option value="select">Liste déroulante</option>
                    <option value="radio">Choix unique</option>
                    <option value="checkbox">Choix multiple</option>
                  </select>
                </div>
              </div>
              {hasOptions(field.type) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Options de réponse</label>
                  <div className="space-y-2">
                    {(field.options || []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-gray-400">{optIdx + 1}</span>
                        </div>
                        <input type="text" value={opt} onChange={e => updateOption(index, optIdx, e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                          placeholder={`Option ${optIdx + 1}`} />
                        <button type="button" onClick={() => removeOption(index, optIdx)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded">
                          <XIcon size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addOption(index)}
                      className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-semibold py-1 px-2 rounded-lg hover:bg-green-50 transition-colors">
                      <Plus size={14} /> Ajouter une option
                    </button>
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <div onClick={() => updateField(index, { required: !field.required })}
                  className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${field.required ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${field.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-700">Réponse obligatoire</span>
              </label>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <button type="button" onClick={() => onChange([...fields, { id: Date.now().toString(), label: '', type: 'text', required: false }])}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-semibold hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all flex items-center justify-center gap-2">
        <Plus size={16} /> {addLabel}
      </button>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const CreateEventPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { create, update, data: eventsData } = useCrud<Event>({ tableName: 'events' });
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState<'info' | 'form' | 'feedback_config' | 'participants' | 'feedbacks'>('info');
  const [creationStep, setCreationStep] = useState<1 | 2>(1);

  const getCurrentDateTime = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState<Partial<Event>>({
    title: '', description: '', event_date: getCurrentDateTime(),
    location: '', image_url: '', max_slots: null, price: 0,
    status: 'published', form_fields: [],
    feedback_config: { show_stars: true, fields: [] },
    event_dates: [], logo_url: '',
    organizer_logos: [], partner_logos: [],
  });

  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState<EventFeedback[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [participantSearch, setParticipantSearch] = useState('');
  const itemsPerPage = 10;

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'success';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [viewingParticipant, setViewingParticipant] = useState<Registration | null>(null);

  useEffect(() => {
    if (isEditing && id && eventsData) {
      const eventItem = eventsData.find((item) => item.id === parseInt(id));
      if (eventItem) {
        let dateValue = getCurrentDateTime();
        if (eventItem.event_date) {
          try {
            const d = new Date(eventItem.event_date);
            if (!isNaN(d.getTime())) {
              dateValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
          } catch {}
        }
        setFormData({
          ...eventItem,
          event_date: dateValue,
          feedback_config: eventItem.feedback_config ?? { show_stars: true, fields: [] },
          event_dates: eventItem.event_dates || [],
          logo_url: eventItem.logo_url || '',
          organizer_logos: Array.isArray(eventItem.organizer_logos) ? eventItem.organizer_logos : [],
          partner_logos: Array.isArray(eventItem.partner_logos) ? eventItem.partner_logos : [],
        });
        fetchRegistrations(parseInt(id));
        fetchFeedbacks(parseInt(id));
      }
    }
  }, [id, isEditing, eventsData]);

  const fetchFeedbacks = async (eventId: number) => {
    setFeedbacksLoading(true);
    const { data, error } = await supabase.from('event_feedbacks').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    if (!error && data) setFeedbacks(data);
    setFeedbacksLoading(false);
  };

  const fetchRegistrations = async (eventId: number) => {
    setRegistrationsLoading(true);
    const { data, error } = await supabase.from('event_registrations').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    if (!error && data) { setRegistrations(data); setCurrentPage(1); }
    setRegistrationsLoading(false);
  };

  const handleBack = () => navigate('/admin/events');

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.title || !formData.event_date) { alert('Le titre et la date sont obligatoires.'); return; }
    try {
      setLoading(true);
      const dataToSubmit: any = {
        title: formData.title,
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
      };
      if (isEditing && id) { await update(parseInt(id), dataToSubmit); }
      else { await create(dataToSubmit); }
      navigate('/admin/events');
    } catch (err) {
      alert("Erreur lors de l'enregistrement.");
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleDeleteRegistration = (regId: number) => {
    setConfirmModal({
      isOpen: true, title: "Supprimer l'inscription", type: 'danger',
      message: 'Êtes-vous sûr de vouloir supprimer cette inscription définitivement ?',
      onConfirm: async () => {
        try {
          const { data, error } = await supabase
            .from('event_registrations')
            .delete()
            .eq('id', regId)
            .select('id');
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error('Suppression bloquée par les permissions Supabase. Vérifiez la politique RLS DELETE sur event_registrations.');
          }
          setRegistrations(prev => prev.filter(r => r.id !== regId));
        } catch (err: any) { alert(`Erreur: ${err.message}`); }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const exportCSV = () => {
    const customFields = formData.form_fields || [];
    const headers = ['#', 'Nom', 'Email', 'Téléphone', 'Réf. billet', 'Date inscription', ...customFields.map(f => f.label)];
    const rows = registrations.map((reg, idx) => [
      idx + 1, reg.fullname, reg.email, reg.phone || '', reg.ticket_ref || '',
      reg.created_at ? new Date(reg.created_at).toLocaleString('fr-FR') : '',
      ...customFields.map(f => {
        const val = reg.custom_data?.[f.id];
        return Array.isArray(val) ? val.join(', ') : String(val ?? '');
      }),
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `participants_${(formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { key: 'info', label: 'Informations', icon: FileText, sub: 'Détails & médias' },
    { key: 'form', label: 'Formulaire', icon: ClipboardList, sub: "Champs d'inscription" },
    { key: 'feedback_config', label: 'Config. Avis', icon: Star, sub: 'Questions post-événement' },
    { key: 'participants', label: 'Participants', icon: Users, sub: 'Inscrits', badge: registrations.length || null },
    { key: 'feedbacks', label: 'Avis reçus', icon: MessageSquare, sub: 'Retours', badge: feedbacks.length || null },
  ] as const;

  const fc = formData.feedback_config ?? { show_stars: true, fields: [] };
  const filteredRegs = participantSearch.trim()
    ? registrations.filter(r => {
        const q = participantSearch.toLowerCase();
        const inCustom = r.custom_data
          ? Object.values(r.custom_data).some(v => typeof v === 'string' && v.toLowerCase().includes(q))
          : false;
        return (
          r.fullname?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          inCustom
        );
      })
    : registrations;
  const paginatedRegs = filteredRegs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredRegs.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="bg-white shadow-sm sticky top-0 z-10 w-full border-b border-gray-200 px-4 sm:px-8 h-14 flex items-center justify-between flex-shrink-0">
        <button onClick={handleBack} className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors">
          <ArrowLeft size={18} /> Retour
        </button>
        <div className="text-gray-800 font-bold hidden sm:block">
          {isEditing ? "Modifier l'Événement" : 'Créer un Événement'}
        </div>
        {isEditing ? (
          <button onClick={handleSave} disabled={loading}
            className="px-5 py-2 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 text-sm">
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Enregistrer
          </button>
        ) : (
          <div className="text-xs text-gray-400 font-medium">
            Étape {creationStep} / 2
          </div>
        )}
      </div>

      {/* Tab Navigation — édition uniquement */}
      {isEditing && (
        <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
          <div className="flex overflow-x-auto scrollbar-hide px-3 sm:px-6 gap-1.5 py-2.5">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-green-600 text-white shadow-md shadow-green-200'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                  {'badge' in tab && tab.badge ? (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-green-100 text-green-800'}`}>
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step Indicator — création uniquement */}
      {!isEditing && (
        <div className="bg-white border-b border-gray-100 sticky top-14 z-10">
          <div className="px-6 sm:px-10 py-4">
            <div className="flex items-center gap-3">
              {/* Step 1 */}
              <button
                type="button"
                onClick={() => setCreationStep(1)}
                className="flex items-center gap-2.5 group"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  creationStep >= 1 ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'bg-gray-200 text-gray-400'
                }`}>
                  1
                </div>
                <div className="text-left hidden sm:block">
                  <p className={`text-xs font-bold transition-colors ${creationStep === 1 ? 'text-green-700' : 'text-gray-400'}`}>
                    ÉTAPE 1
                  </p>
                  <p className={`text-sm font-semibold transition-colors ${creationStep === 1 ? 'text-gray-800' : 'text-gray-400'}`}>
                    Informations
                  </p>
                </div>
              </button>

              {/* Connector */}
              <div className="flex-1 flex items-center gap-1">
                <div className={`h-1 rounded-full flex-1 transition-all duration-500 ${creationStep >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
                <div className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${creationStep >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  creationStep >= 2 ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'bg-gray-200 text-gray-400'
                }`}>
                  2
                </div>
                <div className="text-left hidden sm:block">
                  <p className={`text-xs font-bold transition-colors ${creationStep === 2 ? 'text-green-700' : 'text-gray-400'}`}>
                    ÉTAPE 2
                  </p>
                  <p className={`text-sm font-semibold transition-colors ${creationStep === 2 ? 'text-gray-800' : 'text-gray-400'}`}>
                    Image & Logos
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 w-full">

        {/* ── Info Tab ── */}
        {activeTab === 'info' && (
          <AnimatePresence mode="wait">

            {/* ══ CRÉATION — Étape 1 : Informations ══ */}
            {(!isEditing && creationStep === 1) && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <div className="px-6 sm:px-10 py-8 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-green-700" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">Informations générales</h2>
                      <p className="text-xs text-gray-400">Renseignez les détails de votre événement.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Titre de l'événement *</label>
                      <input type="text" value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                        placeholder="Ex: Conférence annuelle DDB 2025" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Date et heure (Début) *</label>
                      <input type="datetime-local" value={formData.event_date || ''}
                        onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                    </div>

                    <div className="sm:col-span-2 border border-gray-200 p-4 rounded-xl bg-gray-50/50 space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700">Dates additionnelles</label>
                        <p className="text-xs text-gray-400">Événement sur plusieurs jours.</p>
                      </div>
                      <div className="space-y-3">
                        {(formData.event_dates || []).map((dateEntry, idx) => (
                          <div key={idx} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex-1">
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Libellé</label>
                              <input type="text" value={dateEntry.label || ''}
                                onChange={(e) => {
                                  const nd = [...(formData.event_dates || [])];
                                  nd[idx] = { ...nd[idx], label: e.target.value };
                                  setFormData({ ...formData, event_dates: nd });
                                }}
                                placeholder={`Jour ${idx + 2}`}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Date et heure</label>
                              <input type="datetime-local" value={dateEntry.date || ''}
                                onChange={(e) => {
                                  const nd = [...(formData.event_dates || [])];
                                  nd[idx] = { ...nd[idx], date: e.target.value };
                                  setFormData({ ...formData, event_dates: nd });
                                }}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                            </div>
                            <button type="button"
                              onClick={() => setFormData({ ...formData, event_dates: (formData.event_dates || []).filter((_, i) => i !== idx) })}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg mt-5 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <button type="button"
                          onClick={() => setFormData({ ...formData, event_dates: [...(formData.event_dates || []), { date: '', label: `Jour ${(formData.event_dates || []).length + 2}` }] })}
                          className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-bold py-1.5 px-3 rounded-lg border border-dashed border-green-200 hover:bg-green-50/50 transition-colors">
                          <Plus size={14} /> Ajouter une date additionnelle
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Lieu</label>
                      <input type="text" value={formData.location || ''}
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
                      <select value={formData.status || 'published'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Event['status'] })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all">
                        <option value="published">Publié (Visible)</option>
                        <option value="draft">Brouillon (Caché)</option>
                        <option value="cancelled">Annulé</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
                    <RichTextEditor value={formData.description || ''}
                      onChange={(html) => setFormData({ ...formData, description: html })}
                      placeholder="Description détaillée de l'événement..." rows={10} />
                  </div>

                  {/* Navigation étape 1 */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <button type="button" onClick={handleBack}
                      className="px-5 py-2.5 font-semibold text-gray-500 hover:text-gray-700 transition-colors text-sm">
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!formData.title?.trim()) { alert('Le titre de l\'événement est obligatoire.'); return; }
                        if (!formData.event_date) { alert('La date est obligatoire.'); return; }
                        setCreationStep(2);
                        window.scrollTo(0, 0);
                      }}
                      className="flex items-center gap-2 px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md text-sm"
                    >
                      Suivant
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══ CRÉATION — Étape 2 : Image & Logos ══ */}
            {(!isEditing && creationStep === 2) && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.22 }}
              >
                <div className="px-6 sm:px-10 py-8 space-y-8">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles size={18} className="text-green-700" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">Image & Logos</h2>
                      <p className="text-xs text-gray-400">Ajoutez les visuels de votre événement.</p>
                    </div>
                  </div>

                  {/* Cover image */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Image de couverture</label>
                    <p className="text-xs text-gray-400 mb-3">Illustre l'événement sur la page publique.</p>
                    <ImageUpload
                      value={formData.image_url || ''}
                      onChange={(url) => setFormData({ ...formData, image_url: url })}
                      bucket="ong-backend" folder="events"
                    />
                  </div>

                  <div className="h-px bg-gray-100" />

                  {/* Logo principal */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Sparkles size={14} className="text-green-700" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Logo principal de l'événement</p>
                        <p className="text-xs text-gray-400">Affiché sur le visuel et le poster "J'y serai".</p>
                      </div>
                    </div>
                    <div className="max-w-xs">
                      <ImageUpload
                        value={formData.logo_url || ''}
                        onChange={(url) => setFormData({ ...formData, logo_url: url })}
                        bucket="ong-backend" folder="events"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  {/* Logos organisateurs */}
                  <MultiLogoUpload
                    value={formData.organizer_logos || []}
                    onChange={(urls) => setFormData({ ...formData, organizer_logos: urls })}
                    label="Logos des organisateurs"
                    description="Apparaîtront sur le billet et le poster J'y serai."
                    icon={Building2}
                  />

                  <div className="h-px bg-gray-100" />

                  {/* Logos partenaires */}
                  <MultiLogoUpload
                    value={formData.partner_logos || []}
                    onChange={(urls) => setFormData({ ...formData, partner_logos: urls })}
                    label="Logos des partenaires"
                    description="Partenaires & sponsors de l'événement."
                    icon={Handshake}
                  />

                  {/* Navigation étape 2 */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <button type="button"
                      onClick={() => { setCreationStep(1); window.scrollTo(0, 0); }}
                      className="flex items-center gap-2 px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all text-sm">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                      Étape précédente
                    </button>
                    <button type="button" onClick={handleSave} disabled={loading}
                      className="flex items-center gap-2 px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 text-sm">
                      {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                      Créer l'événement
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══ ÉDITION — Info Tab : tout en une page ══ */}
            {isEditing && (
              <motion.div
                key="edit-info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Images & Logos */}
                <div className="px-6 sm:px-10 py-8 border-b border-gray-100">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles size={18} className="text-green-700" />
                    </div>
                    <h2 className="text-base font-bold text-gray-800">Image & Logos</h2>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Image de couverture *</label>
                    <p className="text-xs text-gray-400 mb-3">Illustre l'événement sur la page publique.</p>
                    <ImageUpload value={formData.image_url || ''} onChange={(url) => setFormData({ ...formData, image_url: url })} bucket="ong-backend" folder="events" />
                  </div>

                  <div className="mb-6 pb-6 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Sparkles size={14} className="text-green-700" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Logo principal</p>
                        <p className="text-xs text-gray-400">Affiché sur le visuel et le poster "J'y serai".</p>
                      </div>
                    </div>
                    <div className="max-w-xs">
                      <ImageUpload value={formData.logo_url || ''} onChange={(url) => setFormData({ ...formData, logo_url: url })} bucket="ong-backend" folder="events" />
                    </div>
                  </div>

                  <div className="mb-6 pb-6 border-b border-gray-100">
                    <MultiLogoUpload value={formData.organizer_logos || []} onChange={(urls) => setFormData({ ...formData, organizer_logos: urls })}
                      label="Logos des organisateurs" description="Apparaîtront sur le billet et le poster J'y serai." icon={Building2} />
                  </div>
                  <MultiLogoUpload value={formData.partner_logos || []} onChange={(urls) => setFormData({ ...formData, partner_logos: urls })}
                    label="Logos des partenaires" description="Partenaires & sponsors de l'événement." icon={Handshake} />
                </div>

                {/* Informations générales */}
                <div className="px-6 sm:px-10 py-8">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-green-700" />
                    </div>
                    <h2 className="text-base font-bold text-gray-800">Informations générales</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Titre de l'événement *</label>
                      <input type="text" required value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                        placeholder="Ex: Conférence annuelle DDB 2025" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Date et heure (Début) *</label>
                      <input type="datetime-local" required value={formData.event_date || ''}
                        onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                    </div>

                    <div className="sm:col-span-2 border border-gray-200 p-4 rounded-xl bg-gray-50/50 space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700">Dates additionnelles</label>
                        <p className="text-xs text-gray-400">Événement sur plusieurs jours.</p>
                      </div>
                      <div className="space-y-3">
                        {(formData.event_dates || []).map((dateEntry, idx) => (
                          <div key={idx} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex-1">
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Libellé</label>
                              <input type="text" value={dateEntry.label || ''}
                                onChange={(e) => { const nd = [...(formData.event_dates || [])]; nd[idx] = { ...nd[idx], label: e.target.value }; setFormData({ ...formData, event_dates: nd }); }}
                                placeholder={`Jour ${idx + 2}`} className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Date et heure</label>
                              <input type="datetime-local" value={dateEntry.date || ''}
                                onChange={(e) => { const nd = [...(formData.event_dates || [])]; nd[idx] = { ...nd[idx], date: e.target.value }; setFormData({ ...formData, event_dates: nd }); }}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                            </div>
                            <button type="button" onClick={() => setFormData({ ...formData, event_dates: (formData.event_dates || []).filter((_, i) => i !== idx) })}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg mt-5 transition-colors"><Trash2 size={16} /></button>
                          </div>
                        ))}
                        <button type="button"
                          onClick={() => setFormData({ ...formData, event_dates: [...(formData.event_dates || []), { date: '', label: `Jour ${(formData.event_dates || []).length + 2}` }] })}
                          className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-bold py-1.5 px-3 rounded-lg border border-dashed border-green-200 hover:bg-green-50/50 transition-colors">
                          <Plus size={14} /> Ajouter une date additionnelle
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Lieu</label>
                      <input type="text" value={formData.location || ''} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all" placeholder="Ex: Salle des fêtes, Lomé" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de places</label>
                      <input type="number" min="1" value={formData.max_slots === null ? '' : formData.max_slots}
                        onChange={(e) => setFormData({ ...formData, max_slots: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Laisser vide = illimité" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Statut</label>
                      <select value={formData.status || 'published'} onChange={(e) => setFormData({ ...formData, status: e.target.value as Event['status'] })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all">
                        <option value="published">Publié (Visible)</option>
                        <option value="draft">Brouillon (Caché)</option>
                        <option value="cancelled">Annulé</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
                    <RichTextEditor value={formData.description || ''} onChange={(html) => setFormData({ ...formData, description: html })}
                      placeholder="Description détaillée de l'événement..." rows={10} />
                  </div>

                  <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end gap-3">
                    <button type="button" onClick={handleBack} className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all text-sm">
                      Annuler
                    </button>
                    <button type="button" onClick={handleSave} disabled={loading}
                      className="px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm">
                      {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Enregistrer les modifications
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        )}

        {/* ── Form Tab ── */}
        {activeTab === 'form' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 sm:px-10 py-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800">Champs du formulaire d'inscription</h2>
              <p className="text-gray-500 text-sm mt-1">Ajoutez des questions supplémentaires (Nom, Email et Téléphone sont toujours inclus).</p>
            </div>
            <FieldBuilder fields={formData.form_fields || []}
              onChange={(fields) => setFormData({ ...formData, form_fields: fields })}
              addLabel="+ Ajouter une question" />
            <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={handleBack} className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all text-sm">Annuler</button>
              <button type="button" onClick={handleSave} disabled={loading}
                className="px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm">
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Enregistrer
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Feedback Config Tab ── */}
        {activeTab === 'feedback_config' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 sm:px-10 py-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800">Configuration du formulaire d'avis</h2>
              <p className="text-gray-500 text-sm mt-1">Ce formulaire apparaît aux visiteurs lorsque l'événement est terminé.</p>
            </div>
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
              <button type="button"
                onClick={() => setFormData({ ...formData, feedback_config: { ...fc, show_stars: !fc.show_stars } })}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${fc.show_stars ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${fc.show_stars ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-700 mb-1">Questions personnalisées</h3>
              <p className="text-xs text-gray-400 mb-4">Ajoutez des questions pour recueillir des retours spécifiques.</p>
            </div>
            <FieldBuilder fields={fc.fields}
              onChange={(fields) => setFormData({ ...formData, feedback_config: { ...fc, fields } })}
              addLabel="+ Ajouter une question d'avis" />
            <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={handleBack} className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all text-sm">Annuler</button>
              <button type="button" onClick={handleSave} disabled={loading}
                className="px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm">
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Enregistrer
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Participants Tab ── */}
        {activeTab === 'participants' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Participants inscrits</h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  <span className="font-bold text-green-600">{registrations.length}</span> inscription{registrations.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Recherche */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Rechercher…"
                    value={participantSearch}
                    onChange={e => { setParticipantSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 w-44"
                  />
                </div>
                {registrations.length > 0 && (
                  <button onClick={exportCSV}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-100 transition-colors border border-green-200">
                    <Download size={15} /> Exporter CSV
                  </button>
                )}
                <button onClick={() => fetchRegistrations(parseInt(id!))}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  Rafraîchir
                </button>
              </div>
            </div>

            {registrationsLoading ? (
              <div className="text-center py-16">
                <span className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin inline-block" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-16 mx-6 sm:mx-10 my-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Users size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">Aucune inscription pour le moment.</p>
                <p className="text-sm text-gray-400 mt-1">Les inscrits via le site public apparaîtront ici.</p>
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-10">#</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Participant</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedRegs.map((reg, idx) => {
                        const hasCustomData = reg.custom_data && Object.keys(reg.custom_data).length > 0;
                        const rowNum = (currentPage - 1) * itemsPerPage + idx + 1;
                        return (
                          <tr key={reg.id} className="hover:bg-green-50/30 transition-colors group">
                            <td className="px-5 py-4 text-gray-400 font-mono text-xs">{rowNum}</td>
                            <td className="px-4 py-4">
                              <p className="font-bold text-gray-900">{reg.fullname}</p>
                              {hasCustomData && (
                                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                  {Object.keys(reg.custom_data!).length} réponse{Object.keys(reg.custom_data!).length > 1 ? 's' : ''}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 hidden sm:table-cell">
                              <p className="text-gray-700">{reg.email}</p>
                              {reg.phone && <p className="text-gray-400 text-xs mt-0.5">{reg.phone}</p>}
                            </td>
                            <td className="px-4 py-4 hidden md:table-cell text-gray-400 text-xs whitespace-nowrap">
                              {reg.created_at ? new Date(reg.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setViewingParticipant(reg)}
                                  title="Voir les détails"
                                  className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteRegistration(reg.id)}
                                  title="Supprimer"
                                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-6 sm:px-10 py-4 border-t border-gray-100">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Précédent
                    </button>
                    <span className="text-sm text-gray-500 font-medium">Page {currentPage} sur {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── Feedbacks Tab ── */}
        {activeTab === 'feedbacks' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 sm:px-10 py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Avis reçus</h2>
                <p className="text-gray-500 text-sm mt-1">{feedbacks.length} avis enregistrés</p>
              </div>
              <button onClick={() => fetchFeedbacks(parseInt(id!))} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200">
                Rafraîchir
              </button>
            </div>
            {feedbacksLoading ? (
              <div className="text-center py-12"><span className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin inline-block" /></div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Star size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">Aucun avis pour le moment.</p>
                <p className="text-xs text-gray-400 mt-1">Les avis s'affichent une fois l'événement terminé.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map(fb => (
                  <div key={fb.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-green-100 hover:shadow-sm transition-all">
                    <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                      <p className="font-bold text-gray-900">{fb.participant_name || 'Anonyme'}</p>
                      {fb.rating > 0 && (
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={16} className={fb.rating >= s ? 'text-yellow-400' : 'text-gray-200'} fill={fb.rating >= s ? 'currentColor' : 'none'} />
                          ))}
                        </div>
                      )}
                    </div>
                    {fb.comment && <p className="text-gray-600 text-sm italic mb-2">"{fb.comment}"</p>}
                    {fb.custom_answers && Object.keys(fb.custom_answers).length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                        {Object.entries(fb.custom_answers).map(([key, val]) => (
                          <p key={key} className="text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">{key}:</span> {Array.isArray(val) ? val.join(', ') : String(val)}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">{new Date(fb.created_at).toLocaleDateString('fr-FR')} {new Date(fb.created_at).toLocaleTimeString('fr-FR')}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      {/* Participant detail modal */}
      {viewingParticipant && (
        <Modal
          isOpen={!!viewingParticipant}
          onClose={() => setViewingParticipant(null)}
          title={`Détails — ${viewingParticipant.fullname}`}
          size="lg"
        >
          <div className="p-5 space-y-5">
            {/* Base info */}
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Informations de base</h4>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                {[
                  { label: 'Nom complet', value: viewingParticipant.fullname },
                  { label: 'Email', value: viewingParticipant.email },
                  { label: 'Téléphone', value: viewingParticipant.phone || '—' },
                  { label: 'Réf. billet', value: viewingParticipant.ticket_ref || '—' },
                  {
                    label: 'Date inscription',
                    value: viewingParticipant.created_at
                      ? new Date(viewingParticipant.created_at).toLocaleString('fr-FR')
                      : '—',
                  },
                ].map(row => (
                  <div key={row.label} className="flex gap-3">
                    <span className="text-xs font-semibold text-gray-500 w-36 flex-shrink-0 pt-0.5">{row.label}</span>
                    <span className="text-sm text-gray-800 font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom form answers */}
            {viewingParticipant.custom_data && Object.keys(viewingParticipant.custom_data).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Réponses au formulaire</h4>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                  {(formData.form_fields || []).map(field => {
                    const val = viewingParticipant.custom_data?.[field.id];
                    if (val === undefined || val === null || val === '') return null;
                    return (
                      <div key={field.id} className="flex gap-3">
                        <span className="text-xs font-semibold text-gray-500 w-36 flex-shrink-0 pt-0.5">{field.label}</span>
                        <span className="text-sm text-gray-800 font-medium">
                          {Array.isArray(val) ? val.join(', ') : String(val)}
                        </span>
                      </div>
                    );
                  })}
                  {/* Extra fields not in form_fields (e.g. phone) */}
                  {Object.entries(viewingParticipant.custom_data).filter(([key]) =>
                    !(formData.form_fields || []).find(f => f.id === key) && key !== 'phone'
                  ).map(([key, val]) => (
                    <div key={key} className="flex gap-3">
                      <span className="text-xs font-semibold text-gray-500 w-36 flex-shrink-0 pt-0.5">{key}</span>
                      <span className="text-sm text-gray-800 font-medium">
                        {Array.isArray(val) ? val.join(', ') : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CreateEventPage;
