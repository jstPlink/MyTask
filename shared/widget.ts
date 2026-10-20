// Dati per il widget «Oggi» della schermata Home di Android: le righe della lista di oggi, la sessione «Inizia» e un
// archivio compatto delle note. L'app li calcola e li invia al widget (plugin Widget); il widget non legge i dati dell'app né usa la rete.
import type { Item } from './types.ts';
import { livelloPriorita, battitoBpm, isClosed, intensitaBattito } from './priority.ts';
import type { Sessione } from './sessione.ts';
import { classificaPriorita, live, vistaOggi } from './views.ts';
import { chiaveTitolo } from './testo.ts';
import { NOMI_TIPO } from './types.ts';

/** Una riga del widget "Oggi" della schermata Home. */
export interface RigaWidget {
  id: string;
  /** Titolo. */
  t: string;
  /** Posizione nella classifica unica di priorità (1 = la prima da fare), uguale a quella dell'app; assente se la voce non è in classifica. */
  r?: number;
  /** Millisecondi già lavorati sul task con il cronometro: il widget li usa come punto di partenza se lo avvia lui. */
  w?: number;
  /** Livello di priorità 1-3, per il colore del pallino. */
  l: 1 | 2 | 3;
  /** Battiti al minuto del pallino (come nell'app: più veloce quanto più la scadenza è vicina); assente se non batte. */
  b?: number;
  /** 1 se il task è «in corso»: la casella del widget è mezza gialla come nell'app. */
  c?: 1;
  /** Tempo previsto in minuti (la stima della nota), se c'è. */
  p?: number;
  /** «c» se è una curiosità (senza posizione in classifica, in una sezione sua); assente per le attività. */
  k?: 'c';
  /** Interesse 1-5 di una curiosità, per il pallino verde che si riempie con l'interesse. */
  i?: number;
}

/**
 * Le cose da fare oggi per il widget, come in Priorità: prima le attività (`vistaOggi().fare`, con posizione in classifica,
 * priorità e battito), poi le curiosità (`k: 'c'`, senza posizione). Nessuna è tagliata: il widget scorre.
 */
export function righeWidget(items: Item[], oggi: string, max = 20): RigaWidget[] {
  const classifica = classificaPriorita(items, oggi); // la stessa posizione che si legge nell'app
  const v = vistaOggi(items, oggi);
  const attivita: RigaWidget[] = v.fare.slice(0, max).map((e) => ({
    id: e.item.id, t: e.item.titolo, r: classifica.get(e.item.id), l: livelloPriorita(e.item, oggi), b: battitoBpm(intensitaBattito(e.item, oggi), classifica.get(e.item.id)) || undefined, w: e.item.lavoratoMs || undefined, c: e.item.stato === 'in_corso' ? 1 : undefined, p: e.item.sforzoMin || undefined,
  }));
  const curiosita: RigaWidget[] = v.curiosita.map((i) => ({
    id: i.id, t: i.titolo, l: 1, w: i.lavoratoMs || undefined, c: i.stato === 'in_corso' ? 1 : undefined, p: i.sforzoMin || undefined, k: 'c', i: Math.max(1, Math.min(5, Math.round(i.interesse ?? 3))),
  }));
  return [...attivita, ...curiosita];
}

/** La sessione «Inizia» come la vede il widget: il cronometro mostra `base` più, se corre (`lavoro`), il tempo da `ref`. */
export interface LavoroWidget {
  stato: 'lavoro' | 'pausa';
  id: string;
  /** Titolo del task. */
  t: string;
  /** Millisecondi già accumulati sul task (senza il tratto che sta correndo). */
  base: number;
  /** Inizio del tratto che sta correndo (millisecondi). */
  ref: number;
  /** Tempo previsto per il task in minuti (la sua stima), se c'è: il widget mostra «su 1 h 20 min». */
  p?: number;
}

/** La sessione da mostrare nel widget, o null se non si sta lavorando (o il task non esiste più). */
export function lavoroWidget(items: Item[], s: Sessione): LavoroWidget | null {
  if (s.stato === 'ferma' || !s.taskId) return null;
  const item = items.find((i) => i.id === s.taskId && !i.eliminato);
  return item ? { stato: s.stato, id: item.id, t: item.titolo, base: item.lavoratoMs ?? 0, ref: s.inizio ?? 0, p: item.sforzoMin || undefined } : null;
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

/** Il testo di ricerca di ogni nota è accorciato a tanti caratteri, per tenere piccolo l'archivio passato al widget. */
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
