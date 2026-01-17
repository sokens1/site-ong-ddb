import React, { useState } from 'react';
import { useCrud } from '../../../hooks/useCrud';
import DataTable from '../../../components/admin/DataTable';
import Modal from '../../../components/admin/Modal';
import useUserRole from '../../../hooks/useUserRole';

interface Faq {
  id: number;
  question: string;
  answer: string;
  created_at?: string;
}

const FaqAdmin: React.FC = () => {
  const { data, loading, error, create, update, delete: deleteFaq } = useCrud<Faq>({ tableName: 'faq' });
  const { canCreate, canEdit, canDelete } = useUserRole();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Faq | null>(null);
  const [formData, setFormData] = useState<Partial<Faq>>({
    question: '',
    answer: '',
  });

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ question: '', answer: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item: Faq) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item: Faq) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer cette FAQ ?`)) {
      try {
        await deleteFaq(item.id);
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
      setFormData({ question: '', answer: '' });
    } catch (err) {
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const columns = [
    {
      key: 'question',
      label: 'Question',
      render: (value: string) => <span className="max-w-md truncate block">{value || '-'}</span>,
    },
    {
      key: 'answer',
      label: 'Réponse',
      render: (value: string) => <span className="max-w-md truncate block">{value || '-'}</span>,
    },
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Gestion de la FAQ</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        onEdit={canEdit('faq') ? handleEdit : undefined}
        onDelete={canDelete('faq') ? handleDelete : undefined}
        onAdd={canCreate('faq') ? handleAdd : undefined}
        title="Questions fréquentes"
        isLoading={loading}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Modifier une FAQ' : 'Ajouter une FAQ'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-full">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question *</label>
            <input
              type="text"
              value={formData.question || ''}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Réponse *</label>
            <textarea
              value={formData.answer || ''}
              onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
              required
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
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

export default FaqAdmin;

