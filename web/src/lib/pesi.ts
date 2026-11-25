// Bilanciatore della priorità (i pesi di scadenza, importanza, tempo stimato ed età nel punteggio, più la curvatura delle curve esponenziali di scadenza ed età):
// salvati sul dispositivo e sincronizzati con il server (chiave `bilanciatore`, vince la modifica più recente), così telefono, sito e app per computer
// calcolano le stesse priorità. Il calcolo è in shared/priority.ts.
import { CURVE_PREDEFINITE, getCurve, getPesi, impostaCurve, impostaPesi, normalizzaCurve, normalizzaPesi, PESI_PREDEFINITI, type CurvePunteggio, type PesiPunteggio } from '../../../shared/priority.ts';
import type { ImpostazioniSync } from '../../../shared/types.ts';
import { rinfrescaListe } from './store.ts';

const KEY = 'mytask.bilanciatore';
const KEY_AGG = 'mytask.bilanciatore.agg';
const CHIAVE_SYNC = 'bilanciatore';
/** Quello che si salva e si sincronizza: i pesi e, a parte, le curvature. Mancanti = di base. */
type Salvato = PesiPunteggio & { curve?: CurvePunteggio };
/** Impostazioni personalizzate (undefined = predefinite) e quando sono state modificate l'ultima volta (0 = mai). */
let salvati: Salvato | undefined;
let aggiornato = 0;
const listeners = new Set<() => void>();

function valido(p: unknown): p is Salvato {
  const x = p as Record<string, unknown> | null;
  return !!x && ['scadenza', 'importanza', 'tempo'].every((k) => typeof x[k] === 'number');
}

/** Porta un valore letto (anche vecchio, senza età né curve) nella forma completa. */
const completo = (p: Salvato): Salvato => ({ ...normalizzaPesi(p), curve: normalizzaCurve(p.curve) });

function usa(p: Salvato | undefined) {
  impostaPesi(p);
  impostaCurve(p?.curve);
}

/** Applica le impostazioni salvate (da chiamare all'avvio, prima di mostrare le liste). */
export function avviaPesi() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (valido(p)) { salvati = completo(p); usa(salvati); }
    }
    aggiornato = Number(localStorage.getItem(KEY_AGG)) || 0;
    // pesi scelti prima che si sincronizzassero: da ora valgono come modifica più recente e salgono sul server
    if (salvati && !aggiornato) { aggiornato = Date.now(); localStorage.setItem(KEY_AGG, String(aggiornato)); }
  } catch { /* ignora */ }
}

/** I pesi e le curve in uso. */
export const getPesiUtente = getPesi;
export const getCurveUtente = getCurve;
/** Un valore che cambia a ogni modifica (pesi o curve): serve ai componenti per ridisegnarsi. */
let versione = 0;
export const getVersionePesi = () => versione;
export const subscribePesi = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Imposta pesi e curve (o ripristina quelli di base con `undefined`), li salva e rifà le liste. `quando` è la data di modifica (ora, se non indicata). */
function applica(p: Salvato | undefined, quando: number = Date.now()) {
  salvati = p ? completo(p) : undefined;
  usa(salvati);
  aggiornato = quando;
  versione++;
  try {
    if (salvati) localStorage.setItem(KEY, JSON.stringify(salvati)); else localStorage.removeItem(KEY);
    localStorage.setItem(KEY_AGG, String(aggiornato));
  } catch { /* ignora */ }
  listeners.forEach((l) => l());
  rinfrescaListe();
}

/** Le impostazioni da inviare al server (niente se non sono mai state toccate). */
export function impostazioniPesiDaInviare(): ImpostazioniSync | undefined {
  return aggiornato > 0 ? { [CHIAVE_SYNC]: { valore: salvati ?? null, aggiornato } } : undefined;
}

/** Applica le impostazioni arrivate dal server, se più recenti di quelle locali (`null` = predefinite). Restituisce true se sono cambiate. */
export function applicaPesiDaServer(imp: ImpostazioniSync | undefined): boolean {
  const r = imp?.[CHIAVE_SYNC];
  if (!r || typeof r.aggiornato !== 'number' || r.aggiornato <= aggiornato) return false;
  if (r.valore === null) { applica(undefined, r.aggiornato); return true; }
  if (!valido(r.valore)) return false;
  applica(r.valore, r.aggiornato);
  return true;
}

export const impostaPesiUtente = (p: PesiPunteggio) => applica({ ...p, curve: getCurve() });
export const impostaCurveUtente = (c: CurvePunteggio) => applica({ ...getPesi(), curve: c });
export const ripristinaPesi = () => applica(undefined);
/** True se i pesi coincidono con quelli di base (a meno di un punto percentuale). */
export const sonoPredefiniti = (p: PesiPunteggio) => (Object.keys(PESI_PREDEFINITI) as (keyof PesiPunteggio)[]).every((k) => Math.abs(p[k] - PESI_PREDEFINITI[k]) < 0.005);
/** True se anche le curve coincidono con quelle di base. */
export const sonoCurvePredefinite = (c: CurvePunteggio) => Math.abs(c.scadenza - CURVE_PREDEFINITE.scadenza) < 0.05 && Math.abs(c.eta - CURVE_PREDEFINITE.eta) < 0.05;
