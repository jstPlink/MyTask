import { useSyncExternalStore } from 'react';
import { chiudiDurata, getDurata, subscribeDurata } from '../lib/durata.ts';
import { getItem, saveItem } from '../lib/store.ts';
import { nomeTempo } from '../lib/util.ts';
import { clsx } from '../lib/util.ts';
import { useLayer } from './nav.tsx';

const TEMPI = [5, 15, 30, 60, 120, 240, 480, 1440];

/** Si apre dopo aver spuntato un'attività: tempo reale, facoltativo. Serve per stimare meglio le prossime. */
export function DurataSheet() {
  const item = useSyncExternalStore(subscribeDurata, getDurata);
  useLayer('durata', !!item, chiudiDurata);
  if (!item) return null;

  const scegli = (min: number) => {
    const attuale = getItem(item.id) ?? item;
    saveItem({ ...attuale, durataRealeMin: min });
    chiudiDurata();
  };

  return (
    <>
      <div className="dim" onClick={chiudiDurata} />
      <div className="sheet" role="dialog" aria-label="Quanto ci hai messo?">
        <div className="grip" />
        <div className="t1" style={{ fontSize: 18 }}>{item.titolo}</div>
        <div className="t2">Quanto ci hai messo? Così le prossime stime saranno più precise.</div>
        {item.sforzoMin && (
          <button className="btn solid" style={{ width: '100%', marginTop: 14 }} onClick={() => scegli(item.sforzoMin!)}>Come stimato · {nomeTempo(item.sforzoMin)}</button>
        )}
        <div className="chips" style={{ marginTop: 14 }}>
          {TEMPI.filter((m) => m !== item.sforzoMin).map((m) => <button key={m} type="button" className={clsx('chip')} onClick={() => scegli(m)}>{nomeTempo(m)}</button>)}
        </div>
        <div className="btns"><button className="btn" onClick={chiudiDurata}>Salta</button></div>
      </div>
    </>
  );
}
