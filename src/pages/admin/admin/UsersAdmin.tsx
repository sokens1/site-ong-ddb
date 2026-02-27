import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import DataTable from '../../../components/admin/DataTable';
import Modal from '../../../components/admin/Modal';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';
import SearchBar from '../../../components/admin/SearchBar';
import { Plus, Mail } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  role: 'admin' | 'charge_communication' | 'chef_projet' | 'partenaire' | 'membre';
  created_at?: string | null;
  updated_at?: string | null;
  is_active?: boolean | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  charge_communication: 'Chargé de Communication',
  chef_projet: 'Chef de projet',
  partenaire: 'Partenaire',
  membre: 'Membre',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  charge_communication: 'bg-blue-100 text-blue-800',
  chef_projet: 'bg-green-100 text-green-800',
  partenaire: 'bg-purple-100 text-purple-800',
  membre: 'bg-gray-100 text-gray-800',
};

const UsersAdmin: React.FC = () => {
  const { canEdit, canDelete } = useUserRole();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    email: '',
    full_name: '',
    role: 'membre',
  });
  const [password, setPassword] = useState('');

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
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer les profils depuis la table user_profiles
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) {
        // Si la table n'existe pas encore, retourner un tableau vide
        if (profileError.code === 'PGRST116' || profileError.message.includes('does not exist')) {
          setUsers([]);
          setLoading(false);
          return;
        }
        throw profileError;
      }

      // Convertir les profils en UserProfile
      const usersData: UserProfile[] = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email || '',
        full_name: profile.full_name || null,
        role: profile.role || 'membre',
        created_at: profile.created_at || null,
        updated_at: profile.updated_at || null,
        is_active: profile.is_active !== false, // Par défaut true si non défini
      }));

      setUsers(usersData);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        (user.email || '').toLowerCase().includes(q) ||
        (user.full_name || '').toLowerCase().includes(q) ||
        ROLE_LABELS[user.role]?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const handleAdd = () => {
    setEditingUser(null);
    setFormData({ email: '', full_name: '', role: 'membre' });
    setPassword('');
    setIsModalOpen(true);
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
    });
    setPassword('');
    setIsModalOpen(true);
  };

  const handleDelete = (user: UserProfile) => {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer l\'utilisateur',
      message: `Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.email}" ?\n\nNote: Le compte d'authentification restera actif, seul le profil sera supprimé.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error: deleteError } = await supabase
            .from('user_profiles')
            .delete()
            .eq('id', user.id);

          if (deleteError) throw deleteError;
          await fetchUsers();
        } catch (err: any) {
          alert(`Erreur: ${err.message || 'Erreur lors de la suppression'}`);
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Mise à jour du profil dans la table user_profiles
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            email: formData.email,
            full_name: formData.full_name || null,
            role: formData.role,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingUser.id);

        if (profileError) {
          throw new Error(`Erreur lors de la mise à jour: ${profileError.message}`);
        }

        // Note: Le changement de mot de passe doit être fait par l'utilisateur lui-même
        // via la page de profil ou de réinitialisation de mot de passe
        if (password) {
          alert('Note: Le changement de mot de passe doit être effectué par l\'utilisateur via la réinitialisation de mot de passe.');
        }
      } else {
        // Création d'un nouvel utilisateur
        if (!password) {
          alert('Un mot de passe est requis pour créer un nouvel utilisateur');
          return;
        }

        // Créer l'utilisateur avec signUp (accessible côté client)
        const { data: newUser, error: createError } = await supabase.auth.signUp({
          email: formData.email || '',
          password: password,
          options: {
            data: {
              full_name: formData.full_name,
              role: formData.role,
            },
            emailRedirectTo: window.location.origin + '/admin/auth/callback',
          },
        });

        if (createError) {
          throw new Error(`Erreur lors de la création: ${createError.message}`);
        }

        if (!newUser?.user) {
          throw new Error('Erreur: Utilisateur non créé');
        }

        // Créer le profil dans la table user_profiles
        const { error: profileError } = await supabase.from('user_profiles').insert({
          id: newUser.user.id,
          email: formData.email,
          full_name: formData.full_name || null,
          role: formData.role,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (profileError) {
          // Si l'insertion du profil échoue, on affiche un avertissement mais on continue
          console.warn('Erreur lors de la création du profil:', profileError);
          alert(`Utilisateur créé avec succès, mais erreur lors de la création du profil: ${profileError.message}\n\nVous pouvez créer le profil manuellement.`);
        }
      }

      setIsModalOpen(false);
      setFormData({ email: '', full_name: '', role: 'membre' });
      setPassword('');
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      alert(`Erreur: ${err.message || 'Erreur lors de l\'enregistrement'}`);
      console.error('Error saving user:', err);
    }
  };

  const columns = [
    {
      key: 'email',
      label: 'Email',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-gray-400" />
          <span className="font-medium">{value || '-'}</span>
        </div>
      ),
    },
    {
      key: 'full_name',
      label: 'Nom complet',
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      key: 'role',
      label: 'Rôle',
      render: (value: string) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[value] || ROLE_COLORS.membre
            }`}
        >
          {ROLE_LABELS[value] || value}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date de création',
      render: (value: string) => (
        <span className="text-sm text-gray-500">
          {value ? new Date(value).toLocaleDateString('fr-FR') : '-'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Erreur: {error}</p>
        <button
          onClick={fetchUsers}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Plus size={18} />
          Ajouter un utilisateur
        </button>
      </div>

      <div className="mb-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <DataTable
        columns={columns}
        data={filteredUsers}
        onEdit={canEdit('users') ? handleEdit : undefined}
        onDelete={canDelete('users') ? handleDelete : undefined}
        title="Gestion des Utilisateurs"
        isLoading={loading}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Modifier un utilisateur' : 'Ajouter un utilisateur'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom complet
            </label>
            <input
              type="text"
              value={formData.full_name || ''}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rôle *
            </label>
            <select
              value={formData.role || 'membre'}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as UserProfile['role'] })
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            >
              <option value="admin">Admin</option>
              <option value="charge_communication">Chargé de Communication</option>
              <option value="chef_projet">Chef de projet</option>
              <option value="partenaire">Partenaire</option>
              <option value="membre">Membre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {editingUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!editingUser}
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
            {editingUser && (
              <p className="text-xs text-gray-500 mt-1">
                Laissez vide si vous ne souhaitez pas modifier le mot de passe
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              {editingUser ? 'Enregistrer' : 'Créer'}
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

export default UsersAdmin;


