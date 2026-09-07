import React, { useEffect, useRef, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { drawPoster, PosterEventData, PosterTemplate } from '../../utils/posterTemplates';

interface PosterPreviewCardProps {
  template: PosterTemplate;
  selected: boolean;
  onSelect: () => void;
  event: PosterEventData;
}

/** Aperçu canvas vivant — utilise le même moteur de rendu que la génération réelle. */
const PosterPreviewCard: React.FC<PosterPreviewCardProps> = ({ template, selected, onSelect, event }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);
    drawPoster(canvas, event, 'Aminata KOFFI', event.image_url || null, template)
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, event.image_url, event.logo_url, event.title, event.event_date]);

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

      <div className="p-3 bg-gray-900">
        <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-black">
          <canvas ref={canvasRef} className="w-full h-full object-contain" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <RefreshCw size={18} className="text-white animate-spin" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 bg-white flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">
          {template === 'classic' ? 'Classique — vert, sticker manuscrit' : "Moderne — arche dorée, badge « J'y participe »"}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wide ${selected ? 'text-green-600' : 'text-gray-300 group-hover:text-gray-400'}`}>
          {selected ? 'Sélectionné' : 'Choisir'}
        </span>
      </div>
    </button>
  );
};

export default PosterPreviewCard;
