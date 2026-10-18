// Widget «Oggi» della schermata Home di Android. L'app scrive la lista di oggi e l'archivio per la ricerca nel plugin
// nativo `Widget`; il widget accoda le azioni fatte dall'utente (note veloci per l'Inbox e voci spuntate) e l'app le
// applica appena si apre o torna in primo piano. Nel browser non fa nulla.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { today } from '../../../shared/dates.ts';
import { completa } from '../../../shared/recurrence.ts';
import { isOpen } from '../../../shared/priority.ts';
import { margineAtteso } from '../../../shared/stima.ts';
import { archivioWidget, righeWidget } from '../../../shared/widget.ts';
import { getDisponibilita, subscribeDisponibilita } from './disponibilita.ts';
import { nuovaVoce } from './actions.ts';
import { getItem, getItems, saveItem, subscribe } from './store.ts';
import { debounce } from './util.ts';

/** Azione accodata dal widget mentre l'app era chiusa. `ts` è il momento in cui è stata fatta. */
type AzioneWidget = { tipo: 'nota'; testo: string; ts: number } | { tipo: 'fatto'; id: string; ts: number };
const Widget = registerPlugin<{ aggiorna(o: { righe: string; archivio?: string }): Promise<void>; coda(): Promise<{ azioni: AzioneWidget[] }> }>('Widget');

/** Applica le note scritte e le voci spuntate dal widget. */
async function applicaAzioni() {
  let azioni: AzioneWidget[] = [];
  try { azioni = (await Widget.coda()).azioni ?? []; } catch { return; }
  for (const a of azioni) {
    if (a.tipo === 'nota' && a.testo.trim()) {
      saveItem({ ...nuovaVoce({ tipo: 'nota', titolo: a.testo.trim(), inbox: true }), creato: a.ts, aggiornato: a.ts });
    } else if (a.tipo === 'fatto') {
      const item = getItem(a.id);
      if (item && isOpen(item)) saveItem(completa(item, today(), a.ts));
    }
  }
}

/** Manda al widget le righe di oggi e l'archivio (per la ricerca nel widget). */
async function spingiLista() {
  try {
    const righe = righeWidget(getItems(), getDisponibilita(), today(), Date.now(), margineAtteso(getItems()));
    await Widget.aggiorna({ righe: JSON.stringify(righe), archivio: JSON.stringify(archivioWidget(getItems())) });
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
  subscribeDisponibilita(spingi);
  void CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void ciclo(); });
  setInterval(spingi, 5 * 60_000);
  void ciclo();
}
