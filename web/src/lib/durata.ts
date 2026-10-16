// Finestra "Quanto ci hai messo?" che si apre al segno di fatto di un'attività: il tempo reale affina stime e margine d'errore.
import type { Item } from '../../../shared/types.ts';

let corrente: Item | undefined;
const listeners = new Set<() => void>();

export const getDurata = () => corrente;
export const subscribeDurata = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** `item` è l'attività già segnata come fatta. */
export function chiediDurata(item: Item) {
  corrente = item;
  listeners.forEach((l) => l());
}

export function chiudiDurata() {
  corrente = undefined;
  listeners.forEach((l) => l());
}
