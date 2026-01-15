import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import ImageUpload from '../../components/admin/ImageUpload';
import RichTextEditor from '../../components/admin/RichTextEditor';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface News {
  id: number;
  title: string;
  content: string;
  image: string;
  category: string;
  date: string;
  description?: string;
  created_at?: string;
  status?: 'draft' | 'published';
  scheduled_at?: string;
}

const CreateNewsPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { create, update, data } = useCrud<News>({ tableName: 'news' });
  const isEditing = !!id;

  // Obtenir la date et l'heure actuelles au format datetime-local
  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState<Partial<News>>({
    title: '',
    content: '',
    image: '',
    category: '',
    date: getCurrentDateTime(),
    description: '',
    status: 'draft',
  });

  const [loading, setLoading] = useState(false);
  const [otherNews, setOtherNews] = useState<News[]>([]);

  // Charger les données si on est en mode édition
  useEffect(() => {
    if (isEditing && id && data) {
      const newsItem = data.find((item) => item.id === parseInt(id));
      if (newsItem) {
        // Convertir la date si elle existe, sinon utiliser la date/heure actuelle
        let dateValue = getCurrentDateTime();
        if (newsItem.date) {
          // Si la date existe déjà, essayer de la convertir en datetime-local
          try {
            const dateObj = new Date(newsItem.date);
            if (!isNaN(dateObj.getTime())) {
              const year = dateObj.getFullYear();
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const day = String(dateObj.getDate()).padStart(2, '0');
              const hours = String(dateObj.getHours()).padStart(2, '0');
              const minutes = String(dateObj.getMinutes()).padStart(2, '0');
              dateValue = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
          } catch (e) {
            // Si la conversion échoue, utiliser la date/heure actuelle
          }
        }
        setFormData({
          ...newsItem,
          date: dateValue,
        });
        // Exclure l'article actuel des autres actualités
        setOtherNews(data.filter((item) => item.id !== parseInt(id)));
      }
    } else if (data) {
      // En mode création, afficher toutes les actualités
      setOtherNews(data);
    }
  }, [id, isEditing, data]);

  const handleBack = () => {
    navigate('/admin/news');
  };

  const handleSaveDraft = async () => {
    try {
      setLoading(true);
      // Convertir la date datetime-local en format date simple pour la base de données
      let dateValue = formData.date || getCurrentDateTime();
      // Extraire seulement la partie date (YYYY-MM-DD) si c'est un datetime-local
      if (dateValue.includes('T')) {
        dateValue = dateValue.split('T')[0];
      }

      const dataToSubmit: any = {
        title: formData.title || '',
        content: formData.content || '',
        image: formData.image || '',
        category: formData.category || '',
        date: dateValue,
        description: formData.description || '',
      };
      
      // Ajouter status seulement s'il existe dans la table
      if (formData.status) {
        dataToSubmit.status = formData.status;
      }

      if (isEditing && id) {
        await update(parseInt(id), dataToSubmit);
      } else {
        await create(dataToSubmit);
      }
      navigate('/admin/news');
    } catch (err) {
      alert('Erreur lors de l\'enregistrement du brouillon');
      console.error('Error saving draft:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      setLoading(true);
      // Convertir la date datetime-local en format date simple pour la base de données
      let dateValue = formData.date || getCurrentDateTime();
      // Extraire seulement la partie date (YYYY-MM-DD) si c'est un datetime-local
      if (dateValue.includes('T')) {
        dateValue = dateValue.split('T')[0];
      }

      const dataToSubmit: any = {
        title: formData.title || '',
        content: formData.content || '',
        image: formData.image || '',
        category: formData.category || '',
        date: dateValue,
        description: formData.description || '',
      };
      
      // Ajouter status seulement s'il existe dans la table
      if (formData.status) {
        dataToSubmit.status = 'published';
      }

      if (isEditing && id) {
        await update(parseInt(id), dataToSubmit);
      } else {
        await create(dataToSubmit);
      }
      navigate('/admin/news');
    } catch (err) {
      alert('Erreur lors de la publication');
      console.error('Error publishing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Êtes-vous sûr de vouloir annuler ? Les modifications non enregistrées seront perdues.')) {
      navigate('/admin/news');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bouton retour */}
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

      {/* Contenu */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Colonne gauche - Formulaire */}
          <div className="flex-1 max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl font-bold text-gray-800 mb-8">
                {isEditing ? 'Modifier une actualité' : 'Créer une actualité'}
              </h1>

              <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titre *
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Entrez le titre de l'actualité"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
                placeholder="Description courte de l'actualité"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contenu *
              </label>
              <RichTextEditor
                value={formData.content || ''}
                onChange={(html) => setFormData({ ...formData, content: html })}
                placeholder="Contenu de l'actualité"
                rows={12}
              />
            </div>

            <div>
              <ImageUpload
                value={formData.image || ''}
                onChange={(url) => setFormData({ ...formData, image: url })}
                bucket="ong-backend"
                folder="news/images"
                label="Image"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie *
                </label>
                <input
                  type="text"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ex: Événement, Projet, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de publication *
                </label>
                <input
                  type="datetime-local"
                  value={formData.date || getCurrentDateTime()}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Date et heure actuelles par défaut
                </p>
              </div>
            </div>
            </div>

            {/* Boutons d'action en bas */}
            <div className="mt-8 flex justify-end gap-4">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={loading}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enregistrement...' : 'Mettre au brouillon'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Publication...' : 'Publier'}
              </button>
            </div>
          </motion.div>
        </div>

        {/* Colonne droite - Autres actualités */}
        <div className="w-80 flex-shrink-0 hidden lg:block">
          <div className="sticky top-20">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Autres actualités
            </h2>
            <div className="bg-white rounded-lg shadow-md p-4 max-h-[calc(100vh-180px)] overflow-y-auto">
              {otherNews.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Aucune autre actualité
                </p>
              ) : (
                <div className="space-y-4">
                  {otherNews.map((news) => (
                    <div
                      key={news.id}
                      onClick={() => navigate(`/admin/news/edit/${news.id}`)}
                      className="bg-gray-50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer group"
                    >
                      <div className="h-32 overflow-hidden">
                        <img
                          src={news.image}
                          alt={news.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <div className="p-3">
                        <div className="text-green-600 font-bold mb-1 text-xs">
                          {news.category} • {news.date}
                        </div>
                        <h3 className="text-sm font-bold text-green-800 mb-1 line-clamp-2">
                          {news.title}
                        </h3>
                        {news.description && (
                          <p className="text-gray-600 text-xs line-clamp-2">
                            {news.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default CreateNewsPage;
