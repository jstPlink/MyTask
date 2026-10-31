// Pianificazione delle notifiche locali (app Android): calcola in anticipo, per i prossimi giorni,
// quali notifiche vanno programmate nel sistema operativo, così arrivano anche ad app chiusa.
// Si ricalcola a ogni modifica dei dati. Funzione pura.
import type { Item } from './types.ts';
import { addDays, diffDays, today as oggiDi, parseISO } from './dates.ts';
import { dueDate, isOpen } from './priority.ts';
import { haNotificaIl, oraNotifica, testoPromemoria } from './dataNota.ts';
import { fattaOggi, weekCount } from './routine.ts';

/** Una notifica locale da programmare nel telefono. */
export interface Notifica {
  /** Intero positivo stabile per la stessa notifica (serve ad Android per sostituirla). */
  id: number;
  titolo: string;
  corpo: string;
  /** Istante in millisecondi */
  quando: number;
}

/** Numero intero positivo ricavato dal testo (hash FNV-1a): la stessa notifica ha sempre lo stesso id, così Android la sostituisce invece di duplicarla. */
function idStabile(chiave: string): number {
  let h = 2166136261;
  for (let i = 0; i < chiave.length; i++) { h ^= chiave.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) || 1;
}

/** Istante (millisecondi) di un giorno YYYY-MM-DD a una certa ora HH:MM locale. */
function alle(giorno: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = parseISO(giorno);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/**
 * Notifiche da programmare per i prossimi `giorni` (al massimo `max`, le più vicine):
 * - promemoria scelti sulla voce (N giorni prima della scadenza, all'ora indicata);
 * - notifica quotidiana (`promemoriaGiornaliero`): una al giorno, all'ora indicata, dal giorno di inizio (a scadenza N giorni prima, con la data
 *   fissa dal giorno stesso) fino a quando la voce non è spuntata, anche dopo la data;
 * - routine con ora del promemoria: ogni giorno, salvo oggi se già fatta e i giorni dopo che la quota settimanale è già raggiunta.
 * Non considera voci chiuse, eliminate o archiviate.
 */
export function pianificaNotifiche(items: Item[], ora: Date, giorni = 14, max = 100): Notifica[] {
  const ora_ms = ora.getTime();
  const oggi = oggiDi(ora);
  const fine = addDays(oggi, giorni);
  const out: Notifica[] = [];
  const aggiungi = (chiave: string, titolo: string, corpo: string, quando: number) => {
    if (quando > ora_ms && quando <= alle(fine, '23:59')) out.push({ id: idStabile(chiave), titolo, corpo, quando });
  };

  for (const i of items) {
    if (i.eliminato || !isOpen(i) || i.stato === 'parcheggiato') continue;

    if (i.tipo === 'routine') {
      if (!i.oraPromemoria) continue;
      for (let n = 0; n < giorni; n++) {
        const g = addDays(oggi, n);
        if (g === oggi && fattaOggi(i, oggi)) continue;
        // quota settimanale già raggiunta: niente promemoria per il resto della settimana in corso
        if (i.volteSettimana && diffDays(g, oggi) < 7 && weekCount(i, oggi) >= i.volteSettimana && weekCount(i, g) >= i.volteSettimana) continue;
        aggiungi(`${i.id}|routine|${g}`, i.titolo, i.obiettivo ?? 'Routine di oggi', alle(g, i.oraPromemoria));
      }
      continue;
    }

    const due = dueDate(i);
    if (!due) continue;

    for (const p of i.promemoria ?? []) {
      const g = addDays(due, -p.giorniPrima);
      aggiungi(`${i.id}|${p.giorniPrima}|${due}`, i.titolo, p.giorniPrima === 0 ? 'Scade oggi' : p.giorniPrima === 1 ? 'Scade domani' : `Scade tra ${p.giorniPrima} giorni`, alle(g, p.ora));
    }

    // notifica quotidiana: dal giorno di inizio alla data («Ricordamelo ogni giorno»), poi ogni giorno finché non è spuntata («Ripeti finché non spunto»)
    for (let n = 0; n <= giorni; n++) {
      const g = addDays(oggi, n);
      if (haNotificaIl(i, g)) aggiungi(`${i.id}|giorno|${g}`, i.titolo, testoPromemoria(i, g), alle(g, oraNotifica(i)));
    }
  }
  return out.sort((a, b) => a.quando - b.quando).slice(0, max);
}

