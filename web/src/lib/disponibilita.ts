// Tempo libero per giorno della settimana (con eccezioni per date e modalità flessibile). Salvato sul dispositivo
// (localStorage) e sincronizzato con il server come «impostazione» (vedi sync.ts), così il telefono e il sito
// vedono gli stessi orari: vince la modifica più recente (confronto sul timestamp `aggiornato`).
import { DISPONIBILITA_SUGGERITA, senzaGiorniPassati, type Disponibilita, type FasciaOraria } from '../../../shared/piano.ts';
import type { ImpostazioniSync } from '../../../shared/types.ts';

/** Chiavi di localStorage: il valore e il momento dell'ultima modifica. */
const KEY = 'mytask.disponibilita';
const KEY_AGG = 'mytask.disponibilita.aggiornato';
/** Nome con cui il tempo libero viaggia tra i dispositivi nella sincronizzazione. */
const CHIAVE_SYNC = 'tempoLibero';
const listeners = new Set<() => void>();

const fasciaValida = (f: unknown): f is FasciaOraria =>
  !!f && typeof (f as FasciaOraria).da === 'string' && typeof (f as FasciaOraria).a === 'string' && /^\d{2}:\d{2}$/.test((f as FasciaOraria).da) && /^\d{2}:\d{2}$/.test((f as FasciaOraria).a);

/** Controlla un valore letto dal telefono o ricevuto dal server; null se non è un tempo libero valido. */
export function valida(p: unknown): Disponibilita | null {
  const d = p as Partial<Disponibilita> | null;
  if (!d || !Array.isArray(d.settimana) || d.settimana.length !== 7) return null;
  return {
    settimana: d.settimana.map((g) => (Array.isArray(g) ? g.filter(fasciaValida) : [])),
    eccezioni: d.eccezioni && typeof d.eccezioni === 'object' ? d.eccezioni : undefined,
    flessibile: d.flessibile === true ? true : undefined,
    oraChiedi: typeof d.oraChiedi === 'string' && /^\d{2}:\d{2}$/.test(d.oraChiedi) ? d.oraChiedi : undefined,
    pausaMin: typeof d.pausaMin === 'number' && d.pausaMin >= 0 && d.pausaMin <= 120 ? Math.round(d.pausaMin) : undefined,
  };
}

/** null = non ancora impostato: Oggi resta con la lista semplice. */
function leggi(): Disponibilita | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? valida(JSON.parse(raw)) : null;
  } catch { return null; }
}

let corrente: Disponibilita | null = leggi();

function salva(d: Disponibilita, aggiornato: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    localStorage.setItem(KEY_AGG, String(aggiornato));
  } catch { /* ignora */ }
}

/**
 * Quando è stato modificato l'ultima volta. Un valore impostato da una versione dell'app che non
 * teneva la data riceve la data di adesso, così al primo collegamento sale sul server.
 */
function getAggiornato(): number {
  if (!corrente) return 0;
  try {
    const n = Number(localStorage.getItem(KEY_AGG));
    if (Number.isFinite(n) && n > 0) return n;
    const ora = Date.now();
    localStorage.setItem(KEY_AGG, String(ora));
    return ora;
  } catch { return 0; }
}

/** Il tempo libero corrente, o null se non è ancora stato impostato. */
export const getDisponibilita = () => corrente;
export const subscribeDisponibilita = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Sostituisce il tempo libero, lo salva con la data di adesso e avvisa gli ascoltatori (che avviano la sincronizzazione). */
export function impostaDisponibilita(d: Disponibilita) {
  corrente = d;
  salva(d, Date.now());
  listeners.forEach((l) => l());
}

/** Salva gli orari liberi di un giorno (modalità flessibile). Una lista vuota vuol dire «nessun tempo libero». */
export function impostaOrariGiorno(giorno: string, fasce: FasciaOraria[], oggi: string) {
  const base: Disponibilita = corrente ?? { settimana: Array.from({ length: 7 }, () => []), flessibile: true };
  impostaDisponibilita({ ...base, eccezioni: { ...(senzaGiorniPassati(base.eccezioni, oggi) ?? {}), [giorno]: fasce } });
}

/** Copia modificabile degli orari suggeriti. */
export const copiaSuggerita = (): Disponibilita => JSON.parse(JSON.stringify(DISPONIBILITA_SUGGERITA)) as Disponibilita;
export const usaSuggerita = () => impostaDisponibilita(copiaSuggerita());

/** Il tempo libero da inviare al server (niente se non è ancora stato impostato). */
export function impostazioniDaInviare(): ImpostazioniSync | undefined {
  return corrente ? { [CHIAVE_SYNC]: { valore: corrente, aggiornato: getAggiornato() } } : undefined;
}

/** Applica il tempo libero arrivato dal server, se è più recente di quello locale. Restituisce true se è cambiato. */
export function applicaDaServer(imp: ImpostazioniSync | undefined): boolean {
  const r = imp?.[CHIAVE_SYNC];
  if (!r || typeof r.aggiornato !== 'number' || r.aggiornato <= getAggiornato()) return false;
  const d = valida(r.valore);
  if (!d) return false;
  corrente = d;
  salva(d, r.aggiornato);
  listeners.forEach((l) => l());
  return true;
}
