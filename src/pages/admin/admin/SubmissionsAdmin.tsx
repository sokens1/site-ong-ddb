import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import DataTable from '../../../components/admin/DataTable';
import Modal from '../../../components/admin/Modal';
import { Eye } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';

interface Submission {
  id: number;
  civility?: string | null;
  fullname: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  interest?: string | null;
  skills?: string | null;
  motivation?: string | null;
  cv_url?: string | null;
  captcha?: boolean | null;
  created_at?: string;
}

const SubmissionsAdmin: React.FC = () => {
  const { canDelete } = useUserRole();
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Vérifier d'abord la session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Vous devez être connecté pour voir les candidatures');
        setLoading(false);
        return;
      }

      // Essayer d'abord avec id (qui devrait toujours exister)
      let { data: fetchedData, error: fetchError } = await supabase
        .from('form_submissions')
        .select('*')
        .order('id', { ascending: false });

      // Si id échoue, essayer avec created_at
      if (fetchError) {
        console.warn('Error with id order, trying created_at:', fetchError);
        const retry = await supabase
          .from('form_submissions')
          .select('*')
          .order('created_at', { ascending: false });

        if (retry.error) {
          console.warn('Error with created_at order, trying without order:', retry.error);
          // Si les deux échouent, essayer sans tri
          const noOrder = await supabase
            .from('form_submissions')
            .select('*');

          if (noOrder.error) {
            console.error('Final error:', noOrder.error);
            throw noOrder.error;
          }
          fetchedData = noOrder.data;
        } else {
          fetchedData = retry.data;
        }
      }

      console.log('Fetched submissions:', fetchedData?.length || 0);
      setData(fetchedData || []);

      // Si aucune erreur mais aucune donnée, c'est normal
      if ((!fetchedData || fetchedData.length === 0) && !fetchError) {
        console.log('Aucune candidature trouvée dans la base de données');
      }
    } catch (err: any) {
      let errorMessage = 'Erreur lors du chargement des données';

      // Messages d'erreur plus explicites
      if (err.code === 'PGRST301' || err.code === '42P01') {
        errorMessage = 'La table "form_submissions" n\'existe pas dans la base de données';
      } else if (err.code === '42501' || err.message?.includes('permission') || err.message?.includes('policy')) {
        errorMessage = 'Permission refusée. Vérifiez les politiques RLS (Row Level Security) dans Supabase pour permettre la lecture aux utilisateurs authentifiés.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: 'fullname',
      label: 'Nom complet',
      render: (value: string, row: Submission) => (
        <span>
          {row.civility ? `${row.civility} ` : ''}{value}
        </span>
      ),
    },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Téléphone' },
    { key: 'city', label: 'Ville' },
    {
      key: 'interest',
      label: 'Intérêt',
      render: (value: string) => <span className="max-w-xs truncate block">{value || '-'}</span>,
    },
    {
      key: 'cv_url',
      label: 'CV',
      render: (value: string) => value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          Télécharger
        </a>
      ) : '-',
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (value: string) => value ? new Date(value).toLocaleDateString('fr-FR') : '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: Submission) => (
        <button
          onClick={() => setSelectedSubmission(row)}
          className="text-green-600 hover:text-green-800 transition-colors"
          title="Voir les détails"
        >
          <Eye size={18} />
        </button>
      ),
    },
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Candidatures</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        onDelete={canDelete('submissions') ? async (row: Submission) => {
          if (window.confirm('Supprimer cette candidature ?')) {
            const { error } = await supabase.from('form_submissions').delete().eq('id', row.id);
            if (error) alert(error.message);
            else fetchData();
          }
        } : undefined}
        title="Candidatures reçues"
        isLoading={loading}
      />

      {!loading && !error && data.length === 0 && (
        <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          <p className="font-medium">Aucune candidature pour le moment</p>
          <p className="text-sm mt-1">Les candidatures soumises via le formulaire apparaîtront ici.</p>
        </div>
      )}

      {data.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          <p>Total: {data.length} candidature(s)</p>
        </div>
      )}

      {/* Modal pour voir les détails complets */}
      <Modal
        isOpen={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        title="Détails de la candidature"
        size="md"
      >
        {selectedSubmission && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Civilité</label>
                <p className="text-gray-900">{selectedSubmission.civility || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                <p className="text-gray-900">{selectedSubmission.fullname}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900">{selectedSubmission.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <p className="text-gray-900">{selectedSubmission.phone || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <p className="text-gray-900">{selectedSubmission.city || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de candidature</label>
                <p className="text-gray-900">
                  {selectedSubmission.created_at
                    ? new Date(selectedSubmission.created_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                    : '-'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Intérêt</label>
              <p className="text-gray-900">{selectedSubmission.interest || '-'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compétences</label>
              <p className="text-gray-900 whitespace-pre-wrap">{selectedSubmission.skills || '-'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivation</label>
              <p className="text-gray-900 whitespace-pre-wrap">{selectedSubmission.motivation || '-'}</p>
            </div>

            {selectedSubmission.cv_url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CV</label>
                <a
                  href={selectedSubmission.cv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-2"
                >
                  Télécharger le CV
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SubmissionsAdmin;

