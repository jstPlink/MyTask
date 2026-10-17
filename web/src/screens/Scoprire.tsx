import { useMemo, useState } from 'react';
import type { Tipo } from '../../../shared/types.ts';
import { collezione, piattformeUsate } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { completaVoce } from '../lib/actions.ts';
import { Chips, Empty, Fab, PalliniInteresse, Row, Seg, Top, Sezione } from '../ui/kit.tsx';
import { PulsanteAspetto } from '../ui/PulsanteAspetto.tsx';
import { useNav, type SubScoprire } from '../ui/nav.tsx';

const SUB: { id: SubScoprire; nome: string }[] = [
  { id: 'film', nome: 'Film' }, { id: 'serie', nome: 'Serie' }, { id: 'anime', nome: 'Anime' }, { id: 'gioco', nome: 'Giochi' },
  { id: 'libro', nome: 'Libri' }, { id: 'ricetta', nome: 'Ricette' },
];

export function Scoprire() {
  const nav = useNav();
  const items = useItems();
  const sub = nav.scoprireSub;
  const [piattaforma, setPiattaforma] = useState('Tutte');
  const video = sub === 'film' || sub === 'serie' || sub === 'anime';
  const tipi: Tipo[] = [sub];
  const lista = useMemo(
    () => collezione(items, tipi, video && piattaforma !== 'Tutte' ? piattaforma : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, sub, piattaforma],
  );
  const piattaforme = useMemo(() => (video ? piattformeUsate(items, tipi) : []), [items, sub, video]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Top title="Intrattenimento" sub={`${lista.length} da fare`} right={<PulsanteAspetto />} />
      <div className="scroll">
        <Seg nav voci={SUB} attivo={sub} onChange={(s) => { nav.setScoprireSub(s); setPiattaforma('Tutte'); }} />
        {video && piattaforme.length > 0 && <Chips scroll voci={['Tutte', ...piattaforme]} attivo={piattaforma} onChange={setPiattaforma} />}
        {video && (
          <Sezione titolo="Stasera">
            <button className="card strong tap" onClick={() => nav.push({ k: 'stasera' })}>
              <b>Cosa guardo stasera?</b><span>›</span>
            </button>
          </Sezione>
        )}
        {lista.length === 0 && <Empty>Niente in lista.</Empty>}
        {lista.length > 0 && (
          <Sezione titolo={`${SUB.find((x) => x.id === sub)?.nome ?? ''} da fare`} dettaglio={lista.length}>
            {lista.map((i) => {          const meta = [i.stato === 'in_corso' ? 'In corso' : undefined, i.piattaforma, i.consigliatoDa ? `consigliato da ${i.consigliatoDa}` : undefined, i.genere, i.note?.split('\n')[0]].filter(Boolean).join(' · ');
          const interesse = i.interesse ?? 3;
          return (
            <Row
              key={i.id}
              titolo={i.titolo}
              meta={meta || undefined}
              right={<PalliniInteresse valore={interesse} />}
              level={interesse >= 4 ? 3 : interesse === 3 ? 2 : 1}
              check="square"
              centrato
              light={interesse <= 1}
              onCheck={() => completaVoce(i)}
              selected={nav.openId === i.id} onOpen={() => nav.push({ k: 'item', id: i.id })}
            />
          );
            })}
          </Sezione>
        )}
      </div>
      <Fab />
    </>
  );
}
