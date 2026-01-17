import React, { useState, useEffect, useMemo } from 'react';
import DataTable from '../../../components/admin/DataTable';
import SearchBar from '../../../components/admin/SearchBar';
import Modal from '../../../components/admin/Modal';
import FileUpload from '../../../components/admin/FileUpload';
import { Plus, FileText, Download, Trash2 } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';
import { useNotifications } from '../../../hooks/useNotifications';
import { useCrud } from '../../../hooks/useCrud';
import { supabase } from '../../../supabaseClient';

interface Document {
    id: number;
    title: string;
    file_url?: string;
    project_id?: number | null;
    created_at?: string;
}

const DocumentsAdmin: React.FC = () => {
    const { canCreate, canDelete, role, userId } = useUserRole();
    const { createNotification } = useNotifications(userId);
    const { create, delete: deleteDoc, data: documentsRes } = useCrud<Document>({ tableName: 'documents' });
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [actorProfile, setActorProfile] = useState<any>(null);
    const [formData, setFormData] = useState<Partial<Document & { category: string }>>({
        title: '',
        file_url: '',
        project_id: undefined,
        category: 'General'
    });
    const [projects, setProjects] = useState<any[]>([]);

    useEffect(() => {
        if (userId) {
            supabase.from('user_profiles').select('*').eq('id', userId).single().then(({ data }) => setActorProfile(data));
            // Fetch projects for the dropdown
            supabase.from('projects').select('id, title').then(({ data }) => setProjects(data || []));
        }
    }, [userId]);

    useEffect(() => {
        fetchDocuments();
    }, [role, documentsRes]); // Added documentsRes to trigger refetch after CRUD operations

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            setError(null);

            let query = supabase.from('documents').select('*');

            // Filter for partners/members: only show documents linked to their projects
            if (role === 'partenaire' || role === 'membre') {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    setDocuments([]);
                    setLoading(false);
                    return;
                }

                const userId = user.id;
                console.log('Fetching projects for user:', userId);

                // Fetch projects assigned to this user
                const { data: projects, error: projectsError } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('partner_id', userId);

                if (projectsError) {
                    console.error('Error fetching partner projects:', projectsError);
                    setDocuments([]);
                    setLoading(false);
                    return;
                }

                const projectIds = projects?.map(p => p.id) || [];
                console.log('Assigned projects:', projectIds);

                if (projectIds.length > 0) {
                    query = query.in('project_id', projectIds);
                } else {
                    console.log('No projects assigned to this user.');
                    setDocuments([]);
                    setLoading(false);
                    return;
                }
            }

            const { data, error: fetchError } = await query.order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setDocuments(data || []);
        } catch (err: any) {
            console.error('Error fetching documents:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return documents;
        const q = searchQuery.toLowerCase();
        return documents.filter((doc) =>
            doc.title.toLowerCase().includes(q)
        );
    }, [documents, searchQuery]);

    const columns = [
        { key: 'title', label: 'Titre' },
        {
            key: 'file_url',
            label: 'Fichier',
            render: (val: string) => val ? <a href={val} target="_blank" rel="noopener" className="text-blue-600 hover:underline">Voir</a> : '-'
        },
        { key: 'created_at', label: 'Date' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newDoc = await create(formData);
            if (newDoc) {
                const { data: profiles } = await supabase.from('user_profiles').select('id');
                if (profiles) {
                    const actorName = actorProfile?.full_name || 'Un membre de l\'équipe';
                    const actorRole = role?.replace('_', ' ') || 'Membre';
                    for (const profile of profiles) {
                        if (profile.id === userId) continue;
                        await createNotification({
                            user_id: profile.id,
                            actor_id: userId || undefined,
                            actor_name: actorName,
                            actor_role: actorRole,
                            type: 'document_published',
                            title: 'Nouveau Document',
                            message: `${actorName} (${actorRole}) a publié un nouveau document : ${formData.title}`,
                            link: '/admin/documents'
                        });
                    }
                }
                setIsModalOpen(false);
                setFormData({ title: '', file_url: '', project_id: undefined, category: 'General' });
                // Refresh documents
                window.location.reload(); // Simple refresh for now to trigger the complex useEffect logic
            }
        } catch (err) {
            alert('Erreur lors de l\'ajout du document');
        }
    };

    return (
        <div className="w-full max-w-full overflow-x-hidden">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Gestion des Documents</h1>
                {canCreate('documents') && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2"
                    >
                        <Plus size={18} /> Ajouter
                    </button>
                )}
            </div>

            <SearchBar value={searchQuery} onChange={setSearchQuery} />

            {error && <div className="text-red-500 mb-4">{error}</div>}

            <DataTable
                columns={columns}
                data={filteredData}
                isLoading={loading}
                title="Documents"
                onDelete={canDelete('documents') ? async (item) => {
                    if (window.confirm('Supprimer ce document ?')) {
                        await deleteDoc(item.id);
                        window.location.reload();
                    }
                } : undefined}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Ajouter un Document"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Projet (Optionnel)</label>
                        <select
                            value={formData.project_id || ''}
                            onChange={e => setFormData({ ...formData, project_id: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="w-full px-4 py-2 border rounded-lg"
                        >
                            <option value="">-- Aucun projet --</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                        </select>
                    </div>
                    <FileUpload
                        value={formData.file_url || ''}
                        onChange={url => setFormData({ ...formData, file_url: url })}
                        bucket="ong-backend"
                        folder="documents"
                        label="Fichier"
                        required
                    />
                    <div className="flex justify-end gap-2 px-4 py-3 bg-gray-50 -mx-6 -mb-6">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg">Annuler</button>
                        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg">Ajouter</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DocumentsAdmin;
