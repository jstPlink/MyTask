import { useState, type FormEvent } from 'react';
import { ErroreApi, apiBase, impostaServer, login } from '../lib/api.ts';
import { isNative } from '../lib/native.ts';
import { getAuth, setAuth } from '../lib/store.ts';
import { sync } from '../lib/sync.ts';

export function Login() {
  const [email, setEmail] = useState(getAuth().email ?? '');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(apiBase());
  const nativa = isNative();
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);

  async function entra(e: FormEvent) {
    e.preventDefault();
    setErrore('');
    setInvio(true);
    try {
      if (nativa) {
        if (!/^(https?:\/\/)?[^\s/]+\.[^\s/]+/i.test(server.trim())) throw new ErroreApi(0, "Scrivi l'indirizzo del server, per esempio mytask.tuodominio.it");
        impostaServer(server);
      }
      const r = await login(email.trim(), password);
      await setAuth({ token: r.token, email: r.email });
      void sync();
    } catch (err) {
      setErrore(err instanceof ErroreApi ? err.message : 'Accesso non riuscito');
    } finally {
      setInvio(false);
    }
  }

  return (
    <form className="login" onSubmit={entra}>
      <h1>MyTask</h1>
      <div className="t2" style={{ marginBottom: 8 }}>Accedi per sincronizzare le tue cose da fare.</div>
      {nativa && <input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="Indirizzo del server" value={server} onChange={(e) => setServer(e.target.value)} required aria-label="Indirizzo del server" />}
      <input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
      <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required aria-label="Password" />
      {errore && <div className="warn" role="alert">{errore}</div>}
      <button className="btn solid" style={{ padding: 14 }} disabled={invio}>{invio ? 'Accesso…' : 'Accedi'}</button>
    </form>
  );
}
