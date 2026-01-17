import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import DataTable from '../../../components/admin/DataTable';
import SearchBar from '../../../components/admin/SearchBar';
import { List, Grid, Plus, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';



interface Project {
    id: number;
    title: string;
    description?: string | null;
    status?: string | null; // ex: 'planifie', 'en_cours', 'termine'
    start_date?: string | null;
    end_date?: string | null;
    manager?: string | null;
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

const ProjectsAdmin: React.FC = () => {
    const navigate = useNavigate();
    const {
        data: projects,
        loading,
        error,
        delete: deleteProject,
    } = useCrud<Project>({ tableName: 'projects' });

    const {
        data: tasks,
        error: tasksError,
    } = useCrud<ProjectTask>({ tableName: 'project_tasks' });
    const { canCreate, canEdit, canDelete } = useUserRole();

    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const q = searchQuery.toLowerCase();
        return projects.filter((p) =>
            (p.title || '').toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.status || '').toLowerCase().includes(q) ||
            (p.manager || '').toLowerCase().includes(q)
        );
    }, [projects, searchQuery]);

    const handleAddProject = () => {
        navigate('/admin/projects/create');
    };

    const handleViewProject = (project: Project) => {
        navigate(`/admin/projects/${project.id}`);
    };

    const handleEditProject = (project: Project) => {
        navigate(`/admin/projects/edit/${project.id}`);
    };

    const handleDeleteProject = async (project: Project) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer le projet "${project.title}" ?`)) {
            try {
                await deleteProject(project.id);
            } catch (_err) {
                alert('Erreur lors de la suppression du projet');
            }
        }
    };




    const columns = [
        { key: 'title', label: 'Projet' },
        {
            key: 'status',
            label: 'Statut',
            render: (value: string) => {
                const label =
                    value === 'termine'
                        ? 'Terminé'
                        : value === 'en_cours'
                            ? 'En cours'
                            : value === 'planifie'
                                ? 'Planifié'
                                : value || '-';
                const color =
                    value === 'termine'
                        ? 'bg-green-100 text-green-800'
                        : value === 'en_cours'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800';
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
                        {label}
                    </span>
                );
            },
        },
        {
            key: 'progress',
            label: 'Avancement',
            render: (_: any, row: Project) => {
                const projTasks = tasks.filter((t) => t.project_id === row.id);
                const doneCount = projTasks.filter((t) => t.status === 'terminee').length;
                const totalCount = projTasks.length;
                const percent =
                    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                return (
                    <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-600 w-14 text-right">
                            {totalCount > 0 ? `${percent}%` : '-'}
                        </span>
                    </div>
                );
            },
        },
        { key: 'manager', label: 'Chef de projet' },
        { key: 'start_date', label: 'Début' },
        { key: 'end_date', label: 'Fin prévue' },
    ];

    return (
        <div className="w-full max-w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-800">Gestion des Projets</h1>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded transition ${viewMode === 'grid'
                                ? 'bg-white text-green-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                            title="Vue carte"
                        >
                            <Grid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded transition ${viewMode === 'list'
                                ? 'bg-white text-green-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                            title="Vue liste"
                        >
                            <List size={20} />
                        </button>
                    </div>
                    {canCreate('projects') && (
                        <button
                            onClick={handleAddProject}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                        >
                            <Plus size={20} />
                            Ajouter un projet
                        </button>
                    )}
                </div>
            </div>

            {(error || tasksError) && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 space-y-1 text-sm">
                    {error && <div>{error}</div>}
                    {tasksError && <div>{tasksError}</div>}
                </div>
            )}

            <div className="mb-4">
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Rechercher par titre, statut ou chef de projet..."
                    className="max-w-md"
                />
                {searchQuery && (
                    <p className="text-sm text-gray-600 mt-2">
                        {filteredProjects.length} projet(s) trouvé(s)
                    </p>
                )}
            </div>

            {loading ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
                        <div className="space-y-3">
                            <div className="h-12 bg-gray-200 rounded" />
                            <div className="h-12 bg-gray-200 rounded" />
                            <div className="h-12 bg-gray-200 rounded" />
                        </div>
                    </div>
                </div>
            ) : viewMode === 'list' ? (
                <DataTable
                    columns={columns}
                    data={filteredProjects}
                    onEdit={canEdit('projects') ? handleEditProject : undefined}
                    onDelete={canDelete('projects') ? handleDeleteProject : undefined}
                    onAdd={canCreate('projects') ? handleAddProject : undefined}
                    title="Projets"
                    isLoading={false}
                />
            ) : (
                <div className="bg-white rounded-lg shadow-md p-3 w-full max-w-full">
                    {filteredProjects.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>{searchQuery ? 'Aucun projet trouvé' : 'Aucun projet disponible'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 w-full">
                            {filteredProjects.map((project) => {
                                const projTasks = tasks.filter((t) => t.project_id === project.id);
                                const doneCount = projTasks.filter((t) => t.status === 'terminee').length;
                                const totalCount = projTasks.length;
                                const percent =
                                    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                                return (
                                    <div
                                        key={project.id}
                                        className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 w-full max-w-full flex flex-col"
                                    >
                                        {project.image_url && (
                                            <div className="h-40 overflow-hidden relative flex-shrink-0 bg-gray-100">
                                                <img
                                                    src={project.image_url}
                                                    alt={project.title}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {canEdit('projects') && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditProject(project);
                                                            }}
                                                            className="bg-white/95 backdrop-blur-sm p-2 rounded-lg text-blue-600 hover:bg-white transition shadow-sm"
                                                            title="Modifier"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    )}
                                                    {canDelete('projects') && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteProject(project);
                                                            }}
                                                            className="bg-white/95 backdrop-blur-sm p-2 rounded-lg text-red-600 hover:bg-white transition shadow-sm"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div className="p-3 flex flex-col flex-grow">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h3 className="text-sm font-bold text-green-800 leading-tight line-clamp-2">
                                                    {project.title}
                                                </h3>
                                                <span className="ml-2">
                                                    {project.status === 'termine' ? (
                                                        <CheckCircle className="text-green-500" size={18} />
                                                    ) : (
                                                        <Clock className="text-yellow-500" size={18} />
                                                    )}
                                                </span>
                                            </div>
                                            {project.description && (
                                                <p className="text-xs text-gray-600 mb-2 line-clamp-3 break-words overflow-hidden">
                                                    {project.description?.replace(/<[^>]*>?/gm, '')}
                                                </p>
                                            )}
                                            <div className="mb-2">
                                                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                                                    <span>Avancement</span>
                                                    <span>{totalCount > 0 ? `${percent}%` : '-'}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                    <div
                                                        className="bg-green-500 h-1.5 rounded-full"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-gray-500 mb-2">
                                                <span>Chef: {project.manager || '-'}</span>
                                                <span>
                                                    {project.start_date || '-'} → {project.end_date || '-'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px] text-gray-500 mt-auto pt-2 border-t border-gray-100">
                                                <span>
                                                    {totalCount === 0
                                                        ? 'Aucun livrable'
                                                        : `${doneCount}/${totalCount} livrable(s) terminé(s)`}
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleViewProject(project)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                    >
                                                        Voir le projet
                                                    </button>
                                                    {canEdit('projects') && (
                                                        <button
                                                            onClick={() => handleEditProject(project)}
                                                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                                                        >
                                                            Modifier
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProjectsAdmin;



