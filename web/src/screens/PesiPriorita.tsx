import { useMemo, useSyncExternalStore } from 'react';
import { barLevel, normalizzaPesi, PESI_PREDEFINITI, type PesiPunteggio } from '../../../shared/priority.ts';
import { listaAzioni } from '../../../shared/views.ts';
import { getPesiUtente, impostaPesiUtente, ripristinaPesi, sonoPredefiniti, subscribePesi } from '../lib/pesi.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { Back, Row, Sec, Top } from '../ui/kit.tsx';

const PARAMETRI: { id: keyof PesiPunteggio; nome: string; descr: string }[] = [
  { id: 'urgenza', nome: 'Urgenza', descr: 'Quanto è vicina la scadenza' },
  { id: 'importanza', nome: 'Importanza', descr: 'Il valore che dai tu all\u2019attività' },
  { id: 'sforzo', nome: 'Poco sforzo', descr: 'Le attività brevi salgono: più rapide, più in alto' },
  { id: 'eta', nome: 'Et\u00e0', descr: 'Più è vecchia la nota, più sale (fino a 10 settimane)' },
  { id: 'fissa', nome: 'Scadenza fissa', descr: 'Solo per le date che non si possono spostare: pesa quanto l\u2019urgenza' },
];

/**
 * Altro › Pesi della priorità (etichettata «Sperimentale»): cursori per il peso di urgenza, importanza, poco sforzo, età e scadenza fissa
 * nel punteggio delle attività. I pesi sono riportati a somma 100%, valgono solo su questo dispositivo e cambiano subito liste, piano e widget;
 * sotto, l'anteprima delle prime sei attività con il nuovo ordine.
 */
export function PesiPriorita() {
  const pesi = useSyncExternalStore(subscribePesi, getPesiUtente);
  const items = useItems();
  const oggi = useOggi();
  const classifica = useMemo(() => listaAzioni(items, oggi).slice(0, 6), [items, oggi, pesi]);
  const eff = normalizzaPesi(pesi);
  const cambia = (id: keyof PesiPunteggio, valore: number) => impostaPesiUtente({ ...pesi, [id]: valore / 100 });

  return (
    <>
      <Back label="Altro" />
      <Top title="Pesi della priorità" sub="Opzione provvisoria" right={<span className="badge-sper">Sperimentale</span>} />
      <div className="scroll">
        <div className="sper-box">
          <b>Per sperimentare</b>
          <span>Cambia quanto conta ogni parametro nel punteggio di un&apos;attività. I pesi si riportano a somma 100%, valgono solo su questo dispositivo e cambiano subito liste, piano e widget. Il punteggio resta tra 0 e 100.</span>
        </div>
        <Sec a="Parametri" />
        {PARAMETRI.map((p) => (
          <div key={p.id} className="peso">
            <div className="peso-testa">
              <b>{p.nome}</b>
              <span className="peso-val">{Math.round(eff[p.id] * 100)}%</span>
            </div>
            <input type="range" className="peso-range" min={0} max={100} step={1} value={Math.round(pesi[p.id] * 100)} aria-label={`Peso ${p.nome}`} onChange={(e) => cambia(p.id, Number(e.target.value))} />
            <div className="t2">{p.descr}</div>
          </div>
        ))}
        <div className="t2" style={{ padding: '4px 0 10px' }}>Di base: urgenza {Math.round(PESI_PREDEFINITI.urgenza * 100)}%, importanza {Math.round(PESI_PREDEFINITI.importanza * 100)}%, poco sforzo {Math.round(PESI_PREDEFINITI.sforzo * 100)}%, età {Math.round(PESI_PREDEFINITI.eta * 100)}%, scadenza fissa {Math.round(PESI_PREDEFINITI.fissa * 100)}%.</div>
        <div className="btns">
          <button className="btn" disabled={sonoPredefiniti(eff)} onClick={ripristinaPesi}>Ripristina i pesi di base</button>
        </div>
        <Sec a="Anteprima" b={classifica.length ? 'prime attività' : undefined} />
        {classifica.length === 0 && <div className="t2" style={{ padding: '8px 0' }}>Nessuna attività aperta.</div>}
        {classifica.map((e, n) => (
          <Row key={e.item.id} titolo={e.item.titolo} rank={n + 1} level={barLevel(e.punteggio)} check="none" meta={`punteggio ${e.punteggio}`} />
        ))}
      </div>
    </>
  );
}
