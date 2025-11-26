import React, { useState, useMemo } from 'react';
import { useCrud } from '../../hooks/useCrud';
import DataTable from '../../components/admin/DataTable';
import Modal from '../../components/admin/Modal';
import ImageUpload from '../../components/admin/ImageUpload';
import FileUpload from '../../components/admin/FileUpload';
import SearchBar from '../../components/admin/SearchBar';
import { List, Grid, Edit, Trash2, Play, Plus } from 'lucide-react';

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

const VideosAdmin: React.FC = () => {
  const { data, loading, error, create, update, delete: deleteVideo } = useCrud<Video>({ tableName: 'videos' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Video | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Partial<Video>>({
    title: '',
    description: '',
    videourl: '',
    filepath: '',
    thumbnailpath: '',
    date: '',
  });

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ title: '', description: '', videourl: '', filepath: '', thumbnailpath: '', date: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item: Video) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item: Video) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${item.title}" ?`)) {
      try {
        await deleteVideo(item.id);
      } catch (err) {
        alert('Erreur lors de la suppression');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await update(editingItem.id, formData);
      } else {
        await create(formData);
      }
      setIsModalOpen(false);
      setFormData({ title: '', description: '', videourl: '', filepath: '', thumbnailpath: '', date: '' });
    } catch (err) {
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const columns = [
    { key: 'title', label: 'Titre' },
    { key: 'date', label: 'Date' },
    {
      key: 'videourl',
      label: 'URL Vidéo',
      render: (value: string) => value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          Voir
        </a>
      ) : '-',
    },
  ];

  // Filtrer les vidéos selon la recherche
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    return data.filter((video) =>
      (video.title || '').toLowerCase().includes(query) ||
      (video.description || '').toLowerCase().includes(query) ||
      (video.videourl || '').toLowerCase().includes(query) ||
      (video.filepath || '').toLowerCase().includes(query) ||
      (video.date || '').toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800">Gestion des Vidéos</h1>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* Toggle vue liste/carte */}
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
          {/* Bouton ajouter */}
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <Plus size={20} />
            Ajouter
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Barre de recherche */}
      <div className="mb-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Rechercher par titre, description, lien ou date..."
          className="max-w-md"
        />
        {searchQuery && (
          <p className="text-sm text-gray-600 mt-2">
            {filteredData.length} résultat(s) trouvé(s)
          </p>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <DataTable
          columns={columns}
          data={filteredData}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAdd={handleAdd}
          title="Vidéos"
          isLoading={false}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-md p-3 w-full max-w-full">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{searchQuery ? 'Aucun résultat trouvé' : 'Aucune vidéo disponible'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
              {filteredData.map((video) => (
                <div
                  key={video.id}
                  className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 w-full max-w-full group flex flex-col"
                >
                  <div className="h-56 overflow-hidden relative flex-shrink-0 bg-black flex items-center justify-center">
                    {video.thumbnailpath ? (
                      <img
                        src={video.thumbnailpath}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-white opacity-80">
                        <Play size={40} className="mb-2" />
                        <span className="text-xs">Aucune vignette</span>
                      </div>
                    )}
                    <div className="absolute top-1.5 right-1.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(video)}
                        className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-blue-600 hover:bg-white transition shadow-sm"
                        title="Modifier"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(video)}
                        className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-red-600 hover:bg-white transition shadow-sm"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col flex-grow">
                    <div className="text-green-600 font-semibold mb-1.5 text-xs">
                      {video.date ? video.date : '-'}
                    </div>
                    <h3 className="text-sm font-bold text-green-800 mb-2 line-clamp-2 leading-tight flex-grow">
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="text-gray-600 mb-3 text-xs line-clamp-3 leading-relaxed flex-grow">
                        {video.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-auto pt-2.5 border-t border-gray-100">
                      {video.videourl ? (
                        <a
                          href={video.videourl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 font-medium hover:text-green-800 transition-colors text-xs flex items-center gap-1"
                        >
                          <Play size={14} />
                          Lire la vidéo
                        </a>
                      ) : video.filepath ? (
                        <a
                          href={video.filepath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 font-medium hover:text-green-800 transition-colors text-xs flex items-center gap-1"
                        >
                          <Play size={14} />
                          Ouvrir le fichier
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">Aucune source vidéo</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Modifier une vidéo' : 'Ajouter une vidéo'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-full">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Vidéo (YouTube, Vimeo, etc.)</label>
            <input
              type="url"
              value={formData.videourl || ''}
              onChange={(e) => setFormData({ ...formData, videourl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="https://youtube.com/..."
            />
          </div>

          <div>
            <FileUpload
              value={formData.filepath || ''}
              onChange={(url) => setFormData({ ...formData, filepath: url })}
              bucket="ong-backend"
              folder="videos/files"
              label="Fichier vidéo (Supabase Storage)"
              accept="video/*"
              maxSizeMB={200}
            />
          </div>

          <ImageUpload
            value={formData.thumbnailpath || ''}
            onChange={(url) => setFormData({ ...formData, thumbnailpath: url })}
            bucket="ong-backend"
            folder="videos/images"
            folder="videos"
            label="Vignette"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date || ''}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {editingItem ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default VideosAdmin;

