import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Download, RefreshCw, Camera } from 'lucide-react';

interface Event {
  title: string;
  image_url: string | null;
  logo_url?: string;
  event_date: string;
  event_dates?: { date: string; label?: string }[];
  organizer_logos?: string[];
  partner_logos?: string[];
}

interface PosterGeneratorModalProps {
  event: Event;
  defaultName: string;
  onClose: () => void;
}

const PosterGeneratorModal: React.FC<PosterGeneratorModalProps> = ({ event, defaultName, onClose }) => {
  const [name, setName] = useState(defaultName);
  const [photo, setPhoto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const isDrawing = useRef(false); // guard contre les appels concurrents

  // ── Swipe-to-close ────────────────────────────────────────────────────────
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    dragCurrentY.current = delta;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragCurrentY.current > 120) {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.25s ease';
        sheetRef.current.style.transform = 'translateY(100%)';
      }
      setTimeout(onClose, 220);
    } else {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.3s ease';
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [onClose]);

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhoto(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // ── Canvas helpers ────────────────────────────────────────────────────────
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      const timer = setTimeout(() => reject(new Error('timeout')), 6000);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => {
        clearTimeout(timer);
        // Fallback sans CORS (pour les URLs sans header Access-Control)
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

  // ── Draw poster ───────────────────────────────────────────────────────────
  const drawPoster = async () => {
    if (isDrawing.current) return;       // évite les appels concurrents
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    setIsGenerating(true);

    try {

    // Collecter toutes les URLs à charger
    const orgUrls  = event.organizer_logos || [];
    const partUrls = event.partner_logos   || [];
    const allUrls: (string | null)[] = [
      event.image_url ?? null,
      event.logo_url  ?? null,
      photo           ?? null,
      ...orgUrls,
      ...partUrls,
    ];

    // Chargement parallèle de toutes les images + font (avec timeout iOS)
    const fontPromise = Promise.race([
      document.fonts.load('bold 76px "Dancing Script"'),
      new Promise(r => setTimeout(r, 2500)),
    ]).catch(() => {});

    const [loaded] = await Promise.all([
      Promise.all(allUrls.map(url =>
        url ? loadImage(url).catch(() => null) : Promise.resolve(null)
      )),
      fontPromise,
    ]);

    const bgImg   = loaded[0];
    const logoImg = loaded[1];
    const userImg = loaded[2];
    const orgImgs  = loaded.slice(3, 3 + orgUrls.length) as (HTMLImageElement | null)[];
    const partImgs = loaded.slice(3 + orgUrls.length)    as (HTMLImageElement | null)[];

    canvas.width  = 1080;
    canvas.height = 1350;

    // Background
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

    // Logo top-left — étiquette blanche
    if (logoImg) {
      const lh = 148;
      const lw = Math.min((logoImg.width / logoImg.height) * lh, 520);
      const bx = 48, by = 42, bpadH = 32, bpadV = 22;
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, bx, by, lw + bpadH * 2, lh + bpadV * 2, 24);
      ctx.fill();
      ctx.drawImage(logoImg, bx + bpadH, by + bpadV, lw, lh);
    }

    // Dates at top
    let dateStr = '';
    if (event.event_date) {
      const mainDate = new Date(event.event_date);
      const day   = mainDate.getDate();
      const month = mainDate.toLocaleDateString('fr-FR', { month: 'long' });
      const year  = mainDate.getFullYear();
      const extras = (event.event_dates || []).filter(d => d.date);
      if (extras.length > 0) {
        const last = extras[extras.length - 1];
        const lastDate  = new Date(last.date);
        const lastDay   = lastDate.getDate();
        const lastMonth = lastDate.toLocaleDateString('fr-FR', { month: 'long' });
        dateStr = month === lastMonth
          ? `DU ${day} AU ${lastDay} ${month.toUpperCase()} ${year}`
          : `DU ${day} ${month.toUpperCase()} AU ${lastDay} ${lastMonth.toUpperCase()} ${year}`;
      } else {
        dateStr = mainDate.toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }).toUpperCase();
      }
    }

    if (dateStr) {
      ctx.font = 'bold 28px "Montserrat", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      const tw   = ctx.measureText(dateStr).width;
      const dateX = canvas.width / 2 + (event.logo_url ? 80 : 0);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      drawRoundedRect(ctx, dateX - tw / 2 - 24, 88, tw + 48, 60, 12);
      ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.fillText(dateStr, dateX, 130);
    }

    // User photo
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

    // "J'y serai" sticker
    ctx.save();
    ctx.font = '76px "Dancing Script", cursive';
    const labelText = "J'y serai !";
    const textW = ctx.measureText(labelText).width;
    const padX  = 35;
    const tagW  = textW + padX * 2;
    const tagH  = 92;
    const tagX  = 630, tagY = 800;
    ctx.translate(tagX + tagW / 2, tagY + tagH / 2);
    ctx.rotate(-4 * Math.PI / 180);
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, -tagW / 2, -tagH / 2, tagW, tagH, 22);
    ctx.fill();
    ctx.fillStyle = '#064e3b';
    ctx.textAlign = 'center';
    ctx.fillText(labelText, 0, 18);
    ctx.restore();

    // Name
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    let fontSize = 74, nameLineHeight = 86;
    if (name.length > 25) { fontSize = 42; nameLineHeight = 52; }
    else if (name.length > 18) { fontSize = 54; nameLineHeight = 66; }
    ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
    const displayName    = name.toUpperCase() || 'MON NOM';
    const nameMaxWidth   = 940;
    const nameTextWidth  = ctx.measureText(displayName).width;
    const nameLines      = Math.ceil(nameTextWidth / nameMaxWidth);
    const nameStartY     = canvas.height / 2 + 358 - ((nameLines - 1) * nameLineHeight) / 2;
    wrapText(ctx, displayName, canvas.width / 2, nameStartY, nameMaxWidth, nameLineHeight);

    // Détection des logos disponibles
    const hasOrgLogos     = orgImgs.some(Boolean);
    const hasPartnerLogos = partImgs.some(Boolean);
    const hasAnyLogos     = hasOrgLogos || hasPartnerLogos;
    const hasBothRows     = hasOrgLogos && hasPartnerLogos;

    // Partenaires (haut) plus grands, organisateurs (bas) plus petits
    const ROW_PAD = 26, PART_H = 84, ORG_H = 50, SEP_GAP = 20;
    let zoneHeight = 0;
    if (hasBothRows)       zoneHeight = ROW_PAD + PART_H + SEP_GAP + ORG_H + ROW_PAD;
    else if (hasAnyLogos)  zoneHeight = ROW_PAD + (hasPartnerLogos ? PART_H : ORG_H) + ROW_PAD;

    const whiteZoneY = hasAnyLogos ? canvas.height - zoneHeight : canvas.height + 10;

    // Rangée centrée (organisateurs) — s'adapte mais ne dépasse pas maxW
    const drawLogoRow = (imgs: (HTMLImageElement | null)[], targetH: number, rowCenterY: number) => {
      const gap  = 40;
      const maxW = canvas.width - 200;
      const valid = imgs.filter((img): img is HTMLImageElement => img !== null);
      if (!valid.length) return;

      let dims = valid.map(img => {
        const h = targetH;
        const w = (img.width / img.height) * h;
        return { w, h };
      });
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

    // Rangée pleine largeur (partenaires) — occupe toute la largeur disponible
    const drawLogoRowStretch = (imgs: (HTMLImageElement | null)[], refH: number, rowCenterY: number) => {
      const valid = imgs.filter((img): img is HTMLImageElement => img !== null);
      if (!valid.length) return;

      const sidePad = 48, gap = 44;
      const avail = canvas.width - sidePad * 2;

      // Largeurs naturelles à refH
      let dims = valid.map(img => ({
        w: (img.width / img.height) * refH,
        h: refH,
        img,
      }));

      // Étirer pour remplir la largeur disponible
      const rawTotal = dims.reduce((s, d) => s + d.w, 0) + gap * (valid.length - 1);
      const scale = avail / rawTotal;
      dims = dims.map(d => ({ ...d, w: d.w * scale, h: d.h * scale }));

      // Plafonner la hauteur à 1.8× refH pour éviter un logo trop grand
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

    // Zone blanche en bas
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
        // Partenaires en haut (pleine largeur)
        drawLogoRowStretch(partImgs, PART_H, whiteZoneY + ROW_PAD + PART_H / 2);
        // Séparateur
        const sepY = whiteZoneY + ROW_PAD + PART_H + SEP_GAP / 2;
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(120, sepY);
        ctx.lineTo(canvas.width - 120, sepY);
        ctx.stroke();
        // Organisateurs en bas (centrés, plus petits)
        drawLogoRow(orgImgs, ORG_H, whiteZoneY + ROW_PAD + PART_H + SEP_GAP + ORG_H / 2);
      } else if (hasPartnerLogos) {
        drawLogoRowStretch(partImgs, PART_H, whiteZoneY + zoneHeight / 2);
      } else {
        drawLogoRow(orgImgs, ORG_H, whiteZoneY + zoneHeight / 2);
      }
    }

    } catch (err) {
      console.error('Poster generation error:', err);
    } finally {
      isDrawing.current = false;
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    drawPoster();
  }, [name, photo]);

  const downloadPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `jy-serai-${name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert("Impossible de télécharger : une image source bloque l'export (URL non sécurisée). Vérifiez que les logos sont hébergés en HTTPS.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="bg-white w-full sm:max-w-5xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col md:flex-row overflow-y-auto md:overflow-hidden"
        style={{ maxHeight: '95dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div
          className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0 bg-white cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* ── Controls ─────────────────────────────────────────────── */}
        <div className="w-full md:w-5/12 bg-gray-50 flex flex-col flex-shrink-0 md:border-r border-gray-200">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2 md:px-8 md:pt-8 sticky top-0 bg-gray-50 z-10 border-b border-gray-100 md:border-none">
            <h3 className="text-base md:text-xl font-bold text-gray-800">Générer mon affiche</h3>
            <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
              <X size={20} />
            </button>
          </div>

          <p className="text-gray-400 text-xs px-5 pt-3 pb-4 md:px-8 leading-relaxed">
            Personnalisez votre affiche et partagez sur les réseaux !
          </p>

          {/* Fields */}
          <div className="flex gap-3 px-5 md:px-8 md:flex-col">
            {/* Name */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Nom affiché</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>

            {/* Photo */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Photo</label>
              <label className="relative flex flex-col items-center justify-center w-full h-[52px] md:h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-white overflow-hidden group transition-colors hover:bg-gray-50">
                {photo ? (
                  <>
                    <img src={photo} alt="preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
                      <Camera size={16} />
                      <span className="text-[10px] md:text-xs font-semibold px-1 text-center">Changer la photo</span>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-0.5 pointer-events-none">
                      <Camera size={10} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 px-2">
                    <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <p className="text-xs text-gray-500 truncate">Ajouter une photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          {/* Download */}
          <div className="px-5 py-4 md:px-8 md:pb-8 md:mt-auto">
            <button
              onClick={downloadPoster}
              disabled={isGenerating || !photo}
              className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow text-sm"
            >
              {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
              Télécharger l'affiche
            </button>
          </div>
        </div>

        {/* ── Canvas Preview ────────────────────────────────────────── */}
        <div className="w-full md:w-7/12 bg-gray-900 flex items-center justify-center p-5 md:p-8">
          <div className="relative w-full max-w-[240px] sm:max-w-xs md:max-w-sm mx-auto aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl">
            <canvas ref={canvasRef} className="w-full h-full object-contain bg-black" />
            {!photo && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white p-6 text-center">
                <div>
                  <Upload className="mx-auto mb-3 opacity-60" size={28} />
                  <p className="font-semibold text-sm">Ajoutez votre photo pour voir l'aperçu</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PosterGeneratorModal;
