import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import DataTable from '../../../components/admin/DataTable';
import SearchBar from '../../../components/admin/SearchBar';
import { List, Grid, Edit, Trash2, Play, Plus } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';

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
    const navigate = useNavigate();
    const { data, loading, error, delete: deleteVideo } = useCrud<Video>({ tableName: 'videos' });
    const { canCreate, canEdit, canDelete } = useUserRole();
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    const handleAdd = () => {
        navigate('/admin/videos/create');
    };

    const handleEdit = (item: Video) => {
        navigate(`/admin/videos/edit/${item.id}`);
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
                    {canCreate('videos') && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
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
                                            {canEdit('videos') && (
                                                <button
                                                    onClick={() => handleEdit(video)}
                                                    className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-blue-600 hover:bg-white transition shadow-sm"
                                                    title="Modifier"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                            )}
                                            {canDelete('videos') && (
                                                <button
                                                    onClick={() => handleDelete(video)}
                                                    className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-red-600 hover:bg-white transition shadow-sm"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
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
        </div>
    );
};

export default VideosAdmin;

