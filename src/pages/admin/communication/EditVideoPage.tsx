import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import ImageUpload from '../../../components/admin/ImageUpload';
import FileUpload from '../../../components/admin/FileUpload';
import { ArrowLeft, Save } from 'lucide-react';
import { useNotifications } from '../../../hooks/useNotifications';
import useUserRole from '../../../hooks/useUserRole';
import { supabase } from '../../../supabaseClient';
import { motion } from 'framer-motion';

interface Video {
    id: number;
    title: string;
    description?: string | null;
    videourl?: string | null;
    filepath?: string | null;
    thumbnailpath?: string | null;
    date?: string | null;
    created_at?: string | null;
}

const EditVideoPage: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;

    const { data: videos, create, update, loading: videosLoading } = useCrud<Video>({ tableName: 'videos' });
    const { role, userId: currentUserId } = useUserRole();
    const { createNotification } = useNotifications(currentUserId);
    const [actorProfile, setActorProfile] = useState<any>(null);

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<Video>>({
        title: '',
        description: '',
        videourl: '',
        filepath: '',
        thumbnailpath: '',
        date: '',
    });

    const video = useMemo(() => {
        if (!isEditing || !videos) return null;
        return videos.find(v => v.id === parseInt(id!));
    }, [id, isEditing, videos]);

    useEffect(() => {
        if (currentUserId) {
            supabase.from('user_profiles').select('*').eq('id', currentUserId).single().then(({ data }) => setActorProfile(data));
        }
    }, [currentUserId]);

    useEffect(() => {
        if (isEditing && video) {
            setFormData(video);
        }
    }, [isEditing, video]);

    const handleBack = () => {
        navigate('/admin/videos');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload: any = { ...formData };
            // Clean date
            payload.date = payload.date?.trim() || null;

            if (isEditing && id) {
                await update(parseInt(id), payload);
                alert('Vidéo mise à jour avec succès');
            } else {
                const newVideo = await create(payload);
                if (newVideo) {
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
                                type: 'video_published',
                                title: 'Nouvelle Vidéo Publiée',
                                message: `${actorName} (${actorRole}) a publié une nouvelle vidéo : ${payload.title}`,
                                link: '/videos'
                            });
                        }
                    }
                }
                alert('Vidéo créée avec succès');
                navigate('/admin/videos');
            }
        } catch (err: any) {
            alert(`Erreur: ${err.message || 'Erreur lors de l\'enregistrement'}`);
        } finally {
            setLoading(false);
        }
    };

    if (isEditing && videosLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Bouton retour */}
            <div className="bg-white shadow-sm sticky top-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 mb-6">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <motion.button
                        onClick={handleBack}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors duration-200 group"
                    >
                        <ArrowLeft size={20} />
                        <span>Retour à la liste</span>
                    </motion.button>

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-bold"
                    >
                        <Save size={18} />
                        {loading ? 'Enregistrement...' : isEditing ? 'Sauvegarder' : 'Créer la vidéo'}
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 lg:px-0">
                <h1 className="text-3xl font-bold text-gray-800 mb-8">
                    {isEditing ? `Modifier la vidéo: ${formData.title}` : 'Ajouter une nouvelle vidéo'}
                </h1>

                <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Titre *</label>
                                <input
                                    type="text"
                                    value={formData.title || ''}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Date</label>
                                <input
                                    type="date"
                                    value={formData.date || ''}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                            <textarea
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">URL Vidéo (YouTube, Vimeo...)</label>
                            <input
                                type="url"
                                value={formData.videourl || ''}
                                onChange={(e) => setFormData({ ...formData, videourl: e.target.value })}
                                placeholder="https://youtube.com/..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <FileUpload
                                value={formData.filepath || ''}
                                onChange={(url) => setFormData({ ...formData, filepath: url })}
                                bucket="ong-backend"
                                folder="videos/files"
                                label="Fichier vidéo (Supabase Storage)"
                                accept="video/*"
                                maxSizeMB={200}
                            />
                            <ImageUpload
                                value={formData.thumbnailpath || ''}
                                onChange={(url) => setFormData({ ...formData, thumbnailpath: url })}
                                bucket="ong-backend"
                                folder="videos/images"
                                label="Vignette"
                            />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditVideoPage;
