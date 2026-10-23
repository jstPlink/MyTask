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

/** Quanto pesa oggi una nota completata in `completatoTs`: 1 se è di adesso, si dimezza ogni EMIVITA_GIORNI. */
export function pesoNota(completatoTs: number, adesso: number = Date.now()): number {
  return 0.5 ** (Math.max(0, adesso - completatoTs) / 86_400_000 / EMIVITA_GIORNI);
}

/** Una nota dello storico del margine: stimato, reale, scostamento e peso nel calcolo di oggi. */
export interface NotaStorico { item: Item; stimaMin: number; realeMin: number; scostamento: number; completatoTs: number; peso: number }

/**
 * Le note completate con stima e tempo reale, la più recente prima: sono quelle che formano il margine (pagina «Storico del margine»).
 * Con `quante` (> 0) solo le ultime `quante`.
 */
export function storicoNote(items: Item[], adesso: number = Date.now(), quante = 0): NotaStorico[] {
  const lista = misurate(items)
    .filter((i) => !!i.sforzoMin)
    .map((i) => {
      const ts = i.completatoTs ?? i.aggiornato;
      return { item: i, stimaMin: i.sforzoMin!, realeMin: i.durataRealeMin!, scostamento: scostamento(i.sforzoMin!, i.durataRealeMin!), completatoTs: ts, peso: pesoNota(ts, adesso) };
    })
    .sort((a, b) => b.completatoTs - a.completatoTs);
  return quante > 0 ? lista.slice(0, quante) : lista;
}

/** Margine atteso: media pesata degli scostamenti delle attività misurate con una stima; le più recenti pesano di più. */
export function margineAtteso(items: Item[], adesso = Date.now()): number {
  let somma = 0;
  let pesi = 0;
  for (const i of misurate(items)) {
    if (!i.sforzoMin) continue;
    const peso = pesoNota(i.completatoTs ?? i.aggiornato, adesso);
    somma += peso * scostamento(i.sforzoMin, i.durataRealeMin!);
    pesi += peso;
  }
  return pesi > 0 ? Math.min(MARGINE_MAX, Math.max(MARGINE_MIN, somma / pesi)) : MARGINE_INIZIALE;
}

/**
 * Lo scostamento (reale − stimato, in proporzione alla stima) delle ultime `quante` attività completate con stima e tempo reale,
 * dalla meno recente alla più recente: sono le barre del foglio del margine. Positivo = ci è voluto più del previsto.
 */
export function ultimeNote(items: Item[], quante = 7): number[] {
  return misurate(items)
    .filter((i) => !!i.sforzoMin)
    .sort((a, b) => (a.completatoTs ?? a.aggiornato) - (b.completatoTs ?? b.aggiornato))
    .slice(-quante)
    .map((i) => scostamento(i.sforzoMin!, i.durataRealeMin!));
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

/** Quanto è giusto un margine: vicino a zero va bene, in qualsiasi direzione (+ o −). */
export type LivelloMargine = 'buono' | 'medio' | 'sbagliato';
/** Fino a ±15% la stima è buona, fino a ±30% media, oltre ±30% sbagliata (stessi limiti per il margine positivo e negativo). */
export const SOGLIA_MARGINE_BUONO = 15;
export const SOGLIA_MARGINE_MEDIO = 30;

/** Livello di un margine (in proporzione: 0,15 = +15%) o di uno scostamento: dipende solo dal valore assoluto, arrotondato alla percentuale intera. */
export function livelloMargine(valore: number): LivelloMargine {
  const p = Math.abs(Math.round(valore * 100));
  return p <= SOGLIA_MARGINE_BUONO ? 'buono' : p <= SOGLIA_MARGINE_MEDIO ? 'medio' : 'sbagliato';
}

/** Margine con segno: «+15%», «−20%», «0%». */
export const percentuale = (margine: number) => {
  const p = Math.round(margine * 100);
  return p > 0 ? `+${p}%` : p < 0 ? `−${-p}%` : '0%';
};

/** Tempo da mettere in conto per una stima con il suo margine (stima + margine), in minuti. */
export const tempoAtteso = (minuti: number, margine: number) => Math.max(1, Math.round(minuti * (1 + margine)));
