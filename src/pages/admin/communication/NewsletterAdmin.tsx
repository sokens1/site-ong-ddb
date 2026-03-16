import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import DataTable from '../../../components/admin/DataTable';
import useUserRole from '../../../hooks/useUserRole';
import Modal from '../../../components/admin/Modal';
import RichTextEditor from '../../../components/admin/RichTextEditor';
import FileUpload from '../../../components/admin/FileUpload';
import { Mail, Send, CheckCircle } from 'lucide-react';

interface NewsletterSubscriber {
  id: number;
  email: string;
  created_at?: string;
}

const NewsletterAdmin: React.FC = () => {
  const { canDelete } = useUserRole();
  const [data, setData] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Composer Modal state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [sending, setSending] = useState(false);

  // Success Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      let { data: fetchedData, error: fetchError } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('id', { ascending: false });

      if (fetchError) {
        const retry = await supabase
          .from('newsletter_subscribers')
          .select('*')
          .order('created_at', { ascending: false });

        if (retry.error) {
          const noOrder = await supabase.from('newsletter_subscribers').select('*');
          if (noOrder.error) throw noOrder.error;
          fetchedData = noOrder.data;
        } else {
          fetchedData = retry.data;
        }
      }

      const subscribers = fetchedData || [];
      setData(subscribers);

      // Auto-select all by default when fetching
      setSelectedIds(subscribers.map((s: any) => s.id));
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données');
      console.error('Error fetching newsletter subscribers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNewsletter = async () => {
    if (!subject.trim() || !htmlContent.trim()) {
      alert('L\'objet et le contenu de l\'e-mail sont requis.');
      return;
    }

    if (selectedIds.length === 0) {
      alert('Veuillez sélectionner au moins un abonné.');
      return;
    }

    // Get the actual emails for the selected IDs
    const targetEmails = data
      .filter(s => selectedIds.includes(s.id))
      .map(s => s.email);

    try {
      setSending(true);

      const { error } = await supabase.functions.invoke('send-bulk-newsletter', {
        body: {
          subject,
          htmlContent,
          targetEmails,
          attachmentUrl: attachmentUrl || null,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erreur lors de l\'envoi');
      }

      // Enregistrer la newsletter envoyée dans l'historique
      const { error: dbError } = await supabase
        .from('sent_newsletters')
        .insert([{ subject, recipients_count: targetEmails.length }]);

      if (dbError) {
        console.error("Erreur d'enregistrement de l'historique:", dbError);
      }

      setSuccessCount(targetEmails.length);
      setShowSuccessModal(true);
      setIsComposerOpen(false);
      setSubject('');
      setHtmlContent('');
      setAttachmentUrl('');
    } catch (err: any) {
      console.error('Newsletter send error:', err);
      alert('Erreur: ' + (err.message || 'Impossible d\'envoyer la newsletter.'));
    } finally {
      setSending(false);
    }
  };

  const columns = [
    { key: 'email', label: 'Email' },
    {
      key: 'created_at',
      label: 'Date d\'inscription',
      render: (value: string) => value ? new Date(value).toLocaleDateString('fr-FR') : '-',
    },
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Abonnés Newsletter</h1>
          <p className="text-sm text-gray-500">{selectedIds.length} sélectionné(s) sur {data.length}</p>
        </div>
        <button
          onClick={() => setIsComposerOpen(true)}
          disabled={selectedIds.length === 0}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Mail size={18} />
          Nouvelle communication
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
        selectable={true}
        selectedRowIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onDelete={canDelete('newsletter') ? async (row: NewsletterSubscriber) => {
          if (window.confirm('Supprimer cet abonné ?')) {
            const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', row.id);
            if (error) alert(error.message);
            else fetchData();
          }
        } : undefined}
        title="Liste des abonnés"
        isLoading={loading}
      />

      <Modal
        isOpen={isComposerOpen}
        onClose={() => {
          if (!sending) setIsComposerOpen(false);
        }}
        title="Rédiger une Newsletter"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800 font-medium">
              Destinataires : {selectedIds.length} abonné(s) sélectionné(s). Les abonnés recevront cet email en copie cachée (BCC).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objet de l'e-mail *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="Ex: Nouveautés et Actualités de l'ONG DDB"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenu *</label>
            <RichTextEditor
              value={htmlContent}
              onChange={setHtmlContent}
              rows={8}
            />
          </div>

          <div>
            <FileUpload
              label="Pièce jointe (Optionnel)"
              value={attachmentUrl}
              onChange={setAttachmentUrl}
              folder="newsletters"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              maxSizeMB={5}
            />
            <p className="text-xs text-gray-500 mt-1">Le lien vers ce document sera inséré automatiquement à la fin de l'email.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setIsComposerOpen(false)}
              disabled={sending}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSendNewsletter}
              disabled={sending || !subject.trim() || !htmlContent.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold disabled:opacity-50"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Envoyer
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title=""
        size="md"
      >
        <div className="flex flex-col items-center justify-center p-4 sm:p-6 text-center">
          <CheckCircle className="text-green-500 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Envoi réussi !</h2>
          <p className="text-gray-600 mb-6">
            La newsletter a bien été envoyée à <span className="font-bold text-green-700">{successCount}</span> abonné(s).
          </p>
          <button
            onClick={() => setShowSuccessModal(false)}
            className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition w-full sm:w-auto"
          >
            Fermer
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default NewsletterAdmin;

