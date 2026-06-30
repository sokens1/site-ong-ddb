/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';
import { Plus, Trash2, Users, MapPin, Edit3, MoreVertical, Eye, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Event {
  id: number;
  title: string;
  description?: string;
  event_date: string;
  location?: string;
  image_url?: string;
  logo_url?: string;
  max_slots?: number | null;
  status: 'draft' | 'published' | 'cancelled';
  created_at?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  published: { label: 'Publié', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle },
  draft: { label: 'Brouillon', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: Clock },
  cancelled: { label: 'Annulé', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle },
};

const EventCard: React.FC<{
  event: Event;
  onEdit: (id: number) => void;
  onDelete: (event: Event) => void;
}> = ({ event, onEdit, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const status = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft;
  const StatusIcon = status.icon;

  const eventDate = event.event_date ? new Date(event.event_date) : null;
  const isUpcoming = eventDate && eventDate > new Date();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
    >
      {/* Image */}
      <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Calendar size={32} className="text-gray-300" />
            <span className="text-xs text-gray-400">Pas d'image</span>
          </div>
        )}
        {/* Status badge */}
        <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${status.bg} ${status.color}`}>
          <StatusIcon size={12} />
          {status.label}
        </div>
        {/* Logo */}
        {event.logo_url && (
          <div className="absolute bottom-3 right-3 w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md bg-white">
            <img src={event.logo_url} alt="logo" className="w-full h-full object-contain p-0.5" />
          </div>
        )}
        {/* Upcoming badge */}
        {isUpcoming && (
          <div className="absolute top-3 right-3 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            À venir
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{event.title}</h3>

        <div className="flex flex-col gap-1 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-green-500 flex-shrink-0" />
            <span>
              {eventDate ? eventDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-1.5">
              <MapPin size={12} className="text-green-500 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users size={12} className="text-green-500 flex-shrink-0" />
            <span>{event.max_slots ? `${event.max_slots} places max` : 'Entrée libre'}</span>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => onEdit(event.id)}
          className="flex items-center gap-1.5 text-xs text-green-700 font-semibold hover:text-green-800 transition-colors"
        >
          <Edit3 size={13} /> Modifier
        </button>

        {/* 3-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <button
                  onClick={() => { onEdit(event.id); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit3 size={15} className="text-blue-500" /> Modifier l'événement
                </button>
                <button
                  onClick={() => { onEdit(event.id); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Users size={15} className="text-green-500" /> Voir les participants
                </button>
                <a
                  href={`/events/${event.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Eye size={15} className="text-purple-500" /> Voir la page publique
                </a>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => { onDelete(event); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={15} /> Supprimer
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

const EventsAdmin: React.FC = () => {
  const { canDelete } = useUserRole();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'success';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Try with logo_url first (requires migration)
      const { data, error: e } = await supabase
        .from('events')
        .select('id, title, event_date, location, image_url, logo_url, max_slots, status, created_at')
        .order('event_date', { ascending: false });

      if (e && e.message?.includes('logo_url')) {
        // Fallback: migration not yet applied — fetch without logo_url
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('events')
          .select('id, title, event_date, location, image_url, max_slots, status, created_at')
          .order('event_date', { ascending: false });
        if (fallbackError) throw fallbackError;
        setEvents(fallbackData || []);
      } else {
        if (e) throw e;
        setEvents(data || []);
      }
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

  const handleDelete = (event: Event) => {
    if (!canDelete('submissions')) return;
    setConfirmModal({
      isOpen: true,
      title: "Supprimer l'événement",
      message: `Supprimer "${event.title}" et toutes ses inscriptions ?`,
      type: 'danger',
      onConfirm: () => {
        deleteEvent(event.id);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const filtered = events.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Événements</h1>
          <p className="text-sm text-gray-500 mt-0.5">{events.length} événement{events.length > 1 ? 's' : ''} au total</p>
        </div>
        <button
          onClick={() => navigate('/admin/events/create')}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl hover:bg-green-700 transition shadow-sm text-sm font-semibold"
        >
          <Plus size={18} /> Nouvel événement
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par titre ou lieu..."
          className="w-full max-w-xs px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none shadow-sm"
        />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="h-44 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Calendar size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-500 font-medium">
            {search ? 'Aucun événement ne correspond à votre recherche.' : 'Aucun événement créé.'}
          </p>
          {!search && (
            <button
              onClick={() => navigate('/admin/events/create')}
              className="mt-4 inline-flex items-center gap-2 text-green-600 font-semibold text-sm hover:underline"
            >
              <Plus size={16} /> Créer le premier événement
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={(id) => navigate(`/admin/events/edit/${id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
};

export default EventsAdmin;
