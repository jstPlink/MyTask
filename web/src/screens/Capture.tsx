import { useMemo, useRef, useState } from 'react';
import { NOMI_TIPO } from '../../../shared/types.ts';
import { cercaSimili } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { nuovaVoce } from '../lib/actions.ts';
import { saveItem } from '../lib/store.ts';
import { mostraToast } from '../lib/toast.ts';
import { Row } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';
import { clsx } from '../lib/util.ts';

interface RiconoscimentoVocale { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void }
type CostruttoreVocale = new () => RiconoscimentoVocale;

function vocale(): CostruttoreVocale | undefined {
  const w = window as unknown as { SpeechRecognition?: CostruttoreVocale; webkitSpeechRecognition?: CostruttoreVocale };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Cattura rapida: il testo non viene interpretato. Si salva così com'è come bozza in Inbox
 * e, mentre si scrive, compaiono tutte le note che contengono le stesse parole (anche in forme diverse),
 * per accorgersi subito se la nota esiste già.
 */
export function Capture() {
  const nav = useNav();
  const [testo, setTesto] = useState(nav.captureText);
  const [ascolta, setAscolta] = useState(false);
  const rec = useRef<RiconoscimentoVocale | undefined>(undefined);
  const Voce = useMemo(vocale, []);
  const items = useItems();
  const simili = useMemo(() => cercaSimili(items, testo), [items, testo]);

  const chiudi = () => { rec.current?.stop(); nav.openCapture(false); };

  const salva = () => {
    const titolo = testo.trim();
    if (!titolo) return;
    const item = nuovaVoce({ tipo: 'azione', titolo, inbox: true }); // bozza da rivedere in Inbox
    saveItem(item);
    nav.openCapture(false);
    mostraToast('Bozza salvata in Inbox', { label: 'Apri', fn: () => nav.push({ k: 'item', id: item.id }) });
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

  const elenco = (
      testo.trim() ? (
          <div className="capture-simili">
            <div className="t2" style={{ margin: '12px 0 2px' }}>
              {simili.length === 0 ? 'Nessuna nota con queste parole: è nuova.' : `${simili.length} ${simili.length === 1 ? 'nota contiene' : 'note contengono'} queste parole`}
            </div>
            {simili.map((i) => (
              <Row
                key={i.id}
                titolo={i.titolo}
                meta={[NOMI_TIPO[i.tipo], i.piattaforma, i.stato === 'fatto' ? 'completata' : i.stato === 'saltato' ? 'saltata' : i.stato === 'parcheggiato' ? 'archiviata' : i.inbox ? 'in Inbox' : undefined].filter(Boolean).join(' · ')}
                check="none"
                light={i.stato === 'fatto' || i.stato === 'saltato'}
                onOpen={() => { rec.current?.stop(); nav.push({ k: 'item', id: i.id }); }}
              />
            ))}
          </div>
      ) : null
  );

  return (
    <>
      <div className="dim" onClick={chiudi} />
      <div className="sheet capture-sheet" role="dialog" aria-label="Cattura rapida">
        <div className="grip" />
        {!nav.wide && elenco}
        <form onSubmit={(e) => { e.preventDefault(); salva(); }}>
          <div className="input">
            <input autoFocus value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cosa ti è venuto in mente?" aria-label="Appunto" />
            {Voce && <button type="button" className={clsx('mic', ascolta && 'on')} aria-label={ascolta ? 'Smetti di ascoltare' : 'Detta'} onClick={parla}>●</button>}
          </div>
          <div className="btns">
            <button type="submit" className="btn solid" disabled={!testo.trim()}>Salva in Inbox</button>
          </div>
        </form>
        {nav.wide && elenco}
        {!testo.trim() && <div className="t2" style={{ textAlign: 'center', margin: '16px 0 6px' }}>Scrivi o detta: la nota si salva com'è, in Inbox. Qui sotto vedi se esiste già.</div>}
      </div>
    </>
  );
}
