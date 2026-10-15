import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item } from '../../shared/types.ts';
import { useAuth, useToast } from './lib/hooks.ts';
import { useMediaQuery } from './lib/media.ts';
import { chiudiToast } from './lib/toast.ts';
import { clsx } from './lib/util.ts';
import { NavContext, type Nav, type Screen, type SubFare, type SubScoprire, type Tab } from './ui/nav.tsx';
import { TabBar } from './ui/kit.tsx';
import { Sidebar } from './ui/Sidebar.tsx';
import { TopBar } from './ui/TopBar.tsx';
import { Oggi } from './screens/Oggi.tsx';
import { Fare } from './screens/Fare.tsx';
import { Scoprire } from './screens/Scoprire.tsx';
import { Routine } from './screens/Routine.tsx';
import { Ricerca } from './screens/Ricerca.tsx';
import { ItemDetail } from './screens/ItemDetail.tsx';
import { Capture } from './screens/Capture.tsx';
import { Login } from './screens/Login.tsx';
import { TempoLibero } from './screens/TempoLibero.tsx';
import { RecensioneSheet } from './ui/Recensione.tsx';
import { Account, Altro, Archivio, Aspetto, DaParte, Inbox, Luoghi, Notifiche, PersonaDetail, Persone, Revisione, Stasera } from './screens/Secondarie.tsx';

interface Posizione { tab: Tab; fareSub: SubFare; scoprireSub: SubScoprire }

function Schermata({ s }: { s: Screen }) {
  switch (s.k) {
    case 'item': return <ItemDetail id={s.id} nuovo={s.nuovo} />;
    case 'altro': return <Altro />;
    case 'inbox': return <Inbox />;
    case 'revisione': return <Revisione />;
    case 'archivio': return <Archivio />;
    case 'daparte': return <DaParte />;
    case 'persone': return <Persone />;
    case 'persona': return <PersonaDetail id={s.id} />;
    case 'luoghi': return <Luoghi />;
    case 'aspetto': return <Aspetto />;
    case 'tempolibero': return <TempoLibero />;
    case 'notifiche': return <Notifiche />;
    case 'stasera': return <Stasera />;
    case 'account': return <Account />;
  }
}

const chiaveSchermata = (stack: Screen[], top: Screen) => stack.length + top.k + ('id' in top ? (top.id ?? '') : '');

function ToastView() {
  const toast = useToast();
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.testo}</span>
      {toast.azione && <button onClick={() => { toast.azione!.fn(); chiudiToast(); }}>{toast.azione.label}</button>}
    </div>
  );
}

export function App() {
  const auth = useAuth();
  const wide = useMediaQuery('(min-width: 900px)');
  const xl = useMediaQuery('(min-width: 1300px)');
  const [pos, setPos] = useState<Posizione>({ tab: 'oggi', fareSub: 'azioni', scoprireSub: 'film' });
  const [stack, setStack] = useState<Screen[]>([]);
  const [capture, setCapture] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [query, setQuery] = useState('');

  const openCapture = useCallback((open: boolean, testo = '') => { setCapture(open); setCaptureText(open ? testo : ''); }, []);

  // Cronologia delle posizioni (scheda e sotto-sezione) già visitate: "indietro" ci torna.
  const posRef = useRef(pos);
  const cronRef = useRef<Posizione[]>([]);
  const stackLen = useRef(0);
  stackLen.current = stack.length;
  const applicaPos = (p: Posizione) => { posRef.current = p; setPos(p); };

  const vaTab = useCallback((tab: Tab, sub?: { fare?: SubFare; scoprire?: SubScoprire }) => {
    const cur = posRef.current;
    const next: Posizione = { tab, fareSub: sub?.fare ?? cur.fareSub, scoprireSub: sub?.scoprire ?? cur.scoprireSub };
    setStack([]);
    if (next.tab === cur.tab && next.fareSub === cur.fareSub && next.scoprireSub === cur.scoprireSub) return;
    // le sotto-sezioni di una scheda che non è quella aperta non contano come spostamento
    cronRef.current = [...cronRef.current.slice(-29), cur];
    history.pushState({ d: 0, m: cronRef.current.length }, '');
    applicaPos(next);
  }, []);
  const setTab = useCallback((t: Tab) => vaTab(t), [vaTab]);
  const setFareSub = useCallback((s: SubFare) => vaTab('fare', { fare: s }), [vaTab]);
  const setScoprireSub = useCallback((s: SubScoprire) => vaTab('scoprire', { scoprire: s }), [vaTab]);

  // il tasto "indietro" (telefono o browser) chiude la schermata in cima e poi torna alla posizione precedente
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const d = (e.state as { d?: number } | null)?.d ?? 0;
      if (stackLen.current > d) { setStack((s) => s.slice(0, d)); return; }
      const prima = cronRef.current[cronRef.current.length - 1];
      if (prima) { cronRef.current = cronRef.current.slice(0, -1); applicaPos(prima); setStack([]); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const push = useCallback((s: Screen) => {
    setCapture(false);
    const d = stackLen.current + 1;
    stackLen.current = d;
    if (!wide) history.pushState({ d }, '');
    setStack((cur) => [...cur, s]);
  }, [wide]);
  const pop = useCallback(() => {
    if (stackLen.current === 0) { history.back(); return; }
    if (!wide && history.state && (history.state as { d?: number }).d) history.back();
    else setStack((s) => s.slice(0, -1));
  }, [wide]);
  const vai = useCallback((s: Screen) => { setCapture(false); setStack([s]); }, []);
  const nuova = useCallback((p: Partial<Item>) => push({ k: 'item', nuovo: p }), [push]);

  const { tab, fareSub, scoprireSub } = pos;
  const top = stack[stack.length - 1];
  const openId = top?.k === 'item' ? top.id : undefined;

  const nav = useMemo<Nav>(() => ({
    tab, setTab, vaTab, stack, push, pop, fareSub, setFareSub, scoprireSub, setScoprireSub,
    capture, captureText, openCapture, wide, xl, vai, openId, query, setQuery, nuova,
  }), [tab, setTab, vaTab, stack, push, pop, fareSub, setFareSub, scoprireSub, setScoprireSub, capture, captureText, openCapture, wide, xl, vai, openId, query, nuova]);

  // scorciatoie da tastiera (schermi larghi): N cattura, / cerca, Esc chiude
  useEffect(() => {
    if (!wide || !auth.token) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const scrivendo = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape') {
        if (capture) setCapture(false);
        else if (query) setQuery('');
        else if (stack.length) pop();
        else if (scrivendo) t?.blur();
        return;
      }
      if (scrivendo || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); document.getElementById('cattura-rapida')?.focus(); }
      else if (e.key === '/') { e.preventDefault(); document.getElementById('ricerca')?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, auth.token, capture, query, stack.length, pop]);

  if (!auth.token) return <div className="app app-login"><Login /></div>;

  const tabScreen = (
    <>
      {tab === 'oggi' && <Oggi />}
      {tab === 'fare' && <Fare />}
      {tab === 'scoprire' && <Scoprire />}
      {tab === 'routine' && <Routine />}
    </>
  );

  if (!wide) {
    return (
      <NavContext.Provider value={nav}>
        <div className="app">
          {top ? <Schermata key={chiaveSchermata(stack, top)} s={top} /> : tabScreen}
          <TabBar />
          {capture && <Capture />}
          <RecensioneSheet />
          <ToastView />
        </div>
      </NavContext.Provider>
    );
  }

  // schermi larghi: barra laterale, area principale e, se c'è spazio, pannello di dettaglio
  const nelPannello = xl && top?.k === 'item' ? top : undefined;
  const principale: ReactNode = query.trim().length >= 2
    ? <Ricerca />
    : top && !nelPannello
      ? <div className={clsx('page', (stack.length > 1 || top.k === 'item') && 'keep-back')}><Schermata key={chiaveSchermata(stack, top)} s={top} /></div>
      : <div className="page">{tabScreen}</div>;

  return (
    <NavContext.Provider value={nav}>
      <div className={clsx('shell', nelPannello && 'with-pane')}>
        <Sidebar />
        <main className="main">
          <TopBar />
          <div className="main-body">{principale}</div>
        </main>
        {nelPannello && (
          <aside className="pane" aria-label="Dettaglio">
            <Schermata key={chiaveSchermata(stack, nelPannello)} s={nelPannello} />
          </aside>
        )}
        {capture && <Capture />}
        <RecensioneSheet />
        <ToastView />
      </div>
    </NavContext.Provider>
  );
}
