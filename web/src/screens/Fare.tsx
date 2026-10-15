import { useMemo, useState } from 'react';
import { formatShortYear } from '../../../shared/dates.ts';
import { barLevel, dueDate, isOverdue, score } from '../../../shared/priority.ts';
import { areeUsate, listaAzioni, listaEsperienze, listaProgetti, revisione } from '../../../shared/views.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { completaVoce } from '../lib/actions.ts';
import { Chips, Empty, Fab, Row, Sec, Seg, Top } from '../ui/kit.tsx';
import { useNav, type SubFare } from '../ui/nav.tsx';
import { mapsUrl } from '../lib/util.ts';

const SUB: { id: SubFare; nome: string }[] = [
  { id: 'azioni', nome: 'Azioni' }, { id: 'progetti', nome: 'Progetti' }, { id: 'esperienze', nome: 'Esperienze' },
];

export function Fare() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const nRev = useMemo(() => revisione(items, oggi).length, [items, oggi]);
  const aperte = items.filter((i) => !i.eliminato && (i.tipo === 'azione' || i.tipo === 'progetto' || i.tipo === 'esperienza') && i.stato !== 'fatto' && i.stato !== 'saltato').length;

  const nuova = () => nav.nuova({ tipo: nav.fareSub === 'progetti' ? 'progetto' : nav.fareSub === 'esperienze' ? 'esperienza' : 'azione' });

  return (
    <>
      <Top title="Attività" sub={`${aperte} aperte${nRev ? ` · ${nRev} in revisione` : ''}`} />
      <div className="scroll">
        <Seg nav voci={SUB} attivo={nav.fareSub} onChange={nav.setFareSub} />
        {nav.fareSub === 'azioni' && <Azioni />}
        {nav.fareSub === 'progetti' && <Progetti />}
        {nav.fareSub === 'esperienze' && <Esperienze />}
      </div>
      <Fab onClick={nuova} label="Nuova voce" />
    </>
  );
}

function Azioni() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const [area, setArea] = useState('Tutte');
  const aree = useMemo(() => areeUsate(items), [items]);
  const lista = useMemo(() => listaAzioni(items, oggi, area === 'Tutte' ? undefined : area), [items, oggi, area]);
  return (
    <>
      {aree.length > 0 && <Chips scroll voci={['Tutte', ...aree]} attivo={area} onChange={setArea} />}
      {lista.length === 0 && <Empty>Nessuna azione aperta.</Empty>}
      {lista.map(({ item, punteggio }) => {
        const d = dueDate(item);
        const scaduta = isOverdue(item, oggi);
        return (
          <Row
            key={item.id}
            titolo={item.titolo}
            tag={item.area}
            meta={item.stato === 'parcheggiato' ? 'Parcheggiato' : [item.stato === 'in_corso' ? 'In corso' : undefined, item.sforzoMin ? `${item.sforzoMin} min` : undefined].filter(Boolean).join(' · ')}
            right={d ? (item.rigida || scaduta ? <span className="hard">{formatShortYear(d, oggi)}</span> : formatShortYear(d, oggi)) : null}
            level={item.stato === 'parcheggiato' ? 1 : barLevel(punteggio)}
            light={item.stato === 'parcheggiato'}
            onCheck={() => completaVoce(item)}
            selected={nav.openId === item.id} onOpen={() => nav.push({ k: 'item', id: item.id })}
          />
        );
      })}
    </>
  );
}

function Progetti() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const lista = useMemo(() => listaProgetti(items, oggi), [items, oggi]);
  const attivi = lista.filter((p) => !p.fermo);
  const fermi = lista.filter((p) => p.fermo);
  if (lista.length === 0) return <Empty>Nessun progetto attivo.</Empty>;
  const card = (p: (typeof lista)[number], forte: boolean) => (
    <button key={p.progetto.id} className={forte ? 'card strong' : 'card'} style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.push({ k: 'item', id: p.progetto.id })}>
      <div className="t1" style={forte ? { fontSize: 17 } : undefined}>{p.progetto.titolo}</div>
      <div className="bar"><i style={{ width: `${p.totale ? (p.fatti / p.totale) * 100 : 0}%` }} /></div>
      <div className="t2">{p.totale ? `${p.fatti} su ${p.totale}` : 'Senza passi'}{p.prossimo ? ` · prossimo: ${p.prossimo.titolo}` : ''}</div>
    </button>
  );
  return (
    <>
      {attivi.map((p, i) => card(p, i === 0))}
      {fermi.length > 0 && <>
        <Sec a="Fermi da oltre 30 giorni" />
        {fermi.map((p) => card(p, false))}
      </>}
    </>
  );
}

function Esperienze() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const v = useMemo(() => listaEsperienze(items, oggi), [items, oggi]);
  const tutte = v.conData.length + v.perZona.reduce((n, [, l]) => n + l.length, 0);
  if (tutte === 0) return <Empty>Nessuna esperienza in lista.</Empty>;
  return (
    <>
      {v.conData.length > 0 && <Sec a="Con data" />}
      {v.conData.map((i) => (
        <Row key={i.id} titolo={i.titolo} meta={[i.zona, i.oraInizio].filter(Boolean).join(' · ')}
          right={i.rigida ? <span className="hard">{formatShortYear(dueDate(i)!, oggi)}</span> : formatShortYear(dueDate(i)!, oggi)}
          level={barLevel(score(i, oggi))} onCheck={() => completaVoce(i)} selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
      ))}
      {v.perZona.map(([zona, lista]) => (
        <div key={zona}>
          <Sec a={zona === 'Altro' ? 'Da fare quando capita' : `Da fare quando capita · ${zona}`} />
          {lista.map((i) => (
            <Row key={i.id} titolo={i.titolo} light check="square"
              level={(i.interesse ?? 3) >= 4 ? 3 : (i.interesse ?? 3) === 3 ? 2 : 1}
              right={<a href={i.linkMaps ?? mapsUrl(i.titolo, i.zona)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Maps ›</a>}
              onCheck={() => completaVoce(i)} selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
          ))}
        </div>
      ))}
    </>
  );
}
