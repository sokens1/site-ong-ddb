import React, { useMemo, useState, useEffect } from 'react';

import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import { supabase } from '../../../supabaseClient';
import {
    ArrowLeft,
    FolderKanban,
    FileText,
    CheckCircle,
    Clock,
    Calendar,
    User,
    Paperclip,
    Handshake,
    Eye,
    Download
} from 'lucide-react';
import { motion } from 'framer-motion';

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

const ProjectDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [viewTab, setViewTab] = useState<'info' | 'tasks'>('info');
    const [partnerName, setPartnerName] = useState<string | null>(null);

    const { data: projects, loading: projectsLoading } = useCrud<Project>({ tableName: 'projects' });
    const { data: tasks, loading: tasksLoading } = useCrud<ProjectTask>({ tableName: 'project_tasks' });

    const project = useMemo(() => {
        if (!id || !projects) return null;
        return projects.find(p => p.id === parseInt(id));
    }, [id, projects]);

    const projectTasks = useMemo(() => {
        if (!id || !tasks) return [];
        return tasks.filter(t => t.project_id === parseInt(id));
    }, [id, tasks]);

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

    const handleBack = () => {
        navigate('/admin/projects');
    };

    // Fetch partner name
    useEffect(() => {
        const fetchPartner = async () => {
            if (project?.partner_id) {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('full_name, email')
                    .eq('id', project.partner_id)
                    .single();
                if (!error && data) {
                    setPartnerName(data.full_name || data.email);
                }
            } else {
                setPartnerName(null);
            }
        };
        fetchPartner();
    }, [project]);

    if (projectsLoading || tasksLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Projet non trouvé</h2>
                <button onClick={handleBack} className="text-green-600 hover:underline">
                    Retour à la liste
                </button>
            </div>
        );
    }

    const doneCount = projectTasks.filter((t) => t.status === 'terminee').length;
    const totalCount = projectTasks.length;
    const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

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
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Retour à la liste</span>
                    </motion.button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/admin/projects/edit/${project.id}`)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium"
                        >
                            Modifier le projet
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.title}</h1>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.status === 'termine' ? 'bg-green-100 text-green-800' :
                            project.status === 'en_cours' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {project.status === 'termine' ? 'Terminé' : project.status === 'en_cours' ? 'En cours' : 'Planifié'}
                        </span>
                        <span className="flex items-center gap-1">
                            <User size={14} /> {project.manager || 'Pas de chef de projet'}
                        </span>
                        {partnerName && (
                            <span className="flex items-center gap-1 text-purple-600">
                                <Handshake size={14} /> {partnerName}
                            </span>
                        )}
                    </div>
                </div>

                {/* Onglets */}
                <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-lg px-4 pt-1">
                    <button
                        onClick={() => setViewTab('info')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative ${viewTab === 'info' ? 'text-green-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <FolderKanban size={18} />
                        Informations
                        {viewTab === 'info' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />}
                    </button>
                    <button
                        onClick={() => setViewTab('tasks')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative ${viewTab === 'tasks' ? 'text-green-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <FileText size={18} />
                        Livrables
                        {totalCount > 0 && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold ml-1">
                                {totalCount}
                            </span>
                        )}
                        {viewTab === 'tasks' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Contenu Principal */}
                    <div className="lg:col-span-2 space-y-6">
                        {viewTab === 'info' ? (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                {project.image_url && (
                                    <div className="rounded-xl overflow-hidden shadow-sm bg-white border border-gray-200">
                                        <img src={project.image_url} alt={project.title} className="w-full h-[400px] object-cover" />
                                    </div>
                                )}

                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <h2 className="text-xl font-bold text-gray-800 mb-4">Description du projet</h2>
                                    <div
                                        className="prose prose-green max-w-none text-gray-700 leading-relaxed break-words overflow-hidden"
                                        dangerouslySetInnerHTML={{ __html: project.description || '<p className="text-gray-400 italic">Aucune description fournie.</p>' }}
                                    />
                                </div>

                                {/* Documents */}
                                {(() => {
                                    const documents = parseDocuments(project.document_url);
                                    if (documents.length === 0) return null;
                                    return (
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-gray-50 border-b border-gray-100">
                                                        <tr>
                                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Nom du document</th>
                                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase hidden md:table-cell">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {documents.map((docUrl, idx) => (
                                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                                <td className="px-4 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="bg-green-100 p-2 rounded-lg text-green-600">
                                                                            <FileText size={18} />
                                                                        </div>
                                                                        <span className="text-sm font-medium text-gray-900">Document {idx + 1}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <a href={docUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Visualiser">
                                                                            <Eye size={16} />
                                                                        </a>
                                                                        <a href={docUrl} download className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Télécharger">
                                                                            <Download size={16} />
                                                                        </a>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                {projectTasks.length === 0 ? (
                                    <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-500">
                                        <FileText className="mx-auto mb-4 text-gray-300" size={48} />
                                        <p className="text-lg font-medium">Aucun livrable défini</p>
                                        <p className="text-sm">Ce projet n'a pas encore de liste de tâches ou de livrables.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {projectTasks.map((task) => {
                                            const isDone = task.status === 'terminee';
                                            return (
                                                <div key={task.id} className={`bg-white rounded-xl border p-5 transition-all ${isDone ? 'border-green-200 bg-green-50/20' : 'border-gray-200 hover:border-blue-200'
                                                    }`}>
                                                    <div className="flex items-start gap-4">
                                                        <div className={`mt-1 flex-shrink-0 ${isDone ? 'text-green-600' : 'text-blue-600'}`}>
                                                            {isDone ? <CheckCircle size={24} /> : <Clock size={24} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isDone ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                                                    }`}>
                                                                    {isDone ? 'Terminée' : 'En cours'}
                                                                </span>
                                                            </div>
                                                            {task.description && (
                                                                <div
                                                                    className="text-sm text-gray-600 mb-4 line-clamp-2 prose prose-sm break-words"
                                                                    dangerouslySetInnerHTML={{ __html: task.description }}
                                                                />
                                                            )}
                                                            <div className="flex flex-wrap items-center gap-6 text-xs text-gray-500">
                                                                {task.due_date && <span className="flex items-center gap-1 font-medium text-gray-700">📅 Prévue: {task.due_date}</span>}
                                                                {task.completed_at && <span className="flex items-center gap-1 font-medium text-green-700">✅ Fait le: {task.completed_at.split('T')[0]}</span>}
                                                                {task.document_url && (
                                                                    <a href={task.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline font-bold">
                                                                        <Paperclip size={12} /> Voir le document
                                                                    </a>
                                                                )}
                                                            </div>
                                                            {task.comment && (
                                                                <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r text-sm italic text-yellow-800">
                                                                    "{task.comment}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Sidebar de détails */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Avancement global</h2>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-3xl font-bold text-green-600">{percent}%</span>
                                    <span className="text-sm text-gray-500">{doneCount}/{totalCount} livrables</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percent}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="bg-green-600 h-3 rounded-full shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Dates clés</h2>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-50 p-2 rounded text-blue-600"><Calendar size={18} /></div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Date de début</p>
                                        <p className="text-sm font-medium text-gray-900">{project.start_date || '-'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-50 p-2 rounded text-orange-600"><Calendar size={18} /></div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Fin prévue</p>
                                        <p className="text-sm font-medium text-gray-900">{project.end_date || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Livrables</h2>
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => navigate(`/admin/projects/edit/${project.id}`)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                                >
                                    Modifier le projet
                                </button>
                                <button
                                    onClick={() => {
                                        if (navigator.share) {
                                            navigator.share({ title: project.title, url: window.location.href });
                                        } else {
                                            navigator.clipboard.writeText(window.location.href);
                                            alert('Lien copié dans le presse-papier !');
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Partager
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bouton retour supplémentaire en bas pour les longues pages */}
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

export default ProjectDetailsPage;
