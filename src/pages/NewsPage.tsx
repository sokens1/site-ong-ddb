import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Filter, ChevronRight, Play, FileText, ChevronLeft } from 'lucide-react';

interface FeedItem {
  type: 'news' | 'video';
  id: number;
  title: string;
  image: string;
  category: string;
  date: string;
  description: string;
  link: string;
}

const NewsPage: React.FC = () => {
  const navigate = useNavigate();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'Tous' | 'Blog' | 'Vidéo'>('Tous');

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchFeed = async () => {
      setLoading(true);
      try {
        const now = new Date().toISOString().split('T')[0];
        
        // Fetch News
        const { data: newsData, error: newsError } = await supabase
          .from('news')
          .select('*')
          .eq('status', 'published')
          .lte('date', now)
          .order('date', { ascending: false });

        // Fetch Videos
        const { data: videosData, error: videosError } = await supabase
          .from('videos')
          .select('*')
          .lte('date', now)
          .order('date', { ascending: false });

        if (newsError) console.error('Error fetching news:', newsError);
        if (videosError) console.error('Error fetching videos:', videosError);

        let merged: FeedItem[] = [];

        if (newsData) {
          merged = merged.concat(newsData.map(n => ({
            type: 'news',
            id: n.id,
            title: n.title,
            image: n.image,
            category: 'Blog',
            date: n.date,
            description: n.description,
            link: `/article/${n.id}`
          })));
        }

        if (videosData) {
          merged = merged.concat(videosData.map(v => ({
            type: 'video',
            id: v.id,
            title: v.title,
            image: v.thumbnailpath || '/images/image-presentation-3.jpg',
            category: 'Vidéo',
            date: v.date,
            description: v.description || '',
            link: v.videourl || v.filepath || ''
          })));
        }

        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setFeedItems(merged);
      } catch (err) {
        console.error('Unexpected error fetching feed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, []);

  const filteredFeed = useMemo(() => {
    let result = feedItems;
    if (filterCategory !== 'Tous') {
      result = result.filter(item => item.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [feedItems, filterCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Header */}
      <div className="bg-green-900 border-b border-green-800 relative z-10 pt-24 pb-16 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
           <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[150%] rounded-full bg-white blur-3xl transform rotate-12"></div>
           <div className="absolute -bottom-[20%] -left-[10%] w-[40%] h-[100%] rounded-full bg-white blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 relative z-20">
          <Link to="/" className="inline-flex items-center gap-2 text-green-300 hover:text-white mb-6 transition-colors text-sm font-medium">
            <ChevronLeft size={16} />
            Retour à l'accueil
          </Link>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight max-w-4xl drop-shadow-md">
            Actualités & Médias
          </h1>
          <p className="text-green-100 text-lg max-w-2xl">
            Suivez nos dernières actions, lisez nos articles de blog et visionnez nos reportages vidéos sur le terrain.
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
                 placeholder="Rechercher une actualité, une vidéo..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
               />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide flex-nowrap">
               <div className="flex items-center gap-2 text-gray-500 mr-2 flex-shrink-0">
                 <Filter size={18} />
                 <span className="text-sm font-medium">Filtrer :</span>
               </div>
               {(['Tous', 'Blog', 'Vidéo'] as const).map(cat => (
                 <button
                   key={cat}
                   onClick={() => setFilterCategory(cat)}
                   className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex-shrink-0 ${filterCategory === cat ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                 >
                   {cat === 'Vidéo' && <Play size={14} className="inline mr-1.5" />}
                   {cat === 'Blog' && <FileText size={14} className="inline mr-1.5" />}
                   {cat}
                 </button>
               ))}
            </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Aucun résultat trouvé</h3>
            <p className="text-gray-500">Essayez de modifier votre recherche ou vos filtres.</p>
            <button onClick={() => {setSearchQuery(''); setFilterCategory('Tous')}} className="mt-6 text-green-600 font-bold hover:underline">
               Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredFeed.map((item, index) => (
              <motion.div
                key={`${item.type}-${item.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
                className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group relative border border-gray-100"
              >
                <div className="h-56 overflow-hidden relative bg-gray-100">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-bold text-gray-800 shadow-sm flex items-center gap-2">
                    {item.category === 'Vidéo' ? (
                      <span className="flex items-center gap-1.5 text-red-600"><Play size={14} className="fill-current" /> {item.category}</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-blue-600"><FileText size={14} /> {item.category}</span>
                    )}
                  </div>
                  
                  {item.category === 'Vidéo' && (
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-14 h-14 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                           <Play size={24} className="fill-current ml-1" />
                        </div>
                     </div>
                  )}
                </div>
                
                <div className="p-6 flex flex-col flex-grow relative z-10 bg-white">
                  <div className="text-gray-400 font-medium mb-3 text-xs uppercase tracking-wider flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-green-500"></span>
                     {new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-800 mb-4 line-clamp-2 group-hover:text-green-700 transition-colors">
                    {item.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-6 text-sm line-clamp-3 leading-relaxed flex-grow">
                    {item.description}
                  </p>
                  
                  <div className="pt-5 border-t border-gray-100 mt-auto flex items-center justify-between">
                    {item.type === 'video' ? (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-green-700 font-bold hover:text-green-800 transition-colors text-sm flex items-center gap-2 group-hover:gap-3 before:absolute before:inset-0">
                        Regarder la vidéo <ChevronRight size={16} />
                      </a>
                    ) : (
                      <button onClick={() => navigate(item.link)} className="text-green-700 font-bold hover:text-green-800 transition-colors text-sm flex items-center gap-2 group-hover:gap-3 outline-none before:absolute before:inset-0">
                        Lire l'article <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsPage;
