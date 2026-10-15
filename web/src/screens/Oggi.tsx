import { useMemo } from 'react';
import { formatLong, formatShortYear } from '../../../shared/dates.ts';
import { barLevel, dueDate, daysOverdue } from '../../../shared/priority.ts';
import { vistaOggi, type Entry } from '../../../shared/views.ts';
import { fattaOggi } from '../../../shared/routine.ts';
import { descriviRicorrenza } from '../../../shared/recurrence.ts';
import { useItems, useOggi, useSyncStatus } from '../lib/hooks.ts';
import { completaVoce, segnaRoutine } from '../lib/actions.ts';
import { Fab, Row, Sec, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';
import { clsx } from '../lib/util.ts';

export function Oggi() {
  const items = useItems();
  const oggi = useOggi();
  const sync = useSyncStatus();
  const nav = useNav();
  const v = useMemo(() => vistaOggi(items, oggi), [items, oggi]);

  const meta = (e: Entry) => {
    const i = e.item;
    const pezzi: string[] = [];
    if (e.padre) pezzi.push(`${e.padre.titolo} · prossimo passo`);
    else if (i.area) pezzi.push(i.area);
    if (i.sforzoMin) pezzi.push(i.sforzoMin >= 60 ? `${i.sforzoMin / 60} ore` : `${i.sforzoMin} min`);
    if (i.ricorrenza) pezzi.push(descriviRicorrenza(i.ricorrenza));
    return pezzi.join(' · ');
  };
  const destra = (e: Entry) => {
    const d = dueDate(e.item);
    if (!d) return null;
    const ritardo = daysOverdue(e.item, oggi);
    if (d === oggi) return <span className="hard">oggi</span>;
    if (ritardo > 0) return <span className="hard">{ritardo === 1 ? 'ieri' : `${ritardo} gg fa`}</span>;
    return e.item.rigida ? <span className="hard">{formatShortYear(d, oggi)}</span> : formatShortYear(d, oggi);
  };

  return (
    <>
      <Top
        title="Oggi"
        sub={formatLong(oggi)}
        right={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button className="badge solid" onClick={() => nav.push({ k: 'inbox' })}>Inbox {v.inbox}</button>
            <button className="badge" onClick={() => nav.push({ k: 'altro' })} aria-label="Apri il menu Altro">Altro ›</button>
          </div>
        }
      />
      <div className="scroll">
        {v.routine.length > 0 && (
          <>
            <Sec a="Routine di oggi" b={`${v.routine.filter((r) => fattaOggi(r, oggi)).length} su ${v.routine.length}`} />
            <div className="chips">
              {v.routine.map((r) => (
                <button key={r.id} className={clsx('chip', fattaOggi(r, oggi) && 'on')} onClick={() => segnaRoutine(r)}>
                  {r.titolo}{fattaOggi(r, oggi) ? ' ✓' : r.obiettivo && r.fascia ? ` · ${r.obiettivo.toLowerCase()}` : ''}
                </button>
              ))}
            </div>
          </>
        )}

        <Sec a="Da fare oggi" b={v.fare.length || undefined} />
        {v.fare.length === 0 && <div className="t2" style={{ padding: '14px 0' }}>Niente di urgente. Puoi pescare qualcosa da «Fare» o «Scoprire».</div>}
        {v.fare.map((e) => (
          <Row
            key={e.item.id}
            titolo={e.item.titolo}
            meta={meta(e)}
            right={destra(e)}
            level={barLevel(e.punteggio)}
            onCheck={() => completaVoce(e.item)}
            onOpen={() => nav.push({ k: 'item', id: e.item.id })}
          />
        ))}

        {v.prossimi.length > 0 && (
          <>
            <Sec a="Prossimi 7 giorni" />
            {v.prossimi.map((e) => (
              <Row
                key={e.item.id}
                titolo={e.item.titolo}
                meta={e.item.tipo === 'esperienza' ? 'Esperienza' : e.item.area}
                right={e.item.rigida ? <span className="hard">{formatShortYear(dueDate(e.item)!, oggi)}</span> : formatShortYear(dueDate(e.item)!, oggi)}
                light
                check={e.item.tipo === 'azione' || e.item.tipo === 'progetto' ? 'circle' : 'square'}
                onCheck={() => completaVoce(e.item)}
                onOpen={() => nav.push({ k: 'item', id: e.item.id })}
              />
            ))}
          </>
        )}

        {v.revisione > 0 && (
          <button className="card tap" style={{ marginTop: 18 }} onClick={() => nav.push({ k: 'revisione' })}>
            <b>Revisione</b><span className={clsx('muted')}>{v.revisione} da rivedere ›</span>
          </button>
        )}
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <span className={clsx('pill-sync', !sync.online && 'off')}>
            {!sync.online ? 'Offline' : sync.inAttesa ? `${sync.inAttesa} da sincronizzare` : 'Sincronizzato'}
          </span>
        </div>
      </div>
      <Fab onClick={() => nav.openCapture(true)} label="Cattura rapida" />
    </>
  );
}
