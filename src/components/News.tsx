import React, { useEffect, useRef, useState } from 'react';

const News: React.FC = () => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [scrollAmount, setScrollAmount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const news = [
    {
      category: 'Événement',
      date: '10 mai 2023',
      title: 'Journée mondiale de l\'environnement 2023',
      description: 'Retour sur notre participation à cette journée internationale avec des ateliers et conférences.',
      image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    },
    {
      category: 'Nouveau projet',
      date: '28 avril 2023',
      title: 'Lancement du programme "Familles Durables"',
      description: 'Un nouveau programme pour aider les familles à adopter des pratiques écoresponsables au quotidien.',
      image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    },
    {
      category: 'Partenariat',
      date: '15 avril 2023',
      title: 'Nouveau partenariat avec le Ministère de l\'Éducation',
      description: 'Signature d\'une convention pour intégrer l\'éducation environnementale dans le programme scolaire.',
      image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    }
  ];

  const team = [
    {
      name: 'Franck Ondeno',
      position: 'Président',
      description: 'Fondateur de l\'ONG, expert en développement durable',
      image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    },
    {
      name: 'Marie Ntoutoume',
      position: 'Vice-présidente',
      description: 'Spécialiste en éducation environnementale',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    },
    {
      name: 'Jean Mba',
      position: 'Trésorier',
      description: 'Expert en gestion de projets',
      image: 'https://images.unsplash.com/photo-1562788869-4ed32648eb72?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    },
    {
      name: 'Sarah Bongo',
      position: 'Secrétaire générale',
      description: 'Coordinatrice des programmes',
      image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    }
  ];

  useEffect(() => {
    if (!isHovered && sliderRef.current) {
      const interval = setInterval(() => {
        const scrollStep = 264; // Width of card + gap
        const sliderWidth = sliderRef.current!.scrollWidth - sliderRef.current!.clientWidth;
        
        setScrollAmount(prev => {
          const newAmount = prev + scrollStep;
          if (newAmount > sliderWidth) {
            sliderRef.current!.scrollTo({ left: 0, behavior: 'instant' });
            return 0;
          } else {
            sliderRef.current!.scrollTo({ left: newAmount, behavior: 'smooth' });
            return newAmount;
          }
        });
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isHovered]);

  return (
    <section id="news" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Actualités</h2>
          <div className="w-24 h-1 bg-green-600 mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {news.map((article, index) => (
            <div key={index} className="bg-white rounded-lg overflow-hidden shadow-md">
              <div className="h-48 overflow-hidden">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <div className="text-green-600 font-bold mb-2">
                  {article.category} • {article.date}
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-3">{article.title}</h3>
                <p className="text-gray-700 mb-4">{article.description}</p>
                <div className="flex justify-between items-center">
                  <a href="#" className="text-green-600 font-medium hover:text-green-800">
                    Lire l'article →
                  </a>
                  <div className="flex space-x-2">
                    <a href="#" className="text-gray-500 hover:text-green-600">
                      <i className="fab fa-facebook-f"></i>
                    </a>
                    <a href="#" className="text-gray-500 hover:text-green-600">
                      <i className="fab fa-twitter"></i>
                    </a>
                    <a href="#" className="text-gray-500 hover:text-green-600">
                      <i className="fas fa-share"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Notre bureau directeur</h2>
          <div className="w-24 h-1 bg-green-600 mx-auto mb-8"></div>
          <div className="relative max-w-4xl mx-auto group">
            <button
              onClick={() => {
                const slider = sliderRef.current;
                if (slider) {
                  const scrollStep = 264;
                  const newScrollLeft = Math.max(0, slider.scrollLeft - scrollStep);
                  slider.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
                  setScrollAmount(newScrollLeft);
                }
              }}
              className="nav-arrow left opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              aria-label="Précédent"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <button
              onClick={() => {
                const slider = sliderRef.current;
                if (slider) {
                  const scrollStep = 264;
                  const maxScroll = slider.scrollWidth - slider.clientWidth;
                  const newScrollLeft = Math.min(maxScroll, slider.scrollLeft + scrollStep);
                  slider.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
                  setScrollAmount(newScrollLeft);
                }
              }}
              className="nav-arrow right opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              aria-label="Suivant"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
            <div
              ref={sliderRef}
              className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 scrollbar-hide transition-all duration-300"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {team.map((member, index) => (
                <div key={index} className="flex-shrink-0 snap-start w-64 bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-300 hover:transform hover:scale-105">
                  <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gray-200 overflow-hidden">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-green-800 text-center">{member.name}</h3>
                  <p className="text-green-600 font-medium text-center mb-2">{member.position}</p>
                  <p className="text-gray-700 text-sm text-center">{member.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default News;