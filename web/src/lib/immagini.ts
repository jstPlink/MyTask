// Immagini allegate alle note: ridotte e salvate dentro la voce (come testo), perché ogni voce sul server può pesare al massimo 200 KB.

/** Peso massimo di una immagine ridotta (caratteri del testo codificato) e di tutte le immagini di una voce. */
export const MAX_IMMAGINE = 70_000;
export const MAX_IMMAGINI_VOCE = 130_000;
const LATO_MASSIMO = 960;

/** Legge il file, lo rimpicciolisce e lo comprime finché sta nel limite; undefined se non è un'immagine leggibile. */
export async function riduciImmagine(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { return undefined; }
  let scala = Math.min(1, LATO_MASSIMO / Math.max(bitmap.width, bitmap.height));
  for (let tentativo = 0; tentativo < 6; tentativo++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scala));
    canvas.height = Math.max(1, Math.round(bitmap.height * scala));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const qualita = Math.max(0.35, 0.7 - tentativo * 0.08);
    const url = canvas.toDataURL('image/jpeg', qualita);
    if (url.length <= MAX_IMMAGINE) { bitmap.close?.(); return url; }
    scala *= 0.8;
  }
  bitmap.close?.();
  return undefined;
}

export const pesoImmagini = (immagini: string[] | undefined): number => (immagini ?? []).reduce((n, i) => n + i.length, 0);
