// Funzioni che esistono solo nell'app Android (Capacitor): notifiche locali pianificate dal sistema operativo,
// anche ad app chiusa. Nel browser si usano invece i promemoria di reminders.ts.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Item } from '../../../shared/types.ts';
import { pianificaNotifiche, richiesteOrari } from '../../../shared/pianifica.ts';
import { debounce } from './util.ts';
import { getItems, subscribe } from './store.ts';
import { getDisponibilita, subscribeDisponibilita } from './disponibilita.ts';
import { richiediOrari } from './richiestaOrari.ts';

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
 * (promemoria delle voci e, in modalità flessibile, la richiesta serale degli orari liberi). I calcoli sono in shared/pianifica.ts.
 */
async function aggiornaNotificheNative(items: Item[]): Promise<void> {
  if ((await permessoNotificheNative()) !== 'granted') return;
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    const lista = pianificaNotifiche(items, new Date());
    const richieste = richiesteOrari(getDisponibilita(), new Date());
    if (lista.length || richieste.length) {
      await LocalNotifications.schedule({
        notifications: [
          ...lista.map((n) => ({
            id: n.id,
            title: n.titolo,
            body: n.corpo,
            schedule: { at: new Date(n.quando), allowWhileIdle: true },
            smallIcon: 'ic_stat_mytask',
          })),
          // modalità flessibile: la sera chiede gli orari liberi del giorno dopo (toccandola si apre la schermata per inserirli)
          ...richieste.map((n) => ({
            id: n.id,
            title: n.titolo,
            body: n.corpo,
            schedule: { at: new Date(n.quando), allowWhileIdle: true },
            smallIcon: 'ic_stat_mytask',
            extra: { azione: 'orari', giorno: n.giorno },
          })),
        ],
      });
    }
  } catch (e) {
    console.warn('Notifiche: pianificazione non riuscita', e);
  }
}

/**
 * Avvia l'aggiornamento automatico delle notifiche: all'avvio, a ogni modifica dei dati o del tempo libero (con attesa
 * di 2 secondi per raggruppare le modifiche) e al ritorno nell'app. Toccando la notifica serale si apre «Quando sei libero?».
 */
export function avviaNotificheNative() {
  const aggiorna = debounce(() => { void aggiornaNotificheNative(getItems()); }, 2000);
  subscribe(aggiorna);
  subscribeDisponibilita(aggiorna);
  void LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const extra = a.notification.extra as { azione?: string; giorno?: string } | undefined;
    if (extra?.azione === 'orari' && extra.giorno) richiediOrari(extra.giorno);
  });
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
