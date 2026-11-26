import { useMemo, useSyncExternalStore } from 'react';
import { CURVATURA_MAX, CURVE_PREDEFINITE, ORIZZONTE_ETA, ORIZZONTE_SCADENZA, curvaEsponenziale, livelloDaPunteggio, normalizzaPesi, PESI_PREDEFINITI, type CurvePunteggio, type PesiPunteggio } from '../../../shared/priority.ts';
import { listaAzioni } from '../../../shared/views.ts';
import { getCurveUtente, getPesiUtente, getVersionePesi, impostaCurveUtente, impostaPesiUtente, ripristinaPesi, sonoCurvePredefinite, sonoPredefiniti, subscribePesi } from '../lib/pesi.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { Back, Row, Sec, Top } from '../ui/kit.tsx';
import { CurvaModificabile, type Tacca } from '../ui/CurvaModificabile.tsx';
import { score } from '../../../shared/priority.ts';

const PARAMETRI: { id: keyof PesiPunteggio; nome: string; descr: string }[] = [
  { id: 'scadenza', nome: 'Data di scadenza', descr: 'Quanto è vicina la scadenza: oggi o scaduta pesa il massimo, senza data niente. Sale in modo esponenziale (curva sotto)' },
  { id: 'importanza', nome: 'Importanza', descr: 'Il valore che dai tu all’attività (da 1 a 5)' },
  { id: 'tempo', nome: 'Tempo stimato', descr: 'Le attività brevi salgono: più rapide, più in alto (senza stima valgono poco)' },
  { id: 'eta', nome: 'Età della nota', descr: 'Da quanto tempo esiste la nota: più è vecchia più sale, in modo esponenziale (curva sotto)' },
];

/** Le due curve esponenziali regolabili: quale parametro, assi (con nomi e numeri) e parole. */
const CURVE: { id: keyof CurvePunteggio; nome: string; orizzonte: number; titoloY: string; titoloX: string; tacchex: Tacca[]; frase: (meta: number) => string }[] = [
  {
    id: 'scadenza', nome: 'Curva della scadenza', orizzonte: ORIZZONTE_SCADENZA, titoloY: 'punti di urgenza (da 0 a 100)', titoloX: 'il tempo che passa, fino alla scadenza',
    tacchex: [{ v: 0, testo: `${ORIZZONTE_SCADENZA} giorni prima` }, { v: 0.5, testo: `${ORIZZONTE_SCADENZA / 2} giorni` }, { v: 1, testo: 'scadenza' }],
    frase: (m) => `A ${Math.round(ORIZZONTE_SCADENZA * 0.3)} giorni dalla scadenza l’urgenza vale ${m} punti su 100.`,
  },
  {
    id: 'eta', nome: 'Curva dell’età', orizzonte: ORIZZONTE_ETA, titoloY: 'punti per l’età (da 0 a 100)', titoloX: 'da quanti giorni esiste la nota',
    tacchex: [{ v: 0, testo: 'nuova' }, { v: 0.5, testo: `${ORIZZONTE_ETA / 2} giorni` }, { v: 1, testo: `${ORIZZONTE_ETA} giorni` }],
    frase: (m) => `Una nota di ${Math.round(ORIZZONTE_ETA * 0.7)} giorni prende ${m} punti su 100 per l’età.`,
  },
];

/** Dove sta il punto da trascinare lungo la curva (0-1). */
const PUNTO = 0.7;

/** La curvatura (0-8) per cui la curva in `PUNTO` vale `y`: più il punto è basso, più la curvatura è alta. */
function curvaturaPer(y: number): number {
  let basso = 0, alto = CURVATURA_MAX;
  for (let n = 0; n < 30; n++) {
    const m = (basso + alto) / 2;
    if (curvaEsponenziale(PUNTO, m) > y) basso = m; else alto = m;
  }
  return Math.round(((basso + alto) / 2) * 10) / 10;
}

/**
 * Impostazioni › Bilanciatore della priorità (etichettato «Sperimentale»): cursori per il peso di data di scadenza, importanza, tempo stimato ed età nel punteggio
 * (da 0 a 100) delle attività, e la forma delle due curve esponenziali (scadenza ed età), che si cambia trascinando un punto sul grafico. I pesi sono riportati a somma 100%, si sincronizzano con gli
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
      <Back label="Impostazioni" />
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
        <div className="t2" style={{ padding: '2px 0 6px' }}>Trascina il punto tondo in su o in giù: in alto la curva sale in modo regolare, in basso resta bassa a lungo e poi sale di colpo. La linea tratteggiata è la curva di base.</div>
        {CURVE.map((c) => {
          const k = curve[c.id];
          const punti = Math.round(100 * curvaEsponenziale(PUNTO, k));
          return (
            <div key={c.id} className="peso">
              <div className="peso-testa"><b>{c.nome}</b></div>
              <CurvaModificabile
                nome={c.nome} titoloY={c.titoloY} titoloX={c.titoloX} xMax={1} yMax={1}
                tacchey={[{ v: 0, testo: '0' }, { v: 0.5, testo: '50' }, { v: 1, testo: '100' }]}
                tacchex={c.tacchex}
                curva={(x) => curvaEsponenziale(x, k)} base={(x) => curvaEsponenziale(x, CURVE_PREDEFINITE[c.id])}
                maniglie={[{ id: c.id, asse: 'y', x: PUNTO, y: curvaEsponenziale(PUNTO, k), passo: 0.03, nome: `Forma della ${c.nome.toLowerCase()}`, valore: `${punti} punti`, muovi: (v) => cambiaCurva(c.id, curvaturaPer(v)) }]}
              />
              <p className="cm-frase">{c.frase(punti)}</p>
            </div>
          );
        })}
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
