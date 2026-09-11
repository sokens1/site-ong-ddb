import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  GraduationCap,
  Sprout,
  PawPrint,
  CloudSun,
  Recycle,
  Wheat,
  Droplets,
  Megaphone,
} from 'lucide-react';

type Mission = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

const missions: Mission[] = [
  {
    icon: <GraduationCap className="h-6 w-6" />,
    title: 'Éducation environnementale',
    description:
      'Sensibiliser et former les citoyens, en particulier les jeunes, aux enjeux écologiques.',
  },
  {
    icon: <Sprout className="h-6 w-6" />,
    title: 'Restauration des écosystèmes',
    description:
      'Reboiser et réhabiliter les milieux naturels dégradés à travers le pays.',
  },
  {
    icon: <PawPrint className="h-6 w-6" />,
    title: 'Protection de la biodiversité',
    description:
      "Préserver la faune et la flore endémiques du Gabon et leurs habitats.",
  },
  {
    icon: <CloudSun className="h-6 w-6" />,
    title: 'Lutte contre le changement climatique',
    description:
      'Réduire les émissions et promouvoir des solutions bas-carbone et résilientes.',
  },
  {
    icon: <Recycle className="h-6 w-6" />,
    title: 'Gestion des déchets',
    description:
      'Promouvoir le tri, le recyclage et la réduction des déchets plastiques.',
  },
  {
    icon: <Wheat className="h-6 w-6" />,
    title: 'Agriculture durable',
    description:
      "Accompagner des pratiques agricoles respectueuses des sols et de l'eau.",
  },
  {
    icon: <Droplets className="h-6 w-6" />,
    title: 'Eau et assainissement',
    description:
      'Améliorer l\'accès à une eau saine et à l\'assainissement dans les communautés.',
  },
  {
    icon: <Megaphone className="h-6 w-6" />,
    title: 'Plaidoyer et partenariats',
    description:
      'Mobiliser institutions, entreprises et société civile autour du développement durable.',
  },
];

const MissionCard: React.FC<Mission & { index: number }> = ({
  icon,
  title,
  description,
  index,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col bg-white px-4 py-6 sm:px-8 sm:py-10"
    >
      {/* Bloc vert qui glisse d'une carte à l'autre au survol */}
      <AnimatePresence>
        {hovered && (
          <motion.span
            layoutId="mission-hover-block"
            className="absolute inset-0 block bg-ddb-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.15 } }}
          />
        )}
      </AnimatePresence>

      {/* Barre d'accent à gauche */}
      <span className="absolute left-0 top-6 h-6 w-1 rounded-r bg-ddb-300 transition-all duration-300 group-hover:h-11 group-hover:bg-white sm:top-10" />

      <div className="relative z-10">
        <div className="mb-4 text-ddb-600 transition-colors duration-300 group-hover:text-white">
          {icon}
        </div>
        <h3 className="font-heading text-lg font-bold tracking-tight text-ddb-900 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ddb-950/60 transition-colors duration-300 group-hover:text-white/85">
          {description}
        </p>
      </div>
    </motion.div>
  );
};

const Missions: React.FC = () => {
  return (
    <section id="missions" className="bg-ddb-50 py-20 sm:py-24">
      <div className="container mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <h2 className="font-heading text-4xl font-extrabold tracking-tight text-ddb-950 sm:text-5xl lg:text-6xl">
            Nos missions
          </h2>
          <p className="mt-4 text-ddb-950/60">
            Huit axes d'action pour préserver l'environnement au Gabon par
            l'éducation au changement.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-ddb-100 ring-1 ring-ddb-100 lg:grid-cols-4">
          {missions.map((mission, index) => (
            <MissionCard key={mission.title} index={index} {...mission} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Missions;
