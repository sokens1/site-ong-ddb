import React, { useState, useEffect } from 'react';

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
    { type: 'image', value: '/images/logo-WWF.png', alt: 'WWF Logo' },
    { type: 'image', value: '/images/logo-fondation-lekedi.png', alt: 'Fondation Lekedi Logo' },
    { type: 'text', value: 'Mairie de Libreville' }
  ];

  return (
    <section id="about" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">
            L'ONG Développement Durable et Bien-Être
          </h2>
          <div className="w-24 h-1 bg-green-600 mx-auto"></div>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 mb-20">
          <div className="lg:w-1/2">
            <h3 className="text-2xl font-bold text-green-800 mb-6">Notre histoire</h3>
            <p className="text-gray-700 mb-6">
              Fondée le 23 septembre 2017 à Libreville, notre ONG a obtenu son récépissé officiel N°0059/MIATCLDCI/SG/DGELP/DFAC du 1er février 2019. Depuis, nous n'avons cessé de grandir et d'étendre notre impact à travers le Gabon.
            </p>
            <div className="bg-gray-100 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-800 mr-4">
                  <i className="fas fa-quote-left"></i>
                </div>
                <p className="italic text-gray-700">
                  "La protection de notre environnement n'est pas une option, c'est une nécessité pour assurer le bien-être des générations futures."
                </p>
              </div>
              <p className="text-right font-bold text-green-800">Franck Ondeno, Président</p>
            </div>
          </div>
          <div className="lg:w-1/2 relative group">
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
          </div>
        </div>

        <div className="mb-20">
          <h3 className="text-2xl font-bold text-green-800 mb-8 text-center">Nos missions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {missions.map((mission, index) => (
              <div
                key={index}
                className="mission-card bg-white p-6 rounded-lg shadow-md border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-green-200"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-800 mb-4 transition-all duration-300 hover:bg-green-200 hover:scale-110">
                  <i className={`${mission.icon} text-2xl`}></i>
                </div>
                <h4 className="text-xl font-bold text-green-800 mb-2">{mission.title}</h4>
                <p className="text-gray-700">{mission.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-bold text-green-800 mb-8">Nos partenaires</h3>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {partners.map((partner, index) => (
              <div
                key={index}
                className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center p-4 transition-all duration-300 hover:bg-green-50 hover:shadow-lg hover:scale-105"
              >
                {partner.type === 'image' ? (
                  <img src={partner.value} alt={partner.alt} className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="font-bold text-gray-700 text-center text-sm">{partner.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;