// Stima dei tempi con margine (editor della nota). Il margine è il **tempo da aggiungere** alle tue stime, con segno: è la media
// pesata dello scostamento (reale − stimato, in proporzione alla stima) di tutte le attività completate con tempo stimato e tempo
// reale (`durataRealeMin`, misurato dall'app). Il peso di ogni attività è il prodotto di due cose: quanto è recente (si dimezza ogni
// EMIVITA_GIORNI dal completamento) e quanto è lunga (la radice della stima: un errore su 2 ore conta più dello stesso errore
// percentuale su 20 minuti, ma non in proporzione). Stime troppo corte lo fanno salire (positivo, da aggiungere); stime troppo
// abbondanti lo fanno scendere, anche sotto zero (negativo: stai stimando più del necessario).
//
// Il giudizio su una singola nota (`livelloNota`) tiene conto anche dei minuti: un errore piccolo in assoluto non è «sbagliato».
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

/** Peso di una nota nel margine: quanto è recente per la radice della stima (le note lunghe contano di più, ma non in proporzione). */
export const pesoMargine = (completatoTs: number, stimaMin: number, adesso: number = Date.now()) => pesoNota(completatoTs, adesso) * Math.sqrt(stimaMin);

/** Sotto questa differenza (minuti) una nota non può essere «sbagliata», al massimo «media»; sotto la metà è «buona». */
export const MINUTI_NOTA_SBAGLIATA = 10;
export const MINUTI_NOTA_MEDIA = 5;

/**
 * Il giudizio su una singola nota (colore delle barre e dei numeri nello storico): parte dal livello dello scostamento in percentuale
 * (±15% buono, ±30% medio, oltre sbagliato) ma un errore piccolo in assoluto vale meno: fino a 10 minuti di differenza una nota non è
 * mai «sbagliata» e sotto i 5 minuti è «buona», così 5 minuti su una nota da 10 non sono un errore grave.
 */
export function livelloNota(stimaMin: number, realeMin: number): LivelloMargine {
  const diff = Math.abs(realeMin - stimaMin);
  let l = livelloMargine(scostamento(stimaMin, realeMin));
  if (l === 'sbagliato' && diff <= MINUTI_NOTA_SBAGLIATA) l = 'medio';
  if (l === 'medio' && diff < MINUTI_NOTA_MEDIA) l = 'buono';
  return l;
}

/** Una nota dello storico del margine: stimato, reale, scostamento (anche in minuti), livello e peso nel calcolo di oggi (0-1 rispetto alla nota che pesa di più). */
export interface NotaStorico { item: Item; stimaMin: number; realeMin: number; scostamento: number; differenzaMin: number; livello: LivelloMargine; completatoTs: number; peso: number }

/**
 * Le note completate con stima e tempo reale, la più recente prima: sono quelle che formano il margine (pagina «Storico del margine»).
 * Con `quante` (> 0) solo le ultime `quante`.
 */
export function storicoNote(items: Item[], adesso: number = Date.now(), quante = 0): NotaStorico[] {
  const lista = misurate(items)
    .filter((i) => !!i.sforzoMin)
    .map((i) => {
      const ts = i.completatoTs ?? i.aggiornato;
      return { item: i, stimaMin: i.sforzoMin!, realeMin: i.durataRealeMin!, scostamento: scostamento(i.sforzoMin!, i.durataRealeMin!), differenzaMin: i.durataRealeMin! - i.sforzoMin!, livello: livelloNota(i.sforzoMin!, i.durataRealeMin!), completatoTs: ts, peso: pesoMargine(ts, i.sforzoMin!, adesso) };
    })
    .sort((a, b) => b.completatoTs - a.completatoTs);
  const massimo = Math.max(...lista.map((n) => n.peso), 0);
  const normalizzata = massimo > 0 ? lista.map((n) => ({ ...n, peso: n.peso / massimo })) : lista;
  return quante > 0 ? normalizzata.slice(0, quante) : normalizzata;
}

/** Margine atteso: media pesata degli scostamenti delle attività misurate con una stima; pesano di più le più recenti e le più lunghe (radice della stima). */
export function margineAtteso(items: Item[], adesso = Date.now()): number {
  let somma = 0;
  let pesi = 0;
  for (const i of misurate(items)) {
    if (!i.sforzoMin) continue;
    const peso = pesoMargine(i.completatoTs ?? i.aggiornato, i.sforzoMin, adesso);
    somma += peso * scostamento(i.sforzoMin, i.durataRealeMin!);
    pesi += peso;
  }
  return pesi > 0 ? Math.min(MARGINE_MAX, Math.max(MARGINE_MIN, somma / pesi)) : MARGINE_INIZIALE;
}

/** Una barra del foglio del margine: scostamento in proporzione, differenza in minuti e giudizio sulla nota. */
export interface BarraNota { scostamento: number; differenzaMin: number; livello: LivelloMargine }

/** La barra di una nota con stima e tempo reale (in minuti). */
export const barraNota = (stimaMin: number, realeMin: number): BarraNota => ({ scostamento: scostamento(stimaMin, realeMin), differenzaMin: realeMin - stimaMin, livello: livelloNota(stimaMin, realeMin) });

/**
 * Le barre delle ultime `quante` attività completate con stima e tempo reale, dalla meno recente alla più recente: sono le barre del
 * foglio del margine. Scostamento positivo = ci è voluto più del previsto.
 */
export function ultimeNote(items: Item[], quante = 7): BarraNota[] {
  return misurate(items)
    .filter((i) => !!i.sforzoMin)
    .sort((a, b) => (a.completatoTs ?? a.aggiornato) - (b.completatoTs ?? b.aggiornato))
    .slice(-quante)
    .map((i) => barraNota(i.sforzoMin!, i.durataRealeMin!));
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
