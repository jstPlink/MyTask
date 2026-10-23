import { useMemo, useState } from 'react';
import { cercaVoci, classificaCuriosita, curiosita, curiositaPerPriorita } from '../../../shared/views.ts';
import { intensitaBattitoCuriosita, livelloDaPunteggio, punteggioCuriosita } from '../../../shared/priority.ts';
import { useItems } from '../lib/hooks.ts';
import { Cerca, Empty, Fab, Row, Top, Sezione } from '../ui/kit.tsx';
import { PulsanteAspetto } from '../ui/PulsanteAspetto.tsx';
import { useNav } from '../ui/nav.tsx';

/**
 * Scheda Curiosità: le note da approfondire, con ricerca, in ordine di priorità (tempo stimato 55%, interesse 45%). Ogni riga ha il
 * pallino numerato con la posizione nella classifica delle curiosità e la casella a quattro stati. Le prime compaiono anche nella
 * pagina principale, nel gruppo «Curiosità».
 */
export function Curiosita() {
  const nav = useNav();
  const items = useItems();
  const [q, setQ] = useState('');
  const filtro = useMemo(() => (q.trim() ? new Set(cercaVoci(items, q, 5000).map((i) => i.id)) : null), [items, q]);
  const pos = useMemo(() => classificaCuriosita(items), [items]);
  const tutte = useMemo(() => {
    const ordinate = curiositaPerPriorita(items);
    const dentro = new Set(ordinate.map((c) => c.id));
    return [...ordinate, ...curiosita(items).filter((c) => !dentro.has(c.id))]; // le parcheggiate in fondo, senza numero
  }, [items]);
  const lista = useMemo(() => (filtro ? tutte.filter((i) => filtro.has(i.id)) : tutte), [tutte, filtro]);

  return (
    <>
      <Top title="Curiosità" sub={`${lista.length} da approfondire`} right={<PulsanteAspetto />} />
      {!nav.wide && <div className="fisso"><Cerca valore={q} onChange={setQ} placeholder="Cerca nelle curiosità" /></div>}
      <div className="scroll">
        {lista.length === 0 && filtro && <Empty>Nessun risultato: prova con altre parole.</Empty>}
        {lista.length === 0 && !filtro && <Empty>Niente da approfondire. Scrivi una curiosità con il pulsante +: se è tra le più interessanti comparirà nella pagina principale.</Empty>}
        {lista.length > 0 && (
          <Sezione titolo="Da approfondire" dettaglio={lista.length}>
          {lista.map((i) => (
            <Row
              key={i.id}
              titolo={i.titolo} tipo="curiosita"
              meta={i.note?.split('\n')[0]}
              rank={pos.get(i.id)}
              urgenza={pos.has(i.id) ? intensitaBattitoCuriosita(punteggioCuriosita(i)) : 0}
              level={livelloDaPunteggio(punteggioCuriosita(i))}
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
