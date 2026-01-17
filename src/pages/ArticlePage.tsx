import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

interface NewsArticle {
  id: number;
  title: string;
  image: string;
  image2?: string;
  category: string;
  date: string;
  description?: string;
  content: string;
}

const ArticlePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [otherArticles, setOtherArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) return;

      try {
        setLoading(true);
        // Récupérer l'article actuel
        const { data: articleData, error: articleError } = await supabase
          .from('news')
          .select('*')
          .eq('id', parseInt(id))
          .single();

        if (articleError) {
          console.error('Error fetching article:', articleError);
          return;
        }

        if (articleData) {
          setArticle(articleData);

          // Récupérer les autres articles (exclure l'article actuel)
          const { data: otherData, error: otherError } = await supabase
            .from('news')
            .select('*')
            .neq('id', parseInt(id))
            .order('date', { ascending: false })
            .limit(6);

          if (!otherError && otherData) {
            setOtherArticles(otherData);
          }
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  // Gestion du scroll pour les indicateurs
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollLeft = container.scrollLeft;
        const cardWidth = container.children[0]?.clientWidth || 0;
        const gap = 24; // gap-6 = 24px
        const newIndex = Math.round(scrollLeft / (cardWidth + gap));
        if (newIndex !== activeIndex && newIndex >= 0 && newIndex < otherArticles.length) {
          setActiveIndex(newIndex);
        }
      }, 150);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex, otherArticles.length]);

  const handleBack = () => {
    navigate('/news');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Article non trouvé</h1>
          <button
            onClick={handleBack}
            className="text-green-600 hover:text-green-700 underline"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bouton retour animé */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <motion.button
            onClick={handleBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors duration-200 group"
          >
            <motion.div
              animate={{ x: [0, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowLeft size={20} className="group-hover:text-green-700" />
            </motion.div>
            <span>Retour</span>
          </motion.button>
        </div>
      </div>

      {/* Contenu de l'article */}
      <article className="container mx-auto px-4 py-8 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Image principale */}
          <div className="mb-6 flex justify-center">
            <img
              src={article.image}
              alt={article.title}
              className="max-w-full h-auto max-h-[500px] object-contain rounded-lg mx-auto"
            />
          </div>

          {/* Métadonnées */}
          <div className="mb-4">
            <div className="text-green-600 font-bold text-sm md:text-base mb-2 flex items-center gap-2">
              <span className="px-3 py-1 bg-green-50 rounded-full">{article.category}</span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-600">{article.date}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
              {article.title}
            </h1>
          </div>

          {/* Description */}
          {article.description && (
            <p className="text-xl text-gray-700 mb-8 italic border-l-4 border-green-600 pl-6 py-2 bg-green-50/30 rounded-r-lg">
              {article.description}
            </p>
          )}

          {/* Contenu */}
          <div className="prose prose-lg max-w-none text-gray-700 mb-12">
            <div className="space-y-6 whitespace-pre-wrap text-lg leading-relaxed">
              {article.content || ''}
            </div>
          </div>

          {/* Image secondaire */}
          {article.image2 && (
            <div className="mb-12 flex justify-center">
              <img
                src={article.image2}
                alt={`${article.title} - Illustration`}
                className="max-w-full h-auto max-h-[500px] object-contain rounded-lg mx-auto"
              />
            </div>
          )}

          {/* Partage */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between flex-wrap gap-4">
            <span className="text-gray-600 font-medium">Partager :</span>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: article.title,
                      text: article.description || '',
                      url: window.location.href,
                    });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Lien copié !');
                  }
                }}
                className="text-gray-500 hover:text-green-600 transition-colors duration-200 p-2 rounded-full hover:bg-green-50"
                title="Partager"
              >
                <i className="fas fa-share"></i>
              </button>
              <button
                onClick={() => {
                  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
                  window.open(fbUrl, '_blank', 'width=600,height=400');
                }}
                className="text-gray-500 hover:text-blue-600 transition-colors duration-200 p-2 rounded-full hover:bg-blue-50"
                title="Partager sur Facebook"
              >
                <i className="fab fa-facebook-f"></i>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Autres actualités */}
        {otherArticles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-16 pt-8 border-t-2 border-gray-200"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-green-800 mb-6">
              Autres actualités
            </h2>
            <div
              ref={scrollRef}
              className="flex overflow-x-auto gap-6 pb-6 scrollbar-hide"
              style={{ scrollBehavior: 'smooth' }}
            >
              {otherArticles.map((otherArticle) => (
                <motion.div
                  key={otherArticle.id}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="flex-shrink-0 w-80 bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer flex flex-col"
                  onClick={() => navigate(`/news/${otherArticle.id}`)}
                >
                  <div className="h-40 overflow-hidden">
                    <img
                      src={otherArticle.image}
                      alt={otherArticle.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-grow">
                    <div className="text-green-600 font-bold mb-2 text-xs">
                      {otherArticle.category} • {otherArticle.date}
                    </div>
                    <h3 className="text-base font-bold text-green-800 mb-2 line-clamp-2 flex-grow">
                      {otherArticle.title}
                    </h3>
                    {otherArticle.description && (
                      <p className="text-gray-700 mb-3 text-sm line-clamp-2">
                        {otherArticle.description}
                      </p>
                    )}
                    <button className="text-green-600 font-medium hover:text-green-800 transition-colors duration-200 text-left text-sm mt-auto">
                      Lire l'article →
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
            {/* Indicateurs de pagination */}
            {otherArticles.length > 0 && (
              <div className="flex justify-center gap-2 mt-4">
                {otherArticles.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveIndex(index);
                      const container = scrollRef.current;
                      if (container?.children[index]) {
                        const card = container.children[index] as HTMLElement;
                        container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
                      }
                    }}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${activeIndex === index ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    aria-label={`Aller à l'actualité ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </article>
    </div>
  );
};

export default ArticlePage;
