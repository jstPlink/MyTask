// Finestra "Com'è andata?" che si apre quando si segna come fatto un film, un libro, un gioco…
import type { Item } from '../../../shared/types.ts';

let corrente: Item | undefined;
const listeners = new Set<() => void>();

export const getRecensione = () => corrente;
export const subscribeRecensione = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function chiediRecensione(item: Item) {
  corrente = item;
  listeners.forEach((l) => l());
}

export function chiudiRecensione() {
  corrente = undefined;
  listeners.forEach((l) => l());
}
