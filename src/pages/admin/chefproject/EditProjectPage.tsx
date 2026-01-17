import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import { supabase } from '../../../supabaseClient';
import ImageUpload from '../../../components/admin/ImageUpload';
import MultipleFileUpload from '../../../components/admin/MultipleFileUpload';
import FileUpload from '../../../components/admin/FileUpload';
import RichTextEditor from '../../../components/admin/RichTextEditor';
import { ArrowLeft, FolderKanban, FileText, Plus, Trash2, CheckCircle, Clock, Save } from 'lucide-react';

import { motion } from 'framer-motion';
import { useNotifications } from '../../../hooks/useNotifications';
import useUserRole from '../../../hooks/useUserRole';

interface Project {
    id: number;
    title: string;
    description?: string | null;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    manager?: string | null;
    partner_id?: string | null;
    document_url?: string | null;
    image_url?: string | null;
    created_at?: string | null;
}

interface Partner {
    id: string;
    full_name: string | null;
    email: string;
}

interface ProjectTask {
    id: number;
    project_id: number;
    title: string;
    description?: string | null;
    status?: string | null;
    due_date?: string | null;
    completed_at?: string | null;
    comment?: string | null;
    document_url?: string | null;
    created_at?: string | null;
}

const EditProjectPage: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;

    const { data: projects, create, update, loading: projectsLoading } = useCrud<Project>({ tableName: 'projects' });
    const {
        data: tasks,
        create: createTask,
        delete: deleteTask,
    } = useCrud<ProjectTask>({ tableName: 'project_tasks' });

    const { role, userId: currentUserId } = useUserRole();
    const { createNotification } = useNotifications(currentUserId);

    const [activeTab, setActiveTab] = useState<'project' | 'tasks'>('project');
    const [loading, setLoading] = useState(false);
    const [projectForm, setProjectForm] = useState<Partial<Project>>({
        title: '',
        description: '',
        status: 'planifie',
        start_date: '',
        end_date: '',
        manager: '',
        partner_id: '',
        document_url: '',
        image_url: '',
    });
    const [partners, setPartners] = useState<Partner[]>([]);
    const [actorProfile, setActorProfile] = useState<any>(null);
    const [projectDocuments, setProjectDocuments] = useState<string[]>([]);
    const [newTaskForm, setNewTaskForm] = useState<Partial<ProjectTask>>({
        title: '',
        description: '',
        status: 'en_cours',
        due_date: '',
        comment: '',
        document_url: '',
    });

    // Helper functions
    const parseDocuments = (documentUrl: string | null | undefined): string[] => {
        if (!documentUrl) return [];
        try {
            const parsed = JSON.parse(documentUrl);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            return [documentUrl];
        }
        return [];
    };

    const stringifyDocuments = (documents: string[]): string | null => {
        if (documents.length === 0) return null;
        return JSON.stringify(documents);
    };

    // Memoized current project and its tasks
    const project = useMemo(() => {
        if (!isEditing || !projects) return null;
        return projects.find(p => p.id === parseInt(id!));
    }, [id, isEditing, projects]);

    const projectTasks = useMemo(() => {
        if (!isEditing || !tasks) return [];
        return tasks.filter(t => t.project_id === parseInt(id!));
    }, [id, isEditing, tasks]);

    // Load project data
    useEffect(() => {
        if (isEditing && project) {
            setProjectForm(project);
            setProjectDocuments(parseDocuments(project.document_url));
        }
    }, [isEditing, project]);

    // Fetch actor profile
    useEffect(() => {
        if (currentUserId) {
            supabase.from('user_profiles').select('*').eq('id', currentUserId).single().then(({ data }) => setActorProfile(data));
        }
    }, [currentUserId]);

    // Fetch partners
    useEffect(() => {
        const fetchPartners = async () => {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('id, full_name, email')
                .eq('role', 'partenaire');
            if (!error && data) {
                setPartners(data);
            }
        };
        fetchPartners();
    }, []);

    const handleBack = () => {
        navigate('/admin/projects');
    };

    const handleSubmitProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload: any = { ...projectForm };
            payload.document_url = stringifyDocuments(projectDocuments);

            // Clean dates
            payload.start_date = payload.start_date?.trim() || null;
            payload.end_date = payload.end_date?.trim() || null;

            if (isEditing && id) {
                await update(parseInt(id), payload);
                alert('Projet mis à jour avec succès');
            } else {
                const newProject = await create(payload);
                if (newProject) {
                    const actorName = actorProfile?.full_name || 'Un membre de l\'équipe';
                    const actorRole = role?.replace('_', ' ') || 'Membre';

                    // 1. Notify all users about project creation
                    const { data: profiles } = await supabase.from('user_profiles').select('id');
                    if (profiles) {
                        for (const profile of profiles) {
                            if (profile.id === currentUserId) continue;
                            await createNotification({
                                user_id: profile.id,
                                actor_id: currentUserId || undefined,
                                actor_name: actorName,
                                actor_role: actorRole,
                                type: 'project_created',
                                title: 'Nouveau Projet Créé',
                                message: `${actorName} (${actorRole}) a créé le projet : ${payload.title}`,
                                link: `/admin/projects/${newProject.id}`
                            });
                        }
                    }

                    // 2. Notify assigned partner (specific message)
                    if (payload.partner_id && payload.partner_id !== currentUserId) {
                        await createNotification({
                            user_id: payload.partner_id,
                            actor_id: currentUserId || undefined,
                            actor_name: actorName,
                            actor_role: actorRole,
                            type: 'project_assigned',
                            title: 'Nouveau projet assigné',
                            message: `Vous avez été assigné au projet : ${payload.title}`,
                            link: `/admin/projects/${newProject.id}`
                        });
                    }

                    navigate(`/admin/projects/edit/${newProject.id}`);
                    setActiveTab('tasks');
                    alert('Projet créé avec succès. Vous pouvez maintenant ajouter des livrables.');
                }
            }
        } catch (err: any) {
            alert(`Erreur: ${err.message || 'Erreur lors de l\'enregistrement'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        try {
            setLoading(true);
            await createTask({
                ...newTaskForm,
                project_id: parseInt(id),
            });
            setNewTaskForm({
                title: '',
                description: '',
                status: 'en_cours',
                due_date: '',
                comment: '',
                document_url: '',
            });
            alert('Livrable ajouté');
        } catch (err) {
            alert('Erreur lors de l\'ajout du livrable');
        } finally {
            setLoading(false);
        }
    };

    if (isEditing && projectsLoading) {
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
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <motion.button
                        onClick={handleBack}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors duration-200 group"
                    >
                        <ArrowLeft size={20} />
                        <span>Retour à la liste</span>
                    </motion.button>

                    <div className="flex items-center gap-3">
                        {activeTab === 'project' && (
                            <button
                                onClick={(e) => handleSubmitProject(e)}
                                disabled={loading}
                                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-bold"
                            >
                                <Save size={18} />
                                {loading ? 'Enregistrement...' : isEditing ? 'Sauvegarder les modifications' : 'Créer le projet'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 lg:px-0">
                <h1 className="text-3xl font-bold text-gray-800 mb-8">
                    {isEditing ? `Modifier le projet: ${projectForm.title}` : 'Créer un nouveau projet'}
                </h1>

                <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                    {/* Onglets */}
                    <div className="flex border-b border-gray-200 bg-gray-50/50">
                        <button
                            onClick={() => setActiveTab('project')}
                            className={`flex items-center gap-2 px-8 py-4 text-sm font-bold transition-colors relative ${activeTab === 'project' ? 'text-green-600 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            <FolderKanban size={18} />
                            Informations Générales
                            {activeTab === 'project' && <div className="absolute top-0 left-0 right-0 h-1 bg-green-600" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`flex items-center gap-2 px-8 py-4 text-sm font-bold transition-colors relative ${activeTab === 'tasks' ? 'text-green-600 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!isEditing}
                            title={!isEditing ? 'Vous devez dabord créer le projet' : ''}
                        >
                            <FileText size={18} />
                            Livrables du projet
                            {isEditing && (
                                <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs font-bold ml-1">
                                    {projectTasks.length}
                                </span>
                            )}
                            {activeTab === 'tasks' && <div className="absolute top-0 left-0 right-0 h-1 bg-green-600" />}
                        </button>
                    </div>

                    <div className="p-8">
                        {activeTab === 'project' ? (
                            <form onSubmit={handleSubmitProject} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Titre du projet *</label>
                                        <input
                                            type="text"
                                            value={projectForm.title || ''}
                                            onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                                            required
                                            placeholder="Ex: Reboisement de la mangrove"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Chef de projet</label>
                                        <input
                                            type="text"
                                            value={projectForm.manager || ''}
                                            onChange={(e) => setProjectForm({ ...projectForm, manager: e.target.value })}
                                            placeholder="Nom du responsable"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Assigner un partenaire (optionnel)</label>
                                        <select
                                            value={projectForm.partner_id || ''}
                                            onChange={(e) => setProjectForm({ ...projectForm, partner_id: e.target.value || null })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white"
                                        >
                                            <option value="">-- Aucun partenaire --</option>
                                            {partners.map((partner) => (
                                                <option key={partner.id} value={partner.id}>
                                                    {partner.full_name || partner.email}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Description détaillée</label>
                                    <RichTextEditor
                                        value={projectForm.description || ''}
                                        onChange={(html) => setProjectForm({ ...projectForm, description: html })}
                                        placeholder="Objectifs, contexte, enjeux..."
                                        rows={8}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Statut</label>
                                        <select
                                            value={projectForm.status || 'planifie'}
                                            onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white"
                                        >
                                            <option value="planifie">Planifié</option>
                                            <option value="en_cours">En cours</option>
                                            <option value="termine">Terminé</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Date de début</label>
                                        <input
                                            type="date"
                                            value={projectForm.start_date || ''}
                                            onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Fin prévue</label>
                                        <input
                                            type="date"
                                            value={projectForm.end_date || ''}
                                            onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                                    <ImageUpload
                                        value={projectForm.image_url || ''}
                                        onChange={(url) => setProjectForm({ ...projectForm, image_url: url })}
                                        bucket="ong-backend"
                                        folder="projects/images"
                                        label="Image de couverture *"
                                    />
                                    <MultipleFileUpload
                                        value={projectDocuments}
                                        onChange={(urls) => setProjectDocuments(urls)}
                                        bucket="ong-backend"
                                        folder="projects/files"
                                        label="Documents de référence"
                                    />
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-12">
                                <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 shadow-inner">
                                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                        <Plus className="text-green-600" size={24} />
                                        Ajouter un livrable
                                    </h3>
                                    <form onSubmit={handleAddTask} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="md:col-span-1">
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Titre du livrable *</label>
                                                <input
                                                    type="text"
                                                    value={newTaskForm.title || ''}
                                                    onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                                                    required
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Date d'échéance</label>
                                                <input
                                                    type="date"
                                                    value={newTaskForm.due_date || ''}
                                                    onChange={(e) => setNewTaskForm({ ...newTaskForm, due_date: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Description du livrable</label>
                                            <RichTextEditor
                                                value={newTaskForm.description || ''}
                                                onChange={(html) => setNewTaskForm({ ...newTaskForm, description: html })}
                                                rows={3}
                                            />
                                        </div>
                                        <div>
                                            <FileUpload
                                                value={newTaskForm.document_url || ''}
                                                onChange={(url) => setNewTaskForm({ ...newTaskForm, document_url: url })}
                                                bucket="ong-backend"
                                                folder="projects/tasks"
                                                label="Pièce jointe"
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button type="submit" className="bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 font-bold shadow-lg transition-all">
                                                {loading ? 'Ajout...' : 'Ajouter le livrable'}
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-800">Livrables enregistrés ({projectTasks.length})</h3>
                                    {projectTasks.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400 font-medium border-2 border-dashed border-gray-200 rounded-2xl">
                                            Aucun livrable pour le moment
                                        </div>
                                    ) : (
                                        <div className="grid gap-4">
                                            {projectTasks.map(task => (
                                                <div key={task.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={task.status === 'terminee' ? 'text-green-500' : 'text-blue-500'}>
                                                            {task.status === 'terminee' ? <CheckCircle size={24} /> : <Clock size={24} />}
                                                        </div>
                                                        <div className="truncate">
                                                            <h4 className="font-bold text-gray-800 truncate">{task.title}</h4>
                                                            <p className="text-xs text-gray-500">{task.due_date || 'Pas de date'}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => deleteTask(task.id)} className="text-red-400 hover:text-red-600 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 flex justify-center mt-12 mb-20">
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="bg-white border border-gray-200 text-gray-500 px-6 py-2 rounded-full shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-sm"
                >
                    Retour en haut ↑
                </button>
            </div>
        </div>
    );
};

export default EditProjectPage;
