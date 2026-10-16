import { useEffect, useMemo, useRef, useState } from 'react';
import { NOMI_TIPO } from '../../../shared/types.ts';
import { chiaveTitolo, parseCapture, proposalToItem, type Proposta } from '../../../shared/capture.ts';
import { formatShort, formatShortYear } from '../../../shared/dates.ts';
import { useItems } from '../lib/hooks.ts';
import { interpretaIA } from '../lib/api.ts';
import { saveItem } from '../lib/store.ts';
import { margineAtteso, percentuale, stimaPer } from '../../../shared/stima.ts';
import { mostraToast } from '../lib/toast.ts';
import { useNav } from '../ui/nav.tsx';
import { clsx, newId, nomeTempo } from '../lib/util.ts';

interface RiconoscimentoVocale { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void }
type CostruttoreVocale = new () => RiconoscimentoVocale;

function vocale(): CostruttoreVocale | undefined {
  const w = window as unknown as { SpeechRecognition?: CostruttoreVocale; webkitSpeechRecognition?: CostruttoreVocale };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function Capture() {
  const nav = useNav();
  const [testo, setTesto] = useState(nav.captureText);
  const [ia, setIa] = useState<Proposta | undefined>();
  const [pensa, setPensa] = useState(false);
  const [ascolta, setAscolta] = useState(false);
  const rec = useRef<RiconoscimentoVocale | undefined>(undefined);
  const Voce = useMemo(vocale, []);

  const locale = useMemo(() => (testo.trim() ? parseCapture(testo) : undefined), [testo]);
  const proposta = ia ?? locale;
  const items = useItems();
  const stima = useMemo(() => (proposta?.tipo === 'azione' ? stimaPer(proposta.titolo, items) : undefined), [items, proposta]);
  const margine = useMemo(() => stima?.margine ?? margineAtteso(items), [stima, items]);
  const esistente = useMemo(() => {
    if (!proposta) return undefined;
    const k = chiaveTitolo(proposta.titolo);
    return k ? items.find((i) => !i.eliminato && i.tipo !== 'persona' && chiaveTitolo(i.titolo) === k) : undefined;
  }, [items, proposta]);

  // interpretazione con IA poco dopo che smetti di scrivere; se non disponibile resta quella locale
  useEffect(() => {
    setIa(undefined);
    const t = testo.trim();
    if (t.length < 3) return;
    let attivo = true;
    const timer = setTimeout(async () => {
      setPensa(true);
      const r = await interpretaIA(t);
      if (attivo) { setIa(r); setPensa(false); }
    }, 700);
    return () => { attivo = false; clearTimeout(timer); setPensa(false); };
  }, [testo]);

  const chiudi = () => { rec.current?.stop(); nav.openCapture(false); };

  const salva = () => {
    if (!proposta) return;
    const item = { ...proposalToItem(proposta, newId(), Date.now()), inbox: true }; // bozza da rivedere in Inbox
    // stima del tempo in base alle attività simili già fatte
    if (item.tipo === 'azione' && item.sforzoMin === undefined && stima) item.sforzoMin = stima.minuti;
    saveItem(item);
    nav.openCapture(false);
    mostraToast('Bozza salvata in Inbox', { label: 'Apri', fn: () => nav.push({ k: 'item', id: item.id }) });
  };

  const modifica = () => {
    if (!proposta) return;
    const { id: _id, creato: _c, aggiornato: _a, ...resto } = proposalToItem(proposta, newId(), Date.now());
    nav.push({ k: 'item', nuovo: resto });
  };

  const parla = () => {
    if (!Voce) return;
    if (ascolta) { rec.current?.stop(); return; }
    const r = new Voce();
    r.lang = 'it-IT';
    r.interimResults = true;
    r.onresult = (e) => setTesto(Array.from(e.results).map((x) => x[0].transcript).join(' '));
    r.onend = () => setAscolta(false);
    r.onerror = () => setAscolta(false);
    rec.current = r;
    setAscolta(true);
    r.start();
  };

  return (
    <>
      <div className="dim" onClick={chiudi} />
      <div className="sheet" role="dialog" aria-label="Cattura rapida">
        <div className="grip" />
        <form onSubmit={(e) => { e.preventDefault(); salva(); }}>
          <div className="input">
            <input autoFocus value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cosa ti è venuto in mente?" aria-label="Appunto" />
            {Voce && <button type="button" className={clsx('mic', ascolta && 'on')} aria-label={ascolta ? 'Smetti di ascoltare' : 'Detta'} onClick={parla}>●</button>}
          </div>
        </form>
        {proposta ? (
          <div className="card strong">
            <div className="t2">{ia ? 'L’IA ha capito:' : pensa ? 'Capito così (l’IA sta controllando…):' : 'Ho capito:'}</div>
            <div className="t1" style={{ fontSize: 17 }}>{proposta.titolo}</div>
            <div className="t2" style={{ marginTop: 6 }}>
              {[NOMI_TIPO[proposta.tipo], proposta.piattaforma, proposta.consigliatoDa && `consigliato da ${proposta.consigliatoDa}`, proposta.conChi && `con ${proposta.conChi}`, proposta.inizio && formatShort(proposta.inizio)].filter(Boolean).join(' · ')}
              
            </div>
            {proposta.tipo === 'azione' && (
              <div className="t2" style={{ marginTop: 6 }}>
                {stima ? <>Tempo stimato: <b>{nomeTempo(stima.minuti)} {percentuale(stima.margine)}</b> (da {stima.campioni} {stima.campioni === 1 ? 'attività simile' : 'attività simili'})</> : <>Nessuna attività simile per stimare il tempo · errore atteso {percentuale(margine)}</>}
              </div>
            )}
            {esistente && (
              <div className="t2 warn" style={{ marginTop: 8 }}>
                Ce l'hai già: {NOMI_TIPO[esistente.tipo].toLowerCase()}{esistente.stato === 'fatto' ? ` finito il ${formatShortYear(esistente.completatoIl ?? esistente.inizio ?? '')}` : ' in lista'}.
              </div>
            )}
            <div className="btns">
              {esistente ? (
                <>
                  <button className="btn solid" onClick={() => { rec.current?.stop(); nav.push({ k: 'item', id: esistente.id }); }}>Apri quella</button>
                  <button className="btn" onClick={salva}>Salva lo stesso</button>
                </>
              ) : (
                <>
                  <button className="btn solid" onClick={salva}>Salva in Inbox</button>
                  <button className="btn" onClick={modifica}>Modifica</button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="t2" style={{ textAlign: 'center', margin: '16px 0 6px' }}>Scrivi o detta: film, cose da fare, posti, idee.</div>
        )}
        <div className="t2" style={{ textAlign: 'center' }}>{navigator.onLine ? 'Una riga basta: diventa una bozza in Inbox, poi la rivedi con calma.' : 'Senza connessione: capisco da solo, oppure salvo in Inbox.'}</div>
      </div>
    </>
  );
}
