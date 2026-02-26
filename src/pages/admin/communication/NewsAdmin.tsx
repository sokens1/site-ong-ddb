import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import DataTable from '../../../components/admin/DataTable';
import SearchBar from '../../../components/admin/SearchBar';
import { List, Grid, Edit, Trash2, Plus, Play, Newspaper, Video } from 'lucide-react';
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

interface VideoItem {
    id: number;
    title: string;
    description?: string | null;
    videourl?: string | null;
    filepath?: string | null;
    thumbnailpath?: string | null;
    date?: string | null;
    created_at?: string | null;
}

const NewsAdmin: React.FC = () => {
    const navigate = useNavigate();
    const { data: newsData, loading: newsLoading, error: newsError, delete: deleteNews } = useCrud<News>({ tableName: 'news' });
    const { data: videoData, loading: videoLoading, error: videoError, delete: deleteVideo } = useCrud<VideoItem>({ tableName: 'videos' });
    const { canCreate, canEdit, canDelete } = useUserRole();
    const [activeTab, setActiveTab] = useState<'blog' | 'video'>('blog');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    // --- Blog handlers ---
    const handleAddNews = () => navigate('/admin/news/create');
    const handleEditNews = (item: News) => {
        if (canEdit('news')) navigate(`/admin/news/edit/${item.id}`);
        else navigate(`/admin/news/view/${item.id}`);
    };
    const handleDeleteNews = async (item: News) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${item.title}" ?`)) {
            try { await deleteNews(item.id); } catch { alert('Erreur lors de la suppression'); }
        }
    };

    // --- Video handlers ---
    const handleAddVideo = () => navigate('/admin/videos/create');
    const handleEditVideo = (item: VideoItem) => navigate(`/admin/videos/edit/${item.id}`);
    const handleDeleteVideo = async (item: VideoItem) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${item.title}" ?`)) {
            try { await deleteVideo(item.id); } catch { alert('Erreur lors de la suppression'); }
        }
    };

    // Status badge
    const getStatusBadge = (news: News) => {
        if (news.status === 'draft') {
            return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 uppercase tracking-wider">Brouillon</span>;
        }
        const publishDate = new Date(news.date);
        if (publishDate > new Date()) {
            return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600 uppercase tracking-wider">Programmé</span>;
        }
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-600 uppercase tracking-wider">Publié</span>;
    };

    // Filtered data
    const filteredNews = useMemo(() => {
        if (!searchQuery.trim()) return newsData;
        const q = searchQuery.toLowerCase();
        return newsData.filter(n =>
            n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) ||
            n.category.toLowerCase().includes(q) || n.date.toLowerCase().includes(q)
        );
    }, [newsData, searchQuery]);

    const filteredVideos = useMemo(() => {
        if (!searchQuery.trim()) return videoData;
        const q = searchQuery.toLowerCase();
        return videoData.filter(v =>
            (v.title || '').toLowerCase().includes(q) || (v.description || '').toLowerCase().includes(q) ||
            (v.date || '').toLowerCase().includes(q)
        );
    }, [videoData, searchQuery]);

    const newsColumns = [
        { key: 'title', label: 'Titre' },
        { key: 'category', label: 'Catégorie' },
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Statut', render: (item: News) => getStatusBadge(item) },
    ];

    const videoColumns = [
        { key: 'title', label: 'Titre' },
        { key: 'date', label: 'Date' },
        { key: 'videourl', label: 'URL Vidéo', render: (value: string) => value ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Voir</a> : '-' },
    ];

    const loading = activeTab === 'blog' ? newsLoading : videoLoading;
    const error = activeTab === 'blog' ? newsError : videoError;

    return (
        <div className="w-full max-w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-800">Actualités</h1>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* View toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`} title="Vue carte"><Grid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition ${viewMode === 'list' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`} title="Vue liste"><List size={18} /></button>
                    </div>
                    {/* Add button */}
                    {activeTab === 'blog' && canCreate('news') && (
                        <button onClick={handleAddNews} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-semibold">
                            <Plus size={18} /> Ajouter
                        </button>
                    )}
                    {activeTab === 'video' && canCreate('news') && (
                        <button onClick={handleAddVideo} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-semibold">
                            <Plus size={18} /> Ajouter
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs Blog / Vidéo */}
            <div className="flex border-b border-gray-200 mb-4">
                <button
                    onClick={() => { setActiveTab('blog'); setSearchQuery(''); }}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors relative ${activeTab === 'blog' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Newspaper size={18} />
                    Blog
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === 'blog' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {newsData.length}
                    </span>
                </button>
                <button
                    onClick={() => { setActiveTab('video'); setSearchQuery(''); }}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors relative ${activeTab === 'video' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Video size={18} />
                    Vidéo
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === 'video' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {videoData.length}
                    </span>
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
            )}

            {/* Search */}
            <div className="mb-4">
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder={activeTab === 'blog' ? 'Rechercher un article...' : 'Rechercher une vidéo...'}
                    className="max-w-md"
                />
                {searchQuery && (
                    <p className="text-sm text-gray-600 mt-2">
                        {(activeTab === 'blog' ? filteredNews : filteredVideos).length} résultat(s)
                    </p>
                )}
            </div>

            {/* Content */}
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
            ) : activeTab === 'blog' ? (
                /* Blog Content */
                viewMode === 'list' ? (
                    <DataTable
                        columns={newsColumns}
                        data={filteredNews}
                        onEdit={canEdit('news') ? handleEditNews : undefined}
                        onDelete={canDelete('news') ? handleDeleteNews : undefined}
                        onAdd={canCreate('news') ? handleAddNews : undefined}
                        title="Articles"
                        isLoading={newsLoading}
                    />
                ) : (
                    <div className="bg-white rounded-lg shadow-md p-3 w-full max-w-full border border-gray-100">
                        {filteredNews.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>{searchQuery ? 'Aucun résultat trouvé' : 'Aucun article disponible'}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                                {filteredNews.map((news) => (
                                    <div key={news.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 w-full max-w-full group flex flex-col h-[420px]">
                                        <div className="h-48 overflow-hidden relative flex-shrink-0 bg-gray-100">
                                            <img src={news.image} alt={news.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                                            <div className="absolute top-3 left-3 flex gap-2">{getStatusBadge(news)}</div>
                                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {canEdit('news') && (
                                                    <button onClick={() => handleEditNews(news)} className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-blue-600 hover:bg-white transition shadow-sm" title="Modifier"><Edit size={14} /></button>
                                                )}
                                                {canDelete('news') && (
                                                    <button onClick={() => handleDeleteNews(news)} className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-red-600 hover:bg-white transition shadow-sm" title="Supprimer"><Trash2 size={14} /></button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-4 flex flex-col flex-grow overflow-hidden">
                                            <div className="flex items-center gap-2 text-green-600 font-semibold mb-2 text-xs">
                                                <span>{news.category}</span>
                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                <span>{news.date}</span>
                                            </div>
                                            <h3 className="text-base font-bold text-gray-800 mb-2 line-clamp-2 leading-tight group-hover:text-green-700 transition-colors">{news.title}</h3>
                                            <div className="text-gray-600 text-sm line-clamp-4 leading-relaxed mb-4 flex-grow">{news.content.replace(/<[^>]*>/g, '')}</div>
                                            <div className="pt-3 border-t border-gray-50 flex items-center justify-between mt-auto">
                                                <button onClick={() => handleEditNews(news)} className="text-green-600 font-semibold hover:text-green-800 transition-colors text-sm flex items-center gap-1 group/btn">
                                                    Voir les détails <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            ) : (
                /* Video Content */
                viewMode === 'list' ? (
                    <DataTable
                        columns={videoColumns}
                        data={filteredVideos}
                        onEdit={canEdit('news') ? handleEditVideo : undefined}
                        onDelete={canDelete('news') ? handleDeleteVideo : undefined}
                        onAdd={canCreate('news') ? handleAddVideo : undefined}
                        title="Vidéos"
                        isLoading={videoLoading}
                    />
                ) : (
                    <div className="bg-white rounded-lg shadow-md p-3 w-full max-w-full">
                        {filteredVideos.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>{searchQuery ? 'Aucun résultat trouvé' : 'Aucune vidéo disponible'}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
                                {filteredVideos.map((video) => (
                                    <div key={video.id} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 w-full max-w-full group flex flex-col">
                                        <div className="h-56 overflow-hidden relative flex-shrink-0 bg-black flex items-center justify-center">
                                            {video.thumbnailpath ? (
                                                <img src={video.thumbnailpath} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-white opacity-80">
                                                    <Play size={40} className="mb-2" />
                                                    <span className="text-xs">Aucune vignette</span>
                                                </div>
                                            )}
                                            <div className="absolute top-1.5 right-1.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {canEdit('news') && (
                                                    <button onClick={() => handleEditVideo(video)} className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-blue-600 hover:bg-white transition shadow-sm" title="Modifier"><Edit size={14} /></button>
                                                )}
                                                {canDelete('news') && (
                                                    <button onClick={() => handleDeleteVideo(video)} className="bg-white/95 backdrop-blur-sm p-1.5 rounded-md text-red-600 hover:bg-white transition shadow-sm" title="Supprimer"><Trash2 size={14} /></button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3 flex flex-col flex-grow">
                                            <div className="text-green-600 font-semibold mb-1.5 text-xs">{video.date || '-'}</div>
                                            <h3 className="text-sm font-bold text-green-800 mb-2 line-clamp-2 leading-tight flex-grow">{video.title}</h3>
                                            {video.description && <p className="text-gray-600 mb-3 text-xs line-clamp-3 leading-relaxed flex-grow">{video.description}</p>}
                                            <div className="flex items-center justify-between gap-2 mt-auto pt-2.5 border-t border-gray-100">
                                                {video.videourl ? (
                                                    <a href={video.videourl} target="_blank" rel="noopener noreferrer" className="text-green-600 font-medium hover:text-green-800 transition-colors text-xs flex items-center gap-1">
                                                        <Play size={14} /> Lire la vidéo
                                                    </a>
                                                ) : video.filepath ? (
                                                    <a href={video.filepath} target="_blank" rel="noopener noreferrer" className="text-green-600 font-medium hover:text-green-800 transition-colors text-xs flex items-center gap-1">
                                                        <Play size={14} /> Ouvrir le fichier
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
                )
            )}
        </div>
    );
};

export default NewsAdmin;
