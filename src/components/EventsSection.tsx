import React, { useEffect, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EventItem {
  id: number;
  title: string;
  event_date: string;
  image_url: string | null;
  slug?: string;
}

const FALLBACK = [
  '/images/image-action-1.jpg',
  '/images/image-presentation-2.jpg',
  '/images/image-presentation-3.jpg',
];

// Pile de 3 cartes qui se mélangent : chaque carte passe tour à tour
// devant → milieu → derrière, en boucle.
const STACK = [
  { x: 0, y: 0, rotate: -6, scale: 1, zIndex: 30 }, // devant
  { x: 110, y: 34, rotate: 8, scale: 0.9, zIndex: 20 }, // milieu
  { x: -100, y: 58, rotate: -12, scale: 0.82, zIndex: 10 }, // derrière
];

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const EventsSection: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [front, setFront] = useState(0);
  const [compact, setCompact] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );

  // Écartement réduit sur petit écran pour éviter le rognage
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mélange en boucle : on avance la carte de devant toutes les 2,6 s
  useEffect(() => {
    const t = setInterval(() => setFront((f) => (f + 1) % 3), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, event_date, image_url, slug')
          .eq('status', 'published')
          .order('event_date', { ascending: false })
          .limit(3);
        if (!error && data) setEvents(data as EventItem[]);
      } catch (err) {
        console.error('Error fetching events:', err);
      }
    })();
  }, []);

  const cards = [0, 1, 2].map((i) => {
    const ev = events[i];
    return {
      img: ev?.image_url || FALLBACK[i],
      title: ev?.title,
      date: ev?.event_date,
      go: () => navigate(ev ? `/events/${ev.slug || ev.id}` : '/events'),
    };
  });

  return (
    <section
      id="evenements"
      className="relative isolate overflow-hidden bg-ddb-50 text-ddb-950"
    >
      {/* Grille de fond */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(22,163,74,0.12) 1px, transparent 1px), linear-gradient(to right, rgba(22,163,74,0.12) 1px, transparent 1px)',
          backgroundSize: '3rem 3rem',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ddb-50 via-ddb-50/50 to-ddb-50"
      />

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="relative container mx-auto flex min-h-[70vh] max-w-6xl flex-col items-center gap-14 px-4 py-20 sm:py-24 lg:flex-row lg:justify-between lg:gap-10"
      >
        {/* Texte */}
        <div className="flex max-w-xl flex-col items-center text-center lg:items-start lg:text-left">
          <motion.h2
            variants={item}
            className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Prêt à agir avec nous
            <span className="text-ddb-600"> sur le terrain ?</span>
          </motion.h2>

          <motion.p variants={item} className="mt-6 max-w-md text-lg text-ddb-950/60">
            Rejoignez nos ateliers, reboisements et campagnes de sensibilisation
            organisés partout au Gabon.
          </motion.p>

          <motion.div variants={item} className="mt-8">
            <button
              onClick={() => navigate('/events')}
              className="group inline-flex items-center gap-2 rounded-full bg-ddb-700 px-8 py-3.5 font-heading font-bold text-white shadow-lg shadow-ddb-950/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ddb-800"
            >
              Voir tous les événements
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>

        {/* Pile de 3 cartes qui se mélangent en boucle */}
        <motion.div
          variants={item}
          className="relative flex h-80 w-full max-w-xl items-center justify-center sm:h-[26rem] lg:h-[30rem] lg:w-1/2"
        >
          {cards.map((card, i) => {
            const slot = (i - front + cards.length) % cards.length;
            const s = STACK[slot];
            const spread = compact ? 0.6 : 1;
            return (
              <motion.button
                key={i}
                onClick={card.go}
                aria-label={card.title || 'Voir les événements'}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  x: s.x * spread,
                  y: s.y * spread,
                  rotate: s.rotate,
                  scale: s.scale,
                  zIndex: s.zIndex,
                }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ scale: s.scale + 0.04 }}
                className="absolute h-60 w-48 overflow-hidden rounded-2xl shadow-2xl shadow-ddb-950/25 ring-1 ring-black/5 sm:h-[22rem] sm:w-64"
              >
                <img
                  src={card.img}
                  alt={card.title || 'Événement'}
                  className="h-full w-full object-cover"
                />
                {card.date && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-left sm:p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ddb-200">
                      {new Date(card.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
};

export default EventsSection;
