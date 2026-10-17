import { useEffect, useState } from 'react';
import { leggiDurata, scomponi, scriviDurata } from '../../../shared/tempo.ts';
import { clsx } from '../lib/util.ts';
import { useLayer } from './nav.tsx';

const PASSO_MINUTI = 15;

/**
 * Tempo stimato: si scrive a mano ("45m", "6h", "4g", "5g 6h", "1h30") oppure si sceglie con un selettore
 * di giorni, ore e minuti (a passi di 15 minuti).
 */
export function CampoTempo({ label, valore, onChange }: { label: string; valore: number | undefined; onChange: (min: number | undefined) => void }) {
  const [testo, setTesto] = useState(scriviDurata(valore));
  const [aperto, setAperto] = useState(false);
  const esito = leggiDurata(testo);
  useLayer('tempo', aperto, () => setAperto(false)); // il selettore è un pannello della pila: "indietro" lo chiude

  // se il valore cambia da fuori (selettore, suggerimento "Usa") il testo lo segue
  useEffect(() => {
    const letto = leggiDurata(testo);
    if (!(letto.ok && letto.minuti === valore)) setTesto(scriviDurata(valore));
  }, [valore]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="field campo-tempo">
        <span>{label}</span>
        <input value={testo} inputMode="text" autoCapitalize="none" autoCorrect="off" placeholder="es. 45m, 6h, 1g 2h"
          aria-label={label} aria-invalid={!esito.ok}
          onChange={(e) => { setTesto(e.target.value); const r = leggiDurata(e.target.value); if (r.ok) onChange(r.minuti); }}
          onBlur={() => { if (esito.ok) setTesto(scriviDurata(esito.minuti)); }} />
        <button type="button" className="chip" aria-label={`${label}: scegli con il selettore`} onClick={() => setAperto(true)}>Scegli</button>
      </div>
      {!esito.ok && <div className="t2 warn" style={{ padding: '2px 0 8px' }}>Non capisco: scrivi per esempio 45m, 6h, 4g oppure 5g 6h.</div>}
      {aperto && <SelettoreTempo label={label} iniziale={valore} onFatto={(m) => { onChange(m); setAperto(false); }} onChiudi={() => setAperto(false)} />}
    </>
  );
}

function SelettoreTempo({ label, iniziale, onFatto, onChiudi }: { label: string; iniziale: number | undefined; onFatto: (min: number | undefined) => void; onChiudi: () => void }) {
  const [t, setT] = useState(() => {
    const s = scomponi(iniziale);
    return { ...s, m: Math.round(s.m / PASSO_MINUTI) * PASSO_MINUTI % 60, h: s.h + (Math.round(s.m / PASSO_MINUTI) * PASSO_MINUTI >= 60 ? 1 : 0) };
  });
  const totale = t.g * 1440 + t.h * 60 + t.m;
  const passo = (campo: 'g' | 'h' | 'm', delta: number) => setT((x) => {
    const max = campo === 'g' ? 365 : campo === 'h' ? 23 : 60 - PASSO_MINUTI;
    const passoCampo = campo === 'm' ? PASSO_MINUTI : 1;
    let v = x[campo] + delta * passoCampo;
    if (campo === 'm') v = ((v % 60) + 60) % 60; // dopo 45 si torna a 0 (e viceversa)
    return { ...x, [campo]: Math.max(0, Math.min(max, v)) };
  });
  const colonna = (campo: 'g' | 'h' | 'm', nome: string, mostra: string) => (
    <div className="tempo-col">
      <button type="button" className="tempo-passo" aria-label={`${nome}: più`} onClick={() => passo(campo, 1)}>＋</button>
      <div className="tempo-val" aria-live="polite">{mostra}<small>{nome}</small></div>
      <button type="button" className="tempo-passo" aria-label={`${nome}: meno`} onClick={() => passo(campo, -1)}>－</button>
    </div>
  );
  return (
    <>
      <div className="dim" onClick={onChiudi} />
      <div className="sheet" role="dialog" aria-label={label}>
        <div className="grip" />
        <div className="t1" style={{ fontSize: 18 }}>{label}</div>
        <div className="t2">Giorni, ore e minuti (a passi di 15).</div>
        <div className="tempo-cols">
          {colonna('g', 'giorni', String(t.g))}
          {colonna('h', 'ore', String(t.h))}
          {colonna('m', 'minuti', String(t.m).padStart(2, '0'))}
        </div>
        <div className={clsx('t2', 'tempo-totale')}>{totale ? `Totale: ${scriviDurata(totale)}` : 'Nessuna stima'}</div>
        <div className="btns">
          <button className="btn" onClick={() => onFatto(undefined)}>Togli la stima</button>
          <button className="btn solid" onClick={() => onFatto(totale || undefined)}>Fatto</button>
        </div>
      </div>
    </>
  );
}
