import React from 'react';

const Hero: React.FC = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="home" className="hero-bg min-h-screen flex items-center text-white">
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          La préservation de l'environnement<br />par l'éducation au changement
        </h1>
        <p className="text-xl md:text-2xl mb-10 max-w-3xl mx-auto">
          ONG nationale créée en 2017 à Libreville, nous œuvrons pour l'éducation environnementale et la protection des écosystèmes au Gabon
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
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
        </div>
      </div>
    </section>
  );
};

export default Hero;