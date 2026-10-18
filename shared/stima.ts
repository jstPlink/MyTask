// Stima dei tempi con margine d'errore (editor della nota, piano di Oggi). Il margine parte da un valore di partenza e si affina da solo:
// ogni attività completata con tempo stimato e tempo reale (`durataRealeMin`, misurato dall'app) ne sposta il valore.
import type { Item } from './types.ts';
import { chiaveTitolo } from './testo.ts';

/** Margine di partenza (±30%): conta come qualche attività già misurata, poi cede il posto ai dati veri. */
export const MARGINE_INIZIALE = 0.3;
/** Quante attività misurate «vale» il margine di partenza nella media. */
const PESO_INIZIALE = 3;
/** Il margine atteso resta tra ±5% e ±100%. */
export const MARGINE_MIN = 0.05;
export const MARGINE_MAX = 1;
/** Somiglianza minima (0-1, parole in comune sul totale) perché un titolo conti come «simile». */
const SOGLIA_SIMILE = 0.34;
/** Al massimo questi titoli simili entrano nella stima. */
const MAX_SIMILI = 5;
/** Parole troppo comuni per giudicare la somiglianza dei titoli. */
const PAROLE_VUOTE = new Set(['il', 'lo', 'la', 'le', 'gli', 'un', 'una', 'uno', 'di', 'da', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'per', 'con', 'in', 'su', 'che', 'the', 'and']);

export interface Stima {
  minuti: number;
  /** Errore atteso in proporzione (0,3 = ±30%). */
  margine: number;
  /** Da cosa nasce: attività simili già fatte, oppure solo il margine di partenza. */
  fonte: 'simili' | 'nessuna';
  campioni: number;
}

const parole = (t: string) => new Set(chiaveTitolo(t).split(' ').filter((p) => p.length >= 3 && !PAROLE_VUOTE.has(p)));

/** Somiglianza tra due titoli: parole in comune (da 3 lettere, senza articoli e preposizioni) sul totale delle parole distinte, da 0 a 1. */
export function somiglianza(a: string, b: string): number {
  const x = parole(a);
  const y = parole(b);
  if (!x.size || !y.size) return 0;
  let comuni = 0;
  for (const p of x) if (y.has(p)) comuni++;
  return comuni / (x.size + y.size - comuni);
}

/** Attività completate con tempo reale registrato. */
const misurate = (items: Item[]) => items.filter((i) => !i.eliminato && i.tipo === 'azione' && i.stato === 'fatto' && !!i.durataRealeMin);

/** Errore relativo di una singola attività: |reale − stimato| / stimato. */
const errore = (i: Item) => Math.abs(i.durataRealeMin! - i.sforzoMin!) / i.sforzoMin!;

/** Margine d'errore atteso: media degli errori passati, mescolata con il valore di partenza finché i dati sono pochi. */
export function margineAtteso(items: Item[]): number {
  const conStima = misurate(items).filter((i) => !!i.sforzoMin);
  const somma = conStima.reduce((s, i) => s + Math.min(errore(i), MARGINE_MAX), 0);
  const m = (PESO_INIZIALE * MARGINE_INIZIALE + somma) / (PESO_INIZIALE + conStima.length);
  return Math.min(MARGINE_MAX, Math.max(MARGINE_MIN, m));
}

/** Stima per una nuova attività in base a quelle simili già fatte (mediana dei loro tempi reali). */
export function stimaPer(titolo: string, items: Item[]): Stima | undefined {
  const simili = misurate(items)
    .map((i) => ({ i, s: somiglianza(titolo, i.titolo) }))
    .filter((x) => x.s >= SOGLIA_SIMILE)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_SIMILI);
  if (!simili.length) return undefined;
  const tempi = simili.map((x) => x.i.durataRealeMin!).sort((a, b) => a - b);
  const mezzo = Math.floor(tempi.length / 2);
  const mediana = tempi.length % 2 ? tempi[mezzo] : (tempi[mezzo - 1] + tempi[mezzo]) / 2;
  const minuti = Math.max(5, Math.round(mediana / 5) * 5);
  // l'errore delle attività simili pesa più di quello generale, se hanno una stima confrontabile
  const conStima = simili.filter((x) => !!x.i.sforzoMin);
  const generale = margineAtteso(items);
  const margine = conStima.length >= 2
    ? Math.min(MARGINE_MAX, Math.max(MARGINE_MIN, (conStima.reduce((s, x) => s + errore(x.i), 0) + generale) / (conStima.length + 1)))
    : generale;
  return { minuti, margine, fonte: 'simili', campioni: simili.length };
}

/** "±30%". */
export const percentuale = (margine: number) => `±${Math.round(margine * 100)}%`;

/** Intervallo di tempo atteso per una stima con il suo margine, in minuti. */
export function intervallo(minuti: number, margine: number): [number, number] {
  return [Math.max(1, Math.round(minuti * (1 - margine))), Math.round(minuti * (1 + margine))];
}
