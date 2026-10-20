import { useMemo, useSyncExternalStore } from 'react';
import { livelloDaPunteggio, normalizzaPesi, PESI_PREDEFINITI, type PesiPunteggio } from '../../../shared/priority.ts';
import { listaAzioni } from '../../../shared/views.ts';
import { getPesiUtente, impostaPesiUtente, ripristinaPesi, sonoPredefiniti, subscribePesi } from '../lib/pesi.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { Back, Row, Sec, Top } from '../ui/kit.tsx';
import { score } from '../../../shared/priority.ts';

const PARAMETRI: { id: keyof PesiPunteggio; nome: string; descr: string }[] = [
  { id: 'scadenza', nome: 'Data di scadenza', descr: 'Quanto è vicina la scadenza: oggi o scaduta pesa il massimo, senza data niente' },
  { id: 'importanza', nome: 'Importanza', descr: 'Il valore che dai tu all\u2019attività (da 1 a 5)' },
  { id: 'tempo', nome: 'Tempo stimato', descr: 'Le attività brevi salgono: più rapide, più in alto (senza stima valgono poco)' },
];

/**
 * Altro › Bilanciatore della priorità (etichettato «Sperimentale»): cursori per il peso di data di scadenza, importanza e tempo stimato nel punteggio
 * (da 0 a 100) delle attività. I pesi sono riportati a somma 100%, si sincronizzano con gli altri dispositivi e cambiano subito liste, colori del
 * pallino (da 60 rosso, da 35 ambra), battito, ordine e widget; sotto, l'anteprima delle prime 15 attività con il punteggio.
 */
export function PesiPriorita() {
  const pesi = useSyncExternalStore(subscribePesi, getPesiUtente);
  const items = useItems();
  const oggi = useOggi();
  const classifica = useMemo(() => listaAzioni(items, oggi).slice(0, 15), [items, oggi, pesi]);
  const eff = normalizzaPesi(pesi);
  const cambia = (id: keyof PesiPunteggio, valore: number) => impostaPesiUtente({ ...pesi, [id]: valore / 100 });

  return (
    <>
      <Back label="Altro" />
      <Top title="Bilanciatore della priorità" sub="Opzione provvisoria" right={<span className="badge-sper">Sperimentale</span>} />
      <div className="scroll">
        <div className="sper-box">
          <b>Per sperimentare</b>
          <span>Cambia quanto conta ogni parametro nel punteggio di un&apos;attività (da 0 a 100). I pesi si riportano a somma 100%, si sincronizzano con gli altri dispositivi e cambiano subito ordine, colore e battito del pallino: da 60 punti rosso, da 35 ambra, sotto grigio e fermo; più il punteggio sale più il pallino batte veloce.</span>
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
        <div className="t2" style={{ padding: '4px 0 10px' }}>Di base: data di scadenza {Math.round(PESI_PREDEFINITI.scadenza * 100)}%, importanza {Math.round(PESI_PREDEFINITI.importanza * 100)}%, tempo stimato {Math.round(PESI_PREDEFINITI.tempo * 100)}%.</div>
        <div className="btns">
          <button className="btn" disabled={sonoPredefiniti(eff)} onClick={ripristinaPesi}>Ripristina i pesi di base</button>
        </div>
        <Sec a="Anteprima" b={classifica.length ? 'prime attività' : undefined} />
        {classifica.length === 0 && <div className="t2" style={{ padding: '8px 0' }}>Nessuna attività aperta.</div>}
        {classifica.map((e, n) => {
          const punti = score(e.item, oggi);
          return <Row key={e.item.id} titolo={e.item.titolo} rank={n + 1} level={livelloDaPunteggio(punti)} check="none" meta={`punteggio ${punti}`} />;
        })}
      </div>
    </>
  );
}
