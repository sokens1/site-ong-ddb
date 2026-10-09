import React, { useState } from 'react';
import { Clock, Calendar, MapPin, User, Download, X, FileText, Sparkles, Check, ChevronRight } from 'lucide-react';
import { EventData, EventProgramItem } from '../../types/events';
import { downloadProgramPdf } from '../../utils/programPdf';

interface EventProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventData;
}

export const EventProgramModal: React.FC<EventProgramModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const programList: EventProgramItem[] = event.program || [];
  const mainDate = event.event_date ? new Date(event.event_date) : null;
  const dateFormatted = mainDate
    ? mainDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadProgramPdf(event);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Erreur lors du téléchargement du programme:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Backdrop sombre et flouté */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity" />

      {/* Conteneur Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── En-tête Gradient & Glow ── */}
        <div className="relative p-6 sm:p-7 bg-gradient-to-br from-slate-900 via-ddb-950 to-slate-900 border-b border-white/10 overflow-hidden flex-shrink-0">
          {/* Lueur d'ambiance */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-ddb-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles size={11} /> Programme officiel
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10 text-[11px] font-semibold">
                  {programList.length} étape{programList.length > 1 ? 's' : ''}
                </span>
              </div>

              <h2 className="font-heading text-xl sm:text-2xl font-black text-white leading-tight line-clamp-2">
                {event.title}
              </h2>

              <div className="flex items-center gap-3 mt-2.5 text-xs text-white/70 flex-wrap">
                {dateFormatted && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={13} className="text-ddb-300" />
                    {dateFormatted}
                  </span>
                )}
                {event.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} className="text-ddb-300" />
                    {event.location}
                  </span>
                )}
              </div>
            </div>

            {/* Bouton Fermer */}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white flex items-center justify-center transition-all flex-shrink-0"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Corps : Timeline du Programme Défilable ── */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-4 max-h-[calc(90vh-210px)] custom-scrollbar">
          {programList.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 mx-auto mb-3">
                <FileText size={26} />
              </div>
              <p className="text-base font-bold text-white mb-1">Aucune étape détaillée</p>
              <p className="text-xs text-white/50">Le programme complet sera communiqué prochainement.</p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-4 sm:space-y-5 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-ddb-400 before:via-white/20 before:to-transparent">
              {programList.map((item, idx) => (
                <div key={item.id || idx} className="relative group">
                  {/* Bulle numérotée timeline */}
                  <div className="absolute -left-6 sm:-left-8 top-3 w-6 h-6 rounded-full bg-slate-900 border-2 border-ddb-400 flex items-center justify-center text-[11px] font-black text-ddb-300 shadow-md group-hover:scale-110 group-hover:bg-ddb-400 group-hover:text-slate-950 transition-all">
                    {idx + 1}
                  </div>

                  {/* Carte d'étape */}
                  <div className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-2xl p-4 sm:p-5 transition-all">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                      <h3 className="font-heading text-base sm:text-lg font-bold text-white group-hover:text-ddb-200 transition-colors">
                        {item.title}
                      </h3>
                      {item.time && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-xs font-bold whitespace-nowrap shadow-sm">
                          <Clock size={12} />
                          {item.time}
                        </span>
                      )}
                    </div>

                    {item.speaker && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/90 mb-2">
                        <User size={12} className="text-ddb-300" />
                        <span className="font-semibold text-white/90">{item.speaker}</span>
                      </div>
                    )}

                    {item.description && (
                      <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pied de page avec bouton Télécharger & Fermer ── */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <p className="text-xs text-white/50 hidden sm:block">
            Format PDF imprimable et prêt à partager
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-bold transition-all"
            >
              Fermer
            </button>

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${
                downloadSuccess
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gradient-to-r from-ddb-500 to-emerald-600 hover:from-ddb-400 hover:to-emerald-500 text-white hover:scale-[1.02] active:scale-95'
              }`}
            >
              {isDownloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Génération du PDF…</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check size={14} />
                  <span>Programme téléchargé !</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Télécharger le programme (PDF)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
