import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// Hook pour détecter mobile
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

const QuickActions: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const actions = [
    {
      id: 'foundation',
      title: 'À propos',
      image: '/images/image-presentation-1.jpg',
      link: '/about',
      description: 'Découvrez notre histoire et notre mission'
    },
    {
      id: 'missions',
      title: 'Nos Actions',
      image: '/images/image-presentation-2.jpg',
      link: '/actions',
      description: 'Nos actions pour l\'environnement'
    },
    {
      id: 'park',
      title: 'Actualités',
      image: '/images/image-presentation-3.jpg',
      link: '/actions',
      description: 'Nos projets de conservation'
    },
    {
      id: 'visits',
      title: 'Nous rejoindre',
      image: '/images/image-presentation-4.jpg',
      link: '/join',
      description: 'Rejoignez nos activités'
    }
  ];

  // Auto-scroll pour mobile
  useEffect(() => {
    const startAutoScroll = () => {
      if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = setInterval(() => {
        setActiveIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % actions.length;
          const container = scrollRef.current;
          if (container?.children[nextIndex]) {
            const card = container.children[nextIndex] as HTMLElement;
            container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
          }
          return nextIndex;
        });
      }, 5000);
    };

    if (isMobile && actions.length > 0) {
      startAutoScroll();
    } else {
      if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
    }

    return () => {
      if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
    };
  }, [isMobile, actions.length]);

  // Gestion du scroll
  useEffect(() => {
    const container = scrollRef.current;
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      if (!container) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollLeft = container.scrollLeft;
        const cardWidth = container.children[0]?.clientWidth || 0;
        const gap = 16; // gap-4
        const newIndex = Math.round(scrollLeft / (cardWidth + gap));
        if (newIndex !== activeIndex) setActiveIndex(newIndex);
      }, 150);
    };
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [activeIndex]);

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        
        {/* Version Desktop - Grille */}
        {!isMobile && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {actions.map((action) => (
              <Link
                key={action.id}
                to={action.link}
                className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className="aspect-[4/3] relative">
                  <img
                    src={action.image}
                    alt={action.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-30 transition-all duration-300" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white text-xl font-bold mb-2">
                      {action.title}
                    </h3>
                    <p className="text-white text-sm opacity-90">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Version Mobile - Défilement horizontal */}
        {isMobile && (
          <div className="relative">
            <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
              {actions.map((action, index) => (
                <Link
                  key={action.id}
                  to={action.link}
                  className="flex-shrink-0 snap-start w-80 group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <div className="aspect-[4/3] relative">
                    <img
                      src={action.image}
                      alt={action.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-30 transition-all duration-300" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-white text-lg font-bold mb-2">
                        {action.title}
                      </h3>
                      <p className="text-white text-sm opacity-90">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {/* Indicateurs de pagination pour mobile */}
            <div className="flex justify-center gap-2 mt-4">
              {actions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setActiveIndex(index);
                    const container = scrollRef.current;
                    if (container?.children[index]) {
                      const card = container.children[index] as HTMLElement;
                      container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
                    }
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${activeIndex === index ? 'bg-green-600' : 'bg-gray-300'}`}
                  aria-label={`Aller à l'action ${index + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default QuickActions;
