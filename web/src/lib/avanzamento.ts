// Stato del pannello animato «avanzamento del progetto», mostrato quando si completa un passo di un progetto.
// Piccolo store con ascoltatori (letto con useSyncExternalStore); il disegno è in ui/AvanzamentoProgetto.tsx.
import type { Item } from '../../../shared/types.ts';

/** Un passo del progetto (voce di checklist o voce figlia) così come lo mostra l'animazione. */
export interface PassoProgetto { id: string; testo: string; fatto: boolean; target?: boolean }
/** Dati dell'animazione: il progetto, i suoi passi e il conteggio prima e dopo il completamento. */
export interface Avanzamento {
  padre: Item;
  /** Tutti i passi del progetto com'erano prima del segno di fatto (il passo appena completato ha `target`). */
  passi: PassoProgetto[];
  prima: { fatti: number; totale: number };
  dopo: { fatti: number; totale: number };
  /** Cosa fare quando l'animazione finisce (per esempio aprire la richiesta del tempo impiegato). */
  alTermine?: () => void;
}

/** Durata dell'animazione in millisecondi (apre il pannello, spunta il passo, fa avanzare la barra, chiude). */
export const DURATA_ANIMAZIONE_MS = 4200;

let corrente: Avanzamento | undefined;
const listeners = new Set<() => void>();

export const getAvanzamento = () => corrente;
export const subscribeAvanzamento = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Apre il pannello con questi dati. */
export function mostraAvanzamento(a: Avanzamento) {
  corrente = a;
  listeners.forEach((l) => l());
}

/** Chiude il pannello (a fine animazione o con un tocco) e fa partire ciò che era in attesa. */
export function chiudiAvanzamento() {
  const a = corrente;
  if (!a) return;
  corrente = undefined;
  listeners.forEach((l) => l());
  // un attimo dopo, perché la chiusura del pannello passa dalla cronologia ("indietro") e deve finire prima che se ne apra un altro
  if (a.alTermine) setTimeout(a.alTermine, 300);
}
