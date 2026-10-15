// Archivio locale (IndexedDB) con copia in memoria. È la fonte di verità per l'interfaccia:
// l'app funziona senza rete e invia le modifiche al server appena possibile (vedi sync.ts).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Item } from '../../../shared/types.ts';

interface Schema extends DBSchema {
  items: { key: string; value: Item };
  dirty: { key: string; value: { id: string } };
  meta: { key: string; value: unknown };
}

export interface Auth { token?: string; email?: string }

let db: IDBPDatabase<Schema> | undefined;
const map = new Map<string, Item>();
const dirty = new Set<string>();
let snapshot: Item[] = [];
let auth: Auth = {};
let since = 0;
const listeners = new Set<() => void>();
const authListeners = new Set<() => void>();
let onLocalChange: (() => void) | undefined;

function rebuild() {
  snapshot = Array.from(map.values());
  listeners.forEach((l) => l());
}

export async function initStore(): Promise<void> {
  db = await openDB<Schema>('mytask', 1, {
    upgrade(d) {
      d.createObjectStore('items', { keyPath: 'id' });
      d.createObjectStore('dirty', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  for (const i of await db.getAll('items')) map.set(i.id, i);
  for (const d of await db.getAll('dirty')) dirty.add(d.id);
  auth = ((await db.get('meta', 'auth')) as Auth | undefined) ?? {};
  since = ((await db.get('meta', 'since')) as number | undefined) ?? 0;
  rebuild();
}

export const getItems = () => snapshot;
export const getItem = (id: string) => map.get(id);
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const subscribeAuth = (fn: () => void) => { authListeners.add(fn); return () => { authListeners.delete(fn); }; };
export const setOnLocalChange = (fn: () => void) => { onLocalChange = fn; };

export const getAuth = () => auth;
export async function setAuth(a: Auth) {
  auth = a;
  await db?.put('meta', a, 'auth');
  authListeners.forEach((l) => l());
}

export const getSince = () => since;
export async function setSince(n: number) { since = n; await db?.put('meta', n, 'since'); }

export const pendingCount = () => dirty.size;

/** Salva una voce nuova o modificata. Aggiorna il timestamp e la mette in coda per il server. */
export function saveItem(item: Item): Item {
  const prev = map.get(item.id);
  const saved: Item = { ...item, aggiornato: Math.max(Date.now(), (prev?.aggiornato ?? 0) + 1) };
  map.set(saved.id, saved);
  dirty.add(saved.id);
  void db?.put('items', saved);
  void db?.put('dirty', { id: saved.id });
  rebuild();
  onLocalChange?.();
  return saved;
}

export function saveMany(items: Item[]) { items.forEach(saveItem); }

/** Salva molte voci in un colpo solo (importazione): un solo aggiornamento dell'interfaccia. */
export async function saveBatch(items: Item[]): Promise<void> {
  const now = Date.now();
  const tx = db?.transaction(['items', 'dirty'], 'readwrite');
  items.forEach((item, n) => {
    const prev = map.get(item.id);
    const saved: Item = { ...item, aggiornato: Math.max(now + n, (prev?.aggiornato ?? 0) + 1) };
    map.set(saved.id, saved);
    dirty.add(saved.id);
    void tx?.objectStore('items').put(saved);
    void tx?.objectStore('dirty').put({ id: saved.id });
  });
  await tx?.done;
  rebuild();
  onLocalChange?.();
}

/** Cancellazione logica: la voce resta come "eliminata" così la cancellazione arriva anche agli altri dispositivi. */
export function removeItem(id: string) {
  const i = map.get(id);
  if (i) saveItem({ ...i, eliminato: true });
}

/** Voci da inviare al server. */
export function takeDirty(): Item[] {
  return [...dirty].map((id) => map.get(id)).filter((i): i is Item => !!i);
}

/** Segna come inviate le voci che il server ha accettato (se non sono cambiate nel frattempo). */
export async function markSent(sent: Item[]) {
  for (const s of sent) {
    const cur = map.get(s.id);
    if (cur && cur.aggiornato === s.aggiornato) {
      dirty.delete(s.id);
      await db?.delete('dirty', s.id);
    }
  }
}

/** Applica le voci arrivate dal server, senza sovrascrivere modifiche locali più recenti non ancora inviate. */
export async function applyRemote(remote: Item[]) {
  const tx = db?.transaction('items', 'readwrite');
  for (const r of remote) {
    const local = map.get(r.id);
    if (local && local.aggiornato >= r.aggiornato) continue;
    map.set(r.id, r);
    await tx?.store.put(r);
  }
  await tx?.done;
  rebuild();
}

export async function clearAll() {
  map.clear(); dirty.clear(); since = 0;
  await db?.clear('items'); await db?.clear('dirty'); await db?.delete('meta', 'since');
  rebuild();
}
