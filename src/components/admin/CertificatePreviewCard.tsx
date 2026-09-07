import React from 'react';
import { Check, Award } from 'lucide-react';
import { CertificateTemplate } from '../../utils/certificatePdf';

interface CertificatePreviewCardProps {
  template: CertificateTemplate;
  selected: boolean;
  onSelect: () => void;
  eventTitle: string;
}

/** Aperçu HTML/CSS fidèle au rendu PDF réel (voir utils/certificatePdf.ts) */
const CertificatePreviewCard: React.FC<CertificatePreviewCardProps> = ({ template, selected, onSelect, eventTitle }) => {
  const title = eventTitle || "l'événement";

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
          <div className="aspect-[1.4/1] rounded-lg shadow-sm bg-[#fdfcf7] border-2 border-[#b4943c]/60 flex flex-col items-center justify-center text-center p-4 relative">
            <div className="absolute inset-1.5 border border-[#b4943c]/40 rounded" />
            <Award size={16} className="text-[#78602c] mb-1" />
            <p className="text-[6px] font-bold text-[#78602c] tracking-widest uppercase">ONG Développement Durable</p>
            <p className="text-[9px] font-serif font-bold text-gray-800 mt-1">CERTIFICAT DE PARTICIPATION</p>
            <div className="w-8 h-px bg-[#b4943c] my-1" />
            <p className="text-[6.5px] italic text-gray-500">Décerné à</p>
            <p className="text-[10px] font-serif italic font-bold text-[#78602c]">Aminata Koffi</p>
            <p className="text-[6px] text-gray-500 mt-1 line-clamp-1 px-2">pour sa participation à « {title} »</p>
          </div>
        ) : (
          <div className="aspect-[1.4/1] rounded-lg shadow-sm bg-white overflow-hidden relative border border-gray-200 select-none">
            {/* 1. Bandeau supérieur bleu acier */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#6494c0]" />

            {/* 2. Cadre rectangulaire intérieur fin */}
            <div className="absolute inset-[6px] border border-[#6494c0]/50 pointer-events-none" />

            {/* 3. Motifs coin haut-gauche */}
            <div className="absolute top-0 left-0 w-2.5 h-5 bg-[#10549c]" />
            <div className="absolute top-2.5 left-3 w-2 h-2 bg-[#8eb9da]" />
            <div className="absolute top-0 left-5.5 w-1.5 h-1.5 bg-[#10549c]" />

            {/* 4. Bande verticale gauche */}
            <div className="absolute bottom-0 left-0 w-1.5 h-[40%] bg-[#10549c]" />

            {/* 5. Motifs coin bas-droit */}
            <div className="absolute bottom-0 right-0 w-8 h-3.5 bg-[#10549c]" />
            <div className="absolute bottom-4 right-7 w-2 h-2 bg-[#8eb9da]" />
            <div className="absolute bottom-0 right-0 w-1.5 h-7 bg-[#10549c]" />

            {/* 6. Rosette d'honneur avec rubans */}
            <div className="absolute top-2.5 right-4 z-10 flex flex-col items-center">
              <svg width="24" height="34" viewBox="0 0 36 50" fill="none" className="drop-shadow-sm">
                {/* Rubans avec encoches en V */}
                <path d="M12 20 L6 46 L14 40 L18 46 L17 22 Z" fill="#10549c" />
                <path d="M19 22 L18 46 L22 40 L30 46 L24 20 Z" fill="#0d4682" />
                {/* Médaillon plissé */}
                <circle cx="18" cy="18" r="14" fill="#10549c" />
                <circle cx="18" cy="18" r="11" fill="#0c407d" />
                <circle cx="18" cy="18" r="8" fill="#1864b4" />
                <circle cx="18" cy="18" r="4.5" fill="#0c407d" />
              </svg>
            </div>

            {/* Contenu textuel (agrandi et descendu) */}
            <div className="relative h-full flex flex-col items-center justify-between text-center px-4 pt-4 pb-2.5 z-1">
              <div className="mt-1.5">
                <p className="text-[15px] font-black text-[#10549c] tracking-wider leading-tight">CERTIFICAT</p>
                <p className="text-[7px] font-bold text-slate-800 tracking-wider mt-0.5">DE RECONNAISSANCE</p>
                <p className="text-[5px] font-bold text-slate-400 tracking-widest mt-1.5 uppercase">EST DÉCERNÉ À :</p>
              </div>

              <div className="my-auto w-full pt-1">
                <p className="text-[13px] font-serif italic font-bold text-slate-900 tracking-wide leading-tight">
                  Olivia Thompson
                </p>
                <p className="text-[5px] text-slate-600 line-clamp-1 max-w-[85%] mx-auto mt-1">
                  Pour ses réalisations et sa participation aux activités de « {title} »
                </p>
              </div>

              {/* Signatures en bas */}
              <div className="w-full flex justify-between px-3 mt-1 mb-0.5">
                <div className="flex flex-col items-center">
                  <div className="w-14 h-px bg-slate-700 mb-0.5" />
                  <p className="text-[5px] font-bold text-slate-800">Isabel Mercado</p>
                  <p className="text-[3.8px] text-slate-400 uppercase tracking-tight">SUPERVISEUR</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-14 h-px bg-slate-700 mb-0.5" />
                  <p className="text-[5px] font-bold text-slate-800">Adora Montminy</p>
                  <p className="text-[3.8px] text-slate-400 uppercase tracking-tight">VICE-PRÉSIDENT</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 bg-white flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">
          {template === 'classic' ? 'Classique — cadre doré, style formel' : 'Moderne — cadre bleu, rosette'}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wide ${selected ? 'text-green-600' : 'text-gray-300 group-hover:text-gray-400'}`}>
          {selected ? 'Sélectionné' : 'Choisir'}
        </span>
      </div>
    </button>
  );
};

export default CertificatePreviewCard;
