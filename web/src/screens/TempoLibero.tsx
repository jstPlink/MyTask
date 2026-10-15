import type { Disponibilita, FasciaOraria } from '../../../shared/piano.ts';
import { minuti } from '../../../shared/piano.ts';
import { useDisponibilita } from '../lib/hooks.ts';
import { copiaSuggerita, impostaDisponibilita, usaSuggerita } from '../lib/disponibilita.ts';
import { Back, Sec, Top } from '../ui/kit.tsx';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const durata = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;

export function TempoLibero() {
  const disp = useDisponibilita();
  const d: Disponibilita = disp ?? { settimana: Array.from({ length: 7 }, () => []) };

  const cambia = (giorno: number, fasce: FasciaOraria[]) => {
    const settimana = d.settimana.map((f, n) => (n === giorno ? fasce : f));
    impostaDisponibilita({ ...d, settimana });
  };
  const totale = d.settimana.reduce((n, g) => n + g.reduce((m, f) => m + Math.max(0, minuti(f.a) - minuti(f.da)), 0), 0);

  return (
    <>
      <Back label="Altro" />
      <Top title="Tempo libero" sub={disp ? `${durata(totale)} a settimana` : 'Non ancora impostato'} />
      <div className="scroll">
        <div className="card">
          <div className="t1">Quando hai tempo per le attività</div>
          <div className="t2" style={{ marginTop: 4 }}>
            MyTask distribuisce le attività nei giorni in base a priorità, durata e a questo tempo libero. Le fasce valgono per ogni settimana e sono salvate su questo dispositivo.
          </div>
          <div className="btns">
            {!disp
              ? <button className="btn solid" onClick={usaSuggerita}>Usa le fasce suggerite</button>
              : <button className="btn" onClick={() => impostaDisponibilita(copiaSuggerita())}>Ripristina quelle suggerite</button>}
          </div>
        </div>
        <Sec a="Fasce per giorno" />
        {GIORNI.map((nome, g) => (
          <div key={nome} className="tl-giorno">
            <div className="tl-nome">{nome}</div>
            <div className="tl-fasce">
              {d.settimana[g].length === 0 && <span className="t2">Nessun tempo libero</span>}
              {d.settimana[g].map((f, n) => (
                <div key={n} className="tl-fascia">
                  <input type="time" value={f.da} aria-label={`${nome}, inizio fascia ${n + 1}`} onChange={(e) => e.target.value && cambia(g, d.settimana[g].map((x, k) => (k === n ? { ...x, da: e.target.value } : x)))} />
                  <span aria-hidden="true">–</span>
                  <input type="time" value={f.a} aria-label={`${nome}, fine fascia ${n + 1}`} onChange={(e) => e.target.value && cambia(g, d.settimana[g].map((x, k) => (k === n ? { ...x, a: e.target.value } : x)))} />
                  <button className="tl-x" aria-label={`Togli la fascia ${n + 1} di ${nome}`} onClick={() => cambia(g, d.settimana[g].filter((_, k) => k !== n))}>×</button>
                </div>
              ))}
              <button className="tl-add" onClick={() => cambia(g, [...d.settimana[g], d.settimana[g].length ? { da: d.settimana[g][d.settimana[g].length - 1].a, a: '22:00' } : { da: '18:00', a: '21:00' }])}>+ Aggiungi fascia</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
