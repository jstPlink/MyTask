import { useEffect, useSyncExternalStore } from 'react';
import { chiudiCompletamento, DURATA_COMPLETAMENTO_MS, getCompletamento, subscribeCompletamento } from '../lib/completamento.ts';
import { clsx, nomeTempo } from '../lib/util.ts';
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
          <div className={clsx('cmp-frase', col(c.margineA))}>{frase}</div>
        </div>
      </div>
    </>
  );
}
