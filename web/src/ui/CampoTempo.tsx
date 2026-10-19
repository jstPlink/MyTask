import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { leggiDurata, scomponi, scriviDurata } from '../../../shared/tempo.ts';
import { intervallo, percentuale } from '../../../shared/stima.ts';
import { clsx, nomeTempo } from '../lib/util.ts';
import { useLayer } from './nav.tsx';

/** Oltre questo tempo (un giorno) un task è troppo grande: compare l'avviso che consiglia di dividerlo. */
const MINUTI_GIORNO = 1440;
/** I minuti delle rotelle avanzano a passi di 5. */
const PASSO_MINUTI = 5;
/** Altezza di una riga delle rotelle (px): deve coincidere con `.rot-riga` nel CSS. */
const RIGA = 40;

/**
 * Tempo stimato: si scrive a mano ("45m", "6h", "4g", "5g 6h", "1h30") oppure si sceglie con tre rotelle (giorni, ore, minuti).
 * Con `margine` il foglio mostra anche il margine d'errore e l'intervallo che ne deriva. Oltre un giorno compare un avviso
 * che consiglia di dividere il lavoro in task più piccoli (con un esempio); `onProgetto` aggiunge il collegamento per passare a progetto.
 */
export function CampoTempo({ label, valore, onChange, margine, onProgetto }: { label: string; valore: number | undefined; onChange: (min: number | undefined) => void; margine?: number; onProgetto?: () => void }) {
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
        <button type="button" className="chip" aria-label={`${label}: scegli con le rotelle`} onClick={() => setAperto(true)}>Scegli</button>
      </div>
      {!esito.ok && <div className="t2 warn" style={{ padding: '2px 0 8px' }}>Non capisco: scrivi per esempio 45m, 6h, 4g oppure 5g 6h.</div>}
      {esito.ok && (valore ?? 0) >= MINUTI_GIORNO && (
        <div className="tempo-promemoria">
          ⚠ Più di un giorno: meglio dividerlo in task più piccoli
          {onProgetto && <button type="button" onClick={onProgetto}>Passa a progetto</button>}
        </div>
      )}
      {aperto && <SelettoreTempo label={label} iniziale={valore} margine={margine} onProgetto={onProgetto} onFatto={(m) => { onChange(m); setAperto(false); }} onChiudi={() => setAperto(false)} />}
    </>
  );
}

/** Una rotella: scorre e si ferma sulla riga al centro; un tocco su una riga la porta al centro; frecce su/giù da tastiera. */
function Rotella({ valori, valore, onChange, nome, formato }: { valori: number[]; valore: number; onChange: (v: number) => void; nome: string; formato: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const corrente = useRef(valore);
  const vai = (i: number, liscio = true) => ref.current?.scrollTo({ top: i * RIGA, behavior: liscio ? 'smooth' : 'auto' });
  useLayoutEffect(() => { vai(Math.max(0, valori.indexOf(valore)), false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const alScorrere = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(valori.length - 1, Math.round(el.scrollTop / RIGA)));
    if (valori[i] !== corrente.current) { corrente.current = valori[i]; onChange(valori[i]); }
  };
  const indice = Math.max(0, valori.indexOf(valore));
  return (
    <div className="rot-col">
      <div className="rot-nome">{nome}</div>
      <div ref={ref} className="rot" role="spinbutton" tabIndex={0} aria-label={nome} aria-valuenow={valore} aria-valuemin={valori[0]} aria-valuemax={valori[valori.length - 1]} aria-valuetext={formato(valore)}
        onScroll={alScorrere}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && indice < valori.length - 1) { e.preventDefault(); vai(indice + 1); }
          if (e.key === 'ArrowUp' && indice > 0) { e.preventDefault(); vai(indice - 1); }
        }}>
        <div className="rot-sp" />
        {valori.map((v, i) => <div key={v} className={clsx('rot-riga', v === valore && 'sel')} onClick={() => vai(i)}>{formato(v)}</div>)}
        <div className="rot-sp" />
      </div>
    </div>
  );
}

const ESEMPIO: [string, string][] = [['Prenotare il furgone', '15 min'], ['Scatolonare la cucina', '2 h'], ['Scatolonare il resto della casa', '3 h'], ['Disdire luce e internet', '30 min']];

/** Foglio dal basso con le tre rotelle (giorni, ore, minuti), il margine d'errore e, oltre un giorno, l'avviso con l'esempio. */
function SelettoreTempo({ label, iniziale, margine, onProgetto, onFatto, onChiudi }: { label: string; iniziale: number | undefined; margine?: number; onProgetto?: () => void; onFatto: (min: number | undefined) => void; onChiudi: () => void }) {
  const [t, setT] = useState(() => scomponi(iniziale));
  const [esempio, setEsempio] = useState(false);
  const totale = t.g * 1440 + t.h * 60 + t.m;
  const giorni = useMemo(() => Array.from({ length: Math.max(31, scomponi(iniziale).g + 1) }, (_, i) => i), [iniziale]);
  const ore = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minuti = useMemo(() => {
    const base = Array.from({ length: 60 / PASSO_MINUTI }, (_, i) => i * PASSO_MINUTI);
    const m = scomponi(iniziale).m;
    return base.includes(m) ? base : [...base, m].sort((a, b) => a - b); // un tempo già scritto a mano (es. 7 min) resta scegliibile
  }, [iniziale]);
  const grande = totale >= MINUTI_GIORNO;
  const [da, a] = margine !== undefined && totale ? intervallo(totale, margine) : [0, 0];

  return (
    <>
      <div className="dim" onClick={onChiudi} />
      <div className="sheet rot-sheet" role="dialog" aria-label={label}>
        <div className="grip" />
        <div className="t1" style={{ fontSize: 18 }}>{label}</div>
        <div className={clsx('rot-totale', grande && 'grande')} aria-live="polite">{totale ? nomeTempo(totale) : 'Nessuna stima'}</div>
        {margine !== undefined && totale > 0 && (
          <div className="rot-margine"><span className="rot-pc">{percentuale(margine)}</span><span>tra {nomeTempo(da)} e {nomeTempo(a)}</span></div>
        )}
        {grande && (
          <div className="rot-avviso" role="note">
            <i aria-hidden="true">!</i>
            <div>
              <b>Più di un giorno di lavoro</b>
              <span>Un task così grande è difficile da pianificare e da finire. Meglio dividerlo in task più piccoli.</span>
              <button type="button" className="rot-mostra" aria-expanded={esempio} onClick={() => setEsempio(!esempio)}>{esempio ? 'Nascondi esempio' : 'Mostra esempio'} <em aria-hidden="true">{esempio ? '⌃' : '›'}</em></button>
              {esempio && (
                <div className="rot-esempio">
                  <div className="rot-es-t">Esempio: lo stesso lavoro diviso in task piccoli</div>
                  <div className="rot-es-g">Organizzare il trasloco</div>
                  {ESEMPIO.map(([n, d]) => <div key={n} className="rot-es-p"><b>{n}</b><span>{d}</span></div>)}
                  {onProgetto && <button type="button" className="rot-mostra" onClick={() => { onFatto(totale || undefined); onProgetto(); }}>Passa a progetto <em aria-hidden="true">›</em></button>}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="rot-gruppo">
          <div className="rot-banda" aria-hidden="true" />
          <Rotella nome="Giorni" valori={giorni} valore={t.g} onChange={(g) => setT((x) => ({ ...x, g }))} formato={(v) => String(v).padStart(2, '0')} />
          <Rotella nome="Ore" valori={ore} valore={t.h} onChange={(h) => setT((x) => ({ ...x, h }))} formato={(v) => String(v).padStart(2, '0')} />
          <Rotella nome="Minuti" valori={minuti} valore={t.m} onChange={(m) => setT((x) => ({ ...x, m }))} formato={(v) => String(v).padStart(2, '0')} />
        </div>
        <div className="btns">
          <button className="btn" onClick={() => (iniziale ? onFatto(undefined) : onChiudi())}>{iniziale ? 'Togli la stima' : 'Annulla'}</button>
          <button className="btn solid" onClick={() => onFatto(totale || undefined)}>Imposta</button>
        </div>
      </div>
    </>
  );
}
