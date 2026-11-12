import { useMemo } from 'react';
import { inbox } from '../../../shared/views.ts';
import { useAspetto, useItems } from '../lib/hooks.ts';
import { impostaAspetto } from '../lib/theme.ts';
import { Icona } from './kit.tsx';
import { useNav } from './nav.tsx';

/** Pulsante tondo che passa dal tema chiaro a quello scuro e viceversa (il colore e il tema «sistema» si scelgono in Altro › Aspetto). Mostra il tema a cui porta: luna in chiaro, sole in scuro. */
export function PulsanteTema() {
  const a = useAspetto();
  const scuro = a.tema === 'scuro' || (a.tema === 'sistema' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <button className="circ" onClick={() => impostaAspetto({ tema: scuro ? 'chiaro' : 'scuro' })} aria-label={scuro ? 'Passa al tema chiaro' : 'Passa al tema scuro'} aria-pressed={scuro}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {scuro
          ? <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></>
          : <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />}
      </svg>
    </button>
  );
}

/**
 * Pulsanti tondi in cima alle schede principali: tema chiaro/scuro e, sul telefono, anche Inbox (con il numero
 * di idee da smistare) e Altro (completato, impostazioni). Sullo schermo largo Inbox e Altro stanno nella barra laterale.
 */
export function PulsanteAspetto() {
  const nav = useNav();
  const items = useItems();
  const nInbox = useMemo(() => inbox(items).length, [items]);
  return (
    <div className="header-circles">
      <PulsanteTema />
      {!nav.wide && (
        <>
          <button className="circ" onClick={() => nav.push({ k: 'inbox' })} aria-label={`Inbox, ${nInbox} da smistare`}>
            <Icona nome="inbox" size={22} />
            {nInbox > 0 && <span className="circ-badge">{nInbox > 99 ? '99+' : nInbox}</span>}
          </button>
          <button className="circ" onClick={() => nav.push({ k: 'altro' })} aria-label="Altro: completato, impostazioni">
            <Icona nome="altro" size={22} />
          </button>
        </>
      )}
    </div>
  );
}
