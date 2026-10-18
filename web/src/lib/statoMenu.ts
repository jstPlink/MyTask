// Stato del menu «Stato» che si apre tenendo premuta la casella di una nota (o dal tasto destro del mouse).
// Piccolo store con ascoltatori; il disegno è in ui/StatoMenu.tsx.
import type { Item } from '../../../shared/types.ts';

let corrente: Item | undefined;
const listeners = new Set<() => void>();

export const getStatoMenu = () => corrente;
export const subscribeStatoMenu = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Apre il menu per questa voce. */
export function apriStatoMenu(item: Item) {
  corrente = item;
  listeners.forEach((l) => l());
}

/** Chiude il menu. */
export function chiudiStatoMenu() {
  corrente = undefined;
  listeners.forEach((l) => l());
}
