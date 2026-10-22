import { useEffect, useSyncExternalStore } from 'react';
import { chiudiCompletamento, DURATA_COMPLETAMENTO_MS, getCompletamento, subscribeCompletamento } from '../lib/completamento.ts';
import { clsx, durataLavoro, nomeTempo } from '../lib/util.ts';
import { useLayer } from './nav.tsx';

/**
 * Dopo il segno di fatto su una nota con tempo misurato: si apre un foglio con le barre di stimato e reale e, alla fine,
 * il margine d'errore delle stime che passa al nuovo valore. Resta aperto 2 secondi dopo l'ultimo cambiamento e poi si chiude.
 */
export function CompletamentoSheet() {
  const c = useSyncExternalStore(subscribeCompletamento, getCompletamento);
  useLayer('completamento', !!c, chiudiCompletamento);

  useEffect(() => {
    if (!c) return;
    const t = setTimeout(chiudiCompletamento, DURATA_COMPLETAMENTO_MS);
    return () => clearTimeout(t);
  }, [c]);

  if (!c) return null;
  const massimo = Math.max(c.stimaMin, c.realeMin, 1);
  const diff = Math.round((1 - c.realeMin / c.stimaMin) * 100);
  const verdetto = diff > 0 ? `Hai finito il ${diff}% prima del previsto` : diff < 0 ? `Ci hai messo il ${-diff}% in più del previsto` : 'Esattamente nei tempi previsti';
  const cambia = c.margineA !== c.margineDa;
  const punti = c.margineA - c.margineDa;
  const col = (p: number) => (p > 0 ? 'su' : p < 0 ? 'giu' : '');
  const pc = (p: number) => (p > 0 ? `+${p}%` : p < 0 ? `−${-p}%` : '0%');
  // salire = stime troppo corte (rosso), scendere = stime abbondanti (verde)
  const frase = c.margineA > 0 ? 'Conviene aggiungere tempo alle tue stime' : c.margineA < 0 ? 'Stai stimando più del necessario' : 'Le tue stime sono centrate';

  // barra del tempo: la pista vale 1,6 volte la stima; con margine ≥ 0 la coda è il tempo da aggiungere, sotto zero la stima si accorcia e la coda è il tempo risparmiato
  const barra = (m: number) => {
    const base = m >= 0 ? 1 : 1 + m / 100;
    return { base: (base / 1.6) * 100, extra: (Math.abs(m) / 100 / 1.6) * 100 };
  };
  const limite = (1 / 1.6) * 100;
  const extraMin = Math.round(c.stimaMin * (c.margineA / 100));
  // linea delle settimane: i margini passati, quello prima di questa nota e, in fondo, quello nuovo
  const punteggio = [...c.storico, c.margineDa];
  const nPunti = punteggio.length + 1;
  const px = (i: number) => 10 + (i / (nPunti - 1)) * 280;
  const py = (v: number) => 50 - Math.max(-60, Math.min(60, v)) * 0.75;
  const punti2 = punteggio.map((v, i) => [px(i), py(v)] as const);
  const linea = punti2.map((q) => q.join(',')).join(' ');
  const ultimo = punti2[punti2.length - 1];
  const fine = [px(nPunti - 1), py(c.margineA)] as const;
  const coloreFine = c.margineA > 0 ? 'var(--warn)' : c.margineA < 0 ? 'var(--c1)' : 'var(--ink)';

  return (
    <>
      <div className="dim cmp-dim" onClick={chiudiCompletamento} />
      <div className="sheet cmp-sheet" role="dialog" aria-label="Tempo impiegato">
        <div className="grip" />
        <div className="cmp-fatto">
          <span className="cmp-ok" aria-hidden="true">✓</span>
          <div style={{ minWidth: 0 }}>
            <b>Fatto in {nomeTempo(c.realeMin)}</b>
            <div className="t2">{c.titolo} · stimate {nomeTempo(c.stimaMin)}</div>
          </div>
        </div>
        <div className="cmp-conf">
          <div>
            <div className="cmp-lbl"><span>Stimato</span><b>{nomeTempo(c.stimaMin)}</b></div>
            <div className="cmp-bar s"><i style={{ ['--w' as string]: `${(c.stimaMin / massimo) * 100}%` }} /></div>
          </div>
          <div>
            <div className="cmp-lbl"><span>Reale</span><b>{nomeTempo(c.realeMin)}</b></div>
            <div className="cmp-bar r"><i style={{ ['--w' as string]: `${(c.realeMin / massimo) * 100}%` }} /></div>
          </div>
          <div className={clsx('cmp-verdetto', diff < 0 && 'oltre')}>{verdetto}</div>
        </div>
        <div className="cmp-stima">
          <div className="cmp-su">Margine delle tue stime</div>
          <div className="cmp-nuova">
            {cambia && <span className={clsx('cmp-vecchio', col(c.margineDa))}>{pc(c.margineDa)}</span>}
            <div className={clsx('cmp-agg', !cambia && 'fermo')}>
              {cambia && <span className={clsx('a1', col(c.margineDa))}>{pc(c.margineDa)}</span>}
              <span className={clsx('a2', col(c.margineA))}>{pc(c.margineA)}</span>
            </div>
            {cambia && <span className={clsx('cmp-delta', col(punti))}>{punti > 0 ? '+' : '−'}{Math.abs(punti)} {Math.abs(punti) === 1 ? 'punto' : 'punti'}</span>}
          </div>
          <div className="cmp-tempo" style={{ ['--b0' as string]: `${barra(c.margineDa).base}%`, ['--b1' as string]: `${barra(c.margineA).base}%`, ['--e0' as string]: `${barra(c.margineDa).extra}%`, ['--e1' as string]: `${barra(c.margineA).extra}%` }}>
            <div className="cmp-pista">
              <div className="cmp-base"><span>Stima {nomeTempo(c.stimaMin)}</span></div>
              <div className={clsx('cmp-extra', c.margineA < 0 && 'risp')}>{extraMin !== 0 && <b>{extraMin > 0 ? '+' : '−'}{Math.abs(extraMin)} min</b>}</div>
              <div className="cmp-lim" style={{ left: `${limite}%` }} />
            </div>
            <div className="cmp-conto">Per una stima di {nomeTempo(c.stimaMin)} metti in conto <b>{durataLavoro(Math.max(1, Math.round(c.stimaMin * (1 + c.margineA / 100))) * 60_000)}</b></div>
          </div>
          {punteggio.length > 1 && (
            <div className="cmp-sett">
              <div className="cmp-su">Le ultime settimane</div>
              <svg viewBox="0 0 300 100" aria-hidden="true">
                <rect x="0" y="50" width="300" height="50" fill="var(--c1s)" opacity=".6" />
                <rect x="0" y="0" width="300" height="50" fill="var(--warn-soft)" opacity=".6" />
                <line x1="0" y1="50" x2="300" y2="50" stroke="var(--soft)" strokeDasharray="3 4" />
                <polyline className="cmp-linea" pathLength={1} points={linea} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                <line className="cmp-seg" x1={ultimo[0]} y1={ultimo[1]} x2={fine[0]} y2={fine[1]} stroke={coloreFine} strokeWidth="3" strokeLinecap="round" />
                <circle className="cmp-alone" cx={fine[0]} cy={fine[1]} r="6" fill="none" stroke={coloreFine} strokeWidth="2" />
                <circle className="cmp-punto" cx={fine[0]} cy={fine[1]} r="6" fill={coloreFine} />
              </svg>
              <div className="cmp-assi"><span>{punteggio.length - 1} sett. fa</span><span>oggi</span></div>
            </div>
          )}
          <div className={clsx('cmp-frase', col(c.margineA))}>{frase}</div>
        </div>
      </div>
    </>
  );
}
