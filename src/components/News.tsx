import React, { useState, useEffect, useRef, Key } from 'react';
import { supabase } from '../supabaseClient';
import { motion, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Interfaces
interface FeedItem {
  type: 'news' | 'video';
  id: number;
  title: string;
  image: string;
  category: string;
  date: string;
  description: string;
  link: string;
  isViewMore?: boolean;
}


// Hooks
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 },
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

// Animated Section Component
const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  );
};

const News: React.FC = () => {
  const navigate = useNavigate();
  // State
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const isMobile = useIsMobile();

  // Refs
  const newsScrollRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Functions
  const scrollNews = (direction: 'left' | 'right') => {
    if (newsScrollRef.current) {
      const scrollAmount = newsScrollRef.current.clientWidth * 0.9;
      newsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };


  // Effects
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const now = new Date().toISOString().split('T')[0];
        
        // Fetch News
        const { data: newsData, error: newsError } = await supabase
          .from('news')
          .select('*')
          .eq('status', 'published')
          .lte('date', now)
          .order('date', { ascending: false })
          .limit(5);

        // Fetch Videos
        const { data: videosData, error: videosError } = await supabase
          .from('videos')
          .select('*')
          .lte('date', now)
          .order('date', { ascending: false })
          .limit(5);

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

        // Sort combined
        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Take top 5
        let finalFeed = merged.slice(0, 5);
        
        // Add "View More" card
        finalFeed.push({
          type: 'news',
          id: -1,
          title: 'Voir plus d\'actualités',
          image: '/images/image-presentation-3.jpg',
          category: 'Plus',
          date: '',
          description: 'Découvrez l\'ensemble de nos articles de blog et de nos vidéos.',
          link: '/news',
          isViewMore: true
        });

        setFeedItems(finalFeed);
      } catch (err) {
        console.error('Unexpected error fetching feed:', err);
        setFeedItems([]);
      }
    };

    fetchNews();
  }, []);

  useEffect(() => {
    const startAutoScroll = () => {
      if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = setInterval(() => {
        setActiveIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % feedItems.length;
          const container = newsScrollRef.current;
          if (container?.children[nextIndex]) {
            const card = container.children[nextIndex] as HTMLElement;
            container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
          }
          return nextIndex;
        });
      }, 8000);
    };

    if (isMobile && feedItems.length > 0) {
      startAutoScroll();
    } else {
      if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
    }

    return () => {
      if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
    };
  }, [isMobile, feedItems.length]);

  useEffect(() => {
    const container = newsScrollRef.current;
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      if (!container) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollLeft = container.scrollLeft;
        const cardWidth = container.children[0]?.clientWidth || 0;
        const gap = 32; // Assuming gap-8
        const newIndex = Math.round(scrollLeft / (cardWidth + gap));
        if (newIndex !== activeIndex) setActiveIndex(newIndex);
      }, 150);
    };
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [activeIndex]);

  // Render
  return (
    <section id="news" className="py-20 bg-white">
      <div className="container mx-auto px-4">

        <AnimatedSection className="text-center mb-16">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-green-800 mb-4">
            Actualités
          </motion.h2>
          <motion.div variants={itemVariants} className="w-24 h-1 bg-green-600 mx-auto"></motion.div>
        </AnimatedSection>

        <AnimatedSection className="relative group">
          <div ref={newsScrollRef} className="flex overflow-x-auto snap-x gap-8 pb-6 scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
            {feedItems.map((item, index) => {
              if (item.isViewMore) {
                return (
                  <motion.div
                    key="view-more"
                    variants={itemVariants}
                    className="flex-shrink-0 snap-start w-80 md:w-96 flex items-center justify-center p-4"
                  >
                    <div className="bg-green-50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 w-full h-full min-h-[350px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-green-200 hover:border-green-400 group cursor-pointer" onClick={() => navigate(item.link)}>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <i className="fas fa-arrow-right text-green-600 text-2xl"></i>
                      </div>
                      <h3 className="text-xl font-bold text-green-800 mb-2">{item.title}</h3>
                      <p className="text-green-600/80 text-sm">{item.description}</p>
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={`${item.type}-${item.id}`}
                  variants={itemVariants}
                  className="flex-shrink-0 snap-start w-80 md:w-96"
                >
                  <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 h-full flex flex-col group relative">
                    <div className="h-48 overflow-hidden relative">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded text-xs font-bold text-green-700 shadow flex items-center gap-1.5">
                        {item.category === 'Vidéo' ? <i className="fas fa-play text-red-500"></i> : <i className="fas fa-newspaper text-blue-500"></i>}
                        {item.category}
                      </div>
                    </div>
                    <div className="p-4 sm:p-6 flex flex-col flex-grow relative">
                      {item.date && <div className="text-gray-400 font-medium mb-2 text-xs">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                      <h3 className="text-lg sm:text-lg font-bold text-gray-800 mb-3 line-clamp-2 group-hover:text-green-700 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-gray-600 mb-4 text-sm line-clamp-3 flex-grow">{item.description}</p>
                      <div className="pt-4 border-t border-gray-100 mt-auto flex items-center justify-between">
                        {item.type === 'video' ? (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-green-600 font-bold hover:text-green-800 transition-colors text-sm flex items-center gap-1.5 group-hover:translate-x-1">
                            Regarder la vidéo <i className="fas fa-arrow-right"></i>
                          </a>
                        ) : (
                          <button onClick={() => navigate(item.link)} className="text-green-600 font-bold hover:text-green-800 transition-colors text-sm flex items-center gap-1.5 group-hover:translate-x-1 outline-none before:absolute before:inset-0">
                            Lire l'article <i className="fas fa-arrow-right"></i>
                          </button>
                        )}
                        <div className="flex space-x-3 items-center relative z-10">
                          <button onClick={(e) => { e.stopPropagation(); if (navigator.share) { navigator.share({ title: item.title, text: item.description, url: window.location.origin + item.link }); } }} className="text-gray-400 hover:text-green-600 transition-colors p-1 relative z-10" title="Partager">
                            <i className="fas fa-share-alt"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {!isMobile && (
            <>
              <button onClick={() => scrollNews('left')} className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-3 text-green-800 hover:bg-white shadow-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 z-10">
                <i className="fas fa-chevron-left"></i>
              </button>
              <button onClick={() => scrollNews('right')} className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-3 text-green-800 hover:bg-white shadow-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 z-10">
                <i className="fas fa-chevron-right"></i>
              </button>
            </>
          )}
        </AnimatedSection>

        {isMobile && (
          <div className="flex justify-center gap-2 -mt-8 mb-12">
            {feedItems.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setActiveIndex(index);
                  const container = newsScrollRef.current;
                  if (container?.children[index]) {
                    const card = container.children[index] as HTMLElement;
                    container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
                  }
                }}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${activeIndex === index ? 'bg-green-600' : 'bg-gray-300'}`}
                aria-label={`Aller à l'élément ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

    </section>
  );
};

export default News;