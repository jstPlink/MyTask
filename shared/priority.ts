// Priorità delle azioni e dei progetti: scadenze e punteggio da 0 a 100 che decide ordine, colore e battito del pallino.
// Il punteggio unisce quattro componenti (scadenza, importanza, tempo stimato, età) con pesi e curve regolabili da Altro › «Bilanciatore della priorità».
// Funzioni pure, tranne i pesi attivi, che sono uno stato del modulo.
import type { Item } from './types.ts';
import { diffDays, toISO } from './dates.ts';

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

/** Giorni prima della scadenza da cui l'urgenza comincia a salire (più lontana di così vale 0). */
export const ORIZZONTE_SCADENZA = 30;
/** Giorni di età di una nota oltre i quali l'età pesa il massimo. */
export const ORIZZONTE_ETA = 60;

/** Curvatura delle due curve esponenziali (0 = retta, più alta = sale piano e poi di colpo; da 0 a 8). */
export interface CurvePunteggio { scadenza: number; eta: number }
/** Curvature di base: scadenza 4, età 3. */
export const CURVE_PREDEFINITE: CurvePunteggio = { scadenza: 4, eta: 3 };
export const CURVATURA_MAX = 8;
let curveAttive: CurvePunteggio = { ...CURVE_PREDEFINITE };

/** Porta le curvature in 0-8 (valori mancanti: quelli di base). */
export function normalizzaCurve(c: Partial<CurvePunteggio> | undefined): CurvePunteggio {
  const v = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(CURVATURA_MAX, Math.max(0, n)) : d);
  return { scadenza: v(c?.scadenza, CURVE_PREDEFINITE.scadenza), eta: v(c?.eta, CURVE_PREDEFINITE.eta) };
}
export const getCurve = (): CurvePunteggio => curveAttive;
/** Cambia le curve usate dal calcolo; senza argomento tornano quelle di base. */
export function impostaCurve(c: Partial<CurvePunteggio> | undefined) { curveAttive = normalizzaCurve(c); }

/**
 * Curva esponenziale da 0 a 1: `x` (0-1) diventa (e^(k·x) − 1) / (e^k − 1). Con k = 0 è la retta; più k è alto più la curva resta bassa
 * all'inizio e sale di colpo verso la fine (a k = 4 a metà strada vale il 12%).
 */
export function curvaEsponenziale(x: number, k: number): number {
  const t = Math.min(1, Math.max(0, x));
  return k < 0.01 ? t : (Math.exp(k * t) - 1) / (Math.exp(k) - 1);
}

/**
 * Urgenza della scadenza da 0 a 100, **esponenziale** nella vicinanza: scaduta o oggi 100; da 30 giorni prima sale lentamente e poi di colpo
 * secondo la curva della scadenza (`curveAttive.scadenza`); oltre 30 giorni 0; senza data 0 (con la curvatura di base: 7 giorni 38, 3 giorni 66,
 * domani 87).
 * Con la data fissa (`tipoData`): da quel giorno in poi 100, il giorno prima 60, entro 3 giorni 40, entro 7 giorni 20, oltre 0.
 */
export function urgency(i: Item, today: string): number {
  const due = dueDate(i);
  if (!due) return 0;
  const days = diffDays(due, today);
  if (days <= 0) return 100;
  // data fissa: si fa da quel giorno, quindi prima non fa fretta (poco la settimana prima, 60 il giorno prima)
  if (i.tipoData === 'fissa') return days <= 1 ? 60 : days <= 3 ? 40 : days <= 7 ? 20 : 0;
  return Math.round(100 * curvaEsponenziale(1 - days / ORIZZONTE_SCADENZA, curveAttive.scadenza));
}

/** Giorni passati da quando la nota è stata creata. */
export const giorniDiEta = (i: Item, today: string): number => Math.max(0, diffDays(today, toISO(new Date(i.creato))));

/** Punti (0-100) dell'età: una nota vecchia sale, **esponenzialmente** (curva dell'età), fino al massimo a 60 giorni. */
export function puntiEta(i: Item, today: string): number {
  return Math.round(100 * curvaEsponenziale(giorniDiEta(i, today) / ORIZZONTE_ETA, curveAttive.eta));
}

/** Punti (0-100) del tempo stimato: premia le cose brevi (fino a 15 min 100, fino a 30 min 60, fino a 60 min 30, oltre 0; senza stima 30). */
export function puntiTempo(sforzoMin?: number): number {
  return sforzoMin === undefined ? 30 : sforzoMin <= 15 ? 100 : sforzoMin <= 30 ? 60 : sforzoMin <= 60 ? 30 : 0;
}

/** Le quattro componenti del punteggio, ognuna da 0 a 100 prima di applicare il suo peso. */
export interface ComponentiPunteggio { scadenza: number; importanza: number; tempo: number; eta: number }

/**
 * Le componenti del punteggio:
 * - scadenza: l'urgenza della data (`urgency`, curva esponenziale), 0 senza data;
 * - importanza: da 1 a 5 (di base 3) riportata su 0-100;
 * - tempo stimato: premia le attività brevi (fino a 15 min 100, fino a 30 min 60, fino a 60 min 30, oltre 0; senza stima 30);
 * - età: da quanti giorni la nota esiste (`puntiEta`, curva esponenziale, massimo a 60 giorni).
 */
export function componentiPunteggio(i: Item, today: string): ComponentiPunteggio {
  return {
    scadenza: urgency(i, today),
    importanza: (((i.importanza ?? 3) - 1) / 4) * 100,
    tempo: puntiTempo(i.sforzoMin),
    eta: puntiEta(i, today),
  };
}

/** Peso di ogni componente nel punteggio (somma 1). */
export type PesiPunteggio = ComponentiPunteggio;

/** Pesi di base: scadenza 45%, importanza 35%, tempo stimato 10%, età 10%. */
export const PESI_PREDEFINITI: PesiPunteggio = { scadenza: 0.45, importanza: 0.35, tempo: 0.1, eta: 0.1 };

/** Pesi in uso da tutto il calcolo delle priorità (liste, Priorità, widget). */
let pesiAttivi: PesiPunteggio = { ...PESI_PREDEFINITI };

/** Porta i pesi a somma 1 (così il punteggio resta tra 0 e 100); se sono tutti zero tornano quelli di base. */
export function normalizzaPesi(p: Partial<PesiPunteggio>): PesiPunteggio {
  const v = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
  const somma = v(p.scadenza) + v(p.importanza) + v(p.tempo) + v(p.eta);
  if (somma <= 0) return { ...PESI_PREDEFINITI };
  return { scadenza: v(p.scadenza) / somma, importanza: v(p.importanza) / somma, tempo: v(p.tempo) / somma, eta: v(p.eta) / somma };
}

/** I pesi attualmente in uso. */
export const getPesi = (): PesiPunteggio => pesiAttivi;
/** Cambia i pesi usati da tutto il calcolo delle priorità; senza argomento tornano quelli di base. */
export function impostaPesi(p: Partial<PesiPunteggio> | undefined) { pesiAttivi = p ? normalizzaPesi(p) : { ...PESI_PREDEFINITI }; }

/** Da che valore (0-100) una componente comincia a spingere da sola il punteggio, e a quanto arriva quando vale 100. */
export const SOGLIA_RILIEVO = 50;
export const PUNTEGGIO_RILIEVO = 80;

/**
 * Spinta di una componente forte: sotto 50 non fa nulla, da 50 a 100 sale in linea retta fino a 80 punti (cioè rosso). Così basta UN parametro molto alto
 * (scadenza vicina, importanza massima, nota vecchia, lavoro brevissimo) per rendere la nota rossa, anche se la somma pesata, con i pesi divisi tra
 * quattro parametri, resterebbe bassa.
 */
export const spintaComponente = (c: number): number => Math.max(0, (c - SOGLIA_RILIEVO) / (100 - SOGLIA_RILIEVO)) * PUNTEGGIO_RILIEVO;

/**
 * Punteggio 0-100 di un'azione o di un progetto: il più alto tra
 * - la somma delle quattro componenti, ognuna per il suo peso (sezione 6.1 della documentazione), e
 * - la spinta della componente più forte tra quelle con un peso (`spintaComponente`): un parametro con peso 0 si considera spento e non spinge.
 */
export function score(i: Item, today: string): number {
  const c = componentiPunteggio(i, today);
  const w = pesiAttivi;
  const somma = w.scadenza * c.scadenza + w.importanza * c.importanza + w.tempo * c.tempo + w.eta * c.eta;
  const spinta = Math.max(...(['scadenza', 'importanza', 'tempo', 'eta'] as const).filter((k) => w[k] > 0.005).map((k) => spintaComponente(c[k])), 0);
  return Math.round(Math.min(100, Math.max(0, somma, spinta)));
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
    tipoData: child.fine || child.inizio ? child.tipoData : parent.tipoData,
  };
}
