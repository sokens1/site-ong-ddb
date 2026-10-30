import { jsPDF } from 'jspdf';
import { fetchImageAsBase64 } from './ticketPdf';

export type CertificateTemplate = 'classic' | 'modern' | 'dje';

export interface CertificateConfig {
  title?: string;
  subtitle?: string;
  text?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  /** Optional signature image URL for 1st signatory */
  signatorySignature?: string;
  /** DJE template — second signatory (bottom right) */
  signatory2Name?: string;
  signatory2Title?: string;
  /** Optional signature image URL for 2nd signatory */
  signatory2Signature?: string;
  /** DJE template — participant quality / role (e.g. "intervenant", "participant") */
  participantQuality?: string;
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
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const W = 297, H = 210;

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  // 1-3. Chargement parallèle (avec cache mémoire dans fetchImageAsBase64) des logos et signatures
  const rawOrgUrls = (organizerLogos || []).filter(u => typeof u === 'string' && u.trim().length > 0);
  const [eventLogoBase64, rawOrgBase64List, sig1Base64, sig2Base64] = await Promise.all([
    logoUrl ? fetchImageAsBase64(logoUrl).catch(() => '') : Promise.resolve(''),
    rawOrgUrls.length > 0
      ? Promise.all(rawOrgUrls.map(u => fetchImageAsBase64(u).catch(() => '')))
      : Promise.resolve([] as string[]),
    config?.signatorySignature
      ? fetchImageAsBase64(config.signatorySignature).catch(() => '')
      : Promise.resolve(''),
    config?.signatory2Signature
      ? fetchImageAsBase64(config.signatory2Signature).catch(() => '')
      : Promise.resolve(''),
  ]);
  const orgLogosBase64 = rawOrgBase64List.filter(Boolean);

  // ══════════════════════════════════════════════════════════════════════════
  // ── Style 3 (DJE) : Modèle élégant guilloché — DJE 2e édition ────────────
  // Palette : Bleu marine #041c72 · Vert institutionnel #087B42 · Blanc crème #FFFEFB
  // Typographie : Cinzel (serif institutionnel), Cormorant Garamond (corps élégant)
  // Dimensions A4 paysage : 297 × 210 mm
  // ══════════════════════════════════════════════════════════════════════════
  if (template === 'dje') {
    const DJE_NAVY: [number, number, number] = [4, 28, 114];      // #041c72
    const DJE_GREEN: [number, number, number] = [8, 123, 66];     // #087B42
    const DJE_CREAM: [number, number, number] = [255, 254, 251];  // #FFFEFB
    const DJE_SLATE: [number, number, number] = [58, 69, 102];    // #3A4566
    const DJE_TEXT: [number, number, number] = [28, 37, 65];      // #1C2541

    // ── Fond crème ──
    doc.setFillColor(...DJE_CREAM);
    doc.rect(0, 0, W, H, 'F');

    // ── Cadre extérieur bleu épais (18px = 4.76mm, border 10px = 2.65mm) ──
    doc.setDrawColor(...DJE_NAVY);
    doc.setLineWidth(2.65);
    doc.rect(6.1, 6.1, W - 12.2, H - 12.2, 'S');

    // ── Cadre vert fin intérieur (36px = 9.52mm, border 1.5px = 0.40mm) ──
    doc.setDrawColor(...DJE_GREEN);
    doc.setLineWidth(0.45);
    doc.rect(9.6, 9.6, W - 19.2, H - 19.2, 'S');

    // ── Cadre bleu très fin intérieur (42px = 11.11mm, border 0.75px = 0.22mm) ──
    doc.setDrawColor(...DJE_NAVY);
    doc.setLineWidth(0.22);
    doc.setGState(new (doc as any).GState({ opacity: 0.6 }));
    doc.rect(11.2, 11.2, W - 22.4, H - 22.4, 'S');
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    // ── Ornements de coins (fidèles au SVG : équerre verte sur cadre 9.6mm, équerre bleue sur 11.2mm, losange vert) ──
    const drawCornerOrnament = (gx: number, gy: number, sx: number, sy: number) => {
      // Grande équerre verte sur le coin du cadre vert (9.6mm)
      doc.setDrawColor(...DJE_GREEN);
      doc.setLineWidth(0.6);
      doc.line(gx, gy, gx + sx * 6.4, gy);
      doc.line(gx, gy, gx, gy + sy * 6.4);

      // Petite équerre bleue sur le coin du cadre bleu fin (11.2mm = gx + sx * 1.6)
      const bx = gx + sx * 1.6;
      const by = gy + sy * 1.6;
      doc.setDrawColor(...DJE_NAVY);
      doc.setLineWidth(0.3);
      doc.line(bx, by, bx + sx * 6.4, by);
      doc.line(bx, by, bx, by + sy * 6.4);

      // Losange vert centré sur le coin (gx, gy)
      const lr = 1.85;
      doc.setFillColor(...DJE_GREEN);
      const diamond = [
        { op: 'm', c: [gx, gy - lr] },
        { op: 'l', c: [gx + lr, gy] },
        { op: 'l', c: [gx, gy + lr] },
        { op: 'l', c: [gx - lr, gy] },
        { op: 'h', c: [] },
      ];
      doc.path(diamond);
      doc.fill();
    };

    drawCornerOrnament(9.6, 9.6, 1, 1);             // haut-gauche
    drawCornerOrnament(W - 9.6, 9.6, -1, 1);        // haut-droit
    drawCornerOrnament(9.6, H - 9.6, 1, -1);        // bas-gauche
    drawCornerOrnament(W - 9.6, H - 9.6, -1, -1);   // bas-droit

    // ── Logos en haut (centrés, proportions naturelles préservées + dimensions en cache) ──
    const getImgDims = (b64: string): Promise<{ nw: number; nh: number }> => {
      const dimsCache: Map<string, Promise<{ nw: number; nh: number }>> =
        ((globalThis as any).__ddbCertDimsCache ||= new Map());
      const cached = dimsCache.get(b64);
      if (cached) return cached;
      const p = new Promise<{ nw: number; nh: number }>(res => {
        const img = new Image();
        img.onload = () => res({ nw: img.naturalWidth || 1, nh: img.naturalHeight || 1 });
        img.onerror = () => res({ nw: 1, nh: 1 });
        img.src = b64;
      });
      dimsCache.set(b64, p);
      return p;
    };

    let djeLogos: string[] = [];
    if (orgLogosBase64.length === 0) {
      const defaultUrls = [
        '/certificates/logo-ddb.png',
        '/certificates/logo-dje.png',
        '/certificates/logo-wila.png',
      ];
      const defaults = (await Promise.all(defaultUrls.map(u => fetchImageAsBase64(u).catch(() => '')))).filter(Boolean);
      if (eventLogoBase64 && defaults.length === 3) {
        djeLogos = [defaults[0], eventLogoBase64, defaults[2]];
      } else {
        djeLogos = defaults;
      }
    } else if (orgLogosBase64.length === 2) {
      const centerLogo = eventLogoBase64 || await fetchImageAsBase64('/certificates/logo-dje.png').catch(() => '');
      djeLogos = centerLogo ? [orgLogosBase64[0], centerLogo, orgLogosBase64[1]] : orgLogosBase64;
    } else {
      djeLogos = orgLogosBase64.slice(0, 4);
    }

    if (djeLogos.length > 0) {
      const dims = await Promise.all(djeLogos.map(getImgDims));
      const logoSpacing = 12;
      const logoY = 17;
      const items = djeLogos.map((b64, idx) => {
        const { nw, nh } = dims[idx];
        const ratio = nw / nh;
        // Hauteur 17mm pour les logos carrés/verticaux, 18.5mm pour un logo central large
        const h = ratio > 1.35 ? 18.5 : 16.5;
        const w = Math.min(h * ratio, 42);
        return { b64, w, h };
      });
      const totalLogosW = items.reduce((acc, it) => acc + it.w, 0) + logoSpacing * (items.length - 1);
      let curX = (W - totalLogosW) / 2;
      const maxH = Math.max(...items.map(it => it.h));
      for (const it of items) {
        try {
          const yOffset = logoY + (maxH - it.h) / 2;
          doc.addImage(it.b64, 'PNG', curX, yOffset, it.w, it.h, undefined, 'FAST');
        } catch { /* silent */ }
        curX += it.w + logoSpacing;
      }
    }

    // ── CERTIFICAT (Times bold, centré avec précision sans bug charSpace) ──
    const rawMainTitle = (config?.title?.trim() || 'CERTIFICAT').toUpperCase();
    const spacedTitle = rawMainTitle.length <= 14 ? rawMainTitle.split('').join(' ') : rawMainTitle;
    doc.setTextColor(...DJE_NAVY);
    doc.setFont('times', 'bold');
    doc.setFontSize(rawMainTitle.length > 16 ? 30 : 38);
    doc.text(spacedTitle, W / 2, 53, { align: 'center' });

    // ── Ligne décorative verte avec "DE PARTICIPATION" ──
    const subtitleY = 61.5;
    const lineLen = 24;
    const lineGap = 5;
    const rawSubtitle = (config?.subtitle?.trim() || 'DE PARTICIPATION').toUpperCase();
    const spacedSubtitle = rawSubtitle.split('').join(' ');
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    const subW = doc.getTextWidth(spacedSubtitle);
    const leftLineEnd = W / 2 - subW / 2 - lineGap;
    const rightLineStart = W / 2 + subW / 2 + lineGap;

    doc.setDrawColor(...DJE_GREEN);
    doc.setLineWidth(0.45);
    doc.line(leftLineEnd - lineLen, subtitleY - 1.1, leftLineEnd, subtitleY - 1.1);
    doc.setTextColor(...DJE_GREEN);
    doc.text(spacedSubtitle, W / 2, subtitleY, { align: 'center' });
    doc.line(rightLineStart, subtitleY - 1.1, rightLineStart + lineLen, subtitleY - 1.1);

    // ── "Ce certificat est décerné à" ──
    doc.setTextColor(...DJE_SLATE);
    doc.setFont('times', 'italic');
    doc.setFontSize(14);
    doc.text('Ce certificat est décerné à', W / 2, 76, { align: 'center' });

    // ── Nom du participant (Times bold, grand) ──
    const participantName = fullname || 'Nom et Prénom';
    doc.setTextColor(...DJE_NAVY);
    doc.setFont('times', 'bold');
    doc.setFontSize(28);
    doc.text(participantName, W / 2, 90, { align: 'center' });

    // Ligne verte sous le nom
    const nameW = doc.getTextWidth(participantName);
    const nameLineLen = Math.max(nameW + 24, 110);
    doc.setDrawColor(...DJE_GREEN);
    doc.setLineWidth(0.55);
    doc.line(W / 2 - nameLineLen / 2, 94, W / 2 + nameLineLen / 2, 94);

    // ── Corps du texte ──
    const quality = config?.participantQuality?.trim() || '';
    let bodyText: string;
    if (config?.text?.trim()) {
      bodyText = formatCertificateBodyText(config.text, fullname, eventTitle, formattedDate, '')
        .replace(/\{qualite\}/gi, quality)
        .replace(/\[qualite\]/gi, quality);
    } else {
      const qualityPart = quality ? `pour sa participation en qualité de ${quality} ` : 'pour sa participation ';
      bodyText = `${qualityPart}à la 2ème édition du Déjeuner Environnemental (DJE), placée sous le thème « Le leadership féminin comme levier d'innovation dans la logistique urbaine et durable au Gabon », organisée le ${formattedDate || '30 octobre 2026'} par l'ONG Développement Durable et Bien-être, en partenariat avec Women in Logistics Africa (WILA).`;
    }

    doc.setTextColor(...DJE_TEXT);
    doc.setFont('times', 'normal');
    doc.setFontSize(13);
    const bodyLines = doc.splitTextToSize(bodyText, W - 76);
    doc.text(bodyLines, W / 2, 105, { align: 'center', lineHeightFactor: 1.48 });

    // ── SIGNATURES (bas de page) ──
    const sigY = 170;
    const sig1Name = config?.signatoryName?.trim() || 'M. ONDENO Franck';
    const sig1Title = config?.signatoryTitle?.trim() || 'Président de l\'ONG Développement Durable et Bien-être';
    const sig2Name = config?.signatory2Name?.trim() || 'Mme Pauline WHITE';
    const sig2Title = config?.signatory2Title?.trim() || 'Présidente de Women in Logistics Africa — Gabon';

    // Signature image 1 (optionnelle, au-dessus de la ligne gauche)
    if (sig1Base64) {
      try {
        doc.addImage(sig1Base64, 'PNG', 80 - 20, sigY - 19, 40, 17, undefined, 'FAST');
      } catch { /* silent */ }
    }

    // Ligne sig 1 (gauche)
    doc.setDrawColor(...DJE_NAVY);
    doc.setLineWidth(0.35);
    doc.line(42, sigY, 118, sigY);
    doc.setTextColor(...DJE_NAVY);
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.text(sig1Name, 80, sigY + 5.5, { align: 'center' });
    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...DJE_SLATE);
    const sig1TitleLines = doc.splitTextToSize(sig1Title, 80);
    doc.text(sig1TitleLines, 80, sigY + 10.5, { align: 'center', lineHeightFactor: 1.3 });

    // Signature image 2 (optionnelle, au-dessus de la ligne droite)
    if (sig2Base64) {
      try {
        doc.addImage(sig2Base64, 'PNG', 217 - 20, sigY - 19, 40, 17, undefined, 'FAST');
      } catch { /* silent */ }
    }

    // Ligne sig 2 (droite)
    doc.setDrawColor(...DJE_NAVY);
    doc.setLineWidth(0.35);
    doc.line(179, sigY, 255, sigY);
    doc.setTextColor(...DJE_NAVY);
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.text(sig2Name, 217, sigY + 5.5, { align: 'center' });
    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...DJE_SLATE);
    const sig2TitleLines = doc.splitTextToSize(sig2Title, 80);
    doc.text(sig2TitleLines, 217, sigY + 10.5, { align: 'center', lineHeightFactor: 1.3 });

    // ── Sceau central guilloché avec rubans (fidèle au SVG Certificat.dc.html) ──
    const sealX = W / 2;
    const sealY = 158;
    const outerR = 14;
    const innerR = 12.2;
    const points = 24;

    // Rubans bleu marine sous le sceau
    doc.setFillColor(...DJE_NAVY);
    doc.path([
      { op: 'm', c: [sealX - 5, sealY + 9] },
      { op: 'l', c: [sealX - 8.5, sealY + 19] },
      { op: 'l', c: [sealX - 4, sealY + 16.5] },
      { op: 'l', c: [sealX - 1.5, sealY + 19.5] },
      { op: 'l', c: [sealX - 0.5, sealY + 10] },
      { op: 'h', c: [] },
    ]);
    doc.fill();
    doc.path([
      { op: 'm', c: [sealX + 5, sealY + 9] },
      { op: 'l', c: [sealX + 8.5, sealY + 19] },
      { op: 'l', c: [sealX + 4, sealY + 16.5] },
      { op: 'l', c: [sealX + 1.5, sealY + 19.5] },
      { op: 'l', c: [sealX + 0.5, sealY + 10] },
      { op: 'h', c: [] },
    ]);
    doc.fill();

    // Étoile 24 branches verte
    const sealPts: { op: string; c: number[] }[] = [];
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const px = sealX + r * Math.cos(angle);
      const py = sealY + r * Math.sin(angle);
      sealPts.push({ op: i === 0 ? 'm' : 'l', c: [px, py] });
    }
    sealPts.push({ op: 'h', c: [] });
    doc.setFillColor(...DJE_GREEN);
    doc.path(sealPts);
    doc.fill();

    // Cercles blancs internes
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.35);
    doc.circle(sealX, sealY, 10.8, 'S');
    doc.setLineWidth(0.2);
    doc.circle(sealX, sealY, 6.8, 'S');

    // "DJE 2026" dans le sceau
    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(9.5);
    doc.text('DJE', sealX, sealY + 0.8, { align: 'center' });
    doc.setFontSize(6);
    doc.text('2026', sealX, sealY + 4, { align: 'center' });

    // "Fait le ..." sous le sceau
    doc.setTextColor(...DJE_SLATE);
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(9);
    doc.text(formattedDate ? `Fait le ${formattedDate}` : 'Fait le 30 octobre 2026', sealX, sealY + 24, { align: 'center' });

    return doc;
  }

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
        doc.addImage(eventLogoBase64, 'PNG', W - 72, 16, 24, 24, undefined, 'FAST');
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
    const signatory2Name = config?.signatory2Name?.trim() || 'Adora Montminy';
    const signatory2Title = config?.signatory2Title?.trim() || 'VICE-PRÉSIDENT';

    if (sig1Base64) {
      try { doc.addImage(sig1Base64, 'PNG', 83 - 18, 172 - 17, 36, 15, undefined, 'FAST'); } catch { /* silent */ }
    }
    if (sig2Base64) {
      try { doc.addImage(sig2Base64, 'PNG', 214 - 18, 172 - 17, 36, 15, undefined, 'FAST'); } catch { /* silent */ }
    }

    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.45);
    doc.line(48, 172, 118, 172);
    doc.line(179, 172, 249, 172);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(signatory1Name, 83, 179, { align: 'center' });
    doc.text(signatory2Name, 214, 179, { align: 'center' });

    doc.setTextColor(...MUTED_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(signatory1Title, 83, 185, { align: 'center' });
    doc.text(signatory2Title, 214, 185, { align: 'center' });

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
          doc.addImage(orgLogosBase64[i], 'PNG', startX + i * (logoW + gap), startY, logoW, logoH, undefined, 'FAST');
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
      doc.addImage(eventLogoBase64, 'PNG', W - 52, 14, 28, 28, undefined, 'FAST');
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
        doc.addImage(orgLogosBase64[i], 'PNG', centerZoneX + i * (orgW + gap), orgY, orgW, orgH, undefined, 'FAST');
      } catch { /* silent */ }
    }
  }

  // ── 9. Signature officielle en bas à droite ──
  const sigX = W - 78;
  const sigY = 162;

  if (sig1Base64) {
    try {
      doc.addImage(sig1Base64, 'PNG', sigX + 11, sigY - 11, 40, 16, undefined, 'FAST');
    } catch { /* silent */ }
  } else {
    // Courbe signature élégante par défaut
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
  }

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
