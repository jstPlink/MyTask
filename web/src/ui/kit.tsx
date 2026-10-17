import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from '../lib/util.ts';
import { useLayer, useNav, type Tab } from './nav.tsx';
import type { Item } from '../../../shared/types.ts';
import { battito } from '../lib/battito.ts';

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

export function Back({ label = 'Indietro' }: { label?: string }) {
  const { pop } = useNav();
  return <div style={{ padding: 'calc(env(safe-area-inset-top) + 6px) 18px 0' }}><button className="back" onClick={pop} aria-label={label}><span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>‹</span>{label}</button></div>;
}

export function Sec({ a, b }: { a: string; b?: ReactNode }) {
  return <div className="sec"><span>{a}</span><span>{b}</span></div>;
}

export interface RowProps {
  titolo: string;
  meta?: ReactNode;
  right?: ReactNode;
  /** Colonna a sinistra del titolo, per l'orario nel piano della giornata. */
  ora?: ReactNode;
  level?: 1 | 2 | 3;
  /** Checkbox e parte destra centrati in verticale sulla riga. */
  centrato?: boolean;
  /** Posizione in classifica (1 = la prima da fare): numero colorato a destra, nel colore del livello. */
  rank?: number;
  /** Urgenza 0-100: il numero d'ordine batte a ritmo crescente con l'urgenza (fermo se 0 o assente). */
  urgenza?: number;
  check?: 'circle' | 'square' | 'none';
  done?: boolean;
  light?: boolean;
  struck?: boolean;
  selected?: boolean;
  onCheck?: () => void;
  onOpen?: () => void;
}

export function Row({ titolo, meta, right, ora, level, rank, urgenza, check = 'circle', done, light, struck, centrato, selected, onCheck, onOpen }: RowProps) {
  const body = (
    <>
      {check !== 'none' && (
        <span
          className={clsx('cb', check === 'square' && 'sq', done && 'done')}
          role={onCheck ? 'checkbox' : undefined}
          aria-checked={onCheck ? !!done : undefined}
          aria-label={onCheck ? `Segna «${titolo}»` : undefined}
          onClick={onCheck ? (e) => { e.stopPropagation(); onCheck(); } : undefined}
          style={onCheck ? { cursor: 'pointer' } : undefined}
        />
      )}
      {ora && <div className="piano-ora">{ora}</div>}
      <div className="grow">
        <div className="line">
          <div className={clsx('t1', light && 'light', struck && 'struck')}>{titolo}</div>
        </div>
        {meta && <div className="t2">{meta}</div>}
      </div>
      {right && <div className="right">{right}</div>}
      {rank !== undefined && <span className="rank" style={urgenza ? battito(urgenza) : undefined} aria-label={`Posizione ${rank}`}>{rank}</span>}
    </>
  );
  const cls = clsx('row', level && `p${level}`, centrato && 'ctr', selected && 'sel');
  return onOpen ? <button className={cls} onClick={onOpen}>{body}</button> : <div className={cls}>{body}</div>;
}

export function Chips({ voci, attivo, onChange, scroll }: { voci: string[]; attivo: string; onChange: (v: string) => void; scroll?: boolean }) {
  return (
    <div className={clsx('chips', scroll && 'scroll-x')}>
      {voci.map((v) => <button key={v} className={clsx('chip', v === attivo && 'on')} onClick={() => onChange(v)}>{v}</button>)}
    </div>
  );
}

export function Seg<T extends string>({ voci, attivo, onChange, nav }: { voci: { id: T; nome: string }[]; attivo: T; onChange: (v: T) => void; nav?: boolean }) {
  return (
    <div className={clsx('seg', nav && 'nav-seg')} role="tablist">
      {voci.map((v) => <button key={v.id} role="tab" aria-selected={v.id === attivo} className={clsx(v.id === attivo && 'on')} onClick={() => onChange(v.id)}>{v.nome}</button>)}
    </div>
  );
}

export function Field({ label, children, onClick }: { label: string; children?: ReactNode; onClick?: () => void }) {
  const inner = <><span>{label}</span><span style={{ display: 'contents' }}>{children}</span></>;
  return onClick ? <button className="field link" onClick={onClick}>{inner}</button> : <label className="field">{inner}</label>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={clsx('toggle', !on && 'off')} onClick={() => onChange(!on)} />;
}

export function DotsPick({ valore, onChange, label }: { valore?: number; onChange: (v: number | undefined) => void; label: string }) {
  return (
    <div className="dots-pick" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} su 5`} className={clsx((valore ?? 0) >= n && 'on')} onClick={() => onChange(valore === n ? undefined : n)} />
      ))}
    </div>
  );
}

const NOMI_IMPORTANZA = ['', 'molto bassa', 'bassa', 'media', 'alta', 'molto alta'];

/**
 * Importanza da 1 a 5 con uno slider continuo a cuneo: si allarga verso destra e passa dal grigio al rosso
 * (come le priorità), senza etichette di testo. Il cursore prende il colore del punto raggiunto.
 */
export function SliderImportanza({ valore, onChange, label }: { valore?: number; onChange: (v: number) => void; label: string }) {
  const v = valore ?? 3;
  const p = Math.min(1, Math.max(0, (v - 1) / 4)) * 100;
  const stile = { '--p': `${p}%`, '--col': `color-mix(in srgb, var(--soft) ${100 - p}%, var(--warn) ${p}%)` } as React.CSSProperties;
  return (
    <div className="slider-c" style={stile}>
      <div className="slider-tr" aria-hidden="true"><i /></div>
      <input type="range" min={1} max={5} step={0.05} value={v} aria-label={label} aria-valuetext={NOMI_IMPORTANZA[Math.round(v)]}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100) / 100)} />
    </div>
  );
}

/** Interesse da 1 a 5 con cinque pallini (11 px): nelle righe di intrattenimento e curiosità. */
export function PalliniInteresse({ valore }: { valore: number }) {
  return (
    <span className="pal-int" role="img" aria-label={`Interesse ${valore} su 5`}>
      {[1, 2, 3, 4, 5].map((n) => <i key={n} className={clsx(n <= valore && 'on')} />)}
    </span>
  );
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

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

const TAB_NOMI: { id: Tab; nome: string }[] = [
  { id: 'oggi', nome: 'Oggi' }, { id: 'fare', nome: 'Attività' }, { id: 'scoprire', nome: 'Intrattenimento' }, { id: 'curiosita', nome: 'Curiosità' }, { id: 'routine', nome: 'Routine' },
];

export function TabBar() {
  const { tab, setTab, stack } = useNav();
  return (
    <nav className="tabs" aria-label="Sezioni">
      {TAB_NOMI.map((t) => (
        <button key={t.id} className={clsx(tab === t.id && stack.length === 0 && 'on')} onClick={() => setTab(t.id)} aria-current={tab === t.id && stack.length === 0 ? 'page' : undefined}>
          <span className="ic"><Icona nome={t.id} /></span>{t.nome}
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

export interface VoceScelta<T extends string> { id: T; nome: string; icona: ReactNode }

/** Tendina con icona o colore per ogni voce (al posto del select del browser). */
export function Scelta<T extends string>({ label, valore, voci, onChange }: { label: string; valore: T; voci: VoceScelta<T>[]; onChange: (v: T) => void }) {
  const [aperto, setAperto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // il menu è un pannello della pila: "indietro" lo chiude senza lasciare la schermata
  useLayer('scelta', aperto, () => setAperto(false));
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

/** Gruppo di campi in una scheda con il suo titolo. */
export function Gruppo({ titolo, dettaglio, children }: { titolo?: string; dettaglio?: ReactNode; children: ReactNode }) {
  return (
    <section className="gruppo">
      {titolo && <h3 className="gruppo-t">{titolo}{dettaglio !== undefined && <span className="gruppo-d">{dettaglio}</span>}</h3>}
      {children}
    </section>
  );
}

/** Testata di progetto con le sue attività sotto: nome, avanzamento (fatti su totale) e barra. */
export function GruppoProgetto({ progetto, fatti, totale, children }: { progetto: Item; fatti: number; totale: number; children: ReactNode }) {
  const nav = useNav();
  return (
    <section className="gp">
      <button className="gp-h" onClick={() => nav.push({ k: 'item', id: progetto.id })} aria-label={`Apri il progetto ${progetto.titolo}`}>
        <span className="gp-ic" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
        </span>
        <b>{progetto.titolo}</b>
        {totale > 0 && <span>{fatti} / {totale}</span>}
      </button>
      {totale > 0 && <div className="gp-bar"><i style={{ width: `${(fatti / totale) * 100}%` }} /></div>}
      {children}
    </section>
  );
}

/** Sezione di una scheda (stile M3): fascia con titolo grande tra due linee e conteggio, righe libere sotto, senza contenitore. */
export function Sezione({ titolo, dettaglio, children }: { titolo: string; dettaglio?: ReactNode; children: ReactNode }) {
  return (
    <section className="sezione">
      <h3 className="sz-t"><span>{titolo}</span>{dettaglio !== undefined && dettaglio !== null && dettaglio !== false && <b>{dettaglio}</b>}</h3>
      <div className="sz-corpo">{children}</div>
    </section>
  );
}
