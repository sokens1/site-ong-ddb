/**
 * Traitement d'image des albums, utilisable dans un Web Worker (OffscreenCanvas)
 * comme sur le thread principal (HTMLCanvasElement).
 *
 * Pour chaque photo on produit :
 *  - `full`  : JPEG 2048 px max (≈ 300–600 Ko), format universel pour le
 *              téléchargement / partage WhatsApp. Le ré-encodage supprime au
 *              passage les métadonnées EXIF (position GPS des photos !).
 *  - `thumb` : WebP 480 px (≈ 25–50 Ko) pour la grille.
 *  - `placeholder` : JPEG 16 px en data URL (~500 octets), affiché flouté
 *              instantanément, avant même le chargement de la miniature.
 */

export const FULL_MAX_EDGE = 2048;
export const FULL_QUALITY = 0.85;
export const THUMB_MAX_EDGE = 480;
export const THUMB_QUALITY = 0.72;
const PLACEHOLDER_MAX_EDGE = 16;

export interface ProcessedImage {
  full: Blob;
  thumb: Blob;
  placeholder: string;
  width: number;
  height: number;
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export type CanvasFactory = (width: number, height: number) => AnyCanvas;

export const fitWithin = (w: number, h: number, max: number): [number, number] => {
  const scale = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
};

const draw = (
  source: CanvasImageSource,
  w: number,
  h: number,
  makeCanvas: CanvasFactory,
  background?: string,
): AnyCanvas => {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d') as Ctx2D | null;
  if (!ctx) throw new Error('Canvas 2D indisponible');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
};

/**
 * Réduction par paliers de ÷2 : un passage direct 6000 → 2048 px crénelle les
 * détails fins (cheveux, textes, tissus) ; les paliers donnent un rendu net.
 */
export const resizeStepwise = (
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  makeCanvas: CanvasFactory,
  background?: string,
): AnyCanvas => {
  let current: CanvasImageSource = source;
  let w = srcW;
  let h = srcH;
  while (w / 2 >= targetW && h / 2 >= targetH) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    current = draw(current, w, h, makeCanvas, background);
  }
  return draw(current, targetW, targetH, makeCanvas, background);
};

export const canvasToBlob = (canvas: AnyCanvas, type: string, quality: number): Promise<Blob> => {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec de l'encodage de l'image"))),
      type,
      quality,
    ),
  );
};

/** WebP si le navigateur sait l'encoder (Safari ne le sait pas toujours), sinon JPEG. */
export const encodeThumb = async (canvas: AnyCanvas): Promise<Blob> => {
  const webp = await canvasToBlob(canvas, 'image/webp', THUMB_QUALITY);
  if (webp.type === 'image/webp') return webp;
  return canvasToBlob(canvas, 'image/jpeg', 0.75);
};

export const blobToDataUrl = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
};

export const makePlaceholder = async (
  source: CanvasImageSource,
  w: number,
  h: number,
  makeCanvas: CanvasFactory,
): Promise<string> => {
  const [pw, ph] = fitWithin(w, h, PLACEHOLDER_MAX_EDGE);
  const canvas = draw(source, pw, ph, makeCanvas, '#ffffff');
  return blobToDataUrl(await canvasToBlob(canvas, 'image/jpeg', 0.5));
};

const decode = async (file: Blob): Promise<ImageBitmap> => {
  try {
    // Applique l'orientation EXIF (photos de téléphone prises en portrait)
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      throw new Error('Format d\'image non pris en charge (convertissez en JPEG ou PNG)');
    }
  }
};

export const processImage = async (file: Blob, makeCanvas: CanvasFactory): Promise<ProcessedImage> => {
  const bitmap = await decode(file);
  try {
    const [fw, fh] = fitWithin(bitmap.width, bitmap.height, FULL_MAX_EDGE);
    // Fond blanc : un PNG transparent ne doit pas devenir noir en JPEG
    const fullCanvas = resizeStepwise(bitmap, bitmap.width, bitmap.height, fw, fh, makeCanvas, '#ffffff');
    const full = await canvasToBlob(fullCanvas, 'image/jpeg', FULL_QUALITY);

    // La miniature part de la version 2048 px : beaucoup moins de pixels à traiter
    const [tw, th] = fitWithin(fw, fh, THUMB_MAX_EDGE);
    const thumbCanvas = resizeStepwise(fullCanvas, fw, fh, tw, th, makeCanvas);
    const thumb = await encodeThumb(thumbCanvas);
    const placeholder = await makePlaceholder(thumbCanvas, tw, th, makeCanvas);

    return { full, thumb, placeholder, width: fw, height: fh };
  } finally {
    bitmap.close();
  }
};
