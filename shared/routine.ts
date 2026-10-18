// Routine: abitudini che non scadono e non finiscono. Compaiono in Oggi nei giorni utili e si spuntano giorno per giorno
// (le date fatte stanno in `log`). Con una quota settimanale (`volteSettimana`) compaiono finché non è raggiunta.
import type { Item } from './types.ts';
import { startOfWeek, weekDays } from './dates.ts';

/** Routine in uso: le parcheggiate (archiviate) e quelle chiuse non compaiono. */
const attiva = (i: Item) => i.tipo === 'routine' && !i.eliminato && i.stato !== 'parcheggiato' && i.stato !== 'fatto' && i.stato !== 'saltato';

/** Quante volte la routine è stata fatta nella settimana (lunedì-domenica) che contiene `day`. */
export function weekCount(i: Item, day: string): number {
  const start = startOfWeek(day);
  const days = new Set(weekDays(start));
  return (i.log ?? []).filter((d) => days.has(d)).length;
}

/** La routine è stata spuntata nel giorno indicato. */
export function fattaOggi(i: Item, day: string): boolean {
  return (i.log ?? []).includes(day);
}

/** La routine va mostrata oggi: sempre se giornaliera, altrimenti finché non ha raggiunto la quota settimanale. */
export function dueToday(i: Item, day: string): boolean {
  if (!attiva(i)) return false;
  if (!i.volteSettimana) return true;
  return fattaOggi(i, day) || weekCount(i, day) < i.volteSettimana;
}

/** Le routine da mostrare nel giorno indicato. */
export function routineDueToday(items: Item[], day: string): Item[] {
  return items.filter((i) => dueToday(i, day));
}

/** Spunta o toglie la spunta del giorno (il log resta ordinato). */
export function toggleOggi(i: Item, day: string, now: number): Item {
  const log = i.log ?? [];
  const nuovo = log.includes(day) ? log.filter((d) => d !== day) : [...log, day].sort();
  return { ...i, log: nuovo, aggiornato: now };
}

/** Un giorno della riga lunedì-domenica mostrata nella scheda della routine. */
export interface GiornoSettimana { day: string; fatto: boolean; oggi: boolean }

/** I sette giorni della settimana del giorno indicato, con quelli in cui la routine è stata fatta. */
export function rigaSettimana(i: Item, day: string): GiornoSettimana[] {
  const log = new Set(i.log ?? []);
  return weekDays(day).map((d) => ({ day: d, fatto: log.has(d), oggi: d === day }));
}

/** Etichetta del conteggio: "2/3" con quota settimanale, "4/7" per le giornaliere. */
export function conteggio(i: Item, day: string): string {
  const n = weekCount(i, day);
  return `${n}/${i.volteSettimana ?? 7}`;
}
