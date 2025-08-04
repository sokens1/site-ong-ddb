import React from 'react';

const Stats: React.FC = () => {
  const stats = [
    { number: '100+', label: 'Clubs verts créés' },
    { number: '200K+', label: 'Élèves sensibilisés' },
    { number: '30', label: 'Pêcheurs formés' },
    { number: '3', label: 'Axe d\'action principaux' }
  ];

  return (
    <section className="py-16 bg-green-800 text-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((stat, index) => (
            <div key={index} className="p-6">
              <div className="text-4xl md:text-5xl font-bold mb-2">{stat.number}</div>
              <div className="text-xl">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;