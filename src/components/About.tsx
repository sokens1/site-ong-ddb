import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

// Animated Section Component
const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  );
};

const About: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const historyImages = [
    '/images/image-presentation-2.jpg',
    '/images/image-presentation-1.jpg',
    '/images/image-presentation-3.jpg',
    '/images/image-presentation-4.jpg'
  ];

  const prevSlide = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? historyImages.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const nextSlide = () => {
    const isLastSlide = currentIndex === historyImages.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
  }

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentIndex(prevIndex => 
        prevIndex === historyImages.length - 1 ? 0 : prevIndex + 1
      );
    }, 3000); // Change slide every 3 seconds

    return () => clearInterval(slideInterval); // Cleanup interval on component unmount
  }, [historyImages.length]);

  const missions = [
    {
      icon: 'fas fa-school',
      title: 'Éducation environnementale',
      description: 'Sensibilisation dans les écoles et création de clubs verts pour former les jeunes générations.'
    },
    {
      icon: 'fas fa-recycle',
      title: 'Vulgarisation écoresponsable',
      description: 'Promotion des bonnes pratiques environnementales auprès du grand public et des entreprises.'
    },
    {
      icon: 'fas fa-leaf',
      title: 'Événements écoresponsables',
      description: 'Accompagnement des organisateurs pour réduire l\'impact environnemental de leurs événements.'
    },
    {
      icon: 'fas fa-briefcase',
      title: 'Métiers durables',
      description: 'Promotion des métiers liés au développement durable et formation professionnelle.'
    },
    {
      icon: 'fas fa-tree',
      title: 'Protection des écosystèmes',
      description: 'Lutte contre la dégradation des forêts, mangroves et zones côtières gabonaises.'
    },
    {
      icon: 'fas fa-tint',
      title: 'Gestion des ressources',
      description: 'Promotion d\'une gestion durable des ressources naturelles (eau, forêt, pêche).'
    }
  ];

  const partners = [
    { type: 'image', value: '/images/logo-unicef.png', alt: 'UNICEF Logo' },
    { type: 'image', value: '/images/logo-pnud.png', alt: 'PNUDLogo' },
    { type: 'image', value: '/images/logo-WWF.png', alt: 'WWF Logo' },
    { type: 'image', value: '/images/logo-fondation-lekedi.png', alt: 'Fondation Lekedi Logo' },
    
  ];

  return (
    <section id="about" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-green-800 mb-4">
            L'ONG Développement Durable et Bien-Être
          </motion.h2>
          <motion.div variants={itemVariants} className="w-24 h-1 bg-green-600 mx-auto"></motion.div>
        </AnimatedSection>

        <div className="flex flex-col lg:flex-row gap-12 mb-20">
          <AnimatedSection className="lg:w-1/2">
            <motion.h3 variants={itemVariants} className="text-2xl font-bold text-green-800 mb-6">Notre histoire</motion.h3>
            <motion.p variants={itemVariants} className="text-gray-700 mb-6">
              Fondée le 23 septembre 2017 à Libreville, notre ONG a obtenu son récépissé officiel N°0059/MIATCLDCI/SG/DGELP/DFAC du 1er février 2019. Depuis, nous n'avons cessé de grandir et d'étendre notre impact à travers le Gabon.
            </motion.p>
            <motion.div variants={itemVariants} className="bg-gray-100 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-800 mr-4">
                  <i className="fas fa-quote-left"></i>
                </div>
                <p className="italic text-gray-700">
                  "La protection de notre environnement n'est pas une option, c'est une nécessité pour assurer le bien-être des générations futures."
                </p>
              </div>
              <p className="text-right font-bold text-green-800">Franck Ondeno, Président</p>
            </motion.div>
          </AnimatedSection>
          
            
          <motion.div variants={itemVariants} className="lg:w-1/2 relative group">
            <div style={{ backgroundImage: `url(${historyImages[currentIndex]})` }} className='w-full h-[400px] rounded-2xl bg-center bg-cover duration-500'></div>
            {/* Left Arrow */}
            <div className='hidden group-hover:block absolute top-[50%] -translate-x-0 translate-y-[-50%] left-5 text-2xl rounded-full p-2 bg-black/20 text-white cursor-pointer'>
              <i className='fas fa-chevron-left' onClick={prevSlide}></i>
            </div>
            {/* Right Arrow */}
            <div className='hidden group-hover:block absolute top-[50%] -translate-x-0 translate-y-[-50%] right-5 text-2xl rounded-full p-2 bg-black/20 text-white cursor-pointer'>
              <i className='fas fa-chevron-right' onClick={nextSlide}></i>
            </div>
            <div className='flex top-4 justify-center py-2'>
              {historyImages.map((_, slideIndex) => (
                <div key={slideIndex} onClick={() => goToSlide(slideIndex)} className='text-2xl cursor-pointer'>
                  <i className={`fas fa-circle mx-1 ${currentIndex === slideIndex ? 'text-green-600' : 'text-gray-300'}`} style={{fontSize: '12px'}}></i>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <AnimatedSection className="mb-20">
          <motion.h3 variants={itemVariants} className="text-2xl font-bold text-green-800 mb-8 text-center">Nos missions</motion.h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {missions.map((mission, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="mission-card bg-white p-6 rounded-lg shadow-md border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-green-200"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-800 mb-4 transition-all duration-300 hover:bg-green-200 hover:scale-110">
                  <i className={`${mission.icon} text-2xl`}></i>
                </div>
                <h4 className="text-xl font-bold text-green-800 mb-2">{mission.title}</h4>
                <p className="text-gray-700">{mission.description}</p>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection className="text-center">
          <motion.h3 variants={itemVariants} className="text-2xl font-bold text-green-800 mb-8">Nos partenaires</motion.h3>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {partners.map((partner, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center p-4 transition-all duration-300 hover:bg-green-50 hover:shadow-lg hover:scale-105"
              >
                {partner.type === 'image' ? (
                  <img src={partner.value} alt={partner.alt} className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="font-bold text-gray-700 text-center text-sm">{partner.value}</span>
                )}
              </motion.div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default About;