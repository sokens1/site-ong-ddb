import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import EditableText from './site-content/EditableText';

interface FeedItem {
  type: 'news' | 'video';
  id: number;
  title: string;
  image: string;
  category: string;
  date: string;
  description: string;
  content: string;
  link: string;
}

const News: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [index, setIndex] = useState(0);
  const [modalItem, setModalItem] = useState<FeedItem | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const now = new Date().toISOString().split('T')[0];

        const { data: newsData } = await supabase
          .from('news')
          .select('id, title, image, date, description, content, status')
          .eq('status', 'published')
          .lte('date', now)
          .order('date', { ascending: false })
          .limit(3);

        const { data: videosData } = await supabase
          .from('videos')
          .select('id, title, thumbnailpath, date, description, videourl, filepath')
          .lte('date', now)
          .order('date', { ascending: false })
          .limit(3);

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
              content: n.content ?? '',
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
              content: '',
              link: v.videourl || v.filepath || '',
            })),
          );
        }

        merged.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setItems(merged.slice(0, 3));
      } catch (err) {
        console.error('Unexpected error fetching feed:', err);
        setItems([]);
      }
    };

    fetchNews();
  }, []);

  // Défilement automatique linéaire
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      5000,
    );
    return () => clearInterval(t);
  }, [items.length, index]);

  const openItem = (item: FeedItem) => {
    if (item.type === 'video') {
      if (item.link) window.open(item.link, '_blank', 'noopener,noreferrer');
      return;
    }
    // Mobile : ouverture en modal ; desktop : page complète
    if (isMobile) {
      setModalItem(item);
    } else {
      navigate(item.link);
    }
  };

  // Verrouille le scroll de la page quand la modal est ouverte + fermeture via Échap
  useEffect(() => {
    if (!modalItem) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [modalItem]);

  if (items.length === 0) return null;

  return (
    <section id="news" className="bg-ddb-900 py-20 sm:py-24">
      <div className="container mx-auto max-w-6xl px-4">
        {/* En-tête — aligné à gauche */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10 max-w-xl"
        >
          <EditableText
            as="h2"
            k="news_home.heading"
            fallback="Actualités"
            multiline={false}
            className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
          />
          <EditableText
            as="p"
            k="news_home.subheading"
            fallback="Nos derniers articles et reportages vidéo sur nos actions pour l'environnement au Gabon."
            className="mt-3 text-white/70"
          />
        </motion.div>

        {/* Carrousel plein cadre */}
        <div className="overflow-hidden rounded-3xl shadow-2xl shadow-black/30 ring-1 ring-white/10">
          <motion.div
            className="flex"
            animate={{ x: `-${index * 100}%` }}
            transition={{ duration: 0.9, ease: 'linear' }}
          >
            {items.map((item) => (
              <article
                key={`${item.type}-${item.id}`}
                className="grid w-full shrink-0 grid-cols-2"
              >
                {/* Image */}
                <div className="relative h-full min-h-[240px] w-full sm:min-h-[288px] md:min-h-[440px]">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>

                {/* Panneau clair */}
                <div className="flex min-w-0 flex-col justify-center bg-white p-4 text-ddb-950 sm:p-10 md:p-12">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="rounded-full bg-ddb-100 px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-widest text-ddb-700 sm:px-3 sm:text-xs">
                      {item.category}
                    </span>
                    {item.date && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-ddb-950/40 sm:text-xs">
                        le{' '}
                        {new Date(item.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-heading text-base font-extrabold leading-tight tracking-tight sm:mt-5 sm:text-3xl md:text-4xl">
                    {item.title}
                  </h3>

                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ddb-950/60 sm:mt-4 sm:line-clamp-3 sm:text-base">
                    {item.description}
                  </p>

                  <div className="mt-4 flex flex-row gap-2 sm:mt-8 sm:w-auto sm:gap-3">
                    <button
                      onClick={() => openItem(item)}
                      className="group inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-ddb-700 px-2 py-2 text-center font-heading text-[11px] font-bold leading-tight text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-ddb-800 sm:flex-none sm:px-6 sm:py-3 sm:text-sm"
                    >
                      <EditableText k="news_home.cta_primary" fallback="Lire ce blog" as="span" multiline={false} />
                      <ArrowRight className="hidden h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 sm:block" />
                    </button>
                    <button
                      onClick={() => navigate('/news')}
                      className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-full border-2 border-ddb-200 px-2 py-2 text-center font-heading text-[11px] font-bold leading-tight text-ddb-700 transition-colors duration-300 hover:border-ddb-400 hover:bg-ddb-50 sm:flex-none sm:px-6 sm:py-3 sm:text-sm"
                    >
                      <EditableText k="news_home.cta_secondary" fallback="Voir d'autres" as="span" multiline={false} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </motion.div>
        </div>

        {/* Puces de progression */}
        {items.length > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Actualité ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/25'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal article (mobile) */}
      <AnimatePresence>
        {modalItem && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalItem(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={modalItem.title}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 60, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.98 }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.12 }}
              className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white text-ddb-950 sm:max-h-[88vh] sm:rounded-3xl"
            >
              <button
                onClick={() => setModalItem(null)}
                aria-label="Fermer"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="h-52 w-full shrink-0">
                <img
                  src={modalItem.image}
                  alt={modalItem.title}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ddb-100 px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-widest text-ddb-700">
                    {modalItem.category}
                  </span>
                  {modalItem.date && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-ddb-950/40">
                      le{' '}
                      {new Date(modalItem.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 font-heading text-2xl font-extrabold leading-tight tracking-tight">
                  {modalItem.title}
                </h3>

                {modalItem.description && (
                  <p className="mt-3 font-medium text-ddb-950/80">
                    {modalItem.description}
                  </p>
                )}

                {modalItem.content && (
                  <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ddb-950/70">
                    {modalItem.content}
                  </div>
                )}

                <button
                  onClick={() => {
                    const link = modalItem.link;
                    setModalItem(null);
                    navigate(link);
                  }}
                  className="group mt-6 inline-flex items-center gap-1.5 font-heading text-sm font-bold text-ddb-700"
                >
                  Ouvrir la page complète
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default News;
