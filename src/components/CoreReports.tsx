import React, { useEffect, useState } from 'react';
import ReportCard from './ReportCard';
import { fetchReports } from '../data/reports';

interface Report {
  id: number;
  title: string;
  description: string;
  fileUrl: string;
  date: string;
  image: string;
  category: string;
}

const CoreReports: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('Toutes');
  const [reportsData, setReportsData] = useState<Report[]>([]);

  useEffect(() => {
    const getReports = async () => {
      const data = await fetchReports();
      setReportsData(data);
    };
    getReports();
  }, []);

  const filters = ['Toutes', 'Rapport d\'activité', 'Rapport d\'étude', 'Rapport de projet'];

  const filteredReports = activeFilter === 'Toutes'
    ? reportsData
    : reportsData.filter((report: Report) => report.category === activeFilter);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredReports.map((report: Report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </>
  );
};

export default CoreReports;
