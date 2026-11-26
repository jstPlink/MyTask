/**
 * Grafico di una curva con i punti da trascinare (bilanciatori di priorità e margine). L'asse verticale e quello orizzontale hanno
 * nome e numeri; la curva di base è tratteggiata. Ogni punto («maniglia») si muove in una direzione o in tutte e due, con il dito, il
 * mouse o le frecce della tastiera, e porta scritto il suo valore.
 */
import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

export interface Maniglia {
  id: string;
  /** Dove sta il punto, nelle unità degli assi. */
  x: number;
  y: number;
  /** La direzione in cui si trascina («xy»: libero). */
  asse: 'x' | 'y' | 'xy';
  /** Scritta accanto al punto (il suo valore). */
  valore: string;
  /** Nome letto dagli screen reader. */
  nome: string;
  /** Passo delle frecce, nelle unità dell'asse trascinato (con «xy» è quello orizzontale e `passoY` il verticale). */
  passo: number;
  passoY?: number;
  /** Riceve la nuova posizione lungo l'asse trascinato (già dentro il grafico); con «xy» riceve orizzontale e verticale. */
  muovi: (v: number, y: number) => void;
}

export interface Tacca { v: number; testo: string }

// misure del disegno (unità del viewBox)
const W = 340;
const H = 214;
const SX = 40;
const DX = 12;
const SU = 14;
const GIU = 26;
const LARGO = W - SX - DX;
const ALTO = H - SU - GIU;

export function CurvaModificabile({ nome, titoloY, titoloX, xMax, yMax, tacchex, tacchey, curva, base, maniglie }: {
  nome: string;
  /** Che cosa misurano i due assi, in parole. */
  titoloY: string;
  titoloX: string;
  xMax: number;
  yMax: number;
  tacchex: Tacca[];
  tacchey: Tacca[];
  curva: (x: number) => number;
  base: (x: number) => number;
  maniglie: Maniglia[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const attiva = useRef<string | null>(null);
  const px = (x: number) => SX + (x / xMax) * LARGO;
  const py = (y: number) => SU + ALTO - (Math.min(yMax, Math.max(0, y)) / yMax) * ALTO;
  const punti = (f: (x: number) => number) => Array.from({ length: 121 }, (_, n) => { const x = (n / 120) * xMax; return `${px(x).toFixed(1)},${py(f(x)).toFixed(1)}`; }).join(' ');

  const trascina = (m: Maniglia, e: ReactPointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || attiva.current !== m.id) return;
    const ux = ((e.clientX - r.left) / r.width) * W;
    const uy = ((e.clientY - r.top) / r.height) * H;
    const x = Math.min(xMax, Math.max(0, ((ux - SX) / LARGO) * xMax));
    const y = Math.min(yMax, Math.max(0, ((SU + ALTO - uy) / ALTO) * yMax));
    m.muovi(m.asse === 'y' ? y : x, y);
  };
  const tasti = (m: Maniglia, e: KeyboardEvent) => {
    const verso = e.key === 'ArrowRight' ? [1, 0] : e.key === 'ArrowLeft' ? [-1, 0] : e.key === 'ArrowUp' ? [0, 1] : e.key === 'ArrowDown' ? [0, -1] : undefined;
    if (!verso || (m.asse === 'x' && !verso[0]) || (m.asse === 'y' && !verso[1])) return;
    e.preventDefault();
    const x = Math.max(0, m.x + verso[0] * m.passo);
    const y = Math.max(0, m.y + verso[1] * (m.asse === 'xy' ? m.passoY ?? m.passo : m.passo));
    m.muovi(m.asse === 'y' ? y : x, y);
  };

  return (
    <figure className="cm">
      <figcaption className="cm-y"><span aria-hidden="true">↑</span> In verticale: {titoloY}</figcaption>
      <div className="cm-box" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${nome}. Verticale: ${titoloY}. Orizzontale: ${titoloX}.`}>
          <rect x={SX} y={SU} width={LARGO} height={ALTO} className="curva-box" />
          {tacchey.map((t) => (
            <g key={`y${t.v}`}>
              <line x1={SX} x2={SX + LARGO} y1={py(t.v)} y2={py(t.v)} className="cm-griglia" />
              <text x={SX - 5} y={py(t.v) + 3.5} className="cm-num" textAnchor="end">{t.testo}</text>
            </g>
          ))}
          {tacchex.map((t, n) => (
            <g key={`x${t.v}`}>
              <line x1={px(t.v)} x2={px(t.v)} y1={SU} y2={SU + ALTO} className="cm-griglia" />
              <text x={px(t.v)} y={SU + ALTO + 15} className="cm-num" textAnchor={n === 0 ? 'start' : n === tacchex.length - 1 ? 'end' : 'middle'}>{t.testo}</text>
            </g>
          ))}
          <polyline points={punti(base)} className="curva-retta" fill="none" />
          <polyline points={punti(curva)} className="curva-linea" />
        </svg>
        {maniglie.map((m) => {
          const alto = py(m.y) < SU + 28;
          return (
            <button
              key={m.id} type="button" className={`cm-punto asse-${m.asse}`} role="slider"
              aria-label={m.nome} aria-valuetext={m.valore} aria-valuenow={Math.round((m.asse === 'x' ? m.x : m.y) * 1000) / 1000}
              style={{ left: `${(px(m.x) / W) * 100}%`, top: `${(py(m.y) / H) * 100}%` }}
              onPointerDown={(e) => { attiva.current = m.id; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); }}
              onPointerMove={(e) => trascina(m, e)}
              onPointerUp={() => { attiva.current = null; }}
              onPointerCancel={() => { attiva.current = null; }}
              onKeyDown={(e) => tasti(m, e)}
            >
              <i aria-hidden="true">{m.asse === 'x' ? '↔' : m.asse === 'y' ? '↕' : '✥'}</i>
              <b className={`cm-etichetta${alto ? ' sotto' : ''}${px(m.x) > W * 0.72 ? ' sinistra' : px(m.x) < W * 0.28 ? ' destra' : ''}`}>{m.valore}</b>
            </button>
          );
        })}
      </div>
      <div className="cm-x">In orizzontale: {titoloX} <span aria-hidden="true">→</span></div>
    </figure>
  );
}
