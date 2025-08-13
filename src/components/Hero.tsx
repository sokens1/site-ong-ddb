import React from 'react';
import { motion } from 'framer-motion';

const Hero: React.FC = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <section id="home" className="hero-bg min-h-screen flex items-center text-white">
      <motion.div
        className="container mx-auto px-4 py-20 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          className="text-4xl md:text-6xl font-bold mb-6"
          variants={itemVariants}
        >
          La préservation de l'environnement<br />par l'éducation au changement
        </motion.h1>
        <motion.p
          className="text-xl md:text-2xl mb-10 max-w-3xl mx-auto"
          variants={itemVariants}
        >
          ONG nationale créée en 2017 à Libreville, nous œuvrons pour l'éducation environnementale et la protection des écosystèmes au Gabon
        </motion.p>
        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-4"
          variants={itemVariants}
        >
          <button
            onClick={() => scrollToSection('join')}
            className="btn btn-primary btn-enhanced pulse-on-hover text-white font-bold py-3 px-8 rounded-full"
          >
            Rejoignez-nous
          </button>
          <button
            onClick={() => scrollToSection('actions')}
            className="btn btn-outline btn-enhanced bg-transparent hover:bg-white hover:text-green-800 text-white font-bold py-3 px-8 border-2 border-white rounded-full"
          >
            Nos actions
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;