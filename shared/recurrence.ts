import type { Item, Ricorrenza } from './types.ts';
import { addDays, addMonths, diffDays } from './dates.ts';

export function advance(iso: string, r: Ricorrenza): string {
  switch (r.unita) {
    case 'giorni': return addDays(iso, r.ogni);
    case 'settimane': return addDays(iso, r.ogni * 7);
    case 'mesi': return addMonths(iso, r.ogni);
    case 'anni': return addMonths(iso, r.ogni * 12);
  }
}

/** Prima occorrenza successiva a `today` partendo da `base`. */
export function nextOccurrence(base: string, r: Ricorrenza, today: string): string {
  let d = advance(base, r);
  let guard = 0;
  while (diffDays(d, today) <= 0 && guard++ < 2000) d = advance(d, r);
  return d;
}

export function descriviRicorrenza(r: Ricorrenza): string {
  const nomi = { giorni: ['giorno', 'giorni'], settimane: ['settimana', 'settimane'], mesi: ['mese', 'mesi'], anni: ['anno', 'anni'] } as const;
  if (r.ogni === 1) return `ogni ${nomi[r.unita][0]}`;
  return `ogni ${r.ogni} ${nomi[r.unita][1]}`;
}

/**
 * Completa una voce. Se è ricorrente resta aperta e si sposta alla prossima occorrenza,
 * altrimenti diventa "fatto".
 */
export function completa(i: Item, today: string, now: number): Item {
  const log = [...(i.log ?? []), today];
  if (i.ricorrenza) {
    const base = i.fine ?? i.inizio ?? today;
    const prossima = nextOccurrence(base, i.ricorrenza, today);
    const delta = diffDays(prossima, base);
    return {
      ...i,
      log,
      stato: 'da_fare',
      inizio: i.inizio ? addDays(i.inizio, delta) : undefined,
      fine: i.fine ? addDays(i.fine, delta) : undefined,
      aggiornato: now,
    };
  }
  return { ...i, stato: 'fatto', completatoIl: today, completatoTs: now, aggiornato: now };
}

export function riapri(i: Item, now: number): Item {
  return { ...i, stato: 'da_fare', completatoIl: undefined, completatoTs: undefined, aggiornato: now };
}
