import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import DataTable from '../../../components/admin/DataTable';
import { Plus } from 'lucide-react';

interface Action {
    id: number;
    title: string;
    description: string;
    image: string;
    category: string;
    date: string;
    created_at?: string;
}

const ActionsAdmin: React.FC = () => {
    const navigate = useNavigate();
    const { data, loading, error, delete: deleteAction } = useCrud<Action>({ tableName: 'actions' });

    const handleAdd = () => {
        navigate('/admin/actions/create');
    };

    const handleEdit = (item: Action) => {
        navigate(`/admin/actions/edit/${item.id}`);
    };

    const handleDelete = async (item: Action) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${item.title}" ?`)) {
            try {
                await deleteAction(item.id);
            } catch (err) {
                alert('Erreur lors de la suppression');
            }
        }
    };

    const columns = [
        { key: 'title', label: 'Titre' },
        { key: 'category', label: 'Catégorie' },
        { key: 'date', label: 'Date' },
        {
            key: 'description',
            label: 'Description',
            render: (value: string) => <span className="max-w-xs truncate block">{value || '-'}</span>,
        },
    ];

    return (
        <div className="w-full max-w-full overflow-x-hidden">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Gestion des Actions</h1>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm"
                >
                    <Plus size={20} />
                    Ajouter
                </button>
            </div>

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
                title="Actions"
                isLoading={loading}
            />
        </div>
    );
};

export default ActionsAdmin;

