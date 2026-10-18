import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ISTRUZIONI_CHAT, NOMI_PROVIDER, riepilogoPerChat, type Provider } from '../../../shared/ia.ts';
import { chiediIA, getConfigIA, providerCollegati, subscribeIA, type Messaggio } from '../lib/ia.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { clsx } from '../lib/util.ts';
import { Back, Seg, Toggle, Top } from '../ui/kit.tsx';

type Scelta = Provider | 'entrambe';
interface Bolla { ruolo: 'utente' | 'ia'; testo: string; da?: Provider; errore?: boolean }

// ricorda sul dispositivo se il riepilogo delle note va condiviso con l'IA
const CHIAVE_RIEPILOGO = 'mytask.chat.riepilogo';

/**
 * Chat con Gemini, con Groq o con tutte e due insieme (le risposte compaiono una sotto l'altra, col nome del servizio).
 * La conversazione vive solo nella schermata. Se l'interruttore è acceso, a ogni richiesta si aggiunge un riepilogo delle note
 * (titoli e priorità); è spento di base. Ogni servizio vede le domande dell'utente e le proprie risposte, non quelle dell'altro.
 */
export function Chat() {
  const items = useItems();
  const oggi = useOggi();
  useSyncExternalStore(subscribeIA, getConfigIA);
  const collegati = providerCollegati();
  const [scelta, setScelta] = useState<Scelta | undefined>();
  const attiva: Scelta = scelta && (scelta === 'entrambe' ? collegati.length > 1 : collegati.includes(scelta)) ? scelta : collegati[0];
  const [riepilogo, setRiepilogo] = useState(() => { try { return localStorage.getItem(CHIAVE_RIEPILOGO) === '1'; } catch { return false; } });
  const [testo, setTesto] = useState('');
  const [bolle, setBolle] = useState<Bolla[]>([]);
  const [attesa, setAttesa] = useState(false);
  const fondo = useRef<HTMLDivElement>(null);
  useEffect(() => { fondo.current?.scrollIntoView({ block: 'end' }); }, [bolle.length, attesa]);

  const cambiaRiepilogo = (v: boolean) => { setRiepilogo(v); try { localStorage.setItem(CHIAVE_RIEPILOGO, v ? '1' : '0'); } catch { /* ignora */ } };

  const invia = async () => {
    const domanda = testo.trim();
    if (!domanda || attesa || !attiva) return;
    const nuove: Bolla[] = [...bolle, { ruolo: 'utente', testo: domanda }];
    setBolle(nuove);
    setTesto('');
    setAttesa(true);
    const sistema = riepilogo ? `${ISTRUZIONI_CHAT}\n\nRiepilogo delle note dell'utente:\n${riepilogoPerChat(items, oggi)}` : ISTRUZIONI_CHAT;
    const quali: Provider[] = attiva === 'entrambe' ? collegati : [attiva];
    const risposte = await Promise.all(quali.map(async (p): Promise<Bolla> => {
      // ogni servizio vede la conversazione con le sue risposte e quelle dell'utente (non quelle dell'altro)
      const storia: Messaggio[] = nuove.filter((b) => b.ruolo === 'utente' || (!b.errore && (b.da === p || (!b.da && b.ruolo === 'ia')))).map((b) => ({ ruolo: b.ruolo, testo: b.testo }));
      try { return { ruolo: 'ia', da: p, testo: await chiediIA(p, storia, { sistema }) }; }
      catch (e) { return { ruolo: 'ia', da: p, testo: e instanceof Error ? e.message : 'Non riuscita.', errore: true }; }
    }));
    setBolle([...nuove, ...risposte]);
    setAttesa(false);
  };

  if (!collegati.length) {
    return (
      <>
        <Back label="Indietro" />
        <Top title="Chat con l'IA" />
        <div className="scroll"><div className="empty">Collega Gemini o Groq da Altro › Intelligenza artificiale per chattare.</div></div>
      </>
    );
  }

  return (
    <>
      <Back label="Indietro" />
      <Top title="Chat con l'IA" sub={attiva === 'entrambe' ? 'Gemini e Groq insieme' : NOMI_PROVIDER[attiva as Provider]} />
      <div className="scroll chat">
        {collegati.length > 1 && (
          <Seg<Scelta> uguali voci={[...collegati.map((p) => ({ id: p as Scelta, nome: NOMI_PROVIDER[p] })), { id: 'entrambe', nome: 'Entrambe' }]} attivo={attiva} onChange={setScelta} />
        )}
        <div className="field chat-riepilogo">
          <span>Condividi un riepilogo delle mie note<small>Titoli e priorità, per risposte sulle tue cose. Resta spento se non vuoi.</small></span>
          <Toggle on={riepilogo} onChange={cambiaRiepilogo} label="Condividi un riepilogo delle mie note con l'IA" />
        </div>
        {bolle.length === 0 && <div className="t2" style={{ padding: '14px 4px' }}>Chiedi qualcosa: come organizzare la giornata, cosa guardare stasera, come usare l&apos;app…</div>}
        {bolle.map((b, n) => (
          <div key={n} className={clsx('bolla', b.ruolo === 'utente' ? 'mia' : 'ia', b.errore && 'errore')}>
            {b.da && attiva === 'entrambe' && <b className="bolla-da">{NOMI_PROVIDER[b.da]}</b>}
            <span>{b.testo}</span>
          </div>
        ))}
        {attesa && <div className="bolla ia"><span className="t2">Sto pensando…</span></div>}
        <div ref={fondo} />
      </div>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void invia(); }}>
        <input value={testo} placeholder="Scrivi un messaggio" aria-label="Messaggio" onChange={(e) => setTesto(e.target.value)} />
        <button type="submit" className="chat-invia" disabled={!testo.trim() || attesa} aria-label="Invia">↑</button>
        {bolle.length > 0 && <button type="button" className="chip" onClick={() => setBolle([])}>Svuota</button>}
      </form>
    </>
  );
}
