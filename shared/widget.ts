import type { Item } from './types.ts';
import { pianifica, orario, type Disponibilita } from './piano.ts';
import { barLevel, battitoBpm, score, urgency } from './priority.ts';
import { vistaOggi } from './views.ts';

/** Una riga del widget "Oggi" della schermata Home. */
export interface RigaWidget {
  id: string;
  /** Titolo. */
  t: string;
  /** Orario di inizio nel piano (HH:MM). */
  o?: string;
  /** Posizione in classifica (assente per gli impegni con orario fisso). */
  r?: number;
  /** Livello di priorità 1-3, per il colore del pallino. */
  l: 1 | 2 | 3;
  /** Battiti al minuto del pallino (come nell'app: più veloce quanto più la scadenza è vicina); assente se non batte. */
  b?: number;
}

/**
 * Le cose da fare oggi per il widget, nell'ordine del piano di oggi (con orario e posizione in classifica).
 * Senza tempo libero impostato è la lista semplice di Oggi. Le attività spezzate compaiono una volta sola.
 */
export function righeWidget(items: Item[], disp: Disponibilita | null, oggi: string, now: number, margine: number, max = 20): RigaWidget[] {
  if (!disp) {
    return vistaOggi(items, oggi).fare.slice(0, max).map((e, n) => ({ id: e.item.id, t: e.item.titolo, r: n + 1, l: barLevel(e.punteggio), b: battitoBpm(urgency(e.item, oggi)) || undefined }));
  }
  const blocchi = (pianifica(items, disp, oggi, now, undefined, margine).giorni[0]?.blocchi ?? []).filter((b) => !b.pausa);
  const classifica = new Map(
    blocchi.filter((b) => !b.fisso).sort((a, b) => score(b.item, oggi) - score(a.item, oggi)).map((b, n) => [b.item.id, n + 1] as const),
  );
  const viste = new Set<string>();
  const righe: RigaWidget[] = [];
  for (const b of [...blocchi].sort((a, c) => a.da - c.da)) {
    if (viste.has(b.item.id)) continue;
    viste.add(b.item.id);
    righe.push({ id: b.item.id, t: b.item.titolo, o: orario(b.da), r: b.fisso ? undefined : classifica.get(b.item.id), l: barLevel(score(b.item, oggi)), b: b.fisso ? undefined : battitoBpm(urgency(b.item, oggi)) || undefined });
  }
  return righe.slice(0, max);
}
