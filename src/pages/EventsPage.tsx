import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import EditableText from '../components/site-content/EditableText';

interface Event {
  id: number;
  slug?: string;
  title: string;
  description: string;
  event_date: string;
  location: string;
  image_url: string | null;
  max_slots: number | null;
  status: string;
}

// Petites pastilles de couleur décoratives sur les cartes, on tourne dessus
const BLOB_COLORS = ['bg-ddb-400', 'bg-amber-400', 'bg-ddb-600', 'bg-sky-400'];

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Tous' | 'Bientôt' | 'En cours' | 'Terminé'>('Tous');

  const getEventStatus = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (eventDay === today) {
      return { label: 'En cours', color: 'bg-emerald-600' };
    } else if (eventDate.getTime() > now.getTime()) {
      return { label: 'Bientôt', color: 'bg-ddb-600' };
    } else {
      return { label: 'Terminé', color: 'bg-gray-500' };
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, slug, title, event_date, location, image_url, description, max_slots, status')
          .eq('status', 'published')
          .order('event_date', { ascending: false });

        if (error) console.error('Error fetching events:', error);
        if (!error && data) setEvents(data);
      } catch (err) {
        console.error('Unexpected error fetching events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    let result = events;
    if (filterStatus !== 'Tous') {
      result = result.filter((event) => getEventStatus(event.event_date).label === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.location && item.location.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [events, filterStatus, searchQuery]);

  return (
    // -mt-24 : annule le spacer laissé par la navbar flottante (Header.tsx) sur
    // les pages non-accueil ; fond vert faible pour cette page (au lieu du blanc
    // utilisé par Actualités/Rapports, pour distinguer le "hero" des événements).
    <div className="min-h-screen -mt-24 bg-ddb-50 pb-24 pt-32 sm:pt-36">
      <div className="container mx-auto max-w-6xl px-4">
        {/* ── En-tête ── */}
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <EditableText
              as="h1"
              k="events_page.title"
              fallback="Nos Événements"
              multiline={false}
              className="font-heading text-4xl font-extrabold tracking-tight text-ddb-950 sm:text-5xl lg:text-6xl"
            />
            <EditableText
              as="p"
              k="events_page.subtitle"
              fallback="Participez à nos activités sur le terrain, rejoignez nos ateliers locaux, et contribuez à nos missions pour l'environnement."
              className="mt-4 max-w-xl text-lg text-ddb-950/60"
            />
          </motion.div>

          {/* Illustration décorative — petit collage photo animé */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative mx-auto hidden h-44 w-44 shrink-0 sm:block lg:h-52 lg:w-52"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-0 top-2 h-28 w-24 -rotate-6 overflow-hidden rounded-2xl shadow-xl ring-1 ring-ddb-950/5"
            >
              <img src="/images/image-action-1.jpg" alt="" className="h-full w-full object-cover" />
            </motion.div>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
              className="absolute bottom-2 right-0 h-32 w-28 rotate-6 overflow-hidden rounded-2xl shadow-xl ring-1 ring-ddb-950/5"
            >
              <img src="/images/image-presentation-3.jpg" alt="" className="h-full w-full object-cover" />
            </motion.div>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1.3 }}
              className="absolute -bottom-2 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-ddb-600 text-white shadow-lg"
            >
              <Calendar className="h-5 w-5" />
            </motion.div>
          </motion.div>
        </div>

        {/* ── Filtres ── */}
        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['Tous', 'Bientôt', 'En cours', 'Terminé'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterStatus(cat)}
                className={`inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                  filterStatus === cat
                    ? 'border-ddb-600 text-ddb-700'
                    : 'border-ddb-950/10 text-ddb-950/50 hover:border-ddb-950/20'
                }`}
              >
                {cat === 'Tous' ? 'Tout' : cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ddb-950/40" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border-2 border-ddb-950/10 bg-white py-2 pl-10 pr-4 text-sm outline-none transition-colors focus:border-ddb-600"
            />
          </div>
        </div>

        {/* ── Grille ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ddb-600 border-t-transparent" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-ddb-950/10 bg-white py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ddb-50">
              <Search className="h-6 w-6 text-ddb-950/30" />
            </div>
            <h3 className="font-heading text-lg font-bold text-ddb-950">Aucun événement trouvé</h3>
            <p className="mt-1 text-sm text-ddb-950/50">
              Essayez un autre mot-clé ou un autre filtre.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('Tous');
              }}
              className="mt-5 font-heading text-sm font-bold text-ddb-700 hover:text-ddb-900"
            >
              Réinitialiser
            </button>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-3">
            {filteredEvents.map((event, index) => {
              const status = getEventStatus(event.event_date);
              const blob = BLOB_COLORS[index % BLOB_COLORS.length];
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
                  className="group"
                >
                  <Link to={`/events/${event.slug || event.id}`} className="block">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                      <span aria-hidden className={`absolute -bottom-3 -left-3 z-0 h-16 w-16 rounded-full ${blob}`} />
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          loading="lazy"
                          className="absolute inset-0 z-10 h-full w-full rounded-2xl object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-ddb-950">
                          <Calendar size={40} className="text-white/40" />
                        </div>
                      )}
                      <span className={`absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-ddb-950/40">
                      <span>
                        {new Date(event.event_date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <h3 className="mt-2 font-heading text-lg font-bold leading-snug text-ddb-950 line-clamp-2 group-hover:text-ddb-700">
                      {event.title}
                    </h3>

                    <div className="mt-2 space-y-1">
                      {event.location && (
                        <p className="flex items-center gap-1.5 text-sm text-ddb-950/60">
                          <MapPin size={14} className="shrink-0 text-ddb-600" />
                          <span className="truncate">{event.location}</span>
                        </p>
                      )}
                      {event.max_slots && (
                        <p className="flex items-center gap-1.5 text-sm text-ddb-950/60">
                          <Users size={14} className="shrink-0 text-ddb-600" />
                          {event.max_slots} places limitées
                        </p>
                      )}
                    </div>

                    <span className="mt-3 inline-flex items-center gap-1.5 font-heading text-sm font-bold text-ddb-700">
                      Voir les détails
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsPage;
