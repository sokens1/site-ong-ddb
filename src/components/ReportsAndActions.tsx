import React, { useState } from 'react';
import CoreActions from './CoreActions';
import CoreReports from './CoreReports';

const ReportsAndActions: React.FC = () => {
  const [activeTab, setActiveTab] = useState('actions');

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Nos Actions et Rapports</h2>
          <div className="w-24 h-1 bg-green-600 mx-auto"></div>
        </div>

        <div className="flex justify-center mb-8">
          <button
            className={`px-6 py-2 font-semibold rounded-l-lg transition-all duration-300 ${activeTab === 'actions' ? 'bg-green-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-green-100'}`}
            onClick={() => setActiveTab('actions')}
          >
            Nos Actions
          </button>
          <button
            className={`px-6 py-2 font-semibold rounded-r-lg transition-all duration-300 ${activeTab === 'reports' ? 'bg-green-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-green-100'}`}
            onClick={() => setActiveTab('reports')}
          >
            Nos Rapports
          </button>
        </div>
        <div>
          {activeTab === 'actions' ? <CoreActions /> : <CoreReports />}
        </div>
      </div>
    </section>
  );
};

export default ReportsAndActions;
