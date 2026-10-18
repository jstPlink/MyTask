// Hook React che leggono gli store della cartella lib (useSyncExternalStore) e tengono aggiornati data e minuto correnti.
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
import { getSessione, subscribeSessione } from './sessione.ts';

export const useItems = (): Item[] => useSyncExternalStore(subscribe, getItems);
export const useAuth = () => useSyncExternalStore(subscribeAuth, getAuth);
export const useSyncStatus = () => useSyncExternalStore(subscribeSync, getStatoSync);
export const useToast = () => useSyncExternalStore(subscribeToast, getToast);
export const useAspetto = () => useSyncExternalStore(subscribeAspetto, getAspetto);
/** La sessione di lavoro («Sto lavorando»). */
export const useSessione = () => useSyncExternalStore(subscribeSessione, getSessione);
export const useDisponibilita = () => useSyncExternalStore(subscribeDisponibilita, getDisponibilita);

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

/** La data di oggi (YYYY-MM-DD), aggiornata anche se l'app resta aperta oltre la mezzanotte. */
export function useOggi(): string {
  const [d, setD] = useState(() => today());
  usaAggiornamento(() => setD((x) => { const n = today(); return n === x ? x : n; }), 30_000);
  return d;
}

/** L'istante corrente (millisecondi), aggiornato ogni secondo finché `attivo`: per far scorrere il cronometro. */
export function useAdesso(attivo: boolean): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    if (!attivo) return;
    setT(Date.now());
    const i = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(i);
  }, [attivo]);
  return t;
}

