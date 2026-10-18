import { useState } from 'react';
import { addDays, addMonths, formatLong, monthLabel, startOfWeek } from '../../../shared/dates.ts';

// iniziali dei giorni, da lunedì
const SETTIMANA = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

const primoDelMese = (iso: string) => `${iso.slice(0, 7)}-01`;

/** Cosa mostrare sotto un giorno: `n` attività (al massimo 3 pallini) e `avviso` se la prima è una scadenza fissa o scaduta. */
export interface SegnoGiorno { n: number; avviso: boolean }

/**
 * Griglia del mese usata in Oggi (finestra del calendario): frecce per cambiare mese, un pallino per i giorni che hanno attività
 * (arancio se c'è una scadenza fissa o scaduta). Toccando un giorno lo si sceglie: `giorno` è quello selezionato, `oggi` quello evidenziato.
 */
export function GrigliaMese({ giorno, oggi, segni, onScegli }: {
  giorno: string;
  oggi: string;
  segni: Map<string, SegnoGiorno>;
  onScegli: (d: string) => void;
}) {
  const [mese, setMese] = useState(primoDelMese(giorno));
  const ultimo = addDays(addMonths(mese, 1), -1);
  const start = startOfWeek(mese);
  const settimane = Math.ceil(((new Date(ultimo).getTime() - new Date(start).getTime()) / 86400000 + 1) / 7);
  const giorni = Array.from({ length: settimane * 7 }, (_, n) => addDays(start, n));
  const vaiMese = (n: number) => setMese(addMonths(mese, n));

  return (
    <>
      <div className="cal-head">
        <b>{monthLabel(mese)}</b>
        <div className="cal-nav">
          <button onClick={() => vaiMese(-1)} aria-label="Mese precedente">‹</button>
          <button onClick={() => vaiMese(1)} aria-label="Mese successivo">›</button>
        </div>
      </div>
      <div className="cal" role="grid">
        {SETTIMANA.map((g, n) => <div key={n} className="dw">{g}</div>)}
        {giorni.map((d) => {
          const s = segni.get(d);
          return (
            <button key={d} className={['cal-d', d.slice(0, 7) !== mese.slice(0, 7) && 'fuori', d === oggi && 'oggi', d === giorno && 'sel'].filter(Boolean).join(' ')}
              onClick={() => onScegli(d)}
              aria-label={`${formatLong(d)}${s ? `, ${s.n} ${s.n === 1 ? 'cosa' : 'cose'}` : ''}`} aria-pressed={d === giorno}>
              {Number(d.slice(8))}
              <div className="cal-dots">{s ? Array.from({ length: Math.min(3, s.n) }, (_, n) => <i key={n} className={s.avviso && n === 0 ? 'w' : undefined} />) : null}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}
