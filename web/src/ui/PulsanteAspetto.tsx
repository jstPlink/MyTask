import { useMemo } from 'react';
import { inbox } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { Icona } from './kit.tsx';
import { useNav } from './nav.tsx';

/**
 * Pulsanti tondi in cima alle schede principali: stile e aspetto (tema e colore) e, sul telefono, anche Inbox (con il numero
 * di idee da smistare) e Altro (completato, impostazioni). Sullo schermo largo Inbox e Altro stanno nella barra laterale.
 */
export function PulsanteAspetto() {
  const nav = useNav();
  const items = useItems();
  const nInbox = useMemo(() => inbox(items).length, [items]);
  return (
    <div className="header-circles">
      <button className="circ" onClick={() => nav.push({ k: 'aspetto' })} aria-label="Stile e aspetto">
        <Icona nome="aspetto" size={22} />
      </button>
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
