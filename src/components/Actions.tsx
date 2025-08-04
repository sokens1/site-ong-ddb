import React, { useState } from 'react';

const Actions: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('Toutes');

  const filters = ['Toutes', 'Éducation', 'Restauration', 'Nettoyage'];

  const actions = [
    {
      category: 'Restauration',
      date: '23 mars 2025',
      title: 'Reboisement de la Mangrove d\'ANGONDJE NTOM',
      description: 'Opération de reboisement pour restaurer l\'écosystème vital de la mangrove à Angondje Ntom.',
      image: '/images/image-action-1.jpg'
    },
    {
      category: 'Nettoyage',
      date: '22 avril 2023',
      title: 'Opération plage propre à Pointe-Denis',
      description: '150 bénévoles ont collecté 2 tonnes de déchets sur la plage avec tri sélectif des matériaux.',
      image: 'https://images.unsplash.com/photo-1584473457409-ceb4e5b1c0e2?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    },
    {
      category: 'Restauration',
      date: '5 juin 2023',
      title: 'Plantation de mangroves à Gamba',
      description: 'Restaurer 5 hectares de mangrove avec la participation des communautés locales de pêcheurs.',
      image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    }
  ];

  const projects = [
    { name: 'Programme "École Verte"', progress: 65 },
    { name: 'Formation des pêcheurs durables', progress: 40 },
    { name: 'Centre de recyclage communautaire', progress: 25 }
  ];

  const filteredActions = activeFilter === 'Toutes' 
    ? actions 
    : actions.filter(action => action.category === activeFilter);

  return (
    <section id="actions" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Nos actions</h2>
          <div className="w-24 h-1 bg-green-600 mx-auto"></div>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`btn btn-enhanced px-6 py-2 rounded-full transition-all duration-300 ${
                activeFilter === filter
                  ? 'bg-green-800 hover:bg-green-700 text-white'
                  : 'btn-outline bg-white hover:bg-green-50 text-green-800 border border-green-800'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {filteredActions.map((action, index) => (
            <div key={index} className="action-card bg-white rounded-lg overflow-hidden shadow-md relative">
              <div className="h-48 overflow-hidden">
                <img
                  src={action.image}
                  alt={action.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <div className="text-green-600 font-bold mb-2">
                  {action.category} • {action.date}
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-3">{action.title}</h3>
                <p className="text-gray-700 mb-4">{action.description}</p>
                <a href="#" className="text-green-600 font-medium hover:text-green-800">
                  En savoir plus →
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold text-green-800 mb-6">Projets en cours</h3>
          {projects.map((project, index) => (
            <div key={index} className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="font-medium">{project.name}</span>
                <span>{project.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-green-600 h-2.5 rounded-full"
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
            </div>
          ))}
          <div className="text-center mt-8">
            <a href="#" className="btn btn-primary btn-enhanced pulse-on-hover text-white font-bold py-3 px-8 rounded-full">
              Soutenir nos projets
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Actions;