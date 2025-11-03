import React from 'react';
import CoreReports from './CoreReports';
import CoreVideos from './CoreVideos';

const ReportsAndActions: React.FC = () => {
  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Nos Actions</h2>
          <div className="w-24 h-1 bg-green-600 mx-auto"></div>
        </div>

        <div>
          <div className="text-left mb-6">
            <h3 className="text-2xl font-bold text-green-800 mb-2">Rapports</h3>
          </div>
          <CoreReports />
        </div>

        <div className="mt-16">
          <div className="text-left mb-6">
            <h3 className="text-2xl font-bold text-green-800 mb-2">Reportages (Vidéos)</h3>
          </div>
          <CoreVideos />
        </div>
      </div>
    </section>
  );
};

export default ReportsAndActions;
