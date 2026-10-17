import { useEffect, useSyncExternalStore } from 'react';
import { chiudiAvanzamento, DURATA_ANIMAZIONE_MS, getAvanzamento, subscribeAvanzamento } from '../lib/avanzamento.ts';
import { useLayer, useNav } from './nav.tsx';

/**
 * Completando un passo di un progetto si apre il pannello del progetto (dal basso sul telefono, al centro sullo schermo largo),
 * il passo viene spuntato, la barra avanza e il pannello si richiude da solo.
 */
export function AvanzamentoProgetto() {
  const nav = useNav();
  const a = useSyncExternalStore(subscribeAvanzamento, getAvanzamento);
  useLayer('avanzamento', !!a, chiudiAvanzamento);

  useEffect(() => {
    if (!a) return;
    const t = setTimeout(chiudiAvanzamento, DURATA_ANIMAZIONE_MS);
    return () => clearTimeout(t);
  }, [a]);

  if (!a) return null;
  const pct = (n: { fatti: number; totale: number }) => (n.totale ? (n.fatti / n.totale) * 100 : 0);
  const testo = (n: { fatti: number; totale: number }) => `${n.fatti} su ${n.totale}`;

  return (
    <>
      <div className="avz-dim" onClick={chiudiAvanzamento} />
      <div className={nav.wide ? 'avz-pannello avz-modale' : 'avz-pannello avz-foglio'} role="dialog" aria-label={`Avanzamento di ${a.padre.titolo}`}
        style={{ ['--da' as string]: `${pct(a.prima)}%`, ['--a' as string]: `${pct(a.dopo)}%` }}>
        {!nav.wide && <div className="grip" />}
        <div className="t2">Progetto</div>
        <div className="t1" style={{ fontSize: 20 }}>{a.padre.titolo}</div>
        <div className="bar"><i className="avz-barra" /></div>
        <div className="t2" style={{ marginBottom: 8 }}>
          <span className="avz-num"><span className="avz-n1">{testo(a.prima)}</span><span className="avz-n2">{testo(a.dopo)}</span></span> passi completati
        </div>
        {a.passi.map((p) => (
          <div key={p.id} className={p.target ? 'avz-passo avz-target' : 'avz-passo'}>
            <span className={p.fatto ? 'cb done' : 'cb'} />
            <span className="avz-testo">{p.testo}</span>
          </div>
        ))}
      </div>
    </>
  );
}
