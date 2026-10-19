/**
 * Attività (scheda «Fare»): quattro sotto-schede scelte dal selettore in cima (sul sito largo le sostituisce
 * la barra laterale, che porta alla stessa sotto-scheda) e, sul telefono, una ricerca che vale per tutte (sul sito c'è la ricerca generale).
 *
 * - Tutte le attività: tutte le attività aperte in ordine di priorità, con i passi di uno stesso progetto
 *   riuniti sotto la sua testata; sotto, le esperienze.
 * - Progetti: un gruppo per progetto con tutti i suoi passi (aperti per priorità, poi i chiusi barrati).
 * - Esperienze: un'unica lista con quattro ordini (Data, Luogo, Interesse, Per te).
 * - Game design: le idee di videogiochi, per priorità (interesse, tempo stimato, difficoltà).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatShortYear } from '../../../shared/dates.ts';
import type { Item } from '../../../shared/types.ts';
import { barLevel, dueDate, isOverdue, score, urgency, withInheritance } from '../../../shared/priority.ts';
import { cercaVoci, classificaPriorita, figli, listaAzioni, listaEsperienze, listaProgetti, raggruppaPerProgetto } from '../../../shared/views.ts';
import { listaGameDesign } from '../../../shared/gamedesign.ts';
import { ordinaPerTe } from '../../../shared/esperienze.ts';
import { chiediPosizione, posizioneRecente, posizioneSalvata, type EsitoPosizione, type Posizione } from '../lib/posizione.ts';
import { cercaLuoghi, coordinateNote, leggiCacheLuoghi, luoghiDaCercare } from '../lib/luoghi.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { Cerca, Empty, Fab, GruppoProgetto, Row, Seg, Sezione, Top, unisciMeta } from '../ui/kit.tsx';
import { PulsanteAspetto } from '../ui/PulsanteAspetto.tsx';
import { useNav, type SubFare } from '../ui/nav.tsx';
import { clsx, mapsUrl, nomeGiorniOre, nomeTempo } from '../lib/util.ts';

const SUB: { id: SubFare; nome: string }[] = [
  { id: 'azioni', nome: 'Tutte le attività' }, { id: 'progetti', nome: 'Progetti' }, { id: 'esperienze', nome: 'Esperienze' }, { id: 'gamedesign', nome: 'Game design' },
];

/** Scheda Attività: intestazione con i conteggi, selettore delle sotto-schede, ricerca e la lista scelta. */
export function Fare() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const nAttivita = useMemo(() => listaAzioni(items, oggi).length, [items, oggi]);
  const nProgetti = useMemo(() => listaProgetti(items, oggi).length, [items, oggi]);
  const [q, setQ] = useState('');
  // Id delle note che contengono tutte le parole cercate (titolo, note e campi di testo); null = nessuna ricerca.
  // Lo stesso filtro vale per la sotto-scheda aperta.
  const filtro = useMemo(() => (q.trim() ? new Set(cercaVoci(items, q, 5000).map((i) => i.id)) : null), [items, q]);
  // Esperienze aperte: con data più quelle senza data (raggruppate per luogo da `listaEsperienze`).
  const nEsperienze = useMemo(() => { const v = listaEsperienze(items); return v.conData.length + v.perZona.reduce((n, [, l]) => n + l.length, 0); }, [items]);

  return (
    <>
      <Top title="Attività" sub={`${nAttivita} attività · ${nProgetti} ${nProgetti === 1 ? 'progetto' : 'progetti'} · ${nEsperienze} ${nEsperienze === 1 ? 'esperienza' : 'esperienze'}`} right={<PulsanteAspetto />} />
      <div className="scroll">
        <Seg nav compatto voci={SUB} attivo={nav.fareSub} onChange={nav.setFareSub} />
        {!nav.wide && <Cerca valore={q} onChange={setQ} placeholder="Cerca nelle attività" />}
        {nav.fareSub === 'azioni' && <Azioni filtro={filtro} />}
        {nav.fareSub === 'progetti' && <Progetti filtro={filtro} />}
        {nav.fareSub === 'esperienze' && <Esperienze filtro={filtro} />}
        {nav.fareSub === 'gamedesign' && <GameDesign filtro={filtro} />}
      </div>
      <Fab />
    </>
  );
}

/** Id ammessi dalla ricerca, o null se non si sta cercando. */
type Filtro = Set<string> | null;
const NESSUN_RISULTATO = 'Nessun risultato: prova con altre parole.';

/** Idee di videogiochi (tipo «Game design») in ordine di priorità: interesse (peso maggiore), tempo stimato e difficoltà. Non hanno scadenza e non finiscono in Oggi. */
function GameDesign({ filtro }: { filtro: Filtro }) {
  const nav = useNav();
  const items = useItems();
  const tutte = useMemo(() => listaGameDesign(items), [items]);
  const lista = useMemo(() => (filtro ? tutte.filter((e) => filtro.has(e.item.id)) : tutte), [tutte, filtro]);
  if (lista.length === 0) return <Empty>{filtro ? NESSUN_RISULTATO : 'Nessuna idea di gioco. Scrivi una nota con il pulsante + e scegli il tipo «Game design».'}</Empty>;
  return (
    <Sezione titolo="Idee di gioco" dettaglio={lista.length}>
      {lista.map(({ item: i, punteggio }) => (
        <Row key={i.id} titolo={i.titolo} tipo="gamedesign"
          meta={[i.sforzoMin ? nomeTempo(i.sforzoMin) : undefined, i.difficolta ? `difficoltà ${i.difficolta}/5` : undefined, `priorità ${Math.round(punteggio)}`].filter(Boolean).join(' · ')}
          interesse={i.interesse ?? 3} check="square" centrato voce={i}
          selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
      ))}
    </Sezione>
  );
}

/** Tutte le attività aperte in ordine di priorità; il numero nel pallino è la posizione nella classifica completa, anche con la ricerca attiva. */
function Azioni({ filtro }: { filtro: Filtro }) {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const completa = useMemo(() => listaAzioni(items, oggi), [items, oggi]);
  const classifica = useMemo(() => classificaPriorita(items, oggi), [items, oggi]);
  const lista = useMemo(() => (filtro ? completa.filter((e) => filtro.has(e.item.id)) : completa), [completa, filtro]);
  const gruppi = useMemo(() => raggruppaPerProgetto(lista, items), [lista, items]);
  // accanto al conteggio, quanto tempo (in giorni e ore) serve per completare tutte le attività mostrate (somma dei tempi stimati, passi dei progetti compresi)
  const dettaglio = useMemo(() => {
    const minuti = lista.reduce((s, e) => s + (e.item.sforzoMin ?? 0), 0);
    const senza = lista.filter((e) => !e.item.sforzoMin).length;
    if (minuti <= 0) return lista.length;
    return `${lista.length} · ${nomeGiorniOre(minuti)}${senza ? `, ${senza} senza stima` : ''}`;
  }, [lista]);
  const riga = ({ item, punteggio }: (typeof lista)[number]) => {
    const d = dueDate(item);
    const scaduta = isOverdue(item, oggi);
    return (
      <Row
        key={item.id}
        titolo={item.titolo} tipo={item.tipo}
        meta={item.stato === 'parcheggiato' ? 'Parcheggiato' : unisciMeta([item.stato === 'in_corso' ? 'In corso' : undefined, item.sforzoMin ? nomeTempo(item.sforzoMin) : undefined])}
        right={d ? (item.rigida || scaduta ? <span className={clsx('hard', item.rigida && 'rigida')}>{formatShortYear(d, oggi)}</span> : formatShortYear(d, oggi)) : null}
        level={item.stato === 'parcheggiato' ? 1 : barLevel(punteggio)}
        rank={classifica.get(item.id)}
        urgenza={urgency(item, oggi)}
        light={item.stato === 'parcheggiato'}
        voce={item}
        selected={nav.openId === item.id} onOpen={() => nav.push({ k: 'item', id: item.id })}
      />
    );
  };
  return (
    <>
      {lista.length === 0 && <Empty>{filtro ? NESSUN_RISULTATO : 'Nessuna attività aperta.'}</Empty>}
      {lista.length > 0 && (
        <Sezione titolo="Tutte le attività" dettaglio={dettaglio}>
          {gruppi.map((g) => g.progetto
            ? <GruppoProgetto key={g.progetto.id} progetto={g.progetto} fatti={g.fatti} totale={g.totale}>{g.voci.map(riga)}</GruppoProgetto>
            : g.voci.map(riga))}
        </Sezione>
      )}
      <RigheEsperienze titolo filtro={filtro} />
    </>
  );
}

/** Un gruppo per progetto attivo, con avanzamento e passi. */
function Progetti({ filtro }: { filtro: Filtro }) {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const completa = useMemo(() => listaProgetti(items, oggi), [items, oggi]);
  // con una ricerca restano i progetti che corrispondono o che hanno un passo che corrisponde
  const lista = useMemo(
    () => (filtro ? completa.filter((p) => filtro.has(p.progetto.id) || figli(items, p.progetto.id).some((c) => filtro.has(c.id))) : completa),
    [completa, filtro, items],
  );
  if (lista.length === 0) return <Empty>{filtro ? NESSUN_RISULTATO : 'Nessun progetto attivo.'}</Empty>;
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
          voce={c}
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
  return <Sezione titolo="Progetti" dettaglio={lista.length}>{lista.map(gruppo)}</Sezione>;
}

/** Sotto-scheda Esperienze (la lista vera è `RigheEsperienze`). */
function Esperienze({ filtro }: { filtro: Filtro }) {
  const items = useItems();
  const oggi = useOggi();
  const v = useMemo(() => listaEsperienze(items), [items]);
  if (v.conData.length + v.perZona.length === 0) return <Empty>Nessuna esperienza in lista.</Empty>;
  return <RigheEsperienze filtro={filtro} />;
}

// Ordine scelto per le esperienze, ricordato su questo dispositivo.
type OrdineEsperienze = 'data' | 'luogo' | 'interesse' | 'perte';
const CHIAVE_ORDINE = 'mytask.esperienze.ordine';
const leggiOrdine = (): OrdineEsperienze => { try { const v = localStorage.getItem(CHIAVE_ORDINE); return v === 'luogo' || v === 'interesse' || v === 'perte' ? v : 'data'; } catch { return 'data'; } };

/**
 * Esperienze, ordinabili per data (di base: «Con data» poi «Senza data»), luogo (una sezione per luogo),
 * interesse o «Per te» (punteggio che unisce interesse, data più vicina e distanza dalla posizione del telefono).
 * Con `titolo` sono invece una sola sezione in fondo a «Tutte le attività», senza selettore dell'ordine.
 */
function RigheEsperienze({ titolo, filtro }: { titolo?: boolean; filtro?: Filtro }) {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const [ordine, setOrdine] = useState<OrdineEsperienze>(leggiOrdine);
  const cambiaOrdine = (o: OrdineEsperienze) => { setOrdine(o); try { localStorage.setItem(CHIAVE_ORDINE, o); } catch { /* ignora */ } };
  const v = useMemo(() => listaEsperienze(items), [items]);
  const senzaData = useMemo(
    () => v.perZona.flatMap(([, l]) => l).sort((a, b) => (b.interesse ?? 3) - (a.interesse ?? 3) || a.titolo.localeCompare(b.titolo, 'it')),
    [v],
  );
  const tutte = useMemo(() => [...v.conData, ...senzaData].filter((i) => !filtro || filtro.has(i.id)), [v, senzaData, filtro]);
  // «Per te»: posizione del telefono (resta sul dispositivo) e coordinate dei luoghi, cercate una volta sola e ricordate.
  const [pos, setPos] = useState<Posizione | undefined>(posizioneSalvata);
  const [esitoPos, setEsitoPos] = useState<EsitoPosizione | 'attesa' | undefined>();
  const [cacheLuoghi, setCacheLuoghi] = useState(leggiCacheLuoghi);
  const aggiornaPosizione = () => {
    setEsitoPos('attesa');
    void chiediPosizione().then((r) => { setEsitoPos(r.esito); if (r.posizione) setPos(r.posizione); });
  };
  useEffect(() => {
    if (ordine !== 'perte') return;
    let attivo = true;
    if (!posizioneRecente(pos)) {
      setEsitoPos('attesa');
      void chiediPosizione().then((r) => { if (!attivo) return; setEsitoPos(r.esito); if (r.posizione) setPos(r.posizione); });
    }
    const daCercare = luoghiDaCercare(tutte, cacheLuoghi);
    const ricerca = daCercare.length ? cercaLuoghi(daCercare, (nuova) => { if (attivo) setCacheLuoghi({ ...nuova }); }) : undefined;
    return () => { attivo = false; ricerca?.ferma(); };
  }, [ordine, tutte.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // La ricerca senza risultati lo dice solo nella sotto-scheda Esperienze, non in fondo a Tutte le attività.
  if (tutte.length === 0) return filtro && !titolo ? <Empty>{NESSUN_RISULTATO}</Empty> : null;
  const riga = (i: Item, km?: number) => (
    <Row key={i.id} titolo={i.titolo} tipo={i.tipo} meta={[i.oraInizio, ordine !== 'luogo' ? i.zona : undefined, km !== undefined ? `a ${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km` : undefined].filter(Boolean).join(' · ') || undefined} interesse={i.interesse ?? 3}
      light={!dueDate(i)}
      right={dueDate(i)
        ? (i.rigida ? <span className="hard rigida">{formatShortYear(dueDate(i)!, oggi)}</span> : formatShortYear(dueDate(i)!, oggi))
        : <a href={i.linkMaps ?? mapsUrl(i.titolo, i.zona)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Maps ›</a>}
      voce={i} selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
  );
  // In «Tutte le attività» le esperienze sono una sola sezione, prima quelle con data.
  const conDataF = v.conData.filter((i) => !filtro || filtro.has(i.id));
  const senzaDataF = senzaData.filter((i) => !filtro || filtro.has(i.id));
  if (titolo) return <Sezione titolo="Esperienze" dettaglio={tutte.length}>{conDataF.map(riga)}{senzaDataF.map(riga)}</Sezione>;
  const perData = (a: Item, b: Item) => (dueDate(a) ?? '9999').localeCompare(dueDate(b) ?? '9999') || (b.interesse ?? 3) - (a.interesse ?? 3);
  let corpo: ReactNode;
  if (ordine === 'luogo') {
    const gruppi = new Map<string, Item[]>();
    for (const i of tutte) { const z = i.zona?.trim() || 'Senza luogo'; gruppi.set(z, [...(gruppi.get(z) ?? []), i]); }
    const elenco = [...gruppi.entries()].sort((a, b) => (a[0] === 'Senza luogo' ? 1 : b[0] === 'Senza luogo' ? -1 : a[0].localeCompare(b[0], 'it')));
    corpo = elenco.map(([z, l]) => <Sezione key={z} titolo={z} dettaglio={l.length}>{[...l].sort(perData).map(riga)}</Sezione>);
  } else if (ordine === 'perte') {
    const ordinate = ordinaPerTe(tutte, oggi, pos, (i) => coordinateNote(i, cacheLuoghi));
    const senzaLuogo = pos ? ordinate.filter((e) => e.km === undefined).length : 0;
    const stato = esitoPos === 'attesa' && !posizioneRecente(pos) ? 'Cerco la tua posizione…'
      : esitoPos === 'negata' && !pos ? 'Posizione non concessa: ordino per interesse e data. Puoi consentirla dalle impostazioni del telefono.'
      : esitoPos === 'non_disponibile' && !pos ? 'Posizione non disponibile: ordino per interesse e data.'
      : pos ? `Ordinate per interesse, data più vicina e distanza da te${senzaLuogo ? ` · ${senzaLuogo} senza luogo trovato` : ''}.`
      : 'Ordinate per interesse e data più vicina.';
    corpo = (
      <>
        <div className="t2 perte-info">{stato} <button type="button" className="chip" onClick={aggiornaPosizione}>Aggiorna posizione</button></div>
        <Sezione titolo="Per te" dettaglio={ordinate.length}>{ordinate.map((e) => riga(e.item, e.km))}</Sezione>
      </>
    );
  } else if (ordine === 'interesse') {
    corpo = <Sezione titolo="Per interesse" dettaglio={tutte.length}>{[...tutte].sort((a, b) => (b.interesse ?? 3) - (a.interesse ?? 3) || perData(a, b)).map(riga)}</Sezione>;
  } else {
    corpo = (
      <>
        {conDataF.length > 0 && <Sezione titolo="Con data" dettaglio={conDataF.length}>{conDataF.map(riga)}</Sezione>}
        {senzaDataF.length > 0 && <Sezione titolo="Senza data" dettaglio={senzaDataF.length}>{senzaDataF.map(riga)}</Sezione>}
      </>
    );
  }
  return (
    <>
      <Seg<OrdineEsperienze> uguali voci={[{ id: 'data', nome: 'Data' }, { id: 'luogo', nome: 'Luogo' }, { id: 'interesse', nome: 'Interesse' }, { id: 'perte', nome: 'Per te' }]} attivo={ordine} onChange={cambiaOrdine} />
      {corpo}
    </>
  );
}
