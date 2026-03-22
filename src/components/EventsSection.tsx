/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

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

const EventsSection: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .order('event_date', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error fetching events:', error);
      }
      if (!error && data) setEvents(data);
    } catch (err) {
      console.error('Unexpected error fetching events:', err);
    }
    setLoading(false);
  };

  const getEventStatus = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    
    // Normalize dates to mid-night for "same day" check
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
    fetchEvents();
  }, []);

  return (
    <section className="py-16 bg-gray-50" id="evenements">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Nos Événements</h2>
          <div className="w-24 h-1 bg-green-600 mx-auto mb-4"></div>
          <p className="text-gray-500 max-w-2xl mx-auto text-sm">Découvrez nos prochains événements et rejoignez-nous pour agir ensemble.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={36} className="text-green-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-500 mb-2">Aucun événement à venir</h3>
            <p className="text-sm text-gray-400">Revenez bientôt pour découvrir nos prochains événements.</p>
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 scrollbar-hide pt-4 px-4 -mx-4">
            {events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="relative bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group flex-shrink-0 snap-start w-80 md:w-96"
              >
                <div className="relative h-48 overflow-hidden bg-gray-100">
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-green-700 to-green-500 flex items-center justify-center">
                      <Calendar size={48} className="text-white/50" />
                    </div>
                  )}
                  {/* Etiquette Date (sur l'image) */}
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm text-center border border-white/50">
                    <p className="text-xs uppercase tracking-wider font-bold text-green-600 leading-none mb-0.5">{new Date(event.event_date).toLocaleDateString('fr-FR', { month: 'short' })}</p>
                    <p className="text-xl font-black text-gray-900 leading-none">{new Date(event.event_date).getDate()}</p>
                  </div>
                  
                  {/* Badge Statut */}
                  <div className={`absolute top-4 right-4 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm ${getEventStatus(event.event_date).color}`}>
                    {getEventStatus(event.event_date).label}
                  </div>
                </div>
                
                <div className="p-6 flex-1 flex flex-col relative">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg mb-3 line-clamp-2 group-hover:text-green-700 transition-colors">
                      <Link to={`/events/${event.id}`} className="focus:outline-none before:absolute before:inset-0">
                        {event.title}
                      </Link>
                    </h3>
                    
                    {event.description && (
                      <div 
                        className="text-gray-500 text-sm mb-4 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: event.description.replace(/<[^>]+>/g, '') }}
                      />
                    )}

                    <div className="space-y-2 mb-4">
                      {event.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <MapPin size={14} className="text-green-600 flex-shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      {event.max_slots && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Users size={14} className="text-green-600 flex-shrink-0" />
                          <span>{event.max_slots} places limitées</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-sm font-bold text-green-700 z-10 pointer-events-none">
                    <span className="group-hover:translate-x-1 transition-transform">En savoir plus</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            ))}

            {/* View More Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: events.length * 0.1 }}
              viewport={{ once: true }}
              className="flex-shrink-0 snap-start w-80 md:w-96 flex items-center justify-center p-4"
            >
              <div 
                onClick={() => navigate('/events')}
                className="bg-green-50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 w-full h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-green-200 hover:border-green-400 group cursor-pointer"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm text-green-600">
                  <ArrowRight size={28} />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Nos événements</h3>
                <p className="text-green-600/80 text-sm">Découvrez l'ensemble de nos actions de terrain passées et à venir.</p>
              </div>
            </motion.div>

          </div>
        )}
      </div>
    </section>
  );
};

export default EventsSection;
