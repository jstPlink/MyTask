import { useEffect, useState, useSyncExternalStore } from 'react';
import { today } from '../../../shared/dates.ts';
import { completa } from '../../../shared/recurrence.ts';
import { NOMI_TIPO } from '../../../shared/types.ts';
import { chiudiRecensione, getRecensione, subscribeRecensione } from '../lib/recensione.ts';
import { saveItem } from '../lib/store.ts';
import { mostraToast } from '../lib/toast.ts';
import { clsx } from '../lib/util.ts';
import { BadgeTipo } from './Icone.tsx';

/** Si apre al segno di fatto su film, serie, anime, giochi, libri e ricette: voto e commento, poi la voce risulta fatta oggi. */
export function RecensioneSheet() {
  const item = useSyncExternalStore(subscribeRecensione, getRecensione);
  const [voto, setVoto] = useState<number | undefined>();
  const [commento, setCommento] = useState('');

  useEffect(() => {
    setVoto(item?.voto);
    setCommento(item?.commento ?? '');
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!item) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') chiudiRecensione(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [item]);

  if (!item) return null;

  const conferma = () => {
    const prima = item;
    const dopo = { ...completa(item, today(), Date.now()), voto, commento: commento.trim() || undefined };
    saveItem(dopo);
    chiudiRecensione();
    mostraToast('Segnato come fatto', { label: 'Annulla', fn: () => saveItem(prima) });
  };

  return (
    <>
      <div className="dim" onClick={chiudiRecensione} />
      <div className="sheet" role="dialog" aria-label="Com'è andata?">
        <div className="grip" />
        <div className="rec-testa">
          <BadgeTipo tipo={item.tipo} size={32} />
          <div style={{ minWidth: 0 }}>
            <div className="t1" style={{ fontSize: 18 }}>{item.titolo}</div>
            <div className="t2">{NOMI_TIPO[item.tipo]} · lo segno come fatto oggi</div>
          </div>
        </div>
        <div className="t2" style={{ margin: '14px 0 6px' }}>Voto</div>
        <div className="rec-voti" role="group" aria-label="Voto da 1 a 10">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button key={n} type="button" className={clsx('rec-voto', voto === n && 'on')} aria-pressed={voto === n} onClick={() => setVoto(voto === n ? undefined : n)}>{n}</button>
          ))}
        </div>
        <textarea className="textarea" style={{ marginTop: 14 }} value={commento} placeholder="Un commento (facoltativo)" onChange={(e) => setCommento(e.target.value)} />
        <div className="btns">
          <button className="btn" onClick={chiudiRecensione}>Annulla</button>
          <button className="btn solid" onClick={conferma}>Segna come fatto</button>
        </div>
      </div>
    </>
  );
}
