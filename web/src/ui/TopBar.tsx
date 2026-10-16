import { useState, type FormEvent } from 'react';
import type { Tipo } from '../../../shared/types.ts';
import { Icona } from './kit.tsx';
import { useNav } from './nav.tsx';

/** Barra in alto per schermi larghi: cattura rapida, ricerca e nuova voce. */
export function TopBar() {
  const nav = useNav();
  const [testo, setTesto] = useState('');

  const cattura = (e: FormEvent) => {
    e.preventDefault();
    const t = testo.trim();
    if (!t) return;
    setTesto('');
    nav.openCapture(true, t);
  };

  // il tipo della "nuova voce" segue la sezione in cui ci si trova
  const tipoCorrente = (): Tipo => {
    if (nav.tab === 'fare') return nav.fareSub === 'progetti' ? 'progetto' : nav.fareSub === 'esperienze' ? 'esperienza' : 'azione';
    if (nav.tab === 'scoprire') return nav.scoprireSub;
    if (nav.tab === 'curiosita') return 'curiosita';
    if (nav.tab === 'routine') return 'routine';
    return 'azione';
  };

  return (
    <div className="topbar">
      <form onSubmit={cattura} className="topbar-capture">
        <input
          id="cattura-rapida"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Cattura rapida: scrivi un'idea e premi Invio"
          aria-label="Cattura rapida"
        />
        <kbd aria-hidden="true">N</kbd>
      </form>
      <div className="topbar-search">
        <input
          id="ricerca"
          value={nav.query}
          onChange={(e) => nav.setQuery(e.target.value)}
          placeholder="Cerca…"
          aria-label="Cerca"
          type="search"
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <button className="circ" onClick={() => nav.vai({ k: 'aspetto' })} aria-label="Stile e aspetto"><Icona nome="aspetto" size={22} /></button>
      <button className="btn solid" onClick={() => nav.nuova({ tipo: tipoCorrente() })}>+ Nuova voce</button>
    </div>
  );
}
