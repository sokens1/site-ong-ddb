/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import DataTable from '../../../components/admin/DataTable';
import Modal from '../../../components/admin/Modal';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';
import { Eye, CheckCircle, Trash2 } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';

interface Donation {
  id: number;
  fullname: string;
  email: string;
  phone?: string | null;
  donation_type: 'financier' | 'materiel' | 'autre';
  amount?: string | null;
  description?: string | null;
  status: 'en_attente' | 'valide' | 'annule';
  created_at?: string;
}

const DonationsAdmin: React.FC = () => {
  const { canDelete } = useUserRole();
  const [data, setData] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'success' }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Non connecté'); setLoading(false); return; }
      const { data: fetchedData, error: fetchError } = await supabase
        .from('donations').select('*').order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setData(fetchedData || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, status: Donation['status']) => {
    try {
      const { error } = await supabase.from('donations').update({ status }).eq('id', id);
      if (error) throw error;
      setData(prev => prev.map(d => d.id === id ? { ...d, status } : d));
      if (selectedDonation?.id === id) setSelectedDonation(prev => prev ? { ...prev, status } : null);
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const deleteDonation = async (id: number) => {
    try {
      const { error } = await supabase.from('donations').delete().eq('id', id);
      if (error) throw error;
      setData(prev => prev.filter(d => d.id !== id));
      setSelectedDonation(null);
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const typeLabels: Record<string, { label: string; color: string }> = {
    financier: { label: 'Financier', color: 'bg-green-100 text-green-800' },
    materiel: { label: 'Matériel', color: 'bg-blue-100 text-blue-800' },
    autre: { label: 'Autre', color: 'bg-purple-100 text-purple-800' },
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
    valide: { label: 'Validé', color: 'bg-green-100 text-green-800' },
    annule: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
  };

  const columns = useMemo(() => [
    { key: 'fullname', label: 'Nom', render: (v: string) => <span className="font-medium text-gray-900">{v}</span> },
    { key: 'email', label: 'Email', hiddenOnMobile: true },
    {
      key: 'donation_type', label: 'Type',
      render: (v: string) => { const t = typeLabels[v] || { label: v, color: 'bg-gray-100 text-gray-700' }; return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span>; }
    },
    {
      key: 'amount', label: 'Montant', hiddenOnMobile: true,
      render: (v: string | null) => v ? `${v} FCFA` : '-'
    },
    {
      key: 'status', label: 'Statut',
      render: (v: string) => { const s = statusLabels[v] || statusLabels['en_attente']; return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>; }
    },
    {
      key: 'created_at', label: 'Date', hiddenOnMobile: true,
      render: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '-'
    },
    {
      key: 'actions', label: 'Actions',
      render: (_: any, row: Donation) => (
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDonation(row)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Détails">
            <Eye size={16} />
          </button>
          <button
            onClick={() => setConfirmModal({ isOpen: true, title: 'Valider le don', message: `Valider le don de ${row.fullname} ?`, type: 'success', onConfirm: () => updateStatus(row.id, 'valide') })}
            className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Valider"
          >
            <CheckCircle size={16} />
          </button>
          {canDelete('submissions') && (
            <button
              onClick={() => setConfirmModal({ isOpen: true, title: 'Supprimer le don', message: `Supprimer définitivement ce don de ${row.fullname} ?`, type: 'danger', onConfirm: () => deleteDonation(row.id) })}
              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
  ], [canDelete]);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Gestion des Dons</h1>
        <div className="flex gap-2 text-sm">
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-semibold">
            {data.filter(d => d.status === 'en_attente').length} en attente
          </span>
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
            {data.filter(d => d.status === 'valide').length} validés
          </span>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <DataTable columns={columns} data={data} title="Dons reçus" isLoading={loading} />

      {/* Detail Modal */}
      <Modal isOpen={!!selectedDonation} onClose={() => setSelectedDonation(null)} title="Détails du don" size="lg">
        {selectedDonation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nom</label>
                <p className="text-gray-900 text-sm">{selectedDonation.fullname}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                <p className="text-gray-900 text-sm">{selectedDonation.email}</p>
              </div>
              {selectedDonation.phone && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Téléphone</label>
                  <p className="text-gray-900 text-sm">{selectedDonation.phone}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Type</label>
                <p className="text-gray-900 text-sm capitalize">{selectedDonation.donation_type}</p>
              </div>
              {selectedDonation.amount && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Montant</label>
                  <p className="text-gray-900 text-sm">{selectedDonation.amount} FCFA</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Statut</label>
                <select
                  value={selectedDonation.status}
                  onChange={(e) => updateStatus(selectedDonation.id, e.target.value as Donation['status'])}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="en_attente">En attente</option>
                  <option value="valide">Validé</option>
                  <option value="annule">Annulé</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                <p className="text-gray-900 text-sm">{selectedDonation.created_at ? new Date(selectedDonation.created_at).toLocaleDateString('fr-FR') : '-'}</p>
              </div>
            </div>
            {selectedDonation.description && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-900 text-sm whitespace-pre-wrap">{selectedDonation.description}</p>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button onClick={() => setSelectedDonation(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition">Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} type={confirmModal.type} />
    </div>
  );
};

export default DonationsAdmin;
