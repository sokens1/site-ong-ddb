import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ArrowRight,
  ArrowLeft,
  Play,
  FileText,
  Facebook,
  Twitter,
  Linkedin,
  Share2,
} from 'lucide-react';

interface FeedItem {
  type: 'news' | 'video';
  id: number;
  title: string;
  image: string;
  category: string;
  date: string;
  description: string;
  /** Début du corps de l'article (champ `content`), utilisé pour l'aperçu sur la carte */
  preview: string;
  link: string;
}

// Petites pastilles de couleur décoratives sur les cartes, on tourne dessus
const BLOB_COLORS = ['bg-ddb-400', 'bg-amber-400', 'bg-ddb-600', 'bg-sky-400'];

const readMinutes = (text: string) =>
  Math.max(1, Math.round((text || '').trim().split(/\s+/).filter(Boolean).length / 200));

const NewsPage: React.FC = () => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'Tous' | 'Blog' | 'Vidéo'>('Tous');
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchFeed = async () => {
      setLoading(true);
      try {
        const now = new Date().toISOString().split('T')[0];

        const { data: newsData, error: newsError } = await supabase
          .from('news')
          .select('id, title, image, date, description, content, status')
          .eq('status', 'published')
          .lte('date', now)
          .order('date', { ascending: false });

        const { data: videosData, error: videosError } = await supabase
          .from('videos')
          .select('id, title, thumbnailpath, date, description, videourl, filepath')
          .lte('date', now)
          .order('date', { ascending: false });

        if (newsError) console.error('Error fetching news:', newsError);
        if (videosError) console.error('Error fetching videos:', videosError);

        let merged: FeedItem[] = [];

        if (newsData) {
          merged = merged.concat(
            newsData.map((n) => ({
              type: 'news' as const,
              id: n.id,
              title: n.title,
              image: n.image,
              category: 'Blog',
              date: n.date,
              description: n.description,
              preview: (n.content && n.content.trim()) || n.description || '',
              link: `/article/${n.id}`,
            })),
          );
        }

        if (videosData) {
          merged = merged.concat(
            videosData.map((v) => ({
              type: 'video' as const,
              id: v.id,
              title: v.title,
              image: v.thumbnailpath || '/images/image-presentation-3.jpg',
              category: 'Vidéo',
              date: v.date,
              description: v.description || '',
              preview: v.description || '',
              link: v.videourl || v.filepath || '',
            })),
          );
        }

        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setFeedItems(merged);
      } catch (err) {
        console.error('Unexpected error fetching feed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, []);

  const filteredFeed = useMemo(() => {
    let result = feedItems;
    if (filterCategory !== 'Tous') {
      result = result.filter((item) => item.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.preview.toLowerCase().includes(q),
      );
    }
    return result;
  }, [feedItems, filterCategory, searchQuery]);

  const activeArticle = feedItems.find((f) => f.type === 'news' && f.id === openId) || null;
  const otherArticles = feedItems.filter((f) => f.type === 'news' && f.id !== openId);
  const shareUrl = activeArticle ? `${window.location.origin}/article/${activeArticle.id}` : '';

  // Fermeture via Échap tant que le lecteur est ouvert
  useEffect(() => {
    if (!activeArticle) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeArticle]);

  return (
    // -mt-24 : annule le spacer laissé par la navbar flottante (Header.tsx) sur
    // les pages non-accueil, pour que le fond blanc remonte jusqu'en haut de
    // la page, au lieu de laisser apparaître le gris du fond de l'app.
    <div className="min-h-screen -mt-24 bg-white pb-24 pt-32 sm:pt-36">
      <div className="container mx-auto max-w-6xl px-4">
        {/* ── En-tête (toujours visible) ── */}
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-ddb-950 sm:text-5xl lg:text-6xl">
              Actualités &amp; Médias
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ddb-950/60">
              Nos derniers articles de blog et reportages vidéo sur nos actions
              de terrain pour l'environnement au Gabon.
            </p>
          </motion.div>

          {/* Illustration décorative — petit collage photo animé */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative mx-auto hidden h-44 w-44 shrink-0 sm:block lg:h-52 lg:w-52"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-0 top-2 h-28 w-24 -rotate-6 overflow-hidden rounded-2xl shadow-xl ring-1 ring-ddb-950/5"
            >
              <img
                src="/images/image-action-1.jpg"
                alt=""
                className="h-full w-full object-cover"
              />
            </motion.div>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
              className="absolute bottom-2 right-0 h-32 w-28 rotate-6 overflow-hidden rounded-2xl shadow-xl ring-1 ring-ddb-950/5"
            >
              <img
                src="/images/image-presentation-3.jpg"
                alt=""
                className="h-full w-full object-cover"
              />
            </motion.div>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1.3 }}
              className="absolute -bottom-2 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-ddb-600 text-white shadow-lg"
            >
              <Play className="h-4 w-4 fill-current" />
            </motion.div>
          </motion.div>
        </div>

        {/* ── Contenu : grille d'actualités OU lecteur d'article, en place ── */}
        <AnimatePresence mode="wait">
          {activeArticle ? (
            <motion.div
              key="reader"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10"
            >
              <button
                onClick={() => setOpenId(null)}
                className="inline-flex items-center gap-2 text-sm font-bold text-ddb-950/60 transition-colors hover:text-ddb-950"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour aux actualités
              </button>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
                {/* Article */}
                <article className="min-w-0 rounded-3xl border border-ddb-950/10 bg-white p-6 sm:p-8">
                  <span className="font-heading text-xs font-bold uppercase tracking-widest text-ddb-600">
                    {activeArticle.category}
                  </span>
                  <h1 className="mt-3 font-heading text-2xl font-extrabold leading-tight text-ddb-950 sm:text-3xl lg:text-4xl">
                    {activeArticle.title}
                  </h1>
                  <p className="mt-3 text-sm text-ddb-950/50">
                    Par ONG DDB ·{' '}
                    {new Date(activeArticle.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    · {readMinutes(activeArticle.preview)} min de lecture
                  </p>

                  <div className="mt-6 overflow-hidden rounded-2xl">
                    <img
                      src={activeArticle.image}
                      alt={activeArticle.title}
                      className="max-h-[380px] w-full object-cover"
                    />
                  </div>

                  <div className="prose prose-neutral mt-8 max-w-none whitespace-pre-line text-base leading-relaxed text-ddb-950/80">
                    {activeArticle.preview}
                  </div>

                  {/* Partage */}
                  <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-ddb-950/10 pt-6">
                    <span className="text-sm font-semibold text-ddb-950/50">Partager :</span>
                    <button
                      onClick={() =>
                        window.open(
                          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
                          '_blank',
                          'width=600,height=400',
                        )
                      }
                      aria-label="Partager sur Facebook"
                      className="text-ddb-950/50 transition-colors hover:text-ddb-700"
                    >
                      <Facebook className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() =>
                        window.open(
                          `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(activeArticle.title)}`,
                          '_blank',
                          'width=600,height=400',
                        )
                      }
                      aria-label="Partager sur Twitter"
                      className="text-ddb-950/50 transition-colors hover:text-ddb-700"
                    >
                      <Twitter className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() =>
                        window.open(
                          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
                          '_blank',
                          'width=600,height=400',
                        )
                      }
                      aria-label="Partager sur LinkedIn"
                      className="text-ddb-950/50 transition-colors hover:text-ddb-700"
                    >
                      <Linkedin className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: activeArticle.title, url: shareUrl }).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(shareUrl);
                        }
                      }}
                      aria-label="Plus d'options de partage"
                      className="text-ddb-950/50 transition-colors hover:text-ddb-700"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                  </div>
                </article>

                {/* Autres actualités, en cartes, sur le côté */}
                <div className="rounded-3xl bg-ddb-50/60 p-4">
                  <h3 className="px-1 font-heading text-xs font-bold uppercase tracking-widest text-ddb-950/50">
                    Autres actualités
                  </h3>
                  <div className="mt-3 flex flex-col gap-2">
                    {otherArticles.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setOpenId(o.id)}
                        className="flex gap-3 rounded-xl bg-white p-2.5 text-left shadow-sm ring-1 ring-ddb-950/5 transition-shadow hover:shadow-md"
                      >
                        <img
                          src={o.image}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] text-ddb-950/40">
                            {new Date(o.date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-ddb-950">
                            {o.title}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              {/* ── Filtres ── */}
              <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(['Tous', 'Blog', 'Vidéo'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                        filterCategory === cat
                          ? 'border-ddb-600 text-ddb-700'
                          : 'border-ddb-950/10 text-ddb-950/50 hover:border-ddb-950/20'
                      }`}
                    >
                      {cat === 'Vidéo' && <Play className="h-3.5 w-3.5" />}
                      {cat === 'Blog' && <FileText className="h-3.5 w-3.5" />}
                      {cat === 'Tous' ? 'Tout' : cat}
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
              ) : filteredFeed.length === 0 ? (
                <div className="mt-16 rounded-3xl border border-ddb-950/10 bg-ddb-50 py-20 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white">
                    <Search className="h-6 w-6 text-ddb-950/30" />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-ddb-950">Aucun résultat</h3>
                  <p className="mt-1 text-sm text-ddb-950/50">
                    Essayez un autre mot-clé ou un autre filtre.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCategory('Tous');
                    }}
                    className="mt-5 font-heading text-sm font-bold text-ddb-700 hover:text-ddb-900"
                  >
                    Réinitialiser
                  </button>
                </div>
              ) : (
                <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-3">
                  {filteredFeed.map((item, index) => {
                    const blob = BLOB_COLORS[index % BLOB_COLORS.length];
                    const inner = (
                      <>
                        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                          {/* Pastille décorative qui dépasse du coin */}
                          <span
                            aria-hidden
                            className={`absolute -bottom-3 -left-3 z-0 h-16 w-16 rounded-full ${blob}`}
                          />
                          <img
                            src={item.image}
                            alt={item.title}
                            loading="lazy"
                            className="absolute inset-0 z-10 h-full w-full rounded-2xl object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-ddb-950 px-3 py-1 text-xs font-bold text-white">
                            {item.category === 'Vidéo' ? (
                              <Play className="h-3 w-3" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            {item.category}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-ddb-950/40">
                          <span>
                            {new Date(item.date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                          <span>·</span>
                          <span>{readMinutes(item.preview)} min de lecture</span>
                        </div>

                        <h3 className="mt-2 font-heading text-lg font-bold leading-snug text-ddb-950 line-clamp-2 group-hover:text-ddb-700">
                          {item.title}
                        </h3>

                        {item.preview.trim() && (
                          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ddb-950/60 line-clamp-3">
                            {item.preview}
                          </p>
                        )}

                        <span className="mt-3 inline-flex items-center gap-1.5 font-heading text-sm font-bold text-ddb-700">
                          {item.type === 'video' ? 'Regarder' : 'Lire'}
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </span>
                      </>
                    );

                    return (
                      <motion.div
                        key={`${item.type}-${item.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
                        className="group"
                      >
                        {item.type === 'video' ? (
                          <a href={item.link} target="_blank" rel="noopener noreferrer">
                            {inner}
                          </a>
                        ) : (
                          <button onClick={() => setOpenId(item.id)} className="block w-full text-left">
                            {inner}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NewsPage;
