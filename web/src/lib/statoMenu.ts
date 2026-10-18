// Menu «Stato» che si apre tenendo premuta la casella di una nota (o dal tasto destro del mouse).
import type { Item } from '../../../shared/types.ts';

let corrente: Item | undefined;
const listeners = new Set<() => void>();

export const getStatoMenu = () => corrente;
export const subscribeStatoMenu = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function apriStatoMenu(item: Item) {
  corrente = item;
  listeners.forEach((l) => l());
}

export function chiudiStatoMenu() {
  corrente = undefined;
  listeners.forEach((l) => l());
}
