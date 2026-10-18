import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MODELLI_PREDEFINITI, NOMI_PROVIDER, campiDaRisposta, leggiRisposta, opereSenzaTipologia, promptTipologie, type Provider } from '../../../shared/ia.ts';
import { chiediIA, getConfigIA, providerCollegati, salvaProvider, subscribeIA } from '../lib/ia.ts';
import { useItems } from '../lib/hooks.ts';
import { getItem, saveItem } from '../lib/store.ts';
import { mostraToast } from '../lib/toast.ts';
import { clsx } from '../lib/util.ts';
import { useNav } from '../ui/nav.tsx';
import { Back, Sec, Seg, Top } from '../ui/kit.tsx';

const GRUPPO = 15; // opere per ogni richiesta all'IA

/** Chiave API e modello di un servizio. «Salva e controlla» salva e fa una richiesta di prova; la chiave resta su questo dispositivo. */
function CampiProvider({ p }: { p: Provider }) {
  const cfg = useSyncExternalStore(subscribeIA, getConfigIA)[p];
  const [chiave, setChiave] = useState(cfg?.chiave ?? '');
  const [modello, setModello] = useState(cfg?.modello ?? MODELLI_PREDEFINITI[p]);
  const [mostra, setMostra] = useState(false);
  const [esito, setEsito] = useState<string | undefined>();
  const [verifica, setVerifica] = useState(false);
  const nome = NOMI_PROVIDER[p];
  const salvata = !!cfg?.chiave && cfg.chiave === chiave.trim() && cfg.modello === (modello.trim() || MODELLI_PREDEFINITI[p]);

  const prova = async () => {
    salvaProvider(p, { chiave, modello });
    setVerifica(true);
    setEsito(undefined);
    try {
      await chiediIA(p, [{ ruolo: 'utente', testo: 'Rispondi solo con la parola: ok' }]);
      setEsito('Collegata: la chiave funziona.');
    } catch (e) {
      setEsito(e instanceof Error ? e.message : 'Non riuscita.');
    } finally {
      setVerifica(false);
    }
  };

  return (
    <div className="gruppo">
      <h3 className="gruppo-t">{nome}{cfg?.chiave && <span className="gruppo-d">collegata</span>}</h3>
      <div className="field">
        <span>Chiave</span>
        <input type={mostra ? 'text' : 'password'} value={chiave} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={`Chiave API di ${nome}`} onChange={(e) => setChiave(e.target.value)} />
        <button type="button" className="chip" onClick={() => setMostra(!mostra)}>{mostra ? 'Nascondi' : 'Mostra'}</button>
      </div>
      <div className="field">
        <span>Modello</span>
        <input value={modello} autoCapitalize="off" spellCheck={false} onChange={(e) => setModello(e.target.value)} />
      </div>
      <div className="btns">
        {cfg?.chiave && <button className="btn" onClick={() => { salvaProvider(p, undefined); setChiave(''); setModello(MODELLI_PREDEFINITI[p]); setEsito(undefined); }}>Scollega</button>}
        <button className="btn solid" disabled={!chiave.trim() || verifica} onClick={() => void prova()}>{verifica ? 'Controllo…' : salvata ? 'Controlla di nuovo' : 'Salva e controlla'}</button>
      </div>
      {esito && <div className={clsx('t2', 'ia-esito')} role="status">{esito}</div>}
    </div>
  );
}

/**
 * Altro › Intelligenza artificiale: chiavi di Gemini e Groq, accesso alla chat e autocompilazione della tipologia delle opere
 * (film, serie, anime, giochi, libri) a gruppi di 15, con una pausa tra una richiesta e l'altra. Non sovrascrive mai ciò che c'è già;
 * il pulsante «Ferma» interrompe dopo il gruppo in corso.
 */
export function IA() {
  const nav = useNav();
  const items = useItems();
  useSyncExternalStore(subscribeIA, getConfigIA);
  const collegati = providerCollegati();
  const [scelto, setScelto] = useState<Provider | undefined>();
  const usa: Provider | undefined = scelto && collegati.includes(scelto) ? scelto : collegati[0];
  const daFare = useMemo(() => opereSenzaTipologia(items), [items]);
  const [stato, setStato] = useState<{ fatte: number; totale: number; compilate: number } | undefined>();
  const [errore, setErrore] = useState<string | undefined>();
  const [inCorso, setInCorso] = useState(false);
  const ferma = useRef(false);

  const autocompila = async () => {
    if (!usa) return;
    const opere = opereSenzaTipologia(items);
    ferma.current = false;
    setInCorso(true);
    setErrore(undefined);
    let fatte = 0;
    let compilate = 0;
    setStato({ fatte, totale: opere.length, compilate });
    try {
      for (let i = 0; i < opere.length && !ferma.current; i += GRUPPO) {
        const gruppo = opere.slice(i, i + GRUPPO);
        const testo = await chiediIA(usa, [{ ruolo: 'utente', testo: promptTipologie(gruppo) }], { json: true });
        for (const r of leggiRisposta(testo)) {
          const o = gruppo[r.n];
          if (!o) continue;
          const attuale = getItem(o.id) ?? o; // se nel frattempo è cambiata, non si sovrascrive nulla
          const campi = campiDaRisposta(attuale, r);
          if (Object.keys(campi).length) { saveItem({ ...attuale, ...campi, aggiornato: Date.now() }); compilate += 1; }
        }
        fatte += gruppo.length;
        setStato({ fatte, totale: opere.length, compilate });
        await new Promise((res) => setTimeout(res, 1500)); // senza fretta: i servizi gratuiti hanno limiti al minuto
      }
      mostraToast(compilate ? `Tipologia compilata per ${compilate} ${compilate === 1 ? 'opera' : 'opere'}` : 'Nessuna opera compilata');
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Qualcosa non ha funzionato.');
    } finally {
      setInCorso(false);
    }
  };

  return (
    <>
      <Back label="Altro" />
      <Top title="Intelligenza artificiale" sub="Gemini e Groq" />
      <div className="scroll">
        <div className="t2" style={{ padding: '4px 0 6px' }}>
          Inserisci la tua chiave per collegare Gemini (Google AI Studio) o Groq (console.groq.com). La chiave resta su questo dispositivo e va solo al servizio che scegli. Le funzioni sono facoltative.
        </div>
        <CampiProvider p="gemini" />
        <CampiProvider p="groq" />

        <Sec a="Cosa puoi fare" />
        <button className="field link" disabled={!collegati.length} onClick={() => nav.push({ k: 'chat' })}>
          <b style={{ fontWeight: 620 }}>Chat con l&apos;IA</b><span className="muted">{collegati.length ? '›' : 'collega una chiave'}</span>
        </button>

        <div className="gruppo" style={{ marginTop: 14 }}>
          <h3 className="gruppo-t">Autocompila le opere<span className="gruppo-d">{daFare.length} senza tipologia</span></h3>
          <div className="t2" style={{ padding: '6px 0 4px' }}>
            Passa in rassegna film, serie, anime, giochi e libri senza tipologia e compila tipologia (e, per film, serie e anime, mood ed energia) usando i titoli. Non cambia mai ciò che hai già scritto. Al servizio vanno solo i titoli.
          </div>
          {collegati.length > 1 && <Seg<Provider> voci={collegati.map((p) => ({ id: p, nome: NOMI_PROVIDER[p] }))} attivo={usa ?? collegati[0]} onChange={setScelto} />}
          {stato && (
            <div className="ia-avanz" role="status">
              <div className="bar"><i style={{ width: `${stato.totale ? (stato.fatte / stato.totale) * 100 : 100}%` }} /></div>
              <span className="t2">{stato.fatte} di {stato.totale} opere · {stato.compilate} compilate</span>
            </div>
          )}
          {errore && <div className="t2 ia-esito" role="alert">{errore}</div>}
          <div className="btns">
            {inCorso && <button className="btn" onClick={() => { ferma.current = true; }}>Ferma</button>}
            <button className="btn solid" disabled={!usa || inCorso || daFare.length === 0} onClick={() => void autocompila()}>
              {!usa ? 'Collega una chiave' : daFare.length === 0 ? 'Tutte compilate' : inCorso ? 'In corso…' : `Compila ${daFare.length} ${daFare.length === 1 ? 'opera' : 'opere'}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
