/**
 * Priorità (la scheda `oggi`, prima «Oggi»): la schermata iniziale. In cima il blocco del cronometro, poi
 * le routine del giorno e le «Prime attività»: le cose da fare in ordine di priorità
 * (`vistaOggi`: le 5 con la posizione migliore nella classifica unica, anche con scadenza futura, più le scadute o in scadenza oggi che restassero fuori).
 *
 * - Blocco del cronometro: senza nota in corso solo «Nessuna nota in corso»; con una nota in corso (una sola alla volta) la nota, la barra del
 *   tempo sempre visibile e, mentre il cronometro corre, il timer grande accanto al tasto ▶/⏸ (`iniziaLavoro`, `mettiInPausa`, `riprendi`).
 *   Le altre note mostrano il tempo già lavorato accanto alla casella. Spuntando la casella di una nota la si completa e il cronometro passa al successivo.
 * - Tocco su una riga: apre sempre la scheda della nota (niente menu).
 * - Le attività dello stesso progetto sono riunite sotto la testata del progetto, il numero è la posizione in classifica.
 * - «Curiosità»: dopo le attività, al massimo cinque curiosità (le più interessanti, a parità le più vecchie), senza posizione
 *   in classifica; la casella le segna come approfondite e toccando la riga si apre la nota.
 * - Telefono: titolo con i pulsanti tondi (Aspetto, Inbox, Altro) e «+» per la cattura. Da 900 px (`nav.wide`) la stessa
 *   colonna senza pulsanti né «+», che stanno nella barra laterale.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Item } from '../../../shared/types.ts';
import { formatLong, formatShortYear } from '../../../shared/dates.ts';
import { livelloPriorita, dueDate, daysOverdue, intensitaBattito } from '../../../shared/priority.ts';
import { classificaPriorita, raggruppaPerProgetto, vistaOggi, type Entry } from '../../../shared/views.ts';
import { fattaOggi } from '../../../shared/routine.ts';
import { descriviRicorrenza } from '../../../shared/recurrence.ts';
import { formatoCronometro, notaInCorso } from '../../../shared/sessione.ts';
import { useAdesso, useItems, useOggi, useSessione, useSyncStatus } from '../lib/hooks.ts';
import { segnaRoutine, statoVisto } from '../lib/actions.ts';
import { iniziaLavoro, mettiInPausa, riprendi, tempoDi } from '../lib/sessione.ts';
import { Fab, Sezione, GruppoProgetto, Icona, Margine, Row, Top, unisciMeta } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';
import { margineAtteso, percentuale, stimeMisurate, tempoAtteso } from '../../../shared/stima.ts';
import { avanzamentoTempo, clsx, durataLavoro, nomeGiorniOre, nomeTempo } from '../lib/util.ts';

/** Schermata Oggi (vedi l'intestazione del file). */
export function Oggi() {
  const items = useItems();
  const oggi = useOggi();
  const sync = useSyncStatus();
  const nav = useNav();
  const sessione = useSessione();
  const lavoro = sessione.stato === 'lavoro';
  const adesso = useAdesso(lavoro);
  const v = useMemo(() => vistaOggi(items, oggi), [items, oggi]);
  const margine = useMemo(() => margineAtteso(items), [items]);
  const nMisurate = useMemo(() => stimeMisurate(items), [items]);
  const classifica = useMemo(() => classificaPriorita(items, oggi), [items, oggi]); // la posizione è quella unica, uguale in ogni schermata

  const task = sessione.taskId ? items.find((i) => i.id === sessione.taskId) : undefined;

  // La nota del blocco in alto: quella su cui corre il cronometro, altrimenti l'unica nota «in corso».
  const notaBlocco = sessione.stato !== 'ferma' ? task : notaInCorso(items);

  // Riga grigia sotto il titolo: prossimo passo di un progetto, tempo stimato, ricorrenza.
  const meta = (e: Entry) => {
    const i = e.item;
    const pezzi: ReactNode[] = [];
    if (e.padre) pezzi.push('prossimo passo');
    if (i.sforzoMin) pezzi.push(nomeTempo(i.sforzoMin));
    if (i.ricorrenza) pezzi.push(descriviRicorrenza(i.ricorrenza));
    return unisciMeta(pezzi);
  };
  // Parte destra della riga: la scadenza (o «ieri» / «N gg fa» se scaduta, in arancio) e, accanto alla casella, il tempo già lavorato
  // sulla nota (non su quella attiva, che ha il suo blocco in alto).
  const destra = (e: Entry) => {
    const ms = tempoDi(e.item, adesso);
    const tempo = notaBlocco?.id !== e.item.id && ms >= 1000 ? <span className="tempo-riga">{formatoCronometro(ms)}</span> : null;
    const d = dueDate(e.item);
    let data: ReactNode = null;
    if (d && d !== oggi) {
      const ritardo = daysOverdue(e.item, oggi);
      data = ritardo > 0 ? <span className="hard">{ritardo === 1 ? 'ieri' : `${ritardo} gg fa`}</span> : formatShortYear(d, oggi);
    }
    return data || tempo ? <span className="dx-riga">{data}{tempo}</span> : null;
  };

  // Blocco del cronometro: senza nota in corso solo lo stato; con una nota in corso compaiono la nota e, sotto, la barra del tempo
  // (sempre visibile); mentre il cronometro corre, il timer grande scorre accanto al tasto.
  const tempoBlocco = notaBlocco ? tempoDi(notaBlocco, adesso) : 0;
  const rankBlocco = notaBlocco ? classifica.get(notaBlocco.id) : undefined;
  const quotaBlocco = notaBlocco?.sforzoMin ? Math.min(1, tempoBlocco / (notaBlocco.sforzoMin * 60_000)) : undefined;
  const premi = () => { if (!notaBlocco) return; if (lavoro) mettiInPausa(); else if (sessione.stato === 'pausa') riprendi(); else iniziaLavoro(notaBlocco.id); };
  const lavora = !notaBlocco ? (
    // Senza nota in corso il blocco ha la stessa altezza di quando c'è: le stesse parti, nascoste (`fantasma`), tengono lo spazio.
    <div className="blocco vuoto">
      <div className="blk-hd"><span className="blk-e">Nessuna nota in corso</span><span className="blk-dx fantasma" aria-hidden="true"><span className="blk-pl" /></span></div>
      <div className="blk-nota fantasma" aria-hidden="true"><span className="blk-rk" /><span className="blk-t"><b>&nbsp;</b><small>&nbsp;</small></span><span className="cb" /></div>
      <div className="blk-sotto fantasma" aria-hidden="true"><div className="blk-tt"><b>&nbsp;</b></div><div className="blk-barra" /></div>
    </div>
  ) : (
    <div className={clsx('blocco', lavoro && 'corre')}>
      <div className="blk-hd">
        <span className="blk-e">In corso</span>
        <span className="blk-dx">
          {lavoro && <span className="blk-tm">{formatoCronometro(tempoBlocco)}</span>}
          <button className="blk-pl" onClick={premi} aria-label={lavoro ? 'Metti in pausa' : 'Avvia il cronometro'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">{lavoro ? <path d="M7 4.5h3.6v15H7zM13.4 4.5H17v15h-3.4z" /> : <path d="M8 5l11 7-11 7z" />}</svg>
          </button>
        </span>
      </div>
      <button className="blk-nota" onClick={() => nav.push({ k: 'item', id: notaBlocco.id })}>
        {rankBlocco !== undefined && <span className={clsx('blk-rk', `p${livelloPriorita(notaBlocco, oggi)}`)}>{rankBlocco}</span>}
        <span className="blk-t"><b>{notaBlocco.titolo}</b>{notaBlocco.sforzoMin ? <small>{durataLavoro(notaBlocco.sforzoMin * 60_000)} previsti</small> : null}</span>
        <span className="cb prog" aria-hidden="true" />
      </button>
      <div className="blk-sotto" role="img" aria-label={`Tempo lavorato: ${avanzamentoTempo(tempoBlocco, notaBlocco.sforzoMin).testo}`}>
        <div className="blk-tt"><b>{formatoCronometro(tempoBlocco)}</b>{notaBlocco.sforzoMin ? <em>{durataLavoro(notaBlocco.sforzoMin * 60_000)}</em> : null}</div>
        {quotaBlocco !== undefined && <div className="blk-barra"><i style={{ width: `${quotaBlocco * 100}%` }} /></div>}
      </div>
    </div>
  );

  // Routine del giorno come chip da spuntare.
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

  // Le prime attività, con quelle di uno stesso progetto riunite sotto la testata (toccandola si apre il progetto).
  const riga = (e: Entry) => (
    <Row
      rank={classifica.get(e.item.id)}
      urgenza={intensitaBattito(e.item, oggi)}
      key={e.item.id}
      titolo={e.item.titolo} tipo={e.item.tipo}
      meta={meta(e)}
      right={destra(e)}
      level={livelloPriorita(e.item, oggi)}
      voce={e.item}
      selected={nav.openId === e.item.id}
      onOpen={() => nav.push({ k: 'item', id: e.item.id })}
    />
  );
  // Al posto del conteggio (sempre 5) il tempo necessario a finire le voci mostrate: somma delle stime, con quante ne sono prive.
  // Accanto, il valore corretto col margine («2 h → 1 h 29 min»), colorato come il margine; a 0% resta solo il totale.
  const tempoNecessario = (voci: { sforzoMin?: number }[]) => {
    const minuti = voci.reduce((s, x) => s + (x.sforzoMin ?? 0), 0);
    if (minuti <= 0) return undefined;
    const senza = voci.filter((x) => !x.sforzoMin).length;
    const nome = (m: number) => (m >= 1440 ? nomeGiorniOre(m) : durataLavoro(m * 60_000));
    const conto = tempoAtteso(minuti, margine);
    const diverso = Math.round(margine * 100) !== 0 && conto !== minuti;
    return (
      <span className="sz-tempi">
        <span>{nome(minuti)}</span>
        {diverso && <><i aria-hidden="true">→</i><span className={clsx('sz-conto', margine > 0 ? 'mg-su' : 'mg-giu')} title="Tempo in conto, col margine delle tue stime">{nome(conto)}</span></>}
        {senza ? <span className="sz-senza">· {senza} senza stima</span> : null}
      </span>
    );
  };
  // Blocco sotto il timer: solo la correzione alle tue stime (parte da 0%): rosso se stimi troppo poco, verde se stimi più del necessario.
  const accuratezza = (
    <div className="acc" aria-label={`Correzione alle tue stime ${percentuale(margine)}`}>
      <div>
        <div className="acc-t">Correzione alle tue stime</div>
        <div className="acc-s">{Math.round(margine * 100) > 0 ? 'Stimi meno del necessario' : Math.round(margine * 100) < 0 ? 'Stimi più del necessario' : nMisurate > 0 ? 'Stime centrate' : 'Ancora nessun dato'}</div>
      </div>
      <Margine valore={margine} />
    </div>
  );
  const prime = (
    <Sezione titolo="Attività" dettaglio={tempoNecessario(v.fare.map((e) => e.item))}>
      {v.fare.length === 0 && <div className="t2" style={{ padding: '14px 0' }}>Niente di urgente. Puoi pescare qualcosa da «Attività» o «Intrattenimento».</div>}
      {raggruppaPerProgetto(v.fare, items).map((g) => g.progetto
        ? <GruppoProgetto key={g.progetto.id} progetto={g.progetto} fatti={g.fatti} totale={g.totale}>{g.voci.map(riga)}</GruppoProgetto>
        : g.voci.map(riga))}
    </Sezione>
  );

  // Curiosità da smaltire: poche, sotto le attività, senza numero di priorità (hanno un interesse, non un'importanza).
  const curiosita = v.curiosita.length > 0 && (
    <Sezione titolo="Curiosità" dettaglio={tempoNecessario(v.curiosita)}>
      {v.curiosita.map((c) => (
        <Row
          key={c.id}
          titolo={c.titolo} tipo="curiosita"
          meta={[c.sforzoMin ? nomeTempo(c.sforzoMin) : undefined, c.note?.split('\n')[0]].filter(Boolean).join(' · ') || undefined}
          interesse={c.interesse ?? 3}
          check="square"
          centrato
          voce={c}
          selected={nav.openId === c.id}
          onOpen={() => nav.push({ k: 'item', id: c.id })}
        />
      ))}
    </Sezione>
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

  // Sito largo: titolo con il riepilogo, una sola colonna centrata.
  if (nav.wide) {
    return (
      <>
        <Top title="Priorità" sub={`${formatLong(oggi)} · ${v.routine.length} routine, ${v.fare.length} attività, ${v.curiosita.length} curiosità`} />
        <div className="fisso senza-ombra">{lavora}{accuratezza}</div>
        <div className="scroll wide-dash">
          <div className="dash">
            <div>{routine}{prime}{curiosita}</div>
          </div>
        </div>
      </>
    );
  }

  // Telefono: titolo con i pulsanti tondi, lavoro, contenuto e pulsante «+».
  return (
    <>
      <Top
        title="Priorità"
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
      <div className="fisso">{lavora}{accuratezza}</div>
      <div className="scroll">
        {routine}
        {prime}
        {curiosita}
        {stato}
      </div>
      <Fab />
    </>
  );
}
