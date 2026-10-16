import { Icona } from './kit.tsx';
import { useNav } from './nav.tsx';

/** Pulsante tondo in cima alle schede principali: apre subito stile e aspetto (tema e colore). */
export function PulsanteAspetto() {
  const nav = useNav();
  return (
    <div className="header-circles">
      <button className="circ" onClick={() => nav.push({ k: 'aspetto' })} aria-label="Stile e aspetto">
        <Icona nome="aspetto" size={22} />
      </button>
    </div>
  );
}
