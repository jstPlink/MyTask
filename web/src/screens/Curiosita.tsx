import { useMemo, useState } from 'react';
import { cercaVoci, curiosita } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { Cerca, Empty, Fab, Row, Top, Sezione } from '../ui/kit.tsx';
import { PulsanteAspetto } from '../ui/PulsanteAspetto.tsx';
import { useNav } from '../ui/nav.tsx';

/**
 * Scheda Curiosità: le note da approfondire, con ricerca, le più recenti prima (le archiviate in fondo). Non hanno stima, interesse né
 * posizione: ogni riga ha la stessa targhetta verde con «?» e la casella a quattro stati. Nella pagina principale ne compaiono alcune a
 * caso, diverse ogni 6 ore.
 */
export function Curiosita() {
  const nav = useNav();
  const items = useItems();
  const [q, setQ] = useState('');
  const filtro = useMemo(() => (q.trim() ? new Set(cercaVoci(items, q, 5000).map((i) => i.id)) : null), [items, q]);
  const tutte = useMemo(() => {
    const aperte = curiosita(items);
    return [...aperte.filter((c) => c.stato !== 'parcheggiato'), ...aperte.filter((c) => c.stato === 'parcheggiato')];
  }, [items]);
  const lista = useMemo(() => (filtro ? tutte.filter((i) => filtro.has(i.id)) : tutte), [tutte, filtro]);

  return (
    <>
      <Top title="Curiosità" sub={`${lista.length} da approfondire`} right={<PulsanteAspetto />} />
      {!nav.wide && <div className="fisso"><Cerca valore={q} onChange={setQ} placeholder="Cerca nelle curiosità" /></div>}
      <div className="scroll">
        {lista.length === 0 && filtro && <Empty>Nessun risultato: prova con altre parole.</Empty>}
        {lista.length === 0 && !filtro && <Empty>Niente da approfondire. Scrivi una curiosità con il pulsante +: di tanto in tanto comparirà nella pagina principale.</Empty>}
        {lista.length > 0 && (
          <Sezione titolo="Da approfondire" dettaglio={lista.length}>
          {lista.map((i) => (
            <Row
              key={i.id}
              titolo={i.titolo} tipo="curiosita"
              check="square"
              centrato
              voce={i}
              selected={nav.openId === i.id}
              onOpen={() => nav.push({ k: 'item', id: i.id })}
            />
          ))}
          </Sezione>
        )}
      </div>
      <Fab />
    </>
  );
}
