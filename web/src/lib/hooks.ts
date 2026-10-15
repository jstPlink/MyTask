import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Item } from '../../../shared/types.ts';
import { today } from '../../../shared/dates.ts';
import { getAuth, getItems, subscribe, subscribeAuth } from './store.ts';
import { getStatoSync, subscribeSync } from './sync.ts';
import { getToast, subscribeToast } from './toast.ts';
import { getAspetto, subscribeAspetto } from './theme.ts';
import { getDisponibilita, subscribeDisponibilita } from './disponibilita.ts';

export const useItems = (): Item[] => useSyncExternalStore(subscribe, getItems);
export const useAuth = () => useSyncExternalStore(subscribeAuth, getAuth);
export const useSyncStatus = () => useSyncExternalStore(subscribeSync, getStatoSync);
export const useToast = () => useSyncExternalStore(subscribeToast, getToast);
export const useAspetto = () => useSyncExternalStore(subscribeAspetto, getAspetto);
export const useDisponibilita = () => useSyncExternalStore(subscribeDisponibilita, getDisponibilita);

/** La data di oggi (YYYY-MM-DD), aggiornata anche se l'app resta aperta oltre la mezzanotte. */
export function useOggi(): string {
  const [d, setD] = useState(() => today());
  useEffect(() => {
    const t = setInterval(() => setD((x) => { const n = today(); return n === x ? x : n; }), 30_000);
    return () => clearInterval(t);
  }, []);
  return d;
}
