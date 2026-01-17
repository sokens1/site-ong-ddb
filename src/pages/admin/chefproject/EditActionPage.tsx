import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import ImageUpload from '../../../components/admin/ImageUpload';
import { ArrowLeft, Save } from 'lucide-react';
import { motion } from 'framer-motion';

interface Action {
    id: number;
    title: string;
    description: string;
    image: string;
    category: string;
    date: string;
    created_at?: string;
}

const EditActionPage: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;

    const { data: actions, create, update, loading: actionsLoading } = useCrud<Action>({ tableName: 'actions' });

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<Action>>({
        title: '',
        description: '',
        image: '',
        category: '',
        date: '',
    });

    const action = useMemo(() => {
        if (!isEditing || !actions) return null;
        return actions.find(a => a.id === parseInt(id!));
    }, [id, isEditing, actions]);

    useEffect(() => {
        if (isEditing && action) {
            setFormData(action);
        }
    }, [isEditing, action]);

    const handleBack = () => {
        navigate('/admin/actions');
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
                alert('Action mise à jour avec succès');
            } else {
                await create(payload);
                alert('Action créée avec succès');
                navigate('/admin/actions');
            }
        } catch (err: any) {
            alert(`Erreur: ${err.message || 'Erreur lors de l\'enregistrement'}`);
        } finally {
            setLoading(false);
        }
    };

    if (isEditing && actionsLoading) {
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
                        {loading ? 'Enregistrement...' : isEditing ? 'Sauvegarder' : 'Créer l\'action'}
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 lg:px-0">
                <h1 className="text-3xl font-bold text-gray-800 mb-8">
                    {isEditing ? `Modifier l'action: ${formData.title}` : 'Ajouter une nouvelle action'}
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
                                <label className="block text-sm font-bold text-gray-700 mb-2">Catégorie *</label>
                                <input
                                    type="text"
                                    value={formData.category || ''}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
                            <input
                                type="date"
                                value={formData.date || ''}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Description *</label>
                            <textarea
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                required
                                rows={6}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <div>
                            <ImageUpload
                                value={formData.image || ''}
                                onChange={(url) => setFormData({ ...formData, image: url })}
                                bucket="ong-backend"
                                folder="actions/images"
                                label="Image *"
                                required
                            />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditActionPage;
