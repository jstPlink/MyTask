// Ordine «Per te» delle esperienze: unisce l'interesse, la data più vicina e la distanza dalla posizione dell'utente.
// Funzioni pure (con test): la posizione e le coordinate dei luoghi arrivano da fuori (web/src/lib).
import type { Item } from './types.ts';
import { diffDays } from './dates.ts';
import { dueDate } from './priority.ts';

export interface Coordinate { lat: number; lon: number }

/** Distanza in chilometri in linea d'aria (formula di haversine). */
export function distanzaKm(a: Coordinate, b: Coordinate): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Interesse da 0 a 1 (la scala va da 1 a 5, di base 3 se manca). */
export const valoreInteresse = (i: Item): number => Math.min(1, Math.max(0, ((i.interesse ?? 3) - 1) / 4));

/** Vicinanza della data da 0 a 1: oggi 1, entro 3 giorni 0,9, entro 7 giorni 0,75, entro 30 giorni 0,5, oltre 0,25; senza data un valore neutro (0,3); già passata 0,1. */
export function valoreData(i: Item, oggi: string): number {
  const d = dueDate(i);
  if (!d) return 0.3;
  const giorni = diffDays(d, oggi);
  if (giorni < 0) return 0.1;
  if (giorni === 0) return 1;
  if (giorni <= 3) return 0.9;
  if (giorni <= 7) return 0.75;
  if (giorni <= 30) return 0.5;
  return 0.25;
}

/** Vicinanza da 0 a 1: 1 sul posto, circa metà a 20 km, quasi zero oltre i 100 km (decadimento esponenziale con scala 30 km). */
export const valoreDistanza = (km: number): number => Math.exp(-km / 30);

/** Un'esperienza con il suo punteggio «Per te» (0-100) e, se nota, la distanza in km. */
export interface EsperienzaPerTe { item: Item; punteggio: number; km?: number }

/**
 * Ordina le esperienze per «Per te»: interesse (40%), data più vicina (35%) e distanza (25%).
 * Se la posizione dell'utente o quella del luogo non è nota, la distanza non conta e gli altri due pesano metà ciascuno.
 * `coordinate` associa a ogni esperienza il suo luogo (se trovato).
 */
export function ordinaPerTe(esperienze: Item[], oggi: string, posizione: Coordinate | undefined, coordinate: (i: Item) => Coordinate | undefined): EsperienzaPerTe[] {
  return esperienze
    .map((item) => {
      const luogo = posizione ? coordinate(item) : undefined;
      const km = posizione && luogo ? distanzaKm(posizione, luogo) : undefined;
      const interesse = valoreInteresse(item);
      const data = valoreData(item, oggi);
      const s = km === undefined ? 0.5 * interesse + 0.5 * data : 0.4 * interesse + 0.35 * data + 0.25 * valoreDistanza(km);
      return { item, punteggio: Math.round(s * 100), km };
    })
    .sort((a, b) => b.punteggio - a.punteggio || (dueDate(a.item) ?? '9999').localeCompare(dueDate(b.item) ?? '9999') || a.item.titolo.localeCompare(b.item.titolo, 'it'));
}

/** Coordinate dentro un link di Google Maps (…@45.07,7.68…, …!3d45.07!4d7.68…, …?q=45.07,7.68…), se ci sono. */
export function coordinateDaLink(link: string | undefined): Coordinate | undefined {
  if (!link) return undefined;
  const m = link.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ?? link.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? link.match(/[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : undefined;
}

/** Testo con cui cercare il luogo di un'esperienza: il luogo scritto (campo `zona`), altrimenti il titolo. */
export const testoLuogo = (i: Item): string => (i.zona?.trim() || i.titolo.trim()).toLowerCase();
