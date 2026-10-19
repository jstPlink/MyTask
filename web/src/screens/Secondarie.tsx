/**
 * Schermate secondarie, raggiunte da «Altro» (telefono: pulsante tondo in cima alle schede; sito largo: barra laterale).
 * Altro, Inbox, Archiviate, Completato, Aspetto, Stasera (dal gruppo Intrattenimento) e Account.
 * Sono tutte colonne semplici con «Indietro» in cima, uguali su telefono e sito largo.
 */
import { useEffect, useMemo, useState } from 'react';
import { NOMI_TIPO, type Item, type Tipo } from '../../../shared/types.ts';
import { formatShortYear, monthKey, monthLabel, today } from '../../../shared/dates.ts';
import { daParte, archivio, dataChiusura, inbox } from '../../../shared/views.ts';
import { riapri } from '../../../shared/recurrence.ts';
import { COMPAGNIE, ENERGIE, MOOD, PIATTAFORME_BASE, TIPOLOGIE, suggerisciStasera, type Compagnia } from '../../../shared/stasera.ts';
import { useAspetto, useAuth, useItems, useSyncStatus } from '../lib/hooks.ts';
import { saveItem, setAuth } from '../lib/store.ts';
import { chiaveTitolo } from '../../../shared/testo.ts';
import { apiBase, logout } from '../lib/api.ts';
import { VERSIONE } from '../version.ts';
import { sync } from '../lib/sync.ts';
import { impostaAspetto, type Colore, type Tema } from '../lib/theme.ts';
import { mostraToast } from '../lib/toast.ts';
import { Back, Chips, Empty, Field, Row, Sec, Seg, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';
import { clsx } from '../lib/util.ts';

// ------------------------------------------------------------------ Altro

/** Menu «Altro»: Inbox, Archiviate e Completato con i conteggi, poi le impostazioni dell'app. */
export function Altro() {
  const nav = useNav();
  const items = useItems();
  const a = useAspetto();
  const nInbox = useMemo(() => inbox(items).length, [items]);
  const nArch = useMemo(() => archivio(items).length, [items]);
  const nParte = useMemo(() => daParte(items).length, [items]);
  const voce = (nome: string, valore: string | number | undefined, k: Parameters<typeof nav.push>[0]) => (
    <button className="field link" onClick={() => nav.push(k)}><b style={{ fontWeight: 620 }}>{nome}</b><span className="muted">{valore !== undefined ? `${valore} ›` : '›'}</span></button>
  );
  return (
    <>
      <Back />
      <Top title="Altro" />
      <div className="scroll">
        {voce('Inbox', nInbox ? `${nInbox} da smistare` : 'vuota', { k: 'inbox' })}
        {voce('Archiviate', nParte || undefined, { k: 'daparte' })}
        {voce('Completato', nArch, { k: 'archivio' })}
        <Sec a="App" />
        {voce('Intelligenza artificiale', 'Gemini e Groq', { k: 'ia' })}
        <button className="field link sper-voce" onClick={() => nav.push({ k: 'pesi' })}><b style={{ fontWeight: 620 }}>Pesi della priorità <span className="badge-sper">provvisorio</span></b><span className="muted">›</span></button>
        {voce('Aspetto', `${a.colore[0].toUpperCase()}${a.colore.slice(1)} · ${a.tema === 'sistema' ? 'Sistema' : a.tema === 'chiaro' ? 'Chiaro' : 'Scuro'}`, { k: 'aspetto' })}
        <div className="field"><span>Calendario</span><span className="muted">non collegato</span></div>
        {voce('Account e sincronizzazione', undefined, { k: 'account' })}
        <div className="t2" style={{ textAlign: 'center', marginTop: 24 }}>MyTask · versione {VERSIONE}</div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Inbox

/** Note catturate al volo e non ancora smistate (la più recente prima); si smistano aprendole e scegliendo il tipo. */
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
          <Row key={i.id} titolo={i.titolo} check="none" onOpen={() => nav.push({ k: 'item', id: i.id })}
            meta={[i.piattaforma, i.consigliatoDa && `consigliato da ${i.consigliatoDa}`, i.note].filter(Boolean).join(' · ') || 'Apri per smistare'} />
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Archiviate

/** Note archiviate (stato «parcheggiato»): non compaiono nelle liste, si ripristinano aprendole. */
export function DaParte() {
  const nav = useNav();
  const items = useItems();
  const lista = useMemo(() => daParte(items), [items]);
  return (
    <>
      <Back label="Altro" />
      <Top title="Archiviate" sub={`${lista.length} ${lista.length === 1 ? 'voce archiviata' : 'voci archiviate'}`} />
      <div className="scroll">
        {lista.length === 0 && <Empty>Qui finiscono le voci che archivi. Aprine una per ripristinarla.</Empty>}
        {lista.map((i) => (
          <Row key={i.id} titolo={i.titolo} check="none" onOpen={() => nav.push({ k: 'item', id: i.id })} meta={NOMI_TIPO[i.tipo]} />
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Completato

// Filtri per tipo della lista dei completati (undefined = tutti).
const FILTRI_ARCHIVIO: Record<string, Tipo[] | undefined> = {
  Tutto: undefined, Film: ['film'], Serie: ['serie'], Anime: ['anime'], Libri: ['libro'], Giochi: ['gioco'], Attività: ['azione', 'progetto', 'esperienza'],
};

/**
 * Diario di ciò che è fatto o saltato (non le routine né i passi dei progetti), dal più recente, con una sezione per mese.
 * Il segno di spunta di una riga riapre la nota. Il voto, se c'è, compare a destra.
 */
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
      <Top title="Completato" sub={`${lista.length} completati`} />
      <div className="scroll">
        <Chips scroll voci={Object.keys(FILTRI_ARCHIVIO)} attivo={filtro} onChange={setFiltro} />
        {lista.length === 0 && <Empty>Ancora niente qui.</Empty>}
        {mesi.map(([k, voci]) => (
          <div key={k}>
            <Sec a={monthLabel(`${k}-01`)} />
            {voci.map((i) => (
              <Row key={i.id} titolo={i.titolo} tipo={i.tipo} done={i.stato === 'fatto'} light={i.stato === 'saltato'}
                meta={[NOMI_TIPO[i.tipo], i.stato === 'saltato' ? 'saltata' : undefined, formatShortYear(dataChiusura(i))].filter(Boolean).join(' · ')}
                right={i.voto ? `${i.voto}/10` : undefined}
                onCheck={() => saveItem(riapri(i, Date.now()))}
                selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Aspetto

// Colori d'accento a scelta (le tinte stanno in styles.css, variabili --o-*).
const COLORI: { id: Colore; nome: string }[] = [{ id: 'verde', nome: 'Verde' }, { id: 'petrolio', nome: 'Petrolio' }, { id: 'indaco', nome: 'Indaco' }];

/** Tema (sistema, chiaro, scuro) e colore d'accento: si applicano subito e restano salvati sul dispositivo. */
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
          <Row titolo="Rinnovare l’abbonamento" meta="Casa · 20 min" level={3} right={<span className="hard rigida">21 ott</span>} />
          <div className="btns"><span className="btn solid">Salva</span><span className="btn">Annulla</span></div>
        </div>
        <div className="t2" style={{ marginTop: 12 }}>Il tema si applica subito e resta salvato sul dispositivo, anche offline.</div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Cosa guardo stasera

/**
 * «Cosa guardo stasera»: propone un film, una serie o un anime in base a compagnia, piattaforma, mood, energia e
 * tipologia. I filtri spostano il punteggio senza escludere (`suggerisciStasera`); «Un altro» passa alla proposta
 * successiva, «Lo guardo» mette la voce «in corso». Sotto la proposta principale ci sono altre due alternative.
 */
export function Stasera() {
  const nav = useNav();
  const items = useItems();
  const [compagnia, setCompagnia] = useState<Compagnia>('solo');
  const [piattaforma, setPiattaforma] = useState('Qualsiasi');
  const [mood, setMood] = useState('Qualsiasi');
  const [energia, setEnergia] = useState('Qualsiasi');
  const [tipologia, setTipologia] = useState('Qualsiasi');
  const [salta, setSalta] = useState(0);
  // Piattaforme già usate nelle voci, più quelle di base non ancora presenti.
  const piatt = useMemo(() => {
    const usate = [...new Set(items.filter((i) => i.piattaforma && !i.eliminato).map((i) => i.piattaforma!))];
    const base = PIATTAFORME_BASE.filter((b) => !usate.some((u) => u.toLowerCase() === b.toLowerCase()));
    return [...usate, ...base];
  }, [items]);
  const filtri = useMemo(() => ({
    compagnia,
    piattaforma: piattaforma === 'Qualsiasi' ? undefined : piattaforma,
    mood: mood === 'Qualsiasi' ? undefined : mood,
    energia: energia === 'Qualsiasi' ? undefined : ENERGIE.find((e) => e.nome === energia)?.id,
    tipologia: tipologia === 'Qualsiasi' ? undefined : tipologia,
  }), [compagnia, piattaforma, mood, energia, tipologia]);
  const s = useMemo(() => suggerisciStasera(items, filtri, 6), [items, filtri]);
  const principale = s[salta % Math.max(1, s.length)];
  const altri = s.filter((x) => x !== principale).slice(0, 2);
  useEffect(() => setSalta(0), [filtri]);
  return (
    <>
      <Back label="Intrattenimento" />
      <Top title="Stasera" />
      <div className="scroll">
        <Sec a="Con chi?" />
        <Chips scroll voci={COMPAGNIE.map((c) => c.nome)} attivo={COMPAGNIE.find((c) => c.id === compagnia)!.nome} onChange={(n) => setCompagnia(COMPAGNIE.find((c) => c.nome === n)!.id)} />
        <Sec a="Piattaforma" />
        <Chips scroll voci={['Qualsiasi', ...piatt]} attivo={piattaforma} onChange={setPiattaforma} />
        <Sec a="Mood" />
        <Chips scroll voci={['Qualsiasi', ...MOOD]} attivo={mood} onChange={setMood} />
        <Sec a="Energia che hai stasera" />
        <Chips scroll voci={['Qualsiasi', ...ENERGIE.map((e) => e.nome)]} attivo={energia} onChange={setEnergia} />
        <Sec a="Tipologia" />
        <Chips scroll voci={['Qualsiasi', ...TIPOLOGIE]} attivo={tipologia} onChange={setTipologia} />
        {!principale ? <Empty>Niente di adatto. Prova con altri filtri o un'altra piattaforma.</Empty> : (
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

/**
 * Account e dati: email, ultima sincronizzazione (lo stato compare solo se offline o con modifiche da inviare), riepilogo delle voci, versioni di app e server (segnala se diverse),
 * sincronizzazione manuale e uscita (i dati restano sul dispositivo).
 */
export function Account() {
  const auth = useAuth();
  const st = useSyncStatus();
  const riepilogo = useRiepilogoVoci();
  const versioneServer = useVersioneServer();

  return (
    <>
      <Back label="Altro" />
      <Top title="Account" sub="Sincronizzazione e dati" />
      <div className="scroll">
        <Field label="Email"><span>{auth.email ?? '—'}</span></Field>
        {(!st.online || st.inCorso || st.inAttesa > 0) && <Field label="Stato"><span>{!st.online ? 'Offline' : st.inCorso ? 'Sincronizzazione…' : `${st.inAttesa} modifiche da inviare`}</span></Field>}
        <Field label="Ultima sincronizzazione"><span>{st.ultima ? new Date(st.ultima).toLocaleString('it-IT') : '—'}</span></Field>
        {st.errore && <div className="t2 warn" style={{ padding: '8px 0' }}>{st.errore}</div>}
        <Field label="Voci salvate su questo dispositivo"><span>{riepilogo.totale}</span></Field>
        <div className="t2" style={{ padding: '0 0 6px' }}>{riepilogo.perStato}</div>
        <div className="t2" style={{ padding: '0 0 6px' }}>{riepilogo.perTipo}</div>
        {riepilogo.doppioni > 0 && <div className="t2 warn" style={{ padding: '0 0 6px' }}>Possibili doppioni: {riepilogo.doppioni} (stesso tipo e stesso titolo). Il conteggio comprende anche le completate e le archiviate.</div>}
        <Field label="Versione dell'app"><span>{VERSIONE}</span></Field>
        <Field label="Versione del server"><span>{versioneServer ?? '—'}{versioneServer && versioneServer !== VERSIONE ? ' (diversa)' : ''}</span></Field>
        <div className="btns col" style={{ marginTop: 18 }}>
          <button className="btn solid" onClick={() => { void sync(); mostraToast('Sincronizzazione avviata'); }}>Sincronizza ora</button>
          <button className="btn danger" onClick={async () => { if (window.confirm('Uscire? I dati restano su questo dispositivo.')) { await logout(); await setAuth({ email: auth.email }); } }}>Esci</button>
        </div>
        <div className="t2" style={{ marginTop: 16 }}>Oggi è {today()}. Il database sul NAS fa una copia di sicurezza ogni giorno.</div>
      </div>
    </>
  );
}

/** Versione del server, letta da /api/health (undefined se offline o se il server è vecchio). */
function useVersioneServer(): string | undefined {
  const [v, setV] = useState<string | undefined>();
  useEffect(() => {
    let attivo = true;
    fetch(`${apiBase()}/api/health`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ versione?: string }>) : undefined))
      .then((j) => { if (attivo) setV(j?.versione); })
      .catch(() => undefined);
    return () => { attivo = false; };
  }, []);
  return v;
}

/**
 * Riepilogo delle voci non eliminate salvate su questo dispositivo: il totale comprende tutto (aperte, completate e archiviate,
 * passi dei progetti, routine, film, curiosità…). I possibili doppioni sono voci dello stesso tipo, con lo stesso titolo (a
 * parità di progetto): servono a capire se il totale è gonfiato da copie.
 */
function useRiepilogoVoci() {
  const items = useItems();
  return useMemo(() => {
    const vive = items.filter((i) => !i.eliminato && i.tipo !== 'persona'); // i contatti della vecchia importazione non si contano più
    const chiuse = vive.filter((i) => i.stato === 'fatto' || i.stato === 'saltato').length;
    const archiviate = vive.filter((i) => i.stato === 'parcheggiato').length;
    const perTipo = new Map<string, number>();
    const chiavi = new Map<string, number>();
    for (const i of vive) {
      perTipo.set(i.tipo, (perTipo.get(i.tipo) ?? 0) + 1);
      const k = `${i.tipo}|${i.padreId ?? ''}|${chiaveTitolo(i.titolo)}`;
      chiavi.set(k, (chiavi.get(k) ?? 0) + 1);
    }
    return {
      totale: vive.length,
      perStato: `Aperte ${vive.length - chiuse - archiviate} · Completate ${chiuse} · Archiviate ${archiviate}`,
      perTipo: [...perTipo].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${NOMI_TIPO[t as Tipo] ?? t} ${n}`).join(' · '),
      doppioni: [...chiavi.values()].reduce((s, n) => s + (n > 1 ? n - 1 : 0), 0),
    };
  }, [items]);
}
