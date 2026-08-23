import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import DataTable from '../../../components/admin/DataTable';
import Modal from '../../../components/admin/Modal';
import { ShieldAlert, ShieldCheck, RefreshCw, AlertTriangle, Eye } from 'lucide-react';

interface SecurityEvent {
  id: number;
  category: 'admin_activity' | 'suspicious_access';
  severity: 'info' | 'warning' | 'critical';
  action: string;
  actor_email?: string | null;
  actor_role?: string | null;
  target?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-gray-100 text-gray-700',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
};

const ACTION_LABELS: Record<string, string> = {
  delete_event: "Suppression d'un événement",
  delete_registration: "Suppression d'une inscription",
  delete_volunteer: "Suppression d'un volontaire",
  edit_registration_resend_ticket: 'Modification + renvoi de billet',
  send_bulk_email: 'Envoi de mail groupé',
  edge_function_denied: 'Appel de fonction refusé',
};

const FUNCTION_LABELS: Record<string, string> = {
  'send-event-email': "l'envoi d'email aux volontaires/participants",
  'send-bulk-newsletter': "l'envoi de la newsletter",
  'send-interview-invite': "l'envoi d'une invitation à un entretien",
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'un administrateur',
  charge_communication: 'un chargé de communication',
  chef_projet: 'un chef de projet',
  partenaire: 'un partenaire',
  membre: 'un membre',
};

/** Extrait l'id numérique d'une cible du type "table:123" */
const extractId = (target?: string | null) => target?.split(':').pop();

/**
 * Traduit un événement technique en phrase claire, compréhensible sans
 * connaissances techniques. C'est le texte affiché dans le détail de chaque ligne.
 */
const describeEvent = (e: SecurityEvent): string => {
  const who = e.actor_email
    ? `${e.actor_email}${e.actor_role ? ` (${ROLE_LABELS[e.actor_role] || e.actor_role})` : ''}`
    : 'Une personne non identifiée (sans compte connecté)';
  const when = new Date(e.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  const d = e.details || {};

  switch (e.action) {
    case 'delete_event':
      return `${who} a supprimé l'événement « ${d.title || extractId(e.target)} » ainsi que toutes les inscriptions et données liées à cet événement, le ${when}.`;

    case 'delete_registration':
      return `${who} a supprimé l'inscription n°${extractId(e.target)} d'un participant à un événement, le ${when}. Cette action est irréversible : les informations de ce participant ne sont plus dans la base.`;

    case 'delete_volunteer':
      return `${who} a supprimé le volontaire n°${extractId(e.target)} d'un événement, le ${when}.`;

    case 'edit_registration_resend_ticket':
      return `${who} a corrigé les informations d'une inscription (n°${extractId(e.target)}) et a renvoyé un nouveau billet par email${d.newEmail ? ` à l'adresse ${d.newEmail}` : ''}, le ${when}.`;

    case 'send_bulk_email': {
      const group = e.target?.split(':')[2] === 'volunteers' ? 'aux volontaires' : 'aux participants';
      return `${who} a envoyé un email groupé ${group} d'un événement${d.subject ? ` avec pour sujet « ${d.subject} »` : ''}, à ${d.recipientsCount ?? '?'} destinataire${(d.recipientsCount ?? 0) > 1 ? 's' : ''}, le ${when}.`;
    }

    case 'edge_function_denied': {
      const fn = FUNCTION_LABELS[e.target || ''] || `la fonction "${e.target}"`;
      return `Une tentative d'utiliser ${fn} a été bloquée automatiquement le ${when}, car ${
        e.actor_email
          ? `le compte ${e.actor_email} n'a pas le droit d'effectuer cette action (${d.reason || 'accès refusé'}).`
          : `aucune connexion valide n'a été présentée (${d.reason || 'accès refusé'}). Cela ressemble à quelqu'un qui a essayé d'utiliser directement les coulisses du site sans être connecté — le système l'en a empêché.`
      }`;
    }

    default:
      return `${who} a effectué l'action "${e.action}"${e.target ? ` sur ${e.target}` : ''}, le ${when}.`;
  }
};

const SecurityAdmin: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'suspicious_access' | 'admin_activity'>('all');
  const [viewingEvent, setViewingEvent] = useState<SecurityEvent | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (e) setError(e.message);
    else setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const filtered = useMemo(
    () => filter === 'all' ? events : events.filter(e => e.category === filter),
    [events, filter],
  );

  const suspiciousCount24h = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return events.filter(e => e.category === 'suspicious_access' && new Date(e.created_at).getTime() > dayAgo).length;
  }, [events]);

  const columns = [
    {
      key: 'created_at', label: 'Date',
      render: (v: string) => new Date(v).toLocaleString('fr-FR'),
    },
    {
      key: 'category', label: 'Type',
      render: (v: string) => v === 'suspicious_access' ? (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
          <ShieldAlert size={13} /> Suspect
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500">
          <ShieldCheck size={13} /> Activité admin
        </span>
      ),
    },
    {
      key: 'severity', label: 'Sévérité',
      render: (v: string) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${SEVERITY_STYLES[v] || SEVERITY_STYLES.info}`}>
          {v}
        </span>
      ),
    },
    {
      key: 'action', label: 'Action',
      render: (v: string) => ACTION_LABELS[v] || v,
    },
    {
      key: 'actor_email', label: 'Acteur', hiddenOnMobile: true,
      render: (v: string, row: SecurityEvent) => v || (row.category === 'suspicious_access' ? 'Non identifié' : '—'),
    },
    {
      key: 'detail', label: '',
      render: (_v: any, row: SecurityEvent) => (
        <button
          onClick={() => setViewingEvent(row)}
          title="Voir le détail en clair"
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
        >
          <Eye size={13} /> Détail
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert className="text-green-700" size={24} /> Sécurité
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Journal des actions admin sensibles et des tentatives d'accès refusées aux fonctions serveur.
            Clique sur « Détail » pour lire une explication en clair de chaque ligne.
          </p>
        </div>
        <button onClick={fetchEvents} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      {suspiciousCount24h > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <p className="text-sm font-semibold">
            {suspiciousCount24h} tentative{suspiciousCount24h > 1 ? 's' : ''} d'accès suspecte{suspiciousCount24h > 1 ? 's' : ''} détectée{suspiciousCount24h > 1 ? 's' : ''} dans les dernières 24h.
          </p>
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {[
          { key: 'all', label: 'Tout' },
          { key: 'suspicious_access', label: 'Tentatives suspectes' },
          { key: 'admin_activity', label: 'Activité admin' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              filter === f.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

      <DataTable
        columns={columns}
        data={filtered}
        title="Journal de sécurité"
        isLoading={loading}
        itemsPerPage={15}
      />

      {viewingEvent && (
        <Modal
          isOpen={!!viewingEvent}
          onClose={() => setViewingEvent(null)}
          title="Que s'est-il passé ?"
          size="md"
        >
          <div className="p-2 space-y-4">
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${
              viewingEvent.category === 'suspicious_access' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'
            }`}>
              {viewingEvent.category === 'suspicious_access'
                ? <ShieldAlert className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                : <ShieldCheck className="text-gray-500 flex-shrink-0 mt-0.5" size={20} />}
              <p className="text-sm text-gray-800 leading-relaxed">{describeEvent(viewingEvent)}</p>
            </div>

            {viewingEvent.category === 'suspicious_access' && (
              <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg p-3">
                Cette tentative a été automatiquement refusée par le système — aucune donnée n'a été consultée
                ni modifiée, et aucun email n'a été envoyé. Rien à faire de plus, sauf si ce type de tentative
                se répète souvent, auquel cas il faudra envisager d'autres mesures.
              </p>
            )}

            <div className="text-xs text-gray-400 border-t border-gray-100 pt-3 space-y-1">
              <p>Référence interne : #{viewingEvent.id}</p>
              {viewingEvent.ip_address && <p>Adresse d'origine : {viewingEvent.ip_address}</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SecurityAdmin;
