import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Download, X } from 'lucide-react';
import { fetchReports } from '../data/reports';

interface Report {
  id: number;
  title: string;
  description: string;
  fileUrl: string;
  date: string;
  image: string;
  category: string;
}

// Petites pastilles de couleur décoratives sur les cartes, on tourne dessus
const BLOB_COLORS = ['bg-ddb-400', 'bg-amber-400', 'bg-ddb-600', 'bg-sky-400'];

const morphTransition = { type: 'spring' as const, bounce: 0.05, duration: 0.25 };

const ActionsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('Toutes');
  const [availableYears, setAvailableYears] = useState<string[]>(['Toutes']);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const getReports = async () => {
      setLoading(true);
      try {
        const data = await fetchReports();
        const sorted = data.sort((a: Report, b: Report) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setReports(sorted);

        const yearsSet = new Set(sorted.map((r: Report) => r.date.substring(0, 4)));
        const yearsArray = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
        setAvailableYears(['Toutes', ...(yearsArray as string[])]);
      } catch (err) {
        console.error('Unexpected error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };
    getReports();
  }, []);

  const filteredReports = useMemo(() => {
    let result = reports;
    if (filterYear !== 'Toutes') {
      result = result.filter((r) => r.date.startsWith(filterYear));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [reports, filterYear, searchQuery]);

  const activeReport = reports.find((r) => r.id === openId) || null;

  // Fermeture via Échap tant que le document est ouvert
  useEffect(() => {
    if (!activeReport) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeReport]);

  return (
    // -mt-24 : annule le spacer laissé par la navbar flottante (Header.tsx) sur
    // les pages non-accueil, pour que le fond blanc remonte jusqu'en haut de
    // la page, au lieu de laisser apparaître le gris du fond de l'app.
    <div className="min-h-screen -mt-24 bg-white pb-24 pt-32 sm:pt-36">
      <div className="container mx-auto max-w-6xl px-4">
        {/* ── En-tête ── */}
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-ddb-950 sm:text-5xl lg:text-6xl">
              Nos Rapports
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ddb-950/60">
              Explorez nos bilans annuels et documents financiers pour suivre
              l'évolution de nos activités en toute transparence.
            </p>
          </motion.div>

          {/* Illustration décorative — petite pile de documents animée */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative mx-auto hidden h-44 w-44 shrink-0 sm:block lg:h-52 lg:w-52"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-0 top-2 flex h-28 w-24 -rotate-6 flex-col justify-between overflow-hidden rounded-2xl bg-ddb-950 p-3 shadow-xl ring-1 ring-ddb-950/5"
            >
              <FileText className="h-5 w-5 text-ddb-400" />
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-white/20" />
                <div className="h-1.5 w-2/3 rounded-full bg-white/20" />
              </div>
            </motion.div>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
              className="absolute bottom-2 right-0 flex h-32 w-28 rotate-6 flex-col justify-between overflow-hidden rounded-2xl bg-ddb-50 p-3 shadow-xl ring-1 ring-ddb-950/5"
            >
              <FileText className="h-5 w-5 text-ddb-600" />
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-ddb-950/10" />
                <div className="h-1.5 w-2/3 rounded-full bg-ddb-950/10" />
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Filtres ── */}
        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => setFilterYear(year)}
                className={`inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                  filterYear === year
                    ? 'border-ddb-600 text-ddb-700'
                    : 'border-ddb-950/10 text-ddb-950/50 hover:border-ddb-950/20'
                }`}
              >
                {year === 'Toutes' ? 'Tout' : year}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ddb-950/40" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border-2 border-ddb-950/10 bg-white py-2 pl-10 pr-4 text-sm outline-none transition-colors focus:border-ddb-600"
            />
          </div>
        </div>

        {/* ── Grille ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ddb-600 border-t-transparent" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-ddb-950/10 bg-ddb-50 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white">
              <Search className="h-6 w-6 text-ddb-950/30" />
            </div>
            <h3 className="font-heading text-lg font-bold text-ddb-950">Aucun rapport trouvé</h3>
            <p className="mt-1 text-sm text-ddb-950/50">
              Essayez un autre mot-clé ou une autre année.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterYear('Toutes');
              }}
              className="mt-5 font-heading text-sm font-bold text-ddb-700 hover:text-ddb-900"
            >
              Réinitialiser
            </button>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-3">
            {filteredReports.map((report, index) => {
              const blob = BLOB_COLORS[index % BLOB_COLORS.length];
              return (
                <motion.button
                  key={report.id}
                  onClick={() => setOpenId(report.id)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
                  className="group block w-full text-left"
                >
                  <motion.div
                    layoutId={`report-image-${report.id}`}
                    transition={morphTransition}
                    className="relative aspect-[4/3] overflow-hidden rounded-2xl"
                  >
                    <span
                      aria-hidden
                      className={`absolute -bottom-3 -left-3 z-0 h-16 w-16 rounded-full ${blob}`}
                    />
                    <img
                      src={report.image}
                      alt={report.title}
                      loading="lazy"
                      className="absolute inset-0 z-10 h-full w-full rounded-2xl object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-ddb-950 px-3 py-1 text-xs font-bold text-white">
                      <FileText className="h-3 w-3" />
                      Rapport
                    </span>
                  </motion.div>

                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-ddb-950/40">
                    <span>
                      {new Date(report.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <motion.h3
                    layoutId={`report-title-${report.id}`}
                    transition={morphTransition}
                    className="mt-2 font-heading text-lg font-bold leading-snug text-ddb-950 line-clamp-2 group-hover:text-ddb-700"
                  >
                    {report.title}
                  </motion.h3>

                  {report.description?.trim() && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ddb-950/60 line-clamp-3">
                      {report.description}
                    </p>
                  )}

                  <span className="mt-3 inline-flex items-center gap-1.5 font-heading text-sm font-bold text-ddb-700">
                    Voir le document
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Dialogue "morphing" : la carte se transforme en document plein écran ── */}
      <AnimatePresence>
        {activeReport && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-ddb-950/70 backdrop-blur-sm"
              onClick={() => setOpenId(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                layoutId={`report-image-${activeReport.id}`}
                transition={morphTransition}
                className="pointer-events-auto relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setOpenId(null)}
                  aria-label="Fermer"
                  className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
                >
                  <X size={18} />
                </button>

                <div className="relative h-56 w-full shrink-0 overflow-hidden sm:h-72">
                  <img
                    src={activeReport.image}
                    alt={activeReport.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="overflow-y-auto p-6 sm:p-8">
                  <span className="font-heading text-xs font-bold uppercase tracking-widest text-ddb-600">
                    Rapport ·{' '}
                    {new Date(activeReport.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  <motion.h2
                    layoutId={`report-title-${activeReport.id}`}
                    transition={morphTransition}
                    className="mt-2 font-heading text-2xl font-extrabold leading-tight text-ddb-950 sm:text-3xl"
                  >
                    {activeReport.title}
                  </motion.h2>
                  <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-ddb-950/70">
                    {activeReport.description}
                  </p>

                  <a
                    href={activeReport.fileUrl}
                    download
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-ddb-700 px-6 py-3 font-heading font-bold text-white transition-colors hover:bg-ddb-800"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger le document
                  </a>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActionsPage;
