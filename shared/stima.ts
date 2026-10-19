// Stima dei tempi con margine (editor della nota). Il margine è il **tempo da aggiungere** alle tue stime, con segno: parte da 0%
// e dopo ogni attività completata con tempo stimato e tempo reale (`durataRealeMin`, misurato dall'app) si sposta del 35% della
// differenza tra reale e stimato (in proporzione alla stima). Stime troppo corte lo fanno salire (positivo, da aggiungere);
// stime troppo abbondanti lo fanno scendere, anche sotto zero (negativo: stai stimando più del necessario).
import type { Item } from './types.ts';
import { chiaveTitolo } from './testo.ts';

/** Margine di partenza: 0% (nessun dato, nessuna correzione). */
export const MARGINE_INIZIALE = 0;
/** Ogni attività misurata sposta il margine del 35% della differenza tra tempo reale e stimato (in proporzione alla stima). */
export const PASSO_MARGINE = 0.35;
/** Il margine resta tra −50% e +150%. */
export const MARGINE_MIN = -0.5;
export const MARGINE_MAX = 1.5;
/** Somiglianza minima (0-1, parole in comune sul totale) perché un titolo conti come «simile». */
const SOGLIA_SIMILE = 0.34;
/** Al massimo questi titoli simili entrano nella stima. */
const MAX_SIMILI = 5;
/** Parole troppo comuni per giudicare la somiglianza dei titoli. */
const PAROLE_VUOTE = new Set(['il', 'lo', 'la', 'le', 'gli', 'un', 'una', 'uno', 'di', 'da', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'per', 'con', 'in', 'su', 'che', 'the', 'and']);

export interface Stima {
  minuti: number;
  /** Margine in proporzione, con segno (0,15 = +15% da aggiungere, −0,2 = stime abbondanti del 20%). */
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

/** Differenza di una singola attività in proporzione alla stima: (reale − stimato) / stimato. Positiva se la stima era troppo corta. */
export const scostamento = (stimaMin: number, realeMin: number) => (realeMin - stimaMin) / stimaMin;

/** Il margine dopo una attività: si sposta del 35% dello scostamento, restando tra il minimo e il massimo. */
export const margineDopo = (margine: number, stimaMin: number, realeMin: number) =>
  Math.min(MARGINE_MAX, Math.max(MARGINE_MIN, margine + PASSO_MARGINE * scostamento(stimaMin, realeMin)));

/** Margine atteso: parte da 0% e segue, nell'ordine di completamento, le attività misurate con una stima. */
export function margineAtteso(items: Item[]): number {
  return misurate(items)
    .filter((i) => !!i.sforzoMin)
    .sort((a, b) => (a.completatoTs ?? a.aggiornato) - (b.completatoTs ?? b.aggiornato))
    .reduce((m, i) => margineDopo(m, i.sforzoMin!, i.durataRealeMin!), MARGINE_INIZIALE);
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
  return { minuti, margine: margineAtteso(items), fonte: 'simili', campioni: simili.length };
}

/** Quante attività con stima e tempo reale hanno già contribuito al margine. */
export const stimeMisurate = (items: Item[]) => misurate(items).filter((i) => !!i.sforzoMin).length;

/** Margine con segno: «+15%», «−20%», «0%». */
export const percentuale = (margine: number) => {
  const p = Math.round(margine * 100);
  return p > 0 ? `+${p}%` : p < 0 ? `−${-p}%` : '0%';
};

/** Tempo da mettere in conto per una stima con il suo margine (stima + margine), in minuti. */
export const tempoAtteso = (minuti: number, margine: number) => Math.max(1, Math.round(minuti * (1 + margine)));
