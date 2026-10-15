import { createContext, useContext } from 'react';
import type { Item } from '../../../shared/types.ts';

export type Tab = 'oggi' | 'fare' | 'scoprire' | 'routine';
export type SubFare = 'azioni' | 'progetti' | 'esperienze' | 'calendario';
export type SubScoprire = 'film' | 'serie' | 'anime' | 'gioco' | 'libro' | 'ricetta' | 'curiosita';

export type Screen =
  | { k: 'item'; id?: string; nuovo?: Partial<Item> }
  | { k: 'altro' } | { k: 'inbox' } | { k: 'revisione' } | { k: 'archivio' }
  | { k: 'persone' } | { k: 'persona'; id: string } | { k: 'luoghi' }
  | { k: 'aspetto' } | { k: 'tempolibero' } | { k: 'notifiche' } | { k: 'stasera' } | { k: 'account' };

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
