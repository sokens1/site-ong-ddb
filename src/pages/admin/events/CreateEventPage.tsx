import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import * as XLSX from 'xlsx';
import {
  ArrowLeft, Users, Trash2, Star, Eye, Search, Pencil, Send, CheckCircle2, Download, Loader2,
  BarChart2, FileSpreadsheet, HardHat, Upload, Mail, Edit3, Award, Ticket, Sparkles, ClipboardList,
  MessageSquare, Calendar, MapPin,
} from 'lucide-react';
import EventStatsTab from './EventStatsTab';
import { motion } from 'framer-motion';
import { supabase } from '../../../supabaseClient';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';
import Modal from '../../../components/admin/Modal';
import EventEmailComposerModal from '../../../components/admin/EventEmailComposerModal';
import EventWizardModal from '../../../components/admin/EventWizardModal';
import { generateTicketPDF, TicketTemplate } from '../../../utils/ticketPdf';
import { generateCertificatePDF, CertificateTemplate } from '../../../utils/certificatePdf';
import { logAdminActivity } from '../../../utils/securityLog';
import { FormField } from '../../../components/admin/FieldBuilder';
import { EVENT_TYPES } from '../../../utils/eventHelpers';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface FeedbackConfig {
  show_stars: boolean;
  fields: FormField[];
}

interface ProgramItem {
  id: string;
  time?: string;
  title: string;
  speaker?: string;
  description?: string;
}

interface Event {
  id: number;
  title: string;
  theme?: string;
  description: string;
  event_date: string;
  location: string;
  image_url: string;
  max_slots: number | null;
  price?: number | null;
  status: 'draft' | 'published' | 'cancelled';
  form_fields?: FormField[];
  feedback_config?: FeedbackConfig;
  created_at?: string;
  event_dates?: { date: string; label?: string }[];
  logo_url?: string;
  organizer_logos?: string[];
  partner_logos?: string[];
  slug?: string;
  poster_enabled?: boolean;
  event_type?: string;
  program?: ProgramItem[];
  ticket_tiers?: { id: string; label: string; price: number | null; description?: string }[];
  ticket_template?: TicketTemplate;
  invitation_text?: string;
  invitation_subtext?: string;
  certificate_enabled?: boolean;
  certificate_template?: CertificateTemplate;
  poster_template?: string;
}

const VISITOR_EMAIL = 'visiteur@ong-ddb.org';

interface Registration {
  id: number;
  event_id: number;
  fullname: string;
  email: string;
  phone?: string;
  ticket_ref?: string;
  created_at?: string;
  custom_data?: Record<string, any>;
  scanned_at?: string;
  certificate_sent_at?: string;
}

interface Volunteer {
  id: number;
  event_id: number;
  fullname: string;
  email?: string;
  phone?: string;
  created_at?: string;
}

interface EventFeedback {
  id: number;
  participant_name: string;
  rating: number;
  comment: string;
  custom_answers?: Record<string, any>;
  created_at: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const CreateEventPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { data: eventsData, refresh: refreshEvents } = useCrud<Event>({ tableName: 'events' });
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState<'info' | 'participants' | 'volunteers' | 'feedbacks' | 'stats' | 'certificates'>('info');
  const [infoWizardOpen, setInfoWizardOpen] = useState(false);

  const getCurrentDateTime = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState<Partial<Event>>({
    title: '', description: '', event_date: getCurrentDateTime(),
    location: '', image_url: '', max_slots: null, price: 0,
    status: 'published', form_fields: [],
    feedback_config: { show_stars: true, fields: [] },
    event_dates: [], logo_url: '',
    organizer_logos: [], partner_logos: [],
    poster_enabled: true,
  });

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState<EventFeedback[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [participantSearch, setParticipantSearch] = useState('');
  const itemsPerPage = 10;

  // ── Certificats : envoi automatique aux participants scannés ──────────────
  const [certSendingIds, setCertSendingIds] = useState<Set<number>>(new Set());
  const [certAutoSending, setCertAutoSending] = useState(false);
  const certAutoSendDone = React.useRef(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'success';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [viewingParticipant, setViewingParticipant] = useState<Registration | null>(null);

  // ── Téléchargement direct du billet (sans renvoi email) ───────────────────
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownloadTicket = async (reg: Registration) => {
    setDownloadingId(reg.id);
    try {
      const doc = await generateTicketPDF(
        reg.fullname,
        formData.title || '',
        formData.event_date || '',
        formData.location,
        formData.organizer_logos,
        formData.event_dates,
        formData.ticket_template || 'classic',
        formData.invitation_text,
        formData.invitation_subtext,
      );
      const cleanTitle = (formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_');
      const cleanName = (reg.fullname || 'participant').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Billet_${cleanTitle}_${cleanName}.pdf`);
    } catch (err) {
      console.error('Erreur téléchargement billet:', err);
      alert('Erreur lors de la génération du billet.');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Certificats : génération + envoi par email ─────────────────────────────
  const sendCertificateToRegistration = async (reg: Registration): Promise<boolean> => {
    if (!reg.email || reg.email === VISITOR_EMAIL) return false;
    setCertSendingIds(prev => new Set(prev).add(reg.id));
    try {
      const doc = await generateCertificatePDF(
        reg.fullname,
        formData.title || '',
        formData.event_date || '',
        formData.certificate_template || 'classic',
        formData.logo_url,
      );
      const pdfBase64 = doc.output('datauristring').split('base64,')[1];
      const cleanTitle = (formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_');

      const { error: fnError } = await supabase.functions.invoke('send-event-certificate', {
        body: {
          email: reg.email,
          fullname: reg.fullname,
          eventTitle: formData.title,
          pdfBase64,
          pdfName: `Certificat_${cleanTitle}.pdf`,
        },
      });
      if (fnError) throw fnError;

      const sentAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('event_registrations')
        .update({ certificate_sent_at: sentAt })
        .eq('id', reg.id);
      if (updateError) throw updateError;

      setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, certificate_sent_at: sentAt } : r));
      logAdminActivity('send_certificate', `event_registrations:${reg.id}`, { email: reg.email });
      return true;
    } catch (err) {
      console.error(`Erreur envoi certificat à ${reg.email}:`, err);
      return false;
    } finally {
      setCertSendingIds(prev => { const s = new Set(prev); s.delete(reg.id); return s; });
    }
  };

  const autoSendPendingCertificates = async (regs: Registration[]) => {
    const pending = regs.filter(r => r.scanned_at && !r.certificate_sent_at && r.email && r.email !== VISITOR_EMAIL);
    if (pending.length === 0) return;
    setCertAutoSending(true);
    for (const reg of pending) {
      await sendCertificateToRegistration(reg);
    }
    setCertAutoSending(false);
  };

  // ── Édition d'inscription + renvoi du billet ──────────────────────────────
  const [editingParticipant, setEditingParticipant] = useState<Registration | null>(null);
  const [editForm, setEditForm] = useState<{ fullname: string; email: string; phone: string; custom: Record<string, string> }>({
    fullname: '', email: '', phone: '', custom: {},
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  const openEditParticipant = (reg: Registration) => {
    const custom: Record<string, string> = {};
    Object.entries(reg.custom_data || {}).forEach(([key, val]) => {
      custom[key] = Array.isArray(val) ? val.join(', ') : String(val ?? '');
    });
    setEditForm({ fullname: reg.fullname || '', email: reg.email || '', phone: reg.phone || '', custom });
    setEditError(null);
    setEditSuccess(false);
    setEditingParticipant(reg);
  };

  const handleSaveAndResend = async () => {
    if (!editingParticipant) return;
    if (!editForm.fullname.trim() || !editForm.email.trim()) {
      setEditError('Le nom et l\'email sont obligatoires.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      // Reconstruit custom_data en respectant le format d'origine (array vs string)
      const originalCustom = editingParticipant.custom_data || {};
      const newCustom: Record<string, any> = { ...originalCustom };
      Object.entries(editForm.custom).forEach(([key, val]) => {
        newCustom[key] = Array.isArray(originalCustom[key])
          ? val.split(',').map(v => v.trim()).filter(Boolean)
          : val;
      });

      const { error: updateError } = await supabase
        .from('event_registrations')
        .update({
          fullname: editForm.fullname.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim() || null,
          custom_data: newCustom,
        })
        .eq('id', editingParticipant.id);
      if (updateError) throw updateError;

      // Régénère le billet PDF avec les infos corrigées
      const doc = await generateTicketPDF(
        editForm.fullname.trim(),
        formData.title || '',
        formData.event_date || '',
        formData.location,
        formData.organizer_logos,
        formData.event_dates,
        formData.ticket_template || 'classic',
        formData.invitation_text,
        formData.invitation_subtext,
      );
      const pdfBase64 = doc.output('datauristring').split('base64,')[1];
      const cleanTitle = (formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_');

      const { error: fnError } = await supabase.functions.invoke('send-event-confirmation', {
        body: {
          email: editForm.email.trim(),
          fullname: editForm.fullname.trim(),
          eventTitle: formData.title,
          eventDate: formData.event_date,
          eventLocation: formData.location,
          pdfBase64,
          pdfName: `Billet_${cleanTitle}.pdf`,
        },
      });
      if (fnError) throw fnError;

      setRegistrations(prev => prev.map(r => r.id === editingParticipant.id
        ? { ...r, fullname: editForm.fullname.trim(), email: editForm.email.trim(), phone: editForm.phone.trim() || undefined, custom_data: newCustom }
        : r));
      logAdminActivity('edit_registration_resend_ticket', `event_registrations:${editingParticipant.id}`, {
        newEmail: editForm.email.trim(),
      });
      setEditSuccess(true);
    } catch (err: any) {
      console.error('Erreur mise à jour inscription:', err);
      setEditError(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Volontaires ────────────────────────────────────────────────────────────
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [volunteersLoading, setVolunteersLoading] = useState(false);
  const [volunteerSearch, setVolunteerSearch] = useState('');
  const [volunteerPage, setVolunteerPage] = useState(1);
  const volunteersPerPage = 10;

  const [addingVolunteer, setAddingVolunteer] = useState(false);
  const [newVolunteer, setNewVolunteer] = useState({ fullname: '', email: '', phone: '' });
  const [savingVolunteer, setSavingVolunteer] = useState(false);
  const [volunteerFormError, setVolunteerFormError] = useState<string | null>(null);

  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [editVolunteerForm, setEditVolunteerForm] = useState({ fullname: '', email: '', phone: '' });

  const [importPreview, setImportPreview] = useState<{ fullname: string; email: string; phone: string }[] | null>(null);
  const [importing, setImporting] = useState(false);
  const volunteerFileInputRef = React.useRef<HTMLInputElement>(null);

  // Sélection multi (volontaires & participants) pour l'envoi de mail groupé
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<Set<number>>(new Set());
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<number>>(new Set());
  const [emailComposer, setEmailComposer] = useState<{ targetGroup: 'volunteers' | 'participants'; recipients: { email?: string }[] } | null>(null);
  const [volunteersError, setVolunteersError] = useState<string | null>(null);

  const fetchVolunteers = async (eventId: number) => {
    setVolunteersLoading(true);
    setVolunteersError(null);
    const { data, error } = await supabase.from('event_volunteers').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    if (error) {
      console.error('Erreur chargement volontaires:', error);
      setVolunteersError(error.message || 'Erreur lors du chargement des volontaires.');
    } else if (data) { setVolunteers(data); setVolunteerPage(1); }
    setVolunteersLoading(false);
  };

  const handleAddVolunteer = async () => {
    if (!newVolunteer.fullname.trim()) { setVolunteerFormError('Le nom complet est obligatoire.'); return; }
    setSavingVolunteer(true);
    setVolunteerFormError(null);
    try {
      const { data, error } = await supabase.from('event_volunteers').insert([{
        event_id: parseInt(id!),
        fullname: newVolunteer.fullname.trim(),
        email: newVolunteer.email.trim() || null,
        phone: newVolunteer.phone.trim() || null,
      }]).select().single();
      if (error) throw error;
      setVolunteers(prev => [data, ...prev]);
      setNewVolunteer({ fullname: '', email: '', phone: '' });
      setAddingVolunteer(false);
    } catch (err: any) {
      setVolunteerFormError(err.message || "Erreur lors de l'ajout.");
    } finally {
      setSavingVolunteer(false);
    }
  };

  const openEditVolunteer = (vol: Volunteer) => {
    setEditVolunteerForm({ fullname: vol.fullname || '', email: vol.email || '', phone: vol.phone || '' });
    setEditingVolunteer(vol);
  };

  const handleSaveVolunteer = async () => {
    if (!editingVolunteer) return;
    if (!editVolunteerForm.fullname.trim()) { alert('Le nom complet est obligatoire.'); return; }
    try {
      const { error } = await supabase.from('event_volunteers').update({
        fullname: editVolunteerForm.fullname.trim(),
        email: editVolunteerForm.email.trim() || null,
        phone: editVolunteerForm.phone.trim() || null,
      }).eq('id', editingVolunteer.id);
      if (error) throw error;
      setVolunteers(prev => prev.map(v => v.id === editingVolunteer.id
        ? { ...v, fullname: editVolunteerForm.fullname.trim(), email: editVolunteerForm.email.trim(), phone: editVolunteerForm.phone.trim() }
        : v));
      setEditingVolunteer(null);
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleDeleteVolunteer = (volId: number) => {
    setConfirmModal({
      isOpen: true, title: 'Supprimer le volontaire', type: 'danger',
      message: 'Êtes-vous sûr de vouloir supprimer ce volontaire ?',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('event_volunteers').delete().eq('id', volId);
          if (error) throw error;
          logAdminActivity('delete_volunteer', `event_volunteers:${volId}`);
          setVolunteers(prev => prev.filter(v => v.id !== volId));
          setSelectedVolunteerIds(prev => { const s = new Set(prev); s.delete(volId); return s; });
        } catch (err: any) { alert(`Erreur: ${err.message}`); }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // ── Import Excel des volontaires ──────────────────────────────────────────
  const handleVolunteerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const findKey = (row: Record<string, any>, patterns: RegExp) =>
          Object.keys(row).find(k => patterns.test(k.toLowerCase()));

        const parsed = rows.map(row => {
          const nameKey = findKey(row, /nom|name/);
          const emailKey = findKey(row, /email|mail/);
          const phoneKey = findKey(row, /numero|numéro|tel|téléphone|phone/);
          return {
            fullname: nameKey ? String(row[nameKey]).trim() : '',
            email: emailKey ? String(row[emailKey]).trim() : '',
            phone: phoneKey ? String(row[phoneKey]).trim() : '',
          };
        }).filter(r => r.fullname);

        if (parsed.length === 0) {
          alert("Aucune ligne exploitable trouvée. Vérifiez que le fichier contient une colonne 'Nom complet'.");
          return;
        }
        setImportPreview(parsed);
      } catch (err) {
        console.error('Erreur lecture fichier Excel:', err);
        alert('Erreur lors de la lecture du fichier. Vérifiez le format (.xlsx / .xls).');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmImportVolunteers = async () => {
    if (!importPreview || !id) return;
    setImporting(true);
    try {
      const rows = importPreview.map(r => ({
        event_id: parseInt(id),
        fullname: r.fullname,
        email: r.email || null,
        phone: r.phone || null,
      }));
      const { data, error } = await supabase.from('event_volunteers').insert(rows).select();
      if (error) throw error;
      setVolunteers(prev => [...(data || []), ...prev]);
      setImportPreview(null);
    } catch (err: any) {
      alert(`Erreur lors de l'import: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    if (isEditing && id && eventsData) {
      const eventItem = eventsData.find((item) => item.id === parseInt(id));
      if (eventItem) {
        let dateValue = getCurrentDateTime();
        if (eventItem.event_date) {
          try {
            const d = new Date(eventItem.event_date);
            if (!isNaN(d.getTime())) {
              dateValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
          } catch {}
        }
        setFormData({
          ...eventItem,
          event_date: dateValue,
          feedback_config: eventItem.feedback_config ?? { show_stars: true, fields: [] },
          event_dates: eventItem.event_dates || [],
          logo_url: eventItem.logo_url || '',
          organizer_logos: Array.isArray(eventItem.organizer_logos) ? eventItem.organizer_logos : [],
          partner_logos: Array.isArray(eventItem.partner_logos) ? eventItem.partner_logos : [],
          poster_enabled: eventItem.poster_enabled !== false,
        });
        fetchRegistrations(parseInt(id));
        fetchFeedbacks(parseInt(id));
        fetchVolunteers(parseInt(id));
      }
    }
  }, [id, isEditing, eventsData]);

  // Envoi automatique des certificats aux participants scannés qui n'en ont pas encore reçu,
  // dès l'ouverture de l'onglet "Certificats" (idempotent grâce à certificate_sent_at).
  useEffect(() => {
    if (activeTab !== 'certificates') { certAutoSendDone.current = false; return; }
    if (!formData.certificate_enabled) return;
    if (certAutoSendDone.current || registrationsLoading) return;
    const pending = registrations.filter(r => r.scanned_at && !r.certificate_sent_at && r.email && r.email !== VISITOR_EMAIL);
    if (pending.length === 0) return;
    certAutoSendDone.current = true;
    autoSendPendingCertificates(registrations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, formData.certificate_enabled, registrations, registrationsLoading]);

  const fetchFeedbacks = async (eventId: number) => {
    setFeedbacksLoading(true);
    const { data, error } = await supabase.from('event_feedbacks').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    if (!error && data) setFeedbacks(data);
    setFeedbacksLoading(false);
  };

  const fetchRegistrations = async (eventId: number) => {
    setRegistrationsLoading(true);
    const { data, error } = await supabase.from('event_registrations').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    if (!error && data) { setRegistrations(data); setCurrentPage(1); }
    setRegistrationsLoading(false);
  };

  const handleBack = () => navigate('/espace-ddb/events');

  const handleDeleteRegistration = (regId: number) => {
    setConfirmModal({
      isOpen: true, title: "Supprimer l'inscription", type: 'danger',
      message: 'Êtes-vous sûr de vouloir supprimer cette inscription définitivement ?',
      onConfirm: async () => {
        try {
          const { data, error } = await supabase
            .from('event_registrations')
            .delete()
            .eq('id', regId)
            .select('id');
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error('Suppression bloquée par les permissions Supabase. Vérifiez la politique RLS DELETE sur event_registrations.');
          }
          logAdminActivity('delete_registration', `event_registrations:${regId}`);
          setRegistrations(prev => prev.filter(r => r.id !== regId));
        } catch (err: any) { alert(`Erreur: ${err.message}`); }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const exportXLSX = () => {
    const customFields = formData.form_fields || [];
    const headers = ['#', 'Nom', 'Email', 'Téléphone', 'Réf. billet', 'Date inscription', ...customFields.map((f: any) => f.label)];
    const rows = registrations.map((reg: any, idx: number) => [
      idx + 1, reg.fullname || '', reg.email || '', reg.phone || '', reg.ticket_ref || '',
      reg.created_at ? new Date(reg.created_at).toLocaleString('fr-FR') : '',
      ...customFields.map((f: any) => {
        const val = reg.custom_data?.[f.id];
        return Array.isArray(val) ? val.join(', ') : String(val ?? '');
      }),
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Largeurs colonnes
    ws['!cols'] = headers.map((_: any, i: number) => ({ wch: i === 0 ? 5 : i <= 2 ? 28 : 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');
    XLSX.writeFile(wb, `participants_${(formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const scannedRegistrations = registrations.filter(r => !!r.scanned_at);

  const tabs = [
    { key: 'info', label: 'Informations', icon: ClipboardList, sub: 'Résumé & configuration' },
    { key: 'participants', label: 'Participants', icon: Users, sub: 'Inscrits', badge: registrations.length || null },
    { key: 'certificates', label: 'Certificats', icon: Award, sub: 'Envoi aux scannés', badge: scannedRegistrations.length || null },
    { key: 'volunteers', label: 'Volontaires', icon: HardHat, sub: 'Bénévoles', badge: volunteers.length || null },
    { key: 'stats', label: 'Statistiques', icon: BarChart2, sub: 'KPIs & graphes' },
    { key: 'feedbacks', label: 'Avis reçus', icon: MessageSquare, sub: 'Retours', badge: feedbacks.length || null },
  ] as const;

  const filteredRegs = participantSearch.trim()
    ? registrations.filter(r => {
        const q = participantSearch.toLowerCase();
        const inCustom = r.custom_data
          ? Object.values(r.custom_data).some(v => typeof v === 'string' && v.toLowerCase().includes(q))
          : false;
        return (
          r.fullname?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          inCustom
        );
      })
    : registrations;
  const paginatedRegs = filteredRegs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredRegs.length / itemsPerPage);

  const filteredVols = volunteerSearch.trim()
    ? volunteers.filter(v => {
        const q = volunteerSearch.toLowerCase();
        return v.fullname?.toLowerCase().includes(q) || v.email?.toLowerCase().includes(q) || v.phone?.toLowerCase().includes(q);
      })
    : volunteers;
  const paginatedVols = filteredVols.slice((volunteerPage - 1) * volunteersPerPage, volunteerPage * volunteersPerPage);
  const totalVolPages = Math.ceil(filteredVols.length / volunteersPerPage);

  const toggleParticipantSelection = (regId: number) => {
    setSelectedParticipantIds(prev => {
      const s = new Set(prev);
      if (s.has(regId)) s.delete(regId); else s.add(regId);
      return s;
    });
  };
  const toggleVolunteerSelection = (volId: number) => {
    setSelectedVolunteerIds(prev => {
      const s = new Set(prev);
      if (s.has(volId)) s.delete(volId); else s.add(volId);
      return s;
    });
  };

  // ── Création : la page se limite à ouvrir le wizard, en plein écran ──────
  if (!isEditing) {
    return (
      <EventWizardModal
        isOpen
        onClose={handleBack}
        onSaved={() => navigate('/espace-ddb/events')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="bg-white shadow-sm sticky top-0 z-10 w-full border-b border-gray-200 px-4 sm:px-8 h-14 flex items-center justify-between flex-shrink-0">
        <button onClick={handleBack} className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors">
          <ArrowLeft size={18} /> Retour
        </button>
        <div className="text-gray-800 font-bold hidden sm:block truncate max-w-[50%]">{formData.title || "Gérer l'événement"}</div>
        <button onClick={() => setInfoWizardOpen(true)}
          className="px-5 py-2 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm">
          <Edit3 size={16} /> Modifier
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
        <div className="flex overflow-x-auto scrollbar-hide px-3 sm:px-6 gap-1.5 py-2.5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-green-600 text-white shadow-md shadow-green-200'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {'badge' in tab && tab.badge ? (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-green-100 text-green-800'}`}>
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 w-full">

        {/* ── Info Tab : résumé + accès au wizard ── */}
        {activeTab === 'info' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 sm:px-10 py-8 space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4 min-w-0">
                {formData.image_url ? (
                  <img src={formData.image_url} alt="" className="w-20 h-20 rounded-2xl object-cover border border-gray-100 shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Calendar size={24} className="text-gray-300" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {EVENT_TYPES.find(t => t.value === formData.event_type)?.label || 'Conférence'}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                      formData.status === 'published' ? 'bg-emerald-100 text-emerald-700' : formData.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {formData.status === 'published' ? 'Publié' : formData.status === 'cancelled' ? 'Annulé' : 'Brouillon'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 leading-snug">{formData.title || 'Sans titre'}</h2>
                  <div className="flex items-center gap-4 flex-wrap mt-1.5 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-green-500" />
                      {formData.event_date ? new Date(formData.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    </span>
                    {formData.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-green-500" />
                        {formData.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoWizardOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm text-sm flex-shrink-0"
              >
                <Edit3 size={16} /> Modifier les informations
              </button>
            </div>

            {formData.description && (
              <div className="prose prose-sm max-w-none text-gray-600 bg-gray-50 rounded-xl p-4 border border-gray-100 line-clamp-4"
                dangerouslySetInnerHTML={{ __html: formData.description }} />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <ClipboardList size={15} className="text-green-600" />
                  <p className="text-xs font-bold text-gray-700">Questionnaires</p>
                </div>
                <p className="text-xs text-gray-500">{(formData.form_fields || []).length} question(s) d'inscription, {(formData.feedback_config?.fields || []).length} question(s) d'avis</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <Ticket size={15} className="text-green-600" />
                  <p className="text-xs font-bold text-gray-700">Billetterie</p>
                </div>
                <p className="text-xs text-gray-500">
                  {(formData.program || []).length} étape(s) au programme · {(formData.ticket_tiers || []).length} tarif(s) · modèle {formData.ticket_template === 'modern' ? 'moderne' : 'classique'}
                </p>
              </div>
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <Award size={15} className={formData.certificate_enabled ? 'text-green-600' : 'text-gray-300'} />
                  <p className="text-xs font-bold text-gray-700">Certificats</p>
                </div>
                <p className="text-xs text-gray-500">
                  {formData.certificate_enabled ? `Activés · modèle ${formData.certificate_template === 'modern' ? 'moderne' : 'classique'}` : 'Désactivés'}
                </p>
              </div>
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles size={15} className={formData.poster_enabled !== false ? 'text-green-600' : 'text-gray-300'} />
                  <p className="text-xs font-bold text-gray-700">Visuel "J'y serai"</p>
                </div>
                <p className="text-xs text-gray-500">
                  {formData.poster_enabled !== false ? `Activé · modèle ${formData.poster_template === 'modern' ? 'moderne' : 'classique'}` : 'Désactivé'}
                </p>
              </div>
            </div>

            {(formData.logo_url || (formData.organizer_logos || []).length > 0 || (formData.partner_logos || []).length > 0) && (
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-700 mb-3">Logos</p>
                <div className="flex flex-wrap gap-3">
                  {formData.logo_url && (
                    <div className="w-14 h-14 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center">
                      <img src={formData.logo_url} alt="" className="max-w-full max-h-full object-contain p-1" />
                    </div>
                  )}
                  {[...(formData.organizer_logos || []), ...(formData.partner_logos || [])].map((url, idx) => (
                    <div key={idx} className="w-14 h-14 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center">
                      <img src={url} alt="" className="max-w-full max-h-full object-contain p-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Participants Tab ── */}
        {activeTab === 'participants' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Participants inscrits</h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  <span className="font-bold text-green-600">{registrations.length}</span> inscription{registrations.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Recherche */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Rechercher…"
                    value={participantSearch}
                    onChange={e => { setParticipantSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 w-44"
                  />
                </div>
                {selectedParticipantIds.size > 0 && (
                  <button
                    onClick={() => setEmailComposer({
                      targetGroup: 'participants',
                      recipients: registrations.filter(r => selectedParticipantIds.has(r.id) && r.email && r.email !== VISITOR_EMAIL),
                    })}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Mail size={15} /> Envoyer un email ({selectedParticipantIds.size})
                  </button>
                )}
                {registrations.length > 0 && (
                  <button onClick={exportXLSX}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-100 transition-colors border border-green-200">
                    <FileSpreadsheet size={15} /> Exporter XLSX
                  </button>
                )}
                <button onClick={() => fetchRegistrations(parseInt(id!))}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  Rafraîchir
                </button>
              </div>
            </div>

            {registrationsLoading ? (
              <div className="text-center py-16">
                <span className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin inline-block" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-16 mx-6 sm:mx-10 my-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Users size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">Aucune inscription pour le moment.</p>
                <p className="text-sm text-gray-400 mt-1">Les inscrits via le site public apparaîtront ici.</p>
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-5 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={paginatedRegs.length > 0 && paginatedRegs.every(r => selectedParticipantIds.has(r.id))}
                            onChange={e => {
                              setSelectedParticipantIds(prev => {
                                const s = new Set(prev);
                                paginatedRegs.forEach(r => e.target.checked ? s.add(r.id) : s.delete(r.id));
                                return s;
                              });
                            }}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Participant</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedRegs.map((reg) => {
                        const hasCustomData = reg.custom_data && Object.keys(reg.custom_data).length > 0;
                        return (
                          <tr key={reg.id} className="hover:bg-green-50/30 transition-colors group">
                            <td className="px-5 py-4">
                              <input
                                type="checkbox"
                                checked={selectedParticipantIds.has(reg.id)}
                                onChange={() => toggleParticipantSelection(reg.id)}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-bold text-gray-900">{reg.fullname}</p>
                              {hasCustomData && (
                                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                  {Object.keys(reg.custom_data!).length} réponse{Object.keys(reg.custom_data!).length > 1 ? 's' : ''}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 hidden sm:table-cell">
                              <p className="text-gray-700">{reg.email}</p>
                              {reg.phone && <p className="text-gray-400 text-xs mt-0.5">{reg.phone}</p>}
                            </td>
                            <td className="px-4 py-4 hidden md:table-cell text-gray-400 text-xs whitespace-nowrap">
                              {reg.created_at ? new Date(reg.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setViewingParticipant(reg)}
                                  title="Voir les détails"
                                  className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => openEditParticipant(reg)}
                                  title="Modifier et renvoyer le billet"
                                  className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  onClick={() => handleDownloadTicket(reg)}
                                  disabled={downloadingId === reg.id}
                                  title="Télécharger le billet"
                                  className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {downloadingId === reg.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                </button>
                                <button
                                  onClick={() => handleDeleteRegistration(reg.id)}
                                  title="Supprimer"
                                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-6 sm:px-10 py-4 border-t border-gray-100">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Précédent
                    </button>
                    <span className="text-sm text-gray-500 font-medium">Page {currentPage} sur {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── Certificates Tab ── */}
        {activeTab === 'certificates' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-gray-100 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Certificats de participation</h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  <span className="font-bold text-green-600">{scannedRegistrations.length}</span> participant{scannedRegistrations.length !== 1 ? 's' : ''} scanné{scannedRegistrations.length !== 1 ? 's' : ''} à l'entrée
                </p>
              </div>
              {certAutoSending && (
                <div className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                  <Loader2 size={14} className="animate-spin" /> Envoi automatique des certificats en cours…
                </div>
              )}
            </div>

            {!formData.certificate_enabled ? (
              <div className="text-center py-16 mx-6 sm:mx-10 my-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Award size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">Les certificats ne sont pas activés pour cet événement.</p>
                <p className="text-sm text-gray-400 mt-1 mb-4">Activez-les depuis l'étape "Certificats" du wizard.</p>
                <button type="button" onClick={() => setInfoWizardOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm text-sm">
                  <Edit3 size={16} /> Activer les certificats
                </button>
              </div>
            ) : registrationsLoading ? (
              <div className="text-center py-16">
                <span className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin inline-block" />
              </div>
            ) : scannedRegistrations.length === 0 ? (
              <div className="text-center py-16 mx-6 sm:mx-10 my-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Award size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">Aucun participant scanné pour le moment.</p>
                <p className="text-sm text-gray-400 mt-1">Dès qu'un billet est scanné à l'entrée (onglet Scan), le participant apparaît ici et reçoit automatiquement son certificat.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Participant</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Scanné le</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Certificat</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {scannedRegistrations.map(reg => {
                      const isSending = certSendingIds.has(reg.id);
                      return (
                        <tr key={reg.id} className="hover:bg-green-50/30 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-bold text-gray-900">{reg.fullname}</p>
                            <p className="text-gray-500 text-xs">{reg.email}</p>
                          </td>
                          <td className="px-4 py-4 hidden sm:table-cell text-gray-500 text-xs whitespace-nowrap">
                            {reg.scanned_at ? new Date(reg.scanned_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-4">
                            {isSending ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                                <Loader2 size={12} className="animate-spin" /> Envoi…
                              </span>
                            ) : reg.certificate_sent_at ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full" title={new Date(reg.certificate_sent_at).toLocaleString('fr-FR')}>
                                <CheckCircle2 size={12} /> Envoyé le {new Date(reg.certificate_sent_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                                En attente
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => sendCertificateToRegistration(reg)}
                                disabled={isSending || !reg.email || reg.email === VISITOR_EMAIL}
                                title={reg.certificate_sent_at ? 'Renvoyer le certificat' : 'Envoyer le certificat'}
                                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Send size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Volunteers Tab ── */}
        {activeTab === 'volunteers' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-gray-100 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Volontaires</h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  <span className="font-bold text-green-600">{volunteers.length}</span> volontaire{volunteers.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Rechercher…"
                    value={volunteerSearch}
                    onChange={e => { setVolunteerSearch(e.target.value); setVolunteerPage(1); }}
                    className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 w-44"
                  />
                </div>
                {selectedVolunteerIds.size > 0 && (
                  <button
                    onClick={() => setEmailComposer({
                      targetGroup: 'volunteers',
                      recipients: volunteers.filter(v => selectedVolunteerIds.has(v.id) && v.email),
                    })}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Mail size={15} /> Envoyer un email ({selectedVolunteerIds.size})
                  </button>
                )}
                <button
                  onClick={() => volunteerFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-100 transition-colors border border-green-200"
                >
                  <Upload size={15} /> Importer Excel
                </button>
                <input
                  ref={volunteerFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleVolunteerFileSelect}
                />
                <button
                  onClick={() => setAddingVolunteer(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus size={15} /> Ajouter
                </button>
                <button onClick={() => fetchVolunteers(parseInt(id!))}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  Rafraîchir
                </button>
              </div>
            </div>

            {volunteersError && (
              <div className="mx-6 sm:mx-10 mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start justify-between gap-3">
                <span className="break-words">{volunteersError}</span>
                <button onClick={() => fetchVolunteers(parseInt(id!))} className="font-semibold underline underline-offset-2 flex-shrink-0">Réessayer</button>
              </div>
            )}

            {volunteersLoading ? (
              <div className="text-center py-16">
                <span className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin inline-block" />
              </div>
            ) : volunteers.length === 0 ? (
              <div className="text-center py-16 mx-6 sm:mx-10 my-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <HardHat size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">Aucun volontaire pour le moment.</p>
                <p className="text-sm text-gray-400 mt-1">Ajoutez-les manuellement ou importez un fichier Excel.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-5 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={paginatedVols.length > 0 && paginatedVols.every(v => selectedVolunteerIds.has(v.id))}
                            onChange={e => {
                              setSelectedVolunteerIds(prev => {
                                const s = new Set(prev);
                                paginatedVols.forEach(v => e.target.checked ? s.add(v.id) : s.delete(v.id));
                                return s;
                              });
                            }}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Volontaire</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Date ajout</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedVols.map(vol => (
                        <tr key={vol.id} className="hover:bg-green-50/30 transition-colors group">
                          <td className="px-5 py-4">
                            <input
                              type="checkbox"
                              checked={selectedVolunteerIds.has(vol.id)}
                              onChange={() => toggleVolunteerSelection(vol.id)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-bold text-gray-900">{vol.fullname}</p>
                          </td>
                          <td className="px-4 py-4 hidden sm:table-cell">
                            <p className="text-gray-700">{vol.email || '—'}</p>
                            {vol.phone && <p className="text-gray-400 text-xs mt-0.5">{vol.phone}</p>}
                          </td>
                          <td className="px-4 py-4 hidden md:table-cell text-gray-400 text-xs whitespace-nowrap">
                            {vol.created_at ? new Date(vol.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditVolunteer(vol)}
                                title="Modifier"
                                className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteVolunteer(vol.id)}
                                title="Supprimer"
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalVolPages > 1 && (
                  <div className="flex justify-between items-center px-6 sm:px-10 py-4 border-t border-gray-100">
                    <button onClick={() => setVolunteerPage(p => Math.max(1, p - 1))} disabled={volunteerPage === 1}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Précédent
                    </button>
                    <span className="text-sm text-gray-500 font-medium">Page {volunteerPage} sur {totalVolPages}</span>
                    <button onClick={() => setVolunteerPage(p => Math.min(totalVolPages, p + 1))} disabled={volunteerPage === totalVolPages}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── Stats Tab ── */}
        {activeTab === 'stats' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <EventStatsTab
              registrations={registrations}
              formFields={formData.form_fields || []}
              maxSlots={formData.max_slots}
              eventDate={formData.event_date}
            />
          </motion.div>
        )}

        {/* ── Feedbacks Tab ── */}
        {activeTab === 'feedbacks' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 sm:px-10 py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Avis reçus</h2>
                <p className="text-gray-500 text-sm mt-1">{feedbacks.length} avis enregistrés</p>
              </div>
              <button onClick={() => fetchFeedbacks(parseInt(id!))} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200">
                Rafraîchir
              </button>
            </div>
            {feedbacksLoading ? (
              <div className="text-center py-12"><span className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin inline-block" /></div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Star size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">Aucun avis pour le moment.</p>
                <p className="text-xs text-gray-400 mt-1">Les avis s'affichent une fois l'événement terminé.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map(fb => (
                  <div key={fb.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-green-100 hover:shadow-sm transition-all">
                    <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                      <p className="font-bold text-gray-900">{fb.participant_name || 'Anonyme'}</p>
                      {fb.rating > 0 && (
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={16} className={fb.rating >= s ? 'text-yellow-400' : 'text-gray-200'} fill={fb.rating >= s ? 'currentColor' : 'none'} />
                          ))}
                        </div>
                      )}
                    </div>
                    {fb.comment && <p className="text-gray-600 text-sm italic mb-2">"{fb.comment}"</p>}
                    {fb.custom_answers && Object.keys(fb.custom_answers).length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                        {Object.entries(fb.custom_answers).map(([key, val]) => (
                          <p key={key} className="text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">{key}:</span> {Array.isArray(val) ? val.join(', ') : String(val)}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">{new Date(fb.created_at).toLocaleDateString('fr-FR')} {new Date(fb.created_at).toLocaleTimeString('fr-FR')}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <EventWizardModal
        isOpen={infoWizardOpen}
        eventId={id ? parseInt(id) : undefined}
        onClose={() => setInfoWizardOpen(false)}
        onSaved={() => { setInfoWizardOpen(false); refreshEvents(); }}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      {/* Participant detail modal */}
      {viewingParticipant && (
        <Modal
          isOpen={!!viewingParticipant}
          onClose={() => setViewingParticipant(null)}
          title="Détails du participant"
          size="lg"
        >
          <div className="space-y-6">
            {/* En-tête récapitulatif */}
            <div className="flex items-center gap-4 p-4 bg-green-50/60 rounded-2xl border border-green-100">
              <div className="w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                {(viewingParticipant.fullname || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-base break-words">{viewingParticipant.fullname}</p>
                <p className="text-sm text-gray-500 break-words">{viewingParticipant.email}</p>
              </div>
            </div>

            {/* Informations de base */}
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Informations de base</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Téléphone', value: viewingParticipant.phone || '—' },
                  { label: 'Réf. billet', value: viewingParticipant.ticket_ref || '—' },
                  {
                    label: 'Date inscription',
                    value: viewingParticipant.created_at
                      ? new Date(viewingParticipant.created_at).toLocaleString('fr-FR')
                      : '—',
                  },
                  {
                    label: 'Statut',
                    value: viewingParticipant.scanned_at
                      ? `Scanné le ${new Date(viewingParticipant.scanned_at).toLocaleString('fr-FR')}`
                      : 'Pas encore scanné',
                  },
                ].map(row => (
                  <div key={row.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{row.label}</p>
                    <p className="text-sm text-gray-800 font-medium break-words whitespace-pre-wrap leading-snug">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Réponses au formulaire */}
            {viewingParticipant.custom_data && Object.keys(viewingParticipant.custom_data).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Réponses au formulaire</h4>
                <div className="space-y-2.5">
                  {(formData.form_fields || []).map(field => {
                    const val = viewingParticipant.custom_data?.[field.id];
                    if (val === undefined || val === null || val === '') return null;
                    return (
                      <div key={field.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{field.label}</p>
                        <p className="text-sm text-gray-800 font-medium break-words whitespace-pre-wrap leading-relaxed">
                          {Array.isArray(val) ? val.join(', ') : String(val)}
                        </p>
                      </div>
                    );
                  })}
                  {/* Extra fields not in form_fields (e.g. phone) */}
                  {Object.entries(viewingParticipant.custom_data).filter(([key]) =>
                    !(formData.form_fields || []).find(f => f.id === key) && key !== 'phone'
                  ).map(([key, val]) => (
                    <div key={key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{key}</p>
                      <p className="text-sm text-gray-800 font-medium break-words whitespace-pre-wrap leading-relaxed">
                        {Array.isArray(val) ? val.join(', ') : String(val)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit participant + resend ticket modal */}
      {editingParticipant && (
        <Modal
          isOpen={!!editingParticipant}
          onClose={() => setEditingParticipant(null)}
          title={`Modifier — ${editingParticipant.fullname}`}
          size="lg"
        >
          <div className="p-1 space-y-5">
            {editSuccess ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="text-green-600" size={28} />
                </div>
                <p className="font-bold text-gray-800 mb-1">Billet corrigé renvoyé !</p>
                <p className="text-sm text-gray-500 mb-5">
                  Les informations ont été mises à jour et le nouveau billet a été envoyé à {editForm.email}.
                </p>
                <button
                  onClick={() => setEditingParticipant(null)}
                  className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                {editError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">{editError}</div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Informations de base</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Nom complet</label>
                      <input
                        type="text"
                        value={editForm.fullname}
                        onChange={e => setEditForm(f => ({ ...f, fullname: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Téléphone</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {Object.keys(editForm.custom).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Réponses au formulaire</h4>
                    <div className="space-y-3">
                      {Object.entries(editForm.custom).map(([key, val]) => {
                        const field = (formData.form_fields || []).find(f => f.id === key);
                        return (
                          <div key={key}>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{field?.label || key}</label>
                            <input
                              type="text"
                              value={val}
                              onChange={e => setEditForm(f => ({ ...f, custom: { ...f.custom, [key]: e.target.value } }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
                  L'enregistrement régénère le billet PDF avec les infos corrigées et le renvoie automatiquement par email au participant.
                </p>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingParticipant(null)}
                    disabled={savingEdit}
                    className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndResend}
                    disabled={savingEdit}
                    className="px-5 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm"
                  >
                    {savingEdit ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    Enregistrer et renvoyer le billet
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Add volunteer modal */}
      {addingVolunteer && (
        <Modal
          isOpen={addingVolunteer}
          onClose={() => { setAddingVolunteer(false); setVolunteerFormError(null); setNewVolunteer({ fullname: '', email: '', phone: '' }); }}
          title="Ajouter un volontaire"
          size="sm"
        >
          <div className="p-1 space-y-4">
            {volunteerFormError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">{volunteerFormError}</div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nom complet *</label>
              <input type="text" value={newVolunteer.fullname}
                onChange={e => setNewVolunteer(v => ({ ...v, fullname: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
              <input type="email" value={newVolunteer.email}
                onChange={e => setNewVolunteer(v => ({ ...v, email: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Numéro</label>
              <input type="text" value={newVolunteer.phone}
                onChange={e => setNewVolunteer(v => ({ ...v, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setAddingVolunteer(false); setVolunteerFormError(null); setNewVolunteer({ fullname: '', email: '', phone: '' }); }}
                disabled={savingVolunteer}
                className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAddVolunteer}
                disabled={savingVolunteer}
                className="px-5 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {savingVolunteer && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Ajouter
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit volunteer modal */}
      {editingVolunteer && (
        <Modal
          isOpen={!!editingVolunteer}
          onClose={() => setEditingVolunteer(null)}
          title={`Modifier — ${editingVolunteer.fullname}`}
          size="sm"
        >
          <div className="p-1 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nom complet *</label>
              <input type="text" value={editVolunteerForm.fullname}
                onChange={e => setEditVolunteerForm(v => ({ ...v, fullname: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
              <input type="email" value={editVolunteerForm.email}
                onChange={e => setEditVolunteerForm(v => ({ ...v, email: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Numéro</label>
              <input type="text" value={editVolunteerForm.phone}
                onChange={e => setEditVolunteerForm(v => ({ ...v, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingVolunteer(null)}
                className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveVolunteer}
                className="px-5 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md text-sm"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Excel preview modal */}
      {importPreview && (
        <Modal
          isOpen={!!importPreview}
          onClose={() => setImportPreview(null)}
          title={`Importer ${importPreview.length} volontaire${importPreview.length > 1 ? 's' : ''}`}
          size="lg"
        >
          <div className="p-1 space-y-4">
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-100">
              Vérifiez l'aperçu avant de confirmer l'import. Colonnes reconnues : Nom complet, Email, Numéro.
            </p>
            <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-xl">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 uppercase">Nom</th>
                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 uppercase">Email</th>
                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 uppercase">Numéro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {importPreview.map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium text-gray-800">{row.fullname}</td>
                      <td className="px-4 py-2 text-gray-600">{row.email || '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{row.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setImportPreview(null)}
                disabled={importing}
                className="px-5 py-2.5 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmImportVolunteers}
                disabled={importing}
                className="px-5 py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {importing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirmer l'import
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Email composer (volontaires / participants) */}
      {emailComposer && (
        <EventEmailComposerModal
          isOpen={!!emailComposer}
          onClose={() => setEmailComposer(null)}
          eventId={parseInt(id!)}
          eventTitle={formData.title || ''}
          eventLogoUrl={formData.logo_url}
          targetGroup={emailComposer.targetGroup}
          recipients={emailComposer.recipients}
          onSent={() => {
            if (emailComposer.targetGroup === 'volunteers') setSelectedVolunteerIds(new Set());
            else setSelectedParticipantIds(new Set());
          }}
        />
      )}
    </div>
  );
};

export default CreateEventPage;
