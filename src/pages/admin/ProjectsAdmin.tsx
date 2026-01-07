import React, { useMemo, useState } from 'react';
import { useCrud } from '../../hooks/useCrud';
import DataTable from '../../components/admin/DataTable';
import Modal from '../../components/admin/Modal';
import FileUpload from '../../components/admin/FileUpload';
import MultipleFileUpload from '../../components/admin/MultipleFileUpload';
import ImageUpload from '../../components/admin/ImageUpload';
import RichTextEditor from '../../components/admin/RichTextEditor';
import SearchBar from '../../components/admin/SearchBar';
import { List, Grid, Plus, CheckCircle, Clock, Trash2, FolderKanban, FileText } from 'lucide-react';

interface Project {
  id: number;
  title: string;
  description?: string | null;
  status?: string | null; // ex: 'planifie', 'en_cours', 'termine'
  start_date?: string | null;
  end_date?: string | null;
  manager?: string | null;
  document_url?: string | null; // Peut être une string (ancien format) ou un JSON array (nouveau format)
  image_url?: string | null;
  created_at?: string | null;
}

interface ProjectTask {
  id: number;
  project_id: number;
  title: string;
  description?: string | null;
  status?: string | null; // 'en_cours' | 'terminee'
  due_date?: string | null;
  completed_at?: string | null;
  comment?: string | null;
  document_url?: string | null;
  created_at?: string | null;
}

const ProjectsAdmin: React.FC = () => {
  const {
    data: projects,
    loading,
    error,
    create,
    update,
    delete: deleteProject,
  } = useCrud<Project>({ tableName: 'projects' });

  const {
    data: tasks,
    loading: tasksLoading,
    error: tasksError,
    create: createTask,
    update: updateTask,
    delete: deleteTask,
  } = useCrud<ProjectTask>({ tableName: 'project_tasks' });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [viewTab, setViewTab] = useState<'info' | 'tasks'>('info');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [projectForm, setProjectForm] = useState<Partial<Project>>({
    title: '',
    description: '',
    status: 'planifie',
    start_date: '',
    end_date: '',
    manager: '',
    document_url: '',
    image_url: '',
  });
  const [projectDocuments, setProjectDocuments] = useState<string[]>([]); // Tableau des URLs de documents
  const [activeTab, setActiveTab] = useState<'project' | 'tasks'>('project');

  const [newTaskForm, setNewTaskForm] = useState<Partial<ProjectTask>>({
    title: '',
    description: '',
    status: 'en_cours',
    due_date: '',
    comment: '',
    document_url: '',
  });

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

  const projectTasks = useMemo(() => {
    if (!editingProject) return [];
    return tasks.filter((t) => t.project_id === editingProject.id);
  }, [tasks, editingProject]);

  // Fonction helper pour convertir document_url en tableau
  const parseDocuments = (documentUrl: string | null | undefined): string[] => {
    if (!documentUrl) return [];
    try {
      // Essayer de parser comme JSON array
      const parsed = JSON.parse(documentUrl);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Si ce n'est pas du JSON, c'est probablement une string simple (ancien format)
      return [documentUrl];
    }
    return [];
  };

  // Fonction helper pour convertir un tableau en document_url (JSON string)
  const stringifyDocuments = (documents: string[]): string | null => {
    if (documents.length === 0) return null;
    return JSON.stringify(documents);
  };

  const handleAddProject = () => {
    setEditingProject(null);
    setProjectForm({
      title: '',
      description: '',
      status: 'planifie',
      start_date: '',
      end_date: '',
      manager: '',
      document_url: '',
      image_url: '',
    });
    setProjectDocuments([]);
    setNewTaskForm({
      title: '',
      description: '',
      status: 'en_cours',
      due_date: '',
      comment: '',
      document_url: '',
    });
    setActiveTab('project');
    setIsModalOpen(true);
  };

  const handleViewProject = (project: Project) => {
    setViewingProject(project);
    setViewTab('info');
    setIsViewModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectForm(project);
    setProjectDocuments(parseDocuments(project.document_url));
    setNewTaskForm({
      title: '',
      description: '',
      status: 'en_cours',
      due_date: '',
      comment: '',
      document_url: '',
    });
    setActiveTab('project');
    setIsModalOpen(true);
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

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Nettoyer les données avant l'envoi
      const payload: any = {};
      
      // Ajouter uniquement les champs qui ont une valeur
      if (projectForm.title) payload.title = projectForm.title;
      if (projectForm.description) payload.description = projectForm.description;
      if (projectForm.status) payload.status = projectForm.status;
      if (projectForm.manager) payload.manager = projectForm.manager;
      if (projectForm.image_url) payload.image_url = projectForm.image_url;
      
      // Convertir le tableau de documents en JSON string
      const documentsJson = stringifyDocuments(projectDocuments);
      if (documentsJson) {
        payload.document_url = documentsJson;
      } else {
        payload.document_url = null;
      }
      
      // Gérer les dates : convertir les chaînes vides en null
      payload.start_date = projectForm.start_date && projectForm.start_date.trim() 
        ? projectForm.start_date.trim() 
        : null;
      payload.end_date = projectForm.end_date && projectForm.end_date.trim() 
        ? projectForm.end_date.trim() 
        : null;
      
      if (editingProject) {
        await update(editingProject.id, payload);
      } else {
        await create(payload);
      }
      setIsModalOpen(false);
      setEditingProject(null);
      setProjectForm({
        title: '',
        description: '',
        status: 'planifie',
        start_date: '',
        end_date: '',
        manager: '',
        document_url: '',
        image_url: '',
      });
      setProjectDocuments([]);
      setActiveTab('project');
    } catch (err: any) {
      const errorMessage = err.message || err.details || 'Erreur lors de l\'enregistrement du projet';
      alert(`Erreur: ${errorMessage}`);
      console.error('Erreur lors de l\'enregistrement:', err);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) {
      alert('Veuillez enregistrer le projet avant d\'ajouter des actions');
      return;
    }
    if (!newTaskForm.title || !newTaskForm.title.trim()) {
      alert('Le titre de l\'action est obligatoire');
      return;
    }

    try {
      const payload: Partial<ProjectTask> = {
        ...newTaskForm,
        project_id: editingProject.id,
        status: newTaskForm.status || 'en_cours',
        due_date: newTaskForm.due_date || null,
      };
      await createTask(payload);
      setNewTaskForm({
        title: '',
        description: '',
        status: 'en_cours',
        due_date: '',
        comment: '',
        document_url: '',
      });
    } catch (_err) {
      alert('Erreur lors de l\'ajout de l\'action');
    }
  };

  const handleMarkTaskDone = async (task: ProjectTask, comment?: string) => {
    try {
      await updateTask(task.id, {
        status: 'terminee',
        completed_at: new Date().toISOString(),
        comment: comment !== undefined ? comment : task.comment || '',
      });
    } catch (_err) {
      alert('Erreur lors de la mise à jour de l\'action');
    }
  };

  const handleDeleteTask = async (task: ProjectTask) => {
    if (!window.confirm(`Supprimer l'action "${task.title}" ?`)) return;
    try {
      await deleteTask(task.id);
    } catch (_err) {
      alert('Erreur lors de la suppression de l\'action');
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
              className={`p-2 rounded transition ${
                viewMode === 'grid'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vue carte"
            >
              <Grid size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition ${
                viewMode === 'list'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vue liste"
            >
              <List size={20} />
            </button>
          </div>
          <button
            onClick={handleAddProject}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <Plus size={20} />
            Ajouter un projet
          </button>
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
          onEdit={handleEditProject}
          onDelete={handleDeleteProject}
          onAdd={handleAddProject}
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
                        <p className="text-xs text-gray-600 mb-2 line-clamp-3">
                          {project.description}
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
                            ? 'Aucune action'
                            : `${doneCount}/${totalCount} action(s) terminée(s)`}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewProject(project)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Voir
                          </button>
                          <button
                            onClick={() => handleEditProject(project)}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            Modifier
                          </button>
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProject ? 'Modifier un projet' : 'Créer un projet'}
        size="md"
      >
        <div className="w-full max-w-full flex flex-col" style={{ height: 'calc(90vh - 120px)', maxHeight: 'calc(90vh - 120px)' }}>
          {/* Onglets - Fixes en haut */}
          <div className="flex border-b border-gray-200 mb-4 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={() => setActiveTab('project')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'project'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FolderKanban size={18} />
              Informations du projet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'tasks'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText size={18} />
              Actions du projet
              {projectTasks.length > 0 && editingProject && (
                <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {projectTasks.length}
                </span>
              )}
            </button>
          </div>

          {/* Contenu scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {/* Contenu de l'onglet Projet */}
          {activeTab === 'project' && (
            <form id="project-form" onSubmit={handleSubmitProject} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre du projet *
                </label>
                <input
                  type="text"
                  value={projectForm.title || ''}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, title: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chef de projet
                </label>
                <input
                  type="text"
                  value={projectForm.manager || ''}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, manager: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <RichTextEditor
                value={projectForm.description || ''}
                onChange={(html) =>
                  setProjectForm({ ...projectForm, description: html })
                }
                placeholder="Détails du projet... (utilisez les boutons pour formater le texte)"
                rows={4}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  value={projectForm.status || 'planifie'}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, status: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                >
                  <option value="planifie">Planifié</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début
                </label>
                <input
                  type="date"
                  value={projectForm.start_date || ''}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, start_date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin prévue
                </label>
                <input
                  type="date"
                  value={projectForm.end_date || ''}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, end_date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <ImageUpload
                value={projectForm.image_url || ''}
                onChange={(url) =>
                  setProjectForm({ ...projectForm, image_url: url })
                }
                bucket="ong-backend"
                folder="projects/images"
                label="Image du projet *"
                required
              />
            </div>

            <div>
              <MultipleFileUpload
                value={projectDocuments}
                onChange={(urls) => setProjectDocuments(urls)}
                bucket="ong-backend"
                folder="projects/files"
                label="Documents du projet (plan, budget, etc.)"
                accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                maxSizeMB={50}
              />
            </div>
          </form>
          )}

          {/* Contenu de l'onglet Actions */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 mb-2">
                Ajoutez les actions du projet. L&apos;avancement est calculé automatiquement.
              </p>

              {!editingProject && (
                <div className="bg-white border border-yellow-200 rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-yellow-800 font-medium mb-1">
                    Vous devez d&apos;abord enregistrer le projet.
                  </p>
                  <p className="text-xs text-yellow-700">
                    Remplissez les informations du projet dans l&apos;onglet <strong>Informations du projet</strong> puis
                    cliquez sur <strong>Créer le projet</strong>. Vous pourrez ensuite revenir ici pour ajouter les actions.
                  </p>
                </div>
              )}

              {editingProject && (
                <>
                  <form
                    onSubmit={handleAddTask}
                    className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 mb-4 border border-gray-200 shadow-sm"
                  >
                    <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Plus size={16} />
                      Ajouter une nouvelle action
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Titre de l&apos;action *
                          </label>
                          <input
                            type="text"
                            value={newTaskForm.title || ''}
                            onChange={(e) =>
                              setNewTaskForm({ ...newTaskForm, title: e.target.value })
                            }
                            required
                            placeholder="Ex: Réunion avec les partenaires"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date prévue
                          </label>
                          <input
                            type="date"
                            value={newTaskForm.due_date || ''}
                            onChange={(e) =>
                              setNewTaskForm({
                                ...newTaskForm,
                                due_date: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Statut initial
                          </label>
                          <select
                            value={newTaskForm.status || 'en_cours'}
                            onChange={(e) =>
                              setNewTaskForm({
                                ...newTaskForm,
                                status: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                          >
                            <option value="en_cours">En cours</option>
                            <option value="terminee">Terminée</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <RichTextEditor
                          value={newTaskForm.description || ''}
                          onChange={(html) =>
                            setNewTaskForm({
                              ...newTaskForm,
                              description: html,
                            })
                          }
                          placeholder="Détails de l'action à mener... (utilisez les boutons pour formater le texte)"
                          rows={3}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <FileUpload
                          value={newTaskForm.document_url || ''}
                          onChange={(url) =>
                            setNewTaskForm({
                              ...newTaskForm,
                              document_url: url,
                            })
                          }
                          bucket="ong-backend"
                          folder="projects/tasks"
                          label="Document lié à l'action (optionnel)"
                          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/*"
                          maxSizeMB={20}
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium flex items-center gap-2"
                        >
                          <Plus size={16} />
                          Ajouter l&apos;action
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <FileText size={18} />
                    Liste des actions
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      {projectTasks.length}
                    </span>
                  </h3>
                  {tasksLoading && (
                    <span className="text-xs text-gray-500 animate-pulse">Chargement...</span>
                  )}
                </div>
                {projectTasks.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <FileText className="mx-auto text-gray-300 mb-2" size={32} />
                    <p className="text-sm text-gray-500">
                      Aucune action définie pour ce projet pour le moment.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Utilisez le formulaire ci-dessus pour ajouter une action.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                    {projectTasks.map((task) => {
                      const isDone = task.status === 'terminee';
                      return (
                        <div
                          key={task.id}
                          className={`px-4 py-4 transition-colors ${
                            isDone ? 'bg-green-50/50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 flex-shrink-0 ${
                              isDone ? 'text-green-600' : 'text-blue-600'
                            }`}>
                              {isDone ? (
                                <CheckCircle size={20} className="fill-current" />
                              ) : (
                                <Clock size={20} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-semibold text-gray-900">
                                      {task.title}
                                    </h4>
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isDone
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}
                                    >
                                      {isDone ? 'Terminée' : 'En cours'}
                                    </span>
                                  </div>
                                  {task.description && (
                                    <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                                      <div
                                        className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none break-words"
                                        dangerouslySetInnerHTML={{ __html: task.description }}
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {!isDone && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const comment = window.prompt(
                                          'Commentaire sur cette action (optionnel) :',
                                          task.comment || ''
                                        );
                                        if (comment !== null) {
                                          handleMarkTaskDone(task, comment);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                                      title="Marquer comme terminée"
                                    >
                                      <CheckCircle size={14} />
                                      Terminer
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTask(task)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                                {task.due_date && (
                                  <div className="flex items-center gap-1">
                                    <Clock size={12} />
                                    <span>Prévue le <strong>{task.due_date}</strong></span>
                                  </div>
                                )}
                                {task.completed_at && (
                                  <div className="flex items-center gap-1 text-green-700">
                                    <CheckCircle size={12} />
                                    <span>Terminée le <strong>{task.completed_at.split('T')[0]}</strong></span>
                                  </div>
                                )}
                                {task.document_url && (
                                  <a
                                    href={task.document_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                  >
                                    📄 Voir le document
                                  </a>
                                )}
                              </div>
                              {task.comment && (
                                <div className="mt-3 p-2 bg-yellow-50 border-l-3 border-yellow-400 rounded-r">
                                  <p className="text-xs font-medium text-yellow-900 mb-0.5">
                                    💬 Commentaire :
                                  </p>
                                  <p className="text-xs text-yellow-800 italic">
                                    {task.comment}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                  </div>
                </>
              )}
            </div>
          )}
          </div>

          {/* Footer fixe avec boutons */}
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Fermer
            </button>
            {activeTab === 'project' && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const form = document.getElementById('project-form') as HTMLFormElement;
                  if (form) {
                    form.requestSubmit();
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                {editingProject ? 'Enregistrer le projet' : 'Créer le projet'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal de visualisation du projet */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={viewingProject ? `Projet : ${viewingProject.title}` : 'Détails du projet'}
        size="md"
      >
        {viewingProject && (
          <div className="w-full max-w-full flex flex-col" style={{ height: 'calc(90vh - 120px)', maxHeight: 'calc(90vh - 120px)' }}>
            {/* Onglets - Fixes en haut */}
            <div className="flex border-b border-gray-200 mb-4 flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setViewTab('info')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  viewTab === 'info'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FolderKanban size={18} />
                Informations du projet
              </button>
              <button
                type="button"
                onClick={() => setViewTab('tasks')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  viewTab === 'tasks'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText size={18} />
                Actions du projet
                {(() => {
                  const projTasks = tasks.filter((t) => t.project_id === viewingProject.id);
                  return projTasks.length > 0 ? (
                    <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                      {projTasks.length}
                    </span>
                  ) : null;
                })()}
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {/* Contenu de l'onglet Informations */}
            {viewTab === 'info' && (
              <div className="space-y-4">
                {/* Image du projet */}
                {viewingProject.image_url && (
                  <div className="w-full h-48 overflow-hidden rounded-lg bg-gray-100">
                    <img
                      src={viewingProject.image_url}
                      alt={viewingProject.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Informations principales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Titre</label>
                    <p className="text-sm font-medium text-gray-900">{viewingProject.title}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Chef de projet</label>
                    <p className="text-sm text-gray-700">{viewingProject.manager || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Statut</label>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        viewingProject.status === 'termine'
                          ? 'bg-green-100 text-green-800'
                          : viewingProject.status === 'en_cours'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {viewingProject.status === 'termine'
                        ? 'Terminé'
                        : viewingProject.status === 'en_cours'
                        ? 'En cours'
                        : viewingProject.status === 'planifie'
                        ? 'Planifié'
                        : viewingProject.status || '-'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Période</label>
                    <p className="text-sm text-gray-700">
                      {viewingProject.start_date || '-'} → {viewingProject.end_date || '-'}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {viewingProject.description && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div
                        className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none break-words"
                        dangerouslySetInnerHTML={{ __html: viewingProject.description }}
                      />
                    </div>
                  </div>
                )}

                 {/* Documents du projet */}
                 {(() => {
                   const documents = parseDocuments(viewingProject.document_url);
                   if (documents.length === 0) return null;
                   return (
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Documents du projet (plan, budget, etc.)
                       </label>
                       <div className="space-y-2">
                         {documents.map((docUrl, index) => {
                           const getFileName = (url: string) => {
                             try {
                               const urlObj = new URL(url);
                               const pathParts = urlObj.pathname.split('/');
                               return pathParts[pathParts.length - 1] || `Document ${index + 1}`;
                             } catch {
                               return `Document ${index + 1}`;
                             }
                           };
                           return (
                             <div key={index} className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                               <div className="flex items-center gap-3">
                                 <FileText className="text-green-600" size={24} />
                                 <div>
                                   <p className="text-sm font-medium text-gray-700">
                                     {getFileName(docUrl)}
                                   </p>
                                   <a
                                     href={docUrl}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="text-sm text-blue-600 hover:underline"
                                   >
                                     Voir le fichier
                                   </a>
                                 </div>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   );
                 })()}

              </div>
            )}

            {/* Contenu de l'onglet Actions */}
            {viewTab === 'tasks' && (
              <div className="space-y-4">
                {(() => {
                  const projTasks = tasks.filter((t) => t.project_id === viewingProject.id);
                  if (projTasks.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-400">
                        <FileText className="mx-auto mb-3 text-gray-300" size={48} />
                        <p className="text-sm">Aucune action définie pour ce projet</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {projTasks.map((task) => {
                        const isDone = task.status === 'terminee';
                        return (
                          <div
                            key={task.id}
                            className={`border rounded-lg p-4 ${
                              isDone ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 flex-shrink-0 ${
                                isDone ? 'text-green-600' : 'text-blue-600'
                              }`}>
                                {isDone ? (
                                  <CheckCircle size={20} className="fill-current" />
                                ) : (
                                  <Clock size={20} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-base font-semibold text-gray-900">{task.title}</h4>
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      isDone
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {isDone ? 'Terminée' : 'En cours'}
                                  </span>
                                </div>
                                {task.description && (
                                  <div className="mt-2 mb-3 max-h-40 overflow-y-auto border border-gray-200 rounded p-3 bg-gray-50">
                                    <div
                                      className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none break-words"
                                      dangerouslySetInnerHTML={{ __html: task.description }}
                                    />
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-600">
                                  {task.due_date && (
                                    <div className="flex items-center gap-1">
                                      <Clock size={14} />
                                      <span>Prévue le <strong>{task.due_date}</strong></span>
                                    </div>
                                  )}
                                  {task.completed_at && (
                                    <div className="flex items-center gap-1 text-green-700">
                                      <CheckCircle size={14} />
                                      <span>Terminée le <strong>{task.completed_at.split('T')[0]}</strong></span>
                                    </div>
                                  )}
                                  {task.document_url && (
                                    <a
                                      href={task.document_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center gap-1"
                                    >
                                      📄 Voir le document
                                    </a>
                                  )}
                                </div>
                                {task.comment && (
                                  <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r">
                                    <p className="text-xs font-medium text-yellow-900 mb-1">
                                      💬 Commentaire :
                                    </p>
                                    <p className="text-sm text-yellow-800 italic">{task.comment}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
            </div>

            {/* Footer fixe avec Avancement et bouton Fermer */}
            <div className="pt-4 mt-4 border-t border-gray-200 flex-shrink-0 space-y-3">
              {/* Avancement du projet - Fixe */}
              {viewTab === 'info' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Avancement du projet</label>
                  {(() => {
                    const projTasks = tasks.filter((t) => t.project_id === viewingProject.id);
                    const doneCount = projTasks.filter((t) => t.status === 'terminee').length;
                    const totalCount = projTasks.length;
                    const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                    return (
                      <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span>{doneCount} action(s) terminée(s) sur {totalCount}</span>
                          <span className="font-semibold">{percent}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {/* Bouton de fermeture - Fixe */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProjectsAdmin;


