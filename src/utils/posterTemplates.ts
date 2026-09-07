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

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  let fontSize = 74, nameLineHeight = 86;
  if (name.length > 25) { fontSize = 42; nameLineHeight = 52; }
  else if (name.length > 18) { fontSize = 54; nameLineHeight = 66; }
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  const displayName = name.toUpperCase() || 'MON NOM';
  const nameMaxWidth = 940;
  const nameTextWidth = ctx.measureText(displayName).width;
  const nameLines = Math.ceil(nameTextWidth / nameMaxWidth);
  const nameStartY = canvas.height / 2 + 358 - ((nameLines - 1) * nameLineHeight) / 2;
  wrapText(ctx, displayName, canvas.width / 2, nameStartY, nameMaxWidth, nameLineHeight);

  drawLogosZone(args);
};

// Helper pour dessiner une icône d'horloge (heure)
const drawClockIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, bg = '#facc15') => {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();

  // Aiguilles
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - r * 0.38);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + r * 0.28, cy);
  ctx.stroke();
  ctx.restore();
};

// Helper pour dessiner une icône de calendrier (date)
const drawCalendarIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, bg = '#dc2626') => {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const pageW = r * 1.15, pageH = r * 1.05;
  const px = cx - pageW / 2, py = cy - pageH / 2 + r * 0.08;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, px, py, pageW, pageH, 3);
  ctx.fill();
  ctx.fillStyle = bg;
  drawRoundedRect(ctx, px, py, pageW, pageH * 0.32, 3);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(px + pageW * 0.26, py, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + pageW * 0.74, py, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(px + pageW * 0.3, py + pageH * 0.65, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + pageW * 0.5, py + pageH * 0.65, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + pageW * 0.7, py + pageH * 0.65, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
};

// Helper pour dessiner une icône de localisation (lieu)
const drawPinIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, bg = '#1e40af') => {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Pin blanc à l'intérieur
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy - 3, r * 0.45, Math.PI * 0.8, Math.PI * 0.2, true);
  ctx.lineTo(cx, cy + r * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy - 3, r * 0.2, 0, Math.PI * 2);
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
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = bg;
  drawRoundedRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const iconR = h * 0.36;
  const iconCx = x + h / 2;
  const iconCy = y + h / 2;
  drawIcon(iconCx, iconCy, iconR);

  const textX = iconCx + iconR + 18;
  const maxTextW = x + w - textX - 20;
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px "Montserrat", "Segoe UI", sans-serif';
  ctx.fillStyle = labelColor;
  ctx.fillText(label, textX, y + h * 0.4);

  ctx.font = `900 ${value.length > 16 ? 18 : 22}px "Montserrat", "Segoe UI", sans-serif`;
  ctx.fillStyle = valueColor;
  let displayValue = value;
  while (ctx.measureText(displayValue).width > maxTextW && displayValue.length > 3) {
    displayValue = displayValue.slice(0, -2);
  }
  if (displayValue !== value) displayValue = displayValue.trimEnd() + '…';
  ctx.fillText(displayValue, textX, y + h * 0.76);
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
    ctx.moveTo(cx + Math.cos(angle) * (len * 0.3), cy + Math.sin(angle) * (len * 0.3));
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

  // 2. En-tête : Badge(s) Organisation / Organisateurs — tous les logos ajoutés, pas juste le 1er
  const headerY = 45;
  const validHeaderOrgs = (orgImgs || []).filter((img): img is HTMLImageElement => img !== null);
  if (validHeaderOrgs.length > 0) {
    const lh = 55;
    const gap = 14;
    let hx = 60;
    ctx.save();
    for (const org of validHeaderOrgs) {
      const lw = Math.min((org.width / org.height) * lh, 180);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      drawRoundedRect(ctx, hx, headerY, lw + 20, lh + 12, 14);
      ctx.fill();
      ctx.drawImage(org, hx + 10, headerY + 6, lw, lh);
      hx += lw + 20 + gap;
    }
    ctx.restore();
  }

  // 3. Colonne de Droite : Arche photo au liseré doré + Badge "J'y participe"
  const archW = 460;
  const archH = 650;
  const archX = canvas.width - archW - 55;
  const archY = 150;
  const archRadii = { tl: 230, tr: 230, br: 70, bl: 35 };
  const goldStrokeRadii = { tl: archRadii.tl + 6, tr: archRadii.tr + 6, br: archRadii.br + 6, bl: archRadii.bl + 6 };

  // Liseré doré de l'arche
  ctx.fillStyle = '#facc15';
  drawVariableRoundedRect(ctx, archX - 6, archY - 6, archW + 12, archH + 12, goldStrokeRadii);
  ctx.fill();

  // Photo de l'utilisateur dans l'arche
  if (userImg) {
    ctx.save();
    drawVariableRoundedRect(ctx, archX, archY, archW, archH, archRadii);
    ctx.clip();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(archX, archY, archW, archH);
    const imgR = Math.max(archW / userImg.width, archH / userImg.height);
    const dw = userImg.width * imgR, dh = userImg.height * imgR;
    ctx.drawImage(userImg, archX + archW / 2 - dw / 2, archY + archH / 2 - dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.save();
    drawVariableRoundedRect(ctx, archX, archY, archW, archH, archRadii);
    ctx.clip();
    const photoGrad = ctx.createLinearGradient(archX, archY, archX + archW, archY + archH);
    photoGrad.addColorStop(0, '#1e293b');
    photoGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = photoGrad;
    ctx.fillRect(archX, archY, archW, archH);

    // Placeholder avatar si pas de photo
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(archX + archW / 2, archY + 270, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 34px "Montserrat", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('VOTRE PHOTO', archX + archW / 2, archY + 430);
    ctx.restore();
  }

  // Badge "J'y participe" / "J'y serai" chevauchant le bas de l'arche
  const badgeW = 420;
  const badgeH = 115;
  const badgeX = archX - 35;
  const badgeY = archY + archH - 125;

  ctx.save();
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
  badgeGrad.addColorStop(0, '#f59e0b');
  badgeGrad.addColorStop(0.5, '#f97316');
  badgeGrad.addColorStop(1, '#ef4444');
  ctx.fillStyle = badgeGrad;

  // Forme galbée pour le badge
  drawVariableRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, { tl: 50, tr: 50, br: 50, bl: 50 });
  ctx.fill();

  // Texte "J'y participe !"
  ctx.font = '900 52px "Segoe UI", "Montserrat", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText("J'y participe !", badgeX + badgeW / 2, badgeY + 68);

  // Vague / Swoosh soulignant le texte
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(badgeX + 80, badgeY + 88);
  ctx.quadraticCurveTo(badgeX + badgeW / 2, badgeY + 100, badgeX + badgeW - 80, badgeY + 84);
  ctx.stroke();
  ctx.restore();

  // Nom du participant en dessous
  const nameY = archY + archH + 40;
  ctx.font = '900 34px "Montserrat", "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  const displayName = name.toUpperCase() || 'MON NOM';
  ctx.fillText(displayName, archX + archW / 2, nameY);

  // 4. Colonne de Gauche : Emplacement du Logo de l'événement (ou Titre si pas de logo)
  const leftX = 60;
  const leftW = 460;
  let currentY = 150;

  if (logoImg) {
    // ── Logo dans une carte blanche rectangulaire — bord gauche du poster ──
    const cardX = 0;                         // commence au bord gauche du poster
    const cardW = leftX + leftW + 20;        // toute la colonne gauche
    const cardH = 290;
    const cardRadius = 24;

    // Fond blanc de la carte
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.30)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, cardX, currentY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Logo clippé pour remplir tout le rectangle (cover)
    drawRoundedRect(ctx, cardX, currentY, cardW, cardH, cardRadius);
    ctx.clip();

    const imgRatio = Math.max(cardW / logoImg.width, cardH / logoImg.height);
    const dw = logoImg.width * imgRatio;
    const dh = logoImg.height * imgRatio;
    const dx = cardX + (cardW - dw) / 2;
    const dy = currentY + (cardH - dh) / 2;
    ctx.drawImage(logoImg, dx, dy, dw, dh);
    ctx.restore();

    currentY += cardH + 30;
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
    currentY += 24;
    // Badge THÈME (rouge)
    ctx.fillStyle = '#dc2626';
    drawRoundedRect(ctx, leftX, currentY, 110, 36, 18);
    ctx.fill();
    ctx.font = 'bold 15px "Montserrat", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('THÈME', leftX + 55, currentY + 23);

    // Texte du Thème
    currentY += 54;
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px "Montserrat", "Segoe UI", sans-serif';
    ctx.fillStyle = '#f8fafc';
    wrapText(ctx, themeText.toUpperCase(), leftX, currentY, leftW, 26);
    currentY += 28;
  } else {
    // Si pas de thème, on laisse un espacement naturel
    currentY += 20;
  }

  // 5. Étiquettes d'info — chacune dans sa propre pastille : Date · Heure · Lieu
  currentY += 40;
  const infoBadgeW = 380;
  const infoBadgeH = 72;
  const infoBadgeGap = 14;

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
      (cx, cy, r) => drawClockIcon(ctx, cx, cy, r, '#0f172a'),
      'HEURE', timeStr, '#7c2d12', '#0f172a',
    );
    currentY += infoBadgeH + infoBadgeGap;
  }

  // Lieu
  const locText = event.location || 'Siège ONG DDB & En Ligne';
  drawInfoBadge(
    ctx, leftX, currentY, infoBadgeW, infoBadgeH, '#ffffff',
    (cx, cy, r) => drawPinIcon(ctx, cx, cy, r, '#1e40af'),
    'LIEU', locText, '#64748b', '#0f172a',
  );
  currentY += infoBadgeH;

  // 7. Zone Blanche Pleine Largeur en Bas : Dédiée aux Logos des Partenaires & Sponsors
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

  // Rendu de TOUS les logos (organisateurs + partenaires) dans la zone blanche —
  // le badge en tête n'affiche que le 1er organisateur, les autres doivent apparaître ici.
  const validOrgs = (orgImgs || []).filter((img): img is HTMLImageElement => img !== null);
  const validPartners = (partImgs || []).filter((img): img is HTMLImageElement => img !== null);
  const allLogos = [...validPartners, ...validOrgs];
  if (allLogos.length > 0) {
    drawLogoRowStretch(ctx, canvas, allLogos, 58, whiteZoneY + whiteZoneH / 2);
  } else {
    // Si aucun logo n'est encore téléversé, afficher une mention élégante
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
