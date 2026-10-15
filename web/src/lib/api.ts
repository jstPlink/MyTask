import type { Proposta } from '../../../shared/capture.ts';
import { getAuth } from './store.ts';

/** Indirizzo del server. Vuoto = stesso sito (web). Per l'APK si può impostare un indirizzo assoluto. */
export function apiBase(): string {
  try { return (localStorage.getItem('mytask.server') ?? '').replace(/\/$/, ''); } catch { return ''; }
}

export class ErroreApi extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function login(email: string, password: string): Promise<{ token: string; email: string }> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ErroreApi(0, 'Nessuna connessione al server');
  }
  if (res.status === 429) throw new ErroreApi(429, 'Troppi tentativi, riprova tra qualche minuto');
  if (res.status === 401) throw new ErroreApi(401, 'Email o password errate');
  if (!res.ok) throw new ErroreApi(res.status, `Errore del server (${res.status})`);
  return res.json();
}

export async function logout(): Promise<void> {
  const { token } = getAuth();
  if (!token) return;
  try { await fetch(`${apiBase()}/api/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }); } catch { /* offline: la sessione scade da sola */ }
}

/** Interpretazione con IA. Restituisce undefined se non disponibile (offline, senza chiave, errore). */
export async function interpretaIA(text: string): Promise<Proposta | undefined> {
  const { token } = getAuth();
  if (!token || !navigator.onLine) return undefined;
  try {
    const res = await fetch(`${apiBase()}/api/ai/capture`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return undefined;
    return ((await res.json()) as { proposta: Proposta }).proposta;
  } catch {
    return undefined;
  }
}

export async function scaricaEsportazione(): Promise<void> {
  const { token } = getAuth();
  const res = await fetch(`${apiBase()}/api/export`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ErroreApi(res.status, 'Esportazione non riuscita');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mytask-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
