import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import RichTextEditor from './RichTextEditor';
import { supabase } from '../../supabaseClient';
import { logAdminActivity } from '../../utils/securityLog';

interface EventEmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: number;
  eventTitle: string;
  eventLogoUrl?: string | null;
  targetGroup: 'volunteers' | 'participants';
  recipients: { email?: string }[];
  onSent?: (count: number) => void;
}

const EventEmailComposerModal: React.FC<EventEmailComposerModalProps> = ({
  isOpen, onClose, eventId, eventTitle, eventLogoUrl, targetGroup, recipients, onSent,
}) => {
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ count: number; simulated: boolean } | null>(null);

  const targetLabel = targetGroup === 'volunteers' ? 'volontaires' : 'participants';

  const validEmails = Array.from(new Set(
    recipients.map(r => r.email?.trim().toLowerCase()).filter((e): e is string => !!e && e.includes('@'))
  ));

  const handleClose = () => {
    setSubject('');
    setHtmlContent('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  const handleSend = async () => {
    if (!subject.trim() || !htmlContent.trim()) {
      setError('Le sujet et le message sont obligatoires.');
      return;
    }
    if (validEmails.length === 0) {
      setError('Aucun email valide dans la sélection.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('send-event-email', {
        body: {
          eventId,
          eventTitle,
          eventLogoUrl: eventLogoUrl || null,
          targetGroup,
          subject: subject.trim(),
          htmlContent,
          recipientEmails: validEmails,
        },
      });
      if (fnError) {
        // Le client Supabase n'expose pas le corps de la réponse par défaut :
        // on va chercher le vrai message d'erreur renvoyé par la fonction.
        let detail = fnError.message;
        try {
          const body = await fnError.context?.json();
          if (body?.error) detail = body.error;
        } catch { /* corps illisible, on garde le message par défaut */ }
        throw new Error(detail);
      }

      // Historique (best-effort, ne bloque pas le succès si ça échoue)
      supabase.from('sent_event_emails').insert([{
        event_id: eventId,
        target_group: targetGroup,
        subject: subject.trim(),
        recipients_count: validEmails.length,
      }]).then(() => {}).catch(() => {});

      logAdminActivity('send_bulk_email', `events:${eventId}:${targetGroup}`, {
        subject: subject.trim(),
        recipientsCount: validEmails.length,
      });

      setSuccess({ count: validEmails.length, simulated: !!data?.simulated });
      onSent?.(validEmails.length);
    } catch (err: any) {
      console.error('Erreur envoi email événement:', err);
      setError(err.message || "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Envoyer un email aux ${targetLabel}`} size="lg">
      <div className="p-1 space-y-4">
        {success ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="text-green-600" size={28} />
            </div>
            <p className="font-bold text-gray-800 mb-1">Email envoyé !</p>
            <p className="text-sm text-gray-500 mb-1">
              Envoyé à {success.count} {targetLabel}.
            </p>
            {success.simulated && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg py-2 px-3 inline-block mt-2">
                Mode simulation : identifiants Gmail non configurés, aucun email réel n'a été envoyé.
              </p>
            )}
            <div className="mt-5">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">{error}</div>
            )}

            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-100">
              Destinataires sélectionnés : <strong className="text-gray-700">{validEmails.length}</strong> {targetLabel} avec email valide.
              Le logo et le nom de l'événement seront automatiquement ajoutés en en-tête du mail.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Sujet</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                placeholder={`Ex: Informations importantes — ${eventTitle}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Message</label>
              <RichTextEditor
                value={htmlContent}
                onChange={setHtmlContent}
                placeholder="Rédigez votre message..."
                rows={8}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={sending}
                className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || validEmails.length === 0}
                className="px-5 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                Envoyer à {validEmails.length} {targetLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default EventEmailComposerModal;
