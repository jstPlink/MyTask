import { useMemo } from 'react';
import { formatShortYear } from '../../../shared/dates.ts';
import { barLevel, dueDate, isOverdue, score, urgency, withInheritance } from '../../../shared/priority.ts';
import { figli, listaAzioni, listaEsperienze, listaProgetti, raggruppaPerProgetto, revisione } from '../../../shared/views.ts';
import { margineAtteso, percentuale } from '../../../shared/stima.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { completaVoce, riapriVoce } from '../lib/actions.ts';
import { Empty, Fab, GruppoProgetto, Row, Seg, Sezione, Top } from '../ui/kit.tsx';
import { PulsanteAspetto } from '../ui/PulsanteAspetto.tsx';
import { useNav, type SubFare } from '../ui/nav.tsx';
import { clsx, mapsUrl, nomeTempo } from '../lib/util.ts';

const SUB: { id: SubFare; nome: string }[] = [
  { id: 'azioni', nome: 'Tutte le attività' }, { id: 'progetti', nome: 'Progetti' }, { id: 'esperienze', nome: 'Esperienze' },
];

export function Fare() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const nRev = useMemo(() => revisione(items, oggi).length, [items, oggi]);
  const nAttivita = useMemo(() => listaAzioni(items, oggi).length, [items, oggi]);
  const nProgetti = useMemo(() => listaProgetti(items, oggi).length, [items, oggi]);
  const nEsperienze = useMemo(() => { const v = listaEsperienze(items, oggi); return v.conData.length + v.perZona.reduce((n, [, l]) => n + l.length, 0); }, [items, oggi]);

  return (
    <>
      <Top title="Attività" sub={`${nAttivita} ${nAttivita === 1 ? 'attività' : 'attività'} · ${nProgetti} ${nProgetti === 1 ? 'progetto' : 'progetti'} · ${nEsperienze} ${nEsperienze === 1 ? 'esperienza' : 'esperienze'}${nRev ? ` · ${nRev} da rivedere` : ''}`} right={<PulsanteAspetto />} />
      <div className="scroll">
        <Seg nav voci={SUB} attivo={nav.fareSub} onChange={nav.setFareSub} />
        {nav.fareSub === 'azioni' && <Azioni />}
        {nav.fareSub === 'progetti' && <Progetti />}
        {nav.fareSub === 'esperienze' && <Esperienze />}
      </div>
      <Fab />
    </>
  );
}

function Azioni() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const lista = useMemo(() => listaAzioni(items, oggi), [items, oggi]);
  const margine = useMemo(() => margineAtteso(items), [items]);
  const gruppi = useMemo(() => raggruppaPerProgetto(lista, items), [lista, items]);
  const riga = ({ item, punteggio }: (typeof lista)[number]) => {
    const d = dueDate(item);
    const scaduta = isOverdue(item, oggi);
    return (
      <Row
        key={item.id}
        titolo={item.titolo} tipo={item.tipo}
        meta={item.stato === 'parcheggiato' ? 'Parcheggiato' : [item.stato === 'in_corso' ? 'In corso' : undefined, item.sforzoMin ? `${nomeTempo(item.sforzoMin)} ${percentuale(margine)}` : undefined].filter(Boolean).join(' · ')}
        right={d ? (item.rigida || scaduta ? <span className={clsx('hard', item.rigida && 'rigida')}>{formatShortYear(d, oggi)}</span> : formatShortYear(d, oggi)) : null}
        level={item.stato === 'parcheggiato' ? 1 : barLevel(punteggio)}
        rank={lista.findIndex((x) => x.item.id === item.id) + 1}
        urgenza={urgency(item, oggi)}
        light={item.stato === 'parcheggiato'}
        onCheck={() => completaVoce(item)}
        selected={nav.openId === item.id} onOpen={() => nav.push({ k: 'item', id: item.id })}
      />
    );
  };
  return (
    <>
      {lista.length === 0 && <Empty>Nessuna attività aperta.</Empty>}
      {lista.length > 0 && (
        <Sezione titolo="Tutte le attività" dettaglio={lista.length}>
          {gruppi.map((g) => g.progetto
            ? <GruppoProgetto key={g.progetto.id} progetto={g.progetto} fatti={g.fatti} totale={g.totale}>{g.voci.map(riga)}</GruppoProgetto>
            : g.voci.map(riga))}
        </Sezione>
      )}
      <RigheEsperienze titolo />
    </>
  );
}

function Progetti() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const lista = useMemo(() => listaProgetti(items, oggi), [items, oggi]);
  if (lista.length === 0) return <Empty>Nessun progetto attivo.</Empty>;
  const gruppo = (p: (typeof lista)[number]) => {
    const passi = figli(items, p.progetto.id).filter((c) => c.stato !== 'parcheggiato');
    const aperti = passi.filter((c) => c.stato !== 'fatto' && c.stato !== 'saltato').sort((a, b) => score(withInheritance(b, p.progetto), oggi) - score(withInheritance(a, p.progetto), oggi));
    const chiusi = passi.filter((c) => c.stato === 'fatto' || c.stato === 'saltato');
    const riga = (c: (typeof passi)[number], chiuso: boolean) => {
      const d = dueDate(c);
      return (
        <Row key={c.id} titolo={c.titolo} tipo={c.tipo} done={chiuso} light={chiuso} struck={chiuso}
          meta={chiuso ? undefined : c.sforzoMin ? nomeTempo(c.sforzoMin) : undefined}
          right={d && !chiuso ? (c.rigida || isOverdue(c, oggi) ? <span className={clsx('hard', c.rigida && 'rigida')}>{formatShortYear(d, oggi)}</span> : formatShortYear(d, oggi)) : null}
          level={chiuso ? undefined : barLevel(score(withInheritance(c, p.progetto), oggi))}
          onCheck={() => (chiuso ? riapriVoce(c) : completaVoce(c))}
          selected={nav.openId === c.id} onOpen={() => nav.push({ k: 'item', id: c.id })} />
      );
    };
    return (
      <GruppoProgetto key={p.progetto.id} progetto={p.progetto} fatti={p.fatti} totale={p.totale}>
        {aperti.map((c) => riga(c, false))}
        {chiusi.map((c) => riga(c, true))}
        {passi.length === 0 && <div className="t2" style={{ padding: '12px 14px' }}>Nessun task: aggiungili aprendo il progetto.</div>}
      </GruppoProgetto>
    );
  };
  const attivi = lista.filter((p) => !p.fermo);
  const fermi = lista.filter((p) => p.fermo);
  return (
    <>
      {attivi.length > 0 && <Sezione titolo="Progetti" dettaglio={attivi.length}>{attivi.map(gruppo)}</Sezione>}
      {fermi.length > 0 && <Sezione titolo="Fermi da oltre 30 giorni" dettaglio={fermi.length}>{fermi.map(gruppo)}</Sezione>}
    </>
  );
}

function Esperienze() {
  const items = useItems();
  const oggi = useOggi();
  const v = useMemo(() => listaEsperienze(items, oggi), [items, oggi]);
  if (v.conData.length + v.perZona.length === 0) return <Empty>Nessuna esperienza in lista.</Empty>;
  return <RigheEsperienze />;
}

/** Esperienze con data e "da fare quando capita". Con `titolo` compaiono anche nella lista Attività, sotto una sezione. */
function RigheEsperienze({ titolo }: { titolo?: boolean }) {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const v = useMemo(() => listaEsperienze(items, oggi), [items, oggi]);
  const quandoCapita = useMemo(
    () => v.perZona.flatMap(([, l]) => l).sort((a, b) => (b.interesse ?? 3) - (a.interesse ?? 3) || a.titolo.localeCompare(b.titolo, 'it')),
    [v],
  );
  if (v.conData.length + quandoCapita.length === 0) return null;
  const righeConData = v.conData.map((i) => (
    <Row key={i.id} titolo={i.titolo} tipo={i.tipo} meta={i.oraInizio} interesse={i.interesse ?? 3}
      right={i.rigida ? <span className="hard rigida">{formatShortYear(dueDate(i)!, oggi)}</span> : formatShortYear(dueDate(i)!, oggi)}
      level={barLevel(score(i, oggi))} onCheck={() => completaVoce(i)} selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
  ));
  const righeQuandoCapita = quandoCapita.map((i) => (
    <Row key={i.id} titolo={i.titolo} tipo={i.tipo} light check="square"
      interesse={i.interesse ?? 3}
      right={<a href={i.linkMaps ?? mapsUrl(i.titolo, i.zona)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Maps ›</a>}
      onCheck={() => completaVoce(i)} selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
  ));
  // nella lista Attività le esperienze sono una sola sezione; nella sotto-scheda Esperienze sono due
  if (titolo) return <Sezione titolo="Esperienze" dettaglio={v.conData.length + quandoCapita.length}>{righeConData}{righeQuandoCapita}</Sezione>;
  return (
    <>
      {v.conData.length > 0 && <Sezione titolo="Con data" dettaglio={v.conData.length}>{righeConData}</Sezione>}
      {quandoCapita.length > 0 && <Sezione titolo="Da fare quando capita" dettaglio={quandoCapita.length}>{righeQuandoCapita}</Sezione>}
    </>
  );
}
