import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Download, RefreshCw, Camera } from 'lucide-react';

interface Event {
  title: string;
  image_url: string | null;
  logo_url?: string;
  event_date: string;
  event_dates?: { date: string; label?: string }[];
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
      img.onload = () => resolve(img);
      img.onerror = reject;
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsGenerating(true);

    try { await document.fonts.load('bold 76px "Dancing Script"'); } catch { /* silent */ }

    canvas.width = 1080;
    canvas.height = 1350;

    // Background
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (event.image_url) {
      try {
        const bgImg = await loadImage(event.image_url);
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
      } catch { /* silent */ }
    }

    // Logo top-left
    if (event.logo_url) {
      try {
        const logo = await loadImage(event.logo_url);
        const lh = 120;
        const lw = (logo.width / logo.height) * lh;
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, 60, 50, lw + 40, lh + 24, 20);
        ctx.fill();
        ctx.drawImage(logo, 80, 62, lw, lh);
      } catch { /* silent */ }
    }

    // Dates at top
    let dateStr = '';
    if (event.event_date) {
      const mainDate = new Date(event.event_date);
      const day = mainDate.getDate();
      const month = mainDate.toLocaleDateString('fr-FR', { month: 'long' });
      const year = mainDate.getFullYear();
      if (event.event_dates && event.event_dates.length > 0) {
        const last = event.event_dates[event.event_dates.length - 1];
        if (last.date) {
          const lastDate = new Date(last.date);
          const lastDay = lastDate.getDate();
          const lastMonth = lastDate.toLocaleDateString('fr-FR', { month: 'long' });
          dateStr = month === lastMonth
            ? `DU ${day} AU ${lastDay} ${month.toUpperCase()} ${year}`
            : `DU ${day} ${month.toUpperCase()} AU ${lastDay} ${lastMonth.toUpperCase()} ${year}`;
        }
      } else {
        dateStr = mainDate.toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }).toUpperCase();
      }
    }

    if (dateStr) {
      ctx.font = 'bold 28px "Montserrat", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(dateStr).width;
      const dateX = canvas.width / 2 + (event.logo_url ? 80 : 0);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      drawRoundedRect(ctx, dateX - tw / 2 - 24, 60, tw + 48, 60, 12);
      ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.fillText(dateStr, dateX, 102);
    }

    // User photo
    const cx = canvas.width / 2, cy = canvas.height / 2 - 110;
    const size = 460, radius = 30, angleDeg = -4;

    if (photo) {
      try {
        const userImg = await loadImage(photo);
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
      } catch { /* silent */ }
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

    // Name
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
    const nameStartY = canvas.height / 2 + 320 - ((nameLines - 1) * nameLineHeight) / 2;
    wrapText(ctx, displayName, canvas.width / 2, nameStartY, nameMaxWidth, nameLineHeight);

    // Event title at the very bottom
    ctx.fillStyle = '#a7f3d0';
    let titleFontSize = 46, titleLineHeight = 56;
    if (event.title.length > 50) { titleFontSize = 32; titleLineHeight = 42; }
    else if (event.title.length > 28) { titleFontSize = 38; titleLineHeight = 48; }
    ctx.font = `${titleFontSize}px "Segoe UI", Arial, sans-serif`;
    const titleTextWidth = ctx.measureText(event.title).width;
    const estimatedTitleLines = Math.ceil(titleTextWidth / 920);
    const titleStartY = 1240 - (estimatedTitleLines - 1) * titleLineHeight;
    wrapText(ctx, event.title, canvas.width / 2, titleStartY, 920, titleLineHeight);

    setIsGenerating(false);
  };

  useEffect(() => {
    drawPoster();
  }, [name, photo]);

  const downloadPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `jy-serai-${name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
