import { createContext, useContext, useEffect, useRef } from 'react';
import type { Item } from '../../../shared/types.ts';

// Stato di navigazione condiviso da tutta l'interfaccia. Non c'è un router: c'è una scheda corrente (`tab`) e, sopra, una pila
// di schermate (`stack`) che si aprono con `push` e si chiudono con `pop`. Sopra la pila stanno i «livelli» (fogli, menu, finestre)
// legati al tasto "indietro" del telefono tramite `useLayer`.

/** Le cinque schede principali (sul sito largo sono le voci della barra laterale). */
export type Tab = 'oggi' | 'fare' | 'scoprire' | 'curiosita' | 'routine';
export type SubFare = 'azioni' | 'progetti' | 'esperienze' | 'gamedesign';
export type SubScoprire = 'film' | 'serie' | 'anime' | 'gioco' | 'libro' | 'ricetta';

/** Schermate che si aprono sopra una scheda. `item` senza `id` è una voce nuova (precompilata da `nuovo`). */
export type Screen =
  | { k: 'item'; id?: string; nuovo?: Partial<Item> }
  | { k: 'altro' } | { k: 'inbox' } | { k: 'archivio' } | { k: 'daparte' }
  | { k: 'aspetto' } | { k: 'stasera' } | { k: 'account' } | { k: 'timer' }
  | { k: 'pesi' } | { k: 'storicomargine' };

/** Valore del contesto di navigazione, fornito da App. */
export interface Nav {
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Apre una scheda (e, se serve, una sua sotto-sezione) tenendo la cronologia per "indietro". */
  vaTab: (t: Tab, sub?: { fare?: SubFare; scoprire?: SubScoprire }) => void;
  /** Pila delle schermate aperte sopra la scheda corrente (vuota = si vede la scheda). */
  stack: Screen[];
  push: (s: Screen) => void;
  pop: () => void;
  /** Sotto-sezione scelta in Attività. */
  fareSub: SubFare;
  setFareSub: (s: SubFare) => void;
  /** Sotto-sezione scelta in Intrattenimento. */
  scoprireSub: SubScoprire;
  setScoprireSub: (s: SubScoprire) => void;
  /** La cattura rapida è aperta. */
  capture: boolean;
  /** Finestre aperte sopra la schermata (cattura, mese, voto…): ognuna ha una voce nella cronologia, così "indietro" le chiude per prime. */
  layers: string[];
  openLayer: (id: string) => void;
  closeLayer: (id: string) => void;
  /** Testo con cui si apre la cattura rapida (dalla barra in alto). */
  captureText: string;
  openCapture: (open: boolean, testo?: string) => void;
  /** Schermo largo: barra laterale al posto delle schede in basso. */
  wide: boolean;
  /** Schermo molto largo: il dettaglio si apre in un pannello a destra. */
  xl: boolean;
  /** Sostituisce la pila con una sola schermata (per i link della barra laterale). */
  vai: (s: Screen) => void;
  /** Id della voce aperta nell'editor, se c'è. */
  openId: string | undefined;
  /** Testo della ricerca nella barra laterale (sito largo): se non è vuoto compare la schermata Ricerca. */
  query: string;
  setQuery: (q: string) => void;
  /** Apre l'editor per una nuova voce del tipo indicato. */
  nuova: (p: Partial<Item>) => void;
}

export const NavContext = createContext<Nav | null>(null);

/** Legge la navigazione; fuori da `NavContext` è un errore di programmazione. */
export function useNav(): Nav {
  const n = useContext(NavContext);
  if (!n) throw new Error('NavContext mancante');
  return n;
}

/**
 * Lega una finestra (aperta da uno stato locale) alla cronologia: aprendola si aggiunge una voce,
 * "indietro" la chiude per prima, chiudendola dall'interfaccia la voce viene tolta.
 */
export function useLayer(id: string, aperto: boolean, chiudi: () => void) {
  const nav = useNav();
  const tiene = nav.layers.includes(id);
  const aperta = useRef(false);
  useEffect(() => {
    if (aperto && !tiene && !aperta.current) { aperta.current = true; nav.openLayer(id); }
    else if (aperto && !tiene && aperta.current) { aperta.current = false; chiudi(); } // chiusa con "indietro"
    else if (!aperto && tiene) { aperta.current = false; nav.closeLayer(id); }
    else if (!aperto) aperta.current = false;
  }, [aperto, tiene]); // eslint-disable-line react-hooks/exhaustive-deps
}
