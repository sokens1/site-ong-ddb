import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import ImageUpload from '../../../components/admin/ImageUpload';
import RichTextEditor from '../../../components/admin/RichTextEditor';
import { ArrowLeft, Users, Trash2, Plus, Star, X as XIcon, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../supabaseClient';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';

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
  status: 'draft' | 'published' | 'cancelled';
  form_fields?: FormField[];
  feedback_config?: FeedbackConfig;
  created_at?: string;
}

interface Registration {
  id: number;
  event_id: number;
  fullname: string;
  email: string;
  phone?: string;
  created_at?: string;
}

interface EventFeedback {
  id: number;
  participant_name: string;
  rating: number;
  comment: string;
  custom_answers?: Record<string, any>;
  created_at: string;
}

// ─── Reusable Field Builder Component ───────────────────────────────────────

interface FieldBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  addLabel?: string;
}

const FieldBuilder: React.FC<FieldBuilderProps> = ({ fields, onChange, addLabel = '+ Ajouter un champ' }) => {
  const updateField = (index: number, patch: Partial<FormField>) => {
    const next = fields.map((f, i) => i === index ? { ...f, ...patch } : f);
    onChange(next);
  };

  const addOption = (index: number) => {
    const opts = [...(fields[index].options || []), ''];
    updateField(index, { options: opts });
  };

  const updateOption = (fieldIdx: number, optIdx: number, value: string) => {
    const opts = [...(fields[fieldIdx].options || [])];
    opts[optIdx] = value;
    updateField(fieldIdx, { options: opts });
  };

  const removeOption = (fieldIdx: number, optIdx: number) => {
    const opts = (fields[fieldIdx].options || []).filter((_, i) => i !== optIdx);
    updateField(fieldIdx, { options: opts });
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const addField = () => {
    onChange([...fields, { id: Date.now().toString(), label: '', type: 'text', required: false }]);
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
            {/* Field Header */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-100">
              <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Champ {index + 1}</span>
              <button
                type="button"
                onClick={() => removeField(index)}
                className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Field Config */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Libellé de la question</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={e => updateField(index, { label: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Ex: Quelle est votre profession ?"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type de champ</label>
                  <select
                    value={field.type}
                    onChange={e => updateField(index, { type: e.target.value as FormField['type'], options: hasOptions(e.target.value) ? (field.options ?? []) : undefined })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="text">Texte court</option>
                    <option value="textarea">Texte long</option>
                    <option value="select">Liste déroulante</option>
                    <option value="radio">Choix unique</option>
                    <option value="checkbox">Choix multiple</option>
                  </select>
                </div>
              </div>

              {/* Options Builder */}
              {hasOptions(field.type) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Options de réponse</label>
                  <div className="space-y-2">
                    {(field.options || []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-gray-400">{optIdx + 1}</span>
                        </div>
                        <input
                          type="text"
                          value={opt}
                          onChange={e => updateOption(index, optIdx, e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                          placeholder={`Option ${optIdx + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(index, optIdx)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(index)}
                      className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-semibold py-1 px-2 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      <Plus size={14} />
                      Ajouter une option
                    </button>
                  </div>
                </div>
              )}

              {/* Required toggle */}
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <div
                  onClick={() => updateField(index, { required: !field.required })}
                  className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${field.required ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${field.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-700">Réponse obligatoire</span>
              </label>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <button
        type="button"
        onClick={addField}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-semibold hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all flex items-center justify-center gap-2"
      >
        <Plus size={16} />
        {addLabel}
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

  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState<Partial<Event>>({
    title: '',
    description: '',
    event_date: getCurrentDateTime(),
    location: '',
    image_url: '',
    max_slots: null,
    status: 'published',
    form_fields: [],
    feedback_config: { show_stars: true, fields: [] },
  });

  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState<EventFeedback[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger'|'info'|'success'}>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });

  useEffect(() => {
    if (isEditing && id && eventsData) {
      const eventItem = eventsData.find((item) => item.id === parseInt(id));
      if (eventItem) {
        let dateValue = getCurrentDateTime();
        if (eventItem.event_date) {
          try {
            const dateObj = new Date(eventItem.event_date);
            if (!isNaN(dateObj.getTime())) {
              const year = dateObj.getFullYear();
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const day = String(dateObj.getDate()).padStart(2, '0');
              const hours = String(dateObj.getHours()).padStart(2, '0');
              const minutes = String(dateObj.getMinutes()).padStart(2, '0');
              dateValue = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
          } catch (e) {}
        }
        const fc = eventItem.feedback_config ?? { show_stars: true, fields: [] };
        setFormData({ ...eventItem, event_date: dateValue, feedback_config: fc });
        fetchRegistrations(parseInt(id));
        fetchFeedbacks(parseInt(id));
      }
    }
  }, [id, isEditing, eventsData]);

  const fetchFeedbacks = async (eventId: number) => {
    setFeedbacksLoading(true);
    const { data, error } = await supabase
      .from('event_feedbacks')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (!error && data) setFeedbacks(data);
    setFeedbacksLoading(false);
  };

  const fetchRegistrations = async (eventId: number) => {
    setRegistrationsLoading(true);
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setRegistrations(data);
      setCurrentPage(1);
    }
    setRegistrationsLoading(false);
  };

  const handleBack = () => navigate('/admin/events');

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.title || !formData.event_date) {
      alert("Le titre et la date sont obligatoires.");
      return;
    }
    try {
      setLoading(true);
      const dataToSubmit: any = {
        title: formData.title,
        description: formData.description || '',
        event_date: formData.event_date,
        location: formData.location || '',
        image_url: formData.image_url || '',
        max_slots: formData.max_slots ? parseInt(String(formData.max_slots)) : null,
        status: formData.status || 'draft',
        form_fields: formData.form_fields || [],
        feedback_config: formData.feedback_config ?? { show_stars: true, fields: [] },
      };
      if (isEditing && id) {
        await update(parseInt(id), dataToSubmit);
      } else {
        await create(dataToSubmit);
      }
      navigate('/admin/events');
    } catch (err) {
      alert("Erreur lors de l'enregistrement de l'événement.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRegistration = (regId: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Supprimer l'inscription",
      message: "Êtes-vous sûr de vouloir supprimer cette inscription définitivement ?",
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('event_registrations').delete().eq('id', regId);
          if (error) throw error;
          setRegistrations(prev => prev.filter(r => r.id !== regId));
        } catch (err: any) {
          alert(`Erreur: ${err.message}`);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const tabs = [
    { key: 'info', label: 'Informations' },
    { key: 'form', label: 'Formulaire' },
    { key: 'feedback_config', label: 'Config. Avis' },
    { key: 'participants', label: 'Participants', badge: registrations.length > 0 ? registrations.length : null },
    { key: 'feedbacks', label: 'Avis reçus', badge: feedbacks.length > 0 ? feedbacks.length : null },
  ] as const;

  const fc = formData.feedback_config ?? { show_stars: true, fields: [] };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white shadow-sm sticky top-0 z-10 w-full border-b border-gray-200 px-4 sm:px-8 h-14 flex items-center justify-between flex-shrink-0">
        <button onClick={handleBack} className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors">
          <ArrowLeft size={18} />
          Retour
        </button>
        <div className="text-gray-800 font-bold hidden sm:block">
          {isEditing ? "Modifier l'Événement" : "Créer un Événement"}
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-5 py-2 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
          Enregistrer
        </button>
      </div>

      {/* Tab Navigation — full width, no container */}
      {isEditing && (
        <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-[100px] py-3 px-4 text-xs sm:text-sm font-semibold uppercase tracking-wider whitespace-nowrap flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-green-600 text-green-700 bg-green-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                {'badge' in tab && tab.badge !== null && (
                  <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 sm:px-8 py-6 max-w-5xl mx-auto w-full">
        {/* ── Info Tab ── */}
        {activeTab === 'info' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Image de couverture *</label>
                <p className="text-xs text-gray-400 mb-3">Une image est obligatoire pour illustrer l'événement sur la page publique.</p>
                <ImageUpload
                  value={formData.image_url || ''}
                  onChange={(url) => setFormData({ ...formData, image_url: url })}
                  bucket="ong-backend"
                  folder="events"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Titre de l'événement *</label>
                  <input
                    type="text" required value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    placeholder="Ex: Conférence annuelle DDB 2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date et heure *</label>
                  <input
                    type="datetime-local" required value={formData.event_date || ''}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Lieu</label>
                  <input
                    type="text" value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    placeholder="Ex: Salle des fêtes, Lomé"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de places</label>
                  <input
                    type="number" min="1" value={formData.max_slots === null ? '' : formData.max_slots}
                    onChange={(e) => setFormData({ ...formData, max_slots: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Laisser vide = illimité"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Statut</label>
                  <select
                    value={formData.status || 'published'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Event['status'] })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  >
                    <option value="published">Publié (Visible)</option>
                    <option value="draft">Brouillon (Caché)</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
                <RichTextEditor
                  value={formData.description || ''}
                  onChange={(html) => setFormData({ ...formData, description: html })}
                  placeholder="Description détaillée de l'événement..."
                  rows={10}
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={handleBack} className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={loading} className="px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm">
                  {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  {isEditing ? 'Enregistrer les modifications' : "Créer l'événement"}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* ── Form Tab ── */}
        {activeTab === 'form' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800">Champs du formulaire d'inscription</h2>
              <p className="text-gray-500 text-sm mt-1">
                Ajoutez des questions supplémentaires (Nom, Email et Téléphone sont toujours inclus par défaut).
              </p>
            </div>

            <FieldBuilder
              fields={formData.form_fields || []}
              onChange={(fields) => setFormData({ ...formData, form_fields: fields })}
              addLabel="+ Ajouter une question"
            />

            <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={handleBack} className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all text-sm">
                Annuler
              </button>
              <button type="button" onClick={handleSave} disabled={loading} className="px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm">
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                Enregistrer
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Feedback Config Tab ── */}
        {activeTab === 'feedback_config' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800">Configuration du formulaire d'avis</h2>
              <p className="text-gray-500 text-sm mt-1">
                Ce formulaire apparaît aux visiteurs lorsque l'événement est terminé. Configurez les questions souhaitées.
              </p>
            </div>

            {/* Stars toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Star size={18} className="text-yellow-500" fill="currentColor" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Notation par étoiles</p>
                  <p className="text-xs text-gray-500">Afficher un sélecteur de 1 à 5 étoiles dans le formulaire d'avis</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, feedback_config: { ...fc, show_stars: !fc.show_stars } })}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${fc.show_stars ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${fc.show_stars ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Custom questions */}
            <div className="mb-2">
              <h3 className="text-sm font-bold text-gray-700 mb-1">Questions personnalisées</h3>
              <p className="text-xs text-gray-400 mb-4">Ajoutez des questions ouvertes ou à choix pour recueillir des retours spécifiques.</p>
            </div>

            <FieldBuilder
              fields={fc.fields}
              onChange={(fields) => setFormData({ ...formData, feedback_config: { ...fc, fields } })}
              addLabel="+ Ajouter une question d'avis"
            />

            <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={handleBack} className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all text-sm">
                Annuler
              </button>
              <button type="button" onClick={handleSave} disabled={loading} className="px-7 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm">
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                Enregistrer
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Participants Tab ── */}
        {activeTab === 'participants' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Participants inscrits</h2>
                <p className="text-gray-500 text-sm mt-1">{registrations.length} personnes attendues</p>
              </div>
              <button onClick={() => fetchRegistrations(parseInt(id!))} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200">
                Rafraîchir
              </button>
            </div>

            {registrationsLoading ? (
              <div className="text-center py-12"><span className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin inline-block" /></div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Users size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">Aucune inscription pour le moment.</p>
                <p className="text-sm text-gray-400 mt-1">Les personnes inscrites via le site public apparaîtront ici.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {registrations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(reg => (
                  <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-green-100 hover:shadow-sm transition-all">
                    <div className="mb-3 sm:mb-0">
                      <p className="font-bold text-gray-900 flex items-center gap-2">
                        {reg.fullname}
                        {reg.created_at && <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">{new Date(reg.created_at).toLocaleDateString('fr-FR')}</span>}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 mt-1 text-sm text-gray-600">
                        <span>{reg.email}</span>
                        {reg.phone && <span>{reg.phone}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteRegistration(reg.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors place-self-end sm:place-self-auto" title="Supprimer l'inscription">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}

                {Math.ceil(registrations.length / itemsPerPage) > 1 && (
                  <div className="flex justify-between items-center pt-6 mt-4 border-t border-gray-100">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Précédent
                    </button>
                    <span className="text-sm text-gray-500 font-medium">Page {currentPage} sur {Math.ceil(registrations.length / itemsPerPage)}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(registrations.length / itemsPerPage), p + 1))} disabled={currentPage === Math.ceil(registrations.length / itemsPerPage)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Suivant
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Feedbacks Tab ── */}
        {activeTab === 'feedbacks' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
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
                          <p key={key} className="text-xs text-gray-500"><span className="font-semibold text-gray-700">{key}:</span> {Array.isArray(val) ? val.join(', ') : String(val)}</p>
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

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({...prev, isOpen: false}))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
};

export default CreateEventPage;
