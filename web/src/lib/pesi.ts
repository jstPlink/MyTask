// Regole della priorità (soglie di colore e ordine, impostazioni): salvati sul dispositivo e sincronizzati con il server (chiave `pesi`,
// vince la modifica più recente), così telefono, sito e app per computer calcolano le stesse priorità. Il calcolo è in shared/priority.ts.
import { getRegole, impostaRegole, normalizzaRegole, REGOLE_PREDEFINITE, type RegolePriorita } from '../../../shared/priority.ts';
import type { ImpostazioniSync } from '../../../shared/types.ts';
import { rinfrescaListe } from './store.ts';

const KEY = 'mytask.regole';
const KEY_AGG = 'mytask.regole.agg';
const CHIAVE_SYNC = 'regole';
/** Pesi personalizzati (undefined = predefiniti) e quando sono stati modificati l'ultima volta (0 = mai). */
let salvati: RegolePriorita | undefined;
let aggiornato = 0;
const listeners = new Set<() => void>();

function valido(p: unknown): p is RegolePriorita {
  const x = p as Record<string, unknown> | null;
  return !!x && ['rossoImportanza', 'rossoGiorni', 'rossoPosizioni', 'ambraImportanza', 'ambraGiorni', 'ambraPosizioni'].every((k) => typeof x[k] === 'number') && (x.ordine === 'scadenza' || x.ordine === 'importanza');
}

/** Applica i pesi salvati (da chiamare all'avvio, prima di mostrare le liste). */
export function avviaPesi() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (valido(p)) { salvati = normalizzaRegole(p); impostaRegole(salvati); }
    }
    aggiornato = Number(localStorage.getItem(KEY_AGG)) || 0;
    // pesi scelti prima che si sincronizzassero: da ora valgono come modifica più recente e salgono sul server
    if (salvati && !aggiornato) { aggiornato = Date.now(); localStorage.setItem(KEY_AGG, String(aggiornato)); }
  } catch { /* ignora */ }
}

/** I pesi in uso. */
export const getPesiUtente = getRegole;
export const subscribePesi = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Imposta i pesi (o ripristina i predefiniti con `undefined`), li salva e rifà le liste. `quando` è la data di modifica (ora, se non indicata). */
function applica(p: RegolePriorita | undefined, quando: number = Date.now()) {
  impostaRegole(p);
  salvati = p ? normalizzaRegole(p) : undefined;
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

export const impostaPesiUtente = (p: RegolePriorita) => applica(p);
export const ripristinaPesi = () => applica(undefined);
/** True se le regole coincidono con quelle di base. */
export const sonoPredefiniti = (p: RegolePriorita) => (Object.keys(REGOLE_PREDEFINITE) as (keyof RegolePriorita)[]).every((k) => p[k] === REGOLE_PREDEFINITE[k]);
