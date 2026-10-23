// Componenti di base condivisi da tutte le schermate: intestazioni, righe di lista, controlli dei moduli,
// barra delle schede (telefono), pulsante "+" e raggruppamenti. Sul sito largo (≥900px) la barra delle schede
// non si vede: la navigazione è nella Sidebar.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { clsx, durataLavoro, nomeTempo } from '../lib/util.ts';
import { useAdesso, useItems, useSessione } from '../lib/hooks.ts';
import { tempoDi } from '../lib/sessione.ts';
import { formatoCronometro } from '../../../shared/sessione.ts';
import { stimaProgetto } from '../../../shared/views.ts';
import { livelloMargine, percentuale } from '../../../shared/stima.ts';
import { useLayer, useNav, type Tab } from './nav.tsx';
import { GlifoTipo } from './Icone.tsx';
import { avanzaStato, statoVisto } from '../lib/actions.ts';
import { apriStatoMenu } from '../lib/statoMenu.ts';
import type { Item, Stato, Tipo } from '../../../shared/types.ts';
import { battito } from '../lib/battito.ts';

/** Intestazione di una schermata: titolo, sottotitolo grigio e, a destra, un elemento libero (di solito i pulsanti tondi). */
export function Top({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="top">
      <div style={{ minWidth: 0 }}>
        <div className="title">{title}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/** Freccia «‹ etichetta» in cima alle schermate aperte sopra una scheda: torna alla schermata precedente della pila. */
export function Back({ label = 'Indietro' }: { label?: string }) {
  const { pop } = useNav();
  return <div style={{ padding: 'calc(env(safe-area-inset-top) + 6px) 18px 0' }}><button className="back" onClick={pop} aria-label={label}><span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>‹</span>{label}</button></div>;
}

/** Intestazione di sezione piccola (grigia, maiuscola): testo a sinistra `a` e un dettaglio opzionale `b` a destra. */
export function Sec({ a, b }: { a: string; b?: ReactNode }) {
  return <div className="sec"><span>{a}</span><span>{b}</span></div>;
}

/** Proprietà di `Row`. */
interface RowProps {
  titolo: string;
  meta?: ReactNode;
  right?: ReactNode;
  /** Tipo della nota: la sua icona compare, piccola, a sinistra del titolo. */
  tipo?: Tipo;
  /** Livello di priorità (1-3): spessore della barra colorata a sinistra. */
  level?: 1 | 2 | 3;
  /** Checkbox e parte destra centrati in verticale sulla riga. */
  centrato?: boolean;
  /** Posizione in classifica (1 = la prima da fare): numero colorato a destra, nel colore del livello. */
  rank?: number;
  /** Interesse 1-5 (Intrattenimento, Curiosità, Esperienze): numero in un pallino verde che si riempie con l'interesse, fermo. */
  interesse?: number;
  /** La nota della riga: la casella ha quattro stati (un tocco avanza, pressione lunga apre il menu). */
  voce?: Item;
  /** Riga riordinabile: a sinistra c'è la maniglia di trascinamento. */
  maniglia?: boolean;
  /** Classe in più (es. riga sollevata durante il trascinamento). */
  classe?: string;
  /** Attributi in più sulla riga (gestori del trascinamento). */
  extra?: React.HTMLAttributes<HTMLElement>;
  /** Urgenza 0-100: il numero d'ordine batte a ritmo crescente con l'urgenza (fermo se 0 o assente). */
  urgenza?: number;
  /** Forma della casella a destra (`none` la toglie). Con `voce` la casella è sempre quella a quattro stati. */
  check?: 'circle' | 'square' | 'none';
  /** Casella piena, per le righe senza `voce`. */
  done?: boolean;
  /** Titolo attenuato (voci chiuse o poco interessanti). */
  light?: boolean;
  /** Titolo barrato. */
  struck?: boolean;
  /** Riga evidenziata: è la voce aperta nel pannello a destra (schermo molto largo). */
  selected?: boolean;
  /** Tocco sulla casella semplice (senza `voce`); senza questo la casella non è interattiva. */
  onCheck?: () => void;
  /** Se c'è, la riga è un pulsante che apre la voce. */
  onOpen?: () => void;
}

/** Classe CSS della casella per uno stato: «da fare» con un cerchio tratteggiato appena visibile, «in corso» col pallino verde che pulsa piano, «in pausa» col pallino giallo, «fatta» piena con un anello bianco (senza spunta), «archiviata» tratteggiata col cerchio tratteggiato. */
export function ClasseCasella(s: Stato): string {
  const v = statoVisto(s);
  return v === 'in_corso' ? 'viva' : v === 'in_pausa' ? 'pausa' : v === 'fatto' ? 'done' : v === 'parcheggiato' ? 'arch' : 'dafare';
}

/** Dopo quanto tempo di pressione la casella apre il foglio con tutti gli stati (millisecondi). */
const PRESSIONE_LUNGA_MS = 380;

/**
 * Casella di stato di una nota. **Un tocco fa avanzare lo stato**: «da fare» e «in pausa» → «in corso» (le attività e le curiosità
 * si aprono a tutto schermo), «in corso» → «fatta» (è l'unico modo di chiudere una nota dalla casella, e solo se è in corso),
 * «fatta» o «archiviata» → «da fare». **Tenendo premuto** (o col tasto destro) si apre il foglio con tutti gli stati, per sceglierne
 * un altro (in pausa, archiviata…).
 */
function CasellaStato({ voce }: { voce: Item }) {
  const stato = statoVisto(voce.stato);
  const nome = { da_fare: 'da fare', in_corso: 'in corso', in_pausa: 'in pausa', fatto: 'fatta', parcheggiato: 'archiviata' }[stato as 'da_fare'] ?? '';
  const timer = useRef<number | undefined>(undefined);
  const lungo = useRef(false);
  const ferma = () => { window.clearTimeout(timer.current); };
  const parti = () => {
    lungo.current = false;
    ferma();
    timer.current = window.setTimeout(() => { lungo.current = true; navigator.vibrate?.(25); apriStatoMenu(voce); }, PRESSIONE_LUNGA_MS);
  };
  return (
    <span
      className={clsx('cb', ClasseCasella(voce.stato))}
      role="button"
      aria-label={`«${voce.titolo}»: ${nome}. Tocca per avanzare, tieni premuto per scegliere lo stato`}
      style={{ cursor: 'pointer', touchAction: 'manipulation', userSelect: 'none', WebkitTouchCallout: 'none' }}
      onPointerDown={parti}
      onPointerUp={ferma}
      onPointerLeave={ferma}
      onPointerCancel={ferma}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!lungo.current) apriStatoMenu(voce); }}
      onClick={(e) => {
        e.stopPropagation();
        if (lungo.current) { lungo.current = false; return; } // il rilascio dopo una pressione lunga non è un tocco
        navigator.vibrate?.(12);
        avanzaStato(voce);
      }}
    />
  );
}

/**
 * Riga di lista: priorità a sinistra (barra), titolo con riga grigia sotto, parte destra libera e casella.
 * Con `voce` la casella gestisce da sola gli stati della nota; senza, è una casella semplice comandata da `done`/`onCheck`.
 */
export function Row({ titolo, meta, right, tipo, level, rank, interesse, voce, maniglia, classe, extra, urgenza, check = 'circle', done, light, struck, centrato, selected, onCheck, onOpen }: RowProps) {
  // Una nota «in corso» o «in pausa» mostra al posto della riga grigia la barra del tempo (fissa; gialla in pausa, rossa oltre la stima) con «tempo lavorato / stima».
  const sessione = useSessione();
  const vs = voce ? statoVisto(voce.stato) : undefined;
  const conTempo = !!voce && (vs === 'in_corso' || vs === 'in_pausa');
  const adesso = useAdesso(conTempo && sessione.stato === 'lavoro' && sessione.taskId === voce?.id);
  const ms = conTempo ? tempoDi(voce, adesso) : 0;
  const quota = conTempo && voce.sforzoMin ? ms / (voce.sforzoMin * 60_000) : undefined;
  const body = (
    <>
      {maniglia && <span className="maniglia" data-grip aria-hidden="true"><i /></span>}
      {rank !== undefined && <span className="rank" style={urgenza ? battito(urgenza, rank) : undefined} aria-label={`Posizione ${rank}`}>{rank}</span>}
      {interesse !== undefined && <span className={clsx('rank', 'rank-int', `g${Math.round(interesse)}`)} role="img" aria-label={`Interesse ${Math.round(interesse)} su 5`}>{Math.round(interesse)}</span>}
      <div className="grow">
        <div className="line">
          <div className={clsx('t1', (light || (voce && statoVisto(voce.stato) !== 'da_fare' && statoVisto(voce.stato) !== 'in_corso' && statoVisto(voce.stato) !== 'in_pausa')) && 'light', (struck || (voce && statoVisto(voce.stato) === 'fatto')) && 'struck')}>{tipo && <GlifoTipo tipo={tipo} />}{titolo}</div>
        </div>
        {conTempo ? (
          <div className="sr-riga">
            {quota !== undefined && <span className="sr-barra"><i style={{ width: `${Math.min(1, quota) * 100}%` }} /></span>}
            <span className="sr-tt"><b>{formatoCronometro(ms)}</b>{voce.sforzoMin ? ` / ${durataLavoro(voce.sforzoMin * 60_000)}` : ''}</span>
          </div>
        ) : meta && <div className="t2">{meta}</div>}
      </div>
      {right && <div className="right">{right}</div>}
      {check !== 'none' && voce && <CasellaStato voce={voce} />}
      {check !== 'none' && !voce && (
        <span
          className={clsx('cb', done && 'done')}
          role={onCheck ? 'checkbox' : undefined}
          aria-checked={onCheck ? !!done : undefined}
          aria-label={onCheck ? `Segna «${titolo}»` : undefined}
          onClick={onCheck ? (e) => { e.stopPropagation(); onCheck(); } : undefined}
          style={onCheck ? { cursor: 'pointer' } : undefined}
        />
      )}
    </>
  );
  const cls = clsx('row', level && `p${level}`, centrato && 'ctr', selected && 'sel', voce && statoVisto(voce.stato) === 'parcheggiato' && 'st-arch', conTempo && 'lav', vs === 'in_pausa' && 'pausa-lav', quota !== undefined && quota > 1 && 'oltre-lav', classe);
  return onOpen ? <button className={cls} onClick={onOpen} {...extra}>{body}</button> : <div className={cls} {...extra}>{body}</div>;
}

/** Fila di pulsanti-filtro: `attivo` è quello scelto; con `scroll` scorre in orizzontale invece di andare a capo. */
export function Chips({ voci, attivo, onChange, scroll }: { voci: string[]; attivo: string; onChange: (v: string) => void; scroll?: boolean }) {
  return (
    <div className={clsx('chips', scroll && 'scroll-x')}>
      {voci.map((v) => <button key={v} className={clsx('chip', v === attivo && 'on')} onClick={() => onChange(v)}>{v}</button>)}
    </div>
  );
}

/** Barra di ricerca di una lista: filtra mentre si scrive; la croce svuota il campo. */
export function Cerca({ valore, onChange, placeholder }: { valore: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="cerca" role="search">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16.5 16.5L21 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      <input type="search" value={valore} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      {valore && <button type="button" className="cerca-x" aria-label="Svuota la ricerca" onClick={() => onChange('')}>×</button>}
    </div>
  );
}

/** Selettore a segmenti (schede). `uguali` = segmenti di larghezza uguale; `nav` = variante che sul sito largo si nasconde perché c'è la barra laterale. */
/** Chip a scelta multipla: «Tutte» (nessun filtro) e le altre voci si accendono e si spengono una per una; più voci scelte insieme valgono come «una o l'altra». */
export function ChipsMulti({ voci, scelte, onChange, tutte = 'Tutte' }: { voci: string[]; scelte: string[]; onChange: (v: string[]) => void; tutte?: string }) {
  const alterna = (v: string) => onChange(scelte.includes(v) ? scelte.filter((x) => x !== v) : [...scelte, v]);
  return (
    <div className="chips scroll-x" role="group" aria-label="Filtri">
      <button type="button" className={clsx('chip', scelte.length === 0 && 'on')} aria-pressed={scelte.length === 0} onClick={() => onChange([])}>{tutte}</button>
      {voci.map((v) => <button key={v} type="button" className={clsx('chip', scelte.includes(v) && 'on')} aria-pressed={scelte.includes(v)} onClick={() => alterna(v)}>{v}</button>)}
    </div>
  );
}

export function Seg<T extends string>({ voci, attivo, onChange, nav, uguali, compatto }: { voci: { id: T; nome: string }[]; attivo: T; onChange: (v: T) => void; nav?: boolean; uguali?: boolean; compatto?: boolean }) {
  return (
    <div className={clsx('seg', nav && 'nav-seg', uguali && 'uguali', compatto && 'compatto')} role="tablist">
      {voci.map((v) => <button key={v.id} role="tab" aria-selected={v.id === attivo} className={clsx(v.id === attivo && 'on')} onClick={() => onChange(v.id)}>{v.nome}</button>)}
    </div>
  );
}

/** Riga di un modulo: etichetta a sinistra e controllo (`children`) a destra. Con `onClick` diventa un pulsante-collegamento. */
export function Field({ label, children, onClick }: { label: string; children?: ReactNode; onClick?: () => void }) {
  const inner = <><span>{label}</span><span style={{ display: 'contents' }}>{children}</span></>;
  return onClick ? <button className="field link" onClick={onClick}>{inner}</button> : <label className="field">{inner}</label>;
}

/** Interruttore acceso/spento. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={clsx('toggle', !on && 'off')} onClick={() => onChange(!on)} />;
}

const NOMI_IMPORTANZA = ['', 'molto bassa', 'bassa', 'media', 'alta', 'molto alta'];

/**
 * Valore da 1 a 5 (importanza, interesse) con uno slider continuo a cuneo: si allarga verso destra e passa dal grigio al rosso
 * (come le priorità), o al verde con `verde`. Il cursore prende il colore del punto raggiunto; senza valore parte da 3.
 */
export function SliderImportanza({ valore, onChange, label, verde }: { valore?: number; onChange: (v: number) => void; label: string; verde?: boolean }) {
  const v = valore ?? 3;
  const p = Math.min(1, Math.max(0, (v - 1) / 4)) * 100;
  const stile = { '--p': `${p}%`, '--col': `color-mix(in srgb, var(--soft) ${100 - p}%, var(${verde ? '--accent' : '--warn'}) ${p}%)` } as React.CSSProperties;
  return (
    <div className={clsx('slider-c', verde && 'slider-verde')} style={stile}>
      <div className="slider-tr" aria-hidden="true"><i /></div>
      <input type="range" min={1} max={5} step={0.01} value={v} aria-label={label} aria-valuetext={NOMI_IMPORTANZA[Math.round(v)]}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100) / 100)} />
    </div>
  );
}

/**
 * Importanza a doppio livello: prima il grado (1-5), poi lo slider a cuneo per rifinire dentro quel grado (il grado «4» copre da 3,5 a 4,5,
 * così il nome resta vero). Il valore salvato è un solo numero da 1 a 5, come con lo slider unico.
 */
export function ImportanzaDoppia({ valore, onChange, label }: { valore?: number; onChange: (v: number) => void; label: string }) {
  // Mentre si trascina lo slider il valore sta solo qui (fluido, passi di 0,01); si salva al rilascio o poco dopo l'ultimo movimento.
  const [locale, setLocale] = useState<number | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);
  const salva = (x: number) => { window.clearTimeout(timer.current); timer.current = undefined; setLocale(undefined); onChange(x); };
  const muovi = (x: number) => { setLocale(x); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => salva(x), 250); };
  const v = Math.min(5, Math.max(1, locale ?? valore ?? 3));
  const k = Math.round(v);
  const lo = Math.max(1, k - 0.5), hi = Math.min(5, k + 0.5);
  const colore = (x: number) => `color-mix(in srgb, var(--warn) ${Math.round((x - 1) / 4 * 100)}%, var(--soft))`;
  const stile = { '--p': `${(v - lo) / (hi - lo) * 100}%`, '--col': colore(v) } as React.CSSProperties;
  return (
    <div className="imp-blocco" role="group" aria-label={label}>
      <div className="imp-t"><span>{label}</span><b>{v.toFixed(2).replace('.', ',')} · {NOMI_IMPORTANZA[k]}</b></div>
      <div className="imp-gradi">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={clsx(n === k && 'on')} style={{ '--c': colore(n) } as React.CSSProperties}
            aria-pressed={n === k} aria-label={`Grado ${n}: ${NOMI_IMPORTANZA[n]}`} onClick={() => salva(n)}>{n}</button>
        ))}
      </div>
      <div className="slider-c largo" style={stile}>
        <div className="slider-tr" aria-hidden="true"><i /></div>
        <input type="range" min={lo} max={hi} step={0.01} value={v} aria-label={`${label}: rifinitura dentro il grado ${NOMI_IMPORTANZA[k]}`}
          onChange={(e) => muovi(Math.round(Number(e.target.value) * 100) / 100)}
          onPointerUp={(e) => salva(Math.round(Number(e.currentTarget.value) * 100) / 100)} />
      </div>
      <div className="imp-ag"><span>basso</span><span>alto</span></div>
    </div>
  );
}

/** Margine delle stime con segno: il colore dice quanto è giusta la stima, vicino a zero è bene (verde fino a ±15%, ambra fino a ±30%, rosso oltre). */
export function Margine({ valore }: { valore: number }) {
  return <span className={clsx('mg', `mg-${livelloMargine(valore)}`)}>{percentuale(valore)}</span>;
}

/** Unisce i pezzi della riga grigia con « · » (accetta anche elementi, non solo testo). */
export function unisciMeta(pezzi: (ReactNode | false | undefined | null)[]): ReactNode {
  const vivi = pezzi.filter((p): p is ReactNode => p !== false && p !== undefined && p !== null && p !== '');
  return vivi.map((p, i) => <span key={i}>{i > 0 ? ' · ' : ''}{p}</span>);
}

export type NomeIcona = 'oggi' | 'fare' | 'scoprire' | 'curiosita' | 'routine' | 'inbox' | 'altro' | 'aspetto';

/** Icone delle sezioni principali (tratto semplice, prendono il colore del testo). */
export function Icona({ nome, size = 24 }: { nome: NomeIcona; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {nome === 'oggi' && <g {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></g>}
      {nome === 'fare' && <g {...p}><rect x="3.5" y="4" width="17" height="16" rx="4.5" /><path d="M8 12.2l3 3 5-6" /></g>}
      {nome === 'scoprire' && <g {...p}><circle cx="12" cy="12" r="9" /><path d="M15.8 8.2l-2.1 5.5-5.5 2.1 2.1-5.5z" /></g>}
      {nome === 'curiosita' && <g {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></g>}
      {nome === 'aspetto' && <g {...p}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" fill="currentColor" /><circle cx="10" cy="7.2" r="1" fill="currentColor" /><circle cx="14.5" cy="7.2" r="1" fill="currentColor" /></g>}
      {nome === 'routine' && <g {...p}><path d="M17 2.5l3.5 3.5L17 9.5" /><path d="M3.5 11V9.5A3.5 3.5 0 0 1 7 6h13.5" /><path d="M7 21.5L3.5 18 7 14.5" /><path d="M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5" /></g>}
      {nome === 'inbox' && <g {...p}><path d="M3.5 13.5L6.2 5.6A1.5 1.5 0 0 1 7.6 4.5h8.8a1.5 1.5 0 0 1 1.4 1.1l2.7 7.9" /><path d="M3.5 13.5v4.2a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.2h-5.2l-1 2.2H9.7l-1-2.2z" /></g>}
      {nome === 'altro' && <g fill="currentColor"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></g>}
    </svg>
  );
}

/** Messaggio di lista vuota. */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Nomi delle cinque schede; `breve` è il nome che sta nella barra del telefono, dove «Intrattenimento» non entra. */
const TAB_NOMI: { id: Tab; nome: string; breve?: string }[] = [
  { id: 'oggi', nome: 'Priorità' }, { id: 'fare', nome: 'Attività' }, { id: 'scoprire', nome: 'Intrattenimento', breve: 'Intratten.' }, { id: 'curiosita', nome: 'Curiosità' }, { id: 'routine', nome: 'Routine' },
];

/** Barra delle cinque schede in basso (solo telefono, con le icone: sul sito la barra laterale è senza). Nessuna scheda risulta attiva mentre è aperta una schermata sopra la pila. */
export function TabBar() {
  const { tab, setTab, stack } = useNav();
  return (
    <nav className="tabs" aria-label="Sezioni">
      {TAB_NOMI.map((t) => (
        <button key={t.id} className={clsx(tab === t.id && stack.length === 0 && 'on')} onClick={() => setTab(t.id)} aria-label={t.nome} aria-current={tab === t.id && stack.length === 0 ? 'page' : undefined}>
          <span className="ic"><Icona nome={t.id} size={22} /></span>
          <span className="tab-nome">{t.breve ?? t.nome}</span>
        </button>
      ))}
    </nav>
  );
}

/** Pulsante "+": da ogni schermata apre la cattura rapida ("Cosa ti è venuto in mente?"). */
export function Fab() {
  const nav = useNav();
  return <button className="fab" onClick={() => nav.openCapture(true)} aria-label="Cattura rapida">+</button>;
}

interface VoceScelta<T extends string> { id: T; nome: string; icona: ReactNode | null }

/**
 * Tendina con icona per ogni voce, al posto del select del browser. Il menu aperto è un livello della pila:
 * "indietro" lo chiude senza lasciare la schermata; chiude anche un tocco fuori o Esc.
 */
export function Scelta<T extends string>({ label, valore, voci, onChange }: { label: string; valore: T; voci: VoceScelta<T>[]; onChange: (v: T) => void }) {
  const [aperto, setAperto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // un livello per ogni tendina: due tendine nella stessa scheda (Tipo e Sezione) non devono chiudersi a vicenda
  const idLayer = useId();
  useLayer(`scelta${idLayer}`, aperto, () => setAperto(false));
  useEffect(() => {
    if (!aperto) return;
    const chiudi = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setAperto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAperto(false); } };
    document.addEventListener('pointerdown', chiudi);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('pointerdown', chiudi); document.removeEventListener('keydown', esc, true); };
  }, [aperto]);
  const corrente = voci.find((v) => v.id === valore) ?? voci[0];
  return (
    <div className="field scelta-field" ref={ref}>
      <span>{label}</span>
      <div className="scelta">
        <button type="button" className="scelta-btn" aria-haspopup="listbox" aria-expanded={aperto} aria-label={`${label}: ${corrente?.nome}`} onClick={() => setAperto(!aperto)}>
          {corrente?.icona}<b>{corrente?.nome}</b><span className="scelta-freccia" aria-hidden="true">▾</span>
        </button>
        {aperto && (
          <ul className="scelta-menu" role="listbox" aria-label={label}>
            {voci.map((v) => (
              <li key={v.id} role="option" aria-selected={v.id === valore}>
                <button type="button" className={clsx(v.id === valore && 'on')} onClick={() => { onChange(v.id); setAperto(false); }}>{v.icona}<span>{v.nome}</span></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Gruppo di campi di una scheda, con titolo e un dettaglio piccolo accanto al titolo. */
export function Gruppo({ titolo, dettaglio, children }: { titolo?: string; dettaglio?: ReactNode; children: ReactNode }) {
  return (
    <section className="gruppo">
      {titolo && <h3 className="gruppo-t">{titolo}{dettaglio !== undefined && <span className="gruppo-d">{dettaglio}</span>}</h3>}
      {children}
    </section>
  );
}

/**
 * Barra di avanzamento a tacchette: una per attività del progetto, piena per quelle fatte. Con `anima` le tacche si accendono
 * una dopo l'altra (animazione del pannello di avanzamento).
 */
export function Tacche({ fatti, totale, anima }: { fatti: number; totale: number; anima?: boolean }) {
  const n = Math.max(0, Math.round(totale));
  return (
    <div className={clsx('tacche', n > 40 && 'fitte')} role="img" aria-label={`${fatti} su ${n} fatte`}>
      {Array.from({ length: n }, (_, k) => <i key={k} className={k < fatti ? 'on' : undefined} style={anima ? { transitionDelay: `${Math.max(0, k - 0) * 40}ms` } : undefined} />)}
    </div>
  );
}

/**
 * Testata di progetto con le sue attività sotto (`children`): il tocco sulla testata apre il progetto; mostra
 * «stima del tempo · fatti / totale» e la barra a tacchette (una per attività) solo se il progetto ha passi.
 */
export function GruppoProgetto({ progetto, fatti, totale, children }: { progetto: Item; fatti: number; totale: number; children: ReactNode }) {
  const nav = useNav();
  const stima = stimaProgetto(progetto, useItems()); // la stima del progetto è la somma di quelle dei suoi passi ancora da fare
  return (
    <section className="gp">
      <button className="gp-h" onClick={() => nav.push({ k: 'item', id: progetto.id })} aria-label={`Apri il progetto ${progetto.titolo}`}>
        <span className="gp-ic" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
        </span>
        <b>{progetto.titolo}</b>
        {(totale > 0 || stima > 0) && <span>{[stima > 0 ? nomeTempo(stima) : undefined, totale > 0 ? `${fatti} / ${totale}` : undefined].filter(Boolean).join(' · ')}</span>}
      </button>
      {totale > 0 && <Tacche fatti={fatti} totale={totale} />}
      {children}
    </section>
  );
}

/** Sezione di una schermata: fascia con titolo grande tra due linee e, a destra, un dettaglio (di solito il conteggio); righe libere sotto, senza riquadro. */
export function Sezione({ titolo, dettaglio, children }: { titolo: string; dettaglio?: ReactNode; children: ReactNode }) {
  return (
    <section className="sezione">
      <h3 className="sz-t"><span>{titolo}</span>{dettaglio !== undefined && dettaglio !== null && dettaglio !== false && <b>{dettaglio}</b>}</h3>
      <div className="sz-corpo">{children}</div>
    </section>
  );
}
