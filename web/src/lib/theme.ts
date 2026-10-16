// Aspetto: tema (sistema/chiaro/scuro) e colore d'accento. Salvato sul dispositivo.
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type Tema = 'sistema' | 'chiaro' | 'scuro';
export type Colore = 'verde' | 'petrolio' | 'indaco';

export interface Aspetto { tema: Tema; colore: Colore }

const KEY = 'mytask.aspetto';
let corrente: Aspetto = { tema: 'sistema', colore: 'verde' };
const listeners = new Set<() => void>();

export function leggiAspetto(): Aspetto {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Aspetto>;
      return {
        tema: p.tema === 'chiaro' || p.tema === 'scuro' ? p.tema : 'sistema',
        colore: p.colore === 'petrolio' || p.colore === 'indaco' ? p.colore : 'verde',
      };
    }
  } catch { /* spazio di archiviazione non disponibile */ }
  return { tema: 'sistema', colore: 'verde' };
}

const COLORI_BARRA: Record<Colore, string> = { verde: '#2F7D5B', petrolio: '#0E7490', indaco: '#4F46E5' };

/** App Android: le icone della barra di stato (ora, batteria, rete) devono contrastare con lo sfondo dell'app, non con il tema del telefono. */
function aggiornaBarraStato(scuro: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  // Style.Dark = icone chiare (per sfondi scuri), Style.Light = icone scure (per sfondi chiari)
  void StatusBar.setStyle({ style: scuro ? Style.Dark : Style.Light }).catch(() => undefined);
  void StatusBar.setBackgroundColor({ color: scuro ? '#0E0F12' : '#F1F0EC' }).catch(() => undefined);
}

function applica() {
  const scuro = corrente.tema === 'scuro' || (corrente.tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const el = document.documentElement;
  el.dataset.theme = scuro ? 'dark' : 'light';
  el.dataset.accent = corrente.colore;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', COLORI_BARRA[corrente.colore]);
  aggiornaBarraStato(scuro);
}

export function avviaTema() {
  corrente = leggiAspetto();
  applica();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (corrente.tema === 'sistema') applica(); });
}

export function impostaAspetto(p: Partial<Aspetto>) {
  corrente = { ...corrente, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(corrente)); } catch { /* ignora */ }
  applica();
  listeners.forEach((l) => l());
}

export const getAspetto = () => corrente;
export const subscribeAspetto = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
