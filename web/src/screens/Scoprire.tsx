import { useMemo, useState } from 'react';
import type { Tipo } from '../../../shared/types.ts';
import { collezione, curiosita, piattformeUsate } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { completaVoce } from '../lib/actions.ts';
import { Chips, Empty, Fab, Row, Seg, Top } from '../ui/kit.tsx';
import { useNav, type SubScoprire } from '../ui/nav.tsx';
import { pallini } from '../lib/util.ts';

const SUB: { id: SubScoprire; nome: string }[] = [
  { id: 'film', nome: 'Film' }, { id: 'serie', nome: 'Serie' }, { id: 'anime', nome: 'Anime' }, { id: 'gioco', nome: 'Giochi' },
  { id: 'libro', nome: 'Libri' }, { id: 'ricetta', nome: 'Ricette' }, { id: 'curiosita', nome: 'Curiosità' },
];

export function Scoprire() {
  const nav = useNav();
  const items = useItems();
  const sub = nav.scoprireSub;
  const [piattaforma, setPiattaforma] = useState('Tutte');
  const video = sub === 'film' || sub === 'serie' || sub === 'anime';
  const tipi: Tipo[] = [sub];
  const lista = useMemo(
    () => (sub === 'curiosita' ? curiosita(items) : collezione(items, tipi, video && piattaforma !== 'Tutte' ? piattaforma : undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, sub, piattaforma],
  );
  const piattaforme = useMemo(() => (video ? piattformeUsate(items, tipi) : []), [items, sub, video]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Top title="Scoprire" sub={`${lista.length} ${sub === 'curiosita' ? 'da approfondire' : 'da fare'}`} />
      <div className="scroll">
        <Seg nav voci={SUB} attivo={sub} onChange={(s) => { nav.setScoprireSub(s); setPiattaforma('Tutte'); }} />
        {video && piattaforme.length > 0 && <Chips scroll voci={['Tutte', ...piattaforme]} attivo={piattaforma} onChange={setPiattaforma} />}
        {video && (
          <button className="card strong tap" onClick={() => nav.push({ k: 'stasera' })}>
            <b>Cosa guardo stasera?</b><span>›</span>
          </button>
        )}
        {lista.length === 0 && <Empty>Niente in lista.</Empty>}
        {lista.map((i) => {
          const meta = sub === 'curiosita'
            ? i.note?.split('\n')[0]
            : [i.stato === 'in_corso' ? 'In corso' : undefined, i.piattaforma, i.consigliatoDa ? `consigliato da ${i.consigliatoDa}` : undefined, i.genere, i.note?.split('\n')[0]].filter(Boolean).join(' · ');
          const interesse = i.interesse ?? 3;
          return (
            <Row
              key={i.id}
              titolo={i.titolo}
              meta={<>{sub !== 'curiosita' && <span className="dots">{pallini(interesse)}</span>}{sub !== 'curiosita' && meta ? ' · ' : ''}{meta}</>}
              level={sub === 'curiosita' ? undefined : interesse >= 4 ? 3 : interesse === 3 ? 2 : 1}
              check="square"
              light={interesse <= 1 && sub !== 'curiosita'}
              onCheck={() => completaVoce(i, { apri: () => nav.push({ k: 'item', id: i.id }) })}
              selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })}
            />
          );
        })}
      </div>
      <Fab onClick={() => nav.nuova({ tipo: sub })} label="Nuova voce" />
    </>
  );
}
