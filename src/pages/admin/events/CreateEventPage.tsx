import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrud } from '../../../hooks/useCrud';
import * as XLSX from 'xlsx';
import {
  ArrowLeft, Users, Trash2, Star, Eye, Search, Pencil, Send, CheckCircle2, Download, Loader2,
  BarChart2, FileSpreadsheet, HardHat, Upload, Mail, Edit3, Award, Ticket, Sparkles, ClipboardList,
  MessageSquare, Calendar, MapPin, Clock, Smartphone, CreditCard, Plus, ChevronDown, ChevronUp, Layers, AlertCircle,
  Lock, Unlock, MoreVertical,
} from 'lucide-react';
import EventStatsTab from './EventStatsTab';
import { EventPostersTab } from '../../../components/admin/EventPostersTab';
import { motion } from 'framer-motion';
import { supabase } from '../../../supabaseClient';
import ConfirmationModal from '../../../components/admin/ConfirmationModal';
import Modal from '../../../components/admin/Modal';
import EventEmailComposerModal from '../../../components/admin/EventEmailComposerModal';
import EventWizardModal, { StepKey } from '../../../components/admin/EventWizardModal';
import { generateTicketPDF, generateGroupTicketsPDF, TicketTemplate } from '../../../utils/ticketPdf';
import { generateCertificatePDF, CertificateTemplate } from '../../../utils/certificatePdf';
import { logAdminActivity } from '../../../utils/securityLog';
import { FormField } from '../../../components/admin/FieldBuilder';
import { EVENT_TYPES } from '../../../utils/eventHelpers';
import { toDatetimeLocalString, getCurrentDatetimeLocal } from '../../../utils/dateUtils';

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
  registrations_open?: boolean;
  registration_deadline?: string | null;
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
  certificate_title?: string;
  certificate_subtitle?: string;
  certificate_text?: string;
  certificate_signatory_name?: string;
  certificate_signatory_title?: string;
  certificate_signatory_signature?: string;
  certificate_signatory2_name?: string;
  certificate_signatory2_title?: string;
  certificate_signatory2_signature?: string;
  certificate_participant_quality?: string;
  certificate_scheduled_at?: string | null;
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

interface BookingOrder {
  groupKey: string;
  isGroup: boolean;
  isPaid: boolean;
  paymentStatus: 'pending' | 'paid' | 'free';
  orderRef?: string;
  buyerEmail: string;
  payerPhone?: string;
  paymentOperator?: 'airtel' | 'moov';
  totalAmount?: number;
  placesCount: number;
  createdAt: string;
  items: Registration[];
  primaryRegistration: Registration;
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

  const [activeTab, setActiveTab] = useState<'info' | 'participants' | 'volunteers' | 'feedbacks' | 'stats' | 'certificates' | 'posters'>('info');
  const [infoWizardOpen, setInfoWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState<StepKey>('info');

  const openWizardAt = (step: StepKey = 'info') => {
    setWizardInitialStep(step);
    setInfoWizardOpen(true);
  };

  const [formData, setFormData] = useState<Partial<Event>>({
    title: '', description: '', event_date: getCurrentDatetimeLocal(),
    location: '', image_url: '', max_slots: null, price: 0,
    status: 'published', form_fields: [],
    feedback_config: { show_stars: true, fields: [] },
    event_dates: [], logo_url: '',
    organizer_logos: [], partner_logos: [],
    poster_enabled: true,
    program: [],
    ticket_tiers: [],
  });

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState<EventFeedback[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [participantSearch, setParticipantSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'paid' | 'free'>('all');
  const [validatingPaymentId, setValidatingPaymentId] = useState<number | null>(null);
  const itemsPerPage = 10;

  // ── Certificats : envoi manuel ou programmé aux participants scannés ──────
  const [certSendingIds, setCertSendingIds] = useState<Set<number>>(new Set());
  const [certAutoSending, setCertAutoSending] = useState(false);
  const [certBatchProgress, setCertBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [certSchedulePickerOpen, setCertSchedulePickerOpen] = useState(false);
  const [certScheduleInput, setCertScheduleInput] = useState('');
  const [certScheduledAt, setCertScheduledAt] = useState<string | null>(null);
  const [savingCertSchedule, setSavingCertSchedule] = useState(false);
  const certScheduleTriggeredRef = React.useRef(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'success';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [viewingParticipant, setViewingParticipant] = useState<Registration | null>(null);
  const [viewingOrder, setViewingOrder] = useState<BookingOrder | null>(null);
  const [expandedOrderKeys, setExpandedOrderKeys] = useState<Set<string>>(new Set());
  const [validatingOrderKey, setValidatingOrderKey] = useState<string | null>(null);
  const [downloadingOrderKey, setDownloadingOrderKey] = useState<string | null>(null);
  const [openActionMenuKey, setOpenActionMenuKey] = useState<string | null>(null);

  // Modale de confirmation de validation (remplace window.alert)
  const [validationModal, setValidationModal] = useState<{
    isOpen: boolean;
    orderRef?: string;
    recipientEmail: string;
    placesCount: number;
    participantNames: string[];
  } | null>(null);
  const [errorMessageModal, setErrorMessageModal] = useState<string | null>(null);

  const toggleOrderExpand = (key: string) => {
    setExpandedOrderKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
        undefined,
        formData.logo_url,
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

  // ── Téléchargement de tous les billets d'une commande groupée ─────────────
  const handleDownloadOrderTickets = async (order: BookingOrder) => {
    setDownloadingOrderKey(order.groupKey);
    try {
      const cleanTitle = (formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_');
      const names = order.items.map(r => r.fullname || 'Participant');
      const doc = await generateGroupTicketsPDF(
        names,
        formData.title || '',
        formData.event_date || '',
        formData.location,
        formData.organizer_logos,
        formData.event_dates,
        formData.ticket_template || 'classic',
        formData.invitation_text,
        formData.invitation_subtext,
        formData.logo_url,
      );
      doc.save(`Billets_${order.placesCount}_places_${cleanTitle}.pdf`);
    } catch (err) {
      console.error('Erreur téléchargement billets commande:', err);
      setErrorMessageModal('Erreur lors du téléchargement des billets.');
    } finally {
      setDownloadingOrderKey(null);
    }
  };

  // ── Validation d'une commande complète & Envoi de tous les billets en 1 seul email ────────
  const handleValidateOrder = async (order: BookingOrder) => {
    setValidatingOrderKey(order.groupKey);
    try {
      const recipientEmail = order.buyerEmail;
      if (!recipientEmail || recipientEmail === VISITOR_EMAIL) {
        throw new Error("Adresse email de l'acheteur introuvable.");
      }

      const cleanTitle = (formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_');
      const participantNames = order.items.map(r => r.fullname || 'Participant');

      // 1. Générer le document unique regroupant tous les billets (1 page par participant)
      const groupDoc = await generateGroupTicketsPDF(
        participantNames,
        formData.title || '',
        formData.event_date || '',
        formData.location,
        formData.organizer_logos,
        formData.event_dates,
        formData.ticket_template || 'classic',
        formData.invitation_text,
        formData.invitation_subtext,
        formData.logo_url,
      );
      const bundlePdfBase64 = groupDoc.output('datauristring').split('base64,')[1];
      const bundlePdfName = `Billets_${order.placesCount}_places_${cleanTitle}.pdf`;

      // 2. Envoyer UN SEUL email synthétisé avec l'ensemble des billets
      const { error: sendErr } = await supabase.functions.invoke('send-event-confirmation', {
        body: {
          email: recipientEmail,
          fullname: order.primaryRegistration.fullname,
          eventTitle: formData.title,
          eventDate: formData.event_date,
          eventLocation: formData.location,
          pdfBase64: bundlePdfBase64, // Nécessaire pour la compatibilité avec l'Edge Function distante
          pdfName: bundlePdfName,
          attachments: [{ base64: bundlePdfBase64, name: bundlePdfName }],
          participantNames,
        },
      });
      if (sendErr) {
        let msg = sendErr.message || String(sendErr);
        if ((sendErr as any)?.context) {
          try {
            const errBody = await (sendErr as any).context.json();
            if (errBody?.error) msg = errBody.error;
          } catch { /* silent */ }
        }
        throw new Error(msg);
      }

      // 3. Mettre à jour toutes les inscriptions de cette commande en base de données
      const nowIso = new Date().toISOString();
      const updatedIds = order.items.map(r => r.id);

      for (const reg of order.items) {
        const newCustom = {
          ...(reg.custom_data || {}),
          payment_status: 'paid',
          validated_at: nowIso,
        };
        await supabase
          .from('event_registrations')
          .update({ custom_data: newCustom })
          .eq('id', reg.id);
      }

      // 4. Mettre à jour l'état local registrations
      setRegistrations(prev => prev.map(r => {
        if (updatedIds.includes(r.id)) {
          return {
            ...r,
            custom_data: {
              ...(r.custom_data || {}),
              payment_status: 'paid',
              validated_at: nowIso,
            },
          };
        }
        return r;
      }));

      // 5. Mettre à jour la modale de détails si ouverte
      if (viewingOrder && viewingOrder.groupKey === order.groupKey) {
        setViewingOrder({
          ...viewingOrder,
          paymentStatus: 'paid',
          items: viewingOrder.items.map(it => ({
            ...it,
            custom_data: { ...(it.custom_data || {}), payment_status: 'paid', validated_at: nowIso }
          }))
        });
      }

      logAdminActivity('validate_paid_order', `event_orders:${order.orderRef || order.buyerEmail}`, {
        buyerEmail: recipientEmail,
        count: order.placesCount,
      });

      // Modale de confirmation in-app (remplace window.alert)
      setValidationModal({
        isOpen: true,
        orderRef: order.orderRef,
        recipientEmail,
        placesCount: order.placesCount,
        participantNames: order.items.map(r => r.fullname),
      });
    } catch (err: any) {
      console.error('Erreur validation commande:', err);
      setErrorMessageModal(err.message || String(err));
    } finally {
      setValidatingOrderKey(null);
    }
  };

  // ── Suppression d'une commande (ou d'une inscription) ─────────────────────
  const handleDeleteOrder = (order: BookingOrder) => {
    const isMultiple = order.placesCount > 1;
    setConfirmModal({
      isOpen: true,
      title: isMultiple ? `Supprimer la commande (${order.placesCount} places)` : "Supprimer l'inscription",
      type: 'danger',
      message: isMultiple
        ? `Êtes-vous sûr de vouloir supprimer cette commande de ${order.placesCount} places pour ${order.buyerEmail} ? Toutes les inscriptions associées seront supprimées.`
        : 'Êtes-vous sûr de vouloir supprimer cette inscription ?',
      onConfirm: async () => {
        try {
          const idsToDelete = order.items.map(r => r.id);
          for (const regId of idsToDelete) {
            await supabase.from('event_registrations').delete().eq('id', regId);
          }
          setRegistrations(prev => prev.filter(r => !idsToDelete.includes(r.id)));
          if (viewingOrder && viewingOrder.groupKey === order.groupKey) {
            setViewingOrder(null);
          }
        } catch (err: any) {
          alert(`Erreur : ${err.message}`);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // ── Validation back-office du paiement & Envoi du billet officiel ──────────
  const handleValidatePaymentAndSendTicket = async (reg: Registration) => {
    setValidatingPaymentId(reg.id);
    try {
      // 1. Générer le billet PDF officiel
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
        undefined,
        formData.logo_url,
      );
      const pdfBase64 = doc.output('datauristring').split('base64,')[1];
      const cleanTitle = (formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_');
      const cleanName = (reg.fullname || 'participant').replace(/[^a-zA-Z0-9]/g, '_');

      // 2. Destinataire : buyer_email (prioritaire pour le payeur) ou reg.email
      const recipientEmail = reg.custom_data?.buyer_email || reg.email;
      if (!recipientEmail || recipientEmail === VISITOR_EMAIL) {
        throw new Error("Aucune adresse email valide trouvée pour envoyer le billet.");
      }

      // 3. Envoyer l'email avec le billet PDF en pièce jointe
      const { error: fnError } = await supabase.functions.invoke('send-event-confirmation', {
        body: {
          email: recipientEmail,
          fullname: reg.fullname,
          eventTitle: formData.title,
          eventDate: formData.event_date,
          eventLocation: formData.location,
          pdfBase64,
          pdfName: `Billet_${cleanName}_${cleanTitle}.pdf`,
        },
      });
      if (fnError) throw fnError;

      // 4. Mettre à jour l'inscription : payment_status = 'paid', validated_at
      const nowIso = new Date().toISOString();
      const newCustom = {
        ...(reg.custom_data || {}),
        payment_status: 'paid',
        validated_at: nowIso,
      };

      const { error: updateError } = await supabase
        .from('event_registrations')
        .update({ custom_data: newCustom })
        .eq('id', reg.id);
      if (updateError) throw updateError;

      // 5. Mettre à jour les états locaux
      setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, custom_data: newCustom } : r));
      if (viewingParticipant && viewingParticipant.id === reg.id) {
        setViewingParticipant({ ...viewingParticipant, custom_data: newCustom });
      }

      logAdminActivity('validate_paid_registration', `event_registrations:${reg.id}`, {
        buyerEmail: recipientEmail,
        participant: reg.fullname,
      });

      setValidationModal({
        isOpen: true,
        orderRef: reg.custom_data?.order_ref,
        recipientEmail,
        placesCount: 1,
        participantNames: [reg.fullname],
      });
    } catch (err: any) {
      console.error('Erreur validation paiement:', err);
      setErrorMessageModal(err.message || String(err));
    } finally {
      setValidatingPaymentId(null);
    }
  };

  // ── Certificats : génération + envoi par email ou téléchargement ──────────
  const getCertificateDoc = async (fullname: string) => {
    return generateCertificatePDF(
      fullname,
      formData.title || '',
      formData.event_date || '',
      formData.certificate_template || 'classic',
      formData.logo_url,
      formData.organizer_logos,
      {
        title: formData.certificate_title,
        subtitle: formData.certificate_subtitle,
        text: formData.certificate_text,
        signatoryName: formData.certificate_signatory_name,
        signatoryTitle: formData.certificate_signatory_title,
        signatorySignature: (formData as any).certificate_signatory_signature,
        signatory2Name: (formData as any).certificate_signatory2_name,
        signatory2Title: (formData as any).certificate_signatory2_title,
        signatory2Signature: (formData as any).certificate_signatory2_signature,
        participantQuality: (formData as any).certificate_participant_quality,
      },
    );
  };

  const downloadCertificateForRegistration = async (reg: Registration) => {
    try {
      const doc = await getCertificateDoc(reg.fullname);
      const cleanTitle = (formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_');
      const cleanName = (reg.fullname || 'participant').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Certificat_${cleanName}_${cleanTitle}.pdf`);
    } catch (err: any) {
      console.error('Erreur téléchargement certificat:', err);
    }
  };

  const getRegistrationRecipientEmail = (reg: Registration): string => {
    if (reg.email && reg.email !== VISITOR_EMAIL) return reg.email;
    if (reg.custom_data?.buyer_email && reg.custom_data.buyer_email !== VISITOR_EMAIL) {
      return reg.custom_data.buyer_email;
    }
    return '';
  };

  const sendCertificateToRegistration = async (
    reg: Registration,
    isManual = false,
    skipActivityLog = false,
  ): Promise<boolean> => {
    const recipientEmail = getRegistrationRecipientEmail(reg);
    if (!recipientEmail) {
      if (isManual) setErrorMessageModal('Aucune adresse e-mail valide associée à ce participant.');
      return false;
    }
    setCertSendingIds(prev => new Set(prev).add(reg.id));
    try {
      const doc = await getCertificateDoc(reg.fullname);
      const pdfBase64 = doc.output('datauristring').split('base64,')[1];
      const cleanTitle = (formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_');

      const { data: fnData, error: fnError } = await supabase.functions.invoke('send-event-certificate', {
        body: {
          email: recipientEmail,
          fullname: reg.fullname,
          eventTitle: formData.title,
          pdfBase64,
          pdfName: `Certificat_${cleanTitle}.pdf`,
        },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      const sentAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('event_registrations')
        .update({ certificate_sent_at: sentAt })
        .eq('id', reg.id);
      if (updateError) throw updateError;

      setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, certificate_sent_at: sentAt } : r));
      if (!skipActivityLog) {
        logAdminActivity('send_certificate', `event_registrations:${reg.id}`, { email: recipientEmail });
      }
      return true;
    } catch (err: any) {
      console.error(`Erreur envoi certificat à ${recipientEmail}:`, err);
      if (isManual) {
        setErrorMessageModal(`Erreur lors de l'envoi du certificat à ${recipientEmail} : ${err?.message || 'Erreur inconnue'}`);
      }
      return false;
    } finally {
      setCertSendingIds(prev => { const s = new Set(prev); s.delete(reg.id); return s; });
    }
  };

  const autoSendPendingCertificates = async (regs: Registration[]) => {
    const pending = regs.filter(r => r.scanned_at && !r.certificate_sent_at && !!getRegistrationRecipientEmail(r));
    if (pending.length === 0) return;

    setCertAutoSending(true);
    setCertBatchProgress({ done: 0, total: pending.length });

    const CONCURRENCY = 5;
    let completed = 0;
    let successCount = 0;

    // Préchauffe le cache d'images/logos sur le 1er certificat si plus d'un envoi
    // puis traite par lots parallèles de 5 pour accélérer fortement l'envoi
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (reg) => {
          const ok = await sendCertificateToRegistration(reg, false, true);
          completed += 1;
          if (ok) successCount += 1;
          setCertBatchProgress({ done: completed, total: pending.length });
          return ok;
        }),
      );
      void results;
    }

    if (successCount > 0) {
      logAdminActivity('send_certificates_batch', `events:${id}`, {
        sent: successCount,
        total: pending.length,
      });
    }

    setCertAutoSending(false);
    setCertBatchProgress(null);
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
    const isPaid = Boolean(reg.custom_data?.is_paid_booking);
    const buyerEmail = reg.custom_data?.buyer_email || reg.email || '';
    const custom: Record<string, string> = {};
    if (!isPaid) {
      Object.entries(reg.custom_data || {}).forEach(([key, val]) => {
        if ((formData.form_fields || []).some(f => f.id === key)) {
          custom[key] = Array.isArray(val) ? val.join(', ') : String(val ?? '');
        }
      });
    }
    setEditForm({
      fullname: reg.fullname || '',
      email: isPaid ? buyerEmail : (reg.email || ''),
      phone: reg.phone || '',
      custom,
    });
    setEditError(null);
    setEditSuccess(false);
    setEditingParticipant(reg);
  };

  const handleSaveAndResend = async () => {
    if (!editingParticipant) return;
    if (!editForm.fullname.trim()) {
      setEditError('Le nom du participant est obligatoire.');
      return;
    }
    const isPaid = Boolean(editingParticipant.custom_data?.is_paid_booking);
    const recipientEmail = (editingParticipant.custom_data?.buyer_email || editForm.email).trim();
    if (!recipientEmail) {
      setEditError('L\'adresse email est obligatoire.');
      return;
    }

    setSavingEdit(true);
    setEditError(null);
    try {
      // Reconstruit custom_data en respectant le format d'origine (array vs string)
      const originalCustom = editingParticipant.custom_data || {};
      const newCustom: Record<string, any> = { ...originalCustom };
      if (!isPaid) {
        Object.entries(editForm.custom).forEach(([key, val]) => {
          newCustom[key] = Array.isArray(originalCustom[key])
            ? val.split(',').map(v => v.trim()).filter(Boolean)
            : val;
        });
      }

      const { error: updateError } = await supabase
        .from('event_registrations')
        .update({
          fullname: editForm.fullname.trim(),
          email: editingParticipant.email, // Conserve l'email d'enregistrement en base
          phone: editForm.phone.trim() || null,
          custom_data: newCustom,
        })
        .eq('id', editingParticipant.id);
      if (updateError) throw updateError;

      // Régénère le billet PDF avec le nom corrigé
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
        undefined,
        formData.logo_url,
      );
      const pdfBase64 = doc.output('datauristring').split('base64,')[1];
      const cleanTitle = (formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_');

      const { error: fnError } = await supabase.functions.invoke('send-event-confirmation', {
        body: {
          email: recipientEmail,
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
        ? { ...r, fullname: editForm.fullname.trim(), custom_data: newCustom }
        : r));
      logAdminActivity('edit_registration_resend_ticket', `event_registrations:${editingParticipant.id}`, {
        newFullname: editForm.fullname.trim(),
        recipientEmail,
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
        const dateValue = eventItem.event_date ? toDatetimeLocalString(eventItem.event_date) : getCurrentDatetimeLocal();
        setFormData({
          ...eventItem,
          event_date: dateValue,
          feedback_config: eventItem.feedback_config ?? { show_stars: true, fields: [] },
          event_dates: (eventItem.event_dates || []).map((ed: any) => ({
            ...ed,
            date: toDatetimeLocalString(ed.date),
          })),
          logo_url: eventItem.logo_url || '',
          organizer_logos: Array.isArray(eventItem.organizer_logos) ? eventItem.organizer_logos : [],
          partner_logos: Array.isArray(eventItem.partner_logos) ? eventItem.partner_logos : [],
          poster_enabled: eventItem.poster_enabled !== false,
          program: Array.isArray(eventItem.program) ? eventItem.program : [],
          ticket_tiers: Array.isArray(eventItem.ticket_tiers) ? eventItem.ticket_tiers : [],
        });
        const localSched = localStorage.getItem(`cert_schedule_${eventItem.id}`);
        const schedIso = eventItem.certificate_scheduled_at || localSched || null;
        setCertScheduledAt(schedIso);
        if (schedIso) {
          setCertScheduleInput(toDatetimeLocalString(schedIso));
        }
        fetchRegistrations(parseInt(id));
        fetchFeedbacks(parseInt(id));
        fetchVolunteers(parseInt(id));
      }
    }
  }, [id, isEditing, eventsData]);

  // ── Ouverture / fermeture rapide des inscriptions ─────────────────────────
  const [togglingRegistrations, setTogglingRegistrations] = useState(false);
  const registrationDeadlinePassed = !!formData.registration_deadline
    && new Date(formData.registration_deadline).getTime() < Date.now();
  const registrationsClosed = formData.registrations_open === false || registrationDeadlinePassed;
  const isEventFull = formData.max_slots != null && registrations.length >= formData.max_slots;

  const toggleRegistrations = async () => {
    if (!id) return;
    const nextOpen = formData.registrations_open === false;
    setTogglingRegistrations(true);
    const { error } = await supabase.from('events').update({ registrations_open: nextOpen }).eq('id', parseInt(id));
    setTogglingRegistrations(false);
    if (error) {
      setErrorMessageModal(
        error.message?.includes('registrations_open')
          ? "La colonne 'registrations_open' n'existe pas encore : exécutez la migration 047_event_registration_closing.sql dans Supabase."
          : `Erreur : ${error.message}`
      );
      return;
    }
    setFormData(prev => ({ ...prev, registrations_open: nextOpen }));
    refreshEvents();
  };

  // ── Programmation de l'envoi des certificats ─────────────────────────────
  const handleSaveCertSchedule = async () => {
    if (!id || !certScheduleInput) return;
    const targetDate = new Date(certScheduleInput);
    if (isNaN(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
      setErrorMessageModal("Veuillez choisir une date et une heure futures pour programmer l'envoi.");
      return;
    }
    const iso = targetDate.toISOString();
    setSavingCertSchedule(true);
    certScheduleTriggeredRef.current = false;
    try {
      const { error } = await supabase
        .from('events')
        .update({ certificate_scheduled_at: iso })
        .eq('id', parseInt(id));
      if (error && !error.message?.includes('certificate_scheduled_at')) {
        throw error;
      }
      localStorage.setItem(`cert_schedule_${id}`, iso);
      setCertScheduledAt(iso);
      setFormData(prev => ({ ...prev, certificate_scheduled_at: iso }));
      setCertSchedulePickerOpen(false);
    } catch (err: any) {
      setErrorMessageModal(`Erreur lors de la programmation : ${err.message}`);
    } finally {
      setSavingCertSchedule(false);
    }
  };

  const handleCancelCertSchedule = async () => {
    if (!id) return;
    setSavingCertSchedule(true);
    try {
      await supabase
        .from('events')
        .update({ certificate_scheduled_at: null })
        .eq('id', parseInt(id));
      localStorage.removeItem(`cert_schedule_${id}`);
      setCertScheduledAt(null);
      setFormData(prev => ({ ...prev, certificate_scheduled_at: null }));
      certScheduleTriggeredRef.current = false;
    } finally {
      setSavingCertSchedule(false);
    }
  };

  // Déclenchement uniquement lorsque la date/heure programmée est atteinte
  useEffect(() => {
    if (!certScheduledAt || !formData.certificate_enabled || registrationsLoading) return;

    const checkAndTriggerScheduledSend = async () => {
      if (certScheduleTriggeredRef.current || certAutoSending) return;
      const targetMs = new Date(certScheduledAt).getTime();
      if (isNaN(targetMs) || Date.now() < targetMs) return;

      const pending = registrations.filter(
        r => r.scanned_at && !r.certificate_sent_at && !!getRegistrationRecipientEmail(r)
      );
      certScheduleTriggeredRef.current = true;
      if (pending.length > 0) {
        await autoSendPendingCertificates(registrations);
      }
      // Nettoie la programmation une fois exécutée
      if (id) {
        localStorage.removeItem(`cert_schedule_${id}`);
        await supabase.from('events').update({ certificate_scheduled_at: null }).eq('id', parseInt(id));
      }
      setCertScheduledAt(null);
      setFormData(prev => ({ ...prev, certificate_scheduled_at: null }));
    };

    checkAndTriggerScheduledSend();
    const timer = setInterval(checkAndTriggerScheduledSend, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certScheduledAt, formData.certificate_enabled, registrations, registrationsLoading, certAutoSending, id]);

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
    const headers = ['#', 'Réf. commande', 'Nom participant', 'Email', 'Téléphone', 'Réf. billet', 'Statut paiement', 'Montant', 'Opérateur', 'Date inscription', ...customFields.map((f: any) => f.label)];
    const rows = registrations.map((reg: any, idx: number) => {
      const isPaid = Boolean(reg.custom_data?.is_paid_booking);
      return [
        idx + 1,
        reg.custom_data?.order_ref || '',
        reg.fullname || '',
        isPaid ? (reg.custom_data?.buyer_email || reg.email || '') : (reg.email || ''),
        isPaid ? (reg.custom_data?.payer_phone || reg.phone || '') : (reg.phone || ''),
        reg.ticket_ref || '',
        isPaid
          ? (reg.custom_data?.payment_status === 'paid' ? 'Payé & Validé' : 'À valider')
          : 'Gratuit',
        reg.custom_data?.total_amount ? `${reg.custom_data.total_amount} XAF` : '',
        reg.custom_data?.payment_operator || '',
        reg.created_at ? new Date(reg.created_at).toLocaleString('fr-FR') : '',
        ...customFields.map((f: any) => {
          if (isPaid) return '';
          const val = reg.custom_data?.[f.id];
          return Array.isArray(val) ? val.join(', ') : String(val ?? '');
        }),
      ];
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((_: any, i: number) => ({ wch: i === 0 ? 5 : i <= 3 ? 24 : 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');
    XLSX.writeFile(wb, `participants_${(formData.title || 'evenement').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const scannedRegistrations = registrations.filter(r => !!r.scanned_at);

  const tabs = [
    { key: 'info', label: 'Informations', icon: ClipboardList, sub: 'Résumé & configuration' },
    { key: 'participants', label: 'Participants', icon: Users, sub: 'Inscrits', badge: registrations.length || null },
    { key: 'posters', label: "Affiches J'y serai", icon: Sparkles, sub: 'Visuels générés' },
    { key: 'certificates', label: 'Certificats', icon: Award, sub: 'Envoi aux scannés', badge: scannedRegistrations.length || null },
    { key: 'volunteers', label: 'Volontaires', icon: HardHat, sub: 'Bénévoles', badge: volunteers.length || null },
    { key: 'stats', label: 'Statistiques', icon: BarChart2, sub: 'KPIs & graphes' },
    { key: 'feedbacks', label: 'Avis reçus', icon: MessageSquare, sub: 'Retours', badge: feedbacks.length || null },
  ] as const;

  // ── Regroupement des réservations par commande (multi-places ou unitaire) ──
  const bookingOrders: BookingOrder[] = React.useMemo(() => {
    const groupsMap = new Map<string, Registration[]>();

    for (const reg of registrations) {
      const orderRef = reg.custom_data?.order_ref;
      const isPaid = Boolean(reg.custom_data?.is_paid_booking);

      let key: string;
      if (orderRef) {
        key = `order_${orderRef}`;
      } else if (isPaid) {
        // Fallback pour les commandes payées sans order_ref explicite : regrouper par email de l'acheteur + date (à la minute)
        const buyer = reg.custom_data?.buyer_email || reg.email;
        const timeKey = (reg.created_at || '').substring(0, 16);
        key = `paid_${buyer}_${timeKey}`;
      } else {
        // Inscriptions gratuites : individuelles
        key = `free_${reg.id}`;
      }

      const existing = groupsMap.get(key) || [];
      existing.push(reg);
      groupsMap.set(key, existing);
    }

    const orders: BookingOrder[] = [];
    for (const [key, items] of groupsMap.entries()) {
      const primary = items[0];
      const isPaid = Boolean(items.some(r => r.custom_data?.is_paid_booking));
      const orderRef = primary.custom_data?.order_ref;
      const buyerEmail = primary.custom_data?.buyer_email || primary.email;
      const payerPhone = primary.custom_data?.payer_phone || primary.phone;
      const paymentOperator = primary.custom_data?.payment_operator;
      const totalAmount = primary.custom_data?.total_amount;
      const placesCount = items.length;
      const isGroup = items.length > 1;

      let paymentStatus: 'pending' | 'paid' | 'free' = 'free';
      if (isPaid) {
        const allPaid = items.every(r => r.custom_data?.payment_status === 'paid');
        paymentStatus = allPaid ? 'paid' : 'pending';
      }

      orders.push({
        groupKey: key,
        isGroup,
        isPaid,
        paymentStatus,
        orderRef,
        buyerEmail,
        payerPhone,
        paymentOperator,
        totalAmount,
        placesCount,
        createdAt: primary.created_at || '',
        items,
        primaryRegistration: primary,
      });
    }

    return orders;
  }, [registrations]);

  const pendingPaymentsCount = bookingOrders.filter(o => o.isPaid && o.paymentStatus === 'pending').length;
  const paidPaymentsCount = bookingOrders.filter(o => o.isPaid && o.paymentStatus === 'paid').length;
  const freeRegistrationsCount = bookingOrders.filter(o => !o.isPaid).length;

  const filteredOrders = bookingOrders.filter(order => {
    // 1. Filtre par statut paiement
    if (paymentFilter === 'pending') {
      if (!order.isPaid || order.paymentStatus === 'paid') return false;
    } else if (paymentFilter === 'paid') {
      if (!order.isPaid || order.paymentStatus !== 'paid') return false;
    } else if (paymentFilter === 'free') {
      if (order.isPaid) return false;
    }

    // 2. Filtre par recherche texte
    if (participantSearch.trim()) {
      const q = participantSearch.toLowerCase();
      if (order.buyerEmail?.toLowerCase().includes(q)) return true;
      if (order.payerPhone?.toLowerCase().includes(q)) return true;
      if (order.orderRef?.toLowerCase().includes(q)) return true;

      return order.items.some(r => {
        const inCustom = r.custom_data
          ? Object.values(r.custom_data).some(v => typeof v === 'string' && v.toLowerCase().includes(q))
          : false;
        return (
          r.fullname?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          r.ticket_ref?.toLowerCase().includes(q) ||
          inCustom
        );
      });
    }
    return true;
  });

  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

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
    <div className="min-h-screen bg-white flex flex-col max-w-full overflow-x-hidden">
      {/* Top bar */}
      <div className="bg-white shadow-sm sticky top-0 z-20 w-full border-b border-gray-200 px-3 sm:px-8 h-13 sm:h-14 flex items-center justify-between gap-2 flex-shrink-0">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-green-600 hover:text-green-700 font-semibold text-xs sm:text-sm transition-colors flex-shrink-0">
          <ArrowLeft size={17} /> <span>Retour</span>
        </button>
        <div className="text-gray-800 font-bold text-xs sm:text-base truncate flex-1 text-center px-2">{formData.title || "Gérer l'événement"}</div>
        <button onClick={() => openWizardAt('info')}
          className="px-3 sm:px-5 py-1.5 sm:py-2 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs sm:text-sm flex-shrink-0">
          <Edit3 size={14} /> <span>Modifier</span>
        </button>
      </div>

      {/* Tab Navigation : grille enveloppante sur mobile (zéro scroll horizontal caché) */}
      <div className="bg-white border-b border-gray-200 sticky top-13 sm:top-14 z-10">
        <div className="flex flex-wrap sm:flex-nowrap sm:overflow-x-auto scrollbar-hide px-2.5 sm:px-6 gap-1 sm:gap-1.5 py-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-green-600 text-white shadow-sm sm:shadow-md shadow-green-200'
                    : 'bg-gray-50 sm:bg-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {'badge' in tab && tab.badge ? (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-green-100 text-green-800'}`}>
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-4 sm:px-10 py-5 sm:py-8 space-y-5 sm:space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                {formData.image_url ? (
                  <img src={formData.image_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-gray-100 shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Calendar size={22} className="text-gray-300" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {EVENT_TYPES.find(t => t.value === formData.event_type)?.label || 'Conférence'}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                      formData.status === 'published' ? 'bg-emerald-100 text-emerald-700' : formData.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {formData.status === 'published' ? 'Publié' : formData.status === 'cancelled' ? 'Annulé' : 'Brouillon'}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      registrationsClosed ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {registrationsClosed ? <Lock size={10} /> : <Unlock size={10} />}
                      {registrationsClosed ? 'Inscriptions fermées' : 'Inscriptions ouvertes'}
                    </span>
                    {isEventFull && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertCircle size={10} />
                        Complet ({registrations.length}/{formData.max_slots})
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-xl font-bold text-gray-800 leading-snug">{formData.title || 'Sans titre'}</h2>
                  <div className="flex items-center gap-3 flex-wrap mt-1.5 text-xs sm:text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-green-500 flex-shrink-0" />
                      {formData.event_date ? new Date(formData.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    </span>
                    {formData.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-green-500 flex-shrink-0" />
                        {formData.location}
                      </span>
                    )}
                    {formData.registration_deadline && (
                      <span className={`flex items-center gap-1.5 ${registrationDeadlinePassed ? 'text-amber-600' : ''}`}>
                        <Clock size={13} className={registrationDeadlinePassed ? 'text-amber-500' : 'text-green-500'} />
                        Inscriptions jusqu'au {new Date(formData.registration_deadline).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                {isEditing && (
                  <button
                    type="button"
                    onClick={toggleRegistrations}
                    disabled={togglingRegistrations}
                    title={registrationDeadlinePassed && formData.registrations_open !== false ? 'La date limite est dépassée : modifiez-la dans les informations pour rouvrir.' : undefined}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 font-bold rounded-xl transition-all shadow-sm text-xs sm:text-sm border disabled:opacity-60 ${
                      formData.registrations_open === false
                        ? 'bg-white text-green-700 border-green-200 hover:bg-green-50'
                        : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    {togglingRegistrations
                      ? <Loader2 size={15} className="animate-spin" />
                      : formData.registrations_open === false ? <Unlock size={15} /> : <Lock size={15} />}
                    {formData.registrations_open === false ? 'Rouvrir inscriptions' : 'Fermer inscriptions'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openWizardAt('info')}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm text-xs sm:text-sm"
                >
                  <Edit3 size={15} /> Modifier infos
                </button>
              </div>
            </div>

            {formData.description && (
              <div className="prose prose-sm max-w-none text-gray-600 bg-gray-50 rounded-xl p-3.5 sm:p-4 border border-gray-100 line-clamp-4"
                dangerouslySetInnerHTML={{ __html: formData.description }} />
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 pt-1">
              <div className="border border-gray-100 rounded-xl p-3 sm:p-4 bg-gray-50/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <ClipboardList size={14} className="text-green-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-gray-700 truncate">Questionnaires</p>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-snug">{(formData.form_fields || []).length} question(s) d'inscription, {(formData.feedback_config?.fields || []).length} d'avis</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-3 sm:p-4 bg-gray-50/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Ticket size={14} className="text-green-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-gray-700 truncate">Billetterie</p>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-snug">
                  {(formData.program || []).length} étape(s) · {(formData.ticket_tiers || []).length} tarif(s) · {formData.ticket_template === 'modern' ? 'moderne' : 'classique'}
                </p>
              </div>
              <div className="border border-gray-100 rounded-xl p-3 sm:p-4 bg-gray-50/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Award size={14} className={formData.certificate_enabled ? 'text-green-600 flex-shrink-0' : 'text-gray-300 flex-shrink-0'} />
                  <p className="text-xs font-bold text-gray-700 truncate">Certificats</p>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-snug">
                  {formData.certificate_enabled ? `Activés · ${formData.certificate_template === 'modern' ? 'moderne' : formData.certificate_template === 'dje' ? 'DJE élégant' : 'classique'}` : 'Désactivés'}
                </p>
              </div>
              <div className="border border-gray-100 rounded-xl p-3 sm:p-4 bg-gray-50/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={14} className={formData.poster_enabled !== false ? 'text-green-600 flex-shrink-0' : 'text-gray-300 flex-shrink-0'} />
                  <p className="text-xs font-bold text-gray-700 truncate">Visuel "J'y serai"</p>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-snug">
                  {formData.poster_enabled !== false ? `Activé · ${formData.poster_template === 'modern' ? 'moderne' : 'classique'}` : 'Désactivé'}
                </p>
              </div>
            </div>

            {/* ── Section Programme & Agenda ── */}
            <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-700 flex-shrink-0">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Programme de l'événement</h3>
                    <p className="text-xs text-gray-400">
                      {(formData.program || []).length} étape{(formData.program || []).length > 1 ? 's' : ''} au planning
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openWizardAt('program')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <Pencil size={13} />
                  {(formData.program || []).length > 0 ? 'Modifier le programme' : 'Ajouter un programme'}
                </button>
              </div>

              {(formData.program || []).length > 0 ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {formData.program!.map((item, idx) => (
                    <div key={item.id || idx} className="relative">
                      {/* Pastille numérotée */}
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-green-600 flex items-center justify-center text-[10px] font-bold text-green-700">
                        {idx + 1}
                      </div>

                      <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-800">{item.title || 'Étape sans titre'}</h4>
                          {item.time && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">
                              {item.time}
                            </span>
                          )}
                        </div>
                        {item.speaker && (
                          <p className="text-xs text-gray-600 flex items-center gap-1 font-medium">
                            <span className="text-gray-400">Intervenant :</span> {item.speaker}
                          </p>
                        )}
                        {item.description && (
                          <p className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 px-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  <ClipboardList size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs font-semibold text-gray-600">Aucune étape au programme pour le moment</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 max-w-sm mx-auto mb-3">
                    Définissez l'agenda, les créneaux horaires et les intervenants pour informer les participants.
                  </p>
                  <button
                    type="button"
                    onClick={() => openWizardAt('program')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-sm transition-all"
                  >
                    <Plus size={14} /> Définir le programme
                  </button>
                </div>
              )}
            </div>

            {/* ── Section Tarifs si configurés ── */}
            {(formData.ticket_tiers || []).length > 0 && (
              <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-700 flex-shrink-0">
                      <Ticket size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Tarifs & Billets</h3>
                      <p className="text-xs text-gray-400">
                        {formData.ticket_tiers!.length} tarif{formData.ticket_tiers!.length > 1 ? 's' : ''} configuré{formData.ticket_tiers!.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openWizardAt('program')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <Pencil size={13} /> Modifier les tarifs
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {formData.ticket_tiers!.map((tier) => (
                    <div key={tier.id} className="p-3 bg-gray-50/80 border border-gray-100 rounded-xl">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-800 truncate">{tier.label || 'Tarif'}</span>
                        <span className="text-xs font-bold text-green-700 whitespace-nowrap">
                          {tier.price ? `${tier.price.toLocaleString('fr-FR')} FCFA` : 'Gratuit'}
                        </span>
                      </div>
                      {tier.description && (
                        <p className="text-xs text-gray-500 mt-1">{tier.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-10 py-4 sm:py-5 border-b border-gray-100 gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">Participants inscrits</h2>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                    <span className="font-bold text-green-600">{registrations.length}</span> inscription{registrations.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => fetchRegistrations(parseInt(id!))}
                  className="sm:hidden px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  Rafraîchir
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Recherche */}
                <div className="relative flex-1 sm:flex-initial">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Rechercher un nom, email…"
                    value={participantSearch}
                    onChange={e => { setParticipantSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-8 pr-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-48"
                  />
                </div>
                {selectedParticipantIds.size > 0 && (
                  <button
                    onClick={() => setEmailComposer({
                      targetGroup: 'participants',
                      recipients: registrations.filter(r => selectedParticipantIds.has(r.id) && r.email && r.email !== VISITOR_EMAIL),
                    })}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Mail size={14} /> <span>Email ({selectedParticipantIds.size})</span>
                  </button>
                )}
                {registrations.length > 0 && (
                  <button onClick={exportXLSX}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-green-100 transition-colors border border-green-200">
                    <FileSpreadsheet size={14} /> <span>XLSX</span>
                  </button>
                )}
                <button onClick={() => fetchRegistrations(parseInt(id!))}
                  className="hidden sm:inline-flex px-3 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  Rafraîchir
                </button>
              </div>
            </div>

            {/* Barre de filtres par statut de paiement */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-10 py-2.5 sm:py-3 bg-gray-50/70 border-b border-gray-100 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 mr-1 hidden sm:inline">Filtres :</span>
              <button
                type="button"
                onClick={() => { setPaymentFilter('all'); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  paymentFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Toutes ({bookingOrders.length})
              </button>
              <button
                type="button"
                onClick={() => { setPaymentFilter('pending'); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                  paymentFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white border border-gray-200 text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Clock size={11} />
                À valider ({pendingPaymentsCount})
              </button>
              <button
                type="button"
                onClick={() => { setPaymentFilter('paid'); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                  paymentFilter === 'paid'
                    ? 'bg-green-700 text-white'
                    : 'bg-white border border-gray-200 text-green-800 hover:bg-green-50'
                }`}
              >
                <CheckCircle2 size={11} />
                Payées ({paidPaymentsCount})
              </button>
              <button
                type="button"
                onClick={() => { setPaymentFilter('free'); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  paymentFilter === 'free'
                    ? 'bg-gray-700 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Gratuites ({freeRegistrationsCount})
              </button>
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
                      <tr className="bg-gray-50/70 border-b border-gray-100">
                        <th className="px-5 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={
                              paginatedOrders.length > 0 &&
                              paginatedOrders.every(o => o.items.every(r => selectedParticipantIds.has(r.id)))
                            }
                            onChange={e => {
                              setSelectedParticipantIds(prev => {
                                const s = new Set(prev);
                                paginatedOrders.forEach(o => {
                                  o.items.forEach(r => {
                                    if (e.target.checked) s.add(r.id);
                                    else s.delete(r.id);
                                  });
                                });
                                return s;
                              });
                            }}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Participant(s)</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Paiement</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedOrders.map((order) => {
                        const isAllSelected = order.items.every(r => selectedParticipantIds.has(r.id));
                        const isExpanded = expandedOrderKeys.has(order.groupKey);

                        return (
                          <React.Fragment key={order.groupKey}>
                            <tr className="hover:bg-gray-50/80 transition-colors">
                              <td className="px-3 sm:px-5 py-3.5 sm:py-4 align-top w-8">
                                <input
                                  type="checkbox"
                                  checked={isAllSelected}
                                  onChange={() => {
                                    setSelectedParticipantIds(prev => {
                                      const s = new Set(prev);
                                      if (isAllSelected) {
                                        order.items.forEach(r => s.delete(r.id));
                                      } else {
                                        order.items.forEach(r => s.add(r.id));
                                      }
                                      return s;
                                    });
                                  }}
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500 mt-1"
                                />
                              </td>
                              <td className="px-2.5 sm:px-4 py-3.5 sm:py-4 align-top">
                                {order.isGroup ? (
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                        {order.primaryRegistration.fullname}
                                      </span>
                                      <span className="text-[10px] sm:text-[11px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                        {order.placesCount} places
                                      </span>
                                      {order.primaryRegistration.custom_data?.ticket_tier && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                          {order.primaryRegistration.custom_data.ticket_tier}
                                        </span>
                                      )}
                                      {order.orderRef && (
                                        <span className="text-[10px] font-mono text-gray-400">
                                          {order.orderRef}
                                        </span>
                                      )}
                                    </div>
                                    <p className="sm:hidden text-[11px] text-gray-500 truncate mt-0.5">{order.buyerEmail}</p>
                                    <div className="mt-1">
                                      <button
                                        type="button"
                                        onClick={() => toggleOrderExpand(order.groupKey)}
                                        className="inline-flex items-center gap-1 text-xs text-green-700 font-medium hover:text-green-900 transition-colors py-0.5"
                                      >
                                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        <span>{isExpanded ? 'Masquer' : `Voir les ${order.placesCount} participants`}</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-bold text-gray-900 text-xs sm:text-sm">{order.primaryRegistration.fullname}</p>
                                      {order.primaryRegistration.custom_data?.ticket_tier && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                          {order.primaryRegistration.custom_data.ticket_tier}
                                        </span>
                                      )}
                                      {order.primaryRegistration.scanned_at && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          Scanné ✓
                                        </span>
                                      )}
                                    </div>
                                    <p className="sm:hidden text-[11px] text-gray-500 truncate mt-0.5">{order.buyerEmail}</p>
                                    {order.primaryRegistration.ticket_ref && (
                                      <span className="text-[11px] font-mono text-gray-400 block mt-0.5">
                                        {order.primaryRegistration.ticket_ref}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4 hidden sm:table-cell align-top">
                                <p className="text-gray-800 text-xs sm:text-sm">{order.buyerEmail}</p>
                                {order.payerPhone && (
                                  <p className="text-gray-400 text-xs mt-0.5 font-mono">
                                    {order.payerPhone}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-4 align-top">
                                {order.paymentStatus === 'pending' && (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                      <Clock size={11} className="text-amber-600" />
                                      À valider · {order.paymentOperator === 'airtel' ? 'Airtel' : 'Moov'}
                                    </span>
                                    {order.totalAmount ? (
                                      <div className="text-xs font-bold text-gray-900 font-mono">
                                        {Number(order.totalAmount).toLocaleString('fr-FR')} XAF
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                                {order.paymentStatus === 'paid' && (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-800 border border-green-200">
                                      <CheckCircle2 size={11} className="text-green-600" />
                                      Payé · {order.paymentOperator === 'airtel' ? 'Airtel' : 'Moov'}
                                    </span>
                                    {order.totalAmount ? (
                                      <div className="text-xs font-medium text-gray-600 font-mono">
                                        {Number(order.totalAmount).toLocaleString('fr-FR')} XAF
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                                {order.paymentStatus === 'free' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-600 bg-gray-100">
                                    Gratuit
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-4 hidden md:table-cell text-gray-400 text-xs whitespace-nowrap align-top">
                                {order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </td>
                              <td className="px-2 sm:px-4 py-3.5 sm:py-4 align-top">
                                {/* Desktop : boutons alignés */}
                                <div className="hidden sm:flex items-center justify-center gap-1 flex-wrap">
                                  {order.paymentStatus === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => handleValidateOrder(order)}
                                      disabled={validatingOrderKey === order.groupKey}
                                      title="Valider et envoyer le(s) billet(s)"
                                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                                    >
                                      {validatingOrderKey === order.groupKey ? (
                                        <>
                                          <Loader2 size={12} className="animate-spin" />
                                          <span>Validation…</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 size={12} />
                                          <span>Valider {order.isGroup ? `(${order.placesCount})` : ''}</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (order.isGroup) {
                                        setViewingOrder(order);
                                      } else {
                                        setViewingParticipant(order.primaryRegistration);
                                      }
                                    }}
                                    title="Détails"
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  {order.isGroup ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadOrderTickets(order)}
                                      disabled={downloadingOrderKey === order.groupKey}
                                      title={`Télécharger les ${order.placesCount} billets`}
                                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      {downloadingOrderKey === order.groupKey ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openEditParticipant(order.primaryRegistration)}
                                        title="Modifier"
                                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                      >
                                        <Pencil size={15} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadTicket(order.primaryRegistration)}
                                        disabled={downloadingId === order.primaryRegistration.id}
                                        title="Télécharger le billet"
                                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        {downloadingId === order.primaryRegistration.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order)}
                                    title="Supprimer"
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>

                                {/* Mobile : menu 3 points (MoreVertical) */}
                                <div className="sm:hidden relative flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => setOpenActionMenuKey(prev => prev === order.groupKey ? null : order.groupKey)}
                                    className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                                    aria-label="Actions"
                                  >
                                    <MoreVertical size={17} />
                                  </button>

                                  {openActionMenuKey === order.groupKey && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-30"
                                        onClick={() => setOpenActionMenuKey(null)}
                                      />
                                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-40 py-1 overflow-hidden text-left">
                                        {order.paymentStatus === 'pending' && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuKey(null);
                                              handleValidateOrder(order);
                                            }}
                                            disabled={validatingOrderKey === order.groupKey}
                                            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-bold text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                                          >
                                            <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                                            <span>Valider {order.isGroup ? `(${order.placesCount})` : 'le paiement'}</span>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuKey(null);
                                            if (order.isGroup) {
                                              setViewingOrder(order);
                                            } else {
                                              setViewingParticipant(order.primaryRegistration);
                                            }
                                          }}
                                          className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                          <Eye size={14} className="text-purple-500 flex-shrink-0" />
                                          <span>Voir les détails</span>
                                        </button>
                                        {!order.isGroup && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuKey(null);
                                              openEditParticipant(order.primaryRegistration);
                                            }}
                                            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                          >
                                            <Pencil size={14} className="text-amber-500 flex-shrink-0" />
                                            <span>Modifier</span>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuKey(null);
                                            if (order.isGroup) {
                                              handleDownloadOrderTickets(order);
                                            } else {
                                              handleDownloadTicket(order.primaryRegistration);
                                            }
                                          }}
                                          className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                          <Download size={14} className="text-blue-500 flex-shrink-0" />
                                          <span>{order.isGroup ? `Télécharger (${order.placesCount} billets)` : 'Télécharger le billet'}</span>
                                        </button>
                                        <div className="border-t border-gray-100 my-0.5" />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuKey(null);
                                            handleDeleteOrder(order);
                                          }}
                                          className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                          <Trash2 size={14} className="flex-shrink-0" />
                                          <span>Supprimer</span>
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Accordéon déroulant avec la liste des participants de la commande */}
                            {order.isGroup && isExpanded && (
                              <tr className="bg-gray-50/70 border-b border-gray-200">
                                <td colSpan={6} className="px-6 py-3">
                                  <div className="pl-4 sm:pl-8 border-l-2 border-gray-300 space-y-2">
                                    <p className="text-xs font-semibold text-gray-600">
                                      Noms des participants ({order.placesCount}) :
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {order.items.map((subReg, subIdx) => (
                                        <div
                                          key={subReg.id}
                                          className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-xs flex items-center justify-between gap-2"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                                {subIdx + 1}
                                              </span>
                                              <p className="font-semibold text-xs text-gray-900 truncate">{subReg.fullname}</p>
                                            </div>
                                            {subReg.ticket_ref && (
                                              <span className="text-[10px] font-mono text-gray-400 block ml-6.5 mt-0.5">
                                                Réf: {subReg.ticket_ref}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 flex-shrink-0 text-gray-400">
                                            <button
                                              type="button"
                                              onClick={() => setViewingParticipant(subReg)}
                                              title="Voir le profil et les réponses du candidat"
                                              className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                              <Eye size={13} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => openEditParticipant(subReg)}
                                              title="Corriger le nom sur le billet"
                                              className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                              <Pencil size={13} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadTicket(subReg)}
                                              disabled={downloadingId === subReg.id}
                                              title="Télécharger ce billet"
                                              className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                              {downloadingId === subReg.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
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
                  {scannedRegistrations.length > 0 && (
                    <span className="text-gray-400">
                      {' · '}
                      <span className="font-semibold text-amber-600">
                        {scannedRegistrations.filter(r => !r.certificate_sent_at && !!getRegistrationRecipientEmail(r)).length}
                      </span>{' '}
                      en attente d'envoi initial
                    </span>
                  )}
                </p>
              </div>
              {formData.certificate_enabled && (
                <div className="flex items-center gap-2 flex-wrap">
                  {certAutoSending ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                      <Loader2 size={14} className="animate-spin" />
                      <span>
                        Envoi des certificats en cours
                        {certBatchProgress ? ` (${certBatchProgress.done} / ${certBatchProgress.total})` : ''}…
                      </span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => autoSendPendingCertificates(registrations)}
                        disabled={!scannedRegistrations.some(r => !r.certificate_sent_at && !!getRegistrationRecipientEmail(r))}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all"
                      >
                        <Send size={14} />
                        Envoyer les certificats ({scannedRegistrations.filter(r => !r.certificate_sent_at && !!getRegistrationRecipientEmail(r)).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!certScheduleInput) {
                            const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
                            setCertScheduleInput(toDatetimeLocalString(defaultDate.toISOString()));
                          }
                          setCertSchedulePickerOpen(prev => !prev);
                        }}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                          certScheduledAt
                            ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                            : 'text-gray-700 bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Clock size={14} />
                        {certScheduledAt ? "Modifier l'envoi programmé" : "Programmer l'envoi"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Panneau / Bannière de programmation de l'envoi initial */}
            {formData.certificate_enabled && (certScheduledAt || certSchedulePickerOpen) && (
              <div className="mx-6 sm:mx-10 mt-4 p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Clock size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-900">
                    {certScheduledAt ? (
                      <>
                        <p className="font-bold">
                          Envoi initial programmé pour le{' '}
                          {new Date(certScheduledAt).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-amber-700 mt-0.5">
                          Tous les billets scannés en attente recevront automatiquement leur certificat à cette échéance.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold">Programmer l'envoi initial des certificats</p>
                        <p className="text-amber-700 mt-0.5">
                          Choisissez la date et l'heure auxquelles envoyer les certificats aux participants scannés.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {certSchedulePickerOpen ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="datetime-local"
                      value={certScheduleInput}
                      onChange={e => setCertScheduleInput(e.target.value)}
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCertSchedule}
                      disabled={savingCertSchedule || !certScheduleInput}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {savingCertSchedule ? 'Enregistrement…' : 'Valider'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCertSchedulePickerOpen(false)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      Fermer
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelCertSchedule}
                      disabled={savingCertSchedule}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                    >
                      Annuler la programmation
                    </button>
                  </div>
                )}
              </div>
            )}

            {!formData.certificate_enabled ? (
              <div className="text-center py-16 mx-6 sm:mx-10 my-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Award size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">Les certificats ne sont pas activés pour cet événement.</p>
                <p className="text-sm text-gray-400 mt-1 mb-4">Activez-les depuis l'étape "Certificats" du wizard.</p>
                <button type="button" onClick={() => openWizardAt('certificates')}
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
                <p className="text-sm text-gray-400 mt-1">Dès qu'un billet est scanné à l'entrée (onglet Scan), le participant apparaît ici. Vous pourrez alors lancer ou programmer l'envoi des certificats.</p>
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
                      const recipientEmail = getRegistrationRecipientEmail(reg);
                      return (
                        <tr key={reg.id} className="hover:bg-green-50/30 transition-colors">
                          <td className="px-3 sm:px-5 py-3.5 sm:py-4">
                            <p className="font-bold text-gray-900 text-xs sm:text-sm">{reg.fullname}</p>
                            <p className="text-gray-500 text-[11px] sm:text-xs truncate max-w-[160px] sm:max-w-none">{recipientEmail || reg.email}</p>
                            {reg.scanned_at && (
                              <p className="sm:hidden text-[10px] text-gray-400 mt-0.5">
                                Scanné le {new Date(reg.scanned_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
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
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => downloadCertificateForRegistration(reg)}
                                title="Télécharger le certificat (PDF)"
                                className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={() => sendCertificateToRegistration(reg, true)}
                                disabled={isSending || !recipientEmail}
                                title={reg.certificate_sent_at ? 'Renvoyer le certificat par email' : 'Envoyer le certificat par email'}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                  reg.certificate_sent_at
                                    ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                                    : 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200'
                                }`}
                              >
                                <Send size={13} />
                                {reg.certificate_sent_at ? 'Renvoyer' : 'Envoyer'}
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
                          <td className="px-3 sm:px-4 py-3.5 sm:py-4">
                            <p className="font-bold text-gray-900 text-xs sm:text-sm">{vol.fullname}</p>
                            <div className="sm:hidden text-[11px] text-gray-500 mt-0.5 space-y-0.5">
                              {vol.email && <p className="truncate max-w-[180px]">{vol.email}</p>}
                              {vol.phone && <p className="text-gray-400 font-mono text-[10px]">{vol.phone}</p>}
                            </div>
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

        {/* ── Posters Tab : Galerie, Téléchargement ZIP et Purge ── */}
        {activeTab === 'posters' && id && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 sm:px-10 py-8">
            <EventPostersTab eventId={id} eventTitle={formData.title || 'Événement'} />
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <EventWizardModal
        isOpen={infoWizardOpen}
        initialStep={wizardInitialStep}
        eventId={id ? parseInt(id) : undefined}
        onClose={() => setInfoWizardOpen(false)}
        onSaved={(saved) => {
          setInfoWizardOpen(false);
          refreshEvents();
          if (saved) {
            setFormData(prev => ({
              ...prev,
              ...saved,
              program: Array.isArray(saved.program) ? saved.program : prev.program,
              ticket_tiers: Array.isArray(saved.ticket_tiers) ? saved.ticket_tiers : prev.ticket_tiers,
            }));
          }
        }}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      {/* Order detail modal */}
      {viewingOrder && (
        <Modal
          isOpen={!!viewingOrder}
          onClose={() => setViewingOrder(null)}
          title={`Détails de la réservation — ${viewingOrder.placesCount} place${viewingOrder.placesCount > 1 ? 's' : ''}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Header badges */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {viewingOrder.orderRef && (
                  <span className="font-mono text-xs font-bold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200">
                    {viewingOrder.orderRef}
                  </span>
                )}
                <span className="text-xs font-bold text-gray-500">
                  {viewingOrder.placesCount} billet{viewingOrder.placesCount > 1 ? 's' : ''}
                </span>
              </div>
              <div>
                {viewingOrder.paymentStatus === 'paid' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 size={13} />
                    Payé & Validé
                  </span>
                ) : viewingOrder.paymentStatus === 'pending' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
                    <Clock size={13} />
                    En attente de validation
                  </span>
                ) : (
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    Gratuit
                  </span>
                )}
              </div>
            </div>

            {/* Informations acheteur & paiement */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={14} className="text-gray-500" />
                Informations Acheteur & Paiement
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-400 font-medium block text-[10px] uppercase">Acheteur</span>
                  <span className="font-semibold text-gray-900 text-sm">
                    {viewingOrder.primaryRegistration.fullname}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-400 font-medium block text-[10px] uppercase">Email destinataire</span>
                  <span className="font-semibold text-gray-900 text-sm break-all">
                    {viewingOrder.buyerEmail}
                  </span>
                </div>
                {viewingOrder.isPaid && (
                  <>
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                      <span className="text-gray-400 font-medium block text-[10px] uppercase">Opérateur Mobile Money</span>
                      <span className="font-semibold text-gray-900">
                        {viewingOrder.paymentOperator === 'airtel' ? 'Airtel Money' : viewingOrder.paymentOperator === 'moov' ? 'Moov Money' : '—'}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                      <span className="text-gray-400 font-medium block text-[10px] uppercase">Numéro du payeur</span>
                      <span className="font-semibold text-gray-900 font-mono">
                        {viewingOrder.payerPhone || '—'}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200 sm:col-span-2">
                      <span className="text-gray-400 font-medium block text-[10px] uppercase">Montant total</span>
                      <span className="font-bold text-gray-900 text-base">
                        {viewingOrder.totalAmount ? `${Number(viewingOrder.totalAmount).toLocaleString('fr-FR')} XAF` : '—'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {viewingOrder.paymentStatus === 'pending' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleValidateOrder(viewingOrder)}
                    disabled={validatingOrderKey === viewingOrder.groupKey}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50"
                  >
                    {validatingOrderKey === viewingOrder.groupKey ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Validation en cours & envoi des {viewingOrder.placesCount} billets…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Valider la commande ({viewingOrder.placesCount} billet{viewingOrder.placesCount > 1 ? 's' : ''}) & envoyer par email</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Liste des participants */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Users size={14} className="text-gray-400" />
                Noms des participants ({viewingOrder.placesCount})
              </h4>
              <div className="space-y-2">
                {viewingOrder.items.map((it, idx) => (
                  <div key={it.id} className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 font-bold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <p className="font-semibold text-sm text-gray-900 truncate">{it.fullname}</p>
                      </div>
                      {it.ticket_ref && (
                        <p className="text-[11px] font-mono text-gray-400 ml-7 mt-0.5">Réf: {it.ticket_ref}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingParticipant(it)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                        title="Voir le profil et les réponses du candidat"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditParticipant(it)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                        title="Corriger le nom"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadTicket(it)}
                        disabled={downloadingId === it.id}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                        title="Télécharger ce billet"
                      >
                        {downloadingId === it.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDeleteOrder(viewingOrder)}
                className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Supprimer cette commande
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadOrderTickets(viewingOrder)}
                  disabled={downloadingOrderKey === viewingOrder.groupKey}
                  className="px-4 py-2 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {downloadingOrderKey === viewingOrder.groupKey ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Télécharger tous les billets
                </button>
                <button
                  type="button"
                  onClick={() => setViewingOrder(null)}
                  className="px-5 py-2 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-xs"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Participant detail modal */}
      {viewingParticipant && (
        <Modal
          isOpen={!!viewingParticipant}
          onClose={() => setViewingParticipant(null)}
          title="Détails du candidat & Réponses au formulaire"
          size="lg"
        >
          <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center justify-between gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-ddb-700 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-sm">
                  {(viewingParticipant.fullname || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-base">{viewingParticipant.fullname}</p>
                    {viewingParticipant.custom_data?.ticket_tier && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                        {viewingParticipant.custom_data.ticket_tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Inscrit le {viewingParticipant.created_at ? new Date(viewingParticipant.created_at).toLocaleString('fr-FR') : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditParticipant(viewingParticipant)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors shadow-xs"
                >
                  <Pencil size={13} />
                  <span>Corriger</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTicket(viewingParticipant)}
                  disabled={downloadingId === viewingParticipant.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  {downloadingId === viewingParticipant.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  <span>Billet</span>
                </button>
              </div>
            </div>

            {/* Coordonnées & État du billet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Email</span>
                <span className="font-semibold text-gray-800 break-all mt-0.5 block">{viewingParticipant.email || '—'}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Téléphone</span>
                <span className="font-mono font-semibold text-gray-800 mt-0.5 block">{viewingParticipant.phone || viewingParticipant.custom_data?.payer_phone || '—'}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Réf. Billet</span>
                <span className="font-mono font-semibold text-gray-800 mt-0.5 block">{viewingParticipant.ticket_ref || '—'}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Contrôle d'accès</span>
                <span className={`font-semibold mt-0.5 block ${viewingParticipant.scanned_at ? 'text-green-700 font-bold' : 'text-gray-600'}`}>
                  {viewingParticipant.scanned_at ? `Scanné le ${new Date(viewingParticipant.scanned_at).toLocaleDateString('fr-FR')}` : 'Non encore scanné'}
                </span>
              </div>
            </div>

            {/* ── Réponses & Informations renseignées par le candidat (Visible pour tout le monde) ── */}
            {(() => {
              const internalKeys = new Set([
                'order_ref', 'is_paid_booking', 'payment_status', 'unit_price', 'total_amount',
                'ticket_tier', 'buyer_email', 'payer_phone', 'payment_operator', 'participant_index',
                'group_size', 'all_participants', 'poster_url', 'poster_saved_at', 'validated_at'
              ]);

              const customData = viewingParticipant.custom_data || {};
              const fieldsMap = new Map();
              (formData.form_fields || []).forEach(f => {
                if (f && f.id) fieldsMap.set(f.id, f.label || f.id);
              });

              // Rassembler toutes les réponses
              const answers = [];

              // 1. D'abord les champs configurés dans form_fields
              (formData.form_fields || []).forEach(field => {
                const val = customData[field.id];
                if (val !== undefined && val !== null && val !== '') {
                  answers.push({ key: field.id, label: field.label || field.id, value: val });
                }
              });

              // 2. Ensuite les clés additionnelles présentes dans custom_data (non système)
              Object.entries(customData).forEach(([key, val]) => {
                if (internalKeys.has(key)) return;
                if (fieldsMap.has(key)) return;
                if (val === undefined || val === null || val === '') return;
                const readableLabel = key
                  .replace(/_/g, ' ')
                  .replace(/([A-Z])/g, ' $1')
                  .trim();
                const formattedLabel = readableLabel.charAt(0).toUpperCase() + readableLabel.slice(1);
                answers.push({ key, label: formattedLabel, value: val });
              });

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardList size={14} className="text-green-600" />
                      Informations & Réponses du candidat
                    </h4>
                    <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                      {answers.length} information{answers.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {answers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {answers.map(ans => (
                        <div key={ans.key} className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-200/80 hover:border-gray-300 transition-colors">
                          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            {ans.label}
                          </p>
                          <div className="text-sm text-gray-900 font-medium break-words leading-relaxed">
                            {Array.isArray(ans.value) ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ans.value.map((v, i) => (
                                  <span key={i} className="inline-block px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 text-xs rounded-md">
                                    {String(v)}
                                  </span>
                                ))}
                              </div>
                            ) : typeof ans.value === 'boolean' ? (
                              ans.value ? 'Oui' : 'Non'
                            ) : typeof ans.value === 'object' ? (
                              <pre className="text-xs bg-white p-2 rounded border border-gray-200 font-mono overflow-x-auto">
                                {JSON.stringify(ans.value, null, 2)}
                              </pre>
                            ) : (
                              <p className="whitespace-pre-wrap">{String(ans.value)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-5 text-center border border-dashed border-gray-200">
                      <p className="text-xs text-gray-400 italic">
                        Aucune réponse additionnelle requise ou renseignée pour cette inscription.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Détails du paiement Mobile Money (si payant) */}
            {viewingParticipant.custom_data?.is_paid_booking && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone size={14} className="text-gray-500" />
                    Données renseignées par le payeur
                  </h4>
                  {viewingParticipant.custom_data?.order_ref && (
                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                      {viewingParticipant.custom_data.order_ref}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                    <span className="text-gray-400 font-medium block text-[10px] uppercase">Email du payeur</span>
                    <span className="font-semibold text-gray-900 break-all">
                      {viewingParticipant.custom_data.buyer_email || viewingParticipant.email}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                    <span className="text-gray-400 font-medium block text-[10px] uppercase">Numéro du payeur</span>
                    <span className="font-semibold text-gray-900 font-mono">
                      {viewingParticipant.custom_data.payer_phone || '—'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                    <span className="text-gray-400 font-medium block text-[10px] uppercase">Moyen de paiement</span>
                    <span className="font-semibold text-gray-900">
                      {viewingParticipant.custom_data.payment_operator === 'airtel' ? 'Airtel Money' : 'Moov Money'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                    <span className="text-gray-400 font-medium block text-[10px] uppercase">Montant total</span>
                    <span className="font-bold text-gray-900">
                      {viewingParticipant.custom_data.total_amount ? `${Number(viewingParticipant.custom_data.total_amount).toLocaleString('fr-FR')} XAF` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit participant modal */}
      {editingParticipant && (
        <Modal
          isOpen={!!editingParticipant}
          onClose={() => setEditingParticipant(null)}
          title={`Corriger — ${editingParticipant.fullname}`}
          size="md"
        >
          <div className="p-1 space-y-4">
            {editSuccess ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="text-green-600" size={24} />
                </div>
                <p className="font-bold text-gray-900 mb-1">Billet corrigé et renvoyé !</p>
                <p className="text-xs text-gray-500 mb-4">
                  Le billet avec le nouveau nom a été envoyé à l'acheteur ({editingParticipant.custom_data?.buyer_email || editForm.email}).
                </p>
                <button
                  type="button"
                  onClick={() => setEditingParticipant(null)}
                  className="px-5 py-2 font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-xs"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                {editError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-2.5 rounded-lg">{editError}</div>
                )}

                {editingParticipant.custom_data?.is_paid_booking ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nom complet du participant *</label>
                      <input
                        type="text"
                        value={editForm.fullname}
                        onChange={e => setEditForm(f => ({ ...f, fullname: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="Nom figurant sur le billet"
                      />
                    </div>
                    <p className="text-xs text-gray-400 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      Ce billet sera expédié à l'adresse de l'acheteur : <strong className="text-gray-700">{editingParticipant.custom_data.buyer_email || editForm.email}</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nom complet *</label>
                      <input
                        type="text"
                        value={editForm.fullname}
                        onChange={e => setEditForm(f => ({ ...f, fullname: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Téléphone</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
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

      {/* Modal in-app de confirmation de validation et d'envoi des billets */}
      {validationModal && (
        <Modal
          isOpen={validationModal.isOpen}
          onClose={() => setValidationModal(null)}
          title="Validation effectuée"
          size="md"
        >
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={30} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                {validationModal.placesCount > 1
                  ? `${validationModal.placesCount} billets envoyés avec succès !`
                  : 'Billet officiel envoyé avec succès !'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Un e-mail récapitulatif unique regroupant {validationModal.placesCount > 1 ? `les ${validationModal.placesCount} billets PDF en pièces jointes` : 'le billet officiel en pièce jointe'} a été transmis à l'acheteur :
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-800">
                <Mail size={13} />
                <span>{validationModal.recipientEmail}</span>
              </div>
            </div>

            {validationModal.participantNames && validationModal.participantNames.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-left text-xs space-y-2">
                <span className="font-semibold text-gray-700 block">
                  Billet{validationModal.placesCount > 1 ? 's' : ''} émis pour :
                </span>
                <div className="space-y-1">
                  {validationModal.participantNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-gray-600">
                      <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 font-bold text-[9px] flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium text-gray-800 truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setValidationModal(null)}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm"
            >
              Fermer
            </button>
          </div>
        </Modal>
      )}

      {/* Modal in-app d'erreur de validation */}
      {errorMessageModal && (
        <Modal
          isOpen={!!errorMessageModal}
          onClose={() => setErrorMessageModal(null)}
          title="Une erreur est survenue"
          size="md"
        >
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={26} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Impossible de finaliser l'action</h3>
              <p className="text-xs text-red-600 mt-2 bg-red-50 p-3 rounded-xl border border-red-100 text-left leading-relaxed break-words font-mono">
                {errorMessageModal}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessageModal(null)}
              className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-xs sm:text-sm transition-colors"
            >
              Fermer
            </button>
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
