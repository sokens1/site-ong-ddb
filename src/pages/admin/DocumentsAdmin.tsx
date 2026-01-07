import React, { useState, useMemo, useEffect } from 'react';
import { useCrud } from '../../hooks/useCrud';
import { supabase } from '../../supabaseClient';
import DataTable from '../../components/admin/DataTable';
import Modal from '../../components/admin/Modal';
import FileUpload from '../../components/admin/FileUpload';
import SearchBar from '../../components/admin/SearchBar';
import { 
  List, 
  Grid, 
  Download, 
  Eye, 
  Plus, 
  Edit, 
  Trash2, 
  FileText, 
  FolderKanban, 
  FileCheck,
  File,
  FileImage,
  FileSpreadsheet,
  FileType,
  Paperclip
} from 'lucide-react';

interface Document {
  id: number | string; // Peut être un ID numérique ou une clé composite
  title: string;
  description?: string | null;
  file_url: string;
  category?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source?: string; // 'documents', 'projects', 'reports', 'project_tasks'
  source_id?: number; // ID de la source (projet, rapport, etc.)
  source_title?: string; // Titre de la source (nom du projet, etc.)
}

// Interface pour les projets
interface Project {
  id: number;
  title: string;
  document_url?: string | null;
  created_at?: string | null;
}

// Interface pour les rapports
interface Report {
  id: number;
  title: string;
  fileUrl?: string | null;
  created_at?: string | null;
}

// Interface pour les tâches de projet
interface ProjectTask {
  id: number;
  project_id: number;
  title: string;
  document_url?: string | null;
  created_at?: string | null;
}

const DocumentsAdmin: React.FC = () => {
  const { data: documentsData, loading: documentsLoading, error: documentsError, create, update, delete: deleteDocument } = useCrud<Document>({ tableName: 'documents' });
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Partial<Document>>({
    title: '',
    description: '',
    file_url: '',
    category: '',
  });

  // Fonction pour parser les documents JSON (pour les projets)
  const parseDocuments = (documentUrl: string | null): string[] => {
    if (!documentUrl) return [];
    try {
      const parsed = JSON.parse(documentUrl);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return documentUrl ? [documentUrl] : [];
    }
  };

  // Fonction pour récupérer tous les documents depuis différentes sources
  const fetchAllDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const documents: Document[] = [];

      // 1. Documents de la table documents
      const directDocs = (documentsData || []).map((doc) => ({
        ...doc,
        source: 'documents' as const,
        source_id: doc.id as number,
      }));
      documents.push(...directDocs);

      // 2. Documents des projets
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, document_url, created_at');

      if (!projectsError && projects) {
        projects.forEach((project: Project) => {
          const projectDocs = parseDocuments(project.document_url);
          projectDocs.forEach((url, index) => {
            if (url) {
              documents.push({
                id: `project_${project.id}_${index}`,
                title: `${project.title} - Document ${index + 1}`,
                description: `Document du projet "${project.title}"`,
                file_url: url,
                category: 'Projet',
                created_at: project.created_at || null,
                source: 'projects',
                source_id: project.id,
                source_title: project.title,
              });
            }
          });
        });
      }

      // 3. Documents des rapports
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('id, title, fileUrl, created_at');

      if (!reportsError && reports) {
        reports.forEach((report: Report) => {
          if (report.fileUrl) {
            documents.push({
              id: `report_${report.id}`,
              title: report.title,
              description: 'Rapport',
              file_url: report.fileUrl,
              category: 'Rapport',
              created_at: report.created_at || null,
              source: 'reports',
              source_id: report.id,
              source_title: report.title,
            });
          }
        });
      }

      // 4. Documents des tâches de projet
      const { data: tasks, error: tasksError } = await supabase
        .from('project_tasks')
        .select('id, project_id, title, document_url, created_at');

      if (!tasksError && tasks) {
        // Récupérer les projets pour avoir leurs titres
        const { data: projectsForTasks } = await supabase
          .from('projects')
          .select('id, title');

        const projectsMap = new Map((projectsForTasks || []).map((p: Project) => [p.id, p.title]));

        tasks.forEach((task: ProjectTask) => {
          if (task.document_url) {
            const projectTitle = projectsMap.get(task.project_id) || 'Projet inconnu';
            documents.push({
              id: `task_${task.id}`,
              title: task.title,
              description: `Document de la tâche du projet "${projectTitle}"`,
              file_url: task.document_url,
              category: 'Tâche de projet',
              created_at: task.created_at || null,
              source: 'project_tasks',
              source_id: task.id,
              source_title: `${projectTitle} - ${task.title}`,
            });
          }
        });
      }

      // Trier par date de création (plus récent en premier)
      documents.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      setAllDocuments(documents);
    } catch (err: any) {
      console.error('Error fetching all documents:', err);
      setError(err.message || 'Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDocuments();
  }, [documentsData]);

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return allDocuments;
    const q = searchQuery.toLowerCase();
    return allDocuments.filter((doc) =>
      (doc.title || '').toLowerCase().includes(q) ||
      (doc.description || '').toLowerCase().includes(q) ||
      (doc.category || '').toLowerCase().includes(q) ||
      (doc.source_title || '').toLowerCase().includes(q)
    );
  }, [allDocuments, searchQuery]);

  const handleAdd = () => {
    setEditingDocument(null);
    setFormData({ title: '', description: '', file_url: '', category: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (doc: Document) => {
    if (doc.source !== 'documents') {
      alert('Ce document provient d\'un autre module (projet, rapport, etc.). Vous ne pouvez le modifier que depuis son module d\'origine.');
      return;
    }
    setEditingDocument(doc);
    setFormData(doc);
    setIsModalOpen(true);
  };

  const handleDelete = async (doc: Document) => {
    if (doc.source !== 'documents') {
      alert('Ce document provient d\'un autre module (projet, rapport, etc.). Vous ne pouvez le supprimer que depuis son module d\'origine.');
      return;
    }

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le document "${doc.title}" ?`)) {
      try {
        await deleteDocument(doc.id as number);
        await fetchAllDocuments();
      } catch (err) {
        alert('Erreur lors de la suppression');
      }
    }
  };

  const handleView = (doc: Document) => {
    setViewingDocument(doc);
    setIsViewModalOpen(true);
  };

  const handleDownload = (url: string, title: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = title;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        title: formData.title || null,
        description: formData.description || null,
        file_url: formData.file_url || null,
        category: formData.category || null,
      };

      if (editingDocument) {
        await update(editingDocument.id, payload);
      } else {
        await create(payload);
      }
      setIsModalOpen(false);
      setFormData({ title: '', description: '', file_url: '', category: '' });
      setEditingDocument(null);
      await fetchAllDocuments();
    } catch (err: any) {
      alert(`Erreur: ${err.message || 'Erreur lors de l\'enregistrement'}`);
    }
  };

  const getFileExtension = (url: string) => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      return ext;
    } catch {
      return '';
    }
  };

  const getFileIcon = (url: string) => {
    const ext = getFileExtension(url);
    if (['pdf'].includes(ext)) {
      return <FileText size={20} className="text-green-600" />;
    }
    if (['doc', 'docx'].includes(ext)) {
      return <FileType size={20} className="text-green-600" />;
    }
    if (['xls', 'xlsx'].includes(ext)) {
      return <FileSpreadsheet size={20} className="text-green-600" />;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <FileImage size={20} className="text-green-600" />;
    }
    return <File size={20} className="text-green-600" />;
  };

  const columns = [
    {
      key: 'title',
      label: 'Titre',
      render: (value: string) => <span className="font-medium">{value || '-'}</span>,
    },
    {
      key: 'category',
      label: 'Catégorie',
      render: (value: string, row: Document) => (
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
            {value || 'Non catégorisé'}
          </span>
          {row.source && row.source !== 'documents' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs flex items-center gap-1">
              {row.source === 'projects' && <FolderKanban size={12} />}
              {row.source === 'reports' && <FileText size={12} />}
              {row.source === 'project_tasks' && <FileCheck size={12} />}
              {row.source}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (value: string) => (
        <span className="text-sm text-gray-600 line-clamp-2">{value || '-'}</span>
      ),
    },
    {
      key: 'file_url',
      label: 'Fichier',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{getFileIcon(value)}</span>
          <span className="text-xs text-gray-500 truncate max-w-[200px]">
            {value ? new URL(value).pathname.split('/').pop() : '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Date de création',
      render: (value: string) => (
        <span className="text-sm text-gray-500">
          {value ? new Date(value).toLocaleDateString('fr-FR') : '-'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Erreur: {error}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Plus size={18} />
          Ajouter un document
        </button>
      </div>

      <div className="mb-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setViewMode('list')}
          className={`p-2 rounded-lg transition ${
            viewMode === 'list'
              ? 'bg-green-100 text-green-600'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title="Vue liste"
        >
          <List size={20} />
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`p-2 rounded-lg transition ${
            viewMode === 'grid'
              ? 'bg-green-100 text-green-600'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title="Vue grille"
        >
          <Grid size={20} />
        </button>
      </div>

      {viewMode === 'list' ? (
        <DataTable
          data={filteredDocuments}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          actions={[
            {
              label: 'Voir',
              icon: Eye,
              onClick: handleView,
              className: 'text-blue-600 hover:text-blue-800',
            },
            {
              label: 'Télécharger',
              icon: Download,
              onClick: (doc: Document) => handleDownload(doc.file_url, doc.title),
              className: 'text-green-600 hover:text-green-800',
            },
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-lg border border-gray-200">
              <FileText className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-500">Aucun document trouvé</p>
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-shrink-0">{getFileIcon(doc.file_url)}</div>
                      <h3 className="font-semibold text-gray-900 truncate flex-1">{doc.title}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {doc.category && (
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {doc.category}
                      </span>
                    )}
                    {doc.source && doc.source !== 'documents' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {doc.source === 'projects' && <FolderKanban size={12} />}
                        {doc.source === 'reports' && <FileText size={12} />}
                        {doc.source === 'project_tasks' && <FileCheck size={12} />}
                        {doc.source}
                      </span>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{doc.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      {doc.created_at
                        ? new Date(doc.created_at).toLocaleDateString('fr-FR')
                        : '-'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleView(doc)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Voir"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleDownload(doc.file_url, doc.title)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Télécharger"
                      >
                        <Download size={18} />
                      </button>
                      {doc.source === 'documents' && (
                        <>
                          <button
                            onClick={() => handleEdit(doc)}
                            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                            title="Modifier"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                      {doc.source && doc.source !== 'documents' && (
                        <span className="text-xs text-gray-500 px-2">
                          Depuis {doc.source_title || doc.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de création/modification */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDocument ? 'Modifier un document' : 'Ajouter un document'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre *
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catégorie
            </label>
            <input
              type="text"
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="Ex: Rapport, Plan, Budget..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <FileUpload
              value={formData.file_url || ''}
              onChange={(url) => setFormData({ ...formData, file_url: url })}
              bucket="ong-backend"
              folder="documents"
              label="Fichier du document *"
              accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
              maxSizeMB={50}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              {editingDocument ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de visualisation */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={viewingDocument ? `Document : ${viewingDocument.title}` : 'Détails du document'}
        size="md"
      >
        {viewingDocument && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Titre</label>
              <p className="text-sm font-medium text-gray-900">{viewingDocument.title}</p>
            </div>

            {viewingDocument.category && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Catégorie</label>
                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  {viewingDocument.category}
                </span>
              </div>
            )}

            {viewingDocument.description && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <p className="text-sm text-gray-700">{viewingDocument.description}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fichier</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">{getFileIcon(viewingDocument.file_url)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">
                      {viewingDocument.file_url
                        ? new URL(viewingDocument.file_url).pathname.split('/').pop()
                        : 'Aucun fichier'}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <a
                        href={viewingDocument.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                      >
                        <Eye size={16} />
                        Voir le fichier
                      </a>
                      <button
                        onClick={() => handleDownload(viewingDocument.file_url, viewingDocument.title)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                      >
                        <Download size={16} />
                        Télécharger
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {viewingDocument.created_at && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Date de création</label>
                <p className="text-sm text-gray-700">
                  {new Date(viewingDocument.created_at).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DocumentsAdmin;


