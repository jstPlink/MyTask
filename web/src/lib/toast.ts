export interface Toast { id: number; testo: string; azione?: { label: string; fn: () => void } }

let corrente: Toast | undefined;
let n = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export const getToast = () => corrente;
export const subscribeToast = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function mostraToast(testo: string, azione?: Toast['azione'], ms = 5000) {
  corrente = { id: ++n, testo, azione };
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(chiudiToast, ms);
}

export function chiudiToast() {
  corrente = undefined;
  clearTimeout(timer);
  listeners.forEach((l) => l());
}
