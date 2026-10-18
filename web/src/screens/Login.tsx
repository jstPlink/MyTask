import { useState, type FormEvent } from 'react';
import { ErroreApi, apiBase, impostaServer, login } from '../lib/api.ts';
import { isNative } from '../lib/native.ts';
import { getAuth, setAuth } from '../lib/store.ts';
import { sync } from '../lib/sync.ts';
import { VERSIONE } from '../version.ts';
import { componiIndirizzo, indirizzoValido, separaIndirizzo, type Schema } from '../../../shared/indirizzo.ts';

/**
 * Accesso con email e password. Nell'app Android compare anche l'indirizzo del server (protocollo + indirizzo, https di base);
 * nel sito il server è quello da cui è stato caricato.
 */
export function Login() {
  const [email, setEmail] = useState(getAuth().email ?? '');
  const [password, setPassword] = useState('');
  const iniziale = separaIndirizzo(apiBase());
  // l'indirizzo del server si scrive senza schema: https:// è già lì e si può cambiare in http://
  const [schema, setSchema] = useState<Schema>(iniziale.schema);
  const [server, setServer] = useState(iniziale.resto);
  const nativa = isNative();
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);

  async function entra(e: FormEvent) {
    e.preventDefault();
    setErrore('');
    setInvio(true);
    try {
      if (nativa) {
        if (!indirizzoValido(separaIndirizzo(server, schema).resto)) throw new ErroreApi(0, "Scrivi l'indirizzo del server, per esempio mytask.tuodominio.it");
        impostaServer(componiIndirizzo(schema, server));
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
      <div className="login-brand"><i aria-hidden="true" />MyTask</div>
      <div className="login-sub">Accedi per sincronizzare le tue cose da fare.</div>
      {nativa && (
        <div className="login-server">
          <select value={schema} onChange={(e) => setSchema(e.target.value as Schema)} aria-label="Protocollo">
            <option value="https">https://</option>
            <option value="http">http://</option>
          </select>
          <input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="mytask.tuodominio.it" value={server} required aria-label="Indirizzo del server"
            onChange={(e) => {
              const p = separaIndirizzo(e.target.value, schema);
              if (/^https?:\/\//i.test(e.target.value.trim())) { setSchema(p.schema); setServer(p.resto); } else setServer(e.target.value); // se incolli un indirizzo completo, lo schema passa nel menu
            }} />
        </div>
      )}
      <input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
      <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required aria-label="Password" />
      {errore && <div className="warn" role="alert">{errore}</div>}
      <button className="btn solid login-go" disabled={invio}>{invio ? 'Accesso…' : 'Accedi'}</button>
      <div className="login-ver">versione {VERSIONE}</div>
    </form>
  );
}
