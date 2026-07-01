/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { Calendar, MapPin, Users, ArrowRight, Tag, Share2, Copy, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface Event {
  id: number;
  title: string;
  description: string;
  event_date: string;
  location: string;
  image_url: string | null;
  max_slots: number | null;
  price?: number | null;
  status: string;
  slug?: string;
}

const EventsSection: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const eventsScrollRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const container = eventsScrollRef.current;
    if (!container) return;
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollLeft = container.scrollLeft;
        const cardWidth = container.children[0]?.clientWidth || 0;
        const gap = 24;
        setActiveIndex(Math.round(scrollLeft / (cardWidth + gap)));
      }, 100);
    };
    container.addEventListener('scroll', handleScroll);
    return () => { container.removeEventListener('scroll', handleScroll); clearTimeout(scrollTimeout); };
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setFetchError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, event_date, location, image_url, description, max_slots, status, slug')
        .eq('status', 'published')
        .order('event_date', { ascending: false })
        .limit(5)
        .abortSignal(controller.signal);

      if (error) {
        console.error('Error fetching events:', error);
        setFetchError(true);
      }
      if (!error && data) setEvents(data);
    } catch (err: any) {
      console.error('Unexpected error fetching events:', err);
      setFetchError(true);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const getEventStatus = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    
    // Normalize dates to mid-night for "same day" check
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (eventDay === today) {
      return { label: 'En cours', color: 'bg-emerald-600 text-white' };
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
        ) : fetchError ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={36} className="text-red-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-500 mb-2">Impossible de charger les événements</h3>
            <p className="text-sm text-gray-400 mb-4">Vérifiez votre connexion et réessayez.</p>
            <button onClick={fetchEvents} className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">Réessayer</button>
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
          <div ref={eventsScrollRef} className="flex overflow-x-auto snap-x gap-6 pb-8 scrollbar-hide pt-4 px-4 -mx-4" style={{ scrollBehavior: 'smooth' }}>
            {events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="relative bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group flex-shrink-0 snap-start w-[85vw] md:w-96"
              >
                <div className="relative h-48 overflow-hidden bg-gray-50 flex items-center justify-center border-b border-gray-100">
                  {event.image_url ? (
                    <img 
                      src={event.image_url} 
                      alt={event.title} 
                      loading="lazy"
                      className="relative z-10 max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105" 
                    />
                  ) : (
                    <div className="relative z-10 w-full h-full bg-gradient-to-br from-green-700 to-green-500 flex items-center justify-center">
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
                      <Link to={`/events/${event.slug || event.id}`} className="focus:outline-none before:absolute before:inset-0">
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
                      {event.price !== undefined && event.price !== null && (
                        <div className="flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 w-fit px-2 py-0.5 rounded-lg">
                          <Tag size={12} />
                          <span>{event.price > 0 ? `${new Intl.NumberFormat('fr-FR').format(event.price)} FCFA` : 'Gratuit'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-green-700 group-hover:translate-x-1 transition-transform z-10 pointer-events-none flex items-center gap-1">
                      En savoir plus <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                    <button
                      className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-green-700 text-xs font-semibold transition-all"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const url = `${window.location.origin}/events/${event.slug || event.id}`;
                        if (navigator.share) {
                          navigator.share({ title: event.title, url }).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(url);
                          setCopiedId(event.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }
                      }}
                      title="Partager"
                    >
                      {copiedId === event.id ? <Check size={13} className="text-green-600" /> : <Share2 size={13} />}
                      {copiedId === event.id ? 'Copié !' : 'Partager'}
                    </button>
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
              className="flex-shrink-0 snap-start w-[85vw] md:w-96 flex items-center justify-center p-4"
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

        {isMobile && events.length > 0 && (
          <div className="flex justify-center gap-2 mt-4 mb-4">
            {[...events, { id: 'more' }].map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  const container = eventsScrollRef.current;
                  if (container?.children[index]) {
                    const card = container.children[index] as HTMLElement;
                    container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
                  }
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${activeIndex === index ? 'bg-green-600 w-5' : 'bg-green-200'}`}
                aria-label={`Aller à l'élément ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default EventsSection;
