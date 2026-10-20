// Funzioni che esistono solo nell'app Android (Capacitor): notifiche locali pianificate dal sistema operativo,
// anche ad app chiusa. Nel browser si usano invece i promemoria di reminders.ts.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Item } from '../../../shared/types.ts';
import { pianificaNotifiche } from '../../../shared/pianifica.ts';
import { debounce } from './util.ts';
import { getItems, subscribe } from './store.ts';
import { getSessione, scadenzaControllo, subscribeSessione, tempoDi } from './sessione.ts';
import { formatoCronometro, istantiPromemoriaTimer } from '../../../shared/sessione.ts';
import { getPromemoriaTimer, subscribePromemoriaTimer } from './promemoriaTimer.ts';

/** Identificativo della notifica «Stai ancora lavorando?» (la sessione ne ha una sola alla volta). */
const ID_CONTROLLO_SESSIONE = 990001;

/** Primo identificativo delle notifiche periodiche del timer (uno per istante pianificato). */
const ID_TIMER = 995000;
/** Canale delle notifiche del timer: importanza alta, quindi con suono. */
const CANALE_TIMER = 'timer';

/** True dentro l'app Android (Capacitor), false nel browser. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

type PermessoNotifiche = 'granted' | 'denied' | 'default' | 'non_supportate';

/** Stato del permesso di mostrare notifiche. */
async function permessoNotificheNative(): Promise<PermessoNotifiche> {
  try {
    const p = await LocalNotifications.checkPermissions();
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default';
  } catch {
    return 'non_supportate';
  }
}

/** Chiede il permesso (su Android 13+ compare la richiesta a video); se concesso, pianifica subito le notifiche. */
async function chiediPermessoNotificheNative(): Promise<PermessoNotifiche> {
  try {
    const p = await LocalNotifications.requestPermissions();
    const stato: PermessoNotifiche = p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default';
    if (stato === 'granted') void aggiornaNotificheNative(getItems());
    return stato;
  } catch {
    return 'non_supportate';
  }
}

/**
 * Riprogramma tutte le notifiche del sistema in base ai dati correnti: cancella quelle in attesa e ne pianifica di nuove
 * (promemoria delle voci e, se si sta lavorando, il controllo
 * «Stai ancora lavorando?» dopo 45 minuti senza conferme e la notifica periodica del timer). I calcoli sono in shared/pianifica.ts e shared/sessione.ts.
 */
async function aggiornaNotificheNative(items: Item[]): Promise<void> {
  if ((await permessoNotificheNative()) !== 'granted') return;
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    const lista = pianificaNotifiche(items, new Date());
    const scadenza = scadenzaControllo();
    const titolo = getItems().find((i) => i.id === getSessione().taskId)?.titolo;
    const controllo = scadenza && scadenza > Date.now()
      ? [{ id: ID_CONTROLLO_SESSIONE, title: 'Stai ancora lavorando?', body: titolo ? `«${titolo}»: apri MyTask per confermare` : 'Apri MyTask per confermare', schedule: { at: new Date(scadenza), allowWhileIdle: true }, smallIcon: 'ic_stat_mytask' }]
      : [];
    // notifiche periodiche del timer: mentre una nota è in corso e il cronometro scorre, una ogni N minuti, con suono
    const imp = getPromemoriaTimer();
    const sessione = getSessione();
    const voce = getItems().find((i) => i.id === sessione.taskId);
    const periodiche = !imp.attivo || !voce ? [] : istantiPromemoriaTimer(sessione, imp.ogniMinuti, Date.now()).map((t, k) => ({
      id: ID_TIMER + k,
      title: 'Il timer sta scorrendo',
      body: `«${voce.titolo}» · ${formatoCronometro(tempoDi(voce, t))}`,
      schedule: { at: new Date(t), allowWhileIdle: true },
      smallIcon: 'ic_stat_mytask',
      channelId: CANALE_TIMER,
    }));
    if (lista.length || controllo.length || periodiche.length) {
      await LocalNotifications.schedule({
        notifications: [
          ...controllo,
          ...periodiche,
          ...lista.map((n) => ({
            id: n.id,
            title: n.titolo,
            body: n.corpo,
            schedule: { at: new Date(n.quando), allowWhileIdle: true },
            smallIcon: 'ic_stat_mytask',
          })),
        ],
      });
    }
  } catch (e) {
    console.warn('Notifiche: pianificazione non riuscita', e);
  }
}

/**
 * Avvia l'aggiornamento automatico delle notifiche: all'avvio, a ogni modifica dei dati o della sessione di lavoro (con attesa
 * di 2 secondi per raggruppare le modifiche) e al ritorno nell'app.
 */
export function avviaNotificheNative() {
  const aggiorna = debounce(() => { void aggiornaNotificheNative(getItems()); }, 2000);
  subscribe(aggiorna);
  subscribeSessione(aggiorna);
  subscribePromemoriaTimer(aggiorna);
  void LocalNotifications.createChannel({ id: CANALE_TIMER, name: 'Timer in corso', description: 'Un avviso sonoro ogni tanto mentre il timer scorre', importance: 4, visibility: 1, vibration: true }).catch(() => undefined);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') aggiorna(); });
  // la prima volta chiede il permesso (una sola volta: poi resta la scelta dell'utente)
  void (async () => {
    let chiesto = false;
    try { chiesto = localStorage.getItem('mytask.notifiche.chiesto') === '1'; } catch { /* ignora */ }
    if (!chiesto && (await permessoNotificheNative()) === 'default') {
      try { localStorage.setItem('mytask.notifiche.chiesto', '1'); } catch { /* ignora */ }
      await chiediPermessoNotificheNative();
    }
    aggiorna();
  })();
}
