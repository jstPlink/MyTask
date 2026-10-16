import { useMemo } from 'react';
import { NOMI_TIPO } from '../../../shared/types.ts';
import { formatShortYear } from '../../../shared/dates.ts';
import { dueDate } from '../../../shared/priority.ts';
import { cercaVoci } from '../../../shared/views.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { completaVoce } from '../lib/actions.ts';
import { Empty, Row, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';

export function Ricerca() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const q = nav.query.trim();
  const risultati = useMemo(() => cercaVoci(items, q), [items, q]);

  return (
    <div className="page">
      <Top title="Ricerca" sub={`${risultati.length} ${risultati.length === 1 ? 'risultato' : 'risultati'} per «${q}»`} />
      <div className="scroll">
        {risultati.length === 0 && <Empty>Nessuna voce corrisponde.</Empty>}
        {risultati.map((i) => {
          const chiusa = i.stato === 'fatto' || i.stato === 'saltato';
          const d = dueDate(i);
          return (
            <Row
              key={i.id}
              titolo={i.titolo}
              meta={[NOMI_TIPO[i.tipo], i.piattaforma, chiusa ? (i.stato === 'saltato' ? 'saltata' : 'completata') : undefined].filter(Boolean).join(' · ')}
              right={d && !chiusa ? formatShortYear(d, oggi) : undefined}
              check={i.tipo === 'azione' || i.tipo === 'progetto' ? 'circle' : 'square'}
              done={chiusa}
              light={chiusa}
              selected={nav.openId === i.id}
              onCheck={chiusa ? undefined : () => completaVoce(i)}
              onOpen={() => nav.push({ k: 'item', id: i.id })}
            />
          );
        })}
      </div>
    </div>
  );
}
