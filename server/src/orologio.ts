// Orologio (Zepp OS): stato del timer e comandi (pausa, riprendi, completa), eseguiti sul server sulla sessione e sulla nota
// con le stesse regole dell'app (shared/sessione.ts): il telefono li riceve alla prossima sincronizzazione.
import { today } from '../../shared/dates.ts';
import { completa } from '../../shared/recurrence.ts';
import { SESSIONE_FERMA, minutiMisurati, msTrattoInCorso, sessioneValida, type Sessione } from '../../shared/sessione.ts';
import type { Item } from '../../shared/types.ts';
import type { Store } from './db.ts';

/** Quello che l'orologio mostra: `ferma` (pagina vuota) oppure il timer di una nota. */
export type StatoOrologio =
  | { stato: 'ferma' }
  | { stato: 'lavoro' | 'pausa'; id: string; titolo: string; tempoMs: number; trattoMs: number; stimaMin?: number };

export type ComandoOrologio = 'pausa' | 'riprendi' | 'completa';

/** La sessione salvata e la sua nota, se la sessione è valida e la nota è ancora aperta. */
function sessioneAttiva(store: Store, utente: number): { s: Sessione; item: Item } | undefined {
  const s = sessioneValida(store.getSetting(utente, 'sessione')?.valore) ?? SESSIONE_FERMA;
  if (s.stato === 'ferma' || !s.taskId) return undefined;
  const item = store.getItem(utente, s.taskId);
  if (!item || item.eliminato || item.stato === 'fatto' || item.stato === 'saltato' || item.stato === 'parcheggiato') return undefined;
  return { s, item };
}

/** Il tempo lavorato sulla nota, compreso il tratto che sta correndo. */
function tempoTotale(s: Sessione, item: Item, now: number): number {
  return (s.base ?? item.lavoratoMs ?? 0) + msTrattoInCorso(s, now);
}

export function statoOrologio(store: Store, utente: number, now: number): StatoOrologio {
  const a = sessioneAttiva(store, utente);
  if (!a) return { stato: 'ferma' };
  return {
    stato: a.s.stato === 'lavoro' ? 'lavoro' : 'pausa',
    id: a.item.id,
    titolo: a.item.titolo,
    tempoMs: Math.round(tempoTotale(a.s, a.item, now)),
    // da quanto corre il tratto in corso: le vibrazioni periodiche ripartono da zero a ogni pausa o ripresa, come le notifiche del telefono
    trattoMs: Math.round(msTrattoInCorso(a.s, now)),
    ...(a.item.sforzoMin ? { stimaMin: a.item.sforzoMin } : {}),
  };
}

function salvaSessione(store: Store, utente: number, nuova: Omit<Sessione, 'aggiornato'>, now: number) {
  const prec = store.getSetting(utente, 'sessione')?.aggiornato ?? 0;
  const aggiornato = Math.max(now, prec + 1);
  store.applySettings(utente, { sessione: { valore: { ...nuova, aggiornato }, aggiornato } });
}

/** Esegue il comando; restituisce false se non si può (nessuna sessione, nota diversa o stato sbagliato). */
export function comandoOrologio(store: Store, utente: number, comando: ComandoOrologio, id: string | undefined, now: number): boolean {
  const a = sessioneAttiva(store, utente);
  if (!a || (id && id !== a.item.id)) return false;
  const { s, item } = a;
  const totale = tempoTotale(s, item, now);
  if (comando === 'pausa') {
    if (s.stato !== 'lavoro') return false;
    if (totale > (item.lavoratoMs ?? 0)) store.applyChanges(utente, [{ ...item, lavoratoMs: Math.round(totale), aggiornato: Math.max(now, item.aggiornato + 1) }]);
    salvaSessione(store, utente, { stato: 'pausa', taskId: item.id, base: Math.round(totale), controllo: s.controllo }, now);
    return true;
  }
  if (comando === 'riprendi') {
    if (s.stato !== 'pausa') return false;
    salvaSessione(store, utente, { stato: 'lavoro', taskId: item.id, inizio: now, base: s.base ?? item.lavoratoMs ?? 0, controllo: now }, now);
    return true;
  }
  // completa: solo attività e curiosità (le altre note passano dall'app, che chiede voto e commento)
  if (item.tipo !== 'azione' && item.tipo !== 'curiosita') return false;
  const durata = item.ricorrenza ? undefined : minutiMisurati(totale);
  const fatta: Item = { ...completa(item, today(), now), ...(totale > 0 ? { lavoratoMs: Math.round(totale) } : {}), ...(durata ? { durataRealeMin: durata } : {}) };
  store.applyChanges(utente, [{ ...fatta, aggiornato: Math.max(now, item.aggiornato + 1, fatta.aggiornato) }]);
  salvaSessione(store, utente, { stato: 'ferma' }, now);
  return true;
}
