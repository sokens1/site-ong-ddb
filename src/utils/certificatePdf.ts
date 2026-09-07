import { jsPDF } from 'jspdf';
import { fetchImageAsBase64 } from './ticketPdf';

export type CertificateTemplate = 'classic' | 'modern';

/**
 * Génère un certificat de participation en PDF (A4 paysage).
 * Deux styles : "classic" (formel, cadre doré) et "modern" (bandeau coloré).
 */
export const generateCertificatePDF = async (
  fullname: string,
  eventTitle: string,
  eventDate: string,
  template: CertificateTemplate = 'classic',
  logoUrl?: string,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210;

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const logo = logoUrl ? await fetchImageAsBase64(logoUrl).catch(() => '') : '';

  if (template === 'modern') {
    // ── Modèle Moderne fidèle à la maquette : cadre géométrique bleu, rosette à rubans, signatures ──
    const PRIMARY_BLUE: [number, number, number] = [16, 84, 156];
    const STEEL_BLUE: [number, number, number] = [100, 148, 192];
    const LIGHT_BLUE: [number, number, number] = [142, 185, 218];
    const DARK_SLATE: [number, number, number] = [30, 41, 59];
    const MUTED_GRAY: [number, number, number] = [100, 116, 139];

    // Fond blanc
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');

    // 1. Bandeau supérieur bleu acier
    doc.setFillColor(...STEEL_BLUE);
    doc.rect(0, 0, W, 5, 'F');

    // 2. Cadre rectangulaire intérieur fin
    doc.setDrawColor(...STEEL_BLUE);
    doc.setLineWidth(0.7);
    doc.rect(10, 10, W - 20, H - 20, 'S');

    // 3. Motifs géométriques coin haut-gauche
    doc.setFillColor(...PRIMARY_BLUE);
    doc.rect(0, 0, 13, 28, 'F');
    doc.setFillColor(...LIGHT_BLUE);
    doc.rect(16, 13, 10, 10, 'F');
    doc.setFillColor(...PRIMARY_BLUE);
    doc.rect(29, 0, 6.5, 9, 'F');

    // 4. Bande verticale bleu foncé côté gauche
    doc.setFillColor(...PRIMARY_BLUE);
    doc.rect(0, H - 85, 7, 85, 'F');

    // 5. Motifs géométriques coin bas-droit
    doc.setFillColor(...PRIMARY_BLUE);
    doc.rect(W - 48, H - 18, 48, 18, 'F');
    doc.setFillColor(...LIGHT_BLUE);
    doc.rect(W - 61, H - 27, 10, 10, 'F');
    doc.setFillColor(...PRIMARY_BLUE);
    doc.rect(W - 7, H - 42, 7, 42, 'F');

    // 6. Rosette d'honneur agrandie (médaille avec rubans à encoches) — haut-droit
    const rx = W - 42, ry = 38;

    // Ruban gauche avec encoche en V
    doc.setFillColor(...PRIMARY_BLUE);
    const leftRibbon = [
      { op: 'm', c: [rx - 9, ry + 7] },
      { op: 'l', c: [rx - 16, ry + 44] },
      { op: 'l', c: [rx - 8, ry + 36] },
      { op: 'l', c: [rx - 1, ry + 44] },
      { op: 'l', c: [rx - 1, ry + 9] },
    ];
    doc.path(leftRibbon);
    doc.fill();

    // Ruban droit avec encoche en V
    const rightRibbon = [
      { op: 'm', c: [rx + 1, ry + 9] },
      { op: 'l', c: [rx + 1, ry + 44] },
      { op: 'l', c: [rx + 8, ry + 36] },
      { op: 'l', c: [rx + 16, ry + 44] },
      { op: 'l', c: [rx + 9, ry + 7] },
    ];
    doc.path(rightRibbon);
    doc.fill();

    // Rosette plissée (24 pointes en étoile)
    const pointsCount = 24;
    const outerRadius = 15;
    const innerRadius = 12.5;
    const rosettePoints: { op: string; c: number[] }[] = [];

    for (let i = 0; i < pointsCount * 2; i++) {
      const angle = (i * Math.PI) / pointsCount - Math.PI / 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const px = rx + r * Math.cos(angle);
      const py = ry + r * Math.sin(angle);
      if (i === 0) {
        rosettePoints.push({ op: 'm', c: [px, py] });
      } else {
        rosettePoints.push({ op: 'l', c: [px, py] });
      }
    }
    doc.setFillColor(...PRIMARY_BLUE);
    doc.path(rosettePoints);
    doc.fill();

    // Disque central médaille
    doc.setFillColor(12, 64, 125);
    doc.circle(rx, ry, 11, 'F');
    doc.setFillColor(24, 100, 180);
    doc.circle(rx, ry, 8, 'F');

    // Logo éventuel de l'organisation
    if (logo) {
      try { doc.addImage(logo, 'PNG', 18, 20, 20, 20); } catch { /* silent */ }
    }

    // ── Textes du certificat en français (agrandis et descendus) ──
    // 1. Grand titre
    doc.setTextColor(...PRIMARY_BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(48);
    doc.text('CERTIFICAT', W / 2, 64, { align: 'center' });

    // 2. Sous-titre
    doc.setTextColor(...DARK_SLATE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(17);
    doc.text('DE RECONNAISSANCE', W / 2, 78, { align: 'center' });

    // 3. Formule de présentation
    doc.setTextColor(...MUTED_GRAY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('EST DÉCERNÉ À :', W / 2, 98, { align: 'center' });

    // 4. Nom du participant (élégant style signature, bien agrandi)
    doc.setTextColor(15, 23, 42);
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(44);
    doc.text(fullname || 'Nom du participant', W / 2, 122, { align: 'center' });

    // 5. Texte d'appréciation / accomplissement (agrandi et descendu)
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    const bodyLines = doc.splitTextToSize(
      `Pour ses réalisations et sa participation active aux activités de « ${eventTitle} »${formattedDate ? ` organisées le ${formattedDate}` : ''}.`,
      W - 90,
    );
    doc.text(bodyLines, W / 2, 142, { align: 'center', lineHeightFactor: 1.45 });

    // 6. Signatures (descendues et agrandies)
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.45);
    doc.line(48, 175, 118, 175);
    doc.line(179, 175, 249, 175);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Isabel Mercado', 83, 183, { align: 'center' });
    doc.text('Adora Montminy', 214, 183, { align: 'center' });

    doc.setTextColor(...MUTED_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('SUPERVISEUR', 83, 189, { align: 'center' });
    doc.text('VICE-PRÉSIDENT', 214, 189, { align: 'center' });

    return doc;
  }

  // ── Style classique : fond ivoire, double cadre doré, police serif ──
  doc.setFillColor(253, 252, 247);
  doc.rect(0, 0, W, H, 'F');

  doc.setDrawColor(180, 148, 60);
  doc.setLineWidth(1.4);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.4);
  doc.rect(12, 12, W - 24, H - 24);

  // Coins décoratifs
  doc.setDrawColor(180, 148, 60);
  doc.setLineWidth(0.6);
  [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]].forEach(([x, y]) => {
    doc.circle(x, y, 2.2, 'S');
  });

  if (logo) {
    try { doc.addImage(logo, 'PNG', W / 2 - 12, 18, 24, 24); } catch { /* silent */ }
  }

  doc.setTextColor(120, 96, 40);
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('ONG DÉVELOPPEMENT DURABLE ET BIEN-ÊTRE', W / 2, 50, { align: 'center' });

  doc.setTextColor(30, 41, 59);
  doc.setFont('times', 'bold');
  doc.setFontSize(32);
  doc.text('CERTIFICAT DE PARTICIPATION', W / 2, 68, { align: 'center' });

  doc.setDrawColor(180, 148, 60);
  doc.setLineWidth(0.5);
  doc.line(W / 2 - 45, 74, W / 2 + 45, 74);

  doc.setTextColor(71, 85, 105);
  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  doc.text('Le présent certificat est décerné à', W / 2, 96, { align: 'center' });

  doc.setTextColor(120, 96, 40);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(30);
  doc.text(fullname || 'Nom du participant', W / 2, 116, { align: 'center' });

  doc.setTextColor(51, 65, 85);
  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  const bodyLines = doc.splitTextToSize(
    `pour sa participation active à l'événement « ${eventTitle} »${formattedDate ? `, tenu le ${formattedDate}` : ''}.`,
    W - 90,
  );
  doc.text(bodyLines, W / 2, 136, { align: 'center' });

  doc.setDrawColor(180, 148, 60);
  doc.setLineWidth(0.3);
  doc.line(W / 2 - 40, 172, W / 2 + 40, 172);
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text('La Direction — ONG DDB', W / 2, 179, { align: 'center' });

  return doc;
};
