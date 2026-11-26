import { useMemo, useSyncExternalStore } from 'react';
import { fattoreLunghezza, LIMITI_MARGINE, livelloMargine, margineAtteso, MARGINE_PREDEFINITO, percentuale, quotaErrore, quotaScaduta, storicoNote, type ParametriMargine } from '../../../shared/stima.ts';
import { getMargineUtente, impostaMargineUtente, ripristinaMargine, sonoMargineDiBase, subscribeMargine } from '../lib/pesiMargine.ts';
import { useItems } from '../lib/hooks.ts';
import { clsx, nomeTempo } from '../lib/util.ts';
import { Back, Sec, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';

const virgola = (n: number, cifre = 2) => n.toFixed(cifre).replace('.', ',');

/** Uno dei tre fattori del margine: peso, parametro della curva, disegno della curva e spiegazione. */
interface Fattore {
  id: keyof ParametriMargine;
  nome: string;
  descr: string;
  /** Il cursore della forma della curva. */
  curva: { chiave: string; nome: string; limiti: readonly [number, number]; passo: number; mostra: (v: number) => string };
  /** Il grafico: x da 0 a `xMax`, y da 0 a `yMax`. */
  xMax: number;
  yMax: number;
  asseX: [string, string];
  asseY: string;
  y: (x: number, p: ParametriMargine) => number;
}

const FATTORI: Fattore[] = [
  {
    id: 'eta', nome: 'Età della nota',
    descr: 'Quanto in fretta le note vecchie contano meno. Il grafico mostra quanto resta del margine precedente se passano dei giorni prima della nota successiva. Con peso 0% l’età non conta.',
    curva: { chiave: 'emivita', nome: 'Si dimezza dopo', limiti: LIMITI_MARGINE.emivita, passo: 1, mostra: (v) => `${Math.round(v)} giorni` },
    xMax: 120, yMax: 1, asseX: ['oggi', '120 giorni'], asseY: 'quanto resta del margine vecchio',
    y: (x, p) => 1 - quotaScaduta(x, p),
  },
  {
    id: 'lunghezza', nome: 'Lunghezza della nota',
    descr: 'Quanto una nota lunga sposta il margine più di una breve. Il grafico mostra il moltiplicatore in base alla stima (1 = una nota di un’ora, tra 0,6 e 1,4 al peso 100%). Con peso 0% tutte le durate valgono uguale.',
    curva: { chiave: 'esponente', nome: 'Curvatura', limiti: LIMITI_MARGINE.esponente, passo: 0.05, mostra: (v) => virgola(v) },
    xMax: 240, yMax: 2, asseX: ['0 min', '4 ore'], asseY: 'moltiplicatore',
    y: (x, p) => fattoreLunghezza(x, p),
  },
  {
    id: 'errore', nome: 'Errore rispetto al previsto',
    descr: 'Quanto contano le note in base allo sbaglio: una stima giusta sposta molto il margine, una molto sbagliata poco. La tolleranza dice a quale errore la forza scende. Con peso 0% giuste e sbagliate valgono uguale.',
    curva: { chiave: 'scala', nome: 'Tolleranza', limiti: LIMITI_MARGINE.scala, passo: 0.01, mostra: (v) => `${Math.round(v * 100)}%` },
    xMax: 1, yMax: 0.85, asseX: ['errore 0%', 'errore 100%'], asseY: 'quanto sposta il margine',
    y: (x, p) => quotaErrore(x, p),
  },
];

/** La curva scelta (piena) e quella di base (tratteggiata). */
function Grafico({ f, p }: { f: Fattore; p: ParametriMargine }) {
  const W = 220, H = 90, P = 6;
  const punti = (q: ParametriMargine) => Array.from({ length: 61 }, (_, n) => {
    const t = n / 60;
    const v = Math.min(1, Math.max(0, f.y(t * f.xMax, q) / f.yMax));
    return `${(P + t * (W - 2 * P)).toFixed(1)},${(H - P - v * (H - 2 * P)).toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="curva-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Curva di ${f.nome}: ${f.asseY}`}>
      <rect x={P} y={P} width={W - 2 * P} height={H - 2 * P} className="curva-box" />
      <polyline points={punti(MARGINE_PREDEFINITO)} className="curva-retta" fill="none" />
      <polyline points={punti(p)} className="curva-linea" />
    </svg>
  );
}

/**
 * Impostazioni › Bilanciatore del margine: per l’età, la lunghezza e l’errore rispetto al previsto un cursore del peso (da 0 a 200%,
 * 100% di base) e uno della forma della curva, con il grafico (tratteggiata la curva di base). Cambia subito il margine, si
 * sincronizza con gli altri dispositivi; sotto, il margine risultante e quanto pesa ognuna delle ultime note.
 */
export function PesiMargine() {
  const p = useSyncExternalStore(subscribeMargine, getMargineUtente);
  const items = useItems();
  const nav = useNav();
  const margine = useMemo(() => margineAtteso(items), [items, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const note = useMemo(() => storicoNote(items, Date.now(), 15), [items, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const cambia = (id: keyof ParametriMargine, chiave: string, v: number) => impostaMargineUtente({ ...p, [id]: { ...p[id], [chiave]: v } });

  return (
    <>
      <Back label="Impostazioni" />
      <Top title="Bilanciatore del margine" sub="Opzione provvisoria" right={<span className="badge-sper">Sperimentale</span>} />
      <div className="scroll">
        <div className="sper-box">
          <b>Per sperimentare</b>
          <span>Il margine è il tempo da aggiungere (o togliere) alle tue stime, calcolato dalle note completate. Qui regoli quanto contano l&apos;età, la lunghezza e l&apos;errore di ogni nota, ognuno con un peso e una curva. Le modifiche si sincronizzano con gli altri dispositivi.</span>
        </div>
        {FATTORI.map((f) => {
          const valori = p[f.id] as unknown as Record<string, number>;
          const v = valori[f.curva.chiave];
          return (
            <div key={f.id}>
              <Sec a={f.nome} />
              <div className="peso">
                <div className="peso-testa"><b>Peso</b><span className="peso-val">{Math.round(valori.peso * 100)}%</span></div>
                <input type="range" className="peso-range" min={0} max={200} step={5} value={Math.round(valori.peso * 100)} aria-label={`Peso ${f.nome}`} onChange={(e) => cambia(f.id, 'peso', Number(e.target.value) / 100)} />
                <div className="peso-testa"><b>{f.curva.nome}</b><span className="peso-val">{f.curva.mostra(v)}</span></div>
                <Grafico f={f} p={p} />
                <div className="curva-assi"><span>{f.asseX[0]}</span><span>{f.asseX[1]}</span></div>
                <input type="range" className="peso-range" min={f.curva.limiti[0]} max={f.curva.limiti[1]} step={f.curva.passo} value={v} aria-label={`${f.curva.nome}: ${f.nome}`} onChange={(e) => cambia(f.id, f.curva.chiave, Number(e.target.value))} />
                <div className="t2">{f.descr} In alto: {f.asseY}.</div>
              </div>
            </div>
          );
        })}
        <div className="btns">
          <button className="btn" disabled={sonoMargineDiBase(p)} onClick={ripristinaMargine}>Ripristina pesi e curve di base</button>
        </div>
        <Sec a="Anteprima" />
        <div className="field"><b style={{ fontWeight: 620 }}>Margine con queste curve</b><span className={clsx(`mg-${livelloMargine(margine)}`)}>{percentuale(margine)}</span></div>
        {note.length === 0 && <div className="t2" style={{ padding: '8px 0' }}>Ancora nessuna nota completata con stima e tempo reale.</div>}
        {note.map((n) => (
          <button key={n.item.id} className="field link" onClick={() => nav.push({ k: 'item', id: n.item.id })}>
            <span><b style={{ fontWeight: 620 }}>{n.item.titolo}</b><span className="t2" style={{ display: 'block' }}>{nomeTempo(n.stimaMin)} → {nomeTempo(n.realeMin)} · {percentuale(n.scostamento)}</span></span>
            <span className="muted">peso {Math.round(n.peso * 100)}%</span>
          </button>
        ))}
        <button className="field link" onClick={() => nav.push({ k: 'storicomargine' })}><b style={{ fontWeight: 620 }}>Storico del margine</b><span className="muted">›</span></button>
      </div>
    </>
  );
}
