import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ReportCard from './ReportCard';
import { fetchReports } from '../data/reports';
import { ArrowRight } from 'lucide-react';

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
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

const CoreReports: React.FC = () => {
  const [reportsData, setReportsData] = useState<Report[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef(null);
  const isInView = useInView(animationRef, { once: true, margin: '-150px' });
  const navigate = useNavigate();

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
      // Sort and take top 5
      const sorted = data.sort((a: Report, b: Report) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setReportsData(sorted.slice(0, 5));
    };
    getReports();
  }, []);

  return (
    <section className="py-16 bg-white" id="reports">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Nos Rapports</h2>
          <div className="w-24 h-1 bg-green-600 mx-auto mb-4"></div>
          <p className="text-gray-500 max-w-2xl mx-auto text-sm">Consultez nos derniers rapports d'activités pour suivre l'impact de nos actions.</p>
        </div>

        <motion.div
           ref={animationRef}
           variants={containerVariants}
           initial="hidden"
           animate={isInView ? 'visible' : 'hidden'}
           className="relative group"
        >
          <div ref={scrollContainerRef} className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 scrollbar-hide pt-4 px-4 -mx-4" style={{ scrollBehavior: 'smooth' }}>
            {reportsData.map((report) => (
              <motion.div
                key={report.id}
                variants={itemVariants}
                className="flex-shrink-0 snap-start w-80 md:w-96"
              >
                <ReportCard report={report} />
              </motion.div>
            ))}

            {/* View More Card */}
            <motion.div
              variants={itemVariants}
              className="flex-shrink-0 snap-start w-80 md:w-96 flex items-center justify-center p-4"
            >
              <div 
                onClick={() => navigate('/actions')}
                className="bg-green-50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 w-full h-full min-h-[350px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-green-200 hover:border-green-400 group cursor-pointer"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm text-green-600">
                  <ArrowRight size={28} />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Tous nos rapports</h3>
                <p className="text-green-600/80 text-sm">Accédez à l'ensemble de nos rapports annuels et bilans financiers.</p>
              </div>
            </motion.div>

          </div>
          {/* Flèches de navigation */}
          {reportsData.length > 0 && (
            <>
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
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default CoreReports;
