import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import DataTable from '../../../components/admin/DataTable';
import Modal from '../../../components/admin/Modal';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';
import { Eye, Download, Calendar, X, CheckCircle, Trash2 } from 'lucide-react';
import useUserRole from '../../../hooks/useUserRole';
import * as XLSX from 'xlsx';

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
  status?: 'en_attente' | 'entretien' | 'accepte' | 'refuse';
  captcha?: boolean | null;
  created_at?: string;
}

interface InterviewSchedule {
  id?: number;
  submission_id: number;
  interview_date: string;
  location?: string;
  interview_type?: string;
  notes?: string;
  created_by?: string;
}

const SubmissionsAdmin: React.FC = () => {
  const { canDelete, userId } = useUserRole();
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // Interview state
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [interviewData, setInterviewData] = useState<Partial<InterviewSchedule>>({
    interview_date: '',
    location: '',
    interview_type: 'visio',
    notes: '',
  });
  const [existingInterview, setExistingInterview] = useState<InterviewSchedule | null>(null);
  const [interviewLoading, setInterviewLoading] = useState(false);

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
    fetchData();
  }, []);

  // Fetch interview when viewing a submission
  useEffect(() => {
    if (selectedSubmission) {
      fetchInterview(selectedSubmission.id);
    } else {
      setExistingInterview(null);
      setShowInterviewForm(false);
    }
  }, [selectedSubmission]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Vous devez être connecté pour voir les candidatures');
        setLoading(false);
        return;
      }

      const { data: fetchedData, error: fetchError } = await supabase
        .from('form_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setData(fetchedData || []);
    } catch (err: any) {
      let errorMessage = 'Erreur lors du chargement des données';
      if (err.code === 'PGRST301' || err.code === '42P01') {
        errorMessage = 'La table "form_submissions" n\'existe pas';
      } else if (err.code === '42501' || err.message?.includes('permission')) {
        errorMessage = 'Permission refusée. Vérifiez les politiques RLS.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchInterview = async (submissionId: number) => {
    try {
      const { data, error } = await supabase
        .from('interview_schedules')
        .select('*')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (!error && data) {
        setExistingInterview(data);
      } else {
        setExistingInterview(null);
      }
    } catch {
      setExistingInterview(null);
    }
  };

  const handleScheduleInterview = async () => {
    if (!selectedSubmission || !interviewData.interview_date) return;

    try {
      setInterviewLoading(true);

      const payload: any = {
        submission_id: selectedSubmission.id,
        interview_date: interviewData.interview_date,
        location: interviewData.location || null,
        interview_type: interviewData.interview_type || 'visio',
        notes: interviewData.notes || null,
        created_by: userId || null,
      };

      if (existingInterview?.id) {
        const { error } = await supabase
          .from('interview_schedules')
          .update(payload)
          .eq('id', existingInterview.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('interview_schedules')
          .insert([payload]);
        if (error) throw error;
      }

      // Send interview invitation email via Brevo Edge Function
      try {
        await supabase.functions.invoke('send-interview-invite', {
          body: {
            email: selectedSubmission.email,
            fullname: selectedSubmission.fullname,
            date: interviewData.interview_date,
            location: interviewData.location,
            type: interviewData.interview_type,
            notes: interviewData.notes,
          },
        });
      } catch (emailErr) {
        console.error('Error sending interview email:', emailErr);
      }

      // Update submission status to 'entretien' automatically
      const { error: statusError } = await supabase
        .from('form_submissions')
        .update({ status: 'entretien' })
        .eq('id', selectedSubmission.id);

      if (statusError) throw statusError;

      // Optimistic update
      setData(prev => prev.map(s => s.id === (selectedSubmission as Submission).id ? { ...s, status: 'entretien' } : s));

      alert('Entretien programmé avec succès');
      setShowInterviewForm(false);
      fetchData(); // Refresh list to see status change
      fetchInterview(selectedSubmission.id);
    } catch (err: any) {
      alert(`Erreur: ${err.message || 'Impossible de programmer l\'entretien'}`);
    } finally {
      setInterviewLoading(false);
    }
  };

  // Export to XLSX
  const handleExport = () => {
    let exportData = data;

    if (exportStartDate || exportEndDate) {
      exportData = data.filter(item => {
        if (!item.created_at) return false;
        const date = new Date(item.created_at);
        if (exportStartDate && date < new Date(exportStartDate)) return false;
        if (exportEndDate) {
          const end = new Date(exportEndDate);
          end.setHours(23, 59, 59, 999);
          if (date > end) return false;
        }
        return true;
      });
    }

    if (exportData.length === 0) {
      alert('Aucune candidature trouvée pour cette période');
      return;
    }

    const wsData = exportData.map(item => ({
      'Civilité': item.civility || '',
      'Nom complet': item.fullname,
      'Email': item.email,
      'Téléphone': item.phone || '',
      'Ville': item.city || '',
      'Intérêt': item.interest || '',
      'Compétences': item.skills || '',
      'Motivation': item.motivation || '',
      'CV URL': item.cv_url || '',
      'Date': item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidatures');

    // Auto-width columns
    const colWidths = Object.keys(wsData[0]).map(key => ({
      wch: Math.max(key.length, ...wsData.map(row => String((row as any)[key]).length).slice(0, 100)) + 2
    }));
    ws['!cols'] = colWidths;

    const period = exportStartDate || exportEndDate
      ? `_${exportStartDate || 'debut'}_${exportEndDate || 'fin'}`
      : '';
    XLSX.writeFile(wb, `candidatures${period}.xlsx`);
    setShowExportModal(false);
  };

  const columns = useMemo(() => [
    {
      key: 'fullname',
      label: 'Nom complet',
      render: (value: string, row: Submission) => (
        <span className="font-medium text-gray-900">{row.civility ? `${row.civility} ` : ''}{value}</span>
      ),
    },
    { key: 'email', label: 'Email', hiddenOnMobile: true },
    { key: 'phone', label: 'Téléphone', hiddenOnMobile: true },
    { key: 'city', label: 'Ville', hiddenOnMobile: true },
    {
      key: 'status',
      label: 'Statut',
      hiddenOnMobile: true,
      render: (value: string) => {
        const statuses: any = {
          en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
          entretien: { label: 'Entretien', color: 'bg-blue-100 text-blue-800 border-blue-200' },
          accepte: { label: 'Accepté', color: 'bg-green-100 text-green-800 border-green-200' },
          refuse: { label: 'Refusé', color: 'bg-red-100 text-red-800 border-red-200' },
        };
        const s = statuses[value] || statuses['en_attente'];
        return (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.color}`}>
            {s.label}
          </span>
        );
      }
    },
    {
      key: 'interest',
      label: 'Intérêt',
      hiddenOnMobile: true,
      render: (value: string) => <span className="max-w-[150px] truncate block text-xs text-gray-500">{value || '-'}</span>,
    },
    {
      key: 'cv_url',
      label: 'CV',
      hiddenOnMobile: true,
      render: (value: string) => value ? (
        <div className="flex items-center gap-2">
          <a href={value} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Visualiser">
            <Eye size={14} />
          </a>
          <a href={value} download className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors" title="Télécharger">
            <Download size={14} />
          </a>
        </div>
      ) : '-',
    },
    {
      key: 'created_at',
      label: 'Date',
      hiddenOnMobile: true,
      render: (value: string) => value ? new Date(value).toLocaleDateString('fr-FR') : '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: Submission) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedSubmission(row)}
            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            title="Détails & Entretien"
          >
            <Eye size={16} />
          </button>

          <button
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                title: 'Accepter la candidature',
                message: `Voulez-vous vraiment accepter la candidature de ${row.fullname} ?`,
                type: 'success',
                onConfirm: async () => {
                  try {
                    const { error } = await supabase
                      .from('form_submissions')
                      .update({ status: 'accepte' })
                      .eq('id', row.id);

                    if (error) throw error;
                    setData(prev => prev.map(s => s.id === row.id ? { ...s, status: 'accepte' } : s));
                    alert('Candidature acceptée avec succès !');
                  } catch (err: any) {
                    alert(`Erreur: ${err.message}`);
                  }
                }
              });
            }}
            className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
            title="Accepter"
          >
            <CheckCircle size={16} />
          </button>

          {canDelete('submissions') && (
            <button
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: 'Supprimer la candidature',
                  message: `Êtes-vous sûr de vouloir supprimer définitivement la candidature de ${row.fullname} ?`,
                  type: 'danger',
                  onConfirm: async () => {
                    try {
                      const { error } = await supabase
                        .from('form_submissions')
                        .delete()
                        .eq('id', row.id);
                      if (error) throw error;
                      setData(prev => prev.filter(s => s.id !== row.id));
                    } catch (err: any) {
                      alert(`Erreur: ${err.message}`);
                    }
                  }
                });
              }}
              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ], [canDelete, userId]);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Candidatures</h1>
        <button
          onClick={() => {
            setExportStartDate('');
            setExportEndDate('');
            setShowExportModal(true);
          }}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-semibold"
        >
          <Download size={18} />
          Exporter (XLSX)
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
      )}

      <DataTable
        columns={columns}
        data={data}
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

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Exporter les candidatures</h3>
                  <p className="text-xs text-gray-500">Choisissez une période (optionnel)</p>
                </div>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Date début</label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Date fin</label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Laissez vide pour exporter toutes les candidatures
              </p>
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
                Annuler
              </button>
              <button onClick={handleExport} className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition flex items-center gap-2">
                <Download size={16} />
                Télécharger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        title="Détails de la candidature"
        size="lg"
      >
        {selectedSubmission && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Interview badge */}
            {existingInterview && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                <Calendar size={18} className="text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    Entretien programmé le {new Date(existingInterview.interview_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-blue-600">
                    {existingInterview.interview_type === 'visio' ? '📹 Visioconférence' : '📍 Présentiel'}
                    {existingInterview.location ? ` — ${existingInterview.location}` : ''}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Civilité</label>
                <p className="text-gray-900 text-sm">{selectedSubmission.civility || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nom complet</label>
                <p className="text-gray-900 text-sm">{selectedSubmission.fullname}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                <p className="text-gray-900 text-sm">{selectedSubmission.email}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Téléphone</label>
                <p className="text-gray-900 text-sm">{selectedSubmission.phone || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Ville</label>
                <p className="text-gray-900 text-sm">{selectedSubmission.city || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date de candidature</label>
                <p className="text-gray-900 text-sm">
                  {selectedSubmission.created_at
                    ? new Date(selectedSubmission.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '-'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Statut actuel</label>
                <div className="mt-1">
                  {(() => {
                    const statuses: Record<string, { label: string, color: string }> = {
                      en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                      entretien: { label: 'Entretien', color: 'bg-blue-100 text-blue-800 border-blue-200' },
                      accepte: { label: 'Accepté', color: 'bg-green-100 text-green-800 border-green-200' },
                      refuse: { label: 'Refusé', color: 'bg-red-100 text-red-800 border-red-200' },
                    };
                    const s = statuses[selectedSubmission.status || 'en_attente'] || statuses['en_attente'];
                    return (
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${s.color}`}>
                        {s.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Intérêt</label>
              <p className="text-gray-900 text-sm whitespace-pre-wrap break-words">{selectedSubmission.interest || '-'}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Compétences</label>
              <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                <p className="text-gray-900 text-sm whitespace-pre-wrap break-words">{selectedSubmission.skills || '-'}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Motivation</label>
              <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                <p className="text-gray-900 text-sm whitespace-pre-wrap break-words">{selectedSubmission.motivation || '-'}</p>
              </div>
            </div>

            {selectedSubmission.cv_url && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">CV</label>
                <a
                  href={selectedSubmission.cv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-2 text-sm"
                >
                  Télécharger le CV
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            {/* Interview scheduling */}
            {!showInterviewForm ? (
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowInterviewForm(true);
                    if (existingInterview) {
                      setInterviewData({
                        interview_date: existingInterview.interview_date?.slice(0, 16) || '',
                        location: existingInterview.location || '',
                        interview_type: existingInterview.interview_type || 'visio',
                        notes: existingInterview.notes || '',
                      });
                    } else {
                      setInterviewData({ interview_date: '', location: '', interview_type: 'visio', notes: '' });
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
                >
                  <Calendar size={16} />
                  {existingInterview ? 'Modifier l\'entretien' : 'Programmer un entretien'}
                </button>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Calendar size={16} className="text-blue-600" />
                  {existingInterview ? 'Modifier l\'entretien' : 'Programmer un entretien'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date et heure *</label>
                    <input
                      type="datetime-local"
                      value={interviewData.interview_date || ''}
                      onChange={(e) => setInterviewData({ ...interviewData, interview_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                    <select
                      value={interviewData.interview_type || 'visio'}
                      onChange={(e) => setInterviewData({ ...interviewData, interview_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                    >
                      <option value="visio">Visioconférence</option>
                      <option value="presentiel">Présentiel</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Lieu / Lien</label>
                  <input
                    type="text"
                    value={interviewData.location || ''}
                    onChange={(e) => setInterviewData({ ...interviewData, location: e.target.value })}
                    placeholder="Ex: Bureaux ONG DDB ou lien Zoom"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                  <textarea
                    value={interviewData.notes || ''}
                    onChange={(e) => setInterviewData({ ...interviewData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                    placeholder="Notes internes..."
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowInterviewForm(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleScheduleInterview}
                    disabled={interviewLoading || !interviewData.interview_date}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <Calendar size={16} />
                    {interviewLoading ? 'Enregistrement...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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

export default SubmissionsAdmin;
