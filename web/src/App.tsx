import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { Account, Altro, Archivio, Aspetto, Inbox, Luoghi, Notifiche, PersonaDetail, Persone, Revisione, Stasera } from './screens/Secondarie.tsx';

function Schermata({ s }: { s: Screen }) {
  switch (s.k) {
    case 'item': return <ItemDetail id={s.id} nuovo={s.nuovo} />;
    case 'altro': return <Altro />;
    case 'inbox': return <Inbox />;
    case 'revisione': return <Revisione />;
    case 'archivio': return <Archivio />;
    case 'persone': return <Persone />;
    case 'persona': return <PersonaDetail id={s.id} />;
    case 'luoghi': return <Luoghi />;
    case 'aspetto': return <Aspetto />;
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
  const [tab, setTabState] = useState<Tab>('oggi');
  const [stack, setStack] = useState<Screen[]>([]);
  const [fareSub, setFareSub] = useState<SubFare>('azioni');
  const [scoprireSub, setScoprireSub] = useState<SubScoprire>('film');
  const [capture, setCapture] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [query, setQuery] = useState('');

  const openCapture = useCallback((open: boolean, testo = '') => { setCapture(open); setCaptureText(open ? testo : ''); }, []);

  // il tasto "indietro" del telefono chiude la schermata in cima (solo nel layout stretto)
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setStack((s) => s.slice(0, (e.state as { d?: number } | null)?.d ?? 0));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const push = useCallback((s: Screen) => {
    setCapture(false);
    setStack((cur) => {
      if (!wide) history.pushState({ d: cur.length + 1 }, '');
      return [...cur, s];
    });
  }, [wide]);
  const pop = useCallback(() => {
    if (!wide && history.state && (history.state as { d?: number }).d) history.back();
    else setStack((s) => s.slice(0, -1));
  }, [wide]);
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    setStack((cur) => {
      if (!wide && cur.length && history.state && (history.state as { d?: number }).d) history.go(-cur.length);
      return [];
    });
  }, [wide]);
  const vai = useCallback((s: Screen) => { setCapture(false); setStack([s]); }, []);
  const nuova = useCallback((p: Partial<Item>) => push({ k: 'item', nuovo: p }), [push]);

  const top = stack[stack.length - 1];
  const openId = top?.k === 'item' ? top.id : undefined;

  const nav = useMemo<Nav>(() => ({
    tab, setTab, stack, push, pop, fareSub, setFareSub, scoprireSub, setScoprireSub,
    capture, captureText, openCapture, wide, xl, vai, openId, query, setQuery, nuova,
  }), [tab, setTab, stack, push, pop, fareSub, scoprireSub, capture, captureText, openCapture, wide, xl, vai, openId, query, nuova]);

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

  if (!auth.token) return <div className="app"><Login /></div>;

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
        <ToastView />
      </div>
    </NavContext.Provider>
  );
}
