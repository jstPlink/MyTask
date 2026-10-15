import { useMemo, useState } from 'react';
import type { Item } from '../../../shared/types.ts';
import { addDays, addMonths, formatLong, monthLabel, startOfWeek } from '../../../shared/dates.ts';
import { barLevel, dueDate, isOpen, isOverdue, score } from '../../../shared/priority.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { completaVoce } from '../lib/actions.ts';
import { Empty, Row } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';

const TIPI = new Set(['azione', 'progetto', 'esperienza']);
const SETTIMANA = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const AGENDA_GIORNI = 10;

const primoDelMese = (iso: string) => `${iso.slice(0, 7)}-01`;

/** Vista calendario di Attività: un mese con un pallino per i giorni con scadenze e l'elenco delle voci del giorno. */
export function Calendario() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const [giorno, setGiorno] = useState(oggi);
  const [mese, setMese] = useState(primoDelMese(oggi));

  const perGiorno = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) {
      if (i.eliminato || !TIPI.has(i.tipo) || !isOpen(i)) continue;
      const d = dueDate(i);
      if (d) m.set(d, [...(m.get(d) ?? []), i]);
    }
    for (const [d, l] of m) m.set(d, l.sort((a, b) => score(b, oggi) - score(a, oggi)));
    return m;
  }, [items, oggi]);

  const giorni = useMemo(() => {
    const start = startOfWeek(mese);
    const ultimo = addDays(addMonths(mese, 1), -1);
    const settimane = Math.ceil((((new Date(ultimo).getTime() - new Date(start).getTime()) / 86400000) + 1) / 7);
    return Array.from({ length: settimane * 7 }, (_, n) => addDays(start, n));
  }, [mese]);

  const riga = (i: Item) => (
    <Row key={i.id} titolo={i.titolo} tag={i.area}
      meta={[i.oraInizio ? `alle ${i.oraInizio}` : undefined, i.tipo === 'esperienza' ? 'Esperienza' : undefined, i.tipo === 'progetto' ? 'Progetto' : undefined, i.sforzoMin ? `${i.sforzoMin} min` : undefined, i.rigida ? 'scadenza rigida' : undefined].filter(Boolean).join(' · ') || undefined}
      level={barLevel(score(i, oggi))} check={i.tipo === 'esperienza' ? 'square' : 'circle'}
      onCheck={() => completaVoce(i)} selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
  );

  const delGiorno = perGiorno.get(giorno) ?? [];
  const cosa = (n: number) => `${n} ${n === 1 ? 'cosa' : 'cose'}`;
  const vaiMese = (n: number) => { const m = addMonths(mese, n); setMese(m); setGiorno(primoDelMese(oggi) === m ? oggi : m); };

  const agenda = useMemo(() => {
    const out: { d: string; l: Item[] }[] = [];
    for (let n = 0; n < 60 && out.length < AGENDA_GIORNI; n++) {
      const d = addDays(giorno, n);
      const l = perGiorno.get(d);
      if (l?.length) out.push({ d, l });
    }
    return out;
  }, [giorno, perGiorno]);

  const griglia = (
    <>
      <div className="cal-head">
        <b>{monthLabel(mese)}</b>
        <div className="cal-nav">
          <button onClick={() => vaiMese(-1)} aria-label="Mese precedente">‹</button>
          <button onClick={() => vaiMese(1)} aria-label="Mese successivo">›</button>
        </div>
      </div>
      <div className="cal" role="grid">
        {SETTIMANA.map((g, n) => <div key={n} className="dw">{g}</div>)}
        {giorni.map((d) => {
          const l = perGiorno.get(d) ?? [];
          const avviso = l.some((i) => i.rigida || isOverdue(i, oggi));
          return (
            <button key={d} className={['cal-d', d.slice(0, 7) !== mese.slice(0, 7) && 'fuori', d === oggi && 'oggi', d === giorno && 'sel'].filter(Boolean).join(' ')}
              onClick={() => { setGiorno(d); if (d.slice(0, 7) !== mese.slice(0, 7)) setMese(primoDelMese(d)); }}
              aria-label={`${formatLong(d)}${l.length ? `, ${cosa(l.length)}` : ''}`} aria-pressed={d === giorno}>
              {Number(d.slice(8))}
              <div className="cal-dots">{l.slice(0, 3).map((_, n) => <i key={n} className={avviso && n === 0 ? 'w' : undefined} />)}</div>
            </button>
          );
        })}
      </div>
    </>
  );

  if (nav.wide) {
    return (
      <div className="cal-split">
        <div>{griglia}</div>
        <div className="cal-ag">
          {agenda.length === 0 && <Empty>Nessuna scadenza nei prossimi giorni.</Empty>}
          {agenda.map(({ d, l }) => (
            <section key={d}>
              <h3 className={d === oggi ? 'oggi' : undefined}>{d === oggi ? `Oggi · ${formatLong(d)}` : formatLong(d)} <small>{cosa(l.length)}</small></h3>
              {l.map(riga)}
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {griglia}
      <div className="cal-day-h">{giorno === oggi ? `Oggi · ${formatLong(giorno)}` : formatLong(giorno)} <span>{cosa(delGiorno.length)}</span></div>
      {delGiorno.length === 0 && <Empty>Niente in programma questo giorno.</Empty>}
      {delGiorno.map(riga)}
    </>
  );
}
