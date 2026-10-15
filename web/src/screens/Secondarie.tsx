import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { NOMI_TIPO, type Item, type Tipo } from '../../../shared/types.ts';
import { addDays, formatShortYear, monthKey, monthLabel, relativeDays, today } from '../../../shared/dates.ts';
import { dueDate } from '../../../shared/priority.ts';
import { archivio, dataChiusura, inbox, luoghi, persone, revisione, zoneUsate } from '../../../shared/views.ts';
import { suggerisciStasera, type Durata } from '../../../shared/stasera.ts';
import { useAspetto, useAuth, useItems, useOggi, useSyncStatus } from '../lib/hooks.ts';
import { completaVoce, nuovaVoce, ripianifica, saltaVoce } from '../lib/actions.ts';
import { removeItem, saveItem, setAuth } from '../lib/store.ts';
import { scaricaEsportazione, logout } from '../lib/api.ts';
import { sync } from '../lib/sync.ts';
import { impostaAspetto, type Colore, type Tema } from '../lib/theme.ts';
import { chiediPermessoNotifiche, permessoNotifiche } from '../lib/reminders.ts';
import { mostraToast } from '../lib/toast.ts';
import { Back, Chips, Empty, Field, Row, Sec, Seg, Toggle, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';
import { clsx, mapsUrl } from '../lib/util.ts';

// ------------------------------------------------------------------ Altro

export function Altro() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const a = useAspetto();
  const nInbox = useMemo(() => inbox(items).length, [items]);
  const nRev = useMemo(() => revisione(items, oggi).length, [items, oggi]);
  const nArch = useMemo(() => archivio(items).length, [items]);
  const voce = (nome: string, valore: string | number | undefined, k: Parameters<typeof nav.push>[0]) => (
    <button className="field link" onClick={() => nav.push(k)}><b style={{ fontWeight: 620 }}>{nome}</b><span className="muted">{valore !== undefined ? `${valore} ›` : '›'}</span></button>
  );
  return (
    <>
      <Back />
      <Top title="Altro" />
      <div className="scroll">
        {voce('Inbox', nInbox ? `${nInbox} da smistare` : 'vuota', { k: 'inbox' })}
        {voce('Revisione', nRev, { k: 'revisione' })}
        {voce('Archivio', nArch, { k: 'archivio' })}
        {voce('Persone', undefined, { k: 'persone' })}
        {voce('Luoghi', undefined, { k: 'luoghi' })}
        <Sec a="App" />
        {voce('Aspetto', `${a.colore[0].toUpperCase()}${a.colore.slice(1)} · ${a.tema === 'sistema' ? 'Sistema' : a.tema === 'chiaro' ? 'Chiaro' : 'Scuro'}`, { k: 'aspetto' })}
        {voce('Notifiche', permessoNotifiche() === 'granted' ? 'attive' : undefined, { k: 'notifiche' })}
        <div className="field"><span>Calendario</span><span className="muted">non collegato</span></div>
        {voce('Account e sincronizzazione', undefined, { k: 'account' })}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Inbox

const TIPI_VELOCI: Tipo[] = ['azione', 'esperienza', 'film', 'serie', 'gioco', 'libro', 'curiosita'];

export function Inbox() {
  const nav = useNav();
  const items = useItems();
  const lista = useMemo(() => inbox(items), [items]);
  return (
    <>
      <Back />
      <Top title="Inbox" sub={`${lista.length} da smistare`} />
      <div className="scroll">
        {lista.length === 0 && <Empty>Tutto smistato. Le idee catturate al volo arrivano qui.</Empty>}
        {lista.map((i) => (
          <div key={i.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
            <button style={{ width: '100%' }} onClick={() => nav.push({ k: 'item', id: i.id })}>
              <div className="t1">{i.titolo}</div>
              <div className="t2">{[i.piattaforma, i.consigliatoDa && `consigliato da ${i.consigliatoDa}`, i.note].filter(Boolean).join(' · ') || 'Tocca per completare'}</div>
            </button>
            <div className="chips" style={{ margin: '8px 0 0' }}>
              {TIPI_VELOCI.map((t) => (
                <button key={t} className="chip" onClick={() => saveItem({ ...i, tipo: t, inbox: undefined, interesse: i.interesse ?? (t === 'azione' ? undefined : 3), importanza: t === 'azione' ? (i.importanza ?? 3) : i.importanza })}>{NOMI_TIPO[t]}</button>
              ))}
              <button className="chip" aria-label={`Elimina «${i.titolo}»`} onClick={() => { removeItem(i.id); mostraToast('Eliminata', { label: 'Annulla', fn: () => saveItem(i) }); }}>Elimina</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Revisione

export function Revisione() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const lista = useMemo(() => revisione(items, oggi), [items, oggi]);
  const totale = useRef(lista.length);
  if (lista.length > totale.current) totale.current = lista.length;
  const [pianifica, setPianifica] = useState(false);
  const [data, setData] = useState('');
  const v = lista[0];

  useEffect(() => { setPianifica(false); setData(''); }, [v?.item.id]);

  if (!v) {
    return (
      <>
        <Back />
        <Top title="Revisione" sub="Tutto in ordine" />
        <div className="scroll"><Empty>Niente da rivedere. Le voci scadute da più di due giorni o i progetti fermi compaiono qui.</Empty></div>
      </>
    );
  }
  const i = v.item;
  const fatte = totale.current - lista.length;
  const quando = v.motivo === 'scaduta' ? `Scaduta ${relativeDays(dueDate(i)!, oggi)}` : v.motivo === 'fermo' ? `Progetto fermo da ${v.giorni} giorni` : 'Da rivedere';
  const opzioni: [string, string][] = [['Domani', addDays(oggi, 1)], ['Tra una settimana', addDays(oggi, 7)], ['Tra un mese', addDays(oggi, 30)]];

  return (
    <>
      <Back />
      <Top title="Revisione" sub={`${fatte + 1} su ${totale.current}`} />
      <div className="scroll">
        <div className="bar" style={{ marginTop: 12 }}><i style={{ width: `${(fatte / totale.current) * 100}%` }} /></div>
        <div className="card strong" style={{ marginTop: 20 }}>
          <div className="t2 warn">{quando}</div>
          <div className="t1" style={{ fontSize: 20, margin: '4px 0 6px' }}>{i.titolo}</div>
          <div className="t2">{[NOMI_TIPO[i.tipo], i.area ?? i.zona, dueDate(i) && formatShortYear(dueDate(i)!, oggi), i.importanza ? `importanza ${i.importanza}` : undefined].filter(Boolean).join(' · ')}</div>
          {i.note && <div className="t2" style={{ marginTop: 6 }}>{i.note.slice(0, 140)}</div>}
          {!pianifica ? (
            <div className="btns col">
              {v.motivo === 'fermo'
                ? <button className="btn solid" onClick={() => saveItem({ ...i })}>Va avanti, ci lavoro</button>
                : <button className="btn solid" onClick={() => setPianifica(true)}>Ripianifica</button>}
              {v.motivo === 'fermo'
                ? <button className="btn" onClick={() => saveItem({ ...i, stato: 'parcheggiato' })}>Parcheggia</button>
                : <button className="btn" onClick={() => completaVoce(i)}>Segna fatto</button>}
              <button className="btn" onClick={() => saltaVoce(i)}>Salta</button>
              <button className="chip" style={{ alignSelf: 'center' }} onClick={() => nav.push({ k: 'item', id: i.id })}>Apri la voce</button>
            </div>
          ) : (
            <div className="btns col">
              {opzioni.map(([nome, iso]) => <button key={nome} className="btn" onClick={() => ripianifica(i, iso)}>{nome}</button>)}
              <div className="field"><span>Scegli</span><input type="date" min={oggi} value={data} onChange={(e) => setData(e.target.value)} /></div>
              <button className="btn solid" disabled={!data} onClick={() => ripianifica(i, data)}>Conferma</button>
              <button className="chip" style={{ alignSelf: 'center' }} onClick={() => setPianifica(false)}>Indietro</button>
            </div>
          )}
        </div>
        {lista.length > 1 && <div className="t2" style={{ textAlign: 'center', marginTop: 16 }}>Poi: {lista.slice(1, 4).map((x) => x.item.titolo).join(' · ')}{lista.length > 4 ? '…' : ''}</div>}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Archivio

const FILTRI_ARCHIVIO: Record<string, Tipo[] | undefined> = {
  Tutto: undefined, Film: ['film'], Serie: ['serie'], Anime: ['anime'], Libri: ['libro'], Giochi: ['gioco'], Azioni: ['azione', 'progetto', 'esperienza'],
};

export function Archivio() {
  const nav = useNav();
  const items = useItems();
  const [filtro, setFiltro] = useState('Tutto');
  const lista = useMemo(() => archivio(items).filter((i) => !FILTRI_ARCHIVIO[filtro] || FILTRI_ARCHIVIO[filtro]!.includes(i.tipo)), [items, filtro]);
  const mesi = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of lista) { const k = monthKey(dataChiusura(i)); m.set(k, [...(m.get(k) ?? []), i]); }
    return [...m.entries()];
  }, [lista]);
  return (
    <>
      <Back />
      <Top title="Archivio" sub={`${lista.length} completati`} />
      <div className="scroll">
        <Chips scroll voci={Object.keys(FILTRI_ARCHIVIO)} attivo={filtro} onChange={setFiltro} />
        {lista.length === 0 && <Empty>Ancora niente qui.</Empty>}
        {mesi.map(([k, voci]) => (
          <div key={k}>
            <Sec a={monthLabel(`${k}-01`)} />
            {voci.map((i) => (
              <Row key={i.id} titolo={i.titolo} done={i.stato === 'fatto'} light={i.stato === 'saltato'}
                meta={[NOMI_TIPO[i.tipo], i.stato === 'saltato' ? 'saltata' : undefined, formatShortYear(dataChiusura(i))].filter(Boolean).join(' · ')}
                right={i.voto ? `${i.voto}/10` : undefined}
                onCheck={() => saveItem({ ...i, stato: 'da_fare', completatoIl: undefined })}
                onOpen={() => nav.push({ k: 'item', id: i.id })} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Persone

export function Persone() {
  const nav = useNav();
  const items = useItems();
  const [solo, setSolo] = useState('Tutte');
  const [nuova, setNuova] = useState('');
  const lista = useMemo(() => persone(items).filter((p) => solo === 'Tutte' || p.persona.daContattare), [items, solo]);
  const aggiungi = (e: FormEvent) => {
    e.preventDefault();
    const n = nuova.trim();
    if (!n) return;
    const esiste = persone(items).find((p) => p.persona.titolo.toLowerCase() === n.toLowerCase());
    if (esiste) nav.push({ k: 'persona', id: esiste.persona.id });
    else { const p = nuovaVoce({ tipo: 'persona', titolo: n }); saveItem(p); }
    setNuova('');
  };
  return (
    <>
      <Back />
      <Top title="Persone" />
      <div className="scroll">
        <Chips voci={['Tutte', 'Da contattare']} attivo={solo} onChange={setSolo} />
        <form className="field" onSubmit={aggiungi}>
          <input style={{ textAlign: 'left' }} value={nuova} placeholder="Aggiungi una persona" onChange={(e) => setNuova(e.target.value)} />
          <button className="chip" disabled={!nuova.trim()}>Aggiungi</button>
        </form>
        {lista.length === 0 && <Empty>Nessuna persona.</Empty>}
        {lista.map(({ persona: p, collegamenti, consigliati }) => (
          <Row key={p.id} titolo={p.titolo} check="none"
            meta={`${collegamenti} ${collegamenti === 1 ? 'collegamento' : 'collegamenti'}${consigliati ? ` · ha consigliato ${consigliati}` : ''}`}
            right={p.daContattare ? <span className="badge solid">contatta</span> : undefined}
            onOpen={() => nav.push({ k: 'persona', id: p.id })} />
        ))}
      </div>
    </>
  );
}

export function PersonaDetail({ id }: { id: string }) {
  const nav = useNav();
  const items = useItems();
  const p = items.find((i) => i.id === id);
  const collegate = useMemo(() => {
    if (!p) return [];
    const n = p.titolo.toLowerCase();
    return items.filter((i) => !i.eliminato && i.tipo !== 'persona' && ((i.persone ?? []).some((x) => x.toLowerCase() === n) || i.consigliatoDa?.toLowerCase() === n || i.conChi?.toLowerCase() === n));
  }, [items, p]);
  if (!p || p.eliminato) return <><Back /><Empty>Persona non trovata.</Empty></>;
  return (
    <>
      <Back label="Persone" />
      <Top title={p.titolo} sub={`${collegate.length} collegamenti`} />
      <div className="scroll">
        <Field label="Nome"><input value={p.titolo} onChange={(e) => saveItem({ ...p, titolo: e.target.value })} /></Field>
        <Field label="Da contattare"><Toggle on={!!p.daContattare} label="Da contattare" onChange={(v) => saveItem({ ...p, daContattare: v || undefined })} /></Field>
        <Field label="Note"><input value={p.note ?? ''} onChange={(e) => saveItem({ ...p, note: e.target.value || undefined })} /></Field>
        <Sec a="Collegata a" />
        {collegate.length === 0 && <div className="t2" style={{ padding: '10px 0' }}>Nessuna voce. Scrivila in «Consigliato da», «Con chi» o «Persone».</div>}
        {collegate.map((i) => <Row key={i.id} titolo={i.titolo} meta={[NOMI_TIPO[i.tipo], i.consigliatoDa?.toLowerCase() === p.titolo.toLowerCase() ? 'consigliato da lei/lui' : undefined].filter(Boolean).join(' · ')} check="none" onOpen={() => nav.push({ k: 'item', id: i.id })} />)}
        <div className="btns col" style={{ marginTop: 22 }}>
          <button className="btn danger" onClick={() => { if (window.confirm(`Eliminare «${p.titolo}»? Le voci collegate restano.`)) { removeItem(p.id); nav.pop(); } }}>Elimina persona</button>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Luoghi

export function Luoghi() {
  const nav = useNav();
  const items = useItems();
  const [zona, setZona] = useState('Tutti');
  const zone = useMemo(() => zoneUsate(items), [items]);
  const lista = useMemo(() => luoghi(items, zona === 'Tutti' ? undefined : zona), [items, zona]);
  return (
    <>
      <Back />
      <Top title="Luoghi" sub="Da visitare" />
      <div className="scroll">
        <Chips scroll voci={['Tutti', ...zone]} attivo={zona} onChange={setZona} />
        {lista.length === 0 && <Empty>Nessun luogo con una zona. Aggiungila alle esperienze.</Empty>}
        {lista.map((i) => (
          <Row key={i.id} titolo={i.titolo} meta={i.zona} check="square" level={(i.interesse ?? 3) >= 4 ? 3 : (i.interesse ?? 3) === 3 ? 2 : 1}
            right={<a href={i.linkMaps ?? mapsUrl(i.titolo, i.zona)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Maps ›</a>}
            onCheck={() => completaVoce(i)} onOpen={() => nav.push({ k: 'item', id: i.id })} />
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Aspetto

const COLORI: { id: Colore; nome: string }[] = [{ id: 'verde', nome: 'Verde' }, { id: 'petrolio', nome: 'Petrolio' }, { id: 'indaco', nome: 'Indaco' }];

export function Aspetto() {
  const a = useAspetto();
  return (
    <>
      <Back label="Altro" />
      <Top title="Aspetto" sub="Impostazioni" />
      <div className="scroll">
        <Sec a="Tema" />
        <Seg<Tema> voci={[{ id: 'sistema', nome: 'Sistema' }, { id: 'chiaro', nome: 'Chiaro' }, { id: 'scuro', nome: 'Scuro' }]} attivo={a.tema} onChange={(tema) => impostaAspetto({ tema })} />
        <div className="t2">Segue il tema del telefono, oppure ne scegli uno fisso.</div>
        <Sec a="Colore" />
        {COLORI.map((c) => (
          <button key={c.id} className={clsx('opt', a.colore === c.id && 'sel')} onClick={() => impostaAspetto({ colore: c.id })} aria-pressed={a.colore === c.id}>
            <span className="sw2" style={{ background: `var(--o-${c.id})` }} />
            <span className="grow t1">{c.nome}</span>
            {a.colore === c.id && <span className="ok">✓</span>}
          </button>
        ))}
        <Sec a="Anteprima" />
        <div className="card strong">
          <Row titolo="Rinnovare l’abbonamento" meta="Casa · 20 min" level={3} right={<span className="hard">21 ott</span>} />
          <div className="btns"><span className="btn solid">Salva</span><span className="btn">Annulla</span></div>
        </div>
        <div className="t2" style={{ marginTop: 12 }}>Il tema si applica subito e resta salvato sul dispositivo, anche offline.</div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Notifiche

export function Notifiche() {
  const [perm, setPerm] = useState(permessoNotifiche());
  return (
    <>
      <Back label="Altro" />
      <Top title="Notifiche" sub="Impostazioni" />
      <div className="scroll">
        <div className="card">
          <div className="t1">{perm === 'granted' ? 'Notifiche attive' : perm === 'denied' ? 'Notifiche bloccate' : perm === 'non_supportate' ? 'Non supportate da questo browser' : 'Notifiche non ancora attive'}</div>
          <div className="t2" style={{ marginTop: 4 }}>
            Nel browser i promemoria arrivano finché l'app è aperta. Con l'app Android installata arriveranno anche ad app chiusa.
          </div>
          {perm === 'default' && <div className="btns"><button className="btn solid" onClick={async () => setPerm(await chiediPermessoNotifiche())}>Attiva le notifiche</button></div>}
          {perm === 'denied' && <div className="t2" style={{ marginTop: 8 }}>Per riattivarle usa le impostazioni del sito nel browser.</div>}
        </div>
        <Sec a="Come funzionano" />
        <div className="t2" style={{ lineHeight: 1.6 }}>
          · Scadenze: scegli i promemoria (7 giorni, 1 giorno prima…) nella scheda di ogni voce.<br />
          · Insistenza: attivala su una voce e il promemoria si ripete finché non la spunti.<br />
          · Routine: imposta l'orario del promemoria nella routine.
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Cosa guardo stasera

const DURATE: { id: Durata; nome: string }[] = [{ id: 'breve', nome: '< 1h 30' }, { id: 'media', nome: '1h 30 - 2h' }, { id: 'lunga', nome: '2h+' }, { id: 'serie', nome: 'Serie' }];

export function Stasera() {
  const nav = useNav();
  const items = useItems();
  const [durata, setDurata] = useState<Durata>('media');
  const [conChi, setConChi] = useState('Da solo');
  const [piattaforma, setPiattaforma] = useState('Qualsiasi');
  const [salta, setSalta] = useState(0);
  const compagni = useMemo(() => [...new Set(items.filter((i) => i.conChi && !i.eliminato).map((i) => i.conChi!))], [items]);
  const piatt = useMemo(() => [...new Set(items.filter((i) => i.piattaforma && !i.eliminato).map((i) => i.piattaforma!))], [items]);
  const s = useMemo(() => suggerisciStasera(items, { durata, conChi: conChi === 'Da solo' ? undefined : conChi, piattaforma: piattaforma === 'Qualsiasi' ? undefined : piattaforma }, 6), [items, durata, conChi, piattaforma]);
  const principale = s[salta % Math.max(1, s.length)];
  const altri = s.filter((x) => x !== principale).slice(0, 2);
  useEffect(() => setSalta(0), [durata, conChi, piattaforma]);
  return (
    <>
      <Back label="Scoprire" />
      <Top title="Stasera" />
      <div className="scroll">
        <Sec a="Quanto tempo hai?" />
        <Chips voci={DURATE.map((d) => d.nome)} attivo={DURATE.find((d) => d.id === durata)!.nome} onChange={(n) => setDurata(DURATE.find((d) => d.nome === n)!.id)} />
        <Sec a="Con chi?" />
        <Chips scroll voci={['Da solo', ...compagni]} attivo={conChi} onChange={setConChi} />
        <Sec a="Piattaforma" />
        <Chips scroll voci={['Qualsiasi', ...piatt]} attivo={piattaforma} onChange={setPiattaforma} />
        {!principale ? <Empty>Niente di adatto. Prova con un altro tempo o un'altra piattaforma.</Empty> : (
          <>
            <div className="card strong" style={{ marginTop: 16 }}>
              <div className="t1" style={{ fontSize: 18 }}>{principale.item.titolo}</div>
              <div className="t2">{[NOMI_TIPO[principale.item.tipo], principale.item.durataMin && `${principale.item.durataMin} min`, principale.item.piattaforma].filter(Boolean).join(' · ')}</div>
              <div className="t2" style={{ marginTop: 6 }}>Perché: {principale.motivo}</div>
              <div className="btns">
                <button className="btn solid" onClick={() => { saveItem({ ...principale.item, stato: 'in_corso' }); mostraToast(`Buona visione: «${principale.item.titolo}»`); nav.pop(); }}>Lo guardo</button>
                <button className="btn" onClick={() => setSalta((n) => n + 1)}>Un altro</button>
              </div>
            </div>
            {altri.map((a) => <button key={a.item.id} className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.push({ k: 'item', id: a.item.id })}><div className="t1">{a.item.titolo}</div><div className="t2">{a.motivo}</div></button>)}
          </>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Account

export function Account() {
  const auth = useAuth();
  const st = useSyncStatus();
  const nVoci = useItemsCount();
  return (
    <>
      <Back label="Altro" />
      <Top title="Account" sub="Sincronizzazione e dati" />
      <div className="scroll">
        <Field label="Email"><span>{auth.email ?? '—'}</span></Field>
        <Field label="Stato"><span>{!st.online ? 'Offline' : st.inCorso ? 'Sincronizzazione…' : st.inAttesa ? `${st.inAttesa} modifiche da inviare` : 'Tutto sincronizzato'}</span></Field>
        <Field label="Ultima sincronizzazione"><span>{st.ultima ? new Date(st.ultima).toLocaleString('it-IT') : '—'}</span></Field>
        {st.errore && <div className="t2 warn" style={{ padding: '8px 0' }}>{st.errore}</div>}
        <Field label="Voci salvate su questo dispositivo"><span>{nVoci}</span></Field>
        <div className="btns col" style={{ marginTop: 18 }}>
          <button className="btn solid" onClick={() => { void sync(); mostraToast('Sincronizzazione avviata'); }}>Sincronizza ora</button>
          <button className="btn" onClick={() => { scaricaEsportazione().catch(() => mostraToast('Esportazione non riuscita (serve la connessione)')); }}>Scarica una copia dei dati (JSON)</button>
          <button className="btn danger" onClick={async () => { if (window.confirm('Uscire? I dati restano su questo dispositivo.')) { await logout(); await setAuth({ email: auth.email }); } }}>Esci</button>
        </div>
        <div className="t2" style={{ marginTop: 16 }}>Oggi è {today()}. Il database sul NAS fa una copia di sicurezza ogni giorno.</div>
      </div>
    </>
  );
}

function useItemsCount(): number {
  return useItems().filter((i) => !i.eliminato).length;
}
