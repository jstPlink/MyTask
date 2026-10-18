// Coordinate dei luoghi delle esperienze, cercate su OpenStreetMap (Nominatim, gratuito e senza chiave).
// A internet va solo il nome del luogo; il risultato si ricorda sul dispositivo (anche «non trovato»), così si cerca una volta sola.
import { coordinateDaLink, testoLuogo, type Coordinate } from '../../../shared/esperienze.ts';
import type { Item } from '../../../shared/types.ts';

/** Cache nel localStorage: testo del luogo -> coordinate (o «non trovato») con il momento della ricerca. */
const KEY = 'mytask.luoghi';
const PAUSA_MS = 1200; // Nominatim chiede al massimo una richiesta al secondo
/** Un luogo non trovato si riprova dopo qualche giorno. */
const RIPROVA_MS = 7 * 86400000;

/** Una voce della cache. */
type Voce = (Coordinate & { ts: number }) | { nontrovato: true; ts: number };
type Cache = Record<string, Voce>;

function leggi(): Cache {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Cache; } catch { return {}; }
}
function salva(c: Cache) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignora */ }
}

/** Coordinate note di un'esperienza: dal link di Google Maps se le contiene, altrimenti dalla cache dei luoghi. */
export function coordinateNote(i: Item, cache: Cache = leggi()): Coordinate | undefined {
  const dalLink = coordinateDaLink(i.linkMaps);
  if (dalLink) return dalLink;
  const v = cache[testoLuogo(i)];
  return v && 'lat' in v ? { lat: v.lat, lon: v.lon } : undefined;
}

/** Legge la cache dei luoghi. */
export const leggiCacheLuoghi = leggi;

/** Luoghi da cercare: senza coordinate né nel link né in cache (o non trovati da più di una settimana). */
export function luoghiDaCercare(esperienze: Item[], cache: Cache = leggi()): string[] {
  const set = new Set<string>();
  for (const i of esperienze) {
    if (coordinateDaLink(i.linkMaps)) continue;
    const k = testoLuogo(i);
    const v = cache[k];
    if (k.length >= 2 && (!v || ('nontrovato' in v && Date.now() - v.ts > RIPROVA_MS))) set.add(k);
  }
  return [...set];
}

/** Cerca i luoghi uno alla volta (con pausa) e chiama `dopoOgni` con la cache aggiornata. `ferma()` interrompe. */
export function cercaLuoghi(luoghi: string[], dopoOgni: (c: Cache) => void): { ferma: () => void } {
  let fermo = false;
  void (async () => {
    for (const luogo of luoghi) {
      if (fermo || !navigator.onLine) return;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=it&q=${encodeURIComponent(luogo)}`);
        if (res.status === 429) return;
        if (!res.ok) continue;
        const r = (await res.json()) as { lat: string; lon: string }[];
        const c = leggi();
        c[luogo] = r[0] ? { lat: Number(r[0].lat), lon: Number(r[0].lon), ts: Date.now() } : { nontrovato: true, ts: Date.now() };
        salva(c);
        if (!fermo) dopoOgni(c);
      } catch { return; }
      await new Promise((r) => setTimeout(r, PAUSA_MS));
    }
  })();
  return { ferma: () => { fermo = true; } };
}
