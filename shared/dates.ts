// Date come stringhe locali YYYY-MM-DD, senza fusi orari: sono giorni di calendario (scadenze, ricorrenze, piano).
// Usato sia dal server (nome del file di esportazione) sia dal sito e dall'app.

const pad = (n: number) => String(n).padStart(2, '0');

/** Data locale del dispositivo in formato YYYY-MM-DD. */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Il giorno di oggi (o di `now`) come YYYY-MM-DD. */
export function today(now: Date = new Date()): string {
  return toISO(now);
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Somma mesi mantenendo il giorno; se il mese di arrivo è più corto si ferma all'ultimo giorno (31 gen + 1 mese = 28 feb). */
export function addMonths(iso: string, n: number): string {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

/** Differenza in giorni di calendario: a - b. */
export function diffDays(a: string, b: string): number {
  const da = parseISO(a);
  const db = parseISO(b);
  return Math.round((Date.UTC(da.getFullYear(), da.getMonth(), da.getDate()) - Date.UTC(db.getFullYear(), db.getMonth(), db.getDate())) / 86400000);
}

/** Lunedì della settimana che contiene la data. */
export function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // lunedì = 0
  return addDays(iso, -dow);
}

/** I sette giorni (lunedì-domenica) della settimana che contiene la data. */
export function weekDays(iso: string): string[] {
  const s = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

/** "21 ott" */
export function formatShort(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
}

/** "21 ott 2027" se non è l'anno corrente */
export function formatShortYear(iso: string, ref: string = today()): string {
  const d = parseISO(iso);
  const sameYear = d.getFullYear() === parseISO(ref).getFullYear();
  return sameYear ? formatShort(iso) : `${formatShort(iso)} ${d.getFullYear()}`;
}

/** "Giovedì 15 ottobre" */
export function formatLong(iso: string): string {
  const d = parseISO(iso);
  const g = GIORNI[d.getDay()];
  return `${g[0].toUpperCase()}${g.slice(1)} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** "Ottobre 2026" */
export function monthLabel(iso: string): string {
  const d = parseISO(iso);
  return `${MESI[d.getMonth()][0].toUpperCase()}${MESI[d.getMonth()].slice(1)} ${d.getFullYear()}`;
}

/** "2026-10": per raggruppare i giorni per mese. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** "tra 3 giorni", "oggi", "3 giorni fa", "8 mesi fa" */
export function relativeDays(iso: string, ref: string = today()): string {
  const n = diffDays(iso, ref);
  if (n === 0) return 'oggi';
  if (n === 1) return 'domani';
  if (n === -1) return 'ieri';
  const abs = Math.abs(n);
  const label = abs >= 60 ? `${Math.round(abs / 30)} mesi` : `${abs} giorni`;
  return n > 0 ? `tra ${label}` : `${label} fa`;
}
