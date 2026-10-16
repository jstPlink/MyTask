import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../../../shared/types.ts';
import { addDays, formatLong, formatShortYear } from '../../../shared/dates.ts';
import { minutiDisponibili, orario, pianifica } from '../../../shared/piano.ts';
import { barLevel, dueDate, daysOverdue, isOpen, isOverdue, score } from '../../../shared/priority.ts';
import { raggruppaPerProgetto, vistaOggi, type Entry } from '../../../shared/views.ts';
import { fattaOggi } from '../../../shared/routine.ts';
import { descriviRicorrenza } from '../../../shared/recurrence.ts';
import { useDisponibilita, useItems, useOggi, useSyncStatus } from '../lib/hooks.ts';
import { completaVoce, segnaRoutine } from '../lib/actions.ts';
import { Fab, Gruppo, GruppoProgetto, Icona, Row, Top } from '../ui/kit.tsx';
import { useLayer, useNav } from '../ui/nav.tsx';
import { clsx, nomeTempo } from '../lib/util.ts';
import { margineAtteso, percentuale } from '../../../shared/stima.ts';
import { GrigliaMese, type SegnoGiorno } from './Calendario.tsx';

// il giorno scelto resta finché l'app è aperta (anche aprendo una voce e tornando indietro)
const scelta: { giorno: string | undefined } = { giorno: undefined };
const TIPI_DATATI = new Set(['azione', 'progetto', 'esperienza']);
const durata = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);

export function Oggi() {
  const items = useItems();
  const oggi = useOggi();
  const sync = useSyncStatus();
  const nav = useNav();
  const v = useMemo(() => vistaOggi(items, oggi), [items, oggi]);
  const margine = useMemo(() => margineAtteso(items), [items]);
  const disp = useDisponibilita();
  const [minutoCorrente, setMinutoCorrente] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => { const t = setInterval(() => setMinutoCorrente(Math.floor(Date.now() / 60000)), 60_000); return () => clearInterval(t); }, []);
  const piano = useMemo(() => (disp ? pianifica(items, disp, oggi, minutoCorrente * 60000) : null), [items, disp, oggi, minutoCorrente]);
  const [meseAperto, setMeseAperto] = useState(false);
  const [giornoScelto, setGiornoState] = useState<string>(scelta.giorno ?? oggi);
  const giorno = giornoScelto < oggi && giornoScelto !== scelta.giorno ? oggi : giornoScelto;
  const setGiorno = (d: string) => { scelta.giorno = d === oggi ? undefined : d; setGiornoState(d); };
  const voci = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) {
      if (i.eliminato || !TIPI_DATATI.has(i.tipo) || !isOpen(i) || i.stato === 'parcheggiato') continue;
      const d = dueDate(i);
      if (d) m.set(d, [...(m.get(d) ?? []), i]);
    }
    return m;
  }, [items]);
  const segni = useMemo(() => {
    const m = new Map<string, SegnoGiorno>();
    const aggiungi = (d: string, n: number, avviso: boolean) => { const c = m.get(d); m.set(d, { n: (c?.n ?? 0) + n, avviso: (c?.avviso ?? false) || avviso }); };
    for (const [d, l] of voci) aggiungi(d, l.length, l.some((i) => i.rigida || isOverdue(i, oggi)));
    return m;
  }, [voci, oggi]);
  const [direzione, setDirezione] = useState<'avanti' | 'indietro' | ''>('');
  const vaiGiorno = (d: string) => { setDirezione(d > giorno ? 'avanti' : 'indietro'); setGiorno(d); };
  const navGiorno = (
    <div className="giorno-nav">
      <button onClick={() => vaiGiorno(addDays(giorno, -1))} aria-label="Giorno precedente">‹</button>
      <div className="giorno-nome">
        <button className="giorno-scelta" onClick={() => setMeseAperto(true)} aria-haspopup="dialog" aria-label="Scegli un altro giorno">
          <b>{giorno === oggi ? 'Oggi' : formatLong(giorno)}<i aria-hidden="true">▾</i></b>
          {giorno === oggi && <span>{formatLong(giorno)}</span>}
        </button>
        {giorno !== oggi && <button className="giorno-oggi" onClick={() => vaiGiorno(oggi)}>Torna a oggi</button>}
      </div>
      <button onClick={() => vaiGiorno(addDays(giorno, 1))} aria-label="Giorno successivo">›</button>
    </div>
  );
  // swipe orizzontale nella vista giorno: a sinistra il giorno dopo, a destra quello prima
  const inizioTocco = useRef<{ x: number; y: number } | null>(null);
  const tocco = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      const dentroScorrevole = (e.target as HTMLElement).closest('.scroll-x, input, textarea, select');
      inizioTocco.current = dentroScorrevole || meseAperto ? null : { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const i = inizioTocco.current;
      inizioTocco.current = null;
      if (!i) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - i.x;
      const dy = t.clientY - i.y;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) vaiGiorno(addDays(giorno, dx < 0 ? 1 : -1));
    },
  };

  const meta = (e: Entry) => {
    const i = e.item;
    const pezzi: string[] = [];
    if (e.padre) pezzi.push('prossimo passo');
    if (i.sforzoMin) pezzi.push(`${nomeTempo(i.sforzoMin)} ${percentuale(margine)}`);
    if (i.ricorrenza) pezzi.push(descriviRicorrenza(i.ricorrenza));
    return pezzi.join(' · ');
  };
  const destra = (e: Entry) => {
    const d = dueDate(e.item);
    if (!d) return null;
    const ritardo = daysOverdue(e.item, oggi);
    if (d === oggi) return null; // in Oggi la scadenza di oggi è già chiara
    if (ritardo > 0) return <span className="hard">{ritardo === 1 ? 'ieri' : `${ritardo} gg fa`}</span>;
    return e.item.rigida ? <span className="hard">{formatShortYear(d, oggi)}</span> : formatShortYear(d, oggi);
  };

  const routineFatte = v.routine.filter((r) => fattaOggi(r, oggi)).length;
  const routine = v.routine.length > 0 && (
    <Gruppo titolo="Routine di oggi" dettaglio={`${routineFatte} su ${v.routine.length}`}>
      <div className="chips" style={{ margin: '8px 0 12px' }}>
        {v.routine.map((r) => (
          <button key={r.id} className={clsx('chip', fattaOggi(r, oggi) && 'on')} onClick={() => segnaRoutine(r)} aria-pressed={fattaOggi(r, oggi)}>
            {fattaOggi(r, oggi) ? '✓ ' : ''}{r.titolo}{!fattaOggi(r, oggi) && r.obiettivo ? ` · ${r.obiettivo.toLowerCase()}` : ''}
          </button>
        ))}
      </div>
    </Gruppo>
  );

  const dovePianificata = (id: string) => piano?.giorni.flatMap((g) => g.blocchi).find((x) => x.item.id === id && !x.fisso);
  const nomeGiorno = (d: string) => (d === addDays(oggi, 1) ? 'domani' : formatLong(d).toLowerCase());
  // posizione in classifica dei blocchi del giorno mostrato (per priorità, gli impegni con orario fisso non contano)
  const classifica = new Map<string, number>(
    (piano?.giorni.find((x) => x.data === giorno)?.blocchi ?? [])
      .filter((x) => !x.fisso && !x.pausa)
      .sort((x, y) => score(y.item, oggi) - score(x.item, oggi))
      .map((x, n) => [x.item.id, n + 1] as [string, number]),
  );
  const bloccoRiga = (bl: NonNullable<typeof piano>['giorni'][number]['blocchi'][number]) => bl.pausa ? (
    <Row
      key={`${bl.item.id}-${bl.da}`}
      titolo={bl.item.titolo}
      ora={<>{orario(bl.da)}<small>{durata(bl.a - bl.da)}</small></>}
      meta="Pausa curiosità"
      check="square"
      light
      onCheck={() => completaVoce(bl.item)}
      selected={nav.openId === bl.item.id}
      onOpen={() => nav.push({ k: 'item', id: bl.item.id })}
    />
  ) : (
    <Row
      key={`${bl.item.id}-${bl.da}`}
      titolo={bl.item.titolo}
      ora={<>{orario(bl.da)}<small>{durata(bl.a - bl.da)}</small></>}
      meta={[bl.fisso ? 'impegno con orario' : undefined, bl.padre ? 'prossimo passo' : undefined, bl.parte ? `parte ${bl.parte.n} di ${bl.parte.di}` : undefined].filter(Boolean).join(' · ') || undefined}
      right={bl.inRitardo ? <span className="piano-avviso">oltre la scadenza</span> : destra({ item: bl.item, padre: bl.padre, punteggio: 0 })}
      level={barLevel(score(bl.item, oggi))}
      rank={bl.fisso ? undefined : classifica.get(bl.item.id)}
      onCheck={() => completaVoce(bl.item)}
      selected={nav.openId === bl.item.id}
      onOpen={() => nav.push({ k: 'item', id: bl.item.id })}
    />
  );

  /** Righe in ordine, con le attività dello stesso progetto riunite sotto la sua testata. */
  const raggruppate = <T extends { padre?: Item }>(voci: T[], riga: (v: T) => React.ReactNode) =>
    raggruppaPerProgetto(voci, items).map((g) => g.progetto
      ? <GruppoProgetto key={g.progetto.id} progetto={g.progetto} fatti={g.fatti} totale={g.totale}>{g.voci.map(riga)}</GruppoProgetto>
      : g.voci.map(riga));

  const pianoOggi = piano?.giorni[0];
  const totaleOggi = piano && disp ? minutiDisponibili(disp, oggi, oggi, minutoCorrente * 60000) : 0;
  const fuoriOggi = piano ? v.fare.filter((e) => { const d = dueDate(e.item); return d !== undefined && d <= oggi && !pianoOggi?.blocchi.some((x) => x.item.id === e.item.id); }) : [];

  const altroGiorno = (() => {
    const g = piano?.giorni.find((x) => x.data === giorno);
    const blocchi = g?.blocchi ?? [];
    const totale = disp ? minutiDisponibili(disp, giorno, oggi, minutoCorrente * 60000) : 0;
    const inBlocco = new Set(blocchi.map((x) => x.item.id));
    const resto = (voci.get(giorno) ?? []).filter((i) => !inBlocco.has(i.id)).sort((x, y) => score(y, oggi) - score(x, oggi));
    const passato = giorno < oggi;
    return (
      <>
        {!passato && g && (
          <Gruppo titolo={`Piano di ${giorno === addDays(oggi, 1) ? 'domani' : formatLong(giorno).toLowerCase()}`} dettaglio={totale ? `${durata(g.usati)} su ${durata(totale)}` : undefined}>
            {totale > 0 && <div className={clsx('piano-barra', g.usati >= totale && 'pieno')} aria-hidden="true"><i style={{ width: `${Math.min(100, (g.usati / totale) * 100)}%` }} /></div>}
            {blocchi.length === 0 && <div className="t2" style={{ padding: '14px 0' }}>{totale === 0 ? 'Nessun tempo libero impostato per questo giorno.' : 'Niente di pianificato.'}</div>}
            {raggruppate(blocchi, bloccoRiga)}
          </Gruppo>
        )}
        {resto.length > 0 && (
          <Gruppo titolo={passato ? 'Rimaste aperte' : 'Con scadenza questo giorno'} dettaglio={resto.length}>
            {resto.map((i) => (
              <Row key={i.id} titolo={i.titolo} light meta={i.tipo === 'esperienza' ? 'Esperienza' : (() => { const d = dovePianificata(i.id); return d ? `pianificata ${d.data === oggi ? 'oggi' : nomeGiorno(d.data)} alle ${orario(d.da)}` : undefined; })()}
                level={barLevel(score(i, oggi))} check={i.tipo === 'esperienza' ? 'square' : 'circle'}
                right={i.rigida || passato ? <span className="hard">{formatShortYear(dueDate(i)!, oggi)}</span> : undefined}
                onCheck={() => completaVoce(i)} selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
            ))}
          </Gruppo>
        )}
        {(passato || !g || !disp) && resto.length === 0 && <div className="t2" style={{ padding: '14px 0' }}>Niente in programma questo giorno.</div>}
        {!disp && !passato && (
          <button className="card tap" style={{ marginTop: 8 }} onClick={() => nav.push({ k: 'tempolibero' })}>
            <span><b>Imposta il tuo tempo libero</b><span className="t2" style={{ display: 'block' }}>Così MyTask distribuisce le attività nella giornata.</span></span>
            <span className="muted">›</span>
          </button>
        )}
      </>
    );
  })();

  const faroggi = (
    <>
      {piano && pianoOggi ? (
        <>
          <Gruppo titolo="Piano di oggi" dettaglio={totaleOggi ? `${durata(pianoOggi.usati)} su ${durata(totaleOggi)}` : undefined}>
            {totaleOggi > 0 && <div className={clsx('piano-barra', pianoOggi.usati >= totaleOggi && 'pieno')} aria-hidden="true"><i style={{ width: `${Math.min(100, (pianoOggi.usati / totaleOggi) * 100)}%` }} /></div>}
            {pianoOggi.blocchi.length === 0 && (
              <div className="t2" style={{ padding: '14px 0' }}>
                {totaleOggi === 0 && !pianoOggi.blocchi.length ? 'Oggi non hai tempo libero impostato (o la giornata è finita).' : 'Niente da pianificare per oggi.'}
              </div>
            )}
            {raggruppate(pianoOggi.blocchi, bloccoRiga)}
          </Gruppo>
          {fuoriOggi.length > 0 && (
            <Gruppo titolo="Non entrano oggi" dettaglio={fuoriOggi.length}>
              {fuoriOggi.map((e) => {
                const dove = dovePianificata(e.item.id);
                return (
                  <Row key={e.item.id} titolo={e.item.titolo} light
                    meta={dove ? `rimandata a ${nomeGiorno(dove.data)} alle ${orario(dove.da)}` : 'senza spazio nelle prossime due settimane'}
                    right={destra(e)} onCheck={() => completaVoce(e.item)} selected={nav.openId === e.item.id} onOpen={() => nav.push({ k: 'item', id: e.item.id })} />
                );
              })}
            </Gruppo>
          )}
          {piano.fuori.length > 0 && <div className="t2" style={{ padding: '10px 0' }}>{piano.fuori.length} {piano.fuori.length === 1 ? 'attività non entra' : 'attività non entrano'} nelle prossime due settimane: servono più fasce di tempo libero.</div>}
        </>
      ) : (
        <Gruppo titolo="Da fare oggi" dettaglio={v.fare.length || undefined}>
          <button className="card tap" style={{ marginTop: 8 }} onClick={() => nav.push({ k: 'tempolibero' })}>
            <span><b>Imposta il tuo tempo libero</b><span className="t2" style={{ display: 'block' }}>MyTask distribuirà le attività nella giornata in base a priorità e tempo disponibile.</span></span>
            <span className="muted">›</span>
          </button>
          {v.fare.length === 0 && <div className="t2" style={{ padding: '14px 0' }}>Niente di urgente. Puoi pescare qualcosa da «Attività» o «Intrattenimento».</div>}
          {raggruppate(v.fare, (e) => (
            <Row
              rank={v.fare.indexOf(e) + 1}
              key={e.item.id}
              titolo={e.item.titolo}
              meta={meta(e)}
              right={destra(e)}
              level={barLevel(e.punteggio)}
              onCheck={() => completaVoce(e.item)}
              selected={nav.openId === e.item.id}
              onOpen={() => nav.push({ k: 'item', id: e.item.id })}
            />
          ))}
        </Gruppo>
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

  useLayer('mese', meseAperto, () => setMeseAperto(false));
  const scegli = (d: string) => { setGiorno(d); setMeseAperto(false); };
  useEffect(() => {
    if (!meseAperto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMeseAperto(false); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [meseAperto]);
  const mese = meseAperto && (
    <>
      <div className="dim" onClick={() => setMeseAperto(false)} />
      <div className="sheet" role="dialog" aria-label="Scegli un giorno">
        <div className="grip" />
        <GrigliaMese key={giorno} giorno={giorno} oggi={oggi} segni={segni} onScegli={scegli} />
        <div className="btns">
          <button className="btn" onClick={() => setMeseAperto(false)}>Chiudi</button>
          {giorno !== oggi && <button className="btn solid" onClick={() => scegli(oggi)}>Torna a oggi</button>}
        </div>
      </div>
    </>
  );
  const eOggi = giorno === oggi;

  if (nav.wide) {
    return (
      <>
        <Top title="Oggi" sub={`${formatLong(oggi)} · ${v.routine.length} routine, ${v.fare.length} cose da fare`} />
        <div className="scroll wide-dash" {...tocco}>
          <div className="dash">
            <div>{navGiorno}<div key={giorno} className={clsx('giorno-cont', direzione)}>{eOggi ? faroggi : altroGiorno}</div></div>
            <div className="dash-side">
              {eOggi && routine}
              {revisione}
              {v.inbox > 0 && (
                <button className="card tap" onClick={() => nav.vai({ k: 'inbox' })}>
                  <span><span className="t2" style={{ display: 'block' }}>Inbox</span><b>{v.inbox} {v.inbox === 1 ? 'idea' : 'idee'} da smistare</b></span>
                  <span className="muted">›</span>
                </button>
              )}
            </div>
          </div>
        </div>
        {mese}
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
            <button className="circ" onClick={() => nav.push({ k: 'aspetto' })} aria-label="Stile e aspetto">
              <Icona nome="aspetto" size={22} />
            </button>
            <button className="circ" onClick={() => nav.push({ k: 'inbox' })} aria-label={`Inbox, ${v.inbox} da smistare`}>
              <Icona nome="inbox" size={22} />
              {v.inbox > 0 && <span className="circ-badge">{v.inbox > 99 ? '99+' : v.inbox}</span>}
            </button>
            <button className="circ" onClick={() => nav.push({ k: 'altro' })} aria-label="Altro: completato, persone, luoghi, impostazioni">
              <Icona nome="altro" size={22} />
            </button>
          </div>
        }
      />
      <div className="scroll" {...tocco}>
        {navGiorno}
        <div key={giorno} className={clsx('giorno-cont', direzione)}>
          {eOggi && routine}
          {eOggi ? faroggi : altroGiorno}
          {eOggi && revisione}
          {eOggi && stato}
        </div>
      </div>
      {mese}
      <Fab />
    </>
  );
}
