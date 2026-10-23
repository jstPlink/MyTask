// Schermo sempre acceso mentre una nota è «in corso» a tutto schermo. Si usano due strade insieme, per non dipendere da una sola:
// nell'app Android il plugin nativo `Schermo` (flag della finestra e della WebView), ovunque lo Screen Wake Lock del browser (che
// il browser toglie da solo quando la pagina va in secondo piano: lo si richiede di nuovo al ritorno). Finché è acceso, il
// segnale viene ripetuto ogni 20 secondi, così anche se il sistema lo toglie torna subito.
import { Capacitor, registerPlugin } from '@capacitor/core';

const Schermo = registerPlugin<{ acceso(o: { acceso: boolean }): Promise<void>; immersivo(o: { attivo: boolean }): Promise<void> }>('Schermo');

/** Ogni quanto si ripete la richiesta mentre lo schermo deve restare acceso (millisecondi). */
const RIPETI_MS = 20_000;

interface WakeLockSentinelLike { release(): Promise<void> }
let lock: WakeLockSentinelLike | null = null;
let voluto = false;
let ripeti: ReturnType<typeof setInterval> | undefined;

async function richiediWakeLock() {
  if (!voluto || lock || document.visibilityState !== 'visible') return;
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
    if (wl) {
      lock = await wl.request('screen');
      // il browser lo toglie da solo (pagina in secondo piano): si richiede al ritorno
      (lock as unknown as EventTarget).addEventListener?.('release', () => { lock = null; });
    }
  } catch { lock = null; }
}

function segnala(acceso: boolean) {
  if (Capacitor.isNativePlatform()) void Schermo.acceso({ acceso }).catch(() => {});
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    lock = null;
    if (!voluto) return;
    void richiediWakeLock();
    segnala(true);
  });
}

/** Accende o spegne il «schermo sempre acceso». Non fa errori se la funzione non esiste sul dispositivo. */
export function schermoAcceso(acceso: boolean) {
  voluto = acceso;
  if (ripeti) { clearInterval(ripeti); ripeti = undefined; }
  segnala(acceso);
  if (acceso) {
    void richiediWakeLock();
    ripeti = setInterval(() => { segnala(true); void richiediWakeLock(); }, RIPETI_MS);
  } else if (lock) {
    const l = lock;
    lock = null;
    void l.release().catch(() => {});
  }
}

/** Nasconde (o rimostra) le barre di sistema, notifiche in alto e gesti in basso, a tutto schermo: solo app Android. Scorrendo dal bordo tornano per un attimo. */
export function schermoImmersivo(attivo: boolean) {
  if (Capacitor.isNativePlatform()) void Schermo.immersivo({ attivo }).catch(() => {});
}
