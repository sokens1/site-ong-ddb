import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../supabaseClient'; // Adjust path
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

const AdminArticleView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [article, setArticle] = useState<NewsArticle | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchArticle = async () => {
            if (!id) return;

            try {
                setLoading(true);
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
                }
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchArticle();
    }, [id]);

    const handleBack = () => {
        navigate('/admin/news');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement de l'article...</p>
                </div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">Article non trouvé</h1>
                    <button
                        onClick={handleBack}
                        className="text-green-600 hover:text-green-700 underline"
                    >
                        Retour à la liste
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-full">
            {/* Header with Back Button */}
            <div className="bg-white shadow-sm sticky top-0 z-10 mb-6">
                <div className="px-6 py-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors duration-200 group"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Retour aux actualités</span>
                    </button>
                </div>
            </div>

            {/* Article Content */}
            <article className="max-w-4xl mx-auto px-6 pb-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Main Image */}
                    <div className="mb-8 rounded-xl overflow-hidden shadow-lg bg-white">
                        <img
                            src={article.image}
                            alt={article.title}
                            className="w-full h-auto max-h-[500px] object-cover"
                        />
                    </div>

                    {/* Metadata */}
                    <div className="mb-6 border-b border-gray-200 pb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                {article.category}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600 font-medium">{article.date}</span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight">
                            {article.title}
                        </h1>
                    </div>

                    {/* Description / Intro */}
                    {article.description && (
                        <div className="mb-8 p-6 bg-green-50 rounded-lg border-l-4 border-green-500">
                            <p className="text-xl text-gray-800 italic leading-relaxed">
                                {article.description}
                            </p>
                        </div>
                    )}

                    {/* Main Content */}
                    <div className="prose prose-lg max-w-none text-gray-700 mb-12">
                        <div className="space-y-6 whitespace-pre-wrap text-lg leading-relaxed bg-white p-8 rounded-xl shadow-sm">
                            {article.content || ''}
                        </div>
                    </div>

                    {/* Secondary Image */}
                    {article.image2 && (
                        <div className="mb-12 rounded-xl overflow-hidden shadow-lg bg-white">
                            <img
                                src={article.image2}
                                alt="Illustration secondaire"
                                className="w-full h-auto max-h-[500px] object-cover"
                            />
                        </div>
                    )}
                </motion.div>
            </article>
        </div>
    );
};

export default AdminArticleView;
