import { useEffect, useSyncExternalStore } from 'react';
import { livelloMargine } from '../../../shared/stima.ts';
import { chiudiCompletamento, DURATA_COMPLETAMENTO_MS, getCompletamento, subscribeCompletamento } from '../lib/completamento.ts';
import { clsx, durataLavoro, nomeTempo } from '../lib/util.ts';
import { useLayer } from './nav.tsx';

/**
 * Dopo «Fatta» su un'attività (da «in corso» a tutto schermo compare sempre): scheda al centro dello schermo (non in basso, così la
 * barra «Annulla» non copre i dati) con il margine di stima che passa al nuovo valore, la barra del tempo (la stima con accanto la
 * coda del tempo da aggiungere o risparmiato) e le barre delle ultime note (scostamento di ognuna, l'ultima è questa nota).
 * Resta aperta circa 8 secondi, poi si chiude da sola (o toccando fuori).
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
  const { stimaMin, realeMin } = c;
  const cambia = c.margineA !== c.margineDa;
  const punti = c.margineA - c.margineDa;
  // il colore dice quanto è giusta la stima (vicino a zero è bene), non la direzione: buono fino a ±15%, medio fino a ±30%, sbagliato oltre
  const col = (p: number) => `mg-${livelloMargine(p / 100)}`;
  const migliora = Math.abs(c.margineA) < Math.abs(c.margineDa);
  const pc = (p: number) => (p > 0 ? `+${p}%` : p < 0 ? `−${-p}%` : '0%');
  // salire = stime troppo corte (rosso), scendere = stime abbondanti (verde)
  const frase = c.margineA > 0 ? 'Conviene aggiungere tempo alle tue stime' : c.margineA < 0 ? 'Stai stimando più del necessario' : 'Le tue stime sono centrate';

  // barra del tempo: la pista vale 1,6 volte la stima; con margine ≥ 0 la coda è il tempo da aggiungere, sotto zero la stima si accorcia e la coda è il tempo risparmiato
  const barra = (m: number) => {
    const base = m >= 0 ? 1 : 1 + m / 100;
    return { base: (base / 1.6) * 100, extra: (Math.abs(m) / 100 / 1.6) * 100 };
  };
  const limite = (1 / 1.6) * 100;
  const extraMin = Math.round((stimaMin ?? 0) * (c.margineA / 100));
  // la stima è scritta sempre a sinistra, nella parte grigia (accorciata se la barra è stretta); l'etichetta dei minuti sta nella coda o, se è troppo stretta, subito dopo
  const baseFinale = barra(c.margineA).base;
  const etichettaStima = stimaMin ? (baseFinale >= 38 ? `Stima ${nomeTempo(stimaMin)}` : baseFinale >= 22 ? nomeTempo(stimaMin) : '') : '';
  const codaLarga = barra(c.margineA).extra >= 11;
  const motivo = !stimaMin ? 'Questa nota non aveva un tempo stimato: il margine non cambia.' : !realeMin ? 'Tempo lavorato troppo breve per essere misurato: il margine non cambia.' : '';

  // barre delle ultime note: ognuna è lo scostamento di una nota (verso l'alto rosso = più del previsto, verso il basso verde); l'ultima è questa nota
  const barre = [...c.note, ...(c.oggi !== undefined ? [c.oggi] : [])];
  const n = barre.length;
  const larghezza = Math.min(26, (260 / n) * 0.62);
  const bx = (i: number) => 20 + (i / (n - 1)) * 260;
  const by = (v: number) => 50 - Math.max(-50, Math.min(50, v)) * 0.9;
  const ultimaOggi = c.oggi !== undefined;
  const minTesto = (m: number) => `${m > 0 ? '+' : m < 0 ? '\u2212' : ''}${Math.abs(m)} min`;

  return (
    <>
      <div className="dim cmp-dim" onClick={chiudiCompletamento} />
      <div className="sheet cmp-sheet cmp-corto" role="dialog" aria-label="Margine di stima">
        <div className="cmp-fatto">
          <span className="cmp-ok" aria-hidden="true">✓</span>
          <div style={{ minWidth: 0 }}>
            <b>{realeMin ? `Fatto in ${nomeTempo(realeMin)}` : 'Fatto'}</b>
            <div className="t2">{c.titolo}{stimaMin ? ` · stimate ${nomeTempo(stimaMin)}` : ''}</div>
          </div>
        </div>
        <div className="cmp-stima">
          <div className="cmp-su">Margine delle tue stime</div>
          <div className="cmp-nuova">
            {cambia && <span className={clsx('cmp-vecchio', col(c.margineDa))}>{pc(c.margineDa)}</span>}
            <div className={clsx('cmp-agg', !cambia && 'fermo')}>
              {cambia && <span className={clsx('a1', col(c.margineDa))}>{pc(c.margineDa)}</span>}
              <span className={clsx('a2', col(c.margineA))}>{pc(c.margineA)}</span>
            </div>
            {cambia && <span className={clsx('cmp-delta', migliora ? 'mg-buono' : 'mg-sbagliato')}>{punti > 0 ? '+' : '−'}{Math.abs(punti)} {Math.abs(punti) === 1 ? 'punto' : 'punti'}</span>}
          </div>
          {stimaMin ? (
            <div className="cmp-tempo" style={{ ['--b0' as string]: `${barra(c.margineDa).base}%`, ['--b1' as string]: `${barra(c.margineA).base}%`, ['--e0' as string]: `${barra(c.margineDa).extra}%`, ['--e1' as string]: `${barra(c.margineA).extra}%` }}>
              <div className="cmp-pista">
                <div className="cmp-base"><span>{etichettaStima}</span></div>
                <div className={clsx('cmp-extra', col(c.margineA))}>{extraMin !== 0 && codaLarga && <b>{extraMin > 0 ? '+' : '−'}{Math.abs(extraMin)} min</b>}</div>
                {extraMin !== 0 && !codaLarga && <span className="cmp-etic" style={{ left: `${barra(c.margineA).base + barra(c.margineA).extra}%` }}>{extraMin > 0 ? '+' : '−'}{Math.abs(extraMin)} min</span>}
                <div className="cmp-lim" style={{ left: `${limite}%` }} />
              </div>
              <div className="cmp-conto">Per una stima di {nomeTempo(stimaMin)} metti in conto <b>{durataLavoro(Math.max(1, Math.round(stimaMin * (1 + c.margineA / 100))) * 60_000)}</b></div>
            </div>
          ) : null}
          {n > 1 && (
            <div className="cmp-sett">
              <div className="cmp-su">Le ultime note · scostamento di ognuna</div>
              <svg viewBox="0 0 300 100" aria-hidden="true">
                <rect x="0" y="50" width="300" height="50" fill="var(--c1s)" opacity=".6" />
                <rect x="0" y="0" width="300" height="50" fill="var(--warn-soft)" opacity=".6" />
                <line x1="0" y1="50" x2="300" y2="50" stroke="var(--soft)" strokeDasharray="3 4" />
                {barre.map((b, i) => {
                  const v = b.p;
                  const su = v >= 0;
                  const alt = Math.max(1.5, Math.abs(by(v) - 50));
                  const ultima = ultimaOggi && i === n - 1;
                  return (
                    <rect key={i} className={clsx('cmp-nb', su ? 'su' : 'giu')} x={bx(i) - larghezza / 2} y={su ? 50 - alt : 50} width={larghezza} height={alt} rx="4"
                      fill={{ buono: 'var(--c1)', medio: 'var(--amber)', sbagliato: 'var(--warn)' }[b.livello]} opacity={ultima ? 1 : 0.8} stroke={ultima ? 'var(--ink)' : undefined} strokeWidth={ultima ? 2 : undefined}
                      style={{ ['--d' as string]: `${1.1 + i * 0.12}s` }} />
                  );
                })}
                {ultimaOggi && <text className="cmp-nbt" x={296} y={c.oggi!.p >= 0 ? Math.max(10, by(c.oggi!.p) - 5) : 44} textAnchor="end" fontSize="10" fontWeight="800" fill="var(--ink)">{pc(c.oggi!.p)} · {minTesto(c.oggi!.min)}</text>}
              </svg>
              <div className="cmp-assi"><span>{n - (ultimaOggi ? 1 : 0)} note fa</span><span>{ultimaOggi ? 'questa nota' : 'più recente'}</span></div>
            </div>
          )}
          {motivo && <div className="cmp-motivo">{motivo}</div>}
          <div className={clsx('cmp-frase', col(c.margineA))}>{frase}</div>
        </div>
      </div>
    </>
  );
}
