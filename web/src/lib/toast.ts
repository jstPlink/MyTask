// Stato del messaggio breve in basso (toast), con azione opzionale (per esempio «Annulla»). Ne esiste uno solo alla volta.
// Piccolo store con ascoltatori; il disegno è `ToastView` in App.tsx.
interface Toast { id: number; testo: string; azione?: { label: string; fn: () => void } }

let corrente: Toast | undefined;
let n = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export const getToast = () => corrente;
export const subscribeToast = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Mostra un messaggio per `ms` millisecondi (5 secondi se non indicato), sostituendo quello in corso. */
export function mostraToast(testo: string, azione?: Toast['azione'], ms = 5000) {
  corrente = { id: ++n, testo, azione };
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(chiudiToast, ms);
}

/** Chiude il messaggio. */
export function chiudiToast() {
  corrente = undefined;
  clearTimeout(timer);
  listeners.forEach((l) => l());
}
