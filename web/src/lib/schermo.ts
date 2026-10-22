// Schermo sempre acceso mentre una nota è «in corso» a tutto schermo. Nell'app Android il plugin nativo `Schermo` tiene
// acceso il flag della finestra (FLAG_KEEP_SCREEN_ON); nel browser e nell'app per computer si usa lo Screen Wake Lock,
// che il browser toglie da solo quando la scheda va in secondo piano (lo si richiede di nuovo al ritorno).
import { Capacitor, registerPlugin } from '@capacitor/core';

const Schermo = registerPlugin<{ acceso(o: { acceso: boolean }): Promise<void> }>('Schermo');

interface WakeLockSentinelLike { release(): Promise<void> }
let lock: WakeLockSentinelLike | null = null;
let voluto = false;

async function richiedi() {
  if (!voluto || lock || document.visibilityState !== 'visible') return;
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
    if (wl) lock = await wl.request('screen');
  } catch { lock = null; }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { lock = null; void richiedi(); });
}

/** Accende o spegne il «schermo sempre acceso». Non fa errori se la funzione non esiste sul dispositivo. */
export function schermoAcceso(acceso: boolean) {
  voluto = acceso;
  if (Capacitor.isNativePlatform()) { void Schermo.acceso({ acceso }).catch(() => {}); return; }
  if (acceso) void richiedi();
  else if (lock) { const l = lock; lock = null; void l.release().catch(() => {}); }
}
