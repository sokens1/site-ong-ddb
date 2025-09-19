import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { motion, useInView } from 'framer-motion';

// Interfaces
interface NewsArticle {
  title: string;
  image: string;
  category: string;
  date: string;
  description: string;
  content: string;
}

interface TeamMember {
  name: string;
  image: string;
  position: string;
  description: string;
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
  // State
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [teamActiveIndex, setTeamActiveIndex] = useState(0);
  const isMobile = useIsMobile();

  // Refs
  const newsScrollRef = useRef<HTMLDivElement>(null);
  const teamScrollRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const teamAutoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const scrollTeam = (direction: 'left' | 'right') => {
    if (teamScrollRef.current) {
      const scrollAmount = teamScrollRef.current.clientWidth * 0.8;
      teamScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Effects
  useEffect(() => {
    const fetchNews = async () => {
      const { data, error } = await supabase.from('news').select('*').order('date', { ascending: false });
      if (error) console.error('Error fetching news:', error);
      else setNews(data?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || []);
    };

    const fetchTeam = async () => {
      const { data, error } = await supabase.from('team_members').select('*');
      if (error) console.error('Error fetching team members:', error);
      else setTeam(data || []);
    };

    fetchNews();
    fetchTeam();
  }, []);

  useEffect(() => {
    const startAutoScroll = () => {
      if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = setInterval(() => {
        setActiveIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % news.length;
          const container = newsScrollRef.current;
          if (container?.children[nextIndex]) {
            const card = container.children[nextIndex] as HTMLElement;
            container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
          }
          return nextIndex;
        });
      }, 8000);
    };

    if (isMobile && news.length > 0 && !isModalOpen) {
      startAutoScroll();
    } else {
      if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
    }

    return () => {
      if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
    };
  }, [isMobile, news.length, isModalOpen]);

  useEffect(() => {
    const startTeamAutoScroll = () => {
      if (teamAutoScrollIntervalRef.current) clearInterval(teamAutoScrollIntervalRef.current);
      teamAutoScrollIntervalRef.current = setInterval(() => {
        setTeamActiveIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % team.length;
          const container = teamScrollRef.current;
          if (container?.children[nextIndex]) {
            const card = container.children[nextIndex] as HTMLElement;
            container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
          }
          return nextIndex;
        });
      }, 6000);
    };

    if (isMobile && team.length > 0) {
      startTeamAutoScroll();
    } else {
      if (teamAutoScrollIntervalRef.current) clearInterval(teamAutoScrollIntervalRef.current);
    }

    return () => {
      if (teamAutoScrollIntervalRef.current) clearInterval(teamAutoScrollIntervalRef.current);
    };
  }, [isMobile, team.length]);

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

  useEffect(() => {
    const container = teamScrollRef.current;
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      if (!container) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollLeft = container.scrollLeft;
        const cardWidth = container.children[0]?.clientWidth || 0;
        const gap = 16; // Assuming gap-4
        const newIndex = Math.round(scrollLeft / (cardWidth + gap));
        if (newIndex !== teamActiveIndex) setTeamActiveIndex(newIndex);
      }, 150);
    };
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [teamActiveIndex]);

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

        <AnimatedSection className="relative group mb-16">
          <div ref={newsScrollRef} className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-6 scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
            {news.map((article, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="flex-shrink-0 snap-start w-80 md:w-96"
              >
                <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                  <div className="h-48 overflow-hidden">
                    <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4 sm:p-6 flex flex-col flex-grow">
                    <div className="text-green-600 font-bold mb-2 text-sm">{article.category} • {article.date}</div>
                    <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-3 line-clamp-2">{article.title}</h3>
                    <p className="text-gray-700 mb-4 text-sm sm:text-base line-clamp-3 flex-grow">{article.description}</p>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-auto">
                      <button onClick={() => { setSelectedArticle(article); setIsModalOpen(true); }} className="text-green-600 font-medium hover:text-green-800 transition-colors duration-200 text-left">
                        Lire l'article →
                      </button>
                      <div className="flex space-x-3 justify-start sm:justify-end">
                        <button onClick={() => { if (navigator.share) { navigator.share({ title: article.title, text: article.description, url: window.location.href }); } else { navigator.clipboard.writeText(window.location.href); alert('Lien copié !'); } }} className="text-gray-500 hover:text-green-600 transition-colors duration-200 p-1" title="Partager">
                          <i className="fas fa-share text-sm"></i>
                        </button>
                        <button onClick={() => { const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`; window.open(fbUrl, '_blank', 'width=600,height=400'); }} className="text-gray-500 hover:text-blue-600 transition-colors duration-200 p-1" title="Partager sur Facebook">
                          <i className="fab fa-facebook-f text-sm"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
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
            {news.map((_, index) => (
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
                aria-label={`Aller à l'actualité ${index + 1}`}
              />
            ))}
          </div>
        )}

        <AnimatedSection className="text-center mb-16">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-green-800 mb-4">
            Notre bureau directeur
          </motion.h2>
          <motion.div variants={itemVariants} className="w-24 h-1 bg-green-600 mx-auto mb-8"></motion.div>
          
          {/* Version Desktop - Disposition hiérarchisée */}
          {!isMobile && (
            <>
              {/* Premier membre seul en haut au centre */}
              {team.length > 0 && (
                <motion.div variants={itemVariants} className="text-center mb-12">
                  <img src={team[0].image} alt={team[0].name} className="w-40 h-40 rounded-full mx-auto mb-4 object-cover shadow-lg"/>
                  <h3 className="font-bold text-green-800 text-xl">{team[0].name}</h3>
                  <p className="text-gray-600">{team[0].position}</p>
                </motion.div>
              )}

              {/* Membres 2, 3, 4 en ligne */}
              {team.length > 1 && (
                <div className="flex justify-center flex-wrap gap-8 mb-8">
                  {team.slice(1, 4).map((member, index) => (
                    <motion.div key={index + 1} variants={itemVariants} className="text-center w-64">
                      <img src={member.image} alt={member.name} className="w-32 h-32 rounded-full mx-auto mb-4 object-cover shadow-lg"/>
                      <h3 className="font-bold text-green-800 text-xl">{member.name}</h3>
                      <p className="text-gray-600">{member.position}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Membres 5, 11, 12 en ligne (3 photos) */}
              {team.length > 4 && (
                <div className="flex justify-center flex-wrap gap-8 mb-8">
                  {[4, 10, 11].filter(index => index < team.length).map((memberIndex) => (
                    <motion.div key={memberIndex} variants={itemVariants} className="text-center w-64">
                      <img src={team[memberIndex].image} alt={team[memberIndex].name} className="w-32 h-32 rounded-full mx-auto mb-4 object-cover shadow-lg"/>
                      <h3 className="font-bold text-green-800 text-xl">{team[memberIndex].name}</h3>
                      <p className="text-gray-600">{team[memberIndex].position}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Membres 6, 7 en ligne (2 photos) */}
              {team.length > 5 && (
                <div className="flex justify-center flex-wrap gap-8 mb-8">
                  {[5, 6].filter(index => index < team.length).map((memberIndex) => (
                    <motion.div key={memberIndex} variants={itemVariants} className="text-center w-64">
                      <img src={team[memberIndex].image} alt={team[memberIndex].name} className="w-32 h-32 rounded-full mx-auto mb-4 object-cover shadow-lg"/>
                      <h3 className="font-bold text-green-800 text-xl">{team[memberIndex].name}</h3>
                      <p className="text-gray-600">{team[memberIndex].position}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Reste des membres (10, 8, 9, 13 et plus) */}
              {team.length > 4 && (
                <div className="flex justify-center flex-wrap gap-8">
                  {[9, 7, 8, 12].filter(index => index < team.length).concat(
                    team.slice(13).map((_, index) => index + 13)
                  ).map((memberIndex) => (
                    <motion.div key={memberIndex} variants={itemVariants} className="text-center w-64">
                      <img src={team[memberIndex].image} alt={team[memberIndex].name} className="w-32 h-32 rounded-full mx-auto mb-4 object-cover shadow-lg"/>
                      <h3 className="font-bold text-green-800 text-xl">{team[memberIndex].name}</h3>
                      <p className="text-gray-600">{team[memberIndex].position}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Version Mobile - Défilement horizontal */}
          {isMobile && (
            <div className="relative group">
              <div ref={teamScrollRef} className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
                {team.map((member, index) => (
                  <motion.div
                    key={index}
                    variants={itemVariants}
                    className="flex-shrink-0 snap-start w-48"
                  >
                    <div className="text-center">
                      <img src={member.image} alt={member.name} className="w-24 h-24 rounded-full mx-auto mb-3 object-cover shadow-lg"/>
                      <h3 className="font-bold text-green-800 text-base">{member.name}</h3>
                      <p className="text-gray-600 text-sm">{member.position}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              {/* Indicateurs de pagination pour mobile */}
              <div className="flex justify-center gap-2 mt-4">
                {team.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setTeamActiveIndex(index);
                      const container = teamScrollRef.current;
                      if (container?.children[index]) {
                        const card = container.children[index] as HTMLElement;
                        container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
                      }
                    }}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${teamActiveIndex === index ? 'bg-green-600' : 'bg-gray-300'}`}
                    aria-label={`Aller au membre ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </AnimatedSection>
      </div>

      {isModalOpen && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <button onClick={() => setIsModalOpen(false)} className="sticky top-4 right-4 float-right text-gray-500 hover:text-gray-800 bg-white/80 rounded-full w-9 h-9 flex items-center justify-center shadow-md z-20">
              ×
            </button>
            <div className="p-6 md:p-8">
              <img src={selectedArticle.image} alt={selectedArticle.title} className="w-full h-64 object-cover rounded-lg mb-4" />
              <div className="text-green-600 font-bold mb-2">{selectedArticle.category} • {selectedArticle.date}</div>
              <h1 className="text-2xl md:text-3xl font-bold text-green-800 mb-4">{selectedArticle.title}</h1>
              <div className="prose max-w-none text-gray-700">
                <p className="text-lg mb-4">{selectedArticle.description}</p>
                <div className="space-y-4" dangerouslySetInnerHTML={{ __html: selectedArticle.content || '' }} />
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-gray-600 font-medium">Partager :</span>
                <div className="flex space-x-3">
                  <button onClick={() => { if (navigator.share) { navigator.share({ title: selectedArticle.title, text: selectedArticle.description, url: window.location.href }); } else { navigator.clipboard.writeText(window.location.href); alert('Lien copié !'); } }} className="text-gray-500 hover:text-green-600 transition-colors duration-200 p-1" title="Partager">
                    <i className="fas fa-share"></i>
                  </button>
                  <button onClick={() => { const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`; window.open(fbUrl, '_blank', 'width=600,height=400'); }} className="text-gray-500 hover:text-blue-600 transition-colors duration-200 p-1" title="Partager sur Facebook">
                    <i className="fab fa-facebook-f"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default News;