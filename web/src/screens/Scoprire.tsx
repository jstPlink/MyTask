import { useMemo, useState } from 'react';
import type { Tipo } from '../../../shared/types.ts';
import { cercaVoci, collezione, piattformeUsate } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { Cerca, Chips, Empty, Fab, Row, Seg, Top, Sezione } from '../ui/kit.tsx';
import { PulsanteAspetto } from '../ui/PulsanteAspetto.tsx';
import { useNav, type SubScoprire } from '../ui/nav.tsx';

const SUB: { id: SubScoprire; nome: string }[] = [
  { id: 'film', nome: 'Film' }, { id: 'serie', nome: 'Serie' }, { id: 'anime', nome: 'Anime' }, { id: 'gioco', nome: 'Giochi' },
  { id: 'libro', nome: 'Libri' }, { id: 'ricetta', nome: 'Ricette' },
];

/**
 * Scheda Intrattenimento: una lista per tipo (film, serie, anime, giochi, libri, ricette) scelta con i segmenti, con ricerca.
 * Per film, serie e anime ci sono il filtro per piattaforma e il collegamento «Cosa guardo stasera?». Su ogni riga: interesse (1-5)
 * e casella a quattro stati. Sul sito largo i segmenti si nascondono perché le sotto-sezioni sono nella barra laterale.
 */
export function Scoprire() {
  const nav = useNav();
  const items = useItems();
  const sub = nav.scoprireSub;
  const [piattaforma, setPiattaforma] = useState('Tutte');
  const video = sub === 'film' || sub === 'serie' || sub === 'anime';
  const tipi: Tipo[] = [sub];
  const [q, setQ] = useState('');
  const filtro = useMemo(() => (q.trim() ? new Set(cercaVoci(items, q, 5000).map((i) => i.id)) : null), [items, q]);
  const lista = useMemo(
    () => collezione(items, tipi, video && piattaforma !== 'Tutte' ? piattaforma : undefined).filter((i) => !filtro || filtro.has(i.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, sub, piattaforma, filtro],
  );
  const piattaforme = useMemo(() => (video ? piattformeUsate(items, tipi) : []), [items, sub, video]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Top title="Intrattenimento" sub={`${lista.length} da fare`} right={<PulsanteAspetto />} />
      <div className="scroll">
        <Seg nav uguali voci={SUB} attivo={sub} onChange={(s) => { nav.setScoprireSub(s); setPiattaforma('Tutte'); }} />
        {!nav.wide && <Cerca valore={q} onChange={setQ} placeholder="Cerca in intrattenimento" />}
        {video && piattaforme.length > 0 && <Chips scroll voci={['Tutte', ...piattaforme]} attivo={piattaforma} onChange={setPiattaforma} />}
        {video && !filtro && (
          <Sezione titolo="Stasera">
            <button className="card strong tap" onClick={() => nav.push({ k: 'stasera' })}>
              <b>Cosa guardo stasera?</b><span>›</span>
            </button>
          </Sezione>
        )}
        {lista.length === 0 && <Empty>{filtro ? 'Nessun risultato: prova con altre parole.' : 'Niente in lista.'}</Empty>}
        {lista.length > 0 && (
          <Sezione titolo={`${SUB.find((x) => x.id === sub)?.nome ?? ''} da fare`} dettaglio={lista.length}>
            {lista.map((i) => {
          const meta = [i.stato === 'in_corso' ? 'In corso' : undefined, i.piattaforma, i.consigliatoDa ? `consigliato da ${i.consigliatoDa}` : undefined, i.genere, i.note?.split('\n')[0]].filter(Boolean).join(' · ');
          const interesse = i.interesse ?? 3;
          return (
            <Row
              key={i.id}
              titolo={i.titolo} tipo={i.tipo}
              meta={meta || undefined}
              interesse={interesse}
              check="square"
              centrato
              light={interesse <= 1}
              voce={i}
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
