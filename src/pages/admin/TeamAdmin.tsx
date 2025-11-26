import React, { useState, useMemo } from 'react';
import { useCrud } from '../../hooks/useCrud';
import DataTable from '../../components/admin/DataTable';
import Modal from '../../components/admin/Modal';
import ImageUpload from '../../components/admin/ImageUpload';

interface TeamMember {
  id: number;
  name: string;
  position: string;
  description: string;
  image: string;
  created_at?: string;
}

const TeamAdmin: React.FC = () => {
  const { data, loading, error, create, update, delete: deleteMember } = useCrud<TeamMember>({ tableName: 'team_members' });
  
  // Trier les données par ID croissant (du premier au dernier)
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.id - b.id);
  }, [data]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState<Partial<TeamMember>>({
    name: '',
    position: '',
    description: '',
    image: '',
  });

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ name: '', position: '', description: '', image: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item: TeamMember) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item: TeamMember) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${item.name}" ?`)) {
      try {
        await deleteMember(item.id);
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
      setFormData({ name: '', position: '', description: '', image: '' });
    } catch (err) {
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const columns = [
    {
      key: 'image',
      label: 'Profil',
      align: 'center' as const,
      render: (value: string) => (
        <div className="flex items-center justify-center">
          {value ? (
            <img
              src={value}
              alt="Profil"
              className="w-12 h-12 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs shrink-0">
              Pas d'image
            </div>
          )}
        </div>
      ),
    },
    { 
      key: 'name', 
      label: 'Nom',
      render: (value: string) => <span className="truncate block">{value || '-'}</span>,
    },
    { 
      key: 'position', 
      label: 'Poste',
      render: (value: string) => <span className="truncate block">{value || '-'}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (value: string) => <span className="truncate block">{value || '-'}</span>,
    },
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Gestion de l'Équipe</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={sortedData}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
        title="Membres de l'équipe"
        isLoading={loading}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Modifier un membre' : 'Ajouter un membre'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-full">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poste *</label>
            <input
              type="text"
              value={formData.position || ''}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <ImageUpload
            value={formData.image || ''}
            onChange={(url) => setFormData({ ...formData, image: url })}
            bucket="ong-backend"
            folder="team/images"
            label="Photo du membre"
            required
          />

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

export default TeamAdmin;

