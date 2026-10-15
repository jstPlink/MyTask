import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from '../lib/util.ts';
import { useNav, type Tab } from './nav.tsx';

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
  /** Area (Casa, Burocrazia…): pillola colorata sulla riga del titolo. */
  tag?: string;
  /** Colonna a sinistra del titolo, per l'orario nel piano della giornata. */
  ora?: ReactNode;
  level?: 1 | 2 | 3;
  check?: 'circle' | 'square' | 'none';
  done?: boolean;
  light?: boolean;
  struck?: boolean;
  selected?: boolean;
  onCheck?: () => void;
  onOpen?: () => void;
}

/** Tinta della pillola di un'area: fissa per le aree più comuni, per le altre stabile per nome. */
const AREE_NOTE: Record<string, number> = { casa: 1, burocrazia: 2, digitale: 3, salute: 4, lavoro: 5 };
export const classeArea = (nome: string) => {
  const n = nome.trim().toLowerCase();
  if (n in AREE_NOTE) return `a${AREE_NOTE[n]}`;
  let h = 7;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `a${(h % 5) + 1}`;
};

export function Row({ titolo, meta, right, tag, ora, level, check = 'circle', done, light, struck, selected, onCheck, onOpen }: RowProps) {
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
          {tag && <span className={clsx('tag', classeArea(tag))}>{tag}</span>}
        </div>
        {meta && <div className="t2">{meta}</div>}
      </div>
      {right && <div className="right">{right}</div>}
    </>
  );
  const cls = clsx('row', level && `p${level}`, selected && 'sel');
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

export type NomeIcona = 'oggi' | 'fare' | 'scoprire' | 'routine' | 'inbox' | 'altro';

/** Icone delle sezioni principali (tratto semplice, prendono il colore del testo). */
export function Icona({ nome, size = 24 }: { nome: NomeIcona; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {nome === 'oggi' && <g {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></g>}
      {nome === 'fare' && <g {...p}><rect x="3.5" y="4" width="17" height="16" rx="4.5" /><path d="M8 12.2l3 3 5-6" /></g>}
      {nome === 'scoprire' && <g {...p}><circle cx="12" cy="12" r="9" /><path d="M15.8 8.2l-2.1 5.5-5.5 2.1 2.1-5.5z" /></g>}
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
  { id: 'oggi', nome: 'Oggi' }, { id: 'fare', nome: 'Attività' }, { id: 'scoprire', nome: 'Intrattenimento' }, { id: 'routine', nome: 'Routine' },
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

export function Fab({ onClick, label = 'Nuova voce' }: { onClick: () => void; label?: string }) {
  return <button className="fab" onClick={onClick} aria-label={label}>+</button>;
}

export interface VoceScelta<T extends string> { id: T; nome: string; icona: ReactNode }

/** Tendina con icona o colore per ogni voce (al posto del select del browser). */
export function Scelta<T extends string>({ label, valore, voci, onChange }: { label: string; valore: T; voci: VoceScelta<T>[]; onChange: (v: T) => void }) {
  const [aperto, setAperto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
export function Gruppo({ titolo, children }: { titolo?: string; children: ReactNode }) {
  return (
    <section className="gruppo">
      {titolo && <h3 className="gruppo-t">{titolo}</h3>}
      {children}
    </section>
  );
}
