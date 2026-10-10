export type PosterTemplate = 'classic' | 'modern';

export interface PosterEventData {
  title: string;
  theme?: string;
  description?: string;
  image_url: string | null;
  logo_url?: string;
  event_date: string;
  event_dates?: { date: string; label?: string }[];
  organizer_logos?: string[];
  partner_logos?: string[];
  location?: string;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const timer = setTimeout(() => reject(new Error('timeout')), 6000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => {
      clearTimeout(timer);
      const img2 = new Image();
      const timer2 = setTimeout(() => reject(new Error('timeout')), 4000);
      img2.onload = () => { clearTimeout(timer2); resolve(img2); };
      img2.onerror = () => { clearTimeout(timer2); reject(new Error('error')); };
      img2.src = src;
    };
    img.src = src;
  });

/**
 * Détoure le fond blanc extérieur d'un logo par propagation (flood-fill) depuis les 4 bords.
 * Ne touche JAMAIS aux éléments blancs internes, contours, textes ou illustrations du logo.
 * Ne modifie aucun pixel de couleur (zéro dégradation).
 */
const removeOuterWhiteBackground = (img: HTMLImageElement): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx || w === 0 || h === 0) return c;

  ctx.drawImage(img, 0, 0);

  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Si le logo est déjà un PNG transparent sur ses coins, on n'y touche pas
    const corners = [
      0,
      (w - 1) * 4,
      ((h - 1) * w) * 4,
      ((h - 1) * w + (w - 1)) * 4,
    ];
    if (corners.some(idx => data[idx + 3] < 15)) {
      return c;
    }

    const isBgWhite = (idx: number) => {
      const a = data[idx + 3];
      if (a < 15) return true;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      return minC >= 242 && (maxC - minC) <= 18;
    };

    if (!corners.some(idx => isBgWhite(idx))) {
      return c;
    }

    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const push = (x: number, y: number) => {
      const p = y * w + x;
      if (!visited[p]) {
        visited[p] = 1;
        const idx = p * 4;
        if (isBgWhite(idx)) {
          queue[tail++] = p;
        }
      }
    };

    // Parcourir tous les bords extérieurs
    for (let x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }

    // Propagation flood-fill
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = Math.floor(p / w);
      const idx = p * 4;

      data[idx + 3] = 0; // Transparence sur le fond externe uniquement

      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // En cas de restriction CORS, fallback propre sans altération
  }

  return c;
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  maxWidth: number, lineHeight: number
) => {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
};

/**
 * Rendu optimisé du nom du participant avec passage à la ligne intelligent (multi-lignes),
 * répartition équilibrée des mots et ajustement dynamique de la taille de police
 * pour que les noms longs ne débordent jamais du visuel.
 */
interface DrawNameOptions {
  maxWidth: number;
  maxFontSize: number;
  minFontSize: number;
  fontFamily: string;
  fontWeight?: string;
  color?: string;
  lineHeightFactor?: number;
}

const drawParticipantName = (
  ctx: CanvasRenderingContext2D,
  rawName: string,
  centerX: number,
  centerY: number,
  options: DrawNameOptions
) => {
  const {
    maxWidth,
    maxFontSize,
    minFontSize,
    fontFamily,
    fontWeight = 'bold',
    color = '#ffffff',
    lineHeightFactor = 1.16,
  } = options;

  const displayName = (rawName || 'MON NOM').trim().toUpperCase();
  const words = displayName.split(/\s+/).filter(Boolean);

  // Découper les mots longs composés (ex: JEAN-BAPTISTE) si besoin
  const tokens: string[] = [];
  for (const w of words) {
    if (w.includes('-') && w.length > 10) {
      const parts = w.split('-');
      parts.forEach((p, idx) => {
        tokens.push(idx < parts.length - 1 ? `${p}-` : p);
      });
    } else {
      tokens.push(w);
    }
  }

  const measureLines = (lines: string[], fontSize: number) => {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    return lines.every(l => ctx.measureText(l).width <= maxWidth);
  };

  let bestLines: string[] = [displayName];
  let chosenFontSize = maxFontSize;

  ctx.font = `${fontWeight} ${maxFontSize}px ${fontFamily}`;
  const singleLineWidth = ctx.measureText(displayName).width;

  // Si le nom est court et tient sans forcer sur une seule ligne
  if (singleLineWidth <= maxWidth && words.length <= 2 && displayName.length <= 16) {
    bestLines = [displayName];
    chosenFontSize = maxFontSize;
  } else {
    // Sinon, on optimise le passage à la ligne (2 lignes idéales pour prénom + nom)
    if (tokens.length >= 2) {
      let bestDiff = Infinity;
      let optimal2: [string, string] = [tokens[0], tokens.slice(1).join(' ')];

      for (let i = 1; i < tokens.length; i++) {
        const l1 = tokens.slice(0, i).join(' ').replace(/- /g, '-');
        const l2 = tokens.slice(i).join(' ').replace(/- /g, '-');
        const diff = Math.abs(l1.length - l2.length);
        if (diff < bestDiff) {
          bestDiff = diff;
          optimal2 = [l1, l2];
        }
      }
      bestLines = optimal2;
    } else {
      bestLines = [displayName];
    }

    // Réduction progressive de la police jusqu'à ce que chaque ligne rentre dans maxWidth
    let size = maxFontSize;
    while (size > minFontSize && !measureLines(bestLines, size)) {
      size -= 2;
    }

    // Si même à minFontSize ça déborde et qu'on a au moins 3 tokens, on passe à 3 lignes
    if (!measureLines(bestLines, size) && tokens.length >= 3) {
      const chunk = Math.ceil(tokens.length / 3);
      const l1 = tokens.slice(0, chunk).join(' ').replace(/- /g, '-');
      const l2 = tokens.slice(chunk, chunk * 2).join(' ').replace(/- /g, '-');
      const l3 = tokens.slice(chunk * 2).join(' ').replace(/- /g, '-');
      bestLines = [l1, l2, l3].filter(Boolean);

      size = maxFontSize;
      while (size > minFontSize && !measureLines(bestLines, size)) {
        size -= 2;
      }
    }

    chosenFontSize = size;
  }

  // Positionnement vertical centré du bloc de texte
  const lineHeight = Math.round(chosenFontSize * lineHeightFactor);
  const totalHeight = (bestLines.length - 1) * lineHeight;
  const startY = centerY - totalHeight / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${chosenFontSize}px ${fontFamily}`;

  bestLines.forEach((line, idx) => {
    ctx.fillText(line, centerX, startY + idx * lineHeight);
  });
  ctx.restore();
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawRotatedRoundedRect = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  width: number, height: number,
  radius: number, angleDeg: number
) => {
  const angle = (angleDeg * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  const x = -width / 2, y = -height / 2;
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.restore();
};

/** Rectangle à coins arrondis indépendamment — sert à composer des formes "arche". */
const drawVariableRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: { tl: number; tr: number; br: number; bl: number },
) => {
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
};

const formatDateStr = (event: PosterEventData) => {
  if (!event.event_date) return '';
  const mainDate = new Date(event.event_date);
  const day = mainDate.getDate();
  const month = mainDate.toLocaleDateString('fr-FR', { month: 'long' });
  const year = mainDate.getFullYear();
  const extras = (event.event_dates || []).filter(d => d.date);
  if (extras.length > 0) {
    const last = extras[extras.length - 1];
    const lastDate = new Date(last.date);
    const lastDay = lastDate.getDate();
    const lastMonth = lastDate.toLocaleDateString('fr-FR', { month: 'long' });
    return month === lastMonth
      ? `DU ${day} AU ${lastDay} ${month.toUpperCase()} ${year}`
      : `DU ${day} ${month.toUpperCase()} AU ${lastDay} ${lastMonth.toUpperCase()} ${year}`;
  }
  return mainDate.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).toUpperCase();
};

/** Heure de début au format "18H00" (vide si la date n'a pas d'heure exploitable). */
const formatTimeStr = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'H');
};

// Rangée centrée — s'adapte mais ne dépasse pas maxW
const drawLogoRow = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, imgs: (HTMLImageElement | null)[], targetH: number, rowCenterY: number) => {
  const gap = 40;
  const maxW = canvas.width - 200;
  const valid = imgs.filter((img): img is HTMLImageElement => img !== null);
  if (!valid.length) return;
  let dims = valid.map(img => ({ w: (img.width / img.height) * targetH, h: targetH }));
  const totalW = dims.reduce((a, d) => a + d.w, 0) + gap * (valid.length - 1);
  if (totalW > maxW) {
    const s = maxW / totalW;
    dims = dims.map(d => ({ w: d.w * s, h: d.h * s }));
  }
  const finalW = dims.reduce((a, d) => a + d.w, 0) + gap * (valid.length - 1);
  let lx = (canvas.width - finalW) / 2;
  for (let i = 0; i < valid.length; i++) {
    const { w, h } = dims[i];
    ctx.drawImage(valid[i], lx, rowCenterY - h / 2, w, h);
    lx += w + gap;
  }
};

// Rangée pleine largeur — occupe toute la largeur disponible
const drawLogoRowStretch = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, imgs: (HTMLImageElement | null)[], refH: number, rowCenterY: number) => {
  const valid = imgs.filter((img): img is HTMLImageElement => img !== null);
  if (!valid.length) return;
  const sidePad = 48, gap = 44;
  const avail = canvas.width - sidePad * 2;
  let dims = valid.map(img => ({ w: (img.width / img.height) * refH, h: refH, img }));
  const rawTotal = dims.reduce((s, d) => s + d.w, 0) + gap * (valid.length - 1);
  const scale = avail / rawTotal;
  dims = dims.map(d => ({ ...d, w: d.w * scale, h: d.h * scale }));
  const maxH = dims.reduce((m, d) => Math.max(m, d.h), 0);
  if (maxH > refH * 1.8) {
    const hs = (refH * 1.8) / maxH;
    dims = dims.map(d => ({ ...d, w: d.w * hs, h: d.h * hs }));
  }
  const finalW = dims.reduce((s, d) => s + d.w, 0) + gap * (valid.length - 1);
  let lx = (canvas.width - finalW) / 2;
  for (const { img, w, h } of dims) {
    ctx.drawImage(img, lx, rowCenterY - h / 2, w, h);
    lx += w + gap;
  }
};

interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  event: PosterEventData;
  name: string;
  bgImg: HTMLImageElement | null;
  logoImg: HTMLImageElement | null;
  userImg: HTMLImageElement | null;
  orgImgs: (HTMLImageElement | null)[];
  partImgs: (HTMLImageElement | null)[];
}

const drawLogosZone = ({ ctx, canvas, orgImgs, partImgs }: DrawArgs) => {
  const hasOrgLogos = orgImgs.some(Boolean);
  const hasPartnerLogos = partImgs.some(Boolean);
  const hasAnyLogos = hasOrgLogos || hasPartnerLogos;
  const hasBothRows = hasOrgLogos && hasPartnerLogos;

  const ROW_PAD = 26, PART_H = 84, ORG_H = 50, SEP_GAP = 20;
  let zoneHeight = 0;
  if (hasBothRows) zoneHeight = ROW_PAD + PART_H + SEP_GAP + ORG_H + ROW_PAD;
  else if (hasAnyLogos) zoneHeight = ROW_PAD + (hasPartnerLogos ? PART_H : ORG_H) + ROW_PAD;

  const whiteZoneY = hasAnyLogos ? canvas.height - zoneHeight : canvas.height + 10;

  if (hasAnyLogos) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, whiteZoneY, canvas.width, canvas.height - whiteZoneY);
    ctx.strokeStyle = '#d1fae5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, whiteZoneY);
    ctx.lineTo(canvas.width, whiteZoneY);
    ctx.stroke();

    if (hasBothRows) {
      drawLogoRowStretch(ctx, canvas, partImgs, PART_H, whiteZoneY + ROW_PAD + PART_H / 2);
      const sepY = whiteZoneY + ROW_PAD + PART_H + SEP_GAP / 2;
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(120, sepY);
      ctx.lineTo(canvas.width - 120, sepY);
      ctx.stroke();
      drawLogoRow(ctx, canvas, orgImgs, ORG_H, whiteZoneY + ROW_PAD + PART_H + SEP_GAP + ORG_H / 2);
    } else if (hasPartnerLogos) {
      drawLogoRowStretch(ctx, canvas, partImgs, PART_H, whiteZoneY + zoneHeight / 2);
    } else {
      drawLogoRow(ctx, canvas, orgImgs, ORG_H, whiteZoneY + zoneHeight / 2);
    }
  }
};

// ─── Template "classic" : vert institutionnel, sticker manuscrit ─────────────
const drawClassic = (args: DrawArgs) => {
  const { ctx, canvas, event, name, bgImg, logoImg, userImg } = args;

  ctx.fillStyle = '#064e3b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (bgImg) {
    const ratio = Math.max(canvas.width / bgImg.width, (canvas.height * 0.75) / bgImg.height);
    const dw = bgImg.width * ratio, dh = bgImg.height * ratio;
    const dx = (canvas.width - dw) / 2;
    ctx.globalAlpha = 0.35;
    ctx.drawImage(bgImg, dx, 0, dw, dh);
    ctx.globalAlpha = 1;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.72);
    grad.addColorStop(0, 'rgba(6,78,59,0)');
    grad.addColorStop(1, 'rgba(6,78,59,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.72);
  }

  if (logoImg) {
    const lh = 148;
    const lw = Math.min((logoImg.width / logoImg.height) * lh, 520);
    const bx = 48, by = 42, bpadH = 32, bpadV = 22;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, bx, by, lw + bpadH * 2, lh + bpadV * 2, 24);
    ctx.fill();
    ctx.drawImage(logoImg, bx + bpadH, by + bpadV, lw, lh);
  }

  // ── Date + heure : badge doré plein, bien contrasté ────────────────────────
  const dateStr = formatDateStr(event);
  const timeStr = formatTimeStr(event.event_date);
  const dateX = canvas.width / 2 + (event.logo_url ? 80 : 0);
  let infoBottomY = 88;
  if (dateStr) {
    const dateLine = timeStr ? `${dateStr}  •  ${timeStr}` : dateStr;
    ctx.font = 'bold 24px "Montserrat", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(dateLine).width;
    ctx.fillStyle = '#facc15';
    drawRoundedRect(ctx, dateX - tw / 2 - 26, infoBottomY, tw + 52, 58, 14);
    ctx.fill();
    ctx.fillStyle = '#064e3b';
    ctx.fillText(dateLine, dateX, infoBottomY + 38);
    infoBottomY += 58 + 14;
  }

  // ── Lieu : pastille claire bien lisible, sous la date ──────────────────────
  if (event.location) {
    ctx.font = 'bold 19px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(event.location).width;
    const locW = Math.min(tw + 52, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    drawRoundedRect(ctx, dateX - locW / 2, infoBottomY, locW, 48, 12);
    ctx.fill();
    ctx.fillStyle = '#064e3b';
    if (tw + 52 > 700) {
      wrapText(ctx, event.location, dateX, infoBottomY + 30, locW - 40, 22);
    } else {
      ctx.fillText(event.location, dateX, infoBottomY + 31);
    }
  }

  const cx = canvas.width / 2, cy = canvas.height / 2 - 110;
  const size = 460, radius = 30, angleDeg = -4;

  if (userImg) {
    drawRotatedRoundedRect(ctx, cx, cy, size + 20, size + 20, radius + 5, angleDeg);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    drawRotatedRoundedRect(ctx, cx, cy, size, size, radius, angleDeg);
    ctx.clip();
    const imgR = Math.max(size / userImg.width, size / userImg.height);
    const dw = userImg.width * imgR, dh = userImg.height * imgR;
    ctx.translate(cx, cy);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.drawImage(userImg, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  } else {
    drawRotatedRoundedRect(ctx, cx, cy, size + 20, size + 20, radius + 5, angleDeg);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
  }

  // "J'y serai" sticker manuscrit
  ctx.save();
  ctx.font = '76px "Dancing Script", cursive';
  const labelText = "J'y serai !";
  const textW = ctx.measureText(labelText).width;
  const padX = 35;
  const tagW = textW + padX * 2;
  const tagH = 92;
  const tagX = 630, tagY = 800;
  ctx.translate(tagX + tagW / 2, tagY + tagH / 2);
  ctx.rotate(-4 * Math.PI / 180);
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, -tagW / 2, -tagH / 2, tagW, tagH, 22);
  ctx.fill();
  ctx.fillStyle = '#064e3b';
  ctx.textAlign = 'center';
  ctx.fillText(labelText, 0, 18);
  ctx.restore();

  // Nom du participant centré (multi-lignes équilibré pour les noms longs)
  drawParticipantName(ctx, name, canvas.width / 2, canvas.height / 2 + 358, {
    maxWidth: 780,
    maxFontSize: 68,
    minFontSize: 34,
    fontFamily: '"Segoe UI", Arial, sans-serif',
    fontWeight: 'bold',
    color: '#ffffff',
    lineHeightFactor: 1.18,
  });

  drawLogosZone(args);
};

// Helper pour dessiner une icône d'horloge réaliste (heure)
const drawClockIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, bg = '#f59e0b') => {
  ctx.save();
  // Cercle de fond
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Cadran d'horloge intérieur blanc
  const dialR = r * 0.74;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, dialR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Repères des 4 points cardinaux (12h, 3h, 6h, 9h)
  ctx.fillStyle = '#64748b';
  const tickR = dialR * 0.78;
  const tickSize = Math.max(2, r * 0.09);
  [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
    const tx = cx + Math.sin(angle) * tickR;
    const ty = cy - Math.cos(angle) * tickR;
    ctx.beginPath();
    ctx.arc(tx, ty, tickSize, 0, Math.PI * 2);
    ctx.fill();
  });

  // Aiguille des heures (courte et épaisse, pointant vers 10h)
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(3, r * 0.16);
  ctx.lineCap = 'round';
  const hourAngle = (10 / 12) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(hourAngle) * (dialR * 0.52), cy - Math.cos(hourAngle) * (dialR * 0.52));
  ctx.stroke();

  // Aiguille des minutes (fine et plus longue, pointant vers 10 min / 2h)
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(2, r * 0.11);
  const minAngle = (2 / 12) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(minAngle) * (dialR * 0.74), cy - Math.cos(minAngle) * (dialR * 0.74));
  ctx.stroke();

  // Pivot central
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2.5, r * 0.12), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

// Helper pour dessiner une icône de calendrier réaliste (date)
const drawCalendarIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, bg = '#dc2626') => {
  ctx.save();
  // Fond rond badge
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Feuillet de calendrier blanc
  const pageW = r * 1.18;
  const pageH = r * 1.12;
  const px = cx - pageW / 2;
  const py = cy - pageH / 2 + r * 0.06;

  // Corps blanc avec coins arrondis
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, px, py, pageW, pageH, 5);
  ctx.fill();

  // En-tête rouge du calendrier
  ctx.save();
  drawRoundedRect(ctx, px, py, pageW, pageH, 5);
  ctx.clip();
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(px, py, pageW, pageH * 0.34);
  ctx.restore();

  // Anneaux / Reliures en haut
  const ringW = Math.max(2.5, r * 0.11);
  const ringH = r * 0.28;
  const ringY = py - ringH * 0.35;
  const r1X = px + pageW * 0.28;
  const r2X = px + pageW * 0.72;
  ctx.fillStyle = '#475569';
  drawRoundedRect(ctx, r1X - ringW / 2, ringY, ringW, ringH, ringW / 2);
  ctx.fill();
  drawRoundedRect(ctx, r2X - ringW / 2, ringY, ringW, ringH, ringW / 2);
  ctx.fill();

  // Grille de jours (cases / points de calendrier)
  const gridStartY = py + pageH * 0.48;
  const colGap = pageW * 0.24;
  const rowGap = pageH * 0.22;
  const dotR = Math.max(1.8, r * 0.08);

  ctx.fillStyle = '#94a3b8';
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      // Marquer une des cases en rouge (jour sélectionné)
      ctx.fillStyle = (row === 0 && col === 1) ? '#dc2626' : '#cbd5e1';
      const gx = px + pageW * 0.26 + col * colGap;
      const gy = gridStartY + row * rowGap;
      ctx.beginPath();
      ctx.arc(gx, gy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
};

// Helper pour dessiner une icône de pointeur / géolocalisation réaliste (lieu)
const drawPinIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, bg = '#2563eb') => {
  ctx.save();
  // Cercle badge
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Forme de Pin / Pointeur de carte en blanc
  const headCy = cy - r * 0.14;
  const headR = r * 0.44;
  const tipY = cy + r * 0.58;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, Math.PI * 0.82, Math.PI * 0.18, false);
  ctx.lineTo(cx, tipY);
  ctx.closePath();
  ctx.fill();

  // Point d'ombre subtil sous la pointe
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, tipY + 2, headR * 0.4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trou / Cercle central du pin (couleur du badge pour transparence apparente)
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, headCy, headR * 0.44, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

/** Étiquette d'info autonome : cercle-icône + libellé + valeur, dans sa propre pastille. */
const drawInfoBadge = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  bg: string,
  drawIcon: (cx: number, cy: number, r: number) => void,
  label: string,
  value: string,
  labelColor: string,
  valueColor: string,
) => {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = bg;
  drawRoundedRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const iconR = h * 0.34;
  const iconCx = x + h / 2;
  const iconCy = y + h / 2;
  drawIcon(iconCx, iconCy, iconR);

  const textX = iconCx + iconR + 18;
  const maxTextW = x + w - textX - 18;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px "Montserrat", "Segoe UI", sans-serif';
  ctx.fillStyle = labelColor;
  ctx.fillText(label.toUpperCase(), textX, y + h * 0.38);

  ctx.font = `900 ${value.length > 20 ? 17 : value.length > 15 ? 19 : 22}px "Montserrat", "Segoe UI", sans-serif`;
  ctx.fillStyle = valueColor;
  let displayValue = value;
  while (ctx.measureText(displayValue).width > maxTextW && displayValue.length > 3) {
    displayValue = displayValue.slice(0, -2);
  }
  if (displayValue !== value) displayValue = displayValue.trimEnd() + '…';
  ctx.fillText(displayValue, textX, y + h * 0.74);
  ctx.restore();
};

// Helper pour dessiner un éclat / soleil rayonnant
const drawSpark = (ctx: CanvasRenderingContext2D, cx: number, cy: number, count: number, len: number) => {
  ctx.save();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI) / (count - 1) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (len * 0.3), cy + Math.sin(angle) * len * 0.3);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
};

// ─── Template "modern" : Forme J'y participe / J'y serai 2 colonnes avec arche photo ──────────────
const drawModern = (args: DrawArgs) => {
  const { ctx, canvas, event, name, bgImg, logoImg, userImg, orgImgs, partImgs } = args;

  // 1. Fond bleu nuit profond avec dégradé subtil
  const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGrad.addColorStop(0, '#071536');
  bgGrad.addColorStop(0.5, '#0a1d4a');
  bgGrad.addColorStop(1, '#030b1e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Vagues décoratives en arrière-plan (bleu royal sombre)
  ctx.save();
  ctx.fillStyle = 'rgba(14, 42, 105, 0.4)';
  ctx.beginPath();
  ctx.arc(canvas.width + 100, canvas.height + 100, 500, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Image d'arrière-plan de l'événement en surimpression douce en haut
  if (bgImg) {
    const ratio = Math.max(canvas.width / bgImg.width, (canvas.height * 0.45) / bgImg.height);
    const dw = bgImg.width * ratio, dh = bgImg.height * ratio;
    const dx = (canvas.width - dw) / 2;
    ctx.globalAlpha = 0.18;
    ctx.drawImage(bgImg, dx, 0, dw, dh);
    ctx.globalAlpha = 1;
    const fade = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.5);
    fade.addColorStop(0, 'rgba(7,21,54,0.2)');
    fade.addColorStop(1, 'rgba(7,21,54,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.5);
  }

  // 2. En-tête : Badge(s) Organisation / Organisateurs (avec pastille blanche protectrice)
  const headerY = 45;
  const validHeaderOrgs = (orgImgs || []).filter((img): img is HTMLImageElement => img !== null);
  if (validHeaderOrgs.length > 0) {
    const lh = 55;
    const gap = 14;
    let hx = 60;
    ctx.save();
    for (const org of validHeaderOrgs) {
      const lw = Math.min((org.width / org.height) * lh, 180);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      drawRoundedRect(ctx, hx, headerY, lw + 20, lh + 12, 14);
      ctx.fill();
      ctx.drawImage(org, hx + 10, headerY + 6, lw, lh);
      hx += lw + 20 + gap;
    }
    ctx.restore();
  }

  // 3. Colonne de Droite : Photo rectangulaire allongée vers le bas avec bordure blanche + Badge "J'y serai"
  const photoW = 460;
  const photoH = 600;
  const photoX = canvas.width - photoW - 55;
  const photoY = 145;
  const borderThickness = 6;

  // Bordure blanche du cadre photo
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(photoX - borderThickness, photoY - borderThickness, photoW + borderThickness * 2, photoH + borderThickness * 2);
  ctx.restore();

  // Photo de l'utilisateur dans le cadre
  if (userImg) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    const imgR = Math.max(photoW / userImg.width, photoH / userImg.height);
    const dw = userImg.width * imgR, dh = userImg.height * imgR;
    ctx.drawImage(userImg, photoX + photoW / 2 - dw / 2, photoY + photoH / 2 - dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    const photoGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
    photoGrad.addColorStop(0, '#1e293b');
    photoGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = photoGrad;
    ctx.fillRect(photoX, photoY, photoW, photoH);

    // Placeholder avatar si pas de photo
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(photoX + photoW / 2, photoY + photoH / 2 - 40, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 32px "Montserrat", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('VOTRE PHOTO', photoX + photoW / 2, photoY + photoH / 2 + 110);
    ctx.restore();
  }

  // Badge "J'y serai !" chevauchant le bas du cadre photo
  const badgeW = 410;
  const badgeH = 105;
  const badgeX = photoX + (photoW - badgeW) / 2;
  const badgeY = photoY + photoH - 50;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
  badgeGrad.addColorStop(0, '#f59e0b');
  badgeGrad.addColorStop(0.5, '#f97316');
  badgeGrad.addColorStop(1, '#ef4444');
  ctx.fillStyle = badgeGrad;

  // Forme galbée pour le badge
  drawVariableRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, { tl: 50, tr: 50, br: 50, bl: 50 });
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Texte "J'y serai !"
  ctx.font = '900 52px "Segoe UI", "Montserrat", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText("J'y serai !", badgeX + badgeW / 2, badgeY + 62);

  // Vague / Swoosh soulignant le texte
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(badgeX + 80, badgeY + 80);
  ctx.quadraticCurveTo(badgeX + badgeW / 2, badgeY + 92, badgeX + badgeW - 80, badgeY + 76);
  ctx.stroke();
  ctx.restore();

  // Nom du participant en dessous (multi-lignes optimisé pour les noms longs)
  const nameCenterY = badgeY + badgeH + 50;
  drawParticipantName(ctx, name, photoX + photoW / 2, nameCenterY, {
    maxWidth: photoW - 20,
    maxFontSize: 36,
    minFontSize: 22,
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    fontWeight: '900',
    color: '#ffffff',
    lineHeightFactor: 1.2,
  });

  // 4. Colonne de Gauche : Emplacement du Logo de l'événement (plaqué directement, agrandi)
  const leftX = 60;
  const leftW = 470;
  let currentY = 145;

  if (logoImg) {
    const padLeft = 45;
    const padRight = 35;
    const padY = 18;
    const maxLogoW = 430;
    const maxLogoH = 220;
    const ratio = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height);
    const dw = logoImg.width * ratio;
    const dh = logoImg.height * ratio;

    const cardW = dw + padLeft + padRight;
    const cardH = dh + padY * 2;
    const cardRadius = Math.min(36, cardH / 2);

    // Fond blanc arrondi poussé complètement à gauche (sortant du bord gauche)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    drawVariableRoundedRect(ctx, -15, currentY, cardW + 15, cardH, {
      tl: 0,
      bl: 0,
      tr: cardRadius,
      br: cardRadius,
    });
    ctx.fill();
    ctx.restore();

    // Logo dessiné dans la carte blanche
    ctx.drawImage(logoImg, padLeft - 15, currentY + padY, dw, dh);

    currentY += cardH + 24;
  } else {
    // Fallback typographique avec éclat si aucun logo n'a été téléversé
    drawSpark(ctx, leftX + 18, currentY - 10, 7, 24);

    const rawTitle = event.title || 'ÉVÉNEMENT ONG DDB';
    const words = rawTitle.split(' ');

    ctx.textAlign = 'left';
    if (words.length > 2) {
      const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ').toUpperCase();
      const line2 = words.slice(Math.ceil(words.length / 2)).join(' ').toUpperCase();

      ctx.font = '900 46px "Montserrat", "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line1, leftX + 45, currentY + 10);

      ctx.font = '900 58px "Montserrat", "Segoe UI", sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText(line2, leftX, currentY + 75);
      currentY += 105;
    } else {
      ctx.font = '900 56px "Montserrat", "Segoe UI", sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText(rawTitle.toUpperCase(), leftX, currentY + 40);
      currentY += 80;
    }
  }

  // ── Affichage conditionnel du THÈME (affiché uniquement si renseigné) ──
  const themeText = (event.theme || '').trim();
  if (themeText) {
    currentY += 16;
    // Badge THÈME (rouge)
    ctx.fillStyle = '#dc2626';
    drawRoundedRect(ctx, leftX, currentY, 110, 34, 17);
    ctx.fill();
    ctx.font = 'bold 15px "Montserrat", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('THÈME', leftX + 55, currentY + 22);

    // Texte du Thème
    currentY += 50;
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px "Montserrat", "Segoe UI", sans-serif';
    ctx.fillStyle = '#f8fafc';
    wrapText(ctx, themeText.toUpperCase(), leftX, currentY, leftW, 26);
    currentY += 32;
  }

  // 5. Étiquettes d'info — descendues élégamment sous le thème : Date · Heure · Lieu
  // On s'assure d'une descente bien espacée
  currentY = Math.max(currentY + 28, 620);

  const infoBadgeW = 390;
  const infoBadgeH = 74;
  const infoBadgeGap = 16;

  // Date (gère les événements sur plusieurs jours)
  const mainDate = event.event_date ? new Date(event.event_date) : new Date();
  const extraDates = (event.event_dates || []).filter(d => d.date);
  const lastDate = extraDates.length > 0 ? new Date(extraDates[extraDates.length - 1].date) : null;
  const dateValue = lastDate
    ? `${mainDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${lastDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : mainDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  drawInfoBadge(
    ctx, leftX, currentY, infoBadgeW, infoBadgeH, '#ffffff',
    (cx, cy, r) => drawCalendarIcon(ctx, cx, cy, r, '#dc2626'),
    'DATE', dateValue, '#64748b', '#0f172a',
  );
  currentY += infoBadgeH + infoBadgeGap;

  // Heure
  const timeStr = formatTimeStr(event.event_date);
  if (timeStr) {
    drawInfoBadge(
      ctx, leftX, currentY, infoBadgeW, infoBadgeH, '#facc15',
      (cx, cy, r) => drawClockIcon(ctx, cx, cy, r, '#d97706'),
      'HEURE', timeStr, '#78350f', '#0f172a',
    );
    currentY += infoBadgeH + infoBadgeGap;
  }

  // Lieu
  const locText = (event.location || '').trim();
  if (locText) {
    drawInfoBadge(
      ctx, leftX, currentY, infoBadgeW, infoBadgeH, '#ffffff',
      (cx, cy, r) => drawPinIcon(ctx, cx, cy, r, '#2563eb'),
      'LIEU', locText, '#64748b', '#0f172a',
    );
    currentY += infoBadgeH;
  }

  // 7. Zone Blanche Pleine Largeur en Bas : Dédiée aux Logos des Partenaires & Sponsors uniquement
  const whiteZoneY = 960;
  const whiteZoneH = canvas.height - whiteZoneY;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, whiteZoneY, canvas.width, whiteZoneH);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, whiteZoneY);
  ctx.lineTo(canvas.width, whiteZoneY);
  ctx.stroke();

  // Rendu uniquement des logos partenaires/sponsors en bas (les organisateurs sont déjà en haut)
  const validPartners = (partImgs || []).filter((img): img is HTMLImageElement => img !== null);
  if (validPartners.length > 0) {
    drawLogoRowStretch(ctx, canvas, validPartners, 58, whiteZoneY + whiteZoneH / 2);
  } else {
    // Si aucun logo partenaire n'est encore téléversé, afficher une mention élégante
    ctx.font = 'bold 16px "Montserrat", "Segoe UI", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('PARTENAIRES OFFICIELS & SPONSORS DE L’ÉVÉNEMENT', canvas.width / 2, whiteZoneY + whiteZoneH / 2 + 5);
  }
};

/** Dessine l'affiche "J'y serai" sur le canvas fourni, selon le template choisi. */
export const drawPoster = async (
  canvas: HTMLCanvasElement,
  event: PosterEventData,
  name: string,
  photo: string | null,
  template: PosterTemplate = 'classic',
): Promise<void> => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const orgUrls = event.organizer_logos || [];
  const partUrls = event.partner_logos || [];
  const allUrls: (string | null)[] = [
    event.image_url ?? null,
    event.logo_url ?? null,
    photo ?? null,
    ...orgUrls,
    ...partUrls,
  ];

  const fontPromise = Promise.race([
    document.fonts.load('bold 76px "Dancing Script"'),
    new Promise(r => setTimeout(r, 2500)),
  ]).catch(() => {});

  const [loaded] = await Promise.all([
    Promise.all(allUrls.map(url => (url ? loadImage(url).catch(() => null) : Promise.resolve(null)))),
    fontPromise,
  ]);

  const bgImg = loaded[0];
  const logoImg = loaded[1];
  const userImg = loaded[2];
  const orgImgs = loaded.slice(3, 3 + orgUrls.length) as (HTMLImageElement | null)[];
  const partImgs = loaded.slice(3 + orgUrls.length) as (HTMLImageElement | null)[];

  canvas.width = 1080;
  canvas.height = template === 'modern' ? 1080 : 1350;

  const args: DrawArgs = { ctx, canvas, event, name, bgImg, logoImg, userImg, orgImgs, partImgs };
  if (template === 'modern') drawModern(args);
  else drawClassic(args);
};
