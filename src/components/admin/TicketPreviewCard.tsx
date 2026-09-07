import React from 'react';
import { QrCode, Check } from 'lucide-react';
import { TicketTemplate } from '../../utils/ticketPdf';

interface TicketPreviewCardProps {
  template: TicketTemplate;
  selected: boolean;
  onSelect: () => void;
  eventTitle: string;
  eventDate?: string;
  location?: string;
  invitationText?: string;
  invitationSubtext?: string;
}

const fmt = (d?: string) => {
  if (!d) return '15 déc. 2026';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '15 déc. 2026'; }
};

/** Aperçu HTML/CSS fidèle au rendu PDF réel (voir utils/ticketPdf.ts) */
const TicketPreviewCard: React.FC<TicketPreviewCardProps> = ({
  template,
  selected,
  onSelect,
  eventTitle,
  eventDate,
  location,
  invitationText,
  invitationSubtext,
}) => {
  const title = eventTitle || "Nom de l'événement";
  const date = fmt(eventDate);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full text-left rounded-2xl border-2 transition-all overflow-hidden ${
        selected ? 'border-green-500 shadow-lg shadow-green-100' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 z-10 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center shadow">
          <Check size={14} className="text-white" strokeWidth={3} />
        </div>
      )}

      <div className="p-4 bg-gray-50">
        {template === 'classic' ? (
          <div className="rounded-lg overflow-hidden shadow-sm aspect-[2.1/1] flex bg-[#f0fdf4]">
            <div className="flex-1 flex flex-col p-2.5 min-w-0">
              <div className="bg-[#14532d] text-white text-[8px] font-bold text-center py-1.5 rounded-sm mb-2 tracking-wide">
                BILLET D'ENTRÉE OFFICIEL
              </div>
              <p className="text-[9px] font-bold text-gray-800 leading-snug line-clamp-2">{title}</p>
              <div className="mt-auto space-y-0.5">
                <p className="text-[7px] text-gray-500">Participant : Aminata KOFFI</p>
                <p className="text-[7px] text-gray-500">Date : {date}</p>
                {location && <p className="text-[7px] text-gray-500 truncate">Lieu : {location}</p>}
              </div>
            </div>
            <div className="w-[26%] flex items-center justify-center border-l-2 border-dashed border-[#14532d]/30 bg-white flex-shrink-0">
              <div className="w-8 h-8 border border-[#14532d] rounded flex items-center justify-center">
                <QrCode size={18} className="text-[#14532d]" />
              </div>
            </div>
          </div>
        ) : template === 'modern' ? (
          <div className="rounded-lg overflow-hidden shadow-sm aspect-[2.1/1] flex bg-white">
            <div className="w-[28%] bg-[#0d9488] text-white p-2 flex flex-col justify-between flex-shrink-0">
              <div>
                <p className="text-[8px] font-bold leading-tight">BILLET</p>
                <p className="text-[9px] font-bold leading-tight">D'ENTRÉE</p>
              </div>
              <p className="text-[6.5px] text-teal-100 line-clamp-2">{date}</p>
            </div>
            <div className="flex-1 p-2.5 flex flex-col min-w-0 bg-[#f0fdfa]">
              <p className="text-[7px] font-bold text-gray-700">Participant</p>
              <p className="text-[8.5px] text-gray-600 truncate">Aminata KOFFI</p>
              <div className="mt-auto">
                <p className="text-[6.5px] text-gray-400 line-clamp-2">{title}</p>
              </div>
            </div>
            <div className="w-[22%] flex items-center justify-center flex-shrink-0 pr-2">
              <div className="w-9 h-9 border-2 border-[#0d9488] rounded-lg flex items-center justify-center bg-white">
                <QrCode size={16} className="text-[#0d9488]" />
              </div>
            </div>
          </div>
        ) : (
          /* Template Carton d'Invitation de Luxe */
          <div className="rounded-lg overflow-hidden shadow-sm aspect-[2.1/1] flex bg-[#fefcf9] border border-amber-200 relative select-none">
            {/* Ruban et nœud doré à gauche */}
            <div className="w-[20%] bg-gradient-to-r from-[#c69b2b] via-[#f7df8b] to-[#d4af37] relative flex items-center justify-center flex-shrink-0 shadow-inner">
              {/* Nœud papillon doré en SVG */}
              <svg width="26" height="32" viewBox="0 0 36 44" fill="none" className="drop-shadow-md">
                <path d="M18 20 L2 4 L4 36 Z" fill="#eab308" />
                <path d="M18 20 L4 8 L6 32 Z" fill="#fde047" />
                <path d="M18 20 L34 4 L32 36 Z" fill="#ca8a04" />
                <path d="M18 20 L32 8 L30 32 Z" fill="#fde047" />
                <path d="M12 24 L6 42 L16 38 Z" fill="#a16207" />
                <path d="M24 24 L30 42 L20 38 Z" fill="#ca8a04" />
                <rect x="13" y="14" width="10" height="12" rx="3" fill="#fef08a" />
                <circle cx="18" cy="20" r="3" fill="#a16207" />
              </svg>
            </div>

            {/* Corps de l'invitation */}
            <div className="flex-1 p-2 flex flex-col justify-between min-w-0 bg-[#fefcf9]">
              <div className="text-center">
                <p className="text-[10px] font-serif font-black text-[#881337] tracking-widest leading-none">INVITATION</p>
                <div className="w-12 h-px bg-[#881337] mx-auto my-0.5" />
                <p className="text-[5.5px] font-serif text-slate-800 line-clamp-2 italic mt-0.5 leading-tight">
                  {invitationText
                    ? invitationText.replace(/\{name\}|\[nom\]/gi, 'Aminata KOFFI')
                    : `À l'occasion de « ${title} »`}
                </p>
              </div>

              {/* Badges bordeaux Date & Lieu */}
              <div className="space-y-0.5 my-0.5">
                <div className="bg-[#3f0a14] text-white text-[5px] font-bold px-1.5 py-0.5 rounded text-center truncate">
                  {date} • 18H00
                </div>
                {location && (
                  <div className="bg-[#3f0a14] text-white text-[4.5px] font-medium px-1.5 py-0.5 rounded text-center truncate">
                    LIEU : {location}
                  </div>
                )}
              </div>

              {/* Formule calligraphique */}
              <p className="text-[7.5px] font-serif italic font-bold text-[#881337] text-center leading-none truncate">
                {invitationSubtext || 'Soyez les bienvenus'}
              </p>
            </div>

            {/* QR Code pour accès officiel */}
            <div className="w-[20%] flex flex-col items-center justify-center flex-shrink-0 pr-1.5 border-l border-amber-200/60 bg-[#fffdfa]">
              <div className="w-8 h-8 border border-amber-400 rounded flex items-center justify-center bg-white shadow-xs">
                <QrCode size={16} className="text-[#881337]" />
              </div>
              <p className="text-[3.5px] font-bold text-[#881337] mt-0.5 uppercase tracking-tighter">Accès Invité</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 bg-white flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">
          {template === 'classic'
            ? 'Classique — vert institutionnel'
            : template === 'modern'
            ? 'Moderne — bandeau teal'
            : 'Invitation — ruban doré, dîner & gala'}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wide ${selected ? 'text-green-600' : 'text-gray-300 group-hover:text-gray-400'}`}>
          {selected ? 'Sélectionné' : 'Choisir'}
        </span>
      </div>
    </button>
  );
};

export default TicketPreviewCard;
