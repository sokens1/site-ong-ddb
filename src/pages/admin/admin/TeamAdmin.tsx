import React, { useState, useMemo } from 'react';
import { useCrud } from '../../../hooks/useCrud';
import DataTable from '../../../components/admin/DataTable';
import Modal from '../../../components/admin/Modal';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';
import ImageUpload from '../../../components/admin/ImageUpload';
import { LayoutGrid, List, Edit, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import useUserRole from '../../../hooks/useUserRole';
import { useNotifications } from '../../../hooks/useNotifications';
import { supabase } from '../../../supabaseClient';
import { useEffect } from 'react';

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
  const { canCreate, canEdit, canDelete, role, userId: currentUserId } = useUserRole();
  const { createNotification } = useNotifications(currentUserId);
  const [actorProfile, setActorProfile] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'orgchart' | 'list'>('orgchart');

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

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  useEffect(() => {
    if (currentUserId) {
      supabase.from('user_profiles').select('*').eq('id', currentUserId).single().then(({ data }) => setActorProfile(data));
    }
  }, [currentUserId]);

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

  const handleDelete = (item: TeamMember) => {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer le membre',
      message: `Êtes-vous sûr de vouloir supprimer "${item.name}" de l'équipe ?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteMember(item.id);
        } catch (err) {
          alert('Erreur lors de la suppression');
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await update(editingItem.id, formData);
      } else {
        const newMember = await create(formData);
        if (newMember) {
          const { data: profiles } = await supabase.from('user_profiles').select('id');
          if (profiles) {
            const actorName = actorProfile?.full_name || 'Un membre de l\'équipe';
            const actorRole = role?.replace('_', ' ') || 'Membre';
            for (const profile of profiles) {
              if (profile.id === currentUserId) continue;
              await createNotification({
                user_id: profile.id,
                actor_id: currentUserId || undefined,
                actor_name: actorName,
                actor_role: actorRole,
                type: 'member_added',
                title: 'Nouveau Membre d\'Équipe',
                message: `${actorName} (${actorRole}) a ajouté un nouveau membre : ${formData.name}`,
                link: '/admin/team'
              });
            }
          }
        }
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

  // Single Org Chart Node
  const OrgNode: React.FC<{ member: TeamMember; isRoot?: boolean }> = ({ member, isRoot = false }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative bg-white rounded-xl shadow-lg border-2 ${isRoot ? 'border-green-500' : 'border-gray-200'} p-4 w-64 h-[200px] flex flex-col items-center group`}
    >
      {/* Profile Image */}
      <div className="flex justify-center mb-3">
        {member.image ? (
          <img
            src={member.image}
            alt={member.name}
            className={`w-20 h-20 rounded-full object-cover border-4 ${isRoot ? 'border-green-500' : 'border-gray-300'}`}
          />
        ) : (
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white ${isRoot ? 'bg-green-500' : 'bg-gray-400'}`}>
            {member.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-center w-full mt-auto">
        <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{member.name}</h3>
        <p className={`text-xs font-medium ${isRoot ? 'text-green-600' : 'text-gray-500'} leading-tight line-clamp-2`}>{member.position}</p>
      </div>

      {/* Hover Actions */}
      <div className="absolute inset-0 bg-black/70 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {canEdit('team') && (
          <button
            onClick={() => handleEdit(member)}
            className="bg-white text-green-600 p-2 rounded-lg hover:bg-green-50 transition"
            title="Modifier"
          >
            <Edit size={16} />
          </button>
        )}
        {canDelete('team') && (
          <button
            onClick={() => handleDelete(member)}
            className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition"
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </motion.div>
  );

  // Hierarchical Org Chart View
  const OrgChartView = () => {
    if (sortedData.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p>Aucun membre dans l'équipe</p>
          <button onClick={handleAdd} className="mt-4 text-green-600 hover:underline">
            + Ajouter le premier membre
          </button>
        </div>
      );
    }

    const root = sortedData[0];
    const level1 = sortedData.slice(1, 4); // Next 3 members
    const level2 = sortedData.slice(4); // Remaining members

    return (
      <div className="flex flex-col items-center py-8 px-4 min-w-fit">
        {/* Root (ID 1) */}
        <div className="relative">
          <OrgNode member={root} isRoot />

          {/* Vertical line down from root */}
          {level1.length > 0 && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-10 bg-gray-300" />
          )}
        </div>

        {/* Level 1 */}
        {level1.length > 0 && (
          <>
            {/* Horizontal connector line */}
            <div className="relative mt-10">
              {level1.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-gray-300"
                  style={{
                    left: `calc(50% - ${(level1.length - 1) * 152}px)`,
                    width: `${(level1.length - 1) * 304}px`
                  }}
                />
              )}

              <div className="flex gap-8 justify-center">
                {level1.map((member, index) => (
                  <div key={member.id} className="relative">
                    {/* Vertical line up to horizontal connector */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0.5 h-6 bg-gray-300" />

                    <OrgNode member={member} />

                    {/* Vertical line down to next level if applicable */}
                    {level2.length > 0 && index === Math.floor(level1.length / 2) && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-10 bg-gray-300" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Level 2 */}
        {level2.length > 0 && (
          <div className="relative mt-10">
            {level2.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-gray-300"
                style={{
                  left: `calc(50% - ${(level2.length - 1) * 152}px)`,
                  width: `${(level2.length - 1) * 304}px`
                }}
              />
            )}

            <div className="flex gap-8 justify-center flex-wrap">
              {level2.map((member) => (
                <div key={member.id} className="relative mb-6">
                  {/* Vertical line up to horizontal connector */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0.5 h-6 bg-gray-300" />

                  <OrgNode member={member} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-full overflow-x-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestion de l'Équipe</h1>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('orgchart')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${viewMode === 'orgchart'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <LayoutGrid size={16} />
              Organigramme
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${viewMode === 'list'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <List size={16} />
              Liste
            </button>
          </div>

          {canCreate('team') && (
            <button
              onClick={handleAdd}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              + Ajouter un membre
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      ) : viewMode === 'orgchart' ? (
        <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-200 min-h-[500px]">
          <OrgChartView />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={sortedData}
          onEdit={canEdit('team') ? handleEdit : undefined}
          onDelete={canDelete('team') ? handleDelete : undefined}
          onAdd={canCreate('team') ? handleAdd : undefined}
          title="Membres de l'équipe"
          isLoading={loading}
        />
      )}

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

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
};

export default TeamAdmin;
