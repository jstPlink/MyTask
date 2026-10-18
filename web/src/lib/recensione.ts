// Stato del foglio «Com'è andata?» che si apre quando si segna come fatto un film, un libro, un gioco…
// Piccolo store con ascoltatori; il disegno è in ui/Recensione.tsx.
import type { Item } from '../../../shared/types.ts';

let corrente: Item | undefined;
const listeners = new Set<() => void>();

export const getRecensione = () => corrente;
export const subscribeRecensione = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Apre il foglio per questa voce. */
export function chiediRecensione(item: Item) {
  corrente = item;
  listeners.forEach((l) => l());
}

/** Chiude il foglio. */
export function chiudiRecensione() {
  corrente = undefined;
  listeners.forEach((l) => l());
}
