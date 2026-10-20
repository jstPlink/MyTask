// Sincronizzazione con il server: a ogni passata si inviano le voci in coda (store.ts) e le impostazioni (la sessione di lavoro e i pesi della priorità),
// e si riceve ciò che è cambiato dopo `since`. Parte dopo ogni modifica (con attesa di 1,2 s), al ritorno della rete,
// quando l'app torna visibile e ogni minuto. Senza rete o senza accesso non fa nulla: i dati restano in coda.
import type { SyncResponse } from '../../../shared/types.ts';
import { applyRemote, getAuth, getSince, markSent, pendingCount, setAuth, setOnLocalChange, setSince, takeDirty } from './store.ts';
import { apiBase } from './api.ts';
import { applicaSessioneDaServer, impostazioniSessioneDaInviare, subscribeSessione } from './sessione.ts';
import { applicaPesiDaServer, impostazioniPesiDaInviare, subscribePesi } from './pesi.ts';
import { debounce } from './util.ts';

/** Stato mostrato nell'interfaccia (rete, sincronizzazione in corso, ultimo errore, voci in attesa). */
interface StatoSync { online: boolean; inCorso: boolean; errore?: string; ultima?: number; inAttesa: number }

let stato: StatoSync = { online: navigator.onLine, inCorso: false, inAttesa: 0 };
const listeners = new Set<() => void>();
const set = (p: Partial<StatoSync>) => { stato = { ...stato, ...p }; listeners.forEach((l) => l()); };

export const getStatoSync = () => stato;
export const subscribeSync = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** True mentre una richiesta è in corso. */
let inVolo = false;
/** Una sincronizzazione chiesta durante un'altra: ripartirà appena questa finisce. */
let richiestaPendente = false;
/** True mentre si applicano le impostazioni arrivate dal server: non deve far partire un nuovo invio. */
let applicando = false;

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
      body: JSON.stringify({ since: getSince(), changes, impostazioni: { ...impostazioniSessioneDaInviare(), ...impostazioniPesiDaInviare() } }),
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
    applicando = true;
    try { applicaSessioneDaServer(data.impostazioni); applicaPesiDaServer(data.impostazioni); } finally { applicando = false; }
    set({ ultima: Date.now(), online: true });
  } catch (e) {
    set({ errore: e instanceof Error ? e.message : 'Sincronizzazione non riuscita' });
  } finally {
    inVolo = false;
    set({ inCorso: false, inAttesa: pendingCount() });
    if (richiestaPendente) { richiestaPendente = false; void sync(); }
  }
}

/** Sincronizza dopo 1,2 s dall'ultima richiesta, per raggruppare modifiche ravvicinate. */
const sincronizzaPoi = debounce(() => { void sync(); }, 1200);

/** Collega la sincronizzazione agli eventi (modifiche locali, rete, visibilità, timer) e ne esegue una subito. */
export function avviaSync() {
  setOnLocalChange(() => { set({ inAttesa: pendingCount() }); sincronizzaPoi(); });
  subscribeSessione(() => { if (!applicando) sincronizzaPoi(); });
  subscribePesi(() => { if (!applicando) sincronizzaPoi(); });
  window.addEventListener('online', () => { set({ online: true }); void sync(); });
  window.addEventListener('offline', () => set({ online: false }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sync(); });
  setInterval(() => { if (document.visibilityState === 'visible') void sync(); }, 60_000);
  void sync();
}
