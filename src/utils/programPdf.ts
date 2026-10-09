import { jsPDF } from 'jspdf';
import { EventData, EventProgramItem } from '../types/events';

/**
 * Génère et télécharge un PDF élégant et professionnel du programme de l'événement.
 */
export const downloadProgramPdf = async (event: EventData): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // ── Header Background Band ──
  doc.setFillColor(7, 21, 54); // Deep Navy (#071536)
  doc.rect(0, 0, pageWidth, 48, 'F');

  // Decorative Emerald Accent Line
  doc.setFillColor(16, 185, 129); // Emerald (#10b981)
  doc.rect(0, 47, pageWidth, 1.5, 'F');

  // ── Organization & Document Type ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(52, 211, 153); // Emerald 400
  doc.text('ONG DDB · DES DÉCHETS ET DES BÊTES', margin, 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("PROGRAMME OFFICIEL DE L'ÉVÉNEMENT", margin, 24);

  // Event title in header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225); // Slate 300
  const headerTitle = doc.splitTextToSize(event.title || 'Événement', contentWidth - 40);
  doc.text(headerTitle[0] || '', margin, 32);

  // ── Event Metadata Card (Date, Heure, Lieu) ──
  let curY = 56;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, curY, contentWidth, 24, 3, 3, 'FD');

  const mainDate = event.event_date ? new Date(event.event_date) : null;
  const dateStr = mainDate
    ? mainDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date à confirmer';

  const timeStr = event.event_date
    ? new Date(event.event_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  const locStr = event.location || 'Lieu à confirmer';

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont('helvetica', 'bold');
  doc.text('DATE & HEURE', margin + 6, curY + 8);
  doc.text('LIEU DE L’ÉVÉNEMENT', margin + contentWidth / 2, curY + 8);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont('helvetica', 'normal');
  doc.text(`${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}${timeStr ? ` à ${timeStr}` : ''}`, margin + 6, curY + 16);
  doc.text(locStr, margin + contentWidth / 2, curY + 16);

  curY += 32;

  // ── Theme (si présent) ──
  if (event.theme) {
    doc.setFillColor(236, 253, 245); // Emerald 50
    doc.setDrawColor(167, 243, 208); // Emerald 200
    doc.roundedRect(margin, curY, contentWidth, 14, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // Emerald 600
    doc.text('THÈME :', margin + 6, curY + 9);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 78, 59); // Emerald 900
    const themeLines = doc.splitTextToSize(event.theme, contentWidth - 30);
    doc.text(themeLines[0] || '', margin + 24, curY + 9);

    curY += 20;
  }

  // ── Programme Timeline Header ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Déroulement de la journée', margin, curY);

  const stepsCount = (event.program || []).length;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${stepsCount} étape${stepsCount > 1 ? 's' : ''} au programme`, margin + contentWidth, curY, { align: 'right' });

  curY += 6;

  // ── Programme Items ──
  const programList: EventProgramItem[] = event.program || [];

  if (programList.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('Aucun détail de programme disponible pour le moment.', margin, curY + 10);
  } else {
    programList.forEach((item, idx) => {
      // Vérification saut de page si nécessaire
      const estimatedHeight = 24 + (item.description ? 12 : 0) + (item.speaker ? 6 : 0);
      if (curY + estimatedHeight > pageHeight - 25) {
        doc.addPage();
        curY = 20;
      }

      // Card container for step
      const stepH = 18 + (item.description ? 10 : 0) + (item.speaker ? 6 : 0);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, curY, contentWidth, stepH, 2, 2, 'FD');

      // Timeline badge number
      doc.setFillColor(7, 21, 54);
      doc.roundedRect(margin + 4, curY + 4, 8, 8, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(String(idx + 1), margin + 8, curY + 9.5, { align: 'center' });

      // Time badge
      let titleX = margin + 16;
      if (item.time) {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(margin + 16, curY + 4, 22, 6.5, 1, 1, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(5, 150, 105);
        doc.text(item.time, margin + 27, curY + 8.5, { align: 'center' });
        titleX = margin + 42;
      }

      // Step Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(item.title || 'Étape', contentWidth - (titleX - margin) - 6);
      doc.text(titleLines[0] || '', titleX, curY + 8.5);

      let innerY = curY + 13;

      // Speaker if present
      if (item.speaker) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Intervenant(e) : ${item.speaker}`, margin + 16, innerY);
        innerY += 5;
      }

      // Description if present
      if (item.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const descLines = doc.splitTextToSize(item.description, contentWidth - 22);
        doc.text(descLines.slice(0, 2).join(' '), margin + 16, innerY);
      }

      curY += stepH + 4;
    });
  }

  // ── Footer ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('ONG DDB · www.ong-ddb.org · Contact & Billetterie officielle', margin, pageHeight - 7);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  // Safe file naming
  const slug = (event.title || 'evenement')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 35);

  doc.save(`programme-${slug}.pdf`);
};
