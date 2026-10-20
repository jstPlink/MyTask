// Priorità delle azioni e dei progetti: scadenze, colore del pallino e ordine di Oggi e delle liste.
// Colore e ordine nascono dalle regole di Altro › «Regole della priorità» (importanza, scadenza, posizione). Funzioni pure,
// tranne le regole attive, che sono uno stato del modulo.
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
 * Regole della priorità (impostazioni, sperimentali). Non c'è più nessun punteggio da 0 a 100: il colore del pallino e l'ordine
 * nascono da tre segnali, vale il più alto: l'importanza impostata, la scadenza e la posizione nella classifica.
 * - rosso: importanza almeno `rossoImportanza`, scadenza entro `rossoGiorni` giorni (scaduta e oggi comprese) o tra le prime `rossoPosizioni`;
 * - ambra: stesso discorso con le soglie `ambra…`; grigio: il resto.
 * - ordine: prima tutte le rosse, poi le ambra, poi le grigie; dentro lo stesso colore va avanti chi ha `ordine` = la scadenza più
 *   vicina (a parità l'importanza più alta) oppure l'importanza più alta (a parità la scadenza più vicina).
 */
export interface RegolePriorita {
  rossoImportanza: number; rossoGiorni: number; rossoPosizioni: number;
  ambraImportanza: number; ambraGiorni: number; ambraPosizioni: number;
  ordine: 'scadenza' | 'importanza';
}

export const REGOLE_PREDEFINITE: RegolePriorita = { rossoImportanza: 4.5, rossoGiorni: 5, rossoPosizioni: 3, ambraImportanza: 3, ambraGiorni: 7, ambraPosizioni: 10, ordine: 'scadenza' };

/** Regole in uso da tutto il calcolo delle priorità (liste, Oggi, widget). */
let regoleAttive: RegolePriorita = { ...REGOLE_PREDEFINITE };

const tra = (n: number, min: number, max: number, def: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def);

/** Riporta ogni valore nel suo intervallo (e l'ambra mai più severa del rosso). */
export function normalizzaRegole(r: Partial<RegolePriorita>): RegolePriorita {
  const d = REGOLE_PREDEFINITE;
  const rossoImportanza = tra(r.rossoImportanza as number, 1, 5, d.rossoImportanza);
  const rossoGiorni = Math.round(tra(r.rossoGiorni as number, -1, 30, d.rossoGiorni));
  const rossoPosizioni = Math.round(tra(r.rossoPosizioni as number, 0, 20, d.rossoPosizioni));
  return {
    rossoImportanza, rossoGiorni, rossoPosizioni,
    ambraImportanza: Math.min(rossoImportanza, tra(r.ambraImportanza as number, 1, 5, d.ambraImportanza)),
    ambraGiorni: Math.max(rossoGiorni, Math.round(tra(r.ambraGiorni as number, -1, 60, d.ambraGiorni))),
    ambraPosizioni: Math.max(rossoPosizioni, Math.round(tra(r.ambraPosizioni as number, 0, 40, d.ambraPosizioni))),
    ordine: r.ordine === 'importanza' ? 'importanza' : 'scadenza',
  };
}

/** Le regole attualmente in uso. */
export const getRegole = (): RegolePriorita => regoleAttive;
/** Cambia le regole usate da tutto il calcolo delle priorità; senza argomento tornano quelle di base. */
export function impostaRegole(r: Partial<RegolePriorita> | undefined) { regoleAttive = r ? normalizzaRegole(r) : { ...REGOLE_PREDEFINITE }; }

/** Giorni alla scadenza (negativi se scaduta, Infinity senza data). */
function giorniAllaScadenza(i: Item, today: string): number {
  const due = dueDate(i);
  return due ? diffDays(due, today) : Infinity;
}

/** Colore senza la posizione: serve a ordinare (la posizione nasce dall'ordine, quindi non può entrarci). */
function livelloBase(i: Item, today: string): 1 | 2 | 3 {
  const r = regoleAttive;
  const imp = i.importanza ?? 3;
  const g = giorniAllaScadenza(i, today);
  if (imp >= r.rossoImportanza || g <= r.rossoGiorni) return 3;
  if (imp >= r.ambraImportanza || g <= r.ambraGiorni) return 2;
  return 1;
}

/**
 * Livello 1-3 del pallino di priorità (3 rosso, 2 ambra, 1 grigio): il più alto tra importanza, scadenza e posizione in classifica.
 * Per un passo di progetto si passa la voce con l'ereditarietà già applicata (`withInheritance`).
 */
export function livelloPriorita(i: Item, today: string, posizione?: number): 1 | 2 | 3 {
  const r = regoleAttive;
  const base = livelloBase(i, today);
  if (posizione !== undefined) {
    if (posizione <= r.rossoPosizioni) return 3;
    if (posizione <= r.ambraPosizioni) return Math.max(base, 2) as 2 | 3;
  }
  return base;
}

/**
 * Chiave per ordinare le note (più alta = prima): colore, poi scadenza e importanza nell'ordine scelto, poi (a parità) la scadenza fissa,
 * le attività brevi e le note più vecchie. Non è un punteggio: serve solo al confronto.
 */
export function chiavePriorita(i: Item, today: string, now: number = Date.now()): number {
  const imp = Math.round((i.importanza ?? 3) * 100); // 100-500
  const g = giorniAllaScadenza(i, today);
  const scad = Number.isFinite(g) ? 2000 - (Math.min(1000, Math.max(-400, g)) + 400) : 0; // 600-2000, più alta se più vicina; 0 senza data
  const rigida = i.rigida && Number.isFinite(g) ? 1 : 0;
  const breve = i.sforzoMin === undefined ? 1 : i.sforzoMin <= 15 ? 3 : i.sforzoMin <= 30 ? 2 : i.sforzoMin <= 60 ? 1 : 0;
  const eta = Math.min(52, Math.floor(Math.max(0, now - i.creato) / (7 * 86400000)));
  const sub = regoleAttive.ordine === 'scadenza'
    ? (((scad * 2 + rigida) * 1000 + imp) * 10 + breve) * 100 + eta
    : (((imp * 2 + rigida) * 2001 + scad) * 10 + breve) * 100 + eta;
  return livelloBase(i, today) * 1e11 + sub;
}

/**
 * Intensità (0-100) che regola il battito del pallino, allineata a colore e soglie: il grigio non batte; il rosso batte sempre (almeno 55,
 * circa 43 bpm, anche senza scadenza) e l'ambra piano (almeno 25); più la scadenza è vicina più sale: oggi o scaduta 100, 60 alla soglia
 * del rosso, 35 a quella dell'ambra, 15 a 30 giorni. `livello` è quello del pallino (`livelloPriorita`, posizione compresa).
 */
export function intensitaBattito(i: Item, today: string, livello: 1 | 2 | 3): number {
  if (livello === 1) return 0;
  const minimo = livello === 3 ? 55 : 25;
  const g = giorniAllaScadenza(i, today);
  if (!Number.isFinite(g)) return minimo;
  const r = regoleAttive;
  const tratto = (x: number, x0: number, x1: number, y0: number, y1: number) => (x1 <= x0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
  const data = g <= 0 ? 100 : g <= r.rossoGiorni ? tratto(g, 0, r.rossoGiorni, 100, 60) : g <= r.ambraGiorni ? tratto(g, r.rossoGiorni, r.ambraGiorni, 60, 35) : g <= 30 ? tratto(g, r.ambraGiorni, 30, 35, 15) : 15;
  return Math.max(minimo, data);
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
