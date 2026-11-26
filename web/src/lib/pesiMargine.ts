// Bilanciatore del margine (peso e curva di età, lunghezza ed errore): salvato sul dispositivo e sincronizzato con il server
// (chiave `bilanciatoreMargine`, vince la modifica più recente), così telefono, sito e app per computer calcolano lo stesso margine.
// Il calcolo è in shared/stima.ts.
import { getParametriMargine, impostaParametriMargine, MARGINE_PREDEFINITO, normalizzaMargine, type ParametriMargine } from '../../../shared/stima.ts';
import type { ImpostazioniSync } from '../../../shared/types.ts';
import { rinfrescaListe } from './store.ts';

const KEY = 'mytask.bilanciatoreMargine';
const KEY_AGG = 'mytask.bilanciatoreMargine.agg';
const CHIAVE_SYNC = 'bilanciatoreMargine';

/** Parametri personalizzati (undefined = di base) e quando sono stati modificati l'ultima volta (0 = mai). */
let salvati: ParametriMargine | undefined;
let aggiornato = 0;
const listeners = new Set<() => void>();

const valido = (p: unknown): p is ParametriMargine => !!p && typeof p === 'object' && ['eta', 'lunghezza', 'errore'].every((k) => typeof (p as Record<string, unknown>)[k] === 'object');

/** Applica i parametri salvati (da chiamare all'avvio, prima di mostrare le liste). */
export function avviaPesiMargine() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (valido(p)) { salvati = normalizzaMargine(p); impostaParametriMargine(salvati); }
    }
    aggiornato = Number(localStorage.getItem(KEY_AGG)) || 0;
  } catch { /* ignora */ }
}

export const getMargineUtente = getParametriMargine;
export const subscribeMargine = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

function applica(p: ParametriMargine | undefined, quando: number = Date.now()) {
  salvati = p ? normalizzaMargine(p) : undefined;
  impostaParametriMargine(salvati);
  aggiornato = quando;
  try {
    if (salvati) localStorage.setItem(KEY, JSON.stringify(salvati)); else localStorage.removeItem(KEY);
    localStorage.setItem(KEY_AGG, String(aggiornato));
  } catch { /* ignora */ }
  listeners.forEach((l) => l());
  rinfrescaListe();
}

export function impostazioniMargineDaInviare(): ImpostazioniSync | undefined {
  return aggiornato > 0 ? { [CHIAVE_SYNC]: { valore: salvati ?? null, aggiornato } } : undefined;
}

export function applicaMargineDaServer(imp: ImpostazioniSync | undefined): boolean {
  const r = imp?.[CHIAVE_SYNC];
  if (!r || typeof r.aggiornato !== 'number' || r.aggiornato <= aggiornato) return false;
  if (r.valore === null) { applica(undefined, r.aggiornato); return true; }
  if (!valido(r.valore)) return false;
  applica(r.valore, r.aggiornato);
  return true;
}

export const impostaMargineUtente = (p: ParametriMargine) => applica(p);
export const ripristinaMargine = () => applica(undefined);
export const sonoMargineDiBase = (p: ParametriMargine) => JSON.stringify(normalizzaMargine(p)) === JSON.stringify(MARGINE_PREDEFINITO);
