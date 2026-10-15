import type { SyncResponse } from '../../../shared/types.ts';
import { applyRemote, getAuth, getSince, markSent, pendingCount, setAuth, setOnLocalChange, setSince, takeDirty } from './store.ts';
import { apiBase } from './api.ts';
import { debounce } from './util.ts';

export interface StatoSync { online: boolean; inCorso: boolean; errore?: string; ultima?: number; inAttesa: number }

let stato: StatoSync = { online: navigator.onLine, inCorso: false, inAttesa: 0 };
const listeners = new Set<() => void>();
const set = (p: Partial<StatoSync>) => { stato = { ...stato, ...p }; listeners.forEach((l) => l()); };

export const getStatoSync = () => stato;
export const subscribeSync = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

let inVolo = false;
let richiestaPendente = false;

/** Invia le modifiche locali e riceve quelle degli altri dispositivi. Non fa nulla senza rete o senza accesso. */
export async function sync(): Promise<void> {
  const { token } = getAuth();
  if (!token || !navigator.onLine) { set({ online: navigator.onLine, inAttesa: pendingCount() }); return; }
  if (inVolo) { richiestaPendente = true; return; }
  inVolo = true;
  set({ inCorso: true, errore: undefined });
  try {
    const changes = takeDirty();
    const res = await fetch(`${apiBase()}/api/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ since: getSince(), changes }),
    });
    if (res.status === 401) {
      await setAuth({ email: getAuth().email }); // la sessione è scaduta: serve rifare l'accesso, i dati restano
      set({ errore: 'Sessione scaduta' });
      return;
    }
    if (!res.ok) throw new Error(`Il server ha risposto ${res.status}`);
    const data = (await res.json()) as SyncResponse;
    await markSent(changes);
    await applyRemote(data.items);
    await setSince(data.seq);
    set({ ultima: Date.now(), online: true });
  } catch (e) {
    set({ errore: e instanceof Error ? e.message : 'Sincronizzazione non riuscita' });
  } finally {
    inVolo = false;
    set({ inCorso: false, inAttesa: pendingCount() });
    if (richiestaPendente) { richiestaPendente = false; void sync(); }
  }
}

const sincronizzaPoi = debounce(() => { void sync(); }, 1200);

export function avviaSync() {
  setOnLocalChange(() => { set({ inAttesa: pendingCount() }); sincronizzaPoi(); });
  window.addEventListener('online', () => { set({ online: true }); void sync(); });
  window.addEventListener('offline', () => set({ online: false }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sync(); });
  setInterval(() => { if (document.visibilityState === 'visible') void sync(); }, 60_000);
  void sync();
}
