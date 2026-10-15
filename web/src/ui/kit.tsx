import type { ReactNode } from 'react';
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
  return <div style={{ padding: 'calc(env(safe-area-inset-top) + 10px) 18px 0' }}><button className="back" onClick={pop}>‹ {label}</button></div>;
}

export function Sec({ a, b }: { a: string; b?: ReactNode }) {
  return <div className="sec"><span>{a}</span><span>{b}</span></div>;
}

export interface RowProps {
  titolo: string;
  meta?: ReactNode;
  right?: ReactNode;
  level?: 1 | 2 | 3;
  check?: 'circle' | 'square' | 'none';
  done?: boolean;
  light?: boolean;
  struck?: boolean;
  onCheck?: () => void;
  onOpen?: () => void;
}

export function Row({ titolo, meta, right, level, check = 'circle', done, light, struck, onCheck, onOpen }: RowProps) {
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
      <div className="grow">
        <div className={clsx('t1', light && 'light', struck && 'struck')}>{titolo}</div>
        {meta && <div className="t2">{meta}</div>}
      </div>
      {right && <div className="right">{right}</div>}
    </>
  );
  const cls = clsx('row', level && `p${level}`);
  return onOpen ? <button className={cls} onClick={onOpen}>{body}</button> : <div className={cls}>{body}</div>;
}

export function Chips({ voci, attivo, onChange, scroll }: { voci: string[]; attivo: string; onChange: (v: string) => void; scroll?: boolean }) {
  return (
    <div className={clsx('chips', scroll && 'scroll-x')}>
      {voci.map((v) => <button key={v} className={clsx('chip', v === attivo && 'on')} onClick={() => onChange(v)}>{v}</button>)}
    </div>
  );
}

export function Seg<T extends string>({ voci, attivo, onChange }: { voci: { id: T; nome: string }[]; attivo: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
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

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

const TAB_NOMI: { id: Tab; nome: string }[] = [
  { id: 'oggi', nome: 'Oggi' }, { id: 'fare', nome: 'Fare' }, { id: 'scoprire', nome: 'Scoprire' }, { id: 'routine', nome: 'Routine' },
];

export function TabBar() {
  const { tab, setTab, stack } = useNav();
  return (
    <nav className="tabs" aria-label="Sezioni">
      {TAB_NOMI.map((t) => (
        <button key={t.id} className={clsx(tab === t.id && stack.length === 0 && 'on')} onClick={() => setTab(t.id)} aria-current={tab === t.id && stack.length === 0 ? 'page' : undefined}>
          <i />{t.nome}
        </button>
      ))}
    </nav>
  );
}

export function Fab({ onClick, label = 'Nuova voce' }: { onClick: () => void; label?: string }) {
  return <button className="fab" onClick={onClick} aria-label={label}>+</button>;
}
