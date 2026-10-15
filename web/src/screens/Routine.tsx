import { useMemo } from 'react';
import { NOMI_FASCIA, type Fascia, type Item } from '../../../shared/types.ts';
import { conteggio, fattaOggi, rigaSettimana } from '../../../shared/routine.ts';
import { formatShort, startOfWeek, addDays } from '../../../shared/dates.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { segnaRoutine } from '../lib/actions.ts';
import { saveItem } from '../lib/store.ts';
import { Empty, Fab, Sec, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';
import { clsx } from '../lib/util.ts';

const FASCE: Fascia[] = ['mattina', 'pomeriggio', 'sera', 'prima_di_dormire'];

export function Routine() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const routine = useMemo(() => items.filter((i) => i.tipo === 'routine' && !i.eliminato), [items]);
  const attive = routine.filter((r) => r.stato !== 'parcheggiato');
  const parcheggiate = routine.filter((r) => r.stato === 'parcheggiato');
  const lunedi = startOfWeek(oggi);

  const riga = (r: Item) => (
    <div key={r.id} className="row p0" style={{ borderLeftColor: 'transparent' }}>
      <button className={clsx('cb', fattaOggi(r, oggi) && 'done')} aria-label={`Segna «${r.titolo}» per oggi`} aria-pressed={fattaOggi(r, oggi)} onClick={() => segnaRoutine(r)} />
      <button className="grow" style={{ textAlign: 'left' }} onClick={() => nav.push({ k: 'item', id: r.id })}>
        <div className="t1">{r.titolo}</div>
        <div className="t2">{[r.obiettivo, r.volteSettimana ? `${r.volteSettimana} volte a settimana` : 'ogni giorno', r.oraPromemoria ? `promemoria ${r.oraPromemoria}` : undefined].filter(Boolean).join(' · ')}</div>
        <div className="week" aria-hidden="true">
          {rigaSettimana(r, oggi).map((g) => <i key={g.day} className={clsx(g.fatto && 'on', g.oggi && 'today')} />)}
        </div>
      </button>
      <div className="right">{conteggio(r, oggi)}</div>
    </div>
  );

  return (
    <>
      <Top title="Routine" sub={`Settimana dal ${formatShort(lunedi)} al ${formatShort(addDays(lunedi, 6))}`} />
      <div className="scroll">
        {attive.length === 0 && <Empty>Nessuna routine attiva. Aggiungine una con il pulsante +.</Empty>}
        {FASCE.map((f) => {
          const l = attive.filter((r) => (r.fascia ?? 'sera') === f);
          return l.length ? <div key={f}><Sec a={NOMI_FASCIA[f]} />{l.map(riga)}</div> : null;
        })}
        {parcheggiate.length > 0 && (
          <>
            <Sec a="Parcheggiate" b={parcheggiate.length} />
            {parcheggiate.map((r) => (
              <div key={r.id} className="row" style={{ alignItems: 'center' }}>
                <div className="grow"><div className="t1 light">{r.titolo}</div><div className="t2">Non compare in Oggi finché non la attivi</div></div>
                <button className="chip" onClick={() => saveItem({ ...r, stato: 'da_fare' })}>Attiva</button>
              </div>
            ))}
          </>
        )}
      </div>
      <Fab onClick={() => nav.nuova({ tipo: 'routine', fascia: 'sera' })} label="Nuova routine" />
    </>
  );
}
