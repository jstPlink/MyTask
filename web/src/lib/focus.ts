// Stato della schermata «in corso» a tutto schermo (ui/InCorso.tsx): la schermata c'è finché una nota (attività o curiosità)
// è «in corso»; dopo «Fatta» resta per un attimo lo schermo verde, mentre la nota viene completata alla fine di quel tempo.
import { notaInCorso } from '../../../shared/sessione.ts';
import { getItems } from './store.ts';

let verde = false;
const listeners = new Set<() => void>();

/** True mentre si vede lo schermo verde di «Fatta!». */
export const getVerde = () => verde;
export const subscribeFocus = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function impostaVerde(v: boolean) {
  if (verde === v) return;
  verde = v;
  listeners.forEach((l) => l());
}

/** True se in questo momento la schermata a tutto schermo è aperta (nota in corso o schermo verde): il tasto indietro del telefono non esce. */
export const focusAperto = (): boolean => verde || !!notaInCorso(getItems());
