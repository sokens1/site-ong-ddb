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

/** Generate PDF ticket in the browser using jsPDF */
export const generateTicketPDF = async (
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
