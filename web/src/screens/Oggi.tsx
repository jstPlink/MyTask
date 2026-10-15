import { useEffect, useMemo, useState } from 'react';
import { addDays, formatLong, formatShortYear } from '../../../shared/dates.ts';
import { minutiDisponibili, orario, pianifica } from '../../../shared/piano.ts';
import { barLevel, dueDate, daysOverdue, score } from '../../../shared/priority.ts';
import { vistaOggi, type Entry } from '../../../shared/views.ts';
import { fattaOggi } from '../../../shared/routine.ts';
import { descriviRicorrenza } from '../../../shared/recurrence.ts';
import { useDisponibilita, useItems, useOggi, useSyncStatus } from '../lib/hooks.ts';
import { completaVoce, segnaRoutine } from '../lib/actions.ts';
import { Fab, Icona, Row, Sec, Seg, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';
import { clsx } from '../lib/util.ts';
import { Calendario } from './Calendario.tsx';

type Vista = 'elenco' | 'calendario';
const KEY_VISTA = 'mytask.oggi.vista';
const durata = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);
const leggiVista = (): Vista => { try { return localStorage.getItem(KEY_VISTA) === 'calendario' ? 'calendario' : 'elenco'; } catch { return 'elenco'; } };

export function Oggi() {
  const items = useItems();
  const oggi = useOggi();
  const sync = useSyncStatus();
  const nav = useNav();
  const v = useMemo(() => vistaOggi(items, oggi), [items, oggi]);
  const disp = useDisponibilita();
  const [minutoCorrente, setMinutoCorrente] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => { const t = setInterval(() => setMinutoCorrente(Math.floor(Date.now() / 60000)), 60_000); return () => clearInterval(t); }, []);
  const piano = useMemo(() => (disp ? pianifica(items, disp, oggi, minutoCorrente * 60000) : null), [items, disp, oggi, minutoCorrente]);
  const [vista, setVistaState] = useState<Vista>(leggiVista);
  const setVista = (x: Vista) => { setVistaState(x); try { localStorage.setItem(KEY_VISTA, x); } catch { /* ignora */ } };
  const selettore = (
    <div style={nav.wide ? { maxWidth: 300 } : undefined}>
      <Seg<Vista> voci={[{ id: 'elenco', nome: 'Elenco' }, { id: 'calendario', nome: 'Calendario' }]} attivo={vista} onChange={setVista} />
    </div>
  );

  const meta = (e: Entry) => {
    const i = e.item;
    const pezzi: string[] = [];
    if (e.padre) pezzi.push(`${e.padre.titolo} · prossimo passo`);
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

  const routineFatte = v.routine.filter((r) => fattaOggi(r, oggi)).length;
  const routine = v.routine.length > 0 && (
    nav.wide ? (
      <div className="card">
        <div className="t2">Routine di oggi · {routineFatte} su {v.routine.length}</div>
        <div style={{ marginTop: 8 }}>
          {v.routine.map((r) => (
            <button key={r.id} className={clsx('pill', fattaOggi(r, oggi) && 'done')} onClick={() => segnaRoutine(r)} aria-pressed={fattaOggi(r, oggi)}>
              {fattaOggi(r, oggi) ? '✓ ' : ''}{r.titolo}{!fattaOggi(r, oggi) && r.obiettivo ? ` · ${r.obiettivo.toLowerCase()}` : ''}
            </button>
          ))}
        </div>
      </div>
    ) : (
      <>
        <Sec a="Routine di oggi" b={`${routineFatte} su ${v.routine.length}`} />
        <div className="chips">
          {v.routine.map((r) => (
            <button key={r.id} className={clsx('chip', fattaOggi(r, oggi) && 'on')} onClick={() => segnaRoutine(r)}>
              {r.titolo}{fattaOggi(r, oggi) ? ' ✓' : r.obiettivo && r.fascia ? ` · ${r.obiettivo.toLowerCase()}` : ''}
            </button>
          ))}
        </div>
      </>
    )
  );

  const dovePianificata = (id: string) => piano?.giorni.flatMap((g) => g.blocchi).find((x) => x.item.id === id && !x.fisso);
  const nomeGiorno = (d: string) => (d === addDays(oggi, 1) ? 'domani' : formatLong(d).toLowerCase());
  const bloccoRiga = (bl: NonNullable<typeof piano>['giorni'][number]['blocchi'][number]) => (
    <Row
      key={`${bl.item.id}-${bl.da}`}
      titolo={bl.item.titolo}
      tag={bl.padre ? undefined : bl.item.area}
      ora={<>{orario(bl.da)}<small>{durata(bl.a - bl.da)}</small></>}
      meta={[bl.fisso ? 'impegno con orario' : undefined, bl.padre ? `${bl.padre.titolo} · prossimo passo` : undefined, bl.parte ? `parte ${bl.parte.n} di ${bl.parte.di}` : undefined].filter(Boolean).join(' · ') || undefined}
      right={bl.inRitardo ? <span className="piano-avviso">oltre la scadenza</span> : destra({ item: bl.item, padre: bl.padre, punteggio: 0 })}
      level={barLevel(score(bl.item, oggi))}
      onCheck={() => completaVoce(bl.item)}
      selected={nav.openId === bl.item.id}
      onOpen={() => nav.push({ k: 'item', id: bl.item.id })}
    />
  );

  const pianoOggi = piano?.giorni[0];
  const totaleOggi = piano && disp ? minutiDisponibili(disp, oggi, oggi, minutoCorrente * 60000) : 0;
  const fuoriOggi = piano ? v.fare.filter((e) => { const d = dueDate(e.item); return d !== undefined && d <= oggi && !pianoOggi?.blocchi.some((x) => x.item.id === e.item.id); }) : [];
  const prossimiGiorni = piano ? piano.giorni.slice(1, 7).filter((g) => g.blocchi.length > 0) : [];

  const faroggi = (
    <>
      {piano && pianoOggi ? (
        <>
          <Sec a="Piano di oggi" b={totaleOggi ? `${durata(pianoOggi.usati)} su ${durata(totaleOggi)}` : undefined} />
          {totaleOggi > 0 && <div className={clsx('piano-barra', pianoOggi.usati >= totaleOggi && 'pieno')} aria-hidden="true"><i style={{ width: `${Math.min(100, (pianoOggi.usati / totaleOggi) * 100)}%` }} /></div>}
          {pianoOggi.blocchi.length === 0 && (
            <div className="t2" style={{ padding: '14px 0' }}>
              {totaleOggi === 0 && !pianoOggi.blocchi.length ? 'Oggi non hai tempo libero impostato (o la giornata è finita).' : 'Niente da pianificare per oggi.'}
            </div>
          )}
          {pianoOggi.blocchi.map(bloccoRiga)}
          {fuoriOggi.length > 0 && (
            <>
              <Sec a="Non entrano oggi" b={fuoriOggi.length} />
              {fuoriOggi.map((e) => {
                const dove = dovePianificata(e.item.id);
                return (
                  <Row key={e.item.id} titolo={e.item.titolo} tag={e.padre ? undefined : e.item.area} light
                    meta={dove ? `rimandata a ${nomeGiorno(dove.data)} alle ${orario(dove.da)}` : 'senza spazio nelle prossime due settimane'}
                    right={destra(e)} onCheck={() => completaVoce(e.item)} selected={nav.openId === e.item.id} onOpen={() => nav.push({ k: 'item', id: e.item.id })} />
                );
              })}
            </>
          )}
          {prossimiGiorni.length > 0 && (
            <>
              <Sec a="Nei prossimi giorni" />
              {prossimiGiorni.map((g) => (
                <div key={g.data} className="field">
                  <span style={{ textTransform: 'capitalize' }}>{formatLong(g.data)}</span>
                  <span className="muted">{g.blocchi.length} {g.blocchi.length === 1 ? 'attività' : 'attività'} · {durata(g.usati)}</span>
                </div>
              ))}
            </>
          )}
          {piano.fuori.length > 0 && <div className="t2" style={{ padding: '10px 0' }}>{piano.fuori.length} {piano.fuori.length === 1 ? 'attività non entra' : 'attività non entrano'} nelle prossime due settimane: servono più fasce di tempo libero.</div>}
        </>
      ) : (
        <>
          <Sec a="Da fare oggi" b={v.fare.length || undefined} />
          <button className="card tap" style={{ marginTop: 8 }} onClick={() => nav.push({ k: 'tempolibero' })}>
            <span><b>Imposta il tuo tempo libero</b><span className="t2" style={{ display: 'block' }}>MyTask distribuirà le attività nella giornata in base a priorità e tempo disponibile.</span></span>
            <span className="muted">›</span>
          </button>
          {v.fare.length === 0 && <div className="t2" style={{ padding: '14px 0' }}>Niente di urgente. Puoi pescare qualcosa da «Attività» o «Scoprire».</div>}
          {v.fare.map((e) => (
            <Row
              key={e.item.id}
              titolo={e.item.titolo}
              meta={meta(e)}
              tag={e.padre ? undefined : e.item.area}
              right={destra(e)}
              level={barLevel(e.punteggio)}
              onCheck={() => completaVoce(e.item)}
              selected={nav.openId === e.item.id}
              onOpen={() => nav.push({ k: 'item', id: e.item.id })}
            />
          ))}
        </>
      )}
      {v.prossimi.length > 0 && (
        <>
          <Sec a="Prossimi 7 giorni" />
          {v.prossimi.map((e) => (
            <Row
              key={e.item.id}
              titolo={e.item.titolo}
              meta={e.item.tipo === 'esperienza' ? 'Esperienza' : undefined}
              tag={e.item.tipo === 'esperienza' ? undefined : e.item.area}
              right={e.item.rigida ? <span className="hard">{formatShortYear(dueDate(e.item)!, oggi)}</span> : formatShortYear(dueDate(e.item)!, oggi)}
              light
              check={e.item.tipo === 'azione' || e.item.tipo === 'progetto' ? 'circle' : 'square'}
              onCheck={() => completaVoce(e.item)}
              selected={nav.openId === e.item.id}
              onOpen={() => nav.push({ k: 'item', id: e.item.id })}
            />
          ))}
        </>
      )}
    </>
  );

  const revisione = v.revisione > 0 && (
    <button className={clsx('card tap', nav.wide && 'strong')} style={nav.wide ? undefined : { marginTop: 18 }} onClick={() => nav.vai({ k: 'revisione' })}>
      <span><b>Revisione</b>{nav.wide && <span className="t2" style={{ display: 'block' }}>{v.revisione} voci scadute o ferme da rivedere</span>}</span>
      <span className="muted">{nav.wide ? 'Inizia ›' : `${v.revisione} da rivedere ›`}</span>
    </button>
  );
  const stato = sync.online && !sync.inAttesa ? null : (
    <div style={{ textAlign: 'center', marginTop: 18 }}>
      <span className={clsx('pill-sync', !sync.online && 'off')}>
        {!sync.online ? 'Offline' : sync.inAttesa ? `${sync.inAttesa} da sincronizzare` : 'Sincronizzato'}
      </span>
    </div>
  );

  if (nav.wide) {
    return (
      <>
        <Top title="Oggi" sub={`${formatLong(oggi)} · ${v.routine.length} routine, ${v.fare.length} cose da fare`} />
        <div className="scroll wide-dash">
          {selettore}
          {vista === 'calendario' ? <Calendario /> : <div className="dash">
            <div>{faroggi}</div>
            <div className="dash-side">
              {routine}
              {revisione}
              {v.inbox > 0 && (
                <button className="card tap" onClick={() => nav.vai({ k: 'inbox' })}>
                  <span><span className="t2" style={{ display: 'block' }}>Inbox</span><b>{v.inbox} {v.inbox === 1 ? 'idea' : 'idee'} da smistare</b></span>
                  <span className="muted">›</span>
                </button>
              )}
            </div>
          </div>}
        </div>
      </>
    );
  }

  return (
    <>
      <Top
        title="Oggi"
        sub={formatLong(oggi)}
        right={
          <div className="header-circles">
            <button className="circ" onClick={() => nav.push({ k: 'inbox' })} aria-label={`Inbox, ${v.inbox} da smistare`}>
              <Icona nome="inbox" size={22} />
              {v.inbox > 0 && <span className="circ-badge">{v.inbox > 99 ? '99+' : v.inbox}</span>}
            </button>
            <button className="circ" onClick={() => nav.push({ k: 'altro' })} aria-label="Altro: archivio, persone, luoghi, impostazioni">
              <Icona nome="altro" size={22} />
            </button>
          </div>
        }
      />
      <div className="scroll">
        {selettore}
        {vista === 'calendario' ? <Calendario /> : (
          <>
            {routine}
            {faroggi}
            {revisione}
            {stato}
          </>
        )}
      </div>
      <Fab onClick={() => nav.openCapture(true)} label="Cattura rapida" />
    </>
  );
}
