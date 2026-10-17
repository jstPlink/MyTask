// Pianificazione delle notifiche locali (app Android): calcola in anticipo, per i prossimi giorni,
// quali notifiche vanno programmate nel sistema operativo, così arrivano anche ad app chiusa.
// Si ricalcola a ogni modifica dei dati. Funzione pura.
import type { Item } from './types.ts';
import { addDays, diffDays, today as oggiDi, parseISO } from './dates.ts';
import { dueDate, isOpen } from './priority.ts';
import { fattaOggi, weekCount } from './routine.ts';
import { ORA_CHIEDI_PREDEFINITA, type Disponibilita } from './piano.ts';

export interface Notifica {
  /** Intero positivo stabile per la stessa notifica (serve ad Android per sostituirla). */
  id: number;
  titolo: string;
  corpo: string;
  /** Istante in millisecondi */
  quando: number;
}

const MAX_RIPETIZIONI_INSISTENZA = 12;

function idStabile(chiave: string): number {
  let h = 2166136261;
  for (let i = 0; i < chiave.length; i++) { h ^= chiave.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) || 1;
}

function alle(giorno: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = parseISO(giorno);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

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

    // insistenza: ripete ogni N minuti nelle ore successive, finché la voce è scaduta o scade oggi
    if (i.insisti && diffDays(due, oggi) <= 0) {
      const passo = Math.max(15, i.insisti.ogniMinuti) * 60000;
      for (let k = 1; k <= MAX_RIPETIZIONI_INSISTENZA; k++) {
        aggiungi(`${i.id}|insisti|${k}`, i.titolo, 'Ancora da fare', ora_ms + k * passo);
      }
    }
  }
  return out.sort((a, b) => a.quando - b.quando).slice(0, max);
}


export interface RichiestaOrari extends Notifica {
  /** Giorno di cui si chiedono gli orari (il giorno dopo quello in cui arriva la notifica). */
  giorno: string;
}

/**
 * Modalità flessibile: ogni sera, all'ora scelta, una notifica chiede gli orari liberi del giorno dopo.
 * Per i prossimi giorni; salta i giorni per cui gli orari sono già stati inseriti. Funzione pura.
 */
export function richiesteOrari(disp: Disponibilita | null, adesso: Date, giorni = 7): RichiestaOrari[] {
  if (!disp?.flessibile) return [];
  const ora = disp.oraChiedi ?? ORA_CHIEDI_PREDEFINITA;
  const oggi = oggiDi(adesso);
  const out: RichiestaOrari[] = [];
  for (let n = 0; n < giorni; n++) {
    const sera = addDays(oggi, n);
    const quando = alle(sera, ora);
    const giorno = addDays(sera, 1);
    if (quando <= adesso.getTime() || disp.eccezioni?.[giorno]) continue;
    out.push({ id: idStabile(`orari-${giorno}`), giorno, quando, titolo: 'Quando sei libero domani?', corpo: 'Inserisci gli orari e preparo il calendario di domani.' });
  }
  return out;
}
