import { useEffect, useSyncExternalStore } from 'react';
import { STATI_NOTA, cambiaStato, statoVisto } from '../lib/actions.ts';
import { chiudiStatoMenu, getStatoMenu, subscribeStatoMenu } from '../lib/statoMenu.ts';
import { clsx } from '../lib/util.ts';
import { ClasseCasella } from './kit.tsx';
import { useLayer } from './nav.tsx';

/** Foglio con i quattro stati di una nota: da fare, in corso, fatta, archiviata. */
export function StatoMenu() {
  const item = useSyncExternalStore(subscribeStatoMenu, getStatoMenu);

  useEffect(() => {
    if (!item) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') chiudiStatoMenu(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [item]);

  useLayer('stato', !!item, chiudiStatoMenu);

  if (!item) return null;
  const attuale = statoVisto(item.stato);

  return (
    <>
      <div className="dim" onClick={chiudiStatoMenu} />
      <div className="sheet stato-menu" role="dialog" aria-label="Stato della nota">
        <div className="grip" />
        <div className="t1" style={{ fontSize: 17, marginBottom: 2 }}>{item.titolo}</div>
        <div className="t2" style={{ marginBottom: 8 }}>Scegli lo stato</div>
        {STATI_NOTA.map((s) => (
          <button key={s.id} className={clsx('stato-voce', attuale === s.id && 'on')} onClick={() => { chiudiStatoMenu(); cambiaStato(item, s.id); }}>
            <span className={clsx('cb', ClasseCasella(s.id))} aria-hidden="true" />
            <span><b>{s.nome}</b><small>{s.descr}</small></span>
          </button>
        ))}
      </div>
    </>
  );
}
