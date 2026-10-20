import { useMemo, useSyncExternalStore } from 'react';
import { livelloPriorita, REGOLE_PREDEFINITE, type RegolePriorita } from '../../../shared/priority.ts';
import { listaAzioni } from '../../../shared/views.ts';
import { getPesiUtente, impostaPesiUtente, ripristinaPesi, sonoPredefiniti, subscribePesi } from '../lib/pesi.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { Back, Row, Sec, Seg, Top } from '../ui/kit.tsx';

type Chiave = Exclude<keyof RegolePriorita, 'ordine'>;
interface Barra { id: Chiave; nome: string; descr: string; min: number; max: number; passo: number; unita: (v: number) => string }
const imp = (v: number) => v.toFixed(1).replace('.', ',');
const giorni = (v: number) => (v < 0 ? 'mai' : v === 0 ? 'solo oggi e scadute' : v === 1 ? 'entro 1 giorno' : `entro ${v} giorni`);
const posti = (v: number) => (v === 0 ? 'nessuna' : `le prime ${v}`);

const ROSSO: Barra[] = [
  { id: 'rossoImportanza', nome: 'Importanza da', descr: 'Una nota con questa importanza (o più) è rossa', min: 1, max: 5, passo: 0.1, unita: imp },
  { id: 'rossoGiorni', nome: 'Scadenza', descr: 'Rossa se scade entro questi giorni (scadute comprese)', min: -1, max: 30, passo: 1, unita: giorni },
  { id: 'rossoPosizioni', nome: 'Sempre rosse', descr: 'Le prime della classifica sono rosse in ogni caso', min: 0, max: 20, passo: 1, unita: posti },
];
const AMBRA: Barra[] = [
  { id: 'ambraImportanza', nome: 'Importanza da', descr: 'Ambra da questa importanza (non oltre quella del rosso)', min: 1, max: 5, passo: 0.1, unita: imp },
  { id: 'ambraGiorni', nome: 'Scadenza', descr: 'Ambra se scade entro questi giorni', min: -1, max: 60, passo: 1, unita: giorni },
  { id: 'ambraPosizioni', nome: 'Almeno ambra', descr: 'Le prime della classifica sono almeno ambra', min: 0, max: 40, passo: 1, unita: posti },
];

/**
 * Altro › Regole della priorità (etichettata «Sperimentale»): cursori per le soglie del colore (importanza, scadenza, posizione) e per
 * l'ordine dentro lo stesso colore. Non c'è nessun punteggio: le regole si sincronizzano con gli altri dispositivi e cambiano subito liste,
 * pallini, battito e widget; sotto, l'anteprima delle prime sei attività.
 */
export function PesiPriorita() {
  const regole = useSyncExternalStore(subscribePesi, getPesiUtente);
  const items = useItems();
  const oggi = useOggi();
  const classifica = useMemo(() => listaAzioni(items, oggi).slice(0, 6), [items, oggi, regole]);
  const cambia = (patch: Partial<RegolePriorita>) => impostaPesiUtente({ ...regole, ...patch });
  const barra = (b: Barra) => (
    <div key={b.id} className="peso">
      <div className="peso-testa">
        <b>{b.nome}</b>
        <span className="peso-val">{b.unita(regole[b.id])}</span>
      </div>
      <input type="range" className="peso-range" min={b.min} max={b.max} step={b.passo} value={regole[b.id]} aria-label={`${b.nome} (${b.descr})`} onChange={(e) => cambia({ [b.id]: Number(e.target.value) })} />
      <div className="t2">{b.descr}</div>
    </div>
  );

  return (
    <>
      <Back label="Altro" />
      <Top title="Regole della priorità" sub="Opzione provvisoria" right={<span className="badge-sper">Sperimentale</span>} />
      <div className="scroll">
        <div className="sper-box">
          <b>Per sperimentare</b>
          <span>Nessun punteggio: vale il segnale più alto tra importanza, scadenza e posizione. Le regole si sincronizzano con gli altri dispositivi e cambiano subito liste, colori e battito.</span>
        </div>
        <Sec a="Rosso" />
        {ROSSO.map(barra)}
        <Sec a="Ambra" />
        {AMBRA.map(barra)}
        <Sec a="Ordine" />
        <div className="t2" style={{ padding: '0 0 8px' }}>Prima tutte le rosse, poi le ambra, poi le grigie. Dentro lo stesso colore va avanti:</div>
        <Seg attivo={regole.ordine} onChange={(v) => cambia({ ordine: v })} voci={[{ id: 'scadenza' as const, nome: 'Scadenza più vicina' }, { id: 'importanza' as const, nome: 'Importanza più alta' }]} />
        <div className="t2" style={{ padding: '10px 0' }}>Di base: rosso da importanza {imp(REGOLE_PREDEFINITE.rossoImportanza)}, entro {REGOLE_PREDEFINITE.rossoGiorni} giorni o le prime {REGOLE_PREDEFINITE.rossoPosizioni}; ambra da importanza {imp(REGOLE_PREDEFINITE.ambraImportanza)}, entro {REGOLE_PREDEFINITE.ambraGiorni} giorni o le prime {REGOLE_PREDEFINITE.ambraPosizioni}; ordine per scadenza.</div>
        <div className="btns">
          <button className="btn" disabled={sonoPredefiniti(regole)} onClick={ripristinaPesi}>Ripristina le regole di base</button>
        </div>
        <Sec a="Anteprima" b={classifica.length ? 'prime attività' : undefined} />
        {classifica.length === 0 && <div className="t2" style={{ padding: '8px 0' }}>Nessuna attività aperta.</div>}
        {classifica.map((e, n) => (
          <Row key={e.item.id} titolo={e.item.titolo} rank={n + 1} level={livelloPriorita(e.item, oggi, n + 1)} check="none" />
        ))}
      </div>
    </>
  );
}
