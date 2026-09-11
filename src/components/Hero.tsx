import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/* ── Animations ─────────────────────────────────────────────── */
const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/* Entrée "carte retournée" : flip 3D sur l'axe Y */
const frame: Variants = {
  hidden: { opacity: 0, rotateY: -100, y: 20 },
  visible: {
    opacity: 1,
    rotateY: 0,
    y: 0,
    transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ── Collage d'images ──────────────────────────────────────── */
const photos = [
  {
    src: '/images/image-presentation-2.jpg',
    alt: "Action de terrain pour l'environnement",
    pos: 'left-0 top-0 h-52 w-52 sm:h-64 sm:w-64 -rotate-3',
    delay: 0,
  },
  {
    src: '/images/image-action-1.jpg',
    alt: 'Éducation environnementale',
    pos: 'right-0 top-16 h-48 w-48 sm:h-60 sm:w-60 rotate-3',
    delay: 1.1,
  },
  {
    src: '/images/image-presentation-3.jpg',
    alt: 'Préservation des écosystèmes',
    pos: 'left-6 bottom-0 h-48 w-48 sm:h-60 sm:w-60 rotate-2',
    delay: 2,
  },
  {
    src: '/images/image-presentation-1.jpg',
    alt: 'Protection de la biodiversité au Gabon',
    pos: 'right-8 bottom-20 h-44 w-44 sm:h-56 sm:w-56 -rotate-2',
    delay: 2.8,
  },
];

/* Cases de la grille qui s'illuminent (positions alignées sur le pas de 48px) */
const gridCells = [
  { left: '8%', top: '20%', duration: 5, delay: 0 },
  { left: '24%', top: '64%', duration: 6.5, delay: 1.4 },
  { left: '52%', top: '32%', duration: 5.5, delay: 0.8 },
  { left: '70%', top: '72%', duration: 7, delay: 2.2 },
  { left: '86%', top: '40%', duration: 6, delay: 3 },
  { left: '40%', top: '84%', duration: 5.8, delay: 1.9 },
];

const Hero: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section
      id="home"
      className="relative isolate flex min-h-screen items-center overflow-hidden bg-gradient-to-br from-ddb-800 via-ddb-700 to-ddb-600 text-white"
    >
      {/* Halos décoratifs animés */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-ddb-400/30 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-ddb-950/40 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      {/* Grille subtile — dérive lente en diagonale + respiration */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        animate={{
          backgroundPosition: ['0px 0px', '48px 48px'],
          opacity: [0.05, 0.09, 0.05],
        }}
        transition={{
          backgroundPosition: { duration: 18, repeat: Infinity, ease: 'linear' },
          opacity: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
        }}
      />

      {/* Cases qui s'illuminent aléatoirement sur la grille */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {gridCells.map((cell, i) => (
          <motion.div
            key={i}
            className="absolute h-12 w-12 rounded-[3px] bg-white/70"
            style={{ left: cell.left, top: cell.top }}
            animate={{ opacity: [0, 0.18, 0], scale: [0.8, 1, 0.8] }}
            transition={{
              duration: cell.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: cell.delay,
            }}
          />
        ))}
      </div>

      <div className="container relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-4 pb-20 pt-28 lg:grid-cols-2 lg:gap-10 lg:pb-28 lg:pt-36">
        {/* ── Colonne texte ── */}
        <motion.div
          className="flex flex-col items-center text-center lg:items-start lg:text-left"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            variants={item}
            className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
          >
            <span className="whitespace-nowrap">La préservation de</span> l'environnement
            <br className="hidden sm:block" />
            <span className="text-ddb-200"> par l'éducation au changement</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-lg text-white/85 sm:text-xl"
          >
            Nous œuvrons pour l'éducation environnementale, la restauration des
            écosystèmes, la lutte contre les changements climatiques et la
            protection de la biodiversité au Gabon.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-9 flex flex-row flex-wrap justify-center gap-3 sm:gap-4 lg:justify-start"
          >
            <button
              onClick={() => navigate('/join')}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-heading text-sm font-bold text-ddb-700 shadow-lg shadow-ddb-950/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-ddb-950/30 sm:px-8 sm:py-3.5 sm:text-base"
            >
              Rejoignez-nous
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => navigate('/actions')}
              className="inline-flex items-center justify-center rounded-full border-2 border-white/40 px-6 py-3 font-heading text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/10 sm:px-8 sm:py-3.5 sm:text-base"
            >
              Découvrir nos actions
            </button>
          </motion.div>
        </motion.div>

        {/* ── Colonne collage ── */}
        <motion.div
          className="relative mx-auto h-[440px] w-full max-w-lg sm:h-[560px] lg:ml-8 lg:h-[620px] lg:max-w-none"
          style={{ perspective: 1200 }}
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {/* Formes flottantes */}
          <motion.div
            aria-hidden
            className="absolute left-[16%] top-0 h-16 w-16 rounded-2xl bg-ddb-300/40 backdrop-blur-sm"
            animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden
            className="absolute bottom-4 right-[12%] h-11 w-11 rounded-full bg-white/50"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
          />
          <motion.div
            aria-hidden
            className="absolute bottom-1/3 left-0 h-8 w-8 rounded-full border-2 border-white/50"
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
          />

          {/* Photos — entrée "carte retournée" (flip 3D) */}
          {photos.map((photo) => (
            <motion.div
              key={photo.src}
              variants={frame}
              style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              className={`absolute rounded-[1.75rem] bg-white p-2.5 shadow-2xl shadow-ddb-950/30 ${photo.pos}`}
            >
              <motion.img
                src={photo.src}
                alt={photo.alt}
                loading="eager"
                className="h-full w-full rounded-3xl object-cover"
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 5.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: photo.delay,
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Courbe de finition vers la section suivante (masquée en mobile) */}
      <div aria-hidden className="absolute inset-x-0 -bottom-px hidden leading-[0] sm:block">
        <svg
          viewBox="0 0 1440 120"
          className="block h-24 w-full"
          preserveAspectRatio="none"
        >
          <path
            fill="#f0fdf4"
            d="M0,64 C240,120 480,120 720,88 C960,56 1200,24 1440,72 L1440,120 L0,120 Z"
          />
        </svg>
      </div>
    </section>
  );
};

export default Hero;
