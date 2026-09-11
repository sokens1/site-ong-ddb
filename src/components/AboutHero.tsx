import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Quote } from 'lucide-react';

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// Disposition "puzzle" exacte du modèle : coin extérieur de chaque tuile
// arrondi, et une encoche circulaire (mordue via un masque) sur le bord
// qui fait face à sa voisine verticale -> silhouette pièces de puzzle,
// avec un vrai espace (gap) entre les 4 tuiles.
const PIECES = [
  { src: '/images/image-presentation-1.jpg', outer: 'rounded-tl-[2rem]', notch: '72% 100%', dur: 5, delay: 0 },
  { src: '/images/image-presentation-2.jpg', outer: 'rounded-tr-[2rem]', notch: '28% 100%', dur: 5.6, delay: 1.2 },
  { src: '/images/image-presentation-3.jpg', outer: 'rounded-bl-[2rem]', notch: '72% 0%', dur: 6.2, delay: 2.4 },
  { src: '/images/image-presentation-4.jpg', outer: 'rounded-br-[2rem]', notch: '28% 0%', dur: 5.3, delay: 0.6 },
];

const notchMask = (at: string) =>
  `radial-gradient(circle 32px at ${at}, transparent 31px, black 33px)`;

const AboutHero: React.FC = () => {
  return (
    // -mt-24 : annule le spacer laissé par la navbar flottante (Header.tsx) sur
    // les pages non-accueil, pour que le fond remonte jusqu'en haut de la
    // page, exactement comme le Hero de l'accueil.
    <section className="relative isolate -mt-24 overflow-hidden bg-gradient-to-br from-ddb-800 via-ddb-700 to-ddb-600 text-white">
      <div className="container mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-32 sm:pb-24 sm:pt-36 lg:grid-cols-2 lg:items-center lg:gap-10">
        {/* Texte */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="max-w-lg"
        >
          <motion.h1
            variants={item}
            className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Notre histoire
          </motion.h1>

          <motion.p variants={item} className="mt-5 text-lg text-white/70">
            Fondée le 23 septembre 2017 à Libreville, notre ONG a obtenu son
            récépissé officiel N°0059/MIATCLDCI/SG/DGELP/DFAC du 1er février
            2019. Depuis, nous n'avons cessé de grandir et d'étendre notre
            impact à travers le Gabon.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm"
          >
            <div className="flex items-start gap-3">
              <Quote className="h-6 w-6 shrink-0 text-ddb-300" />
              <p className="italic text-white/90">
                « La protection de notre environnement n'est pas une option,
                c'est une nécessité pour assurer le bien-être des générations
                futures. »
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-3">
              <p className="font-heading font-bold text-white">
                Franck Ondeno, Président
              </p>
              <img
                src="/images/image-president.JPG"
                alt="Franck Ondeno, Président"
                className="h-12 w-12 shrink-0 rounded-full border-2 border-white/30 object-cover object-top shadow-md"
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Puzzle de photos */}
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2" style={{ perspective: 1200 }}>
          {PIECES.map((p) => (
            <motion.div
              key={p.src}
              className={`aspect-square overflow-hidden shadow-xl shadow-ddb-950/20 ${p.outer}`}
              style={{
                WebkitMaskImage: notchMask(p.notch),
                maskImage: notchMask(p.notch),
              }}
              animate={{ rotateY: [0, 180, 360] }}
              transition={{
                duration: p.dur,
                delay: p.delay,
                repeat: Infinity,
                repeatDelay: 2.5,
                ease: 'easeInOut',
              }}
            >
              <img src={p.src} alt="" className="h-full w-full object-cover" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutHero;
