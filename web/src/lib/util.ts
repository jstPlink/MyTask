/** Identificatore casuale: usa getRandomValues, disponibile anche fuori dai contesti sicuri. */
export function newId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a: A) => { clearTimeout(t); fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function mapsUrl(luogo: string, zona?: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([luogo, zona].filter(Boolean).join(' '))}`;
}

export function pallini(n: number | undefined, max = 5): string {
  const v = Math.max(0, Math.min(max, n ?? 0));
  return '●'.repeat(v) + '○'.repeat(max - v);
}

export function clsx(...a: (string | false | undefined | null)[]): string {
  return a.filter(Boolean).join(' ');
}
