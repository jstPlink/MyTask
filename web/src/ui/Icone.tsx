import type { ReactNode } from 'react';
import type { Stato, Tipo } from '../../../shared/types.ts';

// Icone e colori di tipi e stati, usati nelle scelte a tendina. Colori dalla tavolozza c1..c5 dei tag.

const tratto = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const GLIFI: Record<Tipo, ReactNode> = {
  azione: <g {...tratto}><rect x="3.5" y="4" width="17" height="16" rx="4.5" /><path d="M8 12.2l3 3 5-6" /></g>,
  progetto: <g {...tratto}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></g>,
  esperienza: <g {...tratto}><path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></g>,
  routine: <g {...tratto}><path d="M17 2.5l3.5 3.5L17 9.5" /><path d="M3.5 11V9.5A3.5 3.5 0 0 1 7 6h13.5" /><path d="M7 21.5L3.5 18 7 14.5" /><path d="M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5" /></g>,
  film: <g {...tratto}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" /></g>,
  serie: <g {...tratto}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 3l3 4 3-4M8 21h8" /></g>,
  anime: <g {...tratto}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></g>,
  gioco: <g {...tratto}><rect x="2.5" y="8" width="19" height="10" rx="5" /><path d="M7 11v4M5 13h4" /><circle cx="16" cy="12" r=".8" /><circle cx="18" cy="14" r=".8" /></g>,
  libro: <g {...tratto}><path d="M4 5a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2z" /><path d="M4 20a2 2 0 0 0 2 1h12v-3" /></g>,
  ricetta: <g {...tratto}><path d="M4 11h16a8 8 0 0 1-16 0z" /><path d="M9 4v3M13 4v3" /></g>,
  curiosita: <g {...tratto}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></g>,
  persona: <g {...tratto}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></g>,
};

/** Tinta (da 1 a 5) per ogni tipo. */
const TINTA_TIPO: Record<Tipo, number> = {
  azione: 1, progetto: 3, esperienza: 4, routine: 5, film: 2, serie: 3, anime: 4, gioco: 1, libro: 2, ricetta: 5, curiosita: 3, persona: 4,
};

const badge = (n: number, size: number) => ({ width: size, height: size, borderRadius: Math.round(size * 0.32), background: `var(--c${n}s)`, color: `var(--c${n})` });

export function BadgeTipo({ tipo, size = 24 }: { tipo: Tipo; size?: number }) {
  return (
    <span className="badge-icona" style={badge(TINTA_TIPO[tipo] ?? 1, size)} aria-hidden="true">
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" focusable="false">{GLIFI[tipo]}</svg>
    </span>
  );
}

const STATI_VISTA: Record<Stato, { tinta: string; glifo: ReactNode }> = {
  da_fare: { tinta: 'var(--mid)', glifo: <circle cx="12" cy="12" r="8" {...tratto} /> },
  in_corso: { tinta: 'var(--c5)', glifo: <g {...tratto}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></g> },
  fatto: { tinta: 'var(--c1)', glifo: <g {...tratto}><circle cx="12" cy="12" r="8" /><path d="M8.5 12.2l2.5 2.5 4.5-5" /></g> },
  saltato: { tinta: 'var(--soft)', glifo: <g {...tratto}><circle cx="12" cy="12" r="8" /><path d="M8 12h8" /></g> },
  parcheggiato: { tinta: 'var(--c2)', glifo: <g {...tratto}><circle cx="12" cy="12" r="8" /><path d="M10 9v6M14 9v6" /></g> },
};

export function BadgeStato({ stato, size = 24 }: { stato: Stato; size?: number }) {
  const v = STATI_VISTA[stato];
  return (
    <span className="badge-icona" style={{ width: size, height: size, color: v.tinta }} aria-hidden="true">
      <svg width={size * 0.9} height={size * 0.9} viewBox="0 0 24 24" focusable="false">{v.glifo}</svg>
    </span>
  );
}

/** Piccola icona del tipo di nota, senza sfondo: prende il colore del testo (per la riga grigia sotto il titolo). */
export function GlifoTipo({ tipo, size = 14 }: { tipo: Tipo; size?: number }) {
  return <svg className="glifo-tipo" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{GLIFI[tipo]}</svg>;
}
