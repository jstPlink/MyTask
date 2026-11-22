// Chiamate HTTP al server che non passano dalla sincronizzazione: accesso, uscita ed esportazione dei dati.
// Il token di sessione sta nell'archivio locale (store.ts).
import { getAuth } from './store.ts';

/**
 * Indirizzo del server. Sul sito è vuoto (le chiamate vanno allo stesso indirizzo da cui è servita la pagina);
 * nell'app Android, che gira da https://localhost dentro l'APK, è l'indirizzo assoluto impostato all'accesso.
 */
export function apiBase(): string {
  try { return (localStorage.getItem('mytask.server') ?? '').replace(/\/$/, ''); } catch { return ''; }
}

/** Salva l'indirizzo del server (usato dall'app Android). Restituisce quello normalizzato. */
export function impostaServer(url: string): string {
  let u = url.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  try { localStorage.setItem('mytask.server', u); } catch { /* ignora */ }
  return u;
}

/** Errore di una chiamata al server; `status` 0 = nessuna connessione. */
export class ErroreApi extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Accesso con email e password; restituisce il token di sessione. Gli errori hanno messaggi già pronti da mostrare. */
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

/** Chiude la sessione sul server (se offline non fa nulla: la sessione scade da sola). */
export async function logout(): Promise<void> {
  const { token } = getAuth();
  if (!token) return;
  try { await fetch(`${apiBase()}/api/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }); } catch { /* offline: la sessione scade da sola */ }
}

/** Codice dell'orologio (token dedicato, vedi server/src/orologio.ts): se esiste, lo crea nuovo (sostituisce il precedente) o lo revoca. */
async function chiamaOrologio<T>(percorso: string, metodo: 'GET' | 'POST'): Promise<T> {
  const { token } = getAuth();
  let res: Response;
  try { res = await fetch(`${apiBase()}/api/orologio/${percorso}`, { method: metodo, headers: { authorization: `Bearer ${token ?? ''}` } }); } catch { throw new ErroreApi(0, 'Nessuna connessione al server'); }
  if (!res.ok) throw new ErroreApi(res.status, res.status === 404 ? 'Il server non è ancora aggiornato' : `Errore del server (${res.status})`);
  return res.json() as Promise<T>;
}
export const codiceOrologioAttivo = async () => (await chiamaOrologio<{ attivo: boolean }>('token', 'GET')).attivo;
export const creaCodiceOrologio = async () => (await chiamaOrologio<{ token: string }>('token', 'POST')).token;
export const revocaCodiceOrologio = async () => { await chiamaOrologio<{ ok: boolean }>('revoca', 'POST'); };

