// Priorità delle azioni e dei progetti: scadenze e punteggio da 0 a 100 che decide ordine, colore e battito del pallino.
// Il punteggio unisce tre componenti (scadenza, importanza, tempo stimato) con pesi regolabili da Altro › «Bilanciatore della priorità».
// Funzioni pure, tranne i pesi attivi, che sono uno stato del modulo.
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

/** Aumento della frequenza del battito rispetto alla scala di base (10-80 bpm). */
const BATTITO_PIU = 1.10;
/** Calo del battito per ogni posto in classifica (2 punti percentuali), fino a un massimo del 30%. */
const BATTITO_CALO_POSTO = 0.02;

/**
 * Battiti al minuto del pallino di priorità: 0 (fermo) con intensità 0; da 11 (intensità 15) a 88 (intensità 100), cioè la scala 10-80
 * aumentata del 10%; più la nota è in basso nella lista, più il battito cala (2 punti percentuali a posto, al massimo 30%).
 */
export function battitoBpm(intensita: number, posizione?: number): number {
  if (intensita <= 0) return 0;
  const x = (Math.min(100, Math.max(15, intensita)) - 15) / 85;
  const calo = posizione === undefined ? 0 : Math.min(0.3, Math.max(0, posizione - 1) * BATTITO_CALO_POSTO);
  return Math.round((10 + x * 70) * BATTITO_PIU * (1 - calo));
}

/**
 * Urgenza della scadenza da 0 a 100 secondo la distanza della data: scaduta o oggi 100, entro 3 giorni 80, entro 7 giorni 60,
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

/** Punti (0-100) del tempo stimato: premia le cose brevi (fino a 15 min 100, fino a 30 min 60, fino a 60 min 30, oltre 0; senza stima 30). */
export function puntiTempo(sforzoMin?: number): number {
  return sforzoMin === undefined ? 30 : sforzoMin <= 15 ? 100 : sforzoMin <= 30 ? 60 : sforzoMin <= 60 ? 30 : 0;
}

/** Pesi della priorità di una curiosità: il tempo stimato pesa poco più dell'interesse (55% e 45%). */
export const PESI_CURIOSITA = { tempo: 0.55, interesse: 0.45 };

/**
 * Punteggio di priorità di una curiosità, da 0 a 100: 55% il tempo stimato (stessa scala delle attività: meglio se breve) e 45% l'interesse
 * (da 1 a 5, riportato su 0-100; senza interesse vale 3). Dà l'ordine delle curiosità, il colore e il battito del loro pallino numerato.
 */
export function punteggioCuriosita(i: Item): number {
  const interesse = ((Math.min(5, Math.max(1, i.interesse ?? 3)) - 1) / 4) * 100;
  return Math.round(Math.min(100, Math.max(0, PESI_CURIOSITA.tempo * puntiTempo(i.sforzoMin) + PESI_CURIOSITA.interesse * interesse)));
}

/** Intensità (0-100) del battito dal punteggio di una curiosità: come per le attività, il grigio (sotto 35) non batte. */
export function intensitaBattitoCuriosita(punteggio: number): number {
  return livelloDaPunteggio(punteggio) === 1 ? 0 : punteggio;
}

/** Le tre componenti del punteggio, ognuna da 0 a 100 prima di applicare il suo peso. */
export interface ComponentiPunteggio { scadenza: number; importanza: number; tempo: number }

/**
 * Le componenti del punteggio:
 * - scadenza: l'urgenza della data (`urgency`), 0 senza data;
 * - importanza: da 1 a 5 (di base 3) riportata su 0-100;
 * - tempo stimato: premia le attività brevi (fino a 15 min 100, fino a 30 min 60, fino a 60 min 30, oltre 0; senza stima 30).
 */
export function componentiPunteggio(i: Item, today: string): ComponentiPunteggio {
  return {
    scadenza: urgency(i, today),
    importanza: (((i.importanza ?? 3) - 1) / 4) * 100,
    tempo: puntiTempo(i.sforzoMin),
  };
}

/** Peso di ogni componente nel punteggio (somma 1). */
export type PesiPunteggio = ComponentiPunteggio;

/** Pesi di base: scadenza 50%, importanza 40%, tempo stimato 10%. */
export const PESI_PREDEFINITI: PesiPunteggio = { scadenza: 0.5, importanza: 0.4, tempo: 0.1 };

/** Pesi in uso da tutto il calcolo delle priorità (liste, Priorità, widget). */
let pesiAttivi: PesiPunteggio = { ...PESI_PREDEFINITI };

/** Porta i pesi a somma 1 (così il punteggio resta tra 0 e 100); se sono tutti zero tornano quelli di base. */
export function normalizzaPesi(p: Partial<PesiPunteggio>): PesiPunteggio {
  const v = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
  const somma = v(p.scadenza) + v(p.importanza) + v(p.tempo);
  if (somma <= 0) return { ...PESI_PREDEFINITI };
  return { scadenza: v(p.scadenza) / somma, importanza: v(p.importanza) / somma, tempo: v(p.tempo) / somma };
}

/** I pesi attualmente in uso. */
export const getPesi = (): PesiPunteggio => pesiAttivi;
/** Cambia i pesi usati da tutto il calcolo delle priorità; senza argomento tornano quelli di base. */
export function impostaPesi(p: Partial<PesiPunteggio> | undefined) { pesiAttivi = p ? normalizzaPesi(p) : { ...PESI_PREDEFINITI }; }

/** Punteggio 0-100 di un'azione o di un progetto: la somma delle tre componenti, ognuna per il suo peso (sezione 6.1 della documentazione). */
export function score(i: Item, today: string): number {
  const c = componentiPunteggio(i, today);
  const w = pesiAttivi;
  return Math.round(Math.min(100, Math.max(0, w.scadenza * c.scadenza + w.importanza * c.importanza + w.tempo * c.tempo)));
}

/** Livello 1-3 del pallino dal punteggio: da 60 in su alta (rosso), da 35 media (ambra), altrimenti bassa (grigio). */
export function livelloDaPunteggio(punteggio: number): 1 | 2 | 3 {
  return punteggio >= 60 ? 3 : punteggio >= 35 ? 2 : 1;
}

/**
 * Livello 1-3 del pallino di priorità (3 rosso, 2 ambra, 1 grigio), dal punteggio della formula.
 * Per un passo di progetto si passa la voce con l'ereditarietà già applicata (`withInheritance`).
 */
export function livelloPriorita(i: Item, today: string): 1 | 2 | 3 {
  return livelloDaPunteggio(score(i, today));
}

/**
 * Chiave per ordinare le note (più alta = prima): il punteggio della formula, poi (a parità) la scadenza più vicina, l'importanza più alta
 * e la nota più vecchia. Non è un punteggio da mostrare: serve solo al confronto.
 */
export function chiavePriorita(i: Item, today: string, now: number = Date.now()): number {
  const due = dueDate(i);
  const g = due ? diffDays(due, today) : Infinity;
  const scad = Number.isFinite(g) ? 2000 - (Math.min(1000, Math.max(-400, g)) + 400) : 0; // 600-2000, più alta se più vicina; 0 senza data
  const imp = Math.round((i.importanza ?? 3) * 100); // 100-500
  const eta = Math.min(52, Math.floor(Math.max(0, now - i.creato) / (7 * 86400000)));
  return ((score(i, today) * 2001 + scad) * 1000 + imp) * 100 + eta;
}

/**
 * Intensità (0-100) che regola il battito del pallino, legata alla formula: il grigio (punteggio sotto 35) non batte; ambra e rosso battono
 * con il punteggio stesso, quindi più la formula sale più il pallino va veloce (circa 28 bpm a 35, 88 bpm a 100).
 */
export function intensitaBattito(i: Item, today: string): number {
  const punteggio = score(i, today);
  return livelloDaPunteggio(punteggio) === 1 ? 0 : punteggio;
}

/** Un passo di progetto eredita importanza e scadenza dal progetto se non le ha (una data d'inizio sua esclude la scadenza del progetto). */
export function withInheritance(child: Item, parent: Item | undefined): Item {
  if (!parent) return child;
  return {
    ...child,
    importanza: parent.importanza ?? child.importanza, // l'importanza di un passo è quella del progetto
    fine: child.fine ?? (child.inizio ? undefined : parent.fine),
  };
}
