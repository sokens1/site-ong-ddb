import React, { useEffect, useState } from 'react';
import { fetchActions } from '../data/actions';

interface Action {
  id: number;
  title: string;
  description: string;
  image: string;
  category: string;
  date: string;
}

const CoreActions: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('Toutes');
  const [actionsData, setActionsData] = useState<Action[]>([]);

  useEffect(() => {
    const getActions = async () => {
      const data = await fetchActions();
      setActionsData(data);
    };
    getActions();
  }, []);

  const filters = ['Toutes', '2024', '2023', '2022', '2021'];

  const filteredActions = activeFilter === 'Toutes'
    ? actionsData
    : actionsData.filter((action: Action) => action.date.includes(activeFilter));

  return (
    <>
      <div className="flex flex-wrap justify-center gap-4 mb-12">
        {filters.map((filter: string) => (
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
        {filteredActions.map((action: Action, index: React.Key | null | undefined) => (
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

      {/* <div className="bg-white p-8 rounded-lg shadow-md">
        <h3 className="text-2xl font-bold text-green-800 mb-6">Projets en cours</h3>
        {[ 
          { name: 'Programme "École Verte"', progress: 65 },
          { name: 'Formation des pêcheurs durables', progress: 40 },
          { name: 'Centre de recyclage communautaire', progress: 25 }
        ].map((project, index) => (
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
      </div> */}
    </>
  );
};

export default CoreActions;
