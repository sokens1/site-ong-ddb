import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

const CoreReports: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('Toutes');
  const [reportsData, setReportsData] = useState<Report[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef(null);
  const isInView = useInView(animationRef, { once: true, margin: '-150px' });

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

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
      <motion.div
        ref={animationRef}
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        className="relative group"
      >
        <div ref={scrollContainerRef} className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-6 scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
          {filteredReports.map((report: Report) => (
            <motion.div
              key={report.id}
              variants={itemVariants}
              className="flex-shrink-0 snap-start w-96"
            >
              <ReportCard report={report} />
            </motion.div>
          ))}
        </div>
        {/* Flèches de navigation */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-3 text-green-800 hover:bg-white shadow-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 z-10"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-3 text-green-800 hover:bg-white shadow-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 z-10"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </motion.div>
    </>
  );
};

export default CoreReports;
