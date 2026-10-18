/** Identificatore casuale: usa getRandomValues, disponibile anche fuori dai contesti sicuri. */
export function newId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Ritarda `fn` finché per `ms` non ci sono nuove chiamate. `flush` la esegue subito, `cancel` annulla l'attesa. */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a: A) => { clearTimeout(t); fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}

/** Collegamento di ricerca su Google Maps. */
export function mapsUrl(luogo: string, zona?: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([luogo, zona].filter(Boolean).join(' '))}`;
}

/** Valutazione a pallini (pieni e vuoti) su una scala di `max`. */
export function pallini(n: number | undefined, max = 5): string {
  const v = Math.max(0, Math.min(max, n ?? 0));
  return '●'.repeat(v) + '○'.repeat(max - v);
}

/** Unisce i nomi di classe veri, scartando i valori falsi. */
export function clsx(...a: (string | false | undefined | null)[]): string {
  return a.filter(Boolean).join(' ');
}

/** Durata in minuti a parole: 15 min, 2 ore, 1 giorno. */
export function nomeTempo(m: number): string {
  return m >= 1440 && m % 1440 === 0 ? `${m / 1440} ${m === 1440 ? 'giorno' : 'giorni'}` : m >= 60 ? `${+(m / 60).toFixed(1)} ${m === 60 ? 'ora' : 'ore'}` : `${m} min`;
}
