import { useEffect, useState, type FormEvent } from 'react';
import { ErroreApi, PASSWORD_MIN, apiBase, impostaServer, login, registra, registrazioneAttiva } from '../lib/api.ts';
import { isNative } from '../lib/native.ts';
import { azzeraDatiLocali, getAuth, getItems, setAuth } from '../lib/store.ts';
import { sync } from '../lib/sync.ts';
import { VERSIONE } from '../version.ts';
import { componiIndirizzo, indirizzoValido, separaIndirizzo, type Schema } from '../../../shared/indirizzo.ts';

/**
 * Accesso con email e password, o creazione di un nuovo account (se il server la permette: `MYTASK_REGISTRAZIONE=true`). Nell'app Android compare anche l'indirizzo del server (protocollo + indirizzo, https di base);
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
  // creazione di un nuovo account: sul sito il pulsante compare solo se il server la permette; nell'app (che può puntare a un server qualsiasi) compare sempre
  const [nuovo, setNuovo] = useState(false);
  const [ripeti, setRipeti] = useState('');
  const [consentita, setConsentita] = useState(false);
  useEffect(() => { if (!nativa) void registrazioneAttiva().then(setConsentita); }, [nativa]);
  const puoCreare = nativa || consentita || import.meta.env.DEV; // in sviluppo locale il pulsante c'è sempre (se il server è chiuso, risponde con un messaggio)

  async function entra(e: FormEvent) {
    e.preventDefault();
    setErrore('');
    setInvio(true);
    try {
      if (nativa) {
        if (!indirizzoValido(separaIndirizzo(server, schema).resto)) throw new ErroreApi(0, "Scrivi l'indirizzo del server, per esempio mytask.tuodominio.it");
        impostaServer(componiIndirizzo(schema, server));
      }
      const mail = email.trim().toLowerCase();
      if (nuovo) {
        if (password.length < PASSWORD_MIN) throw new ErroreApi(0, `La password deve avere almeno ${PASSWORD_MIN} caratteri`);
        if (password !== ripeti) throw new ErroreApi(0, 'Le due password non coincidono');
      }
      // i dati rimasti sul dispositivo sono di un altro account: con un account diverso si tolgono da qui (restano sul server per quello di prima)
      const prima = getAuth().email?.toLowerCase();
      if (prima && prima !== mail && getItems().length > 0) {
        if (!window.confirm(`Su questo dispositivo ci sono i dati di ${prima}. Entrando con un altro account verranno tolti da qui (restano sul server, nell'account di prima). Continuare?`)) { setInvio(false); return; }
        await azzeraDatiLocali();
      }
      const r = nuovo ? await registra(mail, password) : await login(mail, password);
      await setAuth({ token: r.token, email: r.email });
      void sync();
    } catch (err) {
      setErrore(err instanceof ErroreApi ? err.message : nuovo ? 'Creazione dell\'account non riuscita' : 'Accesso non riuscito');
    } finally {
      setInvio(false);
    }
  }

  return (
    <form className="login" onSubmit={entra}>
      <div className="login-brand"><i aria-hidden="true" />MyTask</div>
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
      <input type="password" autoComplete={nuovo ? 'new-password' : 'current-password'} placeholder={nuovo ? `Password (almeno ${PASSWORD_MIN} caratteri)` : 'Password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={nuovo ? PASSWORD_MIN : undefined} aria-label="Password" />
      {nuovo && <input type="password" autoComplete="new-password" placeholder="Ripeti la password" value={ripeti} onChange={(e) => setRipeti(e.target.value)} required aria-label="Ripeti la password" />}
      {errore && <div className="warn" role="alert">{errore}</div>}
      <button className="btn solid login-go" disabled={invio}>{invio ? (nuovo ? 'Creazione…' : 'Accesso…') : nuovo ? 'Crea account' : 'Accedi'}</button>
      {puoCreare && (
        <button type="button" className="login-cambia" onClick={() => { setNuovo(!nuovo); setErrore(''); setRipeti(''); }}>
          {nuovo ? 'Hai già un account? Accedi' : 'Non hai un account? Creane uno'}
        </button>
      )}
      <div className="login-ver">versione {VERSIONE}</div>
    </form>
  );
}
