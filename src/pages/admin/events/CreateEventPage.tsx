import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import ImageUpload from '../../../components/admin/ImageUpload';
import RichTextEditor from '../../../components/admin/RichTextEditor';
import { ArrowLeft, Users, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../../supabaseClient';

import ConfirmationModal from '../../../components/admin/ConfirmationModal';

interface Event {
  id: number;
  title: string;
  description: string;
  event_date: string;
  location: string;
  image_url: string;
  max_slots: number | null;
  status: 'draft' | 'published' | 'cancelled';
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

const CreateEventPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { create, update, data: eventsData } = useCrud<Event>({ tableName: 'events' });
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState<'info' | 'participants'>('info');

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
  });

  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Modal states for deleting a registration
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
        setFormData({ ...eventItem, event_date: dateValue });
        fetchRegistrations(parseInt(id));
      }
    }
  }, [id, isEditing, eventsData]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm sticky top-0 z-10 w-full overflow-hidden border-b border-gray-200 p-4 shrink-0 h-16 flex items-center justify-between">
        <button onClick={handleBack} className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors">
          <ArrowLeft size={18} />
          Retour
        </button>
        <div className="text-gray-800 font-bold hidden sm:block">
           {isEditing ? "Modifier l'Événement" : "Créer un Événement"}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Tab Navigation (only in Edit mode) */}
          {isEditing && (
            <div className="flex border-b border-gray-200 mb-6 font-medium text-sm">
              <button 
                onClick={() => setActiveTab('info')}
                className={`py-3 px-6 uppercase tracking-wider ${activeTab === 'info' ? 'border-b-2 border-green-600 text-green-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Informations
              </button>
              <button 
                onClick={() => setActiveTab('participants')}
                className={`py-3 px-6 uppercase tracking-wider flex items-center gap-2 ${activeTab === 'participants' ? 'border-b-2 border-green-600 text-green-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Participants Inscrits
                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold">{registrations.length}</span>
              </button>
            </div>
          )}

          {activeTab === 'info' ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Image de couverture *</label>
                  <p className="text-xs text-gray-400 mb-3">Une image est obligatoire pour illustrer l'événement sur la page publique.</p>
                  <ImageUpload
                    value={formData.image_url || ''}
                    onChange={(url) => setFormData({ ...formData, image_url: url })}
                    bucket="ong-backend"
                    folder="events/images"
                    label="Image de l'événement"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Titre de l'événement *</label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      placeholder="Ex: Conférence sur la Biodiversité"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date & Heure *</label>
                    <input
                        type="datetime-local"
                        required
                        value={formData.event_date || getCurrentDateTime()}
                        onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Lieu</label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Adresse ou plateforme en ligne"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Places disponibles (vide = illimité)</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_slots === null ? '' : formData.max_slots}
                      onChange={(e) => setFormData({ ...formData, max_slots: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Ex: 100"
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
                  <p className="text-xs text-gray-400 mb-3">Utilisez l'éditeur pour mettre en forme le contenu (gras, listes, etc.).</p>
                  <RichTextEditor
                    value={formData.description || ''}
                    onChange={(html) => setFormData({ ...formData, description: html })}
                    placeholder="Description détaillée de l'événement..."
                    rows={10}
                  />
                </div>

                <div className="pt-6 border-t border-gray-100 flex justify-end gap-4">
                  <button type="button" onClick={handleBack} className="px-6 py-3 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">
                    Annuler
                  </button>
                  <button type="submit" disabled={loading} className="px-8 py-3 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
                    {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : null}
                    {isEditing ? 'Enregistrer les modifications' : 'Créer l\'événement'}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
               <div className="flex items-center justify-between mb-6">
                 <div>
                    <h2 className="text-xl font-bold text-gray-800">Liste des participants inscrits</h2>
                    <p className="text-gray-500 text-sm mt-1">{registrations.length} personnes attendues</p>
                 </div>
                 <button onClick={() => fetchRegistrations(parseInt(id!))} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200">
                    Rafraîchir
                 </button>
               </div>

               {registrationsLoading ? (
                 <div className="text-center py-12"><span className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin inline-block"></span></div>
               ) : registrations.length === 0 ? (
                 <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Users size={40} className="mx-auto mb-3 text-gray-300" />
                    <p className="font-semibold text-gray-700">Aucune inscription pour le moment.</p>
                    <p className="text-sm text-gray-400 mt-1">Les personnes inscrites via le site public apparaîtront ici.</p>
                 </div>
               ) : (
                 <div className="space-y-3">
                   {registrations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(reg => (
                     <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-green-100 hover:shadow-sm transition-all group">
                        <div className="mb-3 sm:mb-0">
                          <p className="font-bold text-gray-900 flex items-center gap-2">
                             {reg.fullname} 
                             {reg.created_at && <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">{new Date(reg.created_at).toLocaleDateString('fr-FR')}</span>}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span><i className="fas fa-envelope mr-1.5 text-gray-400"></i>{reg.email}</span>
                            {reg.phone && <span><i className="fas fa-phone mr-1.5 text-gray-400"></i>{reg.phone}</span>}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteRegistration(reg.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors place-self-end sm:place-self-auto" title="Supprimer l'inscription">
                          <Trash2 size={18} />
                        </button>
                     </div>
                   ))}

                   {/* Pagination Controls */}
                   {Math.ceil(registrations.length / itemsPerPage) > 1 && (
                     <div className="flex justify-between items-center pt-6 mt-4 border-t border-gray-100">
                       <button 
                         onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                         disabled={currentPage === 1}
                         className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                       >
                         Précédent
                       </button>
                       <span className="text-sm text-gray-500 font-medium">
                         Page {currentPage} sur {Math.ceil(registrations.length / itemsPerPage)}
                       </span>
                       <button 
                         onClick={() => setCurrentPage(p => Math.min(Math.ceil(registrations.length / itemsPerPage), p + 1))} 
                         disabled={currentPage === Math.ceil(registrations.length / itemsPerPage)}
                         className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                       >
                         Suivant
                       </button>
                     </div>
                   )}
                 </div>
               )}
            </motion.div>
          )}
        </div>
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
