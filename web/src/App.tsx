import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item } from '../../shared/types.ts';
import { useAuth, useToast } from './lib/hooks.ts';
import { App as CapApp } from '@capacitor/app';
import { useMediaQuery } from './lib/media.ts';
import { isNative } from './lib/native.ts';
import { chiudiToast } from './lib/toast.ts';
import { clsx } from './lib/util.ts';
import { NavContext, type Nav, type Screen, type SubFare, type SubScoprire, type Tab } from './ui/nav.tsx';
import { TabBar } from './ui/kit.tsx';
import { Sidebar } from './ui/Sidebar.tsx';
import { Oggi } from './screens/Oggi.tsx';
import { Fare } from './screens/Fare.tsx';
import { Scoprire } from './screens/Scoprire.tsx';
import { Curiosita } from './screens/Curiosita.tsx';
import { Routine } from './screens/Routine.tsx';
import { Ricerca } from './screens/Ricerca.tsx';
import { ItemDetail } from './screens/ItemDetail.tsx';
import { Capture } from './screens/Capture.tsx';
import { Login } from './screens/Login.tsx';
import { PesiPriorita } from './screens/PesiPriorita.tsx';
import { IA } from './screens/IA.tsx';
import { Chat } from './screens/Chat.tsx';
import { RecensioneSheet } from './ui/Recensione.tsx';
import { StatoMenu } from './ui/StatoMenu.tsx';
import { CompletamentoSheet } from './ui/CompletamentoSheet.tsx';
import { AvanzamentoProgetto } from './ui/AvanzamentoProgetto.tsx';
import { ControlloSessione } from './ui/ControlloSessione.tsx';
import { Account, Altro, Archivio, Aspetto, DaParte, Inbox, NotificaTimer, Stasera } from './screens/Secondarie.tsx';

// Radice dell'interfaccia: sceglie tra accesso, layout stretto (telefono: una schermata + barra delle schede) e
// layout largo (computer: barra laterale e voce aperta in finestra), e gestisce la navigazione.
// La navigazione è una pila di «istantanee» (scheda, pila di schermate, finestre aperte): `indietro` le ripercorre
// al contrario. Sul sito la pila è agganciata alla cronologia del browser; nell'app Android è gestita a mano.

/** Scheda corrente e sottoschede scelte in «Da fare» e «Da scoprire». */
interface Posizione { tab: Tab; fareSub: SubFare; scoprireSub: SubScoprire }
/** Una voce della cronologia: dove si è (scheda, pila di schermate) e quali finestre sono aperte. */
interface Istantanea { pos: Posizione; stack: Screen[]; layers: string[] }
const INIZIO: Istantanea = { pos: { tab: 'oggi', fareSub: 'azioni', scoprireSub: 'film' }, stack: [], layers: [] };

/** Disegna una schermata della pila. */
function Schermata({ s }: { s: Screen }) {
  switch (s.k) {
    case 'item': return <ItemDetail id={s.id} nuovo={s.nuovo} />;
    case 'altro': return <Altro />;
    case 'inbox': return <Inbox />;
    case 'archivio': return <Archivio />;
    case 'daparte': return <DaParte />;
    case 'aspetto': return <Aspetto />;
    case 'timer': return <NotificaTimer />;
    case 'stasera': return <Stasera />;
    case 'account': return <Account />;
    case 'pesi': return <PesiPriorita />;
    case 'ia': return <IA />;
    case 'chat': return <Chat />;
  }
}

/** Chiave React della schermata: cambia con profondità, tipo e voce/giorno, così ogni apertura riparte da zero. */
const chiaveSchermata = (stack: Screen[], top: Screen) => stack.length + top.k + ('id' in top ? (top.id ?? '') : 'giorno' in top ? top.giorno : '');

/** Messaggio breve in basso con l'azione opzionale (per esempio «Annulla»). */
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

// Nell'app Android la pila è gestita da noi (nessun uso della cronologia del WebView) e il tasto indietro del telefono
// arriva dal plugin App: così funziona sempre, senza dipendere da come il WebView conta le voci di cronologia.
const NATIVO = isNative();

export function App() {
  const auth = useAuth();
  const wide = useMediaQuery('(min-width: 900px)');
  const xl = useMediaQuery('(min-width: 1300px)');
  const [snap, setSnap] = useState<Istantanea>(INIZIO);
  // testo precompilato per la finestra di cattura e testo della ricerca (nel layout largo, mostrata al posto della scheda)
  const [captureText, setCaptureText] = useState('');
  const [query, setQuery] = useState('');

  // Un'unica pila di cronologia: ogni spostamento (scheda, schermata, finestra) è una voce del browser,
  // quindi "indietro" (tasto del telefono, del browser o pulsante dell'app) ripercorre esattamente l'ordine inverso.
  const hist = useRef({ list: [INIZIO], i: 0 });
  // copia sempre aggiornata di `snap`, leggibile dalle funzioni stabili senza dipendenze
  const snapRef = useRef(snap);
  // true tra `history.back()` e il relativo evento popstate: ignora i tocchi su «indietro» ripetuti
  const indietroInCorso = useRef(false);
  const metti = (s: Istantanea) => { snapRef.current = s; setSnap(s); };

  useEffect(() => {
    if (NATIVO) return;
    history.replaceState({ i: 0 }, '');
    const onPop = (e: PopStateEvent) => {
      indietroInCorso.current = false;
      const i = (e.state as { i?: number } | null)?.i ?? 0;
      const s = hist.current.list[i];
      if (!s) return;
      hist.current.i = i;
      metti(s);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** Aggiunge una voce alla cronologia (scartando il «avanti» eventualmente rimasto) e la mostra. */
  const spingi = useCallback((next: Istantanea) => {
    const h = hist.current;
    h.list = [...h.list.slice(0, h.i + 1), next];
    h.i += 1;
    if (!NATIVO) history.pushState({ i: h.i }, '');
    metti(next);
  }, []);
  /** Spostamento verso una nuova posizione: eventuali finestre aperte vengono chiuse senza passare dalla cronologia. */
  const vaA = useCallback((f: (cur: Istantanea) => Istantanea) => {
    const h = hist.current;
    const cur = snapRef.current;
    if (cur.layers.length) h.list[h.i] = { ...cur, layers: [] };
    spingi(f({ ...cur, layers: [] }));
  }, [spingi]);
  /**
   * Torna alla voce precedente della cronologia. Se la cronologia è all'inizio (per esempio dopo un ricaricamento)
   * chiude comunque l'ultima finestra o l'ultima schermata.
   */
  const indietro = useCallback(() => {
    if (indietroInCorso.current) return;
    if (hist.current.i > 0) {
      if (NATIVO) { hist.current.i -= 1; metti(hist.current.list[hist.current.i]); return; }
      indietroInCorso.current = true; history.back(); return;
    }
    const cur = snapRef.current;
    if (cur.layers.length) metti({ ...cur, layers: cur.layers.slice(0, -1) });
    else if (cur.stack.length) metti({ ...cur, stack: cur.stack.slice(0, -1) });
  }, []);

  // tasto indietro del telefono: chiude il pannello in cima, poi risale la pila; a pila vuota esce dall'app
  useEffect(() => {
    if (!NATIVO) return;
    const ascolto = CapApp.addListener('backButton', () => {
      const cur = snapRef.current;
      if (hist.current.i > 0 || cur.layers.length || cur.stack.length) indietro();
      else void CapApp.exitApp();
    });
    return () => { void ascolto.then((h) => h.remove()); };
  }, [indietro]);

  // «layer» = finestre in sovraimpressione (la cattura): hanno una voce di cronologia propria, così «indietro» le chiude
  const openLayer = useCallback((id: string) => {
    const cur = snapRef.current;
    if (!cur.layers.includes(id)) spingi({ ...cur, layers: [...cur.layers, id] });
  }, [spingi]);
  const closeLayer = useCallback((id: string) => { if (snapRef.current.layers.includes(id)) indietro(); }, [indietro]);
  const openCapture = useCallback((open: boolean, testo = '') => {
    if (open) { setCaptureText(testo); openLayer('capture'); } else { setCaptureText(''); closeLayer('capture'); }
  }, [openLayer, closeLayer]);

  const vaTab = useCallback((tab: Tab, sub?: { fare?: SubFare; scoprire?: SubScoprire }) => {
    const cur = snapRef.current;
    const next: Posizione = { tab, fareSub: sub?.fare ?? cur.pos.fareSub, scoprireSub: sub?.scoprire ?? cur.pos.scoprireSub };
    const uguale = next.tab === cur.pos.tab && next.fareSub === cur.pos.fareSub && next.scoprireSub === cur.pos.scoprireSub;
    if (uguale && cur.stack.length === 0 && cur.layers.length === 0) return;
    vaA(() => ({ pos: next, stack: [], layers: [] }));
  }, [vaA]);
  const setTab = useCallback((t: Tab) => vaTab(t), [vaTab]);
  const setFareSub = useCallback((s: SubFare) => vaTab('fare', { fare: s }), [vaTab]);
  const setScoprireSub = useCallback((s: SubScoprire) => vaTab('scoprire', { scoprire: s }), [vaTab]);

  // push: apre una schermata sopra le altre; vai: la sostituisce come unica della pila; nuova: apre una voce da creare
  const push = useCallback((s: Screen) => vaA((cur) => ({ ...cur, stack: [...cur.stack, s] })), [vaA]);
  const pop = indietro;
  const vai = useCallback((s: Screen) => vaA((cur) => ({ ...cur, stack: [s] })), [vaA]);
  const nuova = useCallback((p: Partial<Item>) => push({ k: 'item', nuovo: p }), [push]);

  const { tab, fareSub, scoprireSub } = snap.pos;
  const { stack, layers } = snap;
  const capture = layers.includes('capture');
  const top = stack[stack.length - 1];
  const openId = top?.k === 'item' ? top.id : undefined;

  const nav = useMemo<Nav>(() => ({
    tab, setTab, vaTab, stack, push, pop, fareSub, setFareSub, scoprireSub, setScoprireSub,
    capture, layers, openLayer, closeLayer, captureText, openCapture, wide, xl, vai, openId, query, setQuery, nuova,
  }), [tab, setTab, vaTab, stack, push, pop, fareSub, setFareSub, scoprireSub, setScoprireSub, capture, layers, openLayer, closeLayer, captureText, openCapture, wide, xl, vai, openId, query, nuova]);

  // scorciatoie da tastiera (schermi larghi): N nuova nota, / cerca, Esc chiude
  useEffect(() => {
    if (!wide || !auth.token) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const scrivendo = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape') {
        if (layers.length) closeLayer(layers[layers.length - 1]);
        else if (query) setQuery('');
        else if (stack.length) pop();
        else if (scrivendo) t?.blur();
        return;
      }
      if (scrivendo || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); (document.getElementById('nota-rapida') as HTMLInputElement | null)?.focus(); }
      else if (e.key === '/') { e.preventDefault(); document.getElementById('ricerca')?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, auth.token, layers, closeLayer, query, stack.length, pop]);

  if (!auth.token) return <div className="app app-login"><Login /></div>;

  const tabScreen = (
    <>
      {tab === 'oggi' && <Oggi />}
      {tab === 'fare' && <Fare />}
      {tab === 'scoprire' && <Scoprire />}
      {tab === 'curiosita' && <Curiosita />}
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
          <StatoMenu />
          <CompletamentoSheet />
          <AvanzamentoProgetto />
          <ControlloSessione />
          <ToastView />
        </div>
      </NavContext.Provider>
    );
  }

  // schermi larghi: barra laterale, area principale e, per una voce aperta, una finestra in sovraimpressione
  const voceAperta = top?.k === 'item' ? top : undefined;
  const base = [...stack].reverse().find((s) => s.k !== 'item');
  const principale: ReactNode = query.trim().length >= 2
    ? <Ricerca />
    : base
      ? <div className="page"><Schermata key={chiaveSchermata(stack, base)} s={base} /></div>
      : <div className="page">{tabScreen}</div>;

  return (
    <NavContext.Provider value={nav}>
      <div className="shell">
        <Sidebar />
        <main className="main">
          <div className="main-body">{principale}</div>
        </main>
        {voceAperta && (
          <>
            <div className="dim" onClick={pop} />
            <div className="modal-voce" role="dialog" aria-label="Dettaglio">
              <Schermata key={chiaveSchermata(stack, voceAperta)} s={voceAperta} />
            </div>
          </>
        )}
        {capture && <Capture />}
        <RecensioneSheet />
        <StatoMenu />
        <CompletamentoSheet />
        <AvanzamentoProgetto />
        <ControlloSessione />
        <ToastView />
      </div>
    </NavContext.Provider>
  );
}
