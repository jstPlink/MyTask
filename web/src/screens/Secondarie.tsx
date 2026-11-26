/**
 * Schermate secondarie, raggiunte da «Impostazioni» (telefono: pulsante tondo con i tre puntini in cima alle schede; sito largo: barra laterale).
 * Impostazioni, Inbox, Archiviate, Completato, Aspetto, Stasera (dal gruppo Intrattenimento) e Account.
 * Sono tutte colonne semplici con «Indietro» in cima, uguali su telefono e sito largo.
 */
import { useEffect, useMemo, useState } from 'react';
import { NOMI_TIPO, type Item, type Tipo } from '../../../shared/types.ts';
import { formatShortYear, monthKey, monthLabel, today } from '../../../shared/dates.ts';
import { daParte, archivio, dataChiusura, inbox } from '../../../shared/views.ts';
import { riapri } from '../../../shared/recurrence.ts';
import { COMPAGNIE, ENERGIE, MOOD, PIATTAFORME_BASE, TIPOLOGIE, suggerisciStasera, type Compagnia } from '../../../shared/stasera.ts';
import { useAspetto, useAuth, useItems, usePromemoriaTimer, useSyncStatus } from '../lib/hooks.ts';
import { saveItem, setAuth } from '../lib/store.ts';
import { chiaveTitolo } from '../../../shared/testo.ts';
import { apiBase, codiceOrologioAttivo, creaCodiceOrologio, logout, revocaCodiceOrologio } from '../lib/api.ts';
import { VERSIONE } from '../version.ts';
import { aggiornaApp, piuNuova, versioneServer } from '../lib/aggiornamento.ts';
import { isNative } from '../lib/native.ts';
import { impostaAspetto, PALETTE, TINTE, type Colore, type Palette, type Stile, type Tema, type Tinta } from '../lib/theme.ts';
import { impostaPromemoriaTimer } from '../lib/promemoriaTimer.ts';
import { chiediPermessoSito, permessoSito, type PermessoSito } from '../lib/notificaTimerSito.ts';
import { INTERVALLI_PROMEMORIA_MIN } from '../../../shared/sessione.ts';
import { mostraToast } from '../lib/toast.ts';
import { Back, Chips, Empty, Field, Row, Sec, Seg, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';
import { clsx } from '../lib/util.ts';

// ------------------------------------------------------------------ Altro

/**
 * «Impostazioni» (telefono: pallino con i tre puntini in cima alle schede; sito e computer: voce nella barra laterale):
 * archiviate, completate, aspetto, notifica del timer, account, bilanciatori della priorità e del margine e, in fondo,
 * la versione dell'app, che si tocca per aggiornare quando il server ne ha una più nuova.
 */
export function Altro() {
  const nav = useNav();
  const items = useItems();
  const a = useAspetto();
  const pt = usePromemoriaTimer();
  const nArch = useMemo(() => archivio(items).length, [items]);
  const nParte = useMemo(() => daParte(items).length, [items]);
  const voce = (nome: string, valore: string | number | undefined, k: Parameters<typeof nav.push>[0]) => (
    <button className="field link" onClick={() => nav.push(k)}><b style={{ fontWeight: 620 }}>{nome}</b><span className="muted">{valore !== undefined ? `${valore} ›` : '›'}</span></button>
  );
  return (
    <>
      <Back />
      <Top title="Impostazioni" />
      <div className="scroll">
        <Sec a="Note" />
        {voce('Note archiviate', nParte || undefined, { k: 'daparte' })}
        {voce('Note completate', nArch, { k: 'archivio' })}
        <Sec a="App" />
        {voce('Aspetto', `${{ morbido: 'Morbido', vetro: 'Vetro', base: 'Flat' }[a.stile]} · ${a.tema === 'sistema' ? 'Sistema' : a.tema === 'chiaro' ? 'Chiaro' : 'Scuro'}`, { k: 'aspetto' })}
        {voce('Notifica del timer', pt.attivo ? `ogni ${pt.ogniMinuti} min` : 'disattivata', { k: 'timer' })}
        {voce('Account', undefined, { k: 'account' })}
        <Sec a="Bilanciatori" />
        {voce('Bilanciatore della priorità', undefined, { k: 'pesi' })}
        {voce('Bilanciatore del margine', undefined, { k: 'pesimargine' })}
        <Sec a="Versione" />
        <VersioneApp />
      </div>
    </>
  );
}

/** La versione dell'app: toccandola si ricontrolla il server e, se ne ha una più nuova, si aggiorna (sito e computer; sul telefono serve il nuovo APK). */
function VersioneApp() {
  const [server, setServer] = useState<string | undefined>();
  useEffect(() => {
    let attivo = true;
    void versioneServer().then((v) => { if (attivo) setServer(v); });
    return () => { attivo = false; };
  }, []);
  const nuova = server !== undefined && piuNuova(server, VERSIONE);
  const tocca = async () => {
    const v = await versioneServer();
    setServer(v);
    if (!v) mostraToast('Server non raggiungibile: non posso controllare');
    else if (!piuNuova(v, VERSIONE)) mostraToast('Hai già l\'ultima versione');
    else if (isNative()) mostraToast(`C\'è la versione ${v}: sul telefono va installato il nuovo APK`);
    else await aggiornaApp();
  };
  return (
    <button className="field link" onClick={() => { void tocca(); }}>
      <b style={{ fontWeight: 620 }}>Versione {VERSIONE}</b>
      <span className={nuova ? 'warn' : 'muted'}>{nuova ? `${isNative() ? 'disponibile' : 'aggiorna a'} ${server} ›` : server ? 'aggiornata ›' : 'controlla ›'}</span>
    </button>
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
          <Row key={i.id} titolo={i.titolo} check="none" conNote={!!i.note?.trim()} onOpen={() => nav.push({ k: 'item', id: i.id })}
            meta={[i.piattaforma, i.consigliatoDa && `consigliato da ${i.consigliatoDa}`].filter(Boolean).join(' · ') || 'Apri per smistare'} />
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
      <Back label="Impostazioni" />
      <Top title="Archiviate" sub={`${lista.length} ${lista.length === 1 ? 'voce archiviata' : 'voci archiviate'}`} />
      <div className="scroll">
        {lista.length === 0 && <Empty>Qui finiscono le voci che archivi. Aprine una per ripristinarla.</Empty>}
        {lista.map((i) => (
          <Row key={i.id} titolo={i.titolo} check="none" conNote={!!i.note?.trim()} onOpen={() => nav.push({ k: 'item', id: i.id })} meta={NOMI_TIPO[i.tipo]} />
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
const NOMI_PALETTE: Record<Palette, { nome: string; colore: string }> = {
  grafite: { nome: 'Grafite', colore: '#e9ebef' }, ambra: { nome: 'Ambra', colore: '#f0b45a' }, salvia: { nome: 'Salvia', colore: '#9fd8b8' },
  ghiaccio: { nome: 'Ghiaccio', colore: '#a9c8e8' }, lime: { nome: 'Lime', colore: '#c9f36b' }, turchese: { nome: 'Turchese', colore: '#5ee6d0' },
  arancio: { nome: 'Arancio', colore: '#ff8a3d' }, smeraldo: { nome: 'Smeraldo', colore: '#3ddc97' },
};
/** Ruoli dei colori dello stile vetro, con la variabile CSS da cui si legge il valore della palette scelta. */
const RUOLI_PALETTE: [string, string, string][] = [
  ['Sfondo', '--v-g0', 'base, in alto'], ['Sfondo 2', '--v-g1', 'metà pagina'], ['Sfondo 3', '--v-g2', 'in basso, menu'],
  ['Accento primario', '--acc', 'scelte attive, barre, pulsante'], ['Accento secondario', '--acc2', 'passaggio nelle barre'], ['Testo su accento', '--onacc', 'scritte sopra l’accento'],
  ['Entrate', '--good', 'importi positivi'], ['Avviso', '--bad', 'arretrati, errori'], ['Testo secondario', '--mute', 'etichette, note'], ['Testo', '--ink', 'testo principale'],
];

/** Elenco dei colori della palette in uso (stile vetro), letti dal CSS: cambiano con la palette e col tema. */
function RuoliPalette({ chiave }: { chiave: string }) {
  const [valori, setValori] = useState<string[]>([]);
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setValori(RUOLI_PALETTE.map(([, v]) => cs.getPropertyValue(v).trim().toUpperCase()));
  }, [chiave]);
  return (
    <div className="ruoli-pal">
      {RUOLI_PALETTE.map(([nome, , d], i) => (
        <div key={nome} className="opt">
          <span className="sw2" style={{ background: valori[i] || 'transparent', borderRadius: 10, border: '1px solid rgba(128,128,128,.4)' }} />
          <div style={{ flex: 1, minWidth: 0 }}><div className="t1">{nome}</div><div className="t2">{d}</div></div>
          <span className="t2">{valori[i]}</span>
        </div>
      ))}
    </div>
  );
}

const NOMI_TINTE: Record<Tinta, { nome: string; colore: string; desc: string }> = {
  grafite: { nome: 'Grafite', colore: '#D9D9DB', desc: 'scala di grigi' }, menta: { nome: 'Menta', colore: '#D5E4DA', desc: 'verde leggero e freddo' },
  panna: { nome: 'Panna', colore: '#E4DDCE', desc: 'calda e delicata' }, ghiaccio: { nome: 'Ghiaccio', colore: '#D5E2EE', desc: 'celesti e azzurri' },
};

const COLORI: { id: Colore; nome: string }[] = [{ id: 'verde', nome: 'Verde' }, { id: 'petrolio', nome: 'Petrolio' }, { id: 'indaco', nome: 'Indaco' }];

/** Tema (sistema, chiaro, scuro) e colore d'accento: si applicano subito e restano salvati sul dispositivo. */
export function Aspetto() {
  const a = useAspetto();
  return (
    <>
      <Back label="Impostazioni" />
      <Top title="Aspetto" sub="Impostazioni" />
      <div className="scroll">
        <Sec a="Tema" />
        <Seg<Tema> voci={[{ id: 'sistema', nome: 'Sistema' }, { id: 'chiaro', nome: 'Chiaro' }, { id: 'scuro', nome: 'Scuro' }]} attivo={a.tema} onChange={(tema) => impostaAspetto({ tema })} />
        <div className="t2">Segue il tema del telefono, oppure ne scegli uno fisso.</div>
        <Sec a="Stile" />
        <Seg<Stile> voci={[{ id: 'morbido', nome: 'Morbido' }, { id: 'vetro', nome: 'Vetro' }, { id: 'base', nome: 'Flat' }]} attivo={a.stile} onChange={(stile) => impostaAspetto({ stile })} />
        <div className="t2">Morbido: note come schede morbide con ombra. Vetro: pannelli di vetro con testate a fascia e una palette a scelta. Flat: lo stile di prima, note in righe con filetti, sezioni a fascia e schede piatte.</div>
        {a.stile === 'vetro' && (
          <>
            <Sec a={`Palette · ${NOMI_PALETTE[a.palette].nome}`} />
            {PALETTE.map((p) => (
              <button key={p} className={clsx('opt', a.palette === p && 'sel')} onClick={() => impostaAspetto({ palette: p })} aria-pressed={a.palette === p}>
                <span className="sw2" style={{ background: NOMI_PALETTE[p].colore }} />
                <span className="grow t1">{NOMI_PALETTE[p].nome}</span>
                {a.palette === p && <span className="ok">✓</span>}
              </button>
            ))}
            <Sec a="Ruoli dei colori" />
            <RuoliPalette chiave={`${a.palette}-${a.tema}-${a.stile}`} />
          </>
        )}
        {a.stile === 'base' && (
          <>
            <Sec a={`Palette Flat · ${NOMI_TINTE[a.tinta].nome}`} />
            {TINTE.map((t) => (
              <button key={t} className={clsx('opt', a.tinta === t && 'sel')} onClick={() => impostaAspetto({ tinta: t })} aria-pressed={a.tinta === t}>
                <span className="sw2" style={{ background: NOMI_TINTE[t].colore, border: '1px solid rgba(128,128,128,.4)' }} />
                <span className="grow t1">{NOMI_TINTE[t].nome}</span>
                <span className="t2">{NOMI_TINTE[t].desc}</span>
                {a.tinta === t && <span className="ok">✓</span>}
              </button>
            ))}
            <div className="t2">Cambia sfondi, filetti, testi e colore d’accento (pulsanti, scheda scelta, pulsante nuova nota), sia nel tema chiaro sia nello scuro.</div>
          </>
        )}
        {a.stile === 'morbido' && <Sec a="Colore" />}
        {a.stile === 'morbido' && COLORI.map((c) => (
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

// ------------------------------------------------------------------ Notifica del timer

/**
 * Notifica periodica del timer (telefono, sito e app per computer): mentre una nota è in corso e il cronometro scorre, ogni N minuti il
 * dispositivo manda una notifica per ricordare che il tempo sta passando. Si sceglie se tenerla attiva e ogni quanti minuti (per dispositivo).
 */
export function NotificaTimer() {
  const pt = usePromemoriaTimer();
  const nativo = isNative();
  const [permesso, setPermesso] = useState<PermessoSito>(permessoSito());
  return (
    <>
      <Back label="Impostazioni" />
      <Top title="Notifica del timer" sub="Impostazioni" />
      <div className="scroll">
        <Sec a="Notifica periodica" />
        <Seg<'si' | 'no'> voci={[{ id: 'si', nome: 'Attiva' }, { id: 'no', nome: 'Disattivata' }]} attivo={pt.attivo ? 'si' : 'no'} onChange={(v) => impostaPromemoriaTimer({ attivo: v === 'si' })} />
        <div className="t2">Mentre una nota è in corso e il timer scorre, {nativo ? 'il telefono suona' : 'questo dispositivo ti avvisa'} per ricordarti che il tempo sta passando. Si ferma con la pausa o quando chiudi la sessione.</div>
        {!nativo && permesso !== 'granted' && (
          permesso === 'non_supportate'
            ? <div className="t2" style={{ marginTop: 8 }}>Questo browser non supporta le notifiche.</div>
            : permesso === 'denied'
              ? <div className="t2" style={{ marginTop: 8 }}>Le notifiche sono bloccate: riattivale dalle impostazioni del sito o dell'app, poi riapri questa pagina.</div>
              : <button className="btn" style={{ marginTop: 10 }} onClick={() => { void chiediPermessoSito().then(setPermesso); }}>Consenti le notifiche</button>
        )}
        <Sec a="Ogni quanto" />
        {INTERVALLI_PROMEMORIA_MIN.map((m) => (
          <button key={m} className={clsx('opt', pt.ogniMinuti === m && 'sel')} onClick={() => impostaPromemoriaTimer({ ogniMinuti: m })} aria-pressed={pt.ogniMinuti === m} disabled={!pt.attivo} style={pt.attivo ? undefined : { opacity: 0.5 }}>
            <span className="grow t1">{m === 1 ? 'Ogni minuto' : `Ogni ${m} minuti`}</span>
            {pt.ogniMinuti === m && <span className="ok">✓</span>}
          </button>
        ))}
        <div className="t2" style={{ marginTop: 12 }}>La notifica mostra la nota e il tempo trascorso. L'impostazione vale solo per questo dispositivo. {nativo ? 'Il telefono ne prepara in anticipo fino a tre ore: se il timer corre più a lungo, le altre si preparano quando riapri l’app. Serve il permesso delle notifiche.' : 'Sul sito e sull’app per computer le notifiche arrivano finché la pagina o la finestra è aperta.'}</div>
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

  return (
    <>
      <Back label="Impostazioni" />
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
        {!isNative() && !/Electron/i.test(navigator.userAgent) && (
          <div className="field">
            <span>App per Windows<span className="t2" style={{ display: 'block' }}>MyTask-v{VERSIONE}.exe</span></span>
            <a className="btn solid" href={INSTALLER_WINDOWS} download style={{ padding: '7px 14px', minHeight: 0 }}>Scarica</a>
          </div>
        )}
        <CodiceOrologio />
        <div className="btns col" style={{ marginTop: 18 }}>
          <button className="btn danger" onClick={async () => { if (window.confirm('Uscire? I dati restano su questo dispositivo.')) { await logout(); await setAuth({ email: auth.email }); } }}>Esci</button>
        </div>
        <div className="t2" style={{ marginTop: 16 }}>Oggi è {today()}. Il database sul NAS fa una copia di sicurezza ogni giorno.</div>
      </div>
    </>
  );
}

/** Orologio (Amazfit/Zepp OS): codice dedicato, mostrato una sola volta alla creazione, da incollare nelle impostazioni dell'app MyTask dentro l'app Zepp. Si può sostituire o revocare. */
function CodiceOrologio() {
  const [attivo, setAttivo] = useState<boolean | undefined>();
  const [codice, setCodice] = useState<string | undefined>();
  useEffect(() => { codiceOrologioAttivo().then(setAttivo).catch(() => undefined); }, []);
  const crea = async () => {
    try { setCodice(await creaCodiceOrologio()); setAttivo(true); } catch (e) { mostraToast(e instanceof Error ? e.message : 'Operazione non riuscita'); }
  };
  const revoca = async () => {
    if (!window.confirm("Revocare il codice? L'orologio smette di collegarsi finché non ne crei uno nuovo.")) return;
    try { await revocaCodiceOrologio(); setAttivo(false); setCodice(undefined); } catch (e) { mostraToast(e instanceof Error ? e.message : 'Operazione non riuscita'); }
  };
  if (attivo === undefined) return null;
  const server = apiBase() || location.origin;
  return (
    <div style={{ marginTop: 14 }}>
      <Field label="Orologio (Amazfit)"><span>{attivo ? 'Codice attivo' : 'Nessun codice'}</span></Field>
      {codice && (
        <div className="t2" style={{ padding: '4px 0 8px', wordBreak: 'break-all' }}>
          Indirizzo: <b>{server}</b><br />Codice (si vede solo ora): <b>{codice}</b>
          <div className="btns" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => { void navigator.clipboard?.writeText(codice).then(() => mostraToast('Codice copiato')); }}>Copia il codice</button>
          </div>
        </div>
      )}
      <div className="btns" style={{ gap: 8 }}>
        <button className="btn" onClick={() => { void crea(); }}>{attivo ? 'Nuovo codice' : 'Crea codice'}</button>
        {attivo && <button className="btn danger" onClick={() => { void revoca(); }}>Revoca</button>}
      </div>
    </div>
  );
}

/** Ultimo installer per computer (Windows), pubblicato da GitHub Actions insieme all'APK. */
const INSTALLER_WINDOWS = `https://github.com/jstPlink/MyTask/releases/download/v${VERSIONE}/MyTask-v${VERSIONE}.exe`;

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
