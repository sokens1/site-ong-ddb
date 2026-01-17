import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import ImageUpload from '../../../components/admin/ImageUpload';
import RichTextEditor from '../../../components/admin/RichTextEditor';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNotifications } from '../../../hooks/useNotifications';
import useUserRole from '../../../hooks/useUserRole';
import { supabase } from '../../../supabaseClient';

interface News {
  id: number;
  title: string;
  content: string;
  image: string;
  image2?: string;
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
  const { role, userId: currentUserId } = useUserRole();
  const { createNotification } = useNotifications(currentUserId);
  const [actorProfile, setActorProfile] = useState<any>(null);
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
    image2: '',
    category: '',
    date: getCurrentDateTime(),
    description: '',
    status: 'published',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUserId) {
      supabase.from('user_profiles').select('*').eq('id', currentUserId).single().then(({ data }) => setActorProfile(data));
    }
  }, [currentUserId]);

  // Charger les données si on est en mode édition
  useEffect(() => {
    if (isEditing && id && data) {
      const newsItem = data.find((item) => item.id === parseInt(id));
      if (newsItem) {
        let dateValue = getCurrentDateTime();
        if (newsItem.date) {
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
          } catch (e) { }
        }
        setFormData({ ...newsItem, date: dateValue });
      }
    }
  }, [id, isEditing, data]);

  const handleBack = () => { navigate('/admin/news'); };

  const handleSaveDraft = async () => {
    try {
      setLoading(true);
      let dateValue = formData.date || getCurrentDateTime();
      if (dateValue.includes('T')) dateValue = dateValue.split('T')[0];

      const dataToSubmit: any = {
        title: formData.title || '',
        content: formData.content || '',
        image: formData.image || '',
        image2: formData.image2 || '',
        category: formData.category || '',
        date: dateValue,
        description: formData.description || '',
        status: 'draft',
      };

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
      let dateValue = formData.date || getCurrentDateTime();
      if (dateValue.includes('T')) dateValue = dateValue.split('T')[0];

      const dataToSubmit: any = {
        title: formData.title || '',
        content: formData.content || '',
        image: formData.image || '',
        image2: formData.image2 || '',
        category: formData.category || '',
        date: dateValue,
        description: formData.description || '',
        status: 'published',
      };

      if (isEditing && id) {
        await update(parseInt(id), dataToSubmit);
      } else {
        const newNews = await create(dataToSubmit);
        if (newNews) {
          const { data: profiles } = await supabase.from('user_profiles').select('id');
          if (profiles) {
            const actorName = actorProfile?.full_name || 'Un membre de l\'équipe';
            const actorRole = role?.replace('_', ' ') || 'Membre';

            for (const profile of profiles) {
              if (profile.id === currentUserId) continue;
              await createNotification({
                user_id: profile.id,
                actor_id: currentUserId || undefined,
                actor_name: actorName,
                actor_role: actorRole,
                type: 'news_published',
                title: 'Nouvelle Actualité',
                message: `${actorName} (${actorRole}) a publié : ${dataToSubmit.title}`,
                link: `/article/${newNews.id}` // Using article link for public view or admin view
              });
            }
          }
        }
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
    if (window.confirm('Êtes-vous sûr de vouloir annuler ?')) navigate('/admin/news');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <button onClick={handleBack} className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium">
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold text-gray-800 mb-8">
                {isEditing ? 'Modifier une actualité' : 'Créer une actualité'}
              </h1>

              <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Titre *</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contenu *</label>
                  <RichTextEditor
                    value={formData.content || ''}
                    onChange={(html) => setFormData({ ...formData, content: html })}
                    placeholder="Contenu de l'actualité"
                    rows={12}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ImageUpload
                    value={formData.image || ''}
                    onChange={(url) => setFormData({ ...formData, image: url })}
                    bucket="ong-backend"
                    folder="news/images"
                    label="Image principale"
                    required
                  />
                  <ImageUpload
                    value={formData.image2 || ''}
                    onChange={(url) => setFormData({ ...formData, image2: url })}
                    bucket="ong-backend"
                    folder="news/images"
                    label="Image secondaire"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie *</label>
                    <input
                      type="text"
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                    <input
                      type="datetime-local"
                      value={formData.date || getCurrentDateTime()}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-4">
                <button onClick={handleCancel} className="px-6 py-2 border border-gray-300 rounded-lg">Annuler</button>
                <button onClick={handleSaveDraft} disabled={loading} className="px-6 py-2 bg-gray-600 text-white rounded-lg">Brouillon</button>
                <button onClick={handlePublish} disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg">Publier</button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateNewsPage;
