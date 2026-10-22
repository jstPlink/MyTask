// Widget «Oggi» della schermata Home di Android. L'app scrive nel plugin nativo `Widget` la lista di oggi, la sessione
// «Inizia» e l'archivio per la ricerca; il widget accoda le azioni fatte dall'utente (note veloci per l'Inbox, voci
// spuntate, avvio/pausa/ripresa/fine della sessione, tocco che chiede la pagina Priorità) e l'app le applica, con l'orario in cui sono state fatte, appena si apre
// o torna in primo piano. Nel browser non fa nulla.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { today } from '../../../shared/dates.ts';
import { isOpen } from '../../../shared/priority.ts';
import { archivioWidget, lavoroWidget, righeWidget } from '../../../shared/widget.ts';
import { completaVoce, nuovaVoce } from './actions.ts';
import { finisciSessione, getSessione, iniziaLavoro, mettiInPausa, passaA, riprendi, subscribeSessione } from './sessione.ts';
import { getItem, getItems, saveItem, subscribe } from './store.ts';
import { debounce } from './util.ts';

/** Azione accodata dal widget mentre l'app era chiusa. `ts` è il momento in cui è stata fatta. */
type AzioneWidget =
  | { tipo: 'nota'; testo: string; ts: number }
  | { tipo: 'fatto'; id: string; ts: number }
  | { tipo: 'avvia'; id: string; ts: number }
  | { tipo: 'pausa' | 'riprendi' | 'fine'; ts: number }
  | { tipo: 'priorita'; ts: number };
const Widget = registerPlugin<{ aggiorna(o: { righe: string; archivio?: string; lavoro?: string }): Promise<void>; coda(): Promise<{ azioni: AzioneWidget[] }> }>('Widget');

/** Un tocco sul widget chiede la pagina Priorità: il flag serve se l'app non ha ancora montato l'interfaccia, l'evento se è già aperta. */
let richiestaPriorita = false;
export const EVENTO_PRIORITA = 'mytask:priorita';
/** True (una sola volta) se il widget ha chiesto la pagina Priorità e l'interfaccia non l'ha ancora aperta. */
export function consumaRichiestaPriorita(): boolean { const r = richiestaPriorita; richiestaPriorita = false; return r; }

/** Applica, nell'ordine e con il loro orario, le note scritte, le voci spuntate e i comandi della sessione fatti dal widget. */
async function applicaAzioni() {
  let azioni: AzioneWidget[] = [];
  try { azioni = (await Widget.coda()).azioni ?? []; } catch { return; }
  for (const a of azioni) {
    if (a.tipo === 'nota' && a.testo.trim()) {
      saveItem({ ...nuovaVoce({ tipo: 'nota', titolo: a.testo.trim(), inbox: true }), creato: a.ts, aggiornato: a.ts });
    } else if (a.tipo === 'fatto') {
      const item = getItem(a.id);
      if (item && isOpen(item)) completaVoce(item, a.ts);
    } else if (a.tipo === 'avvia') {
      if (getSessione().stato === 'ferma') iniziaLavoro(a.id, a.ts); else passaA(a.id, a.ts);
    } else if (a.tipo === 'pausa') {
      mettiInPausa(a.ts);
    } else if (a.tipo === 'riprendi') {
      riprendi(a.ts);
    } else if (a.tipo === 'fine') {
      finisciSessione(a.ts);
    } else if (a.tipo === 'priorita') {
      richiestaPriorita = true;
      window.dispatchEvent(new Event(EVENTO_PRIORITA));
    }
  }
}

/** Manda al widget le righe di oggi, la sessione di lavoro e l'archivio (per la ricerca nel widget). */
async function spingiLista() {
  try {
    const items = getItems();
    const lavoro = lavoroWidget(items, getSessione());
    await Widget.aggiorna({ righe: JSON.stringify(righeWidget(items, today())), archivio: JSON.stringify(archivioWidget(items)), lavoro: lavoro ? JSON.stringify(lavoro) : '' });
  } catch (e) {
    console.warn('Widget: aggiornamento non riuscito', e);
  }
}

/** Avvia lo scambio con il widget (solo app Android): aggiorna dopo ogni modifica (1,5 s), ogni 5 minuti e al ritorno nell'app. */
export function avviaWidget() {
  if (!Capacitor.isNativePlatform()) return;
  const spingi = debounce(() => { void spingiLista(); }, 1500);
  const ciclo = async () => { await applicaAzioni(); spingi(); };
  subscribe(spingi);
  subscribeSessione(spingi);
  void CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void ciclo(); });
  setInterval(spingi, 5 * 60_000);
  void ciclo();
}
