import React from 'react';
import { Link } from 'react-router-dom';

const QuickActions: React.FC = () => {
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
      title: 'Nos Actions et Rapports',
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

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        
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
      </div>
    </section>
  );
};

export default QuickActions;
