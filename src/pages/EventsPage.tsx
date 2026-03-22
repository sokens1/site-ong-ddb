import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, MapPin, Users, ArrowRight, ChevronLeft } from 'lucide-react';

interface Event {
  id: number;
  title: string;
  description: string;
  event_date: string;
  location: string;
  image_url: string | null;
  max_slots: number | null;
  status: string;
}

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
      return { label: 'En cours', color: 'bg-blue-600 text-white' };
    } else if (eventDate.getTime() > now.getTime()) {
      return { label: 'Bientôt', color: 'bg-green-600 text-white' };
    } else {
      return { label: 'Terminé', color: 'bg-gray-500 text-white' };
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'published')
          .order('event_date', { ascending: false });
        
        if (error) {
          console.error('Error fetching events:', error);
        }
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
      result = result.filter(event => getEventStatus(event.event_date).label === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(q) || 
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q))
      );
    }
    return result;
  }, [events, filterStatus, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Header */}
      <div className="bg-green-900 border-b border-green-800 relative z-10 pt-24 pb-16 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
           <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[120%] rounded-full bg-white blur-[100px] transform rotate-45"></div>
           <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[100%] rounded-full bg-white blur-[100px]"></div>
        </div>

        <div className="container mx-auto px-4 relative z-20">
          <Link to="/" className="inline-flex items-center gap-2 text-green-300 hover:text-white mb-6 transition-colors text-sm font-medium">
            <ChevronLeft size={16} />
            Retour à l'accueil
          </Link>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight max-w-4xl drop-shadow-md">
            Nos Événements
          </h1>
          <p className="text-green-100 text-lg max-w-2xl">
            Participez à nos activités sur le terrain, rejoignez nos ateliers locaux, et contribuez à nos missions pour l'environnement.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-8 relative z-30">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 md:p-6 mb-12 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 flex-shrink-0">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search size={18} className="text-gray-400" />
               </div>
               <input 
                 type="text" 
                 placeholder="Rechercher un événement, un lieu..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
               />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide flex-nowrap">
               <div className="flex items-center gap-2 text-gray-500 mr-2 flex-shrink-0">
                 <Filter size={18} />
                 <span className="text-sm font-medium">Statut :</span>
               </div>
               {(['Tous', 'Bientôt', 'En cours', 'Terminé'] as const).map(cat => (
                 <button
                   key={cat}
                   onClick={() => setFilterStatus(cat)}
                   className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex-shrink-0 ${filterStatus === cat ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                 >
                   {cat}
                 </button>
               ))}
            </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Aucun événement trouvé</h3>
            <p className="text-gray-500">Essayez de modifier votre recherche ou vos filtres.</p>
            <button onClick={() => {setSearchQuery(''); setFilterStatus('Tous')}} className="mt-6 text-green-600 font-bold hover:underline">
               Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event, index) => {
              const status = getEventStatus(event.event_date);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.4) }}
                  viewport={{ once: true }}
                  className="relative bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group"
                >
                  <div className="relative h-48 overflow-hidden bg-gray-100">
                    {event.image_url ? (
                      <img src={event.image_url} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-700 to-green-500 flex items-center justify-center">
                        <Calendar size={48} className="text-white/50" />
                      </div>
                    )}
                    {/* Etiquette Date */}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm text-center border border-white/50">
                      <p className="text-xs uppercase tracking-wider font-bold text-green-600 leading-none mb-0.5">{new Date(event.event_date).toLocaleDateString('fr-FR', { month: 'short' })}</p>
                      <p className="text-xl font-black text-gray-900 leading-none">{new Date(event.event_date).getDate()}</p>
                    </div>
                    
                    {/* Badge Statut */}
                    <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm ${status.color}`}>
                      {status.label}
                    </div>
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col relative">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-xl mb-3 line-clamp-2 group-hover:text-green-700 transition-colors">
                        <Link to={`/events/${event.id}`} className="focus:outline-none before:absolute before:inset-0">
                          {event.title}
                        </Link>
                      </h3>
                      
                      {event.description && (
                        <div 
                          className="text-gray-500 text-sm mb-4 line-clamp-3 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: event.description.replace(/<[^>]+>/g, '') }}
                        />
                      )}

                      <div className="space-y-2 mb-4">
                        {event.location && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                            <MapPin size={16} className="text-green-600 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                        {event.max_slots && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                            <Users size={16} className="text-green-600 flex-shrink-0" />
                            <span>{event.max_slots} places limitées</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="pt-5 border-t border-gray-100 flex items-center justify-between text-sm font-bold text-green-700 z-10 pointer-events-none mt-auto">
                      <span className="group-hover:translate-x-1 transition-transform">Voir les détails</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
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
