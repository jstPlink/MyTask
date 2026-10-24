/**
 * Storico del margine di stima (si apre toccando la targhetta «Correzione alle tue stime» in Priorità; mockup `docs/mockup-storico-margine.html`):
 * il margine attuale grande e colorato, come sono andate le note (giuste, medie, sbagliate), un intervallo (ultime 10, 30 o tutte),
 * il grafico a barre dello scostamento di ogni nota (più chiara = più vecchia, pesa meno) e l'elenco delle note con stimato → reale,
 * scostamento colorato (in percentuale e in minuti), quando è stata fatta e quanto pesa oggi nel margine (più è recente e lunga, più pesa). Toccando una nota si apre la sua scheda.
 */
import { useMemo, useState } from 'react';
import { livelloMargine, margineAtteso, percentuale, storicoNote, type LivelloMargine } from '../../../shared/stima.ts';
import { diffDays } from '../../../shared/dates.ts';
import { useItems, useOggi } from '../lib/hooks.ts';
import { clsx, nomeTempo } from '../lib/util.ts';
import { Back, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';

const CHIAVE = 'mytask.storico.quante';
const INTERVALLI: { n: number; nome: string }[] = [{ n: 10, nome: 'Ultime 10' }, { n: 30, nome: 'Ultime 30' }, { n: 0, nome: 'Tutte' }];
const COLORE: Record<LivelloMargine, string> = { buono: 'var(--c1)', medio: 'var(--amber)', sbagliato: 'var(--warn)' };
const FONDO: Record<LivelloMargine, string> = { buono: 'var(--c1s)', medio: 'var(--amber-soft)', sbagliato: 'var(--warn-soft)' };
const ETICHETTA: Record<LivelloMargine, string> = { buono: 'Stime giuste', medio: 'Un po’ fuori', sbagliato: 'Molto fuori' };

function leggiIntervallo(): number {
  try {
    const grezzo = localStorage.getItem(CHIAVE);
    const v = Number(grezzo);
    return grezzo !== null && INTERVALLI.some((x) => x.n === v) ? v : 10; // di base le ultime 10
  } catch { return 10; }
}

/** «oggi», «ieri», «3 giorni fa», «2 settimane fa», «3 mesi fa»: quando è stata completata una nota. */
function quando(ts: number, oggi: string): string {
  const d = new Date(ts);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const g = Math.max(0, diffDays(oggi, iso));
  return g === 0 ? 'oggi' : g === 1 ? 'ieri' : g < 7 ? `${g} giorni fa` : g < 14 ? 'una settimana fa' : g < 60 ? `${Math.round(g / 7)} settimane fa` : `${Math.round(g / 30)} mesi fa`;
}

const pc = (p: number) => (p > 0 ? `+${p}%` : p < 0 ? `−${-p}%` : '0%');

export function StoricoMargine() {
  const items = useItems();
  const oggi = useOggi();
  const nav = useNav();
  const [quante, setQuante] = useState(leggiIntervallo);
  const margine = useMemo(() => margineAtteso(items), [items]);
  const tutte = useMemo(() => storicoNote(items), [items]);
  const elenco = quante > 0 ? tutte.slice(0, quante) : tutte;
  const livello = livelloMargine(margine);
  const mp = Math.round(margine * 100);
  const scegli = (n: number) => { setQuante(n); try { localStorage.setItem(CHIAVE, String(n)); } catch { /* ignora */ } };

  const conta: Record<LivelloMargine, number> = { buono: 0, medio: 0, sbagliato: 0 };
  for (const n of elenco) conta[n.livello]++;

  // grafico: dalla più vecchia (a sinistra) alla più recente (a destra); l'altezza è lo scostamento, l'opacità il peso
  const ord = [...elenco].reverse();
  const nn = ord.length;
  const larghezza = Math.min(24, (280 / Math.max(1, nn)) * 0.62);
  const X = (i: number) => 10 + (i / Math.max(1, nn - 1)) * 280;
  const Y = (v: number) => 50 - Math.max(-60, Math.min(60, v)) * 0.75;

  const frase = tutte.length === 0
    ? 'Ancora nessuna nota con tempo misurato: il margine parte da 0%.'
    : `${mp > 0 ? `Stimi meno del necessario: in media ci metti il ${mp}% in più.` : mp < 0 ? 'Stimi più del necessario.' : 'Le tue stime sono centrate.'} Le note recenti contano di più.`;

  return (
    <>
      <Back label="Priorità" />
      <Top title="Storico del margine" sub="Le ultime note completate con stima e tempo reale" />
      <div className="scroll">
        <div className="sm-card">
          <div className="sm-su">Margine attuale</div>
          <div className="sm-grande"><span className="sm-n" style={{ color: COLORE[livello] }}>{percentuale(margine)}</span><span className="sm-e" style={{ color: COLORE[livello] }}>{ETICHETTA[livello]}</span></div>
          <div className="sm-fr">{frase}</div>
        </div>

        {tutte.length > 0 && (
          <>
            <div className="sm-card">
              <div className="sm-su">Come sono andate</div>
              <div className="sm-distr">{(['buono', 'medio', 'sbagliato'] as const).map((k) => conta[k] > 0 && <i key={k} style={{ width: `${(conta[k] / nn) * 100}%`, background: COLORE[k] }} />)}</div>
              <div className="sm-leg">
                <span style={{ ['--c' as string]: COLORE.buono }}><b>{conta.buono}</b> giuste (±15%)</span>
                <span style={{ ['--c' as string]: COLORE.medio }}><b>{conta.medio}</b> medie (±30%)</span>
                <span style={{ ['--c' as string]: COLORE.sbagliato }}><b>{conta.sbagliato}</b> sbagliate</span>
              </div>
            </div>

            <div className="sm-range" role="tablist" aria-label="Quante note">
              {INTERVALLI.map((x) => <button key={x.n} role="tab" aria-selected={quante === x.n} className={clsx(quante === x.n && 'on')} onClick={() => scegli(x.n)}>{x.nome}</button>)}
            </div>

            <div className="sm-card">
              <div className="sm-su">Scostamento di ogni nota</div>
              <svg viewBox="0 0 300 100" aria-hidden="true">
                <rect width="300" height="50" y="0" fill="var(--warn-soft)" opacity=".55" />
                <rect width="300" height="50" y="50" fill="var(--c1s)" opacity=".55" />
                <line x1="0" y1="50" x2="300" y2="50" stroke="var(--soft)" strokeDasharray="3 4" />
                <line x1="0" y1={Y(15)} x2="300" y2={Y(15)} stroke="var(--c1)" strokeDasharray="2 4" opacity=".5" />
                <line x1="0" y1={Y(-15)} x2="300" y2={Y(-15)} stroke="var(--c1)" strokeDasharray="2 4" opacity=".5" />
                {ord.map((n, i) => {
                  const p = Math.round(n.scostamento * 100);
                  const su = p >= 0;
                  return (
                    <rect key={n.item.id} x={X(i) - larghezza / 2} y={su ? Y(p) : 50} width={larghezza} height={Math.max(1.5, Math.abs(Y(p) - 50))} rx="3.5"
                      fill={COLORE[n.livello]} opacity={0.35 + 0.65 * n.peso} stroke={i === nn - 1 ? 'var(--ink)' : undefined} strokeWidth={i === nn - 1 ? 1.6 : undefined} />
                  );
                })}
              </svg>
              <div className="sm-assi"><span>più vecchia</span><span>più recente</span></div>
              <div className="sm-sp">Più chiara = nota che pesa meno (più vecchia o più breve). Le righe tratteggiate sono ±15%.</div>
            </div>

            <div className="sm-card">
              <div className="sm-su">Le note</div>
              {elenco.map((n) => {
                const p = Math.round(n.scostamento * 100);
                const l = n.livello;
                return (
                  <button key={n.item.id} className="sm-nr" onClick={() => nav.push({ k: 'item', id: n.item.id })}>
                    <span className="sm-tt"><span className="sm-t1">{n.item.titolo}</span><span className="sm-t2">{nomeTempo(n.stimaMin)} → {nomeTempo(n.realeMin)} ({n.differenzaMin > 0 ? '+' : n.differenzaMin < 0 ? '\u2212' : ''}{Math.abs(n.differenzaMin)} min) · {quando(n.completatoTs, oggi)}</span></span>
                    <span className="sm-dx"><span className="sm-chip" style={{ color: COLORE[l], background: FONDO[l] }}>{pc(p)}</span><span className="sm-peso" title="Peso della nota nel margine di oggi"><i style={{ width: `${n.peso * 100}%` }} /></span></span>
                  </button>
                );
              })}
              <div className="sm-sp">La barretta sotto la percentuale è il peso della nota nel margine oggi: più è recente (si dimezza ogni 21 giorni) e più è lunga, più pesa. Una nota con meno di 10 minuti di differenza non è mai «sbagliata».</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
