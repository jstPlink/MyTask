/**
 * Oggi: la schermata iniziale. Mostra un giorno alla volta (di base oggi): routine del giorno e piano.
 *
 * - Piano: se è impostato il tempo libero, `pianifica` distribuisce le attività in blocchi con ora e durata;
 *   la «linea a fasce» (`LineaPiano`) mostra le 24 ore con le fasce libere e, sotto, la fascia scelta
 *   con un segmento per attività. L'elenco sotto mostra solo i blocchi della fascia scelta, con le attività
 *   dello stesso progetto riunite sotto la sua testata. Senza tempo libero c'è la lista semplice «Da fare oggi»
 *   (`vistaOggi`) con l'invito a impostarlo.
 * - Giorni: le frecce, lo swipe orizzontale e il mese (si apre toccando il nome del giorno) cambiano giorno.
 *   Un giorno futuro mostra il suo piano (per quelli coperti dalla pianificazione) e le voci che vi scadono;
 *   un giorno passato le voci rimaste aperte. Routine, Inbox e stato di sincronizzazione solo su oggi.
 * - Telefono: titolo con i pulsanti tondi (Aspetto, Inbox, Altro) e «+» per la cattura. Da 900 px (`nav.wide`)
 *   la stessa colonna senza pulsanti né «+», che stanno nella barra laterale.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sistemaNumeri } from '../../../shared/linea.ts';
import type { Item } from '../../../shared/types.ts';
import { addDays, formatLong, formatShortYear } from '../../../shared/dates.ts';
import { ORA_CHIEDI_PREDEFINITA, fasceLibere, minuti, minutiDisponibili, orario, pianifica, type Blocco } from '../../../shared/piano.ts';
import { barLevel, dueDate, daysOverdue, isOpen, isOverdue, score, urgency } from '../../../shared/priority.ts';
import { classificaPriorita, raggruppaPerProgetto, vistaOggi, type Entry } from '../../../shared/views.ts';
import { fattaOggi } from '../../../shared/routine.ts';
import { descriviRicorrenza } from '../../../shared/recurrence.ts';
import { useDisponibilita, useItems, useMinuto, useOggi, useSyncStatus } from '../lib/hooks.ts';
import { segnaRoutine } from '../lib/actions.ts';
import { Fab, Sezione, GruppoProgetto, Icona, Row, Top } from '../ui/kit.tsx';
import { useLayer, useNav } from '../ui/nav.tsx';
import { clsx, nomeTempo } from '../lib/util.ts';
import { margineAtteso, percentuale } from '../../../shared/stima.ts';
import { GrigliaMese, type SegnoGiorno } from './Calendario.tsx';

// Il giorno scelto resta finché l'app è aperta (anche aprendo una voce e tornando indietro); undefined = oggi.
const scelta: { giorno: string | undefined } = { giorno: undefined };
// Tipi che compaiono nei giorni diversi da oggi quando hanno una scadenza in quel giorno.
const TIPI_DATATI = new Set(['azione', 'progetto', 'esperienza']);
const durata = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);

const pct = (m: number) => (m / 1440) * 100;
/** Fascia libera [inizio, fine] in minuti dalla mezzanotte. */
type Fascia = [number, number];

/** Diametro massimo dei pallini numerati sotto la barra della fascia (si rimpiccioliscono se sono tanti). */
const DIAMETRO_NUMERO = 24;

/**
 * Linea del piano: in alto le 24 ore (fasce libere cliccabili, attività, impegni fissi, ora attuale);
 * sotto gli orari della fascia scelta e la sua barra a segmenti, un segmento per attività colorato dalla
 * priorità (la parte chiara è il margine d'errore). Sotto la barra un pallino per attività col numero d'ordine
 * (la posizione in classifica), centrato sul suo segmento e distanziato dagli altri (`sistemaNumeri`).
 */
function LineaPiano({ blocchi, fasce, sel, onSel, ora, rank, oggi }: { blocchi: Blocco[]; fasce: Fascia[]; sel: number; onSel: (i: number) => void; ora?: number; rank: Map<string, number>; oggi: string }) {
  const contenitore = useRef<HTMLDivElement>(null);
  const [larghezza, setLarghezza] = useState(300);
  useLayoutEffect(() => {
    const e = contenitore.current;
    if (!e) return;
    const misura = () => setLarghezza((l) => (e.clientWidth && e.clientWidth !== l ? e.clientWidth : l));
    misura();
    const ro = new ResizeObserver(misura);
    ro.observe(e);
    return () => ro.disconnect();
  }); // a ogni disegno: il contenitore può essere un altro elemento dopo un cambio di giorno
  // I pallini si dispongono sulla larghezza reale del contenitore, quindi la si rimisura.
  if (!fasce.length) return null;
  const f = fasce[Math.max(0, Math.min(sel, fasce.length - 1))];
  const livello = (b: Blocco) => (b.pausa ? 'pausa' : `p${barLevel(b.punteggio ?? score(b.item, oggi))}`);
  const dentro = blocchi.filter((b) => !b.fisso && b.a > f[0] && b.da < f[1]);
  const q = (m: number) => ((Math.min(f[1], Math.max(f[0], m)) - f[0]) / (f[1] - f[0])) * 100;
  return (
    <div className="linea-piano">
      <div className="lp-24">
        {fasce.map(([x, y], i) => {
          const passata = ora !== undefined && y <= ora;
          return (
            <button key={`f${i}`} type="button" disabled={passata} aria-label={`Fascia libera ${orario(x)}-${orario(y)}`} aria-pressed={sel === i}
              className={clsx('lp-fascia', sel === i && 'sel', passata && 'passata')} style={{ left: `${pct(x)}%`, width: `${pct(y - x)}%` }} onClick={() => onSel(i)} />
          );
        })}
        {blocchi.map((b) => <i key={`${b.item.id}-${b.da}`} className={clsx('lp-blocco', b.fisso ? 'fisso' : livello(b))} style={{ left: `${pct(b.da)}%`, width: `${pct(b.a - b.da)}%` }} />)}
        {ora !== undefined && <i className="lp-ora" style={{ left: `${pct(ora)}%` }} />}
      </div>
      <div className="lp-ticks" aria-hidden="true">{[0, 6, 12, 18].map((h) => <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{h}</span>)}<span style={{ right: 0 }}>24</span></div>
      <div className="lp-orari"><span>{orario(f[0])}</span><span>{orario(f[1])}</span></div>
      <div className={clsx('lp-bs', ora !== undefined && ora >= f[0] && ora <= f[1] && 'con-ora')} role="img" aria-label={`Attività dalle ${orario(f[0])} alle ${orario(f[1])}`}>
        {ora !== undefined && ora >= f[0] && ora <= f[1] && (
          <>
            <i className="lp-bs-ora" style={{ left: `${q(ora)}%` }} aria-hidden="true" />
            <span className="lp-bs-tag" style={{ left: `${Math.min(88, Math.max(12, q(ora)))}%` }}>{orario(ora)}</span>
          </>
        )}
        {dentro.map((b) => (
          <i key={`${b.item.id}-${b.da}`} className={livello(b)} style={{ left: `${q(b.da)}%`, width: `calc(${q(b.a) - q(b.da)}% - 2px)` }} title={`${b.item.titolo} · ${durata(b.a - b.da)}${b.margineMin ? ` (di cui ${durata(b.margineMin)} di margine)` : ''}`}>
            {!!b.margineMin && <b className="lp-m" style={{ width: `${(b.margineMin / (b.a - b.da)) * 100}%` }} />}
          </i>
        ))}
      </div>
      <div className="lp-nr" ref={contenitore}>
        {(() => {
          const conNumero = dentro.filter((b) => rank.get(b.item.id));
          const centri = conNumero.map((b) => ((q(b.da) + q(b.a)) / 200) * larghezza);
          const { px, diametro } = sistemaNumeri(centri, larghezza, DIAMETRO_NUMERO);
          return (
            <div className="lp-nr-in" style={{ ['--d' as string]: `${diametro}px` }}>
              <svg className="lp-lg" width={larghezza} height="9" viewBox={`0 0 ${larghezza} 9`} aria-hidden="true">
                {conNumero.map((b, k) => (Math.abs(px[k] - centri[k]) > 2 ? <line key={`${b.item.id}-${b.da}`} x1={centri[k]} y1="0" x2={px[k]} y2="9" /> : null))}
              </svg>
              {conNumero.map((b, k) => (
                <span key={`${b.item.id}-${b.da}`} className={clsx('lp-n', livello(b))} style={{ left: `${px[k]}px` }}>{rank.get(b.item.id)}</span>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/** Schermata Oggi (vedi l'intestazione del file). */
export function Oggi() {
  const items = useItems();
  const oggi = useOggi();
  const sync = useSyncStatus();
  const nav = useNav();
  const v = useMemo(() => vistaOggi(items, oggi), [items, oggi]);
  const margine = useMemo(() => margineAtteso(items), [items]);
  const disp = useDisponibilita();
  const minutoCorrente = useMinuto();
  const piano = useMemo(() => (disp ? pianifica(items, disp, oggi, minutoCorrente * 60000, undefined, margine) : null), [items, disp, oggi, minutoCorrente, margine]);
  const [meseAperto, setMeseAperto] = useState(false);
  // Fascia libera scelta nella barra (per giorno); di default quella in corso o la prossima.
  // Per oggi le fasce già finite non sono selezionabili.
  const [fasciaScelta, setFasciaScelta] = useState<Record<string, number>>({});
  const minutiOra = new Date(minutoCorrente * 60000).getHours() * 60 + new Date(minutoCorrente * 60000).getMinutes();
  const fasceDi = (g: string): Fascia[] => (disp ? fasceLibere(disp, g) : []);
  const fasciaDi = (g: string, fasce: Fascia[]) => {
    if (!fasce.length) return -1;
    const passata = (i: number) => g === oggi && fasce[i][1] <= minutiOra;
    const s = fasciaScelta[g];
    if (s !== undefined && s < fasce.length && !passata(s)) return s;
    const i = fasce.findIndex((_, k) => !passata(k));
    return i >= 0 ? i : fasce.length - 1;
  };
  const inFascia = (bl: Blocco, f?: Fascia) => !f || (bl.da < f[1] && bl.a > f[0]);
  // Giorno mostrato: se l'app resta aperta oltre la mezzanotte un giorno passato non scelto di proposito torna a oggi.
  const [giornoScelto, setGiornoState] = useState<string>(scelta.giorno ?? oggi);
  const giorno = giornoScelto < oggi && giornoScelto !== scelta.giorno ? oggi : giornoScelto;
  const setGiorno = (d: string) => { scelta.giorno = d === oggi ? undefined : d; setGiornoState(d); };
  // Voci aperte con scadenza, per giorno: alimentano «Con scadenza questo giorno», «Rimaste aperte» e i pallini del mese.
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
  // Direzione dell'ultimo cambio di giorno: decide da che lato entra l'animazione.
  const [direzione, setDirezione] = useState<'avanti' | 'indietro' | ''>('');
  const vaiGiorno = (d: string) => { setDirezione(d > giorno ? 'avanti' : 'indietro'); setGiorno(d); };
  // Barra del giorno: frecce ai lati; il nome apre il mese, «Torna a oggi» compare lontano da oggi.
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
  // Swipe orizzontale: a sinistra il giorno dopo, a destra quello prima. Conta solo un gesto lungo e quasi
  // orizzontale; non parte su elenchi scorrevoli, campi di testo o con il mese aperto.
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

  // Riga grigia sotto il titolo nella lista semplice «Da fare oggi».
  const meta = (e: Entry) => {
    const i = e.item;
    const pezzi: string[] = [];
    if (e.padre) pezzi.push('prossimo passo');
    if (i.sforzoMin) pezzi.push(`${nomeTempo(i.sforzoMin)} ${percentuale(margine)}`);
    if (i.ricorrenza) pezzi.push(descriviRicorrenza(i.ricorrenza));
    return pezzi.join(' · ');
  };
  // Data a destra della riga: scadenza, o «ieri» / «N gg fa» se scaduta (arancio); per oggi niente.
  const destra = (e: Entry) => {
    const d = dueDate(e.item);
    if (!d) return null;
    const ritardo = daysOverdue(e.item, oggi);
    if (d === oggi) return null;
    if (ritardo > 0) return <span className="hard">{ritardo === 1 ? 'ieri' : `${ritardo} gg fa`}</span>;
    return e.item.rigida ? <span className="hard rigida">{formatShortYear(d, oggi)}</span> : formatShortYear(d, oggi);
  };

  // Routine del giorno come chip da spuntare (solo su oggi).
  const routineFatte = v.routine.filter((r) => fattaOggi(r, oggi)).length;
  const routine = v.routine.length > 0 && (
    <Sezione titolo="Routine di oggi" dettaglio={`${routineFatte} su ${v.routine.length}`}>
      <div className="chips" style={{ margin: '8px 0 12px' }}>
        {v.routine.map((r) => (
          <button key={r.id} className={clsx('chip', fattaOggi(r, oggi) && 'on')} onClick={() => segnaRoutine(r)} aria-pressed={fattaOggi(r, oggi)}>
            {fattaOggi(r, oggi) ? '✓ ' : ''}{r.titolo}{!fattaOggi(r, oggi) && r.obiettivo ? ` · ${r.obiettivo.toLowerCase()}` : ''}
          </button>
        ))}
      </div>
    </Sezione>
  );

  // Dove il piano ha messo una voce (per dire «pianificata domani alle 18:00» tra le voci con scadenza).
  const dovePianificata = (id: string) => piano?.giorni.flatMap((g) => g.blocchi).find((x) => x.item.id === id && !x.fisso);
  const nomeGiorno = (d: string) => (d === addDays(oggi, 1) ? 'domani' : formatLong(d).toLowerCase());
  // Numero d'ordine dei blocchi del giorno mostrato: posizione nella classifica di priorità di tutte le attività
  // (la stessa di Attività e della scheda); impegni con orario fisso e pause non hanno numero.
  const classificaGlobale = useMemo(() => classificaPriorita(items, oggi, minutoCorrente * 60000), [items, oggi, minutoCorrente]);
  const idBlocchi = new Set((piano?.giorni.find((x) => x.data === giorno)?.blocchi ?? []).filter((x) => !x.fisso && !x.pausa).map((x) => x.item.id));
  const classifica = new Map<string, number>([...classificaGlobale].filter(([id]) => idBlocchi.has(id)));
  // Riga di un blocco del piano: ora e durata a sinistra, poi titolo, dettagli (prossimo passo, parte N di M,
  // margine), scadenza o «scaduta» se il blocco finisce oltre la scadenza. La pausa curiosità ha un aspetto più leggero.
  const bloccoRiga = (bl: NonNullable<typeof piano>['giorni'][number]['blocchi'][number]) => bl.pausa ? (
    <Row
      key={`${bl.item.id}-${bl.da}`}
      titolo={bl.item.titolo} tipo={bl.item.tipo}
      ora={<>{orario(bl.da)}<small>{durata(bl.a - bl.da)}</small></>}
      meta="Pausa curiosità"
      check="square"
      light
      voce={bl.item}
      selected={nav.openId === bl.item.id}
      onOpen={() => nav.push({ k: 'item', id: bl.item.id })}
    />
  ) : (
    <Row
      key={`${bl.item.id}-${bl.da}`}
      titolo={bl.item.titolo} tipo={bl.item.tipo}
      ora={<>{orario(bl.da)}<small>{durata(bl.a - bl.da)}</small></>}
      meta={[bl.fisso ? 'impegno con orario' : undefined, bl.padre ? 'prossimo passo' : undefined, bl.parte ? `parte ${bl.parte.n} di ${bl.parte.di}` : undefined, bl.fisso || !bl.margineMin ? undefined : `${nomeTempo(bl.a - bl.da - bl.margineMin)} + ${nomeTempo(bl.margineMin)} di margine`].filter(Boolean).join(' · ') || undefined}
      right={bl.inRitardo ? <span className="piano-avviso">scaduta</span> : destra({ item: bl.item, padre: bl.padre, punteggio: 0 })}
      level={barLevel(bl.punteggio ?? score(bl.item, oggi))}
      rank={bl.fisso ? undefined : classifica.get(bl.item.id)}
      urgenza={urgency(bl.item, oggi)}
      voce={bl.item}
      selected={nav.openId === bl.item.id}
      onOpen={() => nav.push({ k: 'item', id: bl.item.id })}
    />
  );

  /** Righe in ordine, con le attività dello stesso progetto riunite sotto la sua testata (toccandola si apre il progetto). */
  const raggruppate = <T extends { padre?: Item }>(voci: T[], riga: (v: T) => React.ReactNode) =>
    raggruppaPerProgetto(voci, items).map((g) => g.progetto
      ? <GruppoProgetto key={g.progetto.id} progetto={g.progetto} fatti={g.fatti} totale={g.totale}>{g.voci.map(riga)}</GruppoProgetto>
      : g.voci.map(riga));

  const pianoOggi = piano?.giorni[0];
  const fasceOggi = fasceDi(oggi);
  const selOggi = fasciaDi(oggi, fasceOggi);
  const totaleOggi = piano && disp ? minutiDisponibili(disp, oggi, oggi, minutoCorrente * 60000) : 0;

  // Giorno diverso da oggi: piano del giorno (solo se futuro e coperto dalla pianificazione) e voci con scadenza
  // in quel giorno non già nel piano; per un giorno passato, le voci rimaste aperte.
  const altroGiorno = (() => {
    const g = piano?.giorni.find((x) => x.data === giorno);
    const blocchi = g?.blocchi ?? [];
    const totale = disp ? minutiDisponibili(disp, giorno, oggi, minutoCorrente * 60000) : 0;
    const inBlocco = new Set(blocchi.map((x) => x.item.id));
    const resto = (voci.get(giorno) ?? []).filter((i) => !inBlocco.has(i.id)).sort((x, y) => score(y, oggi) - score(x, oggi));
    const passato = giorno < oggi;
    const fasceG = fasceDi(giorno);
    const selG = fasciaDi(giorno, fasceG);
    const blocchiG = blocchi.filter((x) => inFascia(x, fasceG[selG]));
    return (
      <>
        {!passato && g && (
          <Sezione titolo={`Piano di ${nomeGiorno(giorno)}`}>
            <LineaPiano blocchi={blocchi} fasce={fasceG} sel={selG} onSel={(i) => setFasciaScelta((c) => ({ ...c, [giorno]: i }))} rank={classifica} oggi={oggi} />
            {blocchi.length === 0 && <div className="t2" style={{ padding: '14px 0' }}>{totale === 0 ? 'Nessun tempo libero impostato per questo giorno.' : 'Niente di pianificato.'}</div>}
            {raggruppate(blocchiG, bloccoRiga)}
          </Sezione>
        )}
        {resto.length > 0 && (
          <Sezione titolo={passato ? 'Rimaste aperte' : 'Con scadenza questo giorno'} dettaglio={resto.length}>
            {resto.map((i) => (
              <Row key={i.id} titolo={i.titolo} tipo={i.tipo} light meta={i.tipo === 'esperienza' ? 'Esperienza' : (() => { const d = dovePianificata(i.id); return d ? `pianificata ${d.data === oggi ? 'oggi' : nomeGiorno(d.data)} alle ${orario(d.da)}` : undefined; })()}
                level={barLevel(score(i, oggi))} check={i.tipo === 'esperienza' ? 'square' : 'circle'}
                right={i.rigida || passato ? <span className={clsx('hard', i.rigida && 'rigida')}>{formatShortYear(dueDate(i)!, oggi)}</span> : undefined}
                voce={i} selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
            ))}
          </Sezione>
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

  // Modalità «orari flessibili»: se oggi non ha orari chiede quando si è liberi; per domani lo chiede dopo l'ora scelta.
  const domani = addDays(oggi, 1);
  const chiediDomani = !!disp?.flessibile && !disp.eccezioni?.[domani] && minutiOra >= minuti(disp.oraChiedi ?? ORA_CHIEDI_PREDEFINITA);
  const chiediOggi = !!disp?.flessibile && !disp.eccezioni?.[oggi];
  const chiediOrari = (giorno: string, nome: string) => (
    <button className="card tap" style={{ marginBottom: 10 }} onClick={() => nav.push({ k: 'orari', giorno })}>
      <span><b>Quando sei libero {nome}?</b><span className="t2" style={{ display: 'block' }}>Inserisci gli orari e preparo il calendario.</span></span>
      <span className="muted">›</span>
    </button>
  );

  // Contenuto di oggi: inviti a inserire gli orari (modalità flessibile), poi il piano con la linea a fasce oppure,
  // senza tempo libero impostato, la lista semplice «Da fare oggi».
  const faroggi = (
    <>
      {chiediOggi && chiediOrari(oggi, 'oggi')}
      {chiediDomani && chiediOrari(domani, 'domani')}
      {piano && pianoOggi ? (
        <Sezione titolo="Piano di oggi">
          <LineaPiano blocchi={pianoOggi.blocchi} fasce={fasceOggi} sel={selOggi} onSel={(i) => setFasciaScelta((c) => ({ ...c, [oggi]: i }))} ora={minutiOra} rank={classifica} oggi={oggi} />
          {pianoOggi.blocchi.length === 0 && (
            <div className="t2" style={{ padding: '14px 0' }}>
              {totaleOggi === 0 ? 'Oggi non hai tempo libero impostato (o la giornata è finita).' : 'Niente da pianificare per oggi.'}
            </div>
          )}
          {raggruppate(pianoOggi.blocchi.filter((x) => inFascia(x, fasceOggi[selOggi])), bloccoRiga)}
        </Sezione>
      ) : (
        <Sezione titolo="Da fare oggi" dettaglio={v.fare.length || undefined}>
          <button className="card tap" style={{ marginTop: 8 }} onClick={() => nav.push({ k: 'tempolibero' })}>
            <span><b>Imposta il tuo tempo libero</b><span className="t2" style={{ display: 'block' }}>MyTask distribuirà le attività nella giornata in base a priorità e tempo disponibile.</span></span>
            <span className="muted">›</span>
          </button>
          {v.fare.length === 0 && <div className="t2" style={{ padding: '14px 0' }}>Niente di urgente. Puoi pescare qualcosa da «Attività» o «Intrattenimento».</div>}
          {raggruppate(v.fare, (e) => (
            <Row
              rank={v.fare.indexOf(e) + 1}
              urgenza={urgency(e.item, oggi)}
              key={e.item.id}
              titolo={e.item.titolo} tipo={e.item.tipo}
              meta={meta(e)}
              right={destra(e)}
              level={barLevel(e.punteggio)}
              voce={e.item}
              selected={nav.openId === e.item.id}
              onOpen={() => nav.push({ k: 'item', id: e.item.id })}
            />
          ))}
        </Sezione>
      )}
    </>
  );

  // Stato di sincronizzazione: sul telefono solo se si è offline o ci sono modifiche in attesa
  // (sul sito è sempre nella barra laterale, quindi qui non viene mostrato).
  const stato = sync.online && !sync.inAttesa ? null : (
    <div style={{ textAlign: 'center', marginTop: 18 }}>
      <span className={clsx('pill-sync', !sync.online && 'off')}>
        {!sync.online ? 'Offline' : sync.inAttesa ? `${sync.inAttesa} da sincronizzare` : 'Sincronizzato'}
      </span>
    </div>
  );

  // Mese in un foglio (telefono) o finestra (sito): è un livello della pila «Indietro» e si chiude anche con Esc.
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

  // Sito largo: titolo con il riepilogo, una sola colonna centrata; il gesto di swipe vale anche qui.
  if (nav.wide) {
    return (
      <>
        <Top title="Oggi" sub={`${formatLong(oggi)} · ${v.routine.length} routine, ${v.fare.length} cose da fare`} />
        <div className="scroll wide-dash" {...tocco}>
          <div className="dash">
            <div>{navGiorno}<div key={giorno} className={clsx('giorno-cont', direzione)}>{eOggi && routine}{eOggi ? faroggi : altroGiorno}</div></div>
          </div>
        </div>
        {mese}
      </>
    );
  }

  // Telefono: titolo con i pulsanti tondi, giorno, contenuto e pulsante «+».
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
            <button className="circ" onClick={() => nav.push({ k: 'altro' })} aria-label="Altro: completato, impostazioni">
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
          {eOggi && stato}
        </div>
      </div>
      {mese}
      <Fab />
    </>
  );
}
