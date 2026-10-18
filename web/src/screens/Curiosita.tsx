import { useMemo } from 'react';
import { curiosita } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { completaVoce } from '../lib/actions.ts';
import { Empty, Fab, Row, Top, Sezione } from '../ui/kit.tsx';
import { PulsanteAspetto } from '../ui/PulsanteAspetto.tsx';
import { useNav } from '../ui/nav.tsx';

/** Cose da approfondire. Ogni tanto compaiono nel piano di Oggi come pausa tra le attività più grandi. */
export function Curiosita() {
  const nav = useNav();
  const items = useItems();
  const lista = useMemo(() => curiosita(items), [items]);

  return (
    <>
      <Top title="Curiosità" sub={`${lista.length} da approfondire`} right={<PulsanteAspetto />} />
      <div className="scroll">
        {lista.length === 0 && <Empty>Niente da approfondire. Scrivi una curiosità con il pulsante +: comparirà come pausa tra le attività grandi.</Empty>}
        {lista.length > 0 && (
          <Sezione titolo="Da approfondire" dettaglio={lista.length}>
          {lista.map((i) => (
            <Row
              key={i.id}
              titolo={i.titolo} tipo="curiosita"
              meta={i.note?.split('\n')[0]}
              interesse={i.interesse ?? 3}
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
