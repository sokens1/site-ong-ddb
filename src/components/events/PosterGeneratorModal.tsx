import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Download, RefreshCw, Camera } from 'lucide-react';
import { isInAppBrowser } from '../../utils/inAppBrowser';
import { useInAppBrowserBanner } from '../../context/InAppBrowserContext';
import { drawPoster as renderPosterToCanvas, PosterTemplate } from '../../utils/posterTemplates';

interface Event {
  title: string;
  image_url: string | null;
  logo_url?: string;
  event_date: string;
  event_dates?: { date: string; label?: string }[];
  organizer_logos?: string[];
  partner_logos?: string[];
  poster_template?: PosterTemplate;
}

interface PosterGeneratorModalProps {
  event: Event;
  defaultName: string;
  onClose: () => void;
}

const PosterGeneratorModal: React.FC<PosterGeneratorModalProps> = ({ event, defaultName, onClose }) => {
  const { reactivate: reactivateInAppBanner } = useInAppBrowserBanner();
  const [name, setName] = useState(defaultName);
  const [photo, setPhoto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const isDrawing = useRef(false); // guard contre les appels concurrents

  // ── Swipe-to-close ────────────────────────────────────────────────────────
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    dragCurrentY.current = delta;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragCurrentY.current > 120) {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.25s ease';
        sheetRef.current.style.transform = 'translateY(100%)';
      }
      setTimeout(onClose, 220);
    } else {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.3s ease';
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [onClose]);

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhoto(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // ── Draw poster (délégué au module partagé, dépendant du template) ────────
  const drawPoster = async () => {
    if (isDrawing.current) return; // évite les appels concurrents
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDrawing.current = true;
    setIsGenerating(true);
    try {
      await renderPosterToCanvas(canvas, event, name, photo, event.poster_template || 'classic');
    } catch (err) {
      console.error('Poster generation error:', err);
    } finally {
      isDrawing.current = false;
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    drawPoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, photo]);

  const downloadPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (isInAppBrowser()) {
      reactivateInAppBanner();
      return;
    }
    try {
      const link = document.createElement('a');
      link.download = `jy-serai-${name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert("Impossible de télécharger : une image source bloque l'export (URL non sécurisée). Vérifiez que les logos sont hébergés en HTTPS.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="bg-white w-full sm:max-w-5xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col md:flex-row overflow-y-auto md:overflow-hidden"
        style={{ maxHeight: '95dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div
          className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0 bg-white cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* ── Controls ─────────────────────────────────────────────── */}
        <div className="w-full md:w-5/12 bg-gray-50 flex flex-col flex-shrink-0 md:border-r border-gray-200">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2 md:px-8 md:pt-8 sticky top-0 bg-gray-50 z-10 border-b border-gray-100 md:border-none">
            <h3 className="text-base md:text-xl font-bold text-gray-800">Générer mon affiche</h3>
            <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
              <X size={20} />
            </button>
          </div>

          <p className="text-gray-400 text-xs px-5 pt-3 pb-4 md:px-8 leading-relaxed">
            Personnalisez votre affiche et partagez sur les réseaux !
          </p>

          {/* Fields */}
          <div className="flex gap-3 px-5 md:px-8 md:flex-col">
            {/* Name */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Nom affiché</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>

            {/* Photo */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Photo</label>
              <label className="relative flex flex-col items-center justify-center w-full h-[52px] md:h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-white overflow-hidden group transition-colors hover:bg-gray-50">
                {photo ? (
                  <>
                    <img src={photo} alt="preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
                      <Camera size={16} />
                      <span className="text-[10px] md:text-xs font-semibold px-1 text-center">Changer la photo</span>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-0.5 pointer-events-none">
                      <Camera size={10} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 px-2">
                    <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <p className="text-xs text-gray-500 truncate">Ajouter une photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          {/* Download */}
          <div className="px-5 py-4 md:px-8 md:pb-8 md:mt-auto">
            <button
              onClick={downloadPoster}
              disabled={isGenerating || !photo}
              className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow text-sm"
            >
              {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
              Télécharger l'affiche
            </button>
          </div>
        </div>

        {/* ── Canvas Preview ────────────────────────────────────────── */}
        <div className="w-full md:w-7/12 bg-gray-900 flex items-center justify-center p-5 md:p-8">
          <div className="relative w-full max-w-[240px] sm:max-w-xs md:max-w-sm mx-auto aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl">
            <canvas ref={canvasRef} className="w-full h-full object-contain bg-black" />
            {!photo && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white p-6 text-center">
                <div>
                  <Upload className="mx-auto mb-3 opacity-60" size={28} />
                  <p className="font-semibold text-sm">Ajoutez votre photo pour voir l'aperçu</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PosterGeneratorModal;
