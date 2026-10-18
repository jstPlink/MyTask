// Animazione «battito» del pallino di urgenza: i keyframes si creano al volo, uno per frequenza (bpm), e si riusano.
import type { CSSProperties } from 'react';
import { battitoBpm } from '../../../shared/priority.ts';

/** Durata fissa del colpo (lub-dub) in secondi: a frequenze basse cambia solo la pausa, non la velocità del colpo. */
const COLPO_S = 0.45;
/** Nomi delle animazioni già inserite nel foglio di stile. */
const fatti = new Set<string>();
/** Foglio di stile creato a runtime per le regole `@keyframes`. */
let foglio: CSSStyleSheet | undefined;

/** Aggiunge una regola CSS al foglio dinamico (creato alla prima richiesta). */
function regola(css: string) {
  if (!foglio) {
    const el = document.createElement('style');
    document.head.appendChild(el);
    foglio = el.sheet as CSSStyleSheet;
  }
  foglio.insertRule(css, foglio.cssRules.length);
}

/** Stile (animazione) del pallino per un'urgenza: il pallino si contrae a ritmo di battito, più veloce quanto più la scadenza è vicina. */
export function battito(urgenza: number): CSSProperties | undefined {
  const bpm = battitoBpm(urgenza);
  if (!bpm) return undefined;
  const per = 60 / bpm;
  const colpo = Math.min(COLPO_S, per * 0.7);
  const nome = `battito-${bpm}`;
  if (!fatti.has(nome)) {
    fatti.add(nome);
    const w = (colpo / per) * 100; // quota del ciclo occupata dal colpo; il resto è pausa
    // lub-dub: contrazione, ritorno, seconda contrazione più lieve, ritorno (punti espressi come frazione del colpo)
    const f = (x: number) => `${(x * w).toFixed(2)}%`;
    regola(`@keyframes ${nome} { 0% { transform: scale(1); } ${f(0.23)} { transform: scale(.88); } ${f(0.46)} { transform: scale(1); } ${f(0.7)} { transform: scale(.922); } ${f(1)}, 100% { transform: scale(1); } }`);
  }
  return { animation: `${nome} ${per.toFixed(3)}s infinite` };
}
