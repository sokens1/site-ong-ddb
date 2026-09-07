import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

/** Fetch any image URL as a base64 data URI */
export const fetchImageAsBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

/** Génère un QR code localement (sans dépendance externe) */
export const getQRCodeDataUri = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      width: 150,
      margin: 1,
      color: { dark: '#14532d', light: '#ffffff' },
    });
  } catch {
    // Fallback API si qrcode échoue (rare)
    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}&color=14532d&bgcolor=ffffff`;
      return await fetchImageAsBase64(url);
    } catch {
      return '';
    }
  }
};

export type TicketTemplate = 'classic' | 'modern' | 'invitation';

/** Generate PDF ticket or invitation in the browser using jsPDF */
export const generateTicketPDF = async (
  fullname: string,
  eventTitle: string,
  eventDate: string,
  eventLocation?: string,
  organizerLogos?: string[],
  eventDates?: { date: string; label?: string }[],
  template: TicketTemplate = 'classic',
  invitationText?: string,
  invitationSubtext?: string,
): Promise<jsPDF> => {
  if (template === 'invitation') {
    return generateInvitationTicketPDF(fullname, eventTitle, eventDate, eventLocation, organizerLogos, eventDates, invitationText, invitationSubtext);
  }
  if (template === 'modern') {
    return generateModernTicketPDF(fullname, eventTitle, eventDate, eventLocation, organizerLogos, eventDates);
  }
  return generateClassicTicketPDF(fullname, eventTitle, eventDate, eventLocation, organizerLogos, eventDates);
};

const generateClassicTicketPDF = async (
  fullname: string,
  eventTitle: string,
  eventDate: string,
  eventLocation?: string,
  organizerLogos?: string[],
  eventDates?: { date: string; label?: string }[]
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 100] });

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  // Build date line — "Du X au X" si plusieurs dates, sinon date unique
  const validExtraDates = (eventDates || []).filter(d => d.date);
  const hasExtraDates = validExtraDates.length > 0;
  const lastExtraDate = hasExtraDates ? validExtraDates[validExtraDates.length - 1].date : null;
  const dateLine = hasExtraDates
    ? `Du ${fmtDate(eventDate)} au ${fmtDate(lastExtraDate!)}`
    : `Date : ${fmtDate(eventDate)}`;

  // QR code uses first date for backward compat
  const formattedDate = fmtDate(eventDate);

  // Background
  doc.setFillColor(240, 253, 244);
  doc.rect(0, 0, 210, 100, 'F');

  // Header bar
  doc.setFillColor(20, 83, 45);
  doc.rect(0, 0, 210, 22, 'F');

  // Header text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text("BILLET D'ENTRÉE OFFICIEL", 105, 14, { align: 'center' });

  // Divider
  doc.setDrawColor(74, 222, 128);
  doc.setLineWidth(0.5);
  doc.line(10, 28, 155, 28);

  // Event title
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(eventTitle, 138);
  doc.text(titleLines, 10, 36);

  // Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(`Participant : ${fullname}`, 10, 52);
  doc.text(dateLine, 10, 62);
  if (eventLocation) doc.text(`Lieu : ${eventLocation}`, 10, 72);

  // Fine print
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text('Ce billet est personnel et non cessible.', 10, 86);
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'italic');
  doc.text('ONG Développement Durable et Bien-Être', 10, 92);
  doc.setFont('helvetica', 'normal');

  // Organizer logos — bas à droite, ratio naturel préservé
  if (organizerLogos && organizerLogos.length > 0) {
    const targetH = 9; // mm — hauteur cible
    const gap = 2;
    const maxW = 148; // mm — zone gauche disponible avant le QR
    type LogoEntry = { base64: string; nw: number; nh: number };
    const loaded: LogoEntry[] = [];
    for (let i = 0; i < Math.min(organizerLogos.length, 6); i++) {
      try {
        const base64 = await fetchImageAsBase64(organizerLogos[i]);
        if (!base64) continue;
        const dims = await new Promise<{ nw: number; nh: number }>((res) => {
          const img = new Image();
          img.onload = () => res({ nw: img.naturalWidth, nh: img.naturalHeight });
          img.onerror = () => res({ nw: 1, nh: 1 });
          img.src = base64;
        });
        loaded.push({ base64, ...dims });
      } catch { /* silent */ }
    }
    if (loaded.length > 0) {
      const naturalWidths = loaded.map(l => (l.nw / l.nh) * targetH);
      const totalNatW = naturalWidths.reduce((a, b) => a + b, 0) + gap * (loaded.length - 1);
      let finalH = targetH;
      let finalWidths = naturalWidths;
      if (totalNatW > maxW) {
        finalH = targetH * (maxW / totalNatW);
        finalWidths = loaded.map(l => (l.nw / l.nh) * finalH);
      }
      const totalFinalW = finalWidths.reduce((a, b) => a + b, 0) + gap * (loaded.length - 1);
      // Aligné en bas à droite du billet (sous la QR box)
      let lx = 204 - totalFinalW;
      const ly = 97 - finalH;
      for (let i = 0; i < loaded.length; i++) {
        doc.addImage(loaded[i].base64, 'PNG', lx, ly, finalWidths[i], finalH);
        lx += finalWidths[i] + gap;
      }
    }
  }

  // QR box background
  doc.setDrawColor(20, 83, 45);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(162, 26, 38, 52, 3, 3, 'FD');

  // Fetch QR Code data URI and embed it
  const qrData = `ONG DDB\nParticipant: ${fullname}\nEvenement: ${eventTitle}\nDate: ${formattedDate}`;
  try {
    const qrDataUri = await getQRCodeDataUri(qrData);
    if (qrDataUri) {
      doc.addImage(qrDataUri, 'PNG', 165, 29, 32, 32);
    } else {
      // Fallback text if QR code couldn't be loaded
      doc.setTextColor(127, 29, 29);
      doc.setFontSize(8);
      doc.text('QR Code', 181, 44, { align: 'center' });
      doc.text('Non disponible', 181, 49, { align: 'center' });
    }
  } catch (qrErr) {
    console.error('Error adding QR code to PDF:', qrErr);
  }

  // Label text under QR box
  doc.setTextColor(20, 83, 45);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCÈS OFFICIEL', 181, 68, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text("Présenter à l'entrée", 181, 73, { align: 'center' });

  return doc;
};

/** Ticket "moderne" — bandeau latéral teal, coins arrondis, souche pointillée */
const generateModernTicketPDF = async (
  fullname: string,
  eventTitle: string,
  eventDate: string,
  eventLocation?: string,
  organizerLogos?: string[],
  eventDates?: { date: string; label?: string }[],
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 100] });

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const validExtraDates = (eventDates || []).filter(d => d.date);
  const hasExtraDates = validExtraDates.length > 0;
  const lastExtraDate = hasExtraDates ? validExtraDates[validExtraDates.length - 1].date : null;
  const dateLine = hasExtraDates ? `Du ${fmtDate(eventDate)} au ${fmtDate(lastExtraDate!)}` : fmtDate(eventDate);
  const formattedDate = fmtDate(eventDate);

  // Fond général blanc + carte arrondie
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 100, 'F');
  doc.setFillColor(240, 253, 250);
  doc.roundedRect(4, 4, 202, 92, 6, 6, 'F');

  // Bandeau latéral gauche teal
  doc.setFillColor(13, 148, 136);
  doc.roundedRect(4, 4, 56, 92, 6, 6, 'F');
  doc.setFillColor(13, 148, 136);
  doc.rect(48, 4, 12, 92, 'F'); // carrer l'arrondi côté droit du bandeau

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILLET', 14, 18);
  doc.setFontSize(13);
  doc.text("D'ENTRÉE", 14, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(204, 251, 241);
  const titleLines = doc.splitTextToSize(eventTitle, 40);
  doc.text(titleLines, 14, 40);

  doc.setFontSize(7);
  doc.setTextColor(153, 246, 228);
  doc.text(dateLine, 14, 78);
  if (eventLocation) {
    const locLines = doc.splitTextToSize(eventLocation, 40);
    doc.text(locLines, 14, 84);
  }

  // Perforation (pointillés) entre le bandeau et le corps
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.setLineDashPattern([1.4, 1.4], 0);
  doc.line(60, 8, 60, 92);
  doc.setLineDashPattern([], 0);

  // Corps principal
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Participant', 70, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(51, 65, 81);
  doc.text(fullname, 70, 31);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(70, 37, 150, 37);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Ce billet est personnel et non cessible.', 70, 86);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.text('ONG Développement Durable et Bien-Être', 70, 91);
  doc.setFont('helvetica', 'normal');

  // Logos organisateurs
  if (organizerLogos && organizerLogos.length > 0) {
    const targetH = 8, gap = 2, maxW = 76;
    type LogoEntry = { base64: string; nw: number; nh: number };
    const loaded: LogoEntry[] = [];
    for (let i = 0; i < Math.min(organizerLogos.length, 6); i++) {
      try {
        const base64 = await fetchImageAsBase64(organizerLogos[i]);
        if (!base64) continue;
        const dims = await new Promise<{ nw: number; nh: number }>((res) => {
          const img = new Image();
          img.onload = () => res({ nw: img.naturalWidth, nh: img.naturalHeight });
          img.onerror = () => res({ nw: 1, nh: 1 });
          img.src = base64;
        });
        loaded.push({ base64, ...dims });
      } catch { /* silent */ }
    }
    if (loaded.length > 0) {
      const naturalWidths = loaded.map(l => (l.nw / l.nh) * targetH);
      const totalNatW = naturalWidths.reduce((a, b) => a + b, 0) + gap * (loaded.length - 1);
      let finalH = targetH, finalWidths = naturalWidths;
      if (totalNatW > maxW) {
        finalH = targetH * (maxW / totalNatW);
        finalWidths = loaded.map(l => (l.nw / l.nh) * finalH);
      }
      let lx = 70;
      const ly = 45;
      for (let i = 0; i < loaded.length; i++) {
        doc.addImage(loaded[i].base64, 'PNG', lx, ly, finalWidths[i], finalH);
        lx += finalWidths[i] + gap;
      }
    }
  }

  // QR box
  doc.setDrawColor(13, 148, 136);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(160, 12, 42, 76, 4, 4, 'FD');

  const qrData = `ONG DDB\nParticipant: ${fullname}\nEvenement: ${eventTitle}\nDate: ${formattedDate}`;
  try {
    const qrDataUri = await getQRCodeDataUri(qrData);
    if (qrDataUri) {
      doc.addImage(qrDataUri, 'PNG', 165, 16, 32, 32);
    } else {
      doc.setTextColor(127, 29, 29);
      doc.setFontSize(8);
      doc.text('QR Code', 181, 32, { align: 'center' });
      doc.text('Non disponible', 181, 37, { align: 'center' });
    }
  } catch (qrErr) {
    console.error('Error adding QR code to PDF:', qrErr);
  }

  doc.setFillColor(13, 148, 136);
  doc.roundedRect(165, 52, 32, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCÈS OFFICIEL', 181, 57, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Présenter à l'entrée", 181, 66, { align: 'center' });

  return doc;
};

/**
 * Carton d'invitation de luxe — Ruban & nœud doré, fond ivoire,
 * typographie rouge rubis, badges bordeaux, QR code et textes contextuels.
 */
const generateInvitationTicketPDF = async (
  fullname: string,
  eventTitle: string,
  eventDate: string,
  eventLocation?: string,
  organizerLogos?: string[],
  eventDates?: { date: string; label?: string }[],
  invitationText?: string,
  invitationSubtext?: string,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 135] });
  const W = 210, H = 135;

  const fmtFullDate = (dStr: string) => {
    try {
      const d = new Date(dStr);
      const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase().replace('.', '');
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('fr-FR', { month: 'long' }).toUpperCase();
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const timeStr = (hours === '00' && mins === '00') ? '18H00' : `${hours}H${mins === '00' ? '' : mins}`;
      return {
        dateBadge: `${dayName} ${dayNum}.${monthName}.${year}`,
        timeBadge: timeStr,
        formattedFull: `${dayNum} ${monthName} ${year} à ${timeStr}`,
      };
    } catch {
      return { dateBadge: 'DATE SUR INVITATION', timeBadge: '18H00', formattedFull: eventDate };
    }
  };

  const { dateBadge, timeBadge, formattedFull } = fmtFullDate(eventDate);

  // 1. Fond Ivoire chaleureux
  doc.setFillColor(254, 252, 248);
  doc.rect(0, 0, W, H, 'F');

  // Liseré doré intérieur
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.6);
  doc.rect(6, 6, W - 12, H - 12, 'S');
  doc.setLineWidth(0.25);
  doc.rect(8, 8, W - 16, H - 16, 'S');

  // 2. Ruban satiné doré à gauche
  const ribbonW = 38;
  // Fond doré de base
  doc.setFillColor(214, 168, 48);
  doc.rect(0, 0, ribbonW, H, 'F');

  // Dégradés / reflets satinés du ruban
  doc.setFillColor(245, 222, 130);
  doc.rect(12, 0, 14, H, 'F');
  doc.setFillColor(255, 242, 180);
  doc.rect(18, 0, 5, H, 'F');

  doc.setFillColor(180, 135, 25);
  doc.rect(ribbonW - 4, 0, 4, H, 'F');

  // Nœud papillon doré au milieu du ruban gauche (x = 38, y = 67)
  const bowX = ribbonW, bowY = 67;

  // Boucle gauche
  doc.setFillColor(228, 185, 65);
  doc.triangle(bowX - 2, bowY, bowX - 26, bowY - 22, bowX - 24, bowY + 22, 'F');
  doc.setFillColor(250, 230, 150);
  doc.triangle(bowX - 2, bowY, bowX - 20, bowY - 14, bowX - 18, bowY + 14, 'F');

  // Boucle droite
  doc.setFillColor(218, 170, 45);
  doc.triangle(bowX + 2, bowY, bowX + 26, bowY - 22, bowX + 24, bowY + 22, 'F');
  doc.setFillColor(245, 220, 135);
  doc.triangle(bowX + 2, bowY, bowX + 20, bowY - 14, bowX + 18, bowY + 14, 'F');

  // Rubans pendants
  doc.setFillColor(195, 148, 30);
  doc.triangle(bowX - 5, bowY + 4, bowX - 18, bowY + 42, bowX - 2, bowY + 36, 'F');
  doc.setFillColor(220, 175, 55);
  doc.triangle(bowX + 5, bowY + 4, bowX + 2, bowY + 36, bowX + 18, bowY + 42, 'F');

  // Nœud central (cœur du nœud)
  doc.setFillColor(248, 225, 140);
  doc.roundedRect(bowX - 7, bowY - 9, 14, 18, 3, 3, 'F');
  doc.setFillColor(185, 138, 20);
  doc.circle(bowX, bowY, 4, 'F');
  doc.setFillColor(255, 245, 190);
  doc.circle(bowX, bowY, 2.5, 'F');

  // 3. Contenu de l'invitation (partie droite)
  const contentCenterX = (W + ribbonW + 10) / 2; // ~129mm

  // Titre "INVITATION"
  doc.setTextColor(136, 19, 55); // Rouge bordeaux / rubis
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.text('I N V I T A T I O N', contentCenterX - 10, 24, { align: 'center' });

  // Ligne rubis sous le titre
  doc.setDrawColor(136, 19, 55);
  doc.setLineWidth(0.6);
  doc.line(contentCenterX - 45, 28, contentCenterX + 25, 28);

  // Texte d'invitation personnalisé ou formule par défaut
  doc.setTextColor(30, 41, 59);
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);

  const customText = (invitationText || '').trim();
  if (customText) {
    const formattedCustomText = customText.replace(/\{name\}|\[nom\]|\[nom du participant\]/gi, fullname || 'Invité');
    const customLines = doc.splitTextToSize(formattedCustomText, 98);
    doc.text(customLines, contentCenterX - 10, 37, { align: 'center', lineHeightFactor: 1.35 });
  } else {
    const intro1 = `À l'occasion de « ${eventTitle} »,`;
    const intro2 = `nous avons l'immense plaisir de vous inviter,`;
    const intro3 = `cher(e) ${fullname || 'Invité d’Honneur'},`;
    const intro4 = `à venir célébrer ce moment de joie et d'exception avec nous.`;

    doc.setFont('times', 'bold');
    doc.text(intro1, contentCenterX - 10, 37, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.text(intro2, contentCenterX - 10, 43, { align: 'center' });
    doc.setFont('times', 'bold');
    doc.setTextColor(136, 19, 55);
    doc.text(intro3, contentCenterX - 10, 49, { align: 'center' });
    doc.setTextColor(30, 41, 59);
    doc.setFont('times', 'normal');
    doc.text(intro4, contentCenterX - 10, 55, { align: 'center' });
  }

  // 4. Badges Date & Heure + Lieu (Fond bordeaux foncé #3f0a14)
  const badgeX = 58;
  const badgeW = 95;

  // Badge Date & Heure
  doc.setFillColor(63, 10, 20);
  doc.roundedRect(badgeX, 64, badgeW, 10.5, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`${dateBadge}   |   ${timeBadge}`, badgeX + badgeW / 2, 71, { align: 'center' });

  // Badge Lieu
  const locStr = eventLocation || 'Lieu communiqué sur invitation';
  doc.setFillColor(63, 10, 20);
  doc.roundedRect(badgeX, 78, badgeW, 10.5, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const locCut = locStr.length > 38 ? locStr.slice(0, 36) + '...' : locStr;
  doc.text(`LIEU : ${locCut.toUpperCase()}`, badgeX + badgeW / 2, 85, { align: 'center' });

  // Phrase d'accueil ou sous-message personnalisé
  doc.setTextColor(71, 85, 105);
  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  const subMsg = (invitationSubtext || '').trim() || 'Votre présence rendra ce moment encore plus spécial.';
  const subLines = doc.splitTextToSize(subMsg, 98);
  doc.text(subLines, contentCenterX - 10, 97, { align: 'center', lineHeightFactor: 1.3 });

  // Formule finale "Soyez les bienvenus" en style calligraphique
  doc.setTextColor(136, 19, 55);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(18);
  doc.text('Soyez les bienvenus', contentCenterX - 10, 114, { align: 'center' });

  // 5. QR Code d'accès officiel à droite
  const qrBoxX = 162;
  const qrBoxY = 46;
  const qrBoxW = 40;
  const qrBoxH = 62;

  // Cadre QR Code
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 3, 3, 'F');
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.4);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 3, 3, 'S');

  const qrData = `ONG DDB - INVITATION OFFICIELLE\nInvité: ${fullname}\nÉvénement: ${eventTitle}\nDate: ${formattedFull}\nLieu: ${eventLocation || 'N/A'}`;
  try {
    const qrDataUri = await getQRCodeDataUri(qrData);
    if (qrDataUri) {
      doc.addImage(qrDataUri, 'PNG', qrBoxX + 4, qrBoxY + 4, 32, 32);
    }
  } catch { /* silent */ }

  // Label sous le QR Code
  doc.setFillColor(63, 10, 20);
  doc.roundedRect(qrBoxX + 4, qrBoxY + 39, 32, 7, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('ACCÈS INVITÉ', qrBoxX + 20, qrBoxY + 43.5, { align: 'center' });

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('À présenter à l’entrée', qrBoxX + 20, qrBoxY + 52, { align: 'center' });

  return doc;
};
