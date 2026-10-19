/**
 * Priorità (la scheda `oggi`, prima «Oggi»): la schermata iniziale. In cima il pulsante «Sto lavorando» (o, a sessione aperta, il cronometro con pausa e
 * «Ho finito di lavorare»), poi le routine del giorno e le «Prime attività»: le cose da fare in ordine di priorità
 * (`vistaOggi`: scadute o in scadenza oggi e, a seguire, le più prioritarie senza data, fino a cinque in tutto).
 *
 * - Sto lavorando: il cronometro parte sul primo task della lista (`iniziaLavoro`), che prima dell'avvio ha un contorno
 *   tratteggiato. Il task su cui corre è evidenziato; la scheda del cronometro mostra il tempo lavorato, quello sul previsto e una barra.
 *   I task già iniziati mostrano nella riga grigia il tempo lavorato sul totale previsto. Spuntando la casella lo si completa e il cronometro passa da solo al successivo; ⏸ lo ferma, ▶ riprende.
 * - Tocco su una riga: menu con «Lavora su questo» (sposta il cronometro lì), «Non ora» (per il task in corso: passa al
 *   successivo senza completarlo) e «Apri» (la scheda della nota).
 * - Le attività dello stesso progetto sono riunite sotto la testata del progetto, il numero è la posizione in classifica.
 * - «Curiosità»: dopo le attività, al massimo cinque curiosità (le più interessanti, a parità le più vecchie), senza posizione
 *   in classifica; la casella le segna come approfondite e toccando la riga si apre la nota.
 * - Telefono: titolo con i pulsanti tondi (Aspetto, Inbox, Altro) e «+» per la cattura. Da 900 px (`nav.wide`) la stessa
 *   colonna senza pulsanti né «+», che stanno nella barra laterale.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Item } from '../../../shared/types.ts';
import { formatLong, formatShortYear } from '../../../shared/dates.ts';
import { barLevel, dueDate, daysOverdue, urgency } from '../../../shared/priority.ts';
import { raggruppaPerProgetto, vistaOggi, type Entry } from '../../../shared/views.ts';
import { fattaOggi } from '../../../shared/routine.ts';
import { descriviRicorrenza } from '../../../shared/recurrence.ts';
import { formatoCronometro } from '../../../shared/sessione.ts';
import { margineAtteso } from '../../../shared/stima.ts';
import { useAdesso, useItems, useOggi, useSessione, useSyncStatus } from '../lib/hooks.ts';
import { segnaRoutine } from '../lib/actions.ts';
import { finisciSessione, iniziaLavoro, mettiInPausa, nonOra, passaA, riprendi, tempoDi } from '../lib/sessione.ts';
import { Fab, Sezione, GruppoProgetto, Icona, Margine, Row, Top, unisciMeta } from '../ui/kit.tsx';
import { useLayer, useNav } from '../ui/nav.tsx';
import { avanzamentoTempo, clsx, durataLavoro, nomeTempo } from '../lib/util.ts';

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
  const [menu, setMenu] = useState<Item | null>(null);

  const task = sessione.taskId ? items.find((i) => i.id === sessione.taskId) : undefined;
  const tempoTask = task ? tempoDi(task, adesso) : 0;

  // Menu di una riga: è un livello della pila «Indietro» e si chiude anche con Esc.
  useLayer('menuriga', !!menu, () => setMenu(null));
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(null); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [menu]);

  // Riga grigia sotto il titolo: prossimo passo di un progetto, tempo stimato con margine, ricorrenza.
  const meta = (e: Entry) => {
    const i = e.item;
    const pezzi: ReactNode[] = [];
    const ms = tempoDi(i, adesso);
    const corrente = sessione.stato !== 'ferma' && sessione.taskId === i.id;
    if (ms >= 60_000 && !corrente) pezzi.push(avanzamentoTempo(ms, i.sforzoMin).testo); // sulla nota in lavorazione lo dice la barra sotto la riga
    if (e.padre) pezzi.push('prossimo passo');
    if (i.sforzoMin && (ms < 60_000 || corrente)) pezzi.push(<>{nomeTempo(i.sforzoMin)} <Margine valore={margine} /></>);
    if (i.ricorrenza) pezzi.push(descriviRicorrenza(i.ricorrenza));
    return unisciMeta(pezzi);
  };
  // Parte destra della riga: la scadenza (o «ieri» / «N gg fa» se scaduta, in arancio).
  const destra = (e: Entry) => {
    const d = dueDate(e.item);
    if (!d) return null;
    const ritardo = daysOverdue(e.item, oggi);
    if (d === oggi) return null;
    if (ritardo > 0) return <span className="hard">{ritardo === 1 ? 'ieri' : `${ritardo} gg fa`}</span>;
    return e.item.rigida ? <span className="hard rigida">{formatShortYear(d, oggi)}</span> : formatShortYear(d, oggi);
  };

  // «Sto lavorando» oppure la scheda del cronometro della sessione aperta: tempo lavorato, tempo sul previsto e barra.
  const avanzamento = task ? avanzamentoTempo(tempoTask, task.sforzoMin) : undefined;
  const lavora = sessione.stato === 'ferma' ? (
    <button className="avvia" onClick={() => iniziaLavoro()}>
      <span aria-hidden="true">▶</span>Sto lavorando
    </button>
  ) : (
    <div className={clsx('lavoro', !lavoro && 'pausa')}>
      <div className="lv-top">
        <div className="lv-tt">
          <div className="lv-stato">{lavoro ? 'In lavorazione' : 'In pausa'}</div>
          <div className="lv-tempo">{formatoCronometro(tempoTask)}{task?.sforzoMin ? <span className="lv-su">su {durataLavoro(task.sforzoMin * 60_000)}</span> : null}</div>
          <div className="lv-titolo">{task?.titolo ?? 'Attività'}</div>
        </div>
        <button className="lv-pl" onClick={() => (lavoro ? mettiInPausa() : riprendi())} aria-label={lavoro ? 'Metti in pausa' : 'Riprendi'}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">{lavoro ? <path d="M7 4.5h3.6v15H7zM13.4 4.5H17v15h-3.4z" /> : <path d="M8 5l11 7-11 7z" />}</svg></button>
      </div>
      {avanzamento?.quota !== undefined && (
        <div className="lv-barra" role="img" aria-label={`Tempo lavorato: ${avanzamento.testo}`}>
          <i className={avanzamento.quota > 1 ? 'oltre' : undefined} style={{ width: `${Math.min(100, avanzamento.quota * 100)}%` }} />
        </div>
      )}
      <button className="lv-fine" onClick={() => finisciSessione()}>Ho finito di lavorare</button>
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
  // Sotto la riga della nota in lavorazione: tempo lavorato a sinistra e previsto a destra sopra una barra sottile.
  // La barra resta nella riga anche dopo (chiusa) per le note già iniziate, così si chiude con un'animazione.
  const sottoRiga = (e: Entry) => {
    const i = e.item;
    const ms = tempoDi(i, adesso);
    if (ms <= 0 && !(sessione.stato !== 'ferma' && sessione.taskId === i.id)) return undefined;
    const quota = i.sforzoMin ? ms / (i.sforzoMin * 60_000) : undefined;
    return (
      <div role="img" aria-label={`Tempo lavorato: ${avanzamentoTempo(ms, i.sforzoMin).testo}`}>
        <div className="sr-tempi"><b>{formatoCronometro(ms)}</b>{i.sforzoMin ? <em>{durataLavoro(i.sforzoMin * 60_000)}</em> : null}</div>
        {quota !== undefined && <span className="sr-barra"><i style={{ width: `${Math.min(100, quota * 100)}%` }} /></span>}
      </div>
    );
  };
  const riga = (e: Entry) => {
    const corrente = sessione.stato !== 'ferma' && sessione.taskId === e.item.id;
    const quota = e.item.sforzoMin ? tempoDi(e.item, adesso) / (e.item.sforzoMin * 60_000) : 0;
    return (
    <Row
      rank={v.fare.indexOf(e) + 1}
      urgenza={urgency(e.item, oggi)}
      key={e.item.id}
      titolo={e.item.titolo} tipo={e.item.tipo}
      meta={meta(e)}
      right={destra(e)}
      level={barLevel(e.punteggio)}
      voce={e.item}
      classe={corrente ? (!lavoro ? 'pausa-lav' : quota > 1 ? 'oltre-lav' : undefined) : undefined}
      sotto={sottoRiga(e)} aperto={corrente}
      selected={nav.openId === e.item.id}
      onOpen={() => setMenu(e.item)}
    />
    );
  };
  const prime = (
    <Sezione titolo="Attività" dettaglio={v.fare.length || undefined}>
      {v.fare.length === 0 && <div className="t2" style={{ padding: '14px 0' }}>Niente di urgente. Puoi pescare qualcosa da «Attività» o «Intrattenimento».</div>}
      {raggruppaPerProgetto(v.fare, items).map((g) => g.progetto
        ? <GruppoProgetto key={g.progetto.id} progetto={g.progetto} fatti={g.fatti} totale={g.totale}>{g.voci.map(riga)}</GruppoProgetto>
        : g.voci.map(riga))}
    </Sezione>
  );

  // Curiosità da smaltire: poche, sotto le attività, senza numero di priorità (hanno un interesse, non un'importanza).
  const curiosita = v.curiosita.length > 0 && (
    <Sezione titolo="Curiosità" dettaglio={v.curiosita.length}>
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

  // Menu della riga toccata: foglio dal basso sul telefono, finestra al centro sul sito.
  const inSessione = menu && sessione.stato !== 'ferma' && sessione.taskId === menu.id;
  const menuRiga = menu && (
    <>
      <div className="dim" onClick={() => setMenu(null)} />
      <div className="sheet" role="dialog" aria-label={`«${menu.titolo}»`}>
        <div className="grip" />
        <div className="t1" style={{ fontWeight: 800, marginBottom: 8 }}>{menu.titolo}</div>
        <div className="btns" style={{ flexDirection: 'column' }}>
          {!inSessione && <button className="btn solid" onClick={() => { passaA(menu.id); setMenu(null); }}>Lavora su questo</button>}
          {inSessione && <button className="btn" onClick={() => { nonOra(); setMenu(null); }}>Non ora (passa al successivo)</button>}
          <button className={clsx('btn', inSessione && 'solid')} onClick={() => { const id = menu.id; setMenu(null); nav.push({ k: 'item', id }); }}>Apri</button>
        </div>
      </div>
    </>
  );

  // Sito largo: titolo con il riepilogo, una sola colonna centrata.
  if (nav.wide) {
    return (
      <>
        <Top title="Priorità" sub={`${formatLong(oggi)} · ${v.routine.length} routine, ${v.fare.length} attività, ${v.curiosita.length} curiosità`} />
        <div className="scroll wide-dash">
          <div className="dash">
            <div>{lavora}{routine}{prime}{curiosita}</div>
          </div>
        </div>
        {menuRiga}
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
      <div className="scroll">
        {lavora}
        {routine}
        {prime}
        {curiosita}
        {stato}
      </div>
      {menuRiga}
      <Fab />
    </>
  );
}
