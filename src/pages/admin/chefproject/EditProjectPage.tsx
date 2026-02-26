import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import { supabase } from '../../../supabaseClient';
import ImageUpload from '../../../components/admin/ImageUpload';
import MultipleFileUpload from '../../../components/admin/MultipleFileUpload';
import FileUpload from '../../../components/admin/FileUpload';
import RichTextEditor from '../../../components/admin/RichTextEditor';
import { ArrowLeft, FolderKanban, FileText, Plus, Trash2, CheckCircle, Clock, Save, ChevronRight, ChevronLeft, Upload, ListChecks } from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
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

const steps = [
    { id: 1, label: 'Informations', icon: FolderKanban, description: 'Détails du projet' },
    { id: 2, label: 'Documents', icon: Upload, description: 'Fichiers de référence' },
    { id: 3, label: 'Livrables', icon: ListChecks, description: 'Tâches attendues' },
];

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

    const [currentStep, setCurrentStep] = useState(1);
    const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
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

    const handleSubmitProject = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
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
                    setCurrentStep(3);
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

    const goToStep = (step: number) => {
        if (step === 3 && !isEditing) return; // Can't go to step 3 without a project
        setDirection(step > currentStep ? 1 : -1);
        setCurrentStep(step);
    };

    const nextStep = () => {
        if (currentStep < 3) {
            // On step 1 or 2, auto-save before going to next if creating
            if (currentStep === 2 && !isEditing) {
                handleSubmitProject();
                return;
            }
            setDirection(1);
            setCurrentStep(prev => prev + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setDirection(-1);
            setCurrentStep(prev => prev - 1);
        }
    };

    // Animation variants for step transitions (bottom to top)
    const stepVariants = {
        enter: (dir: number) => ({
            y: dir > 0 ? 60 : -60,
            opacity: 0,
        }),
        center: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.35, ease: 'easeOut' },
        },
        exit: (dir: number) => ({
            y: dir > 0 ? -60 : 60,
            opacity: 0,
            transition: { duration: 0.25, ease: 'easeIn' },
        }),
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
            <div className="bg-white shadow-sm sticky top-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mb-6">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <motion.button
                        onClick={handleBack}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors duration-200 group"
                    >
                        <ArrowLeft size={20} />
                        <span className="hidden sm:inline">Retour à la liste</span>
                    </motion.button>

                    <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate mx-4">
                        {isEditing ? 'Modifier le projet' : 'Nouveau projet'}
                    </h1>

                    <div className="flex items-center gap-2">
                        {(currentStep === 1 || currentStep === 2) && (
                            <button
                                onClick={() => handleSubmitProject()}
                                disabled={loading}
                                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-semibold text-sm"
                            >
                                <Save size={16} />
                                <span className="hidden sm:inline">{loading ? 'Enregistrement...' : isEditing ? 'Sauvegarder' : 'Créer'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 lg:px-0">
                {/* Desktop Stepper */}
                <div className="hidden md:block mb-8">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => {
                            const StepIcon = step.icon;
                            const isActive = currentStep === step.id;
                            const isCompleted = currentStep > step.id;
                            const isDisabled = step.id === 3 && !isEditing;

                            return (
                                <React.Fragment key={step.id}>
                                    <button
                                        onClick={() => goToStep(step.id)}
                                        disabled={isDisabled}
                                        className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-300 group ${isActive
                                                ? 'bg-green-600 text-white shadow-lg shadow-green-200'
                                                : isCompleted
                                                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                    : isDisabled
                                                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                                            }`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-all ${isActive
                                                ? 'bg-white/20'
                                                : isCompleted
                                                    ? 'bg-green-200 text-green-700'
                                                    : 'bg-gray-100 text-gray-400'
                                            }`}>
                                            {isCompleted ? <CheckCircle size={18} /> : <StepIcon size={18} />}
                                        </div>
                                        <div className="text-left">
                                            <p className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-white/70' : ''}`}>
                                                Étape {step.id}
                                            </p>
                                            <p className={`text-sm font-semibold ${isActive ? 'text-white' : ''}`}>
                                                {step.label}
                                            </p>
                                        </div>
                                    </button>
                                    {index < steps.length - 1 && (
                                        <div className={`flex-1 h-0.5 mx-3 rounded-full transition-all duration-500 ${currentStep > step.id ? 'bg-green-400' : 'bg-gray-200'
                                            }`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Mobile Step Indicator */}
                <div className="md:hidden mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-green-600">
                            Étape {currentStep} / {steps.length}
                        </span>
                        <span className="text-sm text-gray-500 font-medium">
                            {steps[currentStep - 1].label}
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                            className="bg-green-600 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${(currentStep / steps.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <AnimatePresence mode="wait" custom={direction}>
                        {currentStep === 1 && (
                            <motion.div
                                key="step1"
                                custom={direction}
                                variants={stepVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                className="p-6 md:p-8"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                                        <FolderKanban size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-800">Informations du projet</h2>
                                        <p className="text-sm text-gray-500">Définissez les détails principaux</p>
                                    </div>
                                </div>

                                <form className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Titre du projet *</label>
                                            <input
                                                type="text"
                                                value={projectForm.title || ''}
                                                onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                                                required
                                                placeholder="Ex: Reboisement de la mangrove"
                                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm bg-gray-50 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Chef de projet</label>
                                            <input
                                                type="text"
                                                value={projectForm.manager || ''}
                                                onChange={(e) => setProjectForm({ ...projectForm, manager: e.target.value })}
                                                placeholder="Nom du responsable"
                                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm bg-gray-50 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Partenaire (optionnel)</label>
                                            <select
                                                value={projectForm.partner_id || ''}
                                                onChange={(e) => setProjectForm({ ...projectForm, partner_id: e.target.value || null })}
                                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm bg-gray-50 focus:bg-white"
                                            >
                                                <option value="">-- Aucun partenaire --</option>
                                                {partners.map((partner) => (
                                                    <option key={partner.id} value={partner.id}>
                                                        {partner.full_name || partner.email}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Statut</label>
                                            <select
                                                value={projectForm.status || 'planifie'}
                                                onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm bg-gray-50 focus:bg-white"
                                            >
                                                <option value="planifie">Planifié</option>
                                                <option value="en_cours">En cours</option>
                                                <option value="termine">Terminé</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Description détaillée</label>
                                        <RichTextEditor
                                            value={projectForm.description || ''}
                                            onChange={(html) => setProjectForm({ ...projectForm, description: html })}
                                            placeholder="Objectifs, contexte, enjeux..."
                                            rows={6}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Date de début</label>
                                            <input
                                                type="date"
                                                value={projectForm.start_date || ''}
                                                onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm bg-gray-50 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Fin prévue</label>
                                            <input
                                                type="date"
                                                value={projectForm.end_date || ''}
                                                onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
                                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm bg-gray-50 focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                </form>
                            </motion.div>
                        )}

                        {currentStep === 2 && (
                            <motion.div
                                key="step2"
                                custom={direction}
                                variants={stepVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                className="p-6 md:p-8"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                        <Upload size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-800">Documents de référence</h2>
                                        <p className="text-sm text-gray-500">Image de couverture et fichiers associés</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            </motion.div>
                        )}

                        {currentStep === 3 && (
                            <motion.div
                                key="step3"
                                custom={direction}
                                variants={stepVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                className="p-6 md:p-8"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                                        <ListChecks size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-800">Livrables attendus</h2>
                                        <p className="text-sm text-gray-500">Définissez les tâches et livrables du projet</p>
                                    </div>
                                </div>

                                {!isEditing ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <ListChecks size={48} className="mx-auto mb-4 opacity-30" />
                                        <p className="font-medium">Créez d'abord le projet pour ajouter des livrables</p>
                                        <p className="text-sm mt-1">Cliquez sur "Créer" dans le header pour commencer</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* Add task form */}
                                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                                            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                                <Plus className="text-green-600" size={18} />
                                                Ajouter un livrable
                                            </h3>
                                            <form onSubmit={handleAddTask} className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Titre *</label>
                                                        <input
                                                            type="text"
                                                            value={newTaskForm.title || ''}
                                                            onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                                                            required
                                                            placeholder="Titre du livrable"
                                                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-sm bg-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Échéance</label>
                                                        <input
                                                            type="date"
                                                            value={newTaskForm.due_date || ''}
                                                            onChange={(e) => setNewTaskForm({ ...newTaskForm, due_date: e.target.value })}
                                                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-sm bg-white"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Description</label>
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
                                                    <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-2.5 rounded-xl hover:bg-green-700 font-semibold text-sm shadow-sm transition-all disabled:opacity-50">
                                                        {loading ? 'Ajout...' : 'Ajouter le livrable'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>

                                        {/* Existing tasks */}
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-700 mb-3">
                                                Livrables enregistrés ({projectTasks.length})
                                            </h3>
                                            {projectTasks.length === 0 ? (
                                                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                                                    Aucun livrable pour le moment
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {projectTasks.map(task => (
                                                        <div key={task.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-all flex items-center justify-between group">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={task.status === 'terminee' ? 'text-green-500' : 'text-blue-500'}>
                                                                    {task.status === 'terminee' ? <CheckCircle size={20} /> : <Clock size={20} />}
                                                                </div>
                                                                <div className="truncate">
                                                                    <h4 className="font-semibold text-gray-800 text-sm truncate">{task.title}</h4>
                                                                    <p className="text-xs text-gray-400">{task.due_date || 'Pas de date'}</p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => deleteTask(task.id)} className="text-red-400 hover:text-red-600 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="border-t border-gray-100 px-6 md:px-8 py-4 flex items-center justify-between bg-gray-50/50">
                        <button
                            onClick={prevStep}
                            disabled={currentStep === 1}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${currentStep === 1
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <ChevronLeft size={18} />
                            Précédent
                        </button>

                        <div className="flex gap-1.5">
                            {steps.map(step => (
                                <div
                                    key={step.id}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${currentStep === step.id
                                            ? 'w-8 bg-green-600'
                                            : currentStep > step.id
                                                ? 'w-3 bg-green-300'
                                                : 'w-3 bg-gray-200'
                                        }`}
                                />
                            ))}
                        </div>

                        {currentStep < 3 ? (
                            <button
                                onClick={nextStep}
                                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-all shadow-sm"
                            >
                                Suivant
                                <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={() => handleSubmitProject()}
                                disabled={loading}
                                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-all shadow-sm disabled:opacity-50"
                            >
                                <Save size={16} />
                                {loading ? 'Enregistrement...' : 'Finaliser'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditProjectPage;
