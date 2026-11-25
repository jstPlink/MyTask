import { useMemo, useSyncExternalStore } from 'react';
import { CURVATURA_MAX, CURVE_PREDEFINITE, ORIZZONTE_ETA, ORIZZONTE_SCADENZA, curvaEsponenziale, livelloDaPunteggio, normalizzaPesi, PESI_PREDEFINITI, type CurvePunteggio, type PesiPunteggio } from '../../../shared/priority.ts';
import { listaAzioni } from '../../../shared/views.ts';
import { getCurveUtente, getPesiUtente, getVersionePesi, impostaCurveUtente, impostaPesiUtente, ripristinaPesi, sonoCurvePredefinite, sonoPredefiniti, subscribePesi } from '../lib/pesi.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { Back, Row, Sec, Top } from '../ui/kit.tsx';
import { score } from '../../../shared/priority.ts';

const PARAMETRI: { id: keyof PesiPunteggio; nome: string; descr: string }[] = [
  { id: 'scadenza', nome: 'Data di scadenza', descr: 'Quanto è vicina la scadenza: oggi o scaduta pesa il massimo, senza data niente. Sale in modo esponenziale (curva sotto)' },
  { id: 'importanza', nome: 'Importanza', descr: 'Il valore che dai tu all’attività (da 1 a 5)' },
  { id: 'tempo', nome: 'Tempo stimato', descr: 'Le attività brevi salgono: più rapide, più in alto (senza stima valgono poco)' },
  { id: 'eta', nome: 'Età della nota', descr: 'Da quanto tempo esiste la nota: più è vecchia più sale, in modo esponenziale (curva sotto)' },
];

/** Le due curve esponenziali regolabili: quale parametro, su che orizzonte e con che parole. */
const CURVE: { id: keyof CurvePunteggio; nome: string; orizzonte: number; asseX: [string, string]; descr: string }[] = [
  { id: 'scadenza', nome: 'Curva della scadenza', orizzonte: ORIZZONTE_SCADENZA, asseX: [`${ORIZZONTE_SCADENZA} giorni prima`, 'scadenza'], descr: `Da ${ORIZZONTE_SCADENZA} giorni prima della scadenza l'urgenza sale da 0 a 100. A 0 è una retta; più alzi la curvatura più resta bassa a lungo e poi sale di colpo vicino alla data.` },
  { id: 'eta', nome: 'Curva dell’età', orizzonte: ORIZZONTE_ETA, asseX: ['nuova', `${ORIZZONTE_ETA} giorni`], descr: `Una nota nuova vale 0, dopo ${ORIZZONTE_ETA} giorni il massimo. Più alzi la curvatura più le note giovani contano poco e quelle molto vecchie di colpo molto.` },
];

/** Disegno della curva (da 0 a 100) con la curvatura scelta; la retta tratteggiata è la curva lineare. */
function GraficoCurva({ k, nome }: { k: number; nome: string }) {
  const W = 220, H = 90, P = 6;
  const pt = (x: number) => `${(P + x * (W - 2 * P)).toFixed(1)},${(H - P - curvaEsponenziale(x, k) * (H - 2 * P)).toFixed(1)}`;
  const punti = Array.from({ length: 41 }, (_, n) => pt(n / 40)).join(' ');
  return (
    <svg className="curva-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${nome}, curvatura ${k.toFixed(1)}`}>
      <rect x={P} y={P} width={W - 2 * P} height={H - 2 * P} className="curva-box" />
      <line x1={P} y1={H - P} x2={W - P} y2={P} className="curva-retta" />
      <polyline points={punti} className="curva-linea" />
    </svg>
  );
}

/**
 * Altro › Bilanciatore della priorità (etichettato «Sperimentale»): cursori per il peso di data di scadenza, importanza, tempo stimato ed età nel punteggio
 * (da 0 a 100) delle attività, e la curvatura delle due curve esponenziali (scadenza ed età). I pesi sono riportati a somma 100%, si sincronizzano con gli
 * altri dispositivi e cambiano subito liste, colori del pallino (da 60 rosso, da 35 ambra), battito, ordine e widget; sotto, l'anteprima delle prime 15 attività.
 */
export function PesiPriorita() {
  const pesi = useSyncExternalStore(subscribePesi, getPesiUtente);
  const curve = getCurveUtente();
  useSyncExternalStore(subscribePesi, getVersionePesi);
  const items = useItems();
  const oggi = useOggi();
  const classifica = useMemo(() => listaAzioni(items, oggi).slice(0, 15), [items, oggi, pesi, curve]);
  const eff = normalizzaPesi(pesi);
  const cambia = (id: keyof PesiPunteggio, valore: number) => impostaPesiUtente({ ...pesi, [id]: valore / 100 });
  const cambiaCurva = (id: keyof CurvePunteggio, valore: number) => impostaCurveUtente({ ...curve, [id]: valore });

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
        <div className="t2" style={{ padding: '4px 0 10px' }}>Di base: data di scadenza {Math.round(PESI_PREDEFINITI.scadenza * 100)}%, importanza {Math.round(PESI_PREDEFINITI.importanza * 100)}%, tempo stimato {Math.round(PESI_PREDEFINITI.tempo * 100)}%, età {Math.round(PESI_PREDEFINITI.eta * 100)}%.</div>
        <Sec a="Curve" b="esponenziali" />
        {CURVE.map((c) => (
          <div key={c.id} className="peso">
            <div className="peso-testa">
              <b>{c.nome}</b>
              <span className="peso-val">{curve[c.id].toFixed(1).replace('.', ',')}</span>
            </div>
            <GraficoCurva k={curve[c.id]} nome={c.nome} />
            <div className="curva-assi"><span>{c.asseX[0]}</span><span>{c.asseX[1]}</span></div>
            <input type="range" className="peso-range" min={0} max={CURVATURA_MAX} step={0.1} value={curve[c.id]} aria-label={`Curvatura ${c.nome}`} onChange={(e) => cambiaCurva(c.id, Number(e.target.value))} />
            <div className="t2">{c.descr} Di base {CURVE_PREDEFINITE[c.id]}.</div>
          </div>
        ))}
        <div className="btns">
          <button className="btn" disabled={sonoPredefiniti(eff) && sonoCurvePredefinite(curve)} onClick={ripristinaPesi}>Ripristina pesi e curve di base</button>
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
