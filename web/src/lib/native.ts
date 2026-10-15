import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Item } from '../../../shared/types.ts';
import { pianificaNotifiche } from '../../../shared/pianifica.ts';
import { debounce } from './util.ts';
import { getItems, subscribe } from './store.ts';

/** True dentro l'app Android (Capacitor), false nel browser. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

export type PermessoNotifiche = 'granted' | 'denied' | 'default' | 'non_supportate';

export async function permessoNotificheNative(): Promise<PermessoNotifiche> {
  try {
    const p = await LocalNotifications.checkPermissions();
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default';
  } catch {
    return 'non_supportate';
  }
}

export async function chiediPermessoNotificheNative(): Promise<PermessoNotifiche> {
  try {
    const p = await LocalNotifications.requestPermissions();
    const stato: PermessoNotifiche = p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default';
    if (stato === 'granted') void aggiornaNotificheNative(getItems());
    return stato;
  } catch {
    return 'non_supportate';
  }
}

/** Riprogramma tutte le notifiche del sistema in base ai dati correnti. */
export async function aggiornaNotificheNative(items: Item[]): Promise<void> {
  if ((await permessoNotificheNative()) !== 'granted') return;
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    const lista = pianificaNotifiche(items, new Date());
    if (lista.length) {
      await LocalNotifications.schedule({
        notifications: lista.map((n) => ({
          id: n.id,
          title: n.titolo,
          body: n.corpo,
          schedule: { at: new Date(n.quando), allowWhileIdle: true },
          smallIcon: 'ic_stat_mytask',
        })),
      });
    }
  } catch (e) {
    console.warn('Notifiche: pianificazione non riuscita', e);
  }
}

/** Avvia l'aggiornamento automatico delle notifiche: all'avvio, a ogni modifica dei dati, al ritorno nell'app. */
export function avviaNotificheNative() {
  const aggiorna = debounce(() => { void aggiornaNotificheNative(getItems()); }, 2000);
  subscribe(aggiorna);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') aggiorna(); });
  // la prima volta chiede il permesso (Android 13 e successivi lo richiede a voce)
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
