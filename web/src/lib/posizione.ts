// Posizione dell'utente per l'ordine «Per te» delle esperienze. Resta sul dispositivo: non viene mai inviata a nessuno.
import type { Coordinate } from '../../../shared/esperienze.ts';

const KEY = 'mytask.posizione';
/** Una posizione più vecchia di così si richiede di nuovo. */
const VALIDA_MS = 10 * 60_000;

/** Coordinate con il momento in cui sono state rilevate. */
export interface Posizione extends Coordinate { ts: number }
export type EsitoPosizione = 'ok' | 'negata' | 'non_disponibile';

/** Ultima posizione conosciuta (anche vecchia): meglio di niente mentre si aspetta quella nuova. */
export function posizioneSalvata(): Posizione | undefined {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Posizione | null;
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? p : undefined;
  } catch { return undefined; }
}

/** True se la posizione è abbastanza recente da non richiederla di nuovo. */
export const posizioneRecente = (p: Posizione | undefined) => !!p && Date.now() - p.ts < VALIDA_MS;

/** Chiede la posizione al telefono (nell'app compare la richiesta del permesso). */
export function chiediPosizione(): Promise<{ esito: EsitoPosizione; posizione?: Posizione }> {
  return new Promise((risolvi) => {
    if (!('geolocation' in navigator)) { risolvi({ esito: 'non_disponibile' }); return; }
    navigator.geolocation.getCurrentPosition(
      (g) => {
        const posizione: Posizione = { lat: g.coords.latitude, lon: g.coords.longitude, ts: Date.now() };
        try { localStorage.setItem(KEY, JSON.stringify(posizione)); } catch { /* ignora */ }
        risolvi({ esito: 'ok', posizione });
      },
      (e) => risolvi({ esito: e.code === 1 ? 'negata' : 'non_disponibile' }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: VALIDA_MS },
    );
  });
}
