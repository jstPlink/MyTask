// Tempo libero per giorno della settimana. Salvato sul dispositivo (come l'aspetto).
import { DISPONIBILITA_SUGGERITA, type Disponibilita, type FasciaOraria } from '../../../shared/piano.ts';

const KEY = 'mytask.disponibilita';
const listeners = new Set<() => void>();

const fasciaValida = (f: unknown): f is FasciaOraria =>
  !!f && typeof (f as FasciaOraria).da === 'string' && typeof (f as FasciaOraria).a === 'string' && /^\d{2}:\d{2}$/.test((f as FasciaOraria).da) && /^\d{2}:\d{2}$/.test((f as FasciaOraria).a);

/** null = non ancora impostato: Oggi resta con la lista semplice. */
function leggi(): Disponibilita | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Disponibilita>;
    if (!Array.isArray(p.settimana) || p.settimana.length !== 7) return null;
    return {
      settimana: p.settimana.map((g) => (Array.isArray(g) ? g.filter(fasciaValida) : [])),
      eccezioni: p.eccezioni && typeof p.eccezioni === 'object' ? p.eccezioni : undefined,
    };
  } catch { return null; }
}

let corrente: Disponibilita | null = leggi();

export const getDisponibilita = () => corrente;
export const subscribeDisponibilita = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function impostaDisponibilita(d: Disponibilita) {
  corrente = d;
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignora */ }
  listeners.forEach((l) => l());
}

export const copiaSuggerita = (): Disponibilita => JSON.parse(JSON.stringify(DISPONIBILITA_SUGGERITA)) as Disponibilita;
export const usaSuggerita = () => impostaDisponibilita(copiaSuggerita());
