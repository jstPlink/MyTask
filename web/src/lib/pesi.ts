// Bilanciatore della priorità (i pesi di scadenza, importanza e tempo stimato nel punteggio): salvati sul dispositivo e sincronizzati con il server
// (chiave `bilanciatore`, vince la modifica più recente), così telefono, sito e app per computer calcolano le stesse priorità. Il calcolo è in shared/priority.ts.
import { getPesi, impostaPesi, normalizzaPesi, PESI_PREDEFINITI, type PesiPunteggio } from '../../../shared/priority.ts';
import type { ImpostazioniSync } from '../../../shared/types.ts';
import { rinfrescaListe } from './store.ts';

const KEY = 'mytask.bilanciatore';
const KEY_AGG = 'mytask.bilanciatore.agg';
const CHIAVE_SYNC = 'bilanciatore';
/** Pesi personalizzati (undefined = predefiniti) e quando sono stati modificati l'ultima volta (0 = mai). */
let salvati: PesiPunteggio | undefined;
let aggiornato = 0;
const listeners = new Set<() => void>();

function valido(p: unknown): p is PesiPunteggio {
  const x = p as Record<string, unknown> | null;
  return !!x && ['scadenza', 'importanza', 'tempo'].every((k) => typeof x[k] === 'number');
}

/** Applica i pesi salvati (da chiamare all'avvio, prima di mostrare le liste). */
export function avviaPesi() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (valido(p)) { salvati = normalizzaPesi(p); impostaPesi(salvati); }
    }
    aggiornato = Number(localStorage.getItem(KEY_AGG)) || 0;
    // pesi scelti prima che si sincronizzassero: da ora valgono come modifica più recente e salgono sul server
    if (salvati && !aggiornato) { aggiornato = Date.now(); localStorage.setItem(KEY_AGG, String(aggiornato)); }
  } catch { /* ignora */ }
}

/** I pesi in uso. */
export const getPesiUtente = getPesi;
export const subscribePesi = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Imposta i pesi (o ripristina i predefiniti con `undefined`), li salva e rifà le liste. `quando` è la data di modifica (ora, se non indicata). */
function applica(p: PesiPunteggio | undefined, quando: number = Date.now()) {
  impostaPesi(p);
  salvati = p ? normalizzaPesi(p) : undefined;
  aggiornato = quando;
  try {
    if (salvati) localStorage.setItem(KEY, JSON.stringify(salvati)); else localStorage.removeItem(KEY);
    localStorage.setItem(KEY_AGG, String(aggiornato));
  } catch { /* ignora */ }
  listeners.forEach((l) => l());
  rinfrescaListe();
}

/** I pesi da inviare al server (niente se non sono mai stati toccati). */
export function impostazioniPesiDaInviare(): ImpostazioniSync | undefined {
  return aggiornato > 0 ? { [CHIAVE_SYNC]: { valore: salvati ?? null, aggiornato } } : undefined;
}

/** Applica i pesi arrivati dal server, se più recenti di quelli locali (`null` = predefiniti). Restituisce true se sono cambiati. */
export function applicaPesiDaServer(imp: ImpostazioniSync | undefined): boolean {
  const r = imp?.[CHIAVE_SYNC];
  if (!r || typeof r.aggiornato !== 'number' || r.aggiornato <= aggiornato) return false;
  if (r.valore === null) { applica(undefined, r.aggiornato); return true; }
  if (!valido(r.valore)) return false;
  applica(r.valore, r.aggiornato);
  return true;
}

export const impostaPesiUtente = (p: PesiPunteggio) => applica(p);
export const ripristinaPesi = () => applica(undefined);
/** True se i pesi coincidono con quelli di base (a meno di un punto percentuale). */
export const sonoPredefiniti = (p: PesiPunteggio) => (Object.keys(PESI_PREDEFINITI) as (keyof PesiPunteggio)[]).every((k) => Math.abs(p[k] - PESI_PREDEFINITI[k]) < 0.005);
