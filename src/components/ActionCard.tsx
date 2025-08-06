import React from 'react';

interface Action {
  id: number;
  title: string;
  description: string;
  image: string;
}

interface ActionCardProps {
  action: Action;
}

const ActionCard: React.FC<ActionCardProps> = ({ action }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <img src={action.image} alt={action.title} className="w-full h-48 object-cover" />
      <div className="p-6">
        <h3 className="text-xl font-bold mb-2">{action.title}</h3>
        <p className="text-gray-700 mb-4">{action.description}</p>
        <a href="#" className="text-blue-600 hover:underline">En savoir plus</a>
      </div>
    </div>
  );
};

export default ActionCard;
