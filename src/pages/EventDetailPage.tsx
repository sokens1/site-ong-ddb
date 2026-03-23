import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, X, CheckCircle, ChevronLeft } from 'lucide-react';

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

const EventRegistrationModal: React.FC<{ event: Event; onClose: () => void }> = ({ event, onClose }) => {
  const [formData, setFormData] = useState({ fullname: '', email: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from('event_registrations').insert([{
      event_id: event.id,
      fullname: formData.fullname,
      email: formData.email,
      phone: formData.phone || null,
    }]);

    if (insertError) {
      setError("Une erreur est survenue lors de l'inscription. Veuillez réessayer.");
    } else {
      try {
        await supabase.functions.invoke('send-event-confirmation', {
          body: {
            email: formData.email,
            fullname: formData.fullname,
            eventTitle: event.title,
            eventDate: event.event_date,
            eventLocation: event.location,
          }
        });
      } catch { /* silent fail */ }
      setSuccess(true);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-green-800 text-white p-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X size={20} />
          </button>
          <h3 className="text-xl font-bold mb-1">S'inscrire à l'événement</h3>
          <p className="text-green-200 text-sm line-clamp-1">{event.title}</p>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Inscription confirmée !</h4>
              <p className="text-gray-500 mb-6">Vous êtes bien inscrit à <strong>{event.title}</strong>. Merci pour votre engagement.</p>
              <button onClick={onClose} className="bg-green-700 text-white font-bold py-2 px-8 rounded-xl hover:bg-green-800 transition-colors w-full sm:w-auto">
                Fermer
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
              <div>
                <label htmlFor="fullname" className="block text-sm font-medium text-gray-700 mb-1">Nom & Prénom *</label>
                <input type="text" id="fullname" value={formData.fullname} onChange={handleChange} required
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" id="email" value={formData.email} onChange={handleChange} required
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input type="tel" id="phone" value={formData.phone} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 mt-4">
                {isSubmitting ? 'Inscription...' : 'Confirmer mon inscription'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [otherEvents, setOtherEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchEventData = async () => {
    setLoading(true);
    if (!id) return;
    
    try {
      // Fetch current event
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
        
      if (!error && data) {
        setEvent(data);
      }

      // Fetch all other published events
      const { data: othersData, error: othersError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .neq('id', id)
        .order('event_date', { ascending: false })
        .limit(8);

      if (othersError) console.error("Error fetching other events:", othersError);

      if (othersData) {
        setOtherEvents(othersData);
      }
    } catch (err) {
      console.error("Error fetching event:", err);
    } finally {
      setLoading(false);
    }
  };

  const getEventStatus = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (eventDay === today) return { label: 'En cours', color: 'bg-emerald-600' };
    if (eventDate.getTime() > now.getTime()) return { label: 'Bientôt', color: 'bg-green-600' };
    return { label: 'Terminé', color: 'bg-gray-500' };
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchEventData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center py-20">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 py-20">
        <div className="container mx-auto px-4 text-center">
          <Calendar size={64} className="mx-auto text-gray-300 mb-6" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Événement introuvable</h1>
          <p className="text-gray-500 mb-8">Cet événement n'existe pas ou a été archivé.</p>
          <Link to="/#evenements" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl transition-colors inline-block">
            Tous les événements
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Header */}
      <div className="bg-green-900 border-b border-green-800 relative z-10 pt-24 pb-16 overflow-hidden">
        {/* Subtle background abstract shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
           <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[150%] rounded-full bg-white blur-3xl transform rotate-12"></div>
           <div className="absolute -bottom-[20%] -left-[10%] w-[40%] h-[100%] rounded-full bg-white blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 relative z-20">
          <Link to="/" className="inline-flex items-center gap-2 text-green-300 hover:text-white mb-6 transition-colors text-sm font-medium">
            <ChevronLeft size={16} />
            Retour à l'accueil
          </Link>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight max-w-4xl drop-shadow-md">
            {event.title}
          </h1>
          
          <div className="flex flex-wrap gap-4 md:gap-8 bg-white/10 backdrop-blur-md border border-white/20 p-4 md:p-6 rounded-2xl w-fit">
             <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center">
                  <Calendar size={20} className="text-green-300" />
                </div>
                <div>
                  <p className="text-xs text-green-200 uppercase tracking-widest font-semibold mb-0.5">Date</p>
                  <p className="font-medium text-sm md:text-base">{new Date(event.event_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
             </div>
             
              {event.location && (
                <>
                  <div className="w-px bg-white/20 hidden md:block"></div>
                  <div className="flex items-center gap-3 text-white">
                     <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center">
                       <MapPin size={20} className="text-green-300" />
                     </div>
                     <div>
                       <p className="text-xs text-green-200 uppercase tracking-widest font-semibold mb-0.5">Lieu</p>
                       <p className="font-medium text-sm md:text-base">{event.location}</p>
                     </div>
                  </div>
                </>
              )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-8 relative z-30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
             <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                {event.image_url && (
                  <div className="relative w-full bg-gray-50 flex items-center justify-center overflow-hidden h-[300px] sm:h-[500px] border-b border-gray-100">
                    <img 
                      src={event.image_url} 
                      alt={event.title} 
                      className="relative z-10 max-w-full max-h-full object-contain" 
                    />
                  </div>
                )}
                
                  <div className="p-8 md:p-10">
                    <div className="flex items-center gap-3 mb-6">
                      <span className={`px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest ${getEventStatus(event.event_date).color}`}>
                        {getEventStatus(event.event_date).label}
                      </span>
                      <h3 className="text-2xl font-bold text-gray-800">À propos de l'événement</h3>
                    </div>
                  {/* Render Rich Text Content */}
                  <div 
                    className="prose prose-green max-w-none text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: event.description || '' }}
                  />
                  
                  <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                     <div>
                       {event.max_slots ? (
                         <p className="flex items-center gap-2 text-gray-500 font-medium bg-gray-100 px-4 py-2 rounded-xl">
                            <Users size={18} className="text-green-600" />
                            {event.max_slots} places disponibles
                         </p>
                       ) : (
                         <p className="flex items-center gap-2 text-green-600 font-medium bg-green-50 px-4 py-2 rounded-xl">
                            <CheckCircle size={18} />
                            Entrée libre
                         </p>
                       )}
                     </div>
                     {(() => {
                       const status = getEventStatus(event.event_date);
                       const isPast = status.label === 'Terminé';
                       return (
                         <button 
                            onClick={() => setShowModal(true)}
                            disabled={isPast}
                            className={`w-full sm:w-auto font-bold py-3.5 px-10 rounded-xl transition-all text-lg flex justify-center items-center gap-2 ${
                              isPast 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-green-600 hover:bg-green-700 text-white shadow-md active:scale-95'
                            }`}
                         >
                           {isPast ? 'Événement terminé' : 'S\'inscrire'} <Calendar size={18} />
                         </button>
                       );
                     })()}
                  </div>
                </div>
             </div>
          </div>

          {/* Sidebar - Other Events */}
          <div className="lg:col-span-1">
             <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sticky top-28">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Calendar className="text-green-600" size={24} /> 
                  Autres événements
                </h3>
                
                {otherEvents.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucun autre événement programmé pour le moment.</p>
                ) : (
                  <div className="space-y-4">
                    {otherEvents.map(other => (
                      <Link 
                        key={other.id} 
                        to={`/events/${other.id}`}
                        className="block rounded-xl border border-gray-100 p-3 hover:border-green-300 hover:bg-green-50 transition-all group flex gap-4"
                      >
                         {other.image_url ? (
                           <img src={other.image_url} alt={other.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                         ) : (
                           <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                             <Calendar size={20} className="text-green-600/50" />
                           </div>
                         )}
                         <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className="font-bold text-gray-800 text-sm mb-1 truncate group-hover:text-green-700 transition-colors">
                              {other.title}
                            </h4>
                             <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">{new Date(other.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                             <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white ${getEventStatus(other.event_date).color}`}>
                               {getEventStatus(other.event_date).label}
                             </span>
                         </div>
                      </Link>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {showModal && <EventRegistrationModal event={event} onClose={() => setShowModal(false)} />}
    </div>
  );
};

export default EventDetailPage;
