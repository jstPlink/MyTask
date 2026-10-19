// Stato del foglio che compare dopo aver completato una nota di cui si conosce il tempo reale: confronto tra
// stimato e reale e margine d'errore aggiornato. Piccolo store con ascoltatori; il disegno è in ui/CompletamentoSheet.tsx.

/** Dati del foglio di confronto stima / tempo reale. */
interface Completamento {
  titolo: string;
  /** Tempo stimato e tempo reale, in minuti. */
  stimaMin: number;
  realeMin: number;
  /** Margine delle stime (con segno) prima e dopo questa nota, in percentuale (15 = +15%, −20 = stime abbondanti). */
  margineDa: number;
  margineA: number;
}

/** Il foglio resta aperto il tempo dell'animazione più 2 secondi, poi si chiude da solo. */
export const DURATA_COMPLETAMENTO_MS = 8000;

let corrente: Completamento | undefined;
const listeners = new Set<() => void>();

export const getCompletamento = () => corrente;
export const subscribeCompletamento = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Apre il foglio con questi dati. */
export function mostraCompletamento(c: Completamento) {
  corrente = c;
  listeners.forEach((l) => l());
}

/** Chiude il foglio. */
export function chiudiCompletamento() {
  if (!corrente) return;
  corrente = undefined;
  listeners.forEach((l) => l());
}
