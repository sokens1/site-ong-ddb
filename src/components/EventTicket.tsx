import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { Calendar, MapPin, User, Tag, Download, CheckCircle, Info } from 'lucide-react';

interface EventTicketProps {
  event: {
    title: string;
    event_date: string;
    location: string;
    price?: number | null;
  };
  registration: {
    fullname: string;
    ticket_ref: string;
  };
  showDownload?: boolean;
}

const EventTicket: React.FC<EventTicketProps> = ({ event, registration, showDownload = true }) => {
  const ticketRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (ticketRef.current === null) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `Ticket-${event.title.replace(/\s+/g, '-')}-${registration.fullname.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erreur lors du téléchargement du billet:', err);
    }
  };

  const formattedDate = new Date(event.event_date).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const formattedTime = new Date(event.event_date).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="flex flex-col items-center">
      <div 
        ref={ticketRef}
        id="ddb-premium-ticket"
        className="w-full max-w-[800px] bg-[#064e3b] text-white rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative border border-green-800"
        style={{ minHeight: '320px' }}
      >
        {/* Left Side: Event Details */}
        <div className="flex-1 p-8 md:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-green-800/50">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-emerald-500 p-1.5 rounded-lg">
                <CheckCircle size={18} className="text-[#064e3b]" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Billet d'Entrée • ONG DDB</span>
            </div>
            
            <h2 className="text-2xl md:text-4xl font-black mb-6 leading-tight">
              {event.title}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-emerald-500" />
                <div>
                  <p className="text-[10px] uppercase text-emerald-500/70 font-bold tracking-tighter">Date</p>
                  <p className="font-bold">{formattedDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Info size={18} className="text-emerald-500" />
                <div>
                  <p className="text-[10px] uppercase text-emerald-500/70 font-bold tracking-tighter">Heure</p>
                  <p className="font-bold">{formattedTime}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <MapPin size={18} className="text-emerald-500" />
                <div>
                  <p className="text-[10px] uppercase text-emerald-500/70 font-bold tracking-tighter">Lieu</p>
                  <p className="font-bold">{event.location || 'Consultez le site'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-green-800/50 grid grid-cols-2 gap-4">
             <div>
                <p className="text-[10px] uppercase text-emerald-500 font-bold tracking-widest mb-1 flex items-center gap-1">
                  <Tag size={10} /> Tarif
                </p>
                <p className="text-xl font-black text-white">
                  {event.price && event.price > 0 ? `${new Intl.NumberFormat('fr-FR').format(event.price)} FCFA` : 'GRATUIT'}
                </p>
             </div>
             <div>
                <p className="text-[10px] uppercase text-emerald-500 font-bold tracking-widest mb-1 flex items-center gap-1">
                  <User size={10} /> Participant
                </p>
                <p className="text-lg font-bold text-white truncate">{registration.fullname}</p>
             </div>
          </div>
        </div>

        {/* Right Side: QR Code Area */}
        <div className="w-full md:w-64 bg-green-900/30 p-8 flex flex-col items-center justify-center text-center">
            <div className="bg-white p-4 rounded-2xl shadow-inner mb-4">
              <QRCodeSVG 
                value={registration.ticket_ref} 
                size={140} 
                level="H" 
                includeMargin={false}
                fgColor="#064e3b"
              />
            </div>
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">Scanner pour valider</p>
            <div className="text-center">
               <p className="text-[10px] text-green-400/60 uppercase">RÉFÉRENCE</p>
               <p className="text-xs font-mono font-bold text-white tracking-widest">{registration.ticket_ref}</p>
            </div>
        </div>

        {/* Aesthetics - Decorative cutouts */}
        <div className="hidden md:block absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-50 border-r border-green-800"></div>
        <div className="hidden md:block absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-50 border-l border-green-800"></div>
      </div>

      {showDownload && (
        <button 
          onClick={handleDownload}
          className="mt-8 flex items-center gap-2 bg-[#064e3b] hover:bg-[#053e2f] text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-900/20 active:scale-95 group"
        >
          <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
          Télécharger mon billet (PNG)
        </button>
      )}
    </div>
  );
};

export default EventTicket;
