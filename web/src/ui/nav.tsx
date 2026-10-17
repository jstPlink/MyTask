import { createContext, useContext, useEffect, useRef } from 'react';
import type { Item } from '../../../shared/types.ts';

export type Tab = 'oggi' | 'fare' | 'scoprire' | 'curiosita' | 'routine';
export type SubFare = 'azioni' | 'progetti' | 'esperienze';
export type SubScoprire = 'film' | 'serie' | 'anime' | 'gioco' | 'libro' | 'ricetta';

export type Screen =
  | { k: 'item'; id?: string; nuovo?: Partial<Item> }
  | { k: 'altro' } | { k: 'inbox' } | { k: 'revisione' } | { k: 'archivio' } | { k: 'daparte' }
  | { k: 'aspetto' } | { k: 'tempolibero' } | { k: 'stasera' } | { k: 'account' }
  | { k: 'orari'; giorno: string };

export interface Nav {
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Apre una scheda (e, se serve, una sua sotto-sezione) tenendo la cronologia per "indietro". */
  vaTab: (t: Tab, sub?: { fare?: SubFare; scoprire?: SubScoprire }) => void;
  stack: Screen[];
  push: (s: Screen) => void;
  pop: () => void;
  fareSub: SubFare;
  setFareSub: (s: SubFare) => void;
  scoprireSub: SubScoprire;
  setScoprireSub: (s: SubScoprire) => void;
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
  query: string;
  setQuery: (q: string) => void;
  /** Apre l'editor per una nuova voce del tipo indicato. */
  nuova: (p: Partial<Item>) => void;
}

export const NavContext = createContext<Nav | null>(null);

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
