// Priorità delle azioni e dei progetti: scadenze, urgenza e punteggio da 0 a 100 che ordina Oggi e le liste.
// Il punteggio unisce cinque componenti (urgenza, importanza, poco sforzo, età, scadenza fissa) con pesi regolabili
// da Altro › «Pesi della priorità» (restano solo sul dispositivo). Funzioni pure, tranne i pesi attivi, che sono uno stato del modulo.
import type { Item } from './types.ts';
import { diffDays } from './dates.ts';

const CHIUSI = new Set(['fatto', 'saltato']);

/** Chiusa: fatta o saltata. */
export const isClosed = (i: Item) => CHIUSI.has(i.stato);
/** Aperta: non chiusa e non eliminata (le voci «parcheggiate», cioè archiviate, restano aperte: le liste le escludono a parte). */
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

/** Scaduta: la data rilevante è passata e la voce non è chiusa. Non è uno stato salvato. */
export function isOverdue(i: Item, today: string): boolean {
  return daysOverdue(i, today) > 0;
}

/**
 * Urgenza da 0 a 100 secondo la distanza della scadenza: scaduta o oggi 100, entro 3 giorni 80, entro 7 giorni 60,
 * entro 30 giorni 35, oltre 15; senza data 0.
 */
export function urgency(i: Item, today: string): number {
  const due = dueDate(i);
  if (!due) return 0;
  const days = diffDays(due, today);
  if (days <= 0) return 100;
  if (days <= 3) return 80;
  if (days <= 7) return 60;
  if (days <= 30) return 35;
  return 15;
}

/** Battiti al minuto del pallino di priorità: 0 (fermo) senza scadenza, da 10 (urgenza 15) a 80 (urgenza 100). */
export function battitoBpm(urgenza: number): number {
  if (urgenza <= 0) return 0;
  const x = (Math.min(100, Math.max(15, urgenza)) - 15) / 85;
  return Math.round(10 + x * 70);
}

export interface ComponentiPunteggio { urgenza: number; importanza: number; sforzo: number; eta: number; fissa: number }

/**
 * Le componenti del punteggio, ognuna da 0 a 100 prima di applicare il suo peso:
 * - importanza: da 1 a 5 (di base 3) riportata su 0-100;
 * - sforzo: premia le attività brevi (fino a 15 min 100, fino a 30 min 60, fino a 60 min 30, oltre 0; senza stima 30);
 * - età: cresce con le settimane dalla creazione, fino a 10 settimane (100), perché le voci non marciscano;
 * - scadenza fissa: vale come l'urgenza, ma solo per le note con una data non spostabile (`rigida`), altrimenti 0.
 */
export function componentiPunteggio(i: Item, today: string, now: number = Date.now()): ComponentiPunteggio {
  const importanza = ((i.importanza ?? 3) - 1) / 4 * 100;
  const sforzo = i.sforzoMin === undefined ? 30 : i.sforzoMin <= 15 ? 100 : i.sforzoMin <= 30 ? 60 : i.sforzoMin <= 60 ? 30 : 0;
  const settimane = Math.max(0, (now - i.creato) / (7 * 86400000));
  const eta = Math.min(10, settimane) / 10 * 100;
  const urgenza = urgency(i, today);
  const fissa = i.rigida && dueDate(i) ? urgenza : 0;
  return { urgenza, importanza, sforzo, eta, fissa };
}

/** Peso di ogni componente nel punteggio. */
export type PesiPunteggio = ComponentiPunteggio;

/**
 * Pesi di base: la scadenza fissa pesa il 20%, il resto si divide in 45% urgenza, 35% importanza, 10% poco sforzo
 * e 10% età, quindi 36/28/8/8. Le note senza scadenza fissa non risentono del 20%: vedi `score`.
 */
export const PESI_PREDEFINITI: PesiPunteggio = { urgenza: 0.36, importanza: 0.28, sforzo: 0.08, eta: 0.08, fissa: 0.20 };

/** Pesi in uso da tutto il calcolo delle priorità (liste, Oggi, widget). */
let pesiAttivi: PesiPunteggio = { ...PESI_PREDEFINITI };

/** Porta i pesi a somma 1 (così il punteggio resta tra 0 e 100); se sono tutti zero tornano quelli di base. */
export function normalizzaPesi(p: PesiPunteggio): PesiPunteggio {
  const v = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const somma = v(p.urgenza) + v(p.importanza) + v(p.sforzo) + v(p.eta) + v(p.fissa);
  if (somma <= 0) return { ...PESI_PREDEFINITI };
  return { urgenza: v(p.urgenza) / somma, importanza: v(p.importanza) / somma, sforzo: v(p.sforzo) / somma, eta: v(p.eta) / somma, fissa: v(p.fissa) / somma };
}

/** I pesi attualmente in uso. */
export const getPesi = (): PesiPunteggio => pesiAttivi;
/** Cambia i pesi usati da tutto il calcolo delle priorità; senza argomento torna a quelli di base. */
export function impostaPesi(p: PesiPunteggio | undefined) { pesiAttivi = p ? normalizzaPesi(p) : { ...PESI_PREDEFINITI }; }

/** Punteggio 0-100 di un'azione o di un progetto (formula in docs/DOCUMENTAZIONE.md, sezione 4.1). */
export function score(i: Item, today: string, now: number = Date.now()): number {
  const c = componentiPunteggio(i, today, now);
  const w = pesiAttivi;
  // urgenza, importanza, sforzo ed età, riportati a somma 1 tra loro: una nota senza scadenza fissa non perde mai punti
  const resto = w.urgenza + w.importanza + w.sforzo + w.eta;
  const base = resto > 0 ? (w.urgenza * c.urgenza + w.importanza * c.importanza + w.sforzo * c.sforzo + w.eta * c.eta) / resto : 0;
  // la scadenza fissa è un parametro a parte: riempie una parte dello spazio che manca al 100 (più il peso, più sale)
  const s = base + (100 - base) * w.fissa * (c.fissa / 100);
  return Math.round(Math.min(100, Math.max(0, s)));
}

/** Livello 1-3 della barra di priorità nelle liste: da 60 in su alta, da 35 media, altrimenti bassa. */
export function barLevel(punteggio: number): 1 | 2 | 3 {
  if (punteggio >= 60) return 3;
  if (punteggio >= 35) return 2;
  return 1;
}

/** Un passo di progetto eredita importanza, scadenza e scadenza fissa dal progetto se non le ha (una data d'inizio sua esclude la scadenza del progetto). */
export function withInheritance(child: Item, parent: Item | undefined): Item {
  if (!parent) return child;
  return {
    ...child,
    importanza: parent.importanza ?? child.importanza, // l'importanza di un passo è quella del progetto
    fine: child.fine ?? (child.inizio ? undefined : parent.fine),
    rigida: child.rigida ?? parent.rigida,
  };
}
