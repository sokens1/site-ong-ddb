import { jsPDF } from 'jspdf';
import { fetchImageAsBase64 } from './ticketPdf';

export type CertificateTemplate = 'classic' | 'modern';

export interface CertificateConfig {
  title?: string;
  subtitle?: string;
  text?: string;
  signatoryName?: string;
  signatoryTitle?: string;
}

/**
 * Formate le texte d'appréciation du certificat avec les variables de substitution.
 */
const formatCertificateBodyText = (
  templateText: string | undefined,
  fullname: string,
  eventTitle: string,
  formattedDate: string,
  fallbackDefault: string,
): string => {
  const base = templateText?.trim() || fallbackDefault;
  return base
    .replace(/\{name\}/gi, fullname || 'Nom du participant')
    .replace(/\[nom\]/gi, fullname || 'Nom du participant')
    .replace(/\{event\}/gi, eventTitle || "l'événement")
    .replace(/\[evenement\]/gi, eventTitle || "l'événement")
    .replace(/\{date\}/gi, formattedDate || '')
    .replace(/\[date\]/gi, formattedDate || '');
};

/**
 * Génère un certificat de participation en PDF (A4 paysage).
 * Deux styles :
 * - "classic" : Design Bauhaus géométrique (vert émeraude, bleu nuit, menthe, ambre, corail).
 * - "modern" : Cadre bleu avec rosette et rubans d'honneur.
 *
 * Supporte :
 * - Logo de l'événement en haut à droite
 * - Logos des organisateurs en bas
 * - Configuration personnalisée (titre, sous-titre, texte d'appréciation, signataire)
 */
export const generateCertificatePDF = async (
  fullname: string,
  eventTitle: string,
  eventDate: string,
  template: CertificateTemplate = 'classic',
  logoUrl?: string,
  organizerLogos?: string[],
  config?: CertificateConfig,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210;

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  // 1. Logo principal de l'événement (haut à droite)
  const eventLogoBase64 = logoUrl ? await fetchImageAsBase64(logoUrl).catch(() => '') : '';

  // 2. Logos des organisateurs (en bas)
  const rawOrgUrls = (organizerLogos || []).filter(u => typeof u === 'string' && u.trim().length > 0);
  const orgLogosBase64 = rawOrgUrls.length > 0
    ? (await Promise.all(rawOrgUrls.map(u => fetchImageAsBase64(u).catch(() => '')))).filter(Boolean)
    : [];

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

    // 6. Rosette d'honneur (médaille avec rubans à encoches) — haut-droit
    const rx = W - 36, ry = 34;

    // Ruban gauche avec encoche en V
    doc.setFillColor(...PRIMARY_BLUE);
    const leftRibbon = [
      { op: 'm', c: [rx - 8, ry + 6] },
      { op: 'l', c: [rx - 14, ry + 38] },
      { op: 'l', c: [rx - 7, ry + 32] },
      { op: 'l', c: [rx - 1, ry + 38] },
      { op: 'l', c: [rx - 1, ry + 8] },
    ];
    doc.path(leftRibbon);
    doc.fill();

    // Ruban droit avec encoche en V
    const rightRibbon = [
      { op: 'm', c: [rx + 1, ry + 8] },
      { op: 'l', c: [rx + 1, ry + 38] },
      { op: 'l', c: [rx + 7, ry + 32] },
      { op: 'l', c: [rx + 14, ry + 38] },
      { op: 'l', c: [rx + 8, ry + 6] },
    ];
    doc.path(rightRibbon);
    doc.fill();

    // Rosette plissée (24 pointes en étoile)
    const pointsCount = 24;
    const outerRadius = 13;
    const innerRadius = 11;
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
    doc.circle(rx, ry, 9.5, 'F');
    doc.setFillColor(24, 100, 180);
    doc.circle(rx, ry, 7, 'F');

    // ── Logo de l'événement en haut à droite ──
    if (eventLogoBase64) {
      try {
        doc.addImage(eventLogoBase64, 'PNG', W - 72, 16, 24, 24);
      } catch { /* silent */ }
    }

    // ── Textes du certificat ──
    const mainTitle = config?.title?.trim() || 'CERTIFICAT';
    const subTitle = config?.subtitle?.trim() || 'DE RECONNAISSANCE';

    // 1. Grand titre
    doc.setTextColor(...PRIMARY_BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(mainTitle.length > 20 ? 36 : 46);
    doc.text(mainTitle, W / 2, 64, { align: 'center' });

    // 2. Sous-titre
    doc.setTextColor(...DARK_SLATE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.text(subTitle, W / 2, 78, { align: 'center' });

    // 3. Formule de présentation
    doc.setTextColor(...MUTED_GRAY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('EST DÉCERNÉ À :', W / 2, 96, { align: 'center' });

    // 4. Nom du participant
    doc.setTextColor(15, 23, 42);
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(42);
    doc.text(fullname || 'Nom du participant', W / 2, 118, { align: 'center' });

    // 5. Texte d'appréciation / accomplissement
    const defaultAppreciation = `Pour ses réalisations et sa participation active aux activités de « ${eventTitle} »${formattedDate ? ` organisées le ${formattedDate}` : ''}.`;
    const bodyText = formatCertificateBodyText(config?.text, fullname, eventTitle, formattedDate, defaultAppreciation);

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12.5);
    const bodyLines = doc.splitTextToSize(bodyText, W - 90);
    doc.text(bodyLines, W / 2, 136, { align: 'center', lineHeightFactor: 1.45 });

    // 6. Signatures
    const signatory1Name = config?.signatoryName?.trim() || 'Isabel Mercado';
    const signatory1Title = config?.signatoryTitle?.trim() || 'SUPERVISEUR';

    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.45);
    doc.line(48, 172, 118, 172);
    doc.line(179, 172, 249, 172);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(signatory1Name, 83, 179, { align: 'center' });
    doc.text('Adora Montminy', 214, 179, { align: 'center' });

    doc.setTextColor(...MUTED_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(signatory1Title, 83, 185, { align: 'center' });
    doc.text('VICE-PRÉSIDENT', 214, 185, { align: 'center' });

    // 7. Logos des organisateurs en bas (au centre entre les signatures)
    if (orgLogosBase64.length > 0) {
      const maxLogos = Math.min(orgLogosBase64.length, 4);
      const logoW = 16;
      const logoH = 12;
      const gap = 5;
      const totalW = maxLogos * logoW + (maxLogos - 1) * gap;
      const startX = (W - totalW) / 2;
      const startY = 168;

      doc.setTextColor(...MUTED_GRAY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('ORGANISÉ PAR', W / 2, startY - 2, { align: 'center' });

      for (let i = 0; i < maxLogos; i++) {
        try {
          doc.addImage(orgLogosBase64[i], 'PNG', startX + i * (logoW + gap), startY, logoW, logoH);
        } catch { /* silent */ }
      }
    }

    return doc;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Style 1 (Classic) : Design Bauhaus géométrique (vert & bleu) ─────────
  // Palette : Vert émeraude, Bleu nuit / canard, Menthe vive, Or ambré, Corail doux
  // ══════════════════════════════════════════════════════════════════════════
  const TEAL: [number, number, number] = [13, 148, 136];          // #0d9488
  const DARK_NAVY: [number, number, number] = [15, 76, 92];       // #0f4c5c
  const MINT: [number, number, number] = [16, 185, 129];          // #10b981
  const AMBER: [number, number, number] = [245, 158, 11];         // #f59e0b
  const CORAL: [number, number, number] = [251, 113, 133];        // #fb7185
  const PANEL_BG: [number, number, number] = [248, 250, 248];     // #f8faf8
  const SLATE_DARK: [number, number, number] = [30, 41, 59];      // #1e293b
  const SLATE_MUTED: [number, number, number] = [100, 116, 139];  // #64748b

  // Fond de page blanc
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');

  // Helper pour dessiner un secteur circulaire / quart de cercle fermé
  const drawSector = (cx: number, cy: number, r: number, a1: number, a2: number, color: [number, number, number]) => {
    doc.setFillColor(...color);
    const steps = 24;
    const path: { op: string; c: number[] }[] = [{ op: 'm', c: [cx, cy] }];
    for (let i = 0; i <= steps; i++) {
      const a = a1 + (i / steps) * (a2 - a1);
      path.push({ op: 'l', c: [cx + r * Math.cos(a), cy + r * Math.sin(a)] });
    }
    path.push({ op: 'h', c: [] });
    doc.path(path);
    doc.fill();
  };

  // Helper pour dessiner un demi-cercle fermé
  const drawSemicircle = (cx: number, cy: number, r: number, a1: number, color: [number, number, number]) => {
    drawSector(cx, cy, r, a1, a1 + Math.PI, color);
  };

  // ── 1. Panneau vertical gauche Bauhaus (largeur 76mm, hauteur 186mm) ──
  const panelX = 14;
  const panelY = 12;
  const panelW = 76;
  const panelH = 186;

  doc.setFillColor(...PANEL_BG);
  doc.rect(panelX, panelY, panelW, panelH, 'F');

  // Grille 2 colonnes x 5 rangées
  const colW = panelW / 2; // 38mm
  const rowH = panelH / 5; // 37.2mm

  // RANGÉE 1 (y = panelY)
  drawSector(panelX, panelY, colW, 0, Math.PI / 2, MINT);
  drawSector(panelX + panelW, panelY, colW, Math.PI / 2, Math.PI, TEAL);

  // RANGÉE 2 (y = panelY + rowH)
  drawSemicircle(panelX + colW / 2, panelY + rowH, colW / 2, 0, DARK_NAVY);
  drawSector(panelX + panelW, panelY + rowH, colW, Math.PI / 2, Math.PI, DARK_NAVY);

  // RANGÉE 3 (y = panelY + rowH * 2)
  drawSector(panelX, panelY + rowH * 3, colW, -Math.PI / 2, 0, AMBER);
  drawSemicircle(panelX + colW, panelY + rowH * 2.5, rowH / 2, -Math.PI / 2, DARK_NAVY);

  // RANGÉE 4 (y = panelY + rowH * 3)
  drawSemicircle(panelX + colW / 2, panelY + rowH * 3, colW / 2, 0, MINT);
  drawSector(panelX + colW, panelY + rowH * 4, colW, -Math.PI / 2, 0, CORAL);

  // RANGÉE 5 (y = panelY + rowH * 4)
  drawSector(panelX + colW, panelY + panelH, colW, Math.PI, (3 * Math.PI) / 2, TEAL);
  drawSector(panelX + colW, panelY + panelH, colW, -Math.PI / 2, 0, AMBER);

  // ── 2. Coin supérieur droit : Logo de l'événement et/ou accent géométrique ──
  const topAccX = W - 46;
  const topAccY = 16;
  const topAccR = 18;

  if (eventLogoBase64) {
    // Si un logo officiel d'événement existe, on l'affiche bien grand en haut à droite
    try {
      doc.addImage(eventLogoBase64, 'PNG', W - 52, 14, 28, 28);
    } catch {
      // Fallback accent
      drawSector(topAccX, topAccY + topAccR, topAccR, -Math.PI / 2, 0, MINT);
      drawSector(topAccX + topAccR, topAccY + topAccR, topAccR, Math.PI, (3 * Math.PI) / 2, DARK_NAVY);
    }
  } else {
    // Motifs géométriques décoratifs originaux
    drawSector(topAccX, topAccY + topAccR, topAccR, -Math.PI / 2, 0, MINT);
    drawSector(topAccX + topAccR, topAccY + topAccR, topAccR, Math.PI, (3 * Math.PI) / 2, DARK_NAVY);
  }

  // ── 3. Titre principal du certificat ──
  const contentX = 104;
  doc.setTextColor(...TEAL);
  doc.setFont('helvetica', 'bold');

  const customTitle = config?.title?.trim();
  if (customTitle) {
    const titleLines = doc.splitTextToSize(customTitle, W - contentX - 56);
    doc.setFontSize(titleLines.length > 2 ? 28 : 34);
    let titleY = 40;
    titleLines.forEach((line: string) => {
      doc.text(line, contentX, titleY);
      titleY += 13;
    });
  } else {
    doc.setFontSize(36);
    doc.text('Certificat de', contentX, 42);
    doc.text('participation', contentX, 56);
  }

  // ── 4. "Délivré à" (ou sous-titre personnalisé) ──
  const customSubtitle = config?.subtitle?.trim() || 'Délivré à';
  doc.setTextColor(...SLATE_DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.text(customSubtitle, contentX, 76);

  // ── 5. Nom du participant (style manuscrit / calligraphie avec soulignement) ──
  const participantText = fullname || 'Nom du participant';
  doc.setTextColor(...TEAL);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(40);
  doc.text(participantText, contentX, 98);

  // Ligne de soulignement sous le nom
  const nameWidth = doc.getTextWidth(participantText);
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.7);
  doc.line(contentX, 102, contentX + Math.max(nameWidth + 6, 80), 102);

  // ── 6. Texte d'appréciation / participation ──
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  const defaultAppreciationClassic = `Pour avoir participé à l'événement sur « ${eventTitle} »${formattedDate ? ` organisé le ${formattedDate}` : ''}.`;
  const appreciationText = formatCertificateBodyText(config?.text, fullname, eventTitle, formattedDate, defaultAppreciationClassic);
  const appreciationLines = doc.splitTextToSize(appreciationText, W - contentX - 24);
  doc.text(appreciationLines, contentX, 118, { lineHeightFactor: 1.4 });

  // ── 7. Badge Date en bas à gauche du bloc texte (Demi-cercle bicolore + Pill badge) ──
  const badgeX = contentX + 4;
  const badgeY = 158;
  const badgeR = 13;

  drawSector(badgeX + badgeR, badgeY, badgeR, Math.PI, (3 * Math.PI) / 2, CORAL);
  drawSector(badgeX + badgeR, badgeY, badgeR, -Math.PI / 2, 0, AMBER);

  const pillW = 38;
  const pillH = 11;
  const pillX = badgeX + badgeR - pillW / 2;
  const pillY = badgeY + 2;

  doc.setFillColor(...TEAL);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2.5, 2.5, 'F');

  const dateObj = eventDate ? new Date(eventDate) : new Date();
  const dateMonthYear = (
    !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : 'SESSION OFFICIELLE'
  ).toUpperCase();

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(dateMonthYear, pillX + pillW / 2, pillY + 7.5, { align: 'center' });

  // ── 8. Logos des organisateurs en bas (au centre entre le badge et la signature) ──
  if (orgLogosBase64.length > 0) {
    const maxLogos = Math.min(orgLogosBase64.length, 4);
    const orgW = 16;
    const orgH = 12;
    const gap = 4;
    const totalW = maxLogos * orgW + (maxLogos - 1) * gap;
    // Zone disponible entre pillX + pillW (146mm) et sigX (219mm) -> ~73mm
    const centerZoneX = 148 + (66 - totalW) / 2;
    const orgY = 159;

    doc.setTextColor(...SLATE_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('ORGANISATEURS', centerZoneX + totalW / 2, orgY - 2, { align: 'center' });

    for (let i = 0; i < maxLogos; i++) {
      try {
        doc.addImage(orgLogosBase64[i], 'PNG', centerZoneX + i * (orgW + gap), orgY, orgW, orgH);
      } catch { /* silent */ }
    }
  }

  // ── 9. Signature officielle en bas à droite ──
  const sigX = W - 78;
  const sigY = 162;

  // Courbe signature élégante
  doc.setDrawColor(...DARK_NAVY);
  doc.setLineWidth(0.65);
  const sigCurve = [
    { op: 'm', c: [sigX + 2, sigY + 4] },
    { op: 'c', c: [sigX + 12, sigY - 14, sigX + 18, sigY + 8, sigX + 26, sigY - 6] },
    { op: 'c', c: [sigX + 32, sigY - 16, sigX + 36, sigY + 12, sigX + 46, sigY - 2] },
    { op: 'c', c: [sigX + 50, sigY - 8, sigX + 54, sigY + 6, sigX + 64, sigY + 2] },
  ];
  doc.path(sigCurve);
  doc.stroke();

  // Ligne sous la signature
  doc.setDrawColor(...SLATE_MUTED);
  doc.setLineWidth(0.4);
  doc.line(sigX - 6, sigY + 6, sigX + 68, sigY + 6);

  // Nom et titre du signataire
  const signatoryName = config?.signatoryName?.trim() || 'Alfred Boyer';
  const signatoryTitle = config?.signatoryTitle?.trim() || 'Directeur général';

  doc.setTextColor(...SLATE_DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${signatoryName}, ${signatoryTitle}`, sigX + 31, sigY + 13, { align: 'center' });

  return doc;
};
