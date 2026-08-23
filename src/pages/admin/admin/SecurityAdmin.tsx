import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import DataTable from '../../../components/admin/DataTable';
import { ShieldAlert, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';

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

const SecurityAdmin: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'suspicious_access' | 'admin_activity'>('all');

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
      render: (v: string, row: SecurityEvent) => v ? `${v}${row.actor_role ? ` (${row.actor_role})` : ''}` : '—',
    },
    { key: 'target', label: 'Cible', hiddenOnMobile: true, render: (v: string) => v || '—' },
    {
      key: 'details', label: 'Détails', hiddenOnMobile: true,
      render: (v: any) => v ? <span className="text-xs text-gray-500 font-mono">{JSON.stringify(v)}</span> : '—',
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
    </div>
  );
};

export default SecurityAdmin;
