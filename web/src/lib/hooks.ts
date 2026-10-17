import { useEffect, useState, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
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
/**
 * Chiama `fn` ogni `ms` e ogni volta che l'app torna in primo piano. Sul telefono i timer si fermano quando l'app è in
 * secondo piano: senza questo, al ritorno l'orario resterebbe vecchio fino al tocco successivo del timer.
 */
function usaAggiornamento(fn: () => void, ms: number) {
  useEffect(() => {
    const t = setInterval(fn, ms);
    const riprendi = () => { if (document.visibilityState !== 'hidden') fn(); };
    document.addEventListener('visibilitychange', riprendi);
    window.addEventListener('focus', fn);
    window.addEventListener('pageshow', fn);
    const nativo = Capacitor.isNativePlatform() ? CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) fn(); }) : undefined;
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', riprendi);
      window.removeEventListener('focus', fn);
      window.removeEventListener('pageshow', fn);
      void nativo?.then((h) => h.remove());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useOggi(): string {
  const [d, setD] = useState(() => today());
  usaAggiornamento(() => setD((x) => { const n = today(); return n === x ? x : n; }), 30_000);
  return d;
}

/** Il minuto corrente (millisecondi / 60000), aggiornato ogni 15 secondi e al ritorno in primo piano: serve alla linea dell'ora e al piano. */
export function useMinuto(): number {
  const [m, setM] = useState(() => Math.floor(Date.now() / 60000));
  usaAggiornamento(() => setM((x) => { const n = Math.floor(Date.now() / 60000); return n === x ? x : n; }), 15_000);
  return m;
}
