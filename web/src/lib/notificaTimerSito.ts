// Notifica periodica del timer per il sito e l'app per computer (API Notification): mentre una nota è in corso e il cronometro scorre,
// una notifica ogni N minuti dall'inizio del tratto in corso, con la stessa impostazione del telefono (promemoriaTimer.ts).
// Funziona finché la pagina (o la finestra dell'app) è aperta; sul telefono ci pensa il sistema (native.ts).
import { formatoCronometro } from '../../../shared/sessione.ts';
import { getItems } from './store.ts';
import { getSessione, tempoDi } from './sessione.ts';
import { getPromemoriaTimer } from './promemoriaTimer.ts';

export type PermessoSito = NotificationPermission | 'non_supportate';

export const permessoSito = (): PermessoSito => (typeof Notification === 'undefined' ? 'non_supportate' : Notification.permission);

/** Chiede il permesso delle notifiche al browser (serve un tocco dell'utente); restituisce l'esito. */
export async function chiediPermessoSito(): Promise<PermessoSito> {
  if (typeof Notification === 'undefined') return 'non_supportate';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

function mostra(titolo: string, corpo: string) {
  try {
    const n = new Notification(titolo, { body: corpo, tag: 'mytask-timer', icon: '/icon.svg' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {
    // alcuni browser per telefono ammettono solo le notifiche del service worker
    void navigator.serviceWorker?.getRegistration().then((reg) => reg?.showNotification(titolo, { body: corpo, tag: 'mytask-timer', icon: '/icon.svg' }));
  }
}

/** Avvia il controllo: ogni 5 secondi guarda se è scattato un nuovo intervallo del tratto in corso (se la pagina era sospesa ne manda una sola). */
export function avviaNotificaTimerSito() {
  let ultimo = { inizio: 0, k: 0 };
  setInterval(() => {
    const s = getSessione();
    const imp = getPromemoriaTimer();
    if (s.stato !== 'lavoro' || !s.inizio || !imp.attivo || permessoSito() !== 'granted') return;
    const passo = imp.ogniMinuti * 60_000;
    const adesso = Date.now();
    const k = Math.floor((adesso - s.inizio) / passo);
    if (ultimo.inizio !== s.inizio) ultimo = { inizio: s.inizio, k: Math.max(k, 0) }; // nuovo tratto: parte da qui, senza arretrati
    if (k < 1 || k <= ultimo.k) return;
    ultimo.k = k;
    const voce = getItems().find((i) => i.id === s.taskId);
    if (!voce) return;
    mostra('Il timer sta scorrendo', `«${voce.titolo}» · ${formatoCronometro(tempoDi(voce, adesso))}`);
  }, 5000);
}
