import { processImage } from '../utils/albumImageCore';

// Compression des photos hors du thread principal : l'interface reste fluide
// même pendant l'import de centaines de photos de 10 Mo.
// (Typage minimal plutôt que lib "webworker", qui entre en conflit avec lib "DOM".)
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<{ id: number; file: Blob }>) => void) | null;
  postMessage: (message: unknown) => void;
};

ctx.onmessage = async (e) => {
  const { id, file } = e.data;
  try {
    const result = await processImage(file, (w, h) => new OffscreenCanvas(w, h));
    ctx.postMessage({ id, ok: true, result });
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
