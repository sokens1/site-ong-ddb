import React, { useState } from 'react';
import { useCrud } from '../../hooks/useCrud';
import DataTable from '../../components/admin/DataTable';
import Modal from '../../components/admin/Modal';

interface Contribution {
  id: number;
  title: string;
  description?: string | null;
  icon?: string | null;
  created_at?: string;
}

const ContributionsAdmin: React.FC = () => {
  const { data, loading, error, create, update, delete: deleteContribution } = useCrud<Contribution>({ tableName: 'contribution_types' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Contribution | null>(null);
  const [formData, setFormData] = useState<Partial<Contribution>>({
    title: '',
    description: '',
    icon: '',
  });

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ title: '', description: '', icon: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item: Contribution) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item: Contribution) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${item.title}" ?`)) {
      try {
        await deleteContribution(item.id);
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
      setFormData({ title: '', description: '', icon: '' });
    } catch (err) {
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const columns = [
    { key: 'title', label: 'Titre' },
    {
      key: 'description',
      label: 'Description',
      render: (value: string) => <span className="max-w-md truncate block">{value || '-'}</span>,
    },
    {
      key: 'icon',
      label: 'Icône',
      render: (value: string) => value ? (
        <span className="text-lg">{value}</span>
      ) : '-',
    },
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Gestion des Types de Contribution</h1>
      
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
        title="Types de contribution"
        isLoading={loading}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Modifier un type de contribution' : 'Ajouter un type de contribution'}
        size="md"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Icône (classe Font Awesome)</label>
            <input
              type="text"
              value={formData.icon || ''}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="fas fa-heart"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">Exemple: fas fa-heart, fas fa-handshake, etc.</p>
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

export default ContributionsAdmin;

