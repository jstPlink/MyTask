// Stima dei tempi con margine (editor della nota). Il margine è il **tempo da aggiungere** alle tue stime, con segno: è la media
// pesata dello scostamento (reale − stimato, in proporzione alla stima) di tutte le attività completate con tempo stimato e tempo
// reale (`durataRealeMin`, misurato dall'app). Il peso di ogni attività si dimezza ogni EMIVITA_GIORNI dal suo completamento,
// quindi contano di più le più recenti. Stime troppo corte lo fanno salire (positivo, da aggiungere); stime troppo abbondanti
// lo fanno scendere, anche sotto zero (negativo: stai stimando più del necessario).
import type { Item } from './types.ts';
import { chiaveTitolo } from './testo.ts';

/** Margine di partenza: 0% (nessun dato, nessuna correzione). */
export const MARGINE_INIZIALE = 0;
/** Ogni quanti giorni dal completamento il peso di un'attività si dimezza. */
export const EMIVITA_GIORNI = 21;
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

/** Margine atteso: media pesata degli scostamenti delle attività misurate con una stima; le più recenti pesano di più. */
export function margineAtteso(items: Item[], adesso = Date.now()): number {
  let somma = 0;
  let pesi = 0;
  for (const i of misurate(items)) {
    if (!i.sforzoMin) continue;
    const giorni = Math.max(0, (adesso - (i.completatoTs ?? i.aggiornato)) / 86_400_000);
    const peso = 0.5 ** (giorni / EMIVITA_GIORNI);
    somma += peso * scostamento(i.sforzoMin, i.durataRealeMin!);
    pesi += peso;
  }
  return pesi > 0 ? Math.min(MARGINE_MAX, Math.max(MARGINE_MIN, somma / pesi)) : MARGINE_INIZIALE;
}

/**
 * Il margine com'era alla fine di ognuna delle ultime `settimane` settimane (dalla più lontana alla più vicina), calcolato solo con
 * le attività completate fino a quel momento. Le settimane in cui non c'era ancora nessun dato si saltano.
 */
export function storicoMargine(items: Item[], adesso = Date.now(), settimane = 5): number[] {
  const SETTIMANA = 7 * 86_400_000;
  const fatte = misurate(items).filter((i) => !!i.sforzoMin);
  const fine = (i: Item) => i.completatoTs ?? i.aggiornato;
  const out: number[] = [];
  for (let k = settimane; k >= 1; k--) {
    const t = adesso - k * SETTIMANA;
    const fino = fatte.filter((i) => fine(i) <= t);
    if (fino.length) out.push(margineAtteso(fino, t));
  }
  return out;
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
