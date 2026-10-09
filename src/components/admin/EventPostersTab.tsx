import React, { useState, useEffect } from 'react';
import { Download, Trash2, Image as ImageIcon, RefreshCw, HardDrive, Sparkles, Check, AlertTriangle, Eye, ExternalLink, X } from 'lucide-react';
import { getEventPosters, downloadAllPostersZip, purgeEventPostersFromStorage, PosterFileItem } from '../../utils/posterStorage';

interface EventPostersTabProps {
  eventId: number | string;
  eventTitle: string;
}

export const EventPostersTab: React.FC<EventPostersTabProps> = ({ eventId, eventTitle }) => {
  const [posters, setPosters] = useState<PosterFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ percent: number; current: number; total: number } | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<PosterFileItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPosters = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const list = await getEventPosters(eventId);
      setPosters(list);
    } catch (err: any) {
      setErrorMessage("Impossible de charger les visuels.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosters();
  }, [eventId]);

  const totalBytes = posters.reduce((acc, p) => acc + (p.size || 180000), 0);
  const formattedSize = totalBytes > 1024 * 1024
    ? `${(totalBytes / (1024 * 1024)).toFixed(1)} Mo`
    : `${Math.round(totalBytes / 1024)} Ko`;

  const handleDownloadZip = async () => {
    if (posters.length === 0) return;
    setIsZipping(true);
    setZipProgress({ percent: 0, current: 0, total: posters.length });
    try {
      await downloadAllPostersZip(posters, eventTitle, (percent, current, total) => {
        setZipProgress({ percent, current, total });
      });
      setSuccessMessage(`Archive ZIP téléchargée (${posters.length} visuels)`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de la création de l'archive ZIP.");
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      const res = await purgeEventPostersFromStorage(eventId);
      setSuccessMessage(`${res.count} visuel(s) purgé(s). Espace de stockage Supabase libéré !`);
      setShowPurgeModal(false);
      await loadPosters();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la purge.');
    } finally {
      setIsPurging(false);
    }
  };

  const handleDownloadSingle = async (item: PosterFileItem) => {
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `jy-serai-${item.participantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      window.open(item.url, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Messages Alertes ── */}
      {successMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold animate-in fade-in">
          <Check size={18} className="flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-semibold animate-in fade-in">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Header & Action Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Compteur */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <ImageIcon size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Affiches générées</p>
            <p className="text-2xl font-black text-white mt-0.5">{posters.length}</p>
          </div>
        </div>

        {/* Espace Stockage */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <HardDrive size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Espace occupé</p>
            <p className="text-2xl font-black text-white mt-0.5">{posters.length > 0 ? formattedSize : '0 Mo'}</p>
          </div>
        </div>

        {/* Boutons d'action rapides */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-center gap-2.5">
          <button
            onClick={handleDownloadZip}
            disabled={posters.length === 0 || isZipping}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-ddb-600 hover:from-emerald-500 hover:to-ddb-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {isZipping ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Compression ({zipProgress?.percent || 0}%)…</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Télécharger tout (ZIP)</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowPurgeModal(true)}
            disabled={posters.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            <span>Purger le stockage</span>
          </button>
        </div>
      </div>

      {/* ── Galerie des Visuels ── */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-400" />
              Galerie des affiches participants
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Toutes les affiches générées automatiquement pour cet événement
            </p>
          </div>

          <button
            onClick={loadPosters}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">Chargement des visuels…</p>
          </div>
        ) : posters.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-700 rounded-2xl p-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-700/40 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ImageIcon size={28} />
            </div>
            <p className="text-base font-bold text-white mb-1">Aucune affiche générée pour le moment</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Dès qu'un participant personnalise et télécharge son affiche « J'y serai », elle apparaîtra automatiquement ici.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {posters.map((item) => (
              <div
                key={item.id}
                className="group relative bg-slate-900/90 border border-slate-700/80 hover:border-emerald-500/50 rounded-2xl overflow-hidden transition-all shadow-md flex flex-col"
              >
                {/* Vignette Poster */}
                <div className="relative aspect-[4/5] bg-slate-950 overflow-hidden cursor-pointer" onClick={() => setPreviewItem(item)}>
                  <img
                    src={item.url}
                    alt={item.participantName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-2 rounded-full bg-white/20 text-white backdrop-blur-sm hover:scale-110 transition-transform">
                      <Eye size={16} />
                    </span>
                  </div>
                </div>

                {/* Info & Action */}
                <div className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate" title={item.participantName}>
                      {item.participantName}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDownloadSingle(item)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-all flex-shrink-0"
                    title="Télécharger l'affiche"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal d'aperçu plein écran ── */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative bg-slate-900 border border-white/15 rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full mb-4">
              <div>
                <h4 className="text-base font-bold text-white">{previewItem.participantName}</h4>
                <p className="text-xs text-slate-400">Affiche « J'y serai » officielle</p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-full aspect-[4/5] max-h-[60vh] rounded-2xl overflow-hidden bg-black shadow-inner mb-4">
              <img src={previewItem.url} alt={previewItem.participantName} className="w-full h-full object-contain" />
            </div>

            <button
              onClick={() => handleDownloadSingle(previewItem)}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-ddb-600 hover:from-emerald-500 hover:to-ddb-500 text-white font-bold text-xs shadow-lg transition-all"
            >
              <Download size={16} />
              <span>Télécharger cette affiche (JPG HD)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmation Purge & Nettoyage ── */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
              <Trash2 size={24} />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Nettoyer les visuels de cet événement ?</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Cette action va supprimer définitivement les <strong className="text-white">{posters.length} affiches</strong> stockées sur Supabase pour libérer <strong className="text-white">{formattedSize}</strong> d'espace disque.
              </p>
              <p className="text-xs text-amber-400 mt-2 font-medium">
                💡 Astuce : Pensez à télécharger l'archive ZIP complète avant de purger si vous souhaitez conserver les visuels sur votre ordinateur.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPurgeModal(false)}
                disabled={isPurging}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handlePurge}
                disabled={isPurging}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {isPurging ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Purge en cours…</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirmer la suppression</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
