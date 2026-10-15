import { createContext, useContext } from 'react';
import type { Item } from '../../../shared/types.ts';

export type Tab = 'oggi' | 'fare' | 'scoprire' | 'routine';
export type SubFare = 'azioni' | 'progetti' | 'esperienze';
export type SubScoprire = 'film' | 'serie' | 'anime' | 'gioco' | 'libro' | 'ricetta' | 'curiosita';

export type Screen =
  | { k: 'item'; id?: string; nuovo?: Partial<Item> }
  | { k: 'altro' } | { k: 'inbox' } | { k: 'revisione' } | { k: 'archivio' }
  | { k: 'persone' } | { k: 'persona'; id: string } | { k: 'luoghi' }
  | { k: 'aspetto' } | { k: 'notifiche' } | { k: 'stasera' } | { k: 'account' };

export interface Nav {
  tab: Tab;
  setTab: (t: Tab) => void;
  stack: Screen[];
  push: (s: Screen) => void;
  pop: () => void;
  fareSub: SubFare;
  setFareSub: (s: SubFare) => void;
  scoprireSub: SubScoprire;
  setScoprireSub: (s: SubScoprire) => void;
  capture: boolean;
  openCapture: (open: boolean) => void;
  /** Apre l'editor per una nuova voce del tipo indicato. */
  nuova: (p: Partial<Item>) => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const n = useContext(NavContext);
  if (!n) throw new Error('NavContext mancante');
  return n;
}
