// Sessione di lavoro: il cronometro «Inizia». Un solo cronometro alla volta, che corre su un task (`taskId`).
// Si può mettere in pausa, spostare su un altro task o chiudere. Il tempo di ogni task si accumula in `Item.lavoratoMs`
// (millisecondi realmente lavorati) e alla fine diventa il tempo reale che affina stima e margine d'errore.
// Qui ci sono solo il modello e il calcolo del tempo (funzioni pure); le azioni sono in web/src/lib/sessione.ts.
import type { Item } from './types.ts';

export type StatoSessione = 'ferma' | 'lavoro' | 'pausa';

export interface Sessione {
  /** `ferma` = nessuna sessione; `lavoro` = il cronometro corre su `taskId`; `pausa` = fermo ma la sessione resta aperta. */
  stato: StatoSessione;
  /** Il task su cui si lavora (o si lavorava prima della pausa). */
  taskId?: string;
  /** Millisecondi dell'inizio del tratto che sta correndo (solo in `lavoro`). */
  inizio?: number;
  /** Ultima volta che l'utente ha confermato di star ancora lavorando (o inizio della sessione): serve al controllo periodico. */
  controllo?: number;
  /** Ultima modifica (millisecondi): nella sincronizzazione tra dispositivi vince la più recente. */
  aggiornato: number;
}

export const SESSIONE_FERMA: Sessione = { stato: 'ferma', aggiornato: 0 };

/** Dopo tanto tempo senza conferme l'app chiede «Stai ancora lavorando?». */
export const INTERVALLO_CONTROLLO_MS = 45 * 60_000;

/** Sotto questa durata il tempo lavorato non conta come misura (un tocco per sbaglio). */
const MISURA_MINIMA_MS = 30_000;

/** Controlla un valore letto dal dispositivo o arrivato dal server; null se non è una sessione valida. */
export function sessioneValida(x: unknown): Sessione | null {
  const s = x as Partial<Sessione> | null;
  if (!s || typeof s !== 'object') return null;
  if (s.stato !== 'ferma' && s.stato !== 'lavoro' && s.stato !== 'pausa') return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  if (s.stato === 'ferma') return { stato: 'ferma', aggiornato: num(s.aggiornato) ?? 0 };
  if (typeof s.taskId !== 'string' || !s.taskId) return null;
  const inizio = num(s.inizio);
  if (s.stato === 'lavoro' && inizio === undefined) return null;
  return { stato: s.stato, taskId: s.taskId, inizio: s.stato === 'lavoro' ? inizio : undefined, controllo: num(s.controllo), aggiornato: num(s.aggiornato) ?? 0 };
}

/** Millisecondi del tratto che sta correndo adesso (0 se il cronometro non corre). */
export function msTrattoInCorso(s: Sessione, now: number): number {
  return s.stato === 'lavoro' && s.inizio !== undefined ? Math.max(0, now - s.inizio) : 0;
}

/** Il tempo lavorato su un task: quello già accumulato più, se il cronometro corre proprio su di lui, il tratto in corso. */
export function tempoLavorato(item: Item, s: Sessione, now: number): number {
  return (item.lavoratoMs ?? 0) + (s.taskId === item.id ? msTrattoInCorso(s, now) : 0);
}

/** Tempo lavorato in minuti interi (almeno 1), o undefined se è troppo poco per essere una misura. */
export function minutiMisurati(ms: number): number | undefined {
  return ms >= MISURA_MINIMA_MS ? Math.max(1, Math.round(ms / 60_000)) : undefined;
}

/** «1:05:09» o «42:10»: ore, minuti e secondi di un cronometro. */
export function formatoCronometro(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const due = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${due(m)}:${due(s)}` : `${due(m)}:${due(s)}`;
}

/**
 * Il task a cui passare dopo `corrente`: il primo tra `elenco` (id in ordine di priorità, come nella lista di Oggi) che segue
 * `corrente`; se `corrente` è l'ultimo o non c'è più, il primo dell'elenco. `esclusi` non vengono mai scelti.
 */
export function prossimoTask(elenco: string[], corrente: string | undefined, esclusi: string[] = []): string | undefined {
  const ok = (id: string) => id !== corrente && !esclusi.includes(id);
  const i = corrente ? elenco.indexOf(corrente) : -1;
  return elenco.slice(i + 1).find(ok) ?? elenco.find(ok);
}
