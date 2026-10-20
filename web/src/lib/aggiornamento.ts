// Aggiornamento del sito/app per computer: confronta la versione del server (/api/health) con quella caricata e,
// se il server è più nuovo, avvisa con un messaggio e un pulsante «Aggiorna» che svuota la cache e ricarica con un clic.
// (Nell'app Android i file stanno nell'APK, quindi qui non si fa nulla.)
import { apiBase } from './api.ts';
import { isNative } from './native.ts';
import { mostraToast } from './toast.ts';
import { VERSIONE } from '../version.ts';

const OGNI_MS = 10 * 60_000;
let avvisata = '';

/** Versione pubblicata dal server, o undefined se offline o se il server è vecchio. */
export async function versioneServer(): Promise<string | undefined> {
  try {
    const r = await fetch(`${apiBase()}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return r.ok ? ((await r.json()) as { versione?: string }).versione : undefined;
  } catch { return undefined; }
}

/** Toglie il service worker e la cache e ricarica: la pagina riparte con i file nuovi (i dati locali restano). */
export async function aggiornaApp() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { /* si ricarica comunque */ }
  location.reload();
}

async function controlla() {
  const v = await versioneServer();
  if (!v || v === VERSIONE || v === avvisata) return;
  avvisata = v;
  mostraToast(`Nuova versione ${v} disponibile`, { label: 'Aggiorna', fn: () => { void aggiornaApp(); } }, 60_000);
}

/** Controlla all'avvio, ogni 10 minuti e quando si torna sulla finestra. */
export function avviaAggiornamento() {
  if (isNative()) return;
  window.setTimeout(() => { void controlla(); }, 4000);
  window.setInterval(() => { void controlla(); }, OGNI_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void controlla(); });
}
