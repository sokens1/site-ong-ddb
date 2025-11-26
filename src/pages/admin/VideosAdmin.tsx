import React, { useState } from 'react';
import { useCrud } from '../../hooks/useCrud';
import DataTable from '../../components/admin/DataTable';
import Modal from '../../components/admin/Modal';
import ImageUpload from '../../components/admin/ImageUpload';

interface Video {
  id: number;
  title: string;
  description?: string | null;
  videourl?: string | null;
  filepath?: string | null;
  thumbnailpath?: string | null;
  date?: string | null;
  category?: string | null;
  bucket?: string | null;
  created_at?: string | null;
}

const VideosAdmin: React.FC = () => {
  const { data, loading, error, create, update, delete: deleteVideo } = useCrud<Video>({ tableName: 'videos' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Video | null>(null);
  const [formData, setFormData] = useState<Partial<Video>>({
    title: '',
    description: '',
    videourl: '',
    filepath: '',
    thumbnailpath: '',
    date: '',
    category: '',
    bucket: '',
  });

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ title: '', description: '', videourl: '', filepath: '', thumbnailpath: '', date: '', category: '', bucket: '' });
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
      setFormData({ title: '', description: '', videourl: '', filepath: '', thumbnailpath: '', date: '', category: '', bucket: '' });
    } catch (err) {
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const columns = [
    { key: 'title', label: 'Titre' },
    { key: 'category', label: 'Catégorie' },
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

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Gestion des Vidéos</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
        title="Vidéos"
        isLoading={loading}
      />

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Chemin fichier (Supabase Storage)</label>
            <input
              type="text"
              value={formData.filepath || ''}
              onChange={(e) => setFormData({ ...formData, filepath: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="videos/monfichier.mp4"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <input
                type="text"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bucket</label>
              <input
                type="text"
                value={formData.bucket || ''}
                onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="videos"
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

