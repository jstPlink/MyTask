// Date a scadenza e date fisse: il tipo della data decide da quando e con che testo parte la notifica quotidiana.
// - scadenza: la voce va finita entro la data; la notifica parte `giorniPrima` giorni prima e continua, anche dopo, finché non è spuntata;
// - fissa: la voce si fa da quel giorno; nessuna notifica prima, poi una al giorno finché non è spuntata.
import type { Item, TipoData } from './types.ts';
import { addDays, diffDays, giornoSettimana } from './dates.ts';
import { dueDate } from './priority.ts';

/** Tipo della data di una voce: senza valore è «scadenza» (per le esperienze, che sono eventi, «fissa»). */
export const tipoDataDi = (i: Item): TipoData => i.tipoData ?? (i.tipo === 'esperienza' ? 'fissa' : 'scadenza');

/** Giorno da cui parte la notifica quotidiana (senza data o senza promemoria: undefined). */
export function inizioPromemoria(i: Item): string | undefined {
  const due = dueDate(i);
  if (!due || !i.promemoriaGiornaliero) return undefined;
  return tipoDataDi(i) === 'fissa' ? due : addDays(due, -i.promemoriaGiornaliero.giorniPrima);
}

/** Ora (HH:MM) delle notifiche quotidiane: quella scelta nel promemoria, altrimenti le 9:00. */
export const oraNotifica = (i: Item): string => i.promemoriaGiornaliero?.ora ?? '09:00';

/**
 * Se `giorno` ha una notifica quotidiana: dal giorno di inizio alla data (il promemoria «Ricordamelo ogni giorno»), poi ogni giorno dopo la data
 * se «Ripeti finché non spunto» (`insisti`) è acceso; senza promemoria quotidiano il ripeti parte dalla data stessa.
 */
export function haNotificaIl(i: Item, giorno: string): boolean {
  const due = dueDate(i);
  if (!due) return false;
  const inizio = inizioPromemoria(i);
  if (inizio && giorno >= inizio && giorno <= due) return true;
  return !!i.insisti && giorno >= (i.promemoriaGiornaliero ? addDays(due, 1) : due);
}

/** Testo della notifica quotidiana di `giorno` (YYYY-MM-DD) per una voce con data. */
export function testoPromemoria(i: Item, giorno: string): string {
  const due = dueDate(i)!;
  const n = diffDays(due, giorno); // giorni alla data (negativo = passata)
  if (tipoDataDi(i) === 'fissa') {
    if (n >= 0) return i.oraInizio ? `Da fare oggi · ${i.oraInizio}` : 'Da fare oggi';
    if (n === -1) return 'Era per ieri, ancora da fare';
    return `Era per ${giornoSettimana(due)} (${-n} giorni fa)`;
  }
  if (n > 1) return `Scade tra ${n} giorni`;
  if (n === 1) return 'Scade domani';
  if (n === 0) return 'Scade oggi';
  if (n === -1) return 'Scaduta ieri, ancora da fare';
  return `Scaduta da ${-n} giorni, ancora da fare`;
}

/** Etichetta della data per le righe delle liste: testo, tipo (per l'icona) e se è in ritardo (da mostrare in arancio). */
export function etichettaData(i: Item, oggi: string, formatta: (iso: string) => string): { testo: string; tipo: TipoData; ritardo: boolean } | undefined {
  const due = dueDate(i);
  if (!due) return undefined;
  const tipo = tipoDataDi(i);
  const n = diffDays(due, oggi);
  if (n < 0) return { tipo, ritardo: true, testo: tipo === 'fissa' ? (n === -1 ? 'era per ieri' : `era per ${-n} gg fa`) : (n === -1 ? 'scaduta ieri' : `scaduta da ${-n} gg`) };
  if (n === 0) return { tipo, ritardo: true, testo: 'oggi' };
  return { tipo, ritardo: false, testo: tipo === 'fissa' ? formatta(due) : `entro ${formatta(due)}` };
}

/** Entro quanti giorni una nota con data fissa ancora lontana compare nella sezione «In arrivo» di Priorità. */
export const GIORNI_IN_ARRIVO = 7;
/** Quante note mostra al massimo la sezione «In arrivo». */
export const MAX_IN_ARRIVO = 3;

/**
 * «In arrivo»: un'attività con la data fissa ancora nel futuro e non iniziata. Non si può fare adesso, quindi non entra nella classifica di
 * priorità (nessun numero, nessuna posizione): compare solo nella sezione «In arrivo» di Priorità quando manca poco, e dal giorno stesso
 * torna una nota normale. Per un passo di progetto si passa la voce con l'ereditarietà già applicata.
 */
export function inArrivo(i: Item, oggi: string): boolean {
  const due = dueDate(i);
  return (i.tipo === 'azione' || i.tipo === 'progetto') && i.tipoData === 'fissa' && !!due && due > oggi && i.stato === 'da_fare';
}
