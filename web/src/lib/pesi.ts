// Opzione provvisoria (impostazioni): pesi dei parametri che formano la priorità, salvati solo su questo dispositivo.
import { getPesi, impostaPesi, normalizzaPesi, PESI_PREDEFINITI, type PesiPunteggio } from '../../../shared/priority.ts';
import { rinfrescaListe } from './store.ts';

const KEY = 'mytask.pesi';
const listeners = new Set<() => void>();

function valido(p: unknown): p is PesiPunteggio {
  const x = p as Partial<PesiPunteggio> | null;
  return !!x && ['urgenza', 'importanza', 'sforzo', 'eta'].every((k) => typeof (x as Record<string, unknown>)[k] === 'number');
}

/** Applica i pesi salvati (da chiamare all'avvio, prima di mostrare le liste). */
export function avviaPesi() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const p = JSON.parse(raw) as unknown; if (valido(p)) impostaPesi(p); }
  } catch { /* ignora */ }
}

export const getPesiUtente = getPesi;
export const subscribePesi = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

function applica(p: PesiPunteggio | undefined) {
  impostaPesi(p);
  try { if (p) localStorage.setItem(KEY, JSON.stringify(normalizzaPesi(p))); else localStorage.removeItem(KEY); } catch { /* ignora */ }
  listeners.forEach((l) => l());
  rinfrescaListe();
}

export const impostaPesiUtente = (p: PesiPunteggio) => applica(p);
export const ripristinaPesi = () => applica(undefined);
export const sonoPredefiniti = (p: PesiPunteggio) => (Object.keys(PESI_PREDEFINITI) as (keyof PesiPunteggio)[]).every((k) => Math.abs(p[k] - PESI_PREDEFINITI[k]) < 0.005);
