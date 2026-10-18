import type { Item } from './types.ts';
import { diffDays } from './dates.ts';

const CHIUSI = new Set(['fatto', 'saltato']);

export const isClosed = (i: Item) => CHIUSI.has(i.stato);
export const isOpen = (i: Item) => !CHIUSI.has(i.stato) && !i.eliminato;

/** Data rilevante per le scadenze: la fine, altrimenti l'inizio. */
export function dueDate(i: Item): string | undefined {
  return i.fine ?? i.inizio;
}

/** Giorni di ritardo (0 se non scaduta o senza data). */
export function daysOverdue(i: Item, today: string): number {
  const due = dueDate(i);
  if (!due || isClosed(i)) return 0;
  const d = diffDays(today, due);
  return d > 0 ? d : 0;
}

export function isOverdue(i: Item, today: string): boolean {
  return daysOverdue(i, today) > 0;
}

export function urgency(i: Item, today: string): number {
  const due = dueDate(i);
  if (!due) return 0;
  const days = diffDays(due, today);
  let u: number;
  if (days <= 0) u = 100;
  else if (days <= 3) u = 80;
  else if (days <= 7) u = 60;
  else if (days <= 30) u = 35;
  else u = 15;
  return u;
}

/** Battiti al minuto del pallino di priorità: 0 (fermo) senza scadenza, da 10 (urgenza 15) a 80 (urgenza 100). */
export function battitoBpm(urgenza: number): number {
  if (urgenza <= 0) return 0;
  const x = (Math.min(100, Math.max(15, urgenza)) - 15) / 85;
  return Math.round(10 + x * 70);
}

export interface ComponentiPunteggio { urgenza: number; importanza: number; sforzo: number; eta: number; fissa: number }

/** Le quattro componenti del punteggio, ognuna da 0 a 100 prima di applicare il suo peso. */
export function componentiPunteggio(i: Item, today: string, now: number = Date.now()): ComponentiPunteggio {
  const importanza = ((i.importanza ?? 3) - 1) / 4 * 100;
  const sforzo = i.sforzoMin === undefined ? 30 : i.sforzoMin <= 15 ? 100 : i.sforzoMin <= 30 ? 60 : i.sforzoMin <= 60 ? 30 : 0;
  const settimane = Math.max(0, (now - i.creato) / (7 * 86400000));
  const eta = Math.min(10, settimane) / 10 * 100;
  // scadenza fissa: parametro a parte, vale quanto l'urgenza ma solo per le date che non si possono spostare
  const urgenza = urgency(i, today);
  const fissa = i.rigida && dueDate(i) ? urgenza : 0;
  return { urgenza, importanza, sforzo, eta, fissa };
}

/** Peso di ogni componente nel punteggio. */
export type PesiPunteggio = ComponentiPunteggio;

/**
 * Pesi di base: la scadenza fissa pesa il 20%, il resto si divide come prima (45% urgenza, 35% importanza, 10% poco sforzo,
 * 10% età) e quindi 36/28/8/8. Le note senza scadenza fissa non risentono del 20%: il loro punteggio è come prima.
 */
export const PESI_PREDEFINITI: PesiPunteggio = { urgenza: 0.36, importanza: 0.28, sforzo: 0.08, eta: 0.08, fissa: 0.20 };

let pesiAttivi: PesiPunteggio = { ...PESI_PREDEFINITI };

/** Porta i pesi a somma 1 (così il punteggio resta tra 0 e 100); se sono tutti zero tornano quelli di base. */
export function normalizzaPesi(p: PesiPunteggio): PesiPunteggio {
  const v = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const somma = v(p.urgenza) + v(p.importanza) + v(p.sforzo) + v(p.eta) + v(p.fissa);
  if (somma <= 0) return { ...PESI_PREDEFINITI };
  return { urgenza: v(p.urgenza) / somma, importanza: v(p.importanza) / somma, sforzo: v(p.sforzo) / somma, eta: v(p.eta) / somma, fissa: v(p.fissa) / somma };
}

export const getPesi = (): PesiPunteggio => pesiAttivi;
/** Opzione provvisoria: cambia i pesi usati da tutto il calcolo delle priorità. */
export function impostaPesi(p: PesiPunteggio | undefined) { pesiAttivi = p ? normalizzaPesi(p) : { ...PESI_PREDEFINITI }; }

/** Punteggio 0-100 di un'azione o di un progetto (formula in DOCUMENTAZIONE.md, sezione 4.1). */
export function score(i: Item, today: string, now: number = Date.now()): number {
  const c = componentiPunteggio(i, today, now);
  const w = pesiAttivi;
  // i quattro parametri di sempre, riportati a somma 1 tra loro: una nota senza scadenza fissa non perde mai punti
  const resto = w.urgenza + w.importanza + w.sforzo + w.eta;
  const base = resto > 0 ? (w.urgenza * c.urgenza + w.importanza * c.importanza + w.sforzo * c.sforzo + w.eta * c.eta) / resto : 0;
  // la scadenza fissa è un parametro a parte: riempie una parte dello spazio che manca al 100 (più il peso, più sale)
  const s = base + (100 - base) * w.fissa * (c.fissa / 100);
  return Math.round(Math.min(100, Math.max(0, s)));
}

/** Livello 1-3 della barra di priorità nelle liste. */
export function barLevel(punteggio: number): 1 | 2 | 3 {
  if (punteggio >= 60) return 3;
  if (punteggio >= 35) return 2;
  return 1;
}

/** Un sotto-task eredita importanza e scadenza dal progetto se non le ha. */
export function withInheritance(child: Item, parent: Item | undefined): Item {
  if (!parent) return child;
  return {
    ...child,
    importanza: child.importanza ?? parent.importanza,
    fine: child.fine ?? (child.inizio ? undefined : parent.fine),
    rigida: child.rigida ?? parent.rigida,
  };
}
