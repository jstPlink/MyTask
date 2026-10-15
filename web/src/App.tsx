import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Item } from '../../shared/types.ts';
import { useAuth, useToast } from './lib/hooks.ts';
import { chiudiToast } from './lib/toast.ts';
import { NavContext, type Nav, type Screen, type SubFare, type SubScoprire, type Tab } from './ui/nav.tsx';
import { TabBar } from './ui/kit.tsx';
import { Oggi } from './screens/Oggi.tsx';
import { Fare } from './screens/Fare.tsx';
import { Scoprire } from './screens/Scoprire.tsx';
import { Routine } from './screens/Routine.tsx';
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

export function App() {
  const auth = useAuth();
  const toast = useToast();
  const [tab, setTabState] = useState<Tab>('oggi');
  const [stack, setStack] = useState<Screen[]>([]);
  const [fareSub, setFareSub] = useState<SubFare>('azioni');
  const [scoprireSub, setScoprireSub] = useState<SubScoprire>('film');
  const [capture, openCapture] = useState(false);

  // il tasto "indietro" del telefono chiude la schermata in cima
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setStack((s) => s.slice(0, (e.state as { d?: number } | null)?.d ?? 0));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const push = useCallback((s: Screen) => {
    openCapture(false);
    setStack((cur) => {
      history.pushState({ d: cur.length + 1 }, '');
      return [...cur, s];
    });
  }, []);
  const pop = useCallback(() => { if (history.state && (history.state as { d?: number }).d) history.back(); else setStack((s) => s.slice(0, -1)); }, []);
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    setStack((cur) => {
      if (cur.length && history.state && (history.state as { d?: number }).d) history.go(-cur.length);
      return [];
    });
  }, []);
  const nuova = useCallback((p: Partial<Item>) => push({ k: 'item', nuovo: p }), [push]);

  const nav = useMemo<Nav>(() => ({
    tab, setTab, stack, push, pop, fareSub, setFareSub, scoprireSub, setScoprireSub, capture, openCapture, nuova,
  }), [tab, setTab, stack, push, pop, fareSub, scoprireSub, capture, nuova]);

  if (!auth.token) return <div className="app"><Login /></div>;

  const top = stack[stack.length - 1];
  return (
    <NavContext.Provider value={nav}>
      <div className="app">
        {top ? <Schermata key={stack.length + top.k + ('id' in top ? (top.id ?? '') : '')} s={top} /> : (
          <>
            {tab === 'oggi' && <Oggi />}
            {tab === 'fare' && <Fare />}
            {tab === 'scoprire' && <Scoprire />}
            {tab === 'routine' && <Routine />}
          </>
        )}
        <TabBar />
        {capture && <Capture />}
        {toast && (
          <div className="toast" role="status" key={toast.id}>
            <span>{toast.testo}</span>
            {toast.azione && <button onClick={() => { toast.azione!.fn(); chiudiToast(); }}>{toast.azione.label}</button>}
          </div>
        )}
      </div>
    </NavContext.Provider>
  );
}
