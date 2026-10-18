import type { Item } from './types.ts';
import { pianifica, orario, type Disponibilita } from './piano.ts';
import { barLevel, battitoBpm, score, urgency } from './priority.ts';
import { live, vistaOggi } from './views.ts';
import { chiaveTitolo } from './capture.ts';
import { NOMI_TIPO } from './types.ts';
import { isClosed } from './priority.ts';

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
    blocchi.filter((b) => !b.fisso).sort((a, b) => (b.punteggio ?? score(b.item, oggi)) - (a.punteggio ?? score(a.item, oggi))).map((b, n) => [b.item.id, n + 1] as const),
  );
  const viste = new Set<string>();
  const righe: RigaWidget[] = [];
  for (const b of [...blocchi].sort((a, c) => a.da - c.da)) {
    if (viste.has(b.item.id)) continue;
    viste.add(b.item.id);
    righe.push({ id: b.item.id, t: b.item.titolo, o: orario(b.da), r: b.fisso ? undefined : classifica.get(b.item.id), l: barLevel(b.punteggio ?? score(b.item, oggi)), b: b.fisso ? undefined : battitoBpm(urgency(b.item, oggi)) || undefined });
  }
  return righe.slice(0, max);
}

/** Una nota nell'archivio del widget: serve alla nota veloce per mostrare le note con parole simili. */
export interface VoceArchivio {
  id: string;
  /** Titolo. */
  t: string;
  /** Riga grigia: tipo, piattaforma, stato. */
  m: string;
  /** 1 se completata, saltata o archiviata. */
  c: 0 | 1;
  /** Testo di ricerca già normalizzato (titolo, note e campi di testo), accorciato. */
  k: string;
  /** Ultima modifica. */
  a: number;
}

const LUNGHEZZA_CHIAVE = 300;

/** Tutte le note (esclusi i contatti) in forma compatta, per la ricerca di note simili dentro il widget. */
export function archivioWidget(items: Item[]): VoceArchivio[] {
  return live(items)
    .filter((i) => i.tipo !== 'persona')
    .map((i) => ({
      id: i.id,
      t: i.titolo,
      m: [NOMI_TIPO[i.tipo], i.piattaforma, i.stato === 'fatto' ? 'completata' : i.stato === 'saltato' ? 'saltata' : i.stato === 'parcheggiato' ? 'archiviata' : i.inbox ? 'in Inbox' : undefined].filter(Boolean).join(' · '),
      c: (isClosed(i) ? 1 : 0) as 0 | 1,
      k: chiaveTitolo([i.titolo, i.note, i.consigliatoDa, i.conChi, i.piattaforma, i.genere, ...(i.checklist ?? []).map((c) => c.testo)].filter(Boolean).join(' ')).slice(0, LUNGHEZZA_CHIAVE),
      a: i.aggiornato,
    }));
}
