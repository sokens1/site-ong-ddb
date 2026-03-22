import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Filter, FileText, ChevronLeft, Calendar } from 'lucide-react';
import { fetchReports } from '../data/reports';
import ReportCard from '../components/ReportCard';

interface Report {
  id: number;
  title: string;
  description: string;
  fileUrl: string;
  date: string;
  image: string;
  category: string;
}

const ActionsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('Toutes');
  const [availableYears, setAvailableYears] = useState<string[]>(['Toutes']);

  useEffect(() => {
    window.scrollTo(0, 0);
    const getReports = async () => {
      setLoading(true);
      try {
        const data = await fetchReports();
        const sorted = data.sort((a: Report, b: Report) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setReports(sorted);
        
        // Extract unique years
        const yearsSet = new Set(sorted.map((r: Report) => r.date.substring(0, 4)));
        const yearsArray = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
        setAvailableYears(['Toutes', ...yearsArray as string[]]);
      } catch (err) {
        console.error('Unexpected error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };
    getReports();
  }, []);

  const filteredReports = useMemo(() => {
    let result = reports;
    if (filterYear !== 'Toutes') {
      result = result.filter(r => r.date.startsWith(filterYear));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(q) || 
        (item.description && item.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [reports, filterYear, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Header */}
      <div className="bg-green-900 border-b border-green-800 relative z-10 pt-24 pb-16 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
           <div className="absolute top-[10%] right-[20%] w-[50%] h-[80%] rounded-full bg-white blur-[100px]"></div>
           <div className="absolute top-[30%] left-[10%] w-[30%] h-[60%] rounded-full bg-white blur-[80px]"></div>
        </div>

        <div className="container mx-auto px-4 relative z-20">
          <Link to="/" className="inline-flex items-center gap-2 text-green-300 hover:text-white mb-6 transition-colors text-sm font-medium">
            <ChevronLeft size={16} />
            Retour à l'accueil
          </Link>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight max-w-4xl drop-shadow-md">
            Nos Rapports
          </h1>
          <p className="text-green-100 text-lg max-w-2xl">
            Explorez nos bilans annuels et documents financiers pour suivre l'évolution de nos activités en toute transparence.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-8 relative z-30">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 md:p-6 mb-12 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 flex-shrink-0">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search size={18} className="text-gray-400" />
               </div>
               <input 
                 type="text" 
                 placeholder="Rechercher un rapport..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
               />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide flex-nowrap">
               <div className="flex items-center gap-2 text-gray-500 mr-2 flex-shrink-0">
                 <Filter size={18} />
                 <span className="text-sm font-medium">Année :</span>
               </div>
               {availableYears.map(year => (
                 <button
                   key={year}
                   onClick={() => setFilterYear(year)}
                   className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex-shrink-0 ${filterYear === year ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                 >
                   {year !== 'Toutes' && <Calendar size={14} className="inline mr-1.5" />}
                   {year}
                 </button>
               ))}
            </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Aucun rapport trouvé</h3>
            <p className="text-gray-500">Essayez de modifier votre recherche ou l'année sélectionnée.</p>
            <button onClick={() => {setSearchQuery(''); setFilterYear('Toutes')}} className="mt-6 text-green-600 font-bold hover:underline">
               Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredReports.map((report, index) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.4) }}
                viewport={{ once: true }}
                className="col-span-1"
              >
                 <ReportCard report={report} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionsPage;
