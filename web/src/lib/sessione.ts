// «Sto lavorando»: lo stato della sessione di lavoro (un cronometro che corre su un task alla volta) e le azioni per
// avviarla, metterla in pausa, spostarla su un altro task o chiuderla. Il modello e i calcoli sono in shared/sessione.ts.
// Lo stato sta sul dispositivo (localStorage) e viaggia nella sincronizzazione come «impostazione» (chiave `sessione`),
// così telefono e sito vedono lo stesso cronometro: vince la modifica più recente. Il tempo di ogni task si accumula
// in `Item.lavoratoMs`; completare un task passa il cronometro al successivo della lista di Oggi.
import { today } from '../../../shared/dates.ts';
import { isOpen } from '../../../shared/priority.ts';
import { vistaOggi } from '../../../shared/views.ts';
import {
  INTERVALLO_CONTROLLO_MS, SESSIONE_FERMA, msTrattoInCorso, prossimoTask, sessioneValida, tempoLavorato, type Sessione,
} from '../../../shared/sessione.ts';
import type { Item, ImpostazioniSync } from '../../../shared/types.ts';
import { getItem, getItems, saveItem, subscribe } from './store.ts';
import { mostraToast } from './toast.ts';

const KEY = 'mytask.sessione';
/** Nome con cui la sessione viaggia tra i dispositivi nella sincronizzazione. */
const CHIAVE_SYNC = 'sessione';
const listeners = new Set<() => void>();

function leggi(): Sessione {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw ? sessioneValida(JSON.parse(raw)) : null) ?? SESSIONE_FERMA;
  } catch { return SESSIONE_FERMA; }
}

let corrente: Sessione = leggi();

function salva(s: Sessione) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignora */ }
}

/** La sessione corrente (`stato: 'ferma'` se non si sta lavorando). */
export const getSessione = (): Sessione => corrente;
export const subscribeSessione = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Sostituisce la sessione, la salva con la data di adesso e avvisa gli ascoltatori (che avviano la sincronizzazione). */
function imposta(s: Omit<Sessione, 'aggiornato'>, now = Date.now()) {
  corrente = { ...s, aggiornato: Math.max(now, corrente.aggiornato + 1) };
  salva(corrente);
  listeners.forEach((l) => l());
}

/** Le note della lista di Oggi, in ordine di priorità: da qui si sceglie il task su cui lavorare. */
export function elencoLavoro(): Item[] {
  return vistaOggi(getItems(), today(), Date.now()).fare.map((e) => e.item);
}
const idElenco = () => elencoLavoro().map((i) => i.id);

/** Porta il task «in corso» (se era da fare) e ne ricorda il momento. */
function segnaInCorso(id: string, now: number) {
  const item = getItem(id);
  if (item && item.stato === 'da_fare') saveItem({ ...item, stato: 'in_corso', inCorsoTs: now, aggiornato: now });
}

/** Somma `ms` al tempo lavorato di un task. */
function accumula(id: string | undefined, ms: number, now: number) {
  const item = id ? getItem(id) : undefined;
  if (!item || ms <= 0) return;
  saveItem({ ...item, lavoratoMs: (item.lavoratoMs ?? 0) + Math.round(ms), aggiornato: now });
}

/** Chiude il tratto che sta correndo (se c'è) aggiungendolo al task. */
function chiudiTratto(s: Sessione, now: number) {
  accumula(s.taskId, msTrattoInCorso(s, now), now);
}

/** «Sto lavorando»: il cronometro parte sul primo task della lista di Oggi (o su `id`, se dato). */
export function iniziaLavoro(id?: string, now = Date.now()) {
  if (corrente.stato !== 'ferma') return;
  const scelto = id ?? idElenco()[0];
  if (!scelto) { mostraToast('Nessuna attività da fare'); return; }
  imposta({ stato: 'lavoro', taskId: scelto, inizio: now, controllo: now }, now);
  segnaInCorso(scelto, now);
}

/** Ferma il cronometro (telefonata, pranzo) tenendo aperta la sessione. */
export function mettiInPausa(now = Date.now()) {
  if (corrente.stato !== 'lavoro') return;
  chiudiTratto(corrente, now);
  imposta({ stato: 'pausa', taskId: corrente.taskId, controllo: corrente.controllo }, now);
}

/** Riprende dal task in pausa. */
export function riprendi(now = Date.now()) {
  if (corrente.stato !== 'pausa') return;
  imposta({ stato: 'lavoro', taskId: corrente.taskId, inizio: now, controllo: now }, now);
}

/** Sposta il cronometro su un altro task senza finire il primo (che resta «in corso» con il tempo accumulato). */
export function passaA(id: string, now = Date.now()) {
  if (corrente.stato === 'ferma') { iniziaLavoro(id, now); return; }
  if (id === corrente.taskId) { if (corrente.stato === 'pausa') riprendi(now); return; }
  chiudiTratto(corrente, now);
  imposta({ stato: 'lavoro', taskId: id, inizio: now, controllo: now }, now);
  segnaInCorso(id, now);
}

/** «Non ora»: passa al task successivo della lista senza completare quello attuale. */
export function nonOra(now = Date.now()) {
  if (corrente.stato === 'ferma') return;
  const prossimo = prossimoTask(idElenco(), corrente.taskId);
  if (prossimo) passaA(prossimo, now);
  else mostraToast('Non ci sono altre attività in lista');
}

/** «Ho finito di lavorare»: chiude la sessione. Nessun task viene completato da solo. */
export function finisciSessione(now = Date.now()) {
  if (corrente.stato === 'ferma') return;
  chiudiTratto(corrente, now);
  imposta({ stato: 'ferma' }, now);
}

/** Controllo periodico, risposta «Ho smesso N minuti fa»: il tempo conta solo fino a quel momento e la sessione va in pausa. */
export function smessoMinutiFa(minuti: number, now = Date.now()) {
  if (corrente.stato !== 'lavoro') return;
  const fine = Math.max(corrente.inizio ?? now, now - minuti * 60_000);
  accumula(corrente.taskId, fine - (corrente.inizio ?? fine), now);
  imposta({ stato: 'pausa', taskId: corrente.taskId, controllo: corrente.controllo }, now);
}

/** Controllo periodico, risposta «Sì»: si sta ancora lavorando. */
export function confermaControllo(now = Date.now()) {
  if (corrente.stato !== 'lavoro') return;
  imposta({ stato: 'lavoro', taskId: corrente.taskId, inizio: corrente.inizio, controllo: now }, now);
}

/** Quando l'app deve chiedere «Stai ancora lavorando?» (millisecondi), o undefined se non si sta lavorando. */
export function scadenzaControllo(s: Sessione = corrente): number | undefined {
  return s.stato === 'lavoro' ? (s.controllo ?? s.inizio ?? 0) + INTERVALLO_CONTROLLO_MS : undefined;
}

/** Il tempo che `item` ha totalizzato fin qui (anche il tratto che sta correndo adesso). */
export const tempoDi = (item: Item, now = Date.now()) => tempoLavorato(item, corrente, now);

/**
 * Da chiamare quando un task viene completato (dopo averlo salvato come fatto): se era quello su cui correva il cronometro,
 * la sessione passa al successivo della lista (restando in pausa se era in pausa), oppure si chiude se la lista è finita.
 * `elencoPrima` è l'elenco di id di Oggi com'era prima del completamento (serve a trovare «il successivo»).
 */
export function dopoCompletamento(id: string, elencoPrima: string[], now = Date.now()) {
  if (corrente.stato === 'ferma' || corrente.taskId !== id) return;
  const adesso = idElenco().filter((x) => x !== id);
  const prossimo = prossimoTask(elencoPrima, id, [id]) ?? adesso[0];
  if (!prossimo) {
    imposta({ stato: 'ferma' }, now);
    mostraToast('Lista finita: sessione chiusa');
    return;
  }
  imposta(corrente.stato === 'lavoro'
    ? { stato: 'lavoro', taskId: prossimo, inizio: now, controllo: now }
    : { stato: 'pausa', taskId: prossimo, controllo: corrente.controllo }, now);
  segnaInCorso(prossimo, now);
}

/** Id dell'elenco di Oggi prima di un'azione che lo cambia (per `dopoCompletamento`). */
export const elencoIdPrima = idElenco;

/** Se il task della sessione non è più aperto (archiviato, eliminato, completato altrove) passa al successivo o chiude la sessione. */
function allinea() {
  if (corrente.stato === 'ferma') return;
  const item = corrente.taskId ? getItem(corrente.taskId) : undefined;
  if (item && isOpen(item) && item.stato !== 'parcheggiato') return;
  const prossimo = prossimoTask(idElenco(), corrente.taskId);
  const now = Date.now();
  if (!prossimo) { imposta({ stato: 'ferma' }, now); return; }
  imposta(corrente.stato === 'lavoro'
    ? { stato: 'lavoro', taskId: prossimo, inizio: now, controllo: now }
    : { stato: 'pausa', taskId: prossimo, controllo: corrente.controllo }, now);
  segnaInCorso(prossimo, now);
}

/** Tiene la sessione coerente con i dati: se il task su cui si lavora sparisce dalla lista, passa al successivo. */
export function avviaSessione() {
  subscribe(allinea);
  allinea();
}

/** La sessione da inviare al server (niente se non si è mai usata). */
export function impostazioniSessioneDaInviare(): ImpostazioniSync | undefined {
  return corrente.aggiornato > 0 ? { [CHIAVE_SYNC]: { valore: corrente, aggiornato: corrente.aggiornato } } : undefined;
}

/** Applica la sessione arrivata dal server, se è più recente di quella locale. Restituisce true se è cambiata. */
export function applicaSessioneDaServer(imp: ImpostazioniSync | undefined): boolean {
  const r = imp?.[CHIAVE_SYNC];
  if (!r || typeof r.aggiornato !== 'number' || r.aggiornato <= corrente.aggiornato) return false;
  const s = sessioneValida(r.valore);
  if (!s) return false;
  corrente = { ...s, aggiornato: r.aggiornato };
  salva(corrente);
  listeners.forEach((l) => l());
  return true;
}
