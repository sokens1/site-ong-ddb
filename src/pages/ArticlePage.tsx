import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Facebook, Twitter, Linkedin } from 'lucide-react';

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
    window.scrollTo(0, 0);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement de l'article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Article non trouvé</h1>
          <Link
            to="/news"
            className="text-green-600 hover:text-green-700 underline font-medium"
          >
            Retour aux actualités
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-10 pb-20">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Navigation supérieure */}
        <div className="mb-10">
          <Link
            to="/"
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors duration-200 group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform duration-200" />
            <span className="text-sm font-medium">Retour à l'accueil</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Contenu Principal (8 colonnes) */}
          <article className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* En-tête de l'article */}
              <div className="mb-8">
                <span className="text-green-600 font-bold text-xs uppercase tracking-widest mb-4 block">
                  {article.category}
                </span>
                <h1 className="text-4xl md:text-6xl font-serif font-bold text-gray-900 mb-6 leading-[1.1]">
                  {article.title}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 font-medium">
                  <span className="text-gray-900">Par ONG DDB</span>
                  <span className="text-gray-300">•</span>
                  <span>{article.date}</span>
                </div>
              </div>

              <div className="w-full h-px bg-gray-200 mb-10"></div>

              {/* Image principale */}
              <div className="mb-10 overflow-hidden rounded-sm">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-auto object-cover max-h-[600px]"
                />
              </div>

              {/* Description courte / Introduction */}
              {article.description && (
                <div className="mb-8">
                  <p className="text-xl text-gray-800 font-medium leading-relaxed">
                    {article.description}
                  </p>
                </div>
              )}

              {/* Corps de l'article */}
              <div className="prose prose-lg max-w-none text-gray-700">
                <div className="space-y-6 whitespace-pre-wrap text-lg leading-relaxed font-light">
                  {article.content || ''}
                </div>
              </div>

              {/* Image secondaire si présente */}
              {article.image2 && (
                <div className="mt-12 mb-10 overflow-hidden rounded-sm">
                  <img
                    src={article.image2}
                    alt={`${article.title} illustration`}
                    className="w-full h-auto object-cover max-h-[500px]"
                  />
                </div>
              )}

              <div className="w-full h-px bg-gray-200 mt-12 mb-6"></div>

              {/* Barre d'action sociale */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-gray-500">
                  <span className="text-sm font-medium text-gray-400">Partager :</span>
                  <button
                    onClick={() => {
                      const url = encodeURIComponent(window.location.href);
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
                    }}
                    className="hover:text-blue-600 transition-colors"
                    title="Partager sur Facebook"
                  >
                    <Facebook size={20} />
                  </button>
                  <button
                    onClick={() => {
                      const url = encodeURIComponent(window.location.href);
                      const text = encodeURIComponent(article.title);
                      window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
                    }}
                    className="hover:text-sky-500 transition-colors"
                    title="Partager sur Twitter"
                  >
                    <Twitter size={20} />
                  </button>
                  <button
                    onClick={() => {
                      const url = encodeURIComponent(window.location.href);
                      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=600,height=400');
                    }}
                    className="hover:text-blue-700 transition-colors"
                    title="Partager sur LinkedIn"
                  >
                    <Linkedin size={20} />
                  </button>
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
                        alert('Lien copié dans le presse-papier !');
                      }
                    }}
                    className="hover:text-green-600 transition-colors"
                    title="Plus d'options de partage"
                  >
                    <Share2 size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          </article>

          {/* Sidebar Dynamique (4 colonnes) */}
          <aside className="lg:col-span-4 overflow-hidden">
            <div className="sticky top-24 space-y-12">
              {/* Note: Pas de publicité pour le moment, donc on ne met rien comme demandé */}

              {/* Articles Reliés avec animation d'entrée de la droite */}
              <div className="lg:block">
                <motion.h3
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="font-serif font-bold text-xl text-gray-900 mb-6 border-b border-gray-100 pb-2"
                >
                  Articles reliés
                </motion.h3>
                <div className="space-y-8">
                  {otherArticles.slice(0, 4).map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 100 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      className="group cursor-pointer"
                      onClick={() => navigate(`/article/${item.id}`)}
                    >
                      <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2 block">
                        {item.category}
                      </span>
                      <h4 className="text-base font-bold group-hover:text-green-600 transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-gray-500 text-xs mt-2 line-clamp-1">
                        {item.date}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Petit bloc d'abonnement ou autre contenu si besoin */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-green-50 p-6 rounded-sm border-l-4 border-green-600"
              >
                <h4 className="font-bold text-green-900 text-sm mb-2">Restez informé</h4>
                <p className="text-green-800 text-xs mb-4">Rejoignez notre newsletter pour ne rien manquer de nos actions.</p>
                <Link to="/join" className="text-[10px] font-bold text-green-700 uppercase tracking-widest hover:text-green-900 transition-colors">
                  S'abonner →
                </Link>
              </motion.div>
            </div>
          </aside>
        </div>

        {/* Section de bas de page - Autres actualités */}
        {otherArticles.length > 0 && (
          <div className="mt-24 border-t border-gray-100 pt-16">
            <div className="flex justify-between items-end mb-10">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">
                Découvrez d'autres contenus
              </h2>
              <Link to="/news" className="text-green-600 font-bold hover:text-green-800 transition-colors text-sm uppercase tracking-wider border-b-2 border-green-600 pb-1">
                Voir tout
              </Link>
            </div>

            <div
              ref={scrollRef}
              className="flex overflow-x-auto gap-8 pb-10 scrollbar-hide snap-x"
              style={{ scrollBehavior: 'smooth' }}
            >
              {otherArticles.map((otherArticle) => (
                <div
                  key={otherArticle.id}
                  className="flex-shrink-0 w-[300px] md:w-[380px] group cursor-pointer snap-start"
                  onClick={() => navigate(`/article/${otherArticle.id}`)}
                >
                  <div className="aspect-[16/10] overflow-hidden rounded-sm mb-6">
                    <img
                      src={otherArticle.image}
                      alt={otherArticle.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-3 block">
                      {otherArticle.category}
                    </span>
                    <h3 className="text-xl font-serif font-bold text-gray-900 mb-3 group-hover:text-green-700 transition-colors line-clamp-2 leading-tight">
                      {otherArticle.title}
                    </h3>
                    <p className="text-gray-500 text-sm line-clamp-2 font-light leading-relaxed">
                      {otherArticle.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination / dots indicator */}
            <div className="flex justify-center gap-3 mt-4">
              {otherArticles.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    const container = scrollRef.current;
                    if (container?.children[index]) {
                      const card = container.children[index] as HTMLElement;
                      container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
                    }
                  }}
                  className={`h-1.5 transition-all duration-300 rounded-full ${activeIndex === index ? 'w-8 bg-green-600' : 'w-2 bg-gray-200'}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticlePage;
