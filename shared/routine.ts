import type { Item } from './types.ts';
import { startOfWeek, weekDays } from './dates.ts';

const attiva = (i: Item) => i.tipo === 'routine' && !i.eliminato && i.stato !== 'parcheggiato' && i.stato !== 'fatto' && i.stato !== 'saltato';

/** Quante volte la routine è stata fatta nella settimana (lunedì-domenica) che contiene `day`. */
export function weekCount(i: Item, day: string): number {
  const start = startOfWeek(day);
  const days = new Set(weekDays(start));
  return (i.log ?? []).filter((d) => days.has(d)).length;
}

export function fattaOggi(i: Item, day: string): boolean {
  return (i.log ?? []).includes(day);
}

/** La routine va mostrata oggi: sempre se giornaliera, altrimenti finché non ha raggiunto la quota settimanale. */
export function dueToday(i: Item, day: string): boolean {
  if (!attiva(i)) return false;
  if (!i.volteSettimana) return true;
  return fattaOggi(i, day) || weekCount(i, day) < i.volteSettimana;
}

export function routineDueToday(items: Item[], day: string): Item[] {
  return items.filter((i) => dueToday(i, day));
}

export function toggleOggi(i: Item, day: string, now: number): Item {
  const log = i.log ?? [];
  const nuovo = log.includes(day) ? log.filter((d) => d !== day) : [...log, day].sort();
  return { ...i, log: nuovo, aggiornato: now };
}

export interface GiornoSettimana { day: string; fatto: boolean; oggi: boolean }

export function rigaSettimana(i: Item, day: string): GiornoSettimana[] {
  const log = new Set(i.log ?? []);
  return weekDays(day).map((d) => ({ day: d, fatto: log.has(d), oggi: d === day }));
}

/** Etichetta del conteggio: "2/3" con quota settimanale, "4/7" per le giornaliere. */
export function conteggio(i: Item, day: string): string {
  const n = weekCount(i, day);
  return `${n}/${i.volteSettimana ?? 7}`;
}
