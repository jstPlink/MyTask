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

/** Millisecondi di lavoro in forma breve: «meno di 1 min», «42 min», «1 h 12 min». */
export function durataLavoro(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'meno di 1 min';
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
}

/**
 * Il tempo già lavorato su una nota, con il totale previsto se c'è una stima: «42 min su 1 h 20 min» (senza stima solo
 * «42 min»). `quota` è la frazione del previsto già usata (può superare 1: oltre il previsto); assente senza stima.
 */
export function avanzamentoTempo(ms: number, stimaMin?: number): { testo: string; quota?: number } {
  if (!stimaMin) return { testo: durataLavoro(ms) };
  return { testo: `${durataLavoro(ms)} su ${durataLavoro(stimaMin * 60_000)}`, quota: ms / (stimaMin * 60_000) };
}

/** Durata in minuti a parole: 15 min, 2 ore, 1 giorno. */
export function nomeTempo(m: number): string {
  return m >= 1440 && m % 1440 === 0 ? `${m / 1440} ${m === 1440 ? 'giorno' : 'giorni'}` : m >= 60 ? `${+(m / 60).toFixed(1)} ${m === 60 ? 'ora' : 'ore'}` : `${m} min`;
}
