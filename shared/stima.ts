// Stima dei tempi con margine (editor della nota). Il margine è il **tempo da aggiungere** alle tue stime, con segno: stime troppo corte lo
// alzano (positivo), stime troppo abbondanti lo abbassano, anche sotto zero. È la **media pesata** degli scostamenti (reale − stimato, in
// proporzione alla stima) di attività e curiosità completate con tempo stimato e tempo reale (`durataRealeMin`, misurato dall'app). Il peso di
// ogni nota è il prodotto di tre curve, regolabili nel «bilanciatore del margine» (`ParametriMargine`): **età** (da quanti giorni è stata
// completata), **lunghezza** (la stima) ed **errore** (di quanto era sbagliata la stima). L'ordine delle note non conta di per sé: con la
// curva dell'età piatta due note uguali pesano uguale, vecchie o nuove; errori opposti con lo stesso peso si compensano.
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

/** Attività e curiosità completate con tempo reale registrato (le curiosità contano nel margine come le attività). */
const misurate = (items: Item[]) => items.filter((i) => !i.eliminato && (i.tipo === 'azione' || i.tipo === 'curiosita') && i.stato === 'fatto' && !!i.durataRealeMin);

/** Differenza di una singola attività in proporzione alla stima: (reale − stimato) / stimato. Positiva se la stima era troppo corta. */
export const scostamento = (stimaMin: number, realeMin: number) => (realeMin - stimaMin) / stimaMin;

/** Peso di base di una nota secondo l'errore: da PESO_SBAGLIATA (stima molto sbagliata) a PESO_GIUSTA (stima giusta). */
export const PESO_SBAGLIATA = 0.15;
export const PESO_GIUSTA = 0.7;
/** Scala della precisione di base: a questo scostamento (25%) la forza di una nota è già scesa a circa un terzo. */
export const SCALA_PRECISIONE = 0.25;
/** Quanto conta, rispetto a una nota di un'ora, una nota molto breve e una molto lunga (di base). */
export const FORZA_BREVE = 0.6;
export const FORZA_LUNGA = 1.4;
/** I minuti di stima di base fino a cui vale la forza «breve» e da cui vale la forza «lunga» (tra i due la curva sale con la radice). */
export const MINUTI_BREVE = 60 * FORZA_BREVE ** 2;
export const MINUTI_LUNGA = 60 * FORZA_LUNGA ** 2;
/** La distanza minima in minuti tra i due punti della curva della lunghezza. */
export const DISTANZA_PUNTI_MIN = 5;

/**
 * Il «bilanciatore del margine»: tre curve, ognuna descritta dai punti che si trascinano sul suo grafico.
 * I valori di base ridanno il calcolo di sempre.
 */
export interface ParametriMargine {
  /** Età: il peso di una nota vale 1 se completata oggi; ogni `emivita` giorni la parte che si consuma si dimezza e non scende sotto `minimo` (0-1). */
  eta: { emivita: number; minimo: number };
  /** Lunghezza: fino a `breveMin` minuti una nota conta `breve` volte, da `lungaMin` in su (anche oltre 2 ore) conta `lunga` volte; 1 = peso normale. */
  lunghezza: { breve: number; breveMin: number; lunga: number; lungaMin: number };
  /** Errore rispetto al previsto: quanto pesa una nota `giusta` e una molto `sbagliata`; `scala` è l'errore (0,25 = 25%) attorno a cui scende. */
  errore: { giusta: number; sbagliata: number; scala: number };
}
export const MARGINE_PREDEFINITO: ParametriMargine = {
  eta: { emivita: EMIVITA_GIORNI, minimo: 0 },
  lunghezza: { breve: FORZA_BREVE, breveMin: MINUTI_BREVE, lunga: FORZA_LUNGA, lungaMin: MINUTI_LUNGA },
  errore: { giusta: PESO_GIUSTA, sbagliata: PESO_SBAGLIATA, scala: SCALA_PRECISIONE },
};
/** Fin dove si possono trascinare i punti. */
export const LIMITI_MARGINE = {
  emivita: [3, 100] as const,
  minimo: [0, 1] as const,
  breve: [0.1, 1] as const,
  lunga: [1, 2] as const,
  breveMin: [1, 115] as const,
  lungaMin: [6, 120] as const,
  quota: [0.02, 1] as const,
  scala: [0.05, 0.8] as const,
};

const entro = (v: unknown, [min, max]: readonly [number, number], d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);

/** Il punto delle note lunghe resta sempre dopo quello delle brevi. */
const lunghezzaValida = (l: ParametriMargine['lunghezza']) => ({ ...l, lungaMin: Math.max(l.lungaMin, l.breveMin + DISTANZA_PUNTI_MIN) });

/** Porta un valore letto (anche incompleto) nella forma completa, entro i limiti. */
export function normalizzaMargine(p: Partial<ParametriMargine> | undefined): ParametriMargine {
  const d = MARGINE_PREDEFINITO;
  return {
    eta: { emivita: entro(p?.eta?.emivita, LIMITI_MARGINE.emivita, d.eta.emivita), minimo: entro(p?.eta?.minimo, LIMITI_MARGINE.minimo, d.eta.minimo) },
    lunghezza: lunghezzaValida({
      breve: entro(p?.lunghezza?.breve, LIMITI_MARGINE.breve, d.lunghezza.breve), breveMin: entro(p?.lunghezza?.breveMin, LIMITI_MARGINE.breveMin, d.lunghezza.breveMin),
      lunga: entro(p?.lunghezza?.lunga, LIMITI_MARGINE.lunga, d.lunghezza.lunga), lungaMin: entro(p?.lunghezza?.lungaMin, LIMITI_MARGINE.lungaMin, d.lunghezza.lungaMin),
    }),
    errore: { giusta: entro(p?.errore?.giusta, LIMITI_MARGINE.quota, d.errore.giusta), sbagliata: entro(p?.errore?.sbagliata, LIMITI_MARGINE.quota, d.errore.sbagliata), scala: entro(p?.errore?.scala, LIMITI_MARGINE.scala, d.errore.scala) },
  };
}

let parametri: ParametriMargine = normalizzaMargine(undefined);
export const getParametriMargine = (): ParametriMargine => parametri;
/** Cambia i parametri usati dal calcolo; senza argomento tornano quelli di base. */
export function impostaParametriMargine(p: Partial<ParametriMargine> | undefined) { parametri = normalizzaMargine(p); }

/** Peso (0-1) di una nota completata `giorni` fa: curva dell'età. */
export function pesoEta(giorni: number, p: ParametriMargine = parametri): number {
  return p.eta.minimo + (1 - p.eta.minimo) * 0.5 ** (Math.max(0, giorni) / p.eta.emivita);
}

/** Quante volte conta una nota secondo la sua stima: curva della lunghezza (piatta prima del punto «breve» e dopo il punto «lunga», in mezzo sale con la radice). */
export function fattoreLunghezza(stimaMin: number, p: ParametriMargine = parametri): number {
  const { breve, breveMin, lunga, lungaMin } = p.lunghezza;
  const t = (Math.sqrt(Math.max(0, stimaMin)) - Math.sqrt(breveMin)) / (Math.sqrt(lungaMin) - Math.sqrt(breveMin));
  return breve + (lunga - breve) * Math.min(1, Math.max(0, t));
}

/** Precisione di una stima da 0 a 1: 1 se lo scostamento è zero, scende verso 0 man mano che la stima è sbagliata (in più o in meno). */
export const precisione = (scostamentoNota: number, p: ParametriMargine = parametri) => Math.exp(-((scostamentoNota / p.errore.scala) ** 2));

/** Peso di una nota secondo il solo errore (curva dell'errore). */
export function quotaErrore(scostamentoNota: number, p: ParametriMargine = parametri): number {
  return p.errore.sbagliata + (p.errore.giusta - p.errore.sbagliata) * precisione(scostamentoNota, p);
}

/** Peso di una nota nel margine: età per lunghezza per errore. */
export function pesoNota(stimaMin: number, scostamentoNota: number, giorni: number, p: ParametriMargine = parametri): number {
  return pesoEta(giorni, p) * fattoreLunghezza(stimaMin, p) * quotaErrore(scostamentoNota, p);
}

interface NotaMargine { stimaMin: number; scostamento: number; ts: number }

/**
 * La media pesata degli scostamenti. Restituisce il margine e il contributo di ogni nota (la sua parte sul peso totale: sommati danno 1).
 * Senza un minimo per l'età contano solo le differenze di età tra le note: si misura dalla più recente, così note tutte molto vecchie
 * non finiscono con peso zero per arrotondamento.
 */
function calcolaMargine(note: NotaMargine[], adesso: number, p: ParametriMargine = parametri): { margine: number; contributi: number[] } {
  const giorni = note.map((n) => Math.max(0, (adesso - n.ts) / 86_400_000));
  const base = p.eta.minimo > 0 || !giorni.length ? 0 : Math.min(...giorni);
  const pesi = note.map((n, k) => pesoNota(n.stimaMin, n.scostamento, giorni[k] - base, p));
  const totale = pesi.reduce((s, x) => s + x, 0);
  if (!(totale > 0)) return { margine: MARGINE_INIZIALE, contributi: pesi.map(() => 0) };
  return { margine: note.reduce((s, n, k) => s + pesi[k] * n.scostamento, 0) / totale, contributi: pesi.map((x) => x / totale) };
}

/** Le note misurate (con stima), dalla più vecchia alla più recente, pronte per il calcolo del margine. */
const noteMargine = (items: Item[]): { item: Item; n: NotaMargine }[] =>
  misurate(items)
    .filter((i) => !!i.sforzoMin)
    .map((i) => ({ item: i, n: { stimaMin: i.sforzoMin!, scostamento: scostamento(i.sforzoMin!, i.durataRealeMin!), ts: i.completatoTs ?? i.aggiornato } }))
    .sort((a, b) => a.n.ts - b.n.ts);

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

/** Una nota dello storico del margine: stimato, reale, scostamento (anche in minuti), livello, `peso` nel calcolo di oggi (0-1 rispetto alla nota che pesa di più) e `quota` (la sua parte del margine, sul totale di tutte le note). */
export interface NotaStorico { item: Item; stimaMin: number; realeMin: number; scostamento: number; differenzaMin: number; livello: LivelloMargine; completatoTs: number; peso: number; quota: number }

/**
 * Le note completate con stima e tempo reale, la più recente prima: sono quelle che formano il margine (pagina «Storico del margine»).
 * Con `quante` (> 0) solo le ultime `quante`.
 */
export function storicoNote(items: Item[], adesso: number = Date.now(), quante = 0): NotaStorico[] {
  const ordinate = noteMargine(items);
  const { contributi } = calcolaMargine(ordinate.map((x) => x.n), adesso);
  const lista = ordinate
    .map(({ item: i, n }, k) => ({ item: i, stimaMin: n.stimaMin, realeMin: i.durataRealeMin!, scostamento: n.scostamento, differenzaMin: i.durataRealeMin! - n.stimaMin, livello: livelloNota(n.stimaMin, i.durataRealeMin!), completatoTs: n.ts, peso: contributi[k], quota: contributi[k] }))
    .reverse();
  const massimo = Math.max(...lista.map((n) => n.peso), 0);
  const normalizzata = massimo > 0 ? lista.map((n) => ({ ...n, peso: n.peso / massimo })) : lista;
  return quante > 0 ? normalizzata.slice(0, quante) : normalizzata;
}

/** Margine atteso: la media pesata degli scostamenti delle note completate (vedi l'intestazione del file). */
export function margineAtteso(items: Item[], adesso = Date.now()): number {
  const note = noteMargine(items);
  if (!note.length) return MARGINE_INIZIALE;
  return Math.min(MARGINE_MAX, Math.max(MARGINE_MIN, calcolaMargine(note.map((x) => x.n), adesso).margine));
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
