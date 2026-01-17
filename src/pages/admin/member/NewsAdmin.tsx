import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import DataTable from '../../../components/admin/DataTable';
import SearchBar from '../../../components/admin/SearchBar';
import { List, Grid, Edit, Trash2, Plus } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';

interface News {
  id: number;
  title: string;
  content: string;
  image: string;
  image2?: string;
  category: string;
  date: string;
  status?: 'draft' | 'published';
  created_at?: string;
}

const NewsAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, delete: deleteNews } = useCrud<News>({ tableName: 'news' });
  const { canCreate, canEdit, canDelete } = useUserRole();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const handleAdd = () => {
    navigate('/admin/news/create');
  };

  const handleEdit = (item: News) => {
    navigate(`/admin/news/edit/${item.id}`);
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

  // Fonction pour obtenir le badge de statut
  const getStatusBadge = (news: News) => {
    if (news.status === 'draft') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 uppercase tracking-wider">
          Brouillon
        </span>
      );
    }

    const publishDate = new Date(news.date);
    const now = new Date();

    if (publishDate > now) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600 uppercase tracking-wider">
          Programmé
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-600 uppercase tracking-wider">
        Publié
      </span>
    );
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
    {
      key: 'status',
      label: 'Statut',
      render: (item: News) => getStatusBadge(item)
    },
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
          {/* Bouton ajouter */}
          {canCreate('news') && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              <Plus size={20} />
              Ajouter
            </button>
          )}
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
          onEdit={canEdit('news') ? handleEdit : undefined}
          onDelete={canDelete('news') ? handleDelete : undefined}
          onAdd={canCreate('news') ? handleAdd : undefined}
          title="Actualités"
          isLoading={loading}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-md p-3 w-full max-w-full border border-gray-100">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{searchQuery ? 'Aucun résultat trouvé' : 'Aucune actualité disponible'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
              {filteredData.map((news) => (
                <div
                  key={news.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 w-full max-w-full group flex flex-col h-[420px]"
                >
                  <div className="h-48 overflow-hidden relative flex-shrink-0 bg-gray-100">
                    <img
                      src={news.image}
                      alt={news.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      {getStatusBadge(news)}
                    </div>
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit('news') && (
                        <button
                          onClick={() => handleEdit(news)}
                          className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-blue-600 hover:bg-white transition shadow-sm"
                          title="Modifier"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                      {canDelete('news') && (
                        <button
                          onClick={() => handleDelete(news)}
                          className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-red-600 hover:bg-white transition shadow-sm"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-grow overflow-hidden">
                    <div className="flex items-center gap-2 text-green-600 font-semibold mb-2 text-xs">
                      <span>{news.category}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span>{news.date}</span>
                    </div>

                    <h3 className="text-base font-bold text-gray-800 mb-2 line-clamp-2 leading-tight group-hover:text-green-700 transition-colors">
                      {news.title}
                    </h3>

                    <div className="text-gray-600 text-sm line-clamp-4 leading-relaxed mb-4 flex-grow">
                      {news.content.replace(/<[^>]*>/g, '')}
                    </div>

                    <div className="pt-3 border-t border-gray-50 flex items-center justify-between mt-auto">
                      {canEdit('news') ? (
                        <button
                          onClick={() => handleEdit(news)}
                          className="text-green-600 font-semibold hover:text-green-800 transition-colors text-sm flex items-center gap-1 group/btn"
                        >
                          Modifier
                          <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm italic">Lecture seule</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsAdmin;
