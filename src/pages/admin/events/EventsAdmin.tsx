/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import DataTable from '../../../components/admin/DataTable';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';
import { Plus, Trash2, Users, MapPin, Edit3 } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';
import { useNavigate } from 'react-router-dom';

interface Event {
  id: number;
  title: string;
  description?: string;
  event_date: string;
  location?: string;
  image_url?: string;
  max_slots?: number | null;
  status: 'draft' | 'published' | 'cancelled';
  created_at?: string;
}

const EventsAdmin: React.FC = () => {
  const { canDelete } = useUserRole();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'success' }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error: e } = await supabase.from('events').select('*').order('event_date', { ascending: false });
      if (e) throw e;
      setEvents(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteEvent = async (id: number) => {
    const { error: e } = await supabase.from('events').delete().eq('id', id);
    if (e) alert(`Erreur: ${e.message}`);
    else fetchEvents();
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    published: { label: 'Publié', color: 'bg-green-100 text-green-800' },
    draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
    cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
  };

  const columns = useMemo(() => [
    {
      key: 'title', label: 'Événement',
      render: (v: string, row: Event) => (
        <div className="flex items-center gap-3">
          {row.image_url ? (
             <img src={row.image_url} alt={v} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          ) : (
             <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><span className="text-gray-400 text-xs">IMG</span></div>
          )}
          <div>
            <p className="font-medium text-gray-900 text-sm">{v}</p>
            {row.location && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={10} />{row.location}</p>}
          </div>
        </div>
      )
    },
    {
      key: 'event_date', label: 'Date',
      render: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
    },
    { key: 'max_slots', label: 'Places', hiddenOnMobile: true, render: (v: number | null) => v || '∞' },
    {
      key: 'status', label: 'Statut',
      render: (v: string) => { const s = statusLabels[v] || statusLabels['draft']; return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>; }
    },
    {
      key: 'actions', label: 'Actions',
      render: (_: any, row: Event) => (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate(`/admin/events/edit/${row.id}`)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Inscriptions & Modifier">
            <Users size={16} />
          </button>
          <button onClick={() => navigate(`/admin/events/edit/${row.id}`)} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Modifier">
            <Edit3 size={16} />
          </button>
          {canDelete('submissions') && (
            <button
              onClick={() => setConfirmModal({ isOpen: true, title: "Supprimer l'événement", message: `Supprimer "${row.title}" et toutes ses inscriptions ?`, type: 'danger', onConfirm: () => { deleteEvent(row.id); setConfirmModal({ ...confirmModal, isOpen: false}); } })}
              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Supprimer">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
  ], [canDelete, navigate, confirmModal]);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestion des Événements</h1>
        <button onClick={() => navigate('/admin/events/create')} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm text-sm font-semibold">
          <Plus size={18} /> Nouvel événement
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <DataTable columns={columns} data={events} title="Liste des événements" isLoading={loading} />

      <ConfirmationModal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
        onConfirm={confirmModal.onConfirm} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        type={confirmModal.type} 
      />
    </div>
  );
};

export default EventsAdmin;
