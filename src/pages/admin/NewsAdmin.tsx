import React, { useState, useMemo } from 'react';
import { useCrud } from '../../hooks/useCrud';
import DataTable from '../../components/admin/DataTable';
import Modal from '../../components/admin/Modal';
import ImageUpload from '../../components/admin/ImageUpload';
import SearchBar from '../../components/admin/SearchBar';
import { List, Grid, Edit, Trash2, Plus } from 'lucide-react';

interface News {
  id: number;
  title: string;
  content: string;
  image: string;
  category: string;
  date: string;
  created_at?: string;
}

const NewsAdmin: React.FC = () => {
  const { data, loading, error, create, update, delete: deleteNews } = useCrud<News>({ tableName: 'news' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<News | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Partial<News>>({
    title: '',
    content: '',
    image: '',
    category: '',
    date: '',
  });

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ title: '', content: '', image: '', category: '', date: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item: News) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item: News) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${item.title}" ?`)) {
      try {
        await deleteNews(item.id);
      } catch (err) {
        alert('Erreur lors de la suppression');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSubmit: Partial<News> = {
        title: formData.title || '',
        content: formData.content || '',
        image: formData.image || '',
        category: formData.category || '',
        date: formData.date || '',
      };

      if (editingItem) {
        await update(editingItem.id, dataToSubmit);
      } else {
        await create(dataToSubmit);
      }
      setIsModalOpen(false);
      setFormData({ title: '', content: '', image: '', category: '', date: '' });
    } catch (err) {
      alert('Erreur lors de l\'enregistrement');
      console.error('Error submitting news:', err);
    }
  };

  // Filtrer les données selon la recherche
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter((news) =>
      news.title.toLowerCase().includes(query) ||
      news.content.toLowerCase().includes(query) ||
      news.category.toLowerCase().includes(query) ||
      news.date.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  const columns = [
    { key: 'title', label: 'Titre' },
    { key: 'category', label: 'Catégorie' },
    { key: 'date', label: 'Date' },
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800">Gestion des Actualités</h1>
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
          placeholder="Rechercher par titre, contenu, catégorie ou date..."
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
          title="Actualités"
          isLoading={false}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-md p-3 w-full max-w-full">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{searchQuery ? 'Aucun résultat trouvé' : 'Aucune actualité disponible'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
              {filteredData.map((news) => (
                <div
                  key={news.id}
                  className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 w-full max-w-full group flex flex-col"
                >
                  <div className="h-56 overflow-hidden relative flex-shrink-0">
                    <img
                      src={news.image}
                      alt={news.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute top-1.5 right-1.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(news)}
                        className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-blue-600 hover:bg-white transition shadow-sm"
                        title="Modifier"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(news)}
                        className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-red-600 hover:bg-white transition shadow-sm"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col flex-grow">
                    <div className="text-green-600 font-semibold mb-1.5 text-xs">
                      {news.category} • {news.date}
                    </div>
                    <h3 className="text-sm font-bold text-green-800 mb-2 line-clamp-2 leading-tight flex-grow">
                      {news.title}
                    </h3>
                    <p className="text-gray-600 mb-3 text-xs line-clamp-3 leading-relaxed flex-grow">
                      {news.content}
                    </p>
                    <div className="mt-auto pt-2.5 border-t border-gray-100">
                      <button
                        onClick={() => handleEdit(news)}
                        className="text-green-600 font-medium hover:text-green-800 transition-colors text-xs w-full text-left"
                      >
                        Voir les détails →
                      </button>
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
        title={editingItem ? 'Modifier une actualité' : 'Ajouter une actualité'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-full">
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent max-w-full text-sm"
            />
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenu *</label>
            <textarea
              value={formData.content || ''}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={6}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent max-w-full resize-y text-sm"
            />
          </div>

          <div className="w-full">
            <ImageUpload
              value={formData.image || ''}
              onChange={(url) => setFormData({ ...formData, image: url })}
              bucket="ong-backend"
              folder="news/images"
              label="Image"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
              <input
                type="text"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={formData.date || ''}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              {editingItem ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default NewsAdmin;
