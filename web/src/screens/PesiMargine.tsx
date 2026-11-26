import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { CurvaModificabile } from '../ui/CurvaModificabile.tsx';
import { DISTANZA_PUNTI_MIN, fattoreLunghezza, LIMITI_MARGINE, livelloMargine, margineAtteso, MARGINE_PREDEFINITO, percentuale, quotaErrore, pesoEta, storicoNote, type ParametriMargine } from '../../../shared/stima.ts';
import { getMargineUtente, impostaMargineUtente, ripristinaMargine, sonoMargineDiBase, subscribeMargine } from '../lib/pesiMargine.ts';
import { useItems } from '../lib/hooks.ts';
import { clsx, nomeTempo } from '../lib/util.ts';
import { Back, Sec, Top } from '../ui/kit.tsx';
import { useNav } from '../ui/nav.tsx';

const virgola = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
/** Il peso di una nota in rapporto a quello di una nota media: «2,3×», «<0,1×». */
const rispettoAllaMedia = (v: number) => (v > 0 && v < 0.05 ? '<0,1×' : `${v.toFixed(1).replace('.', ',')}×`);
const pc = (v: number) => `${Math.round(v * 100)}%`;
const entro = (v: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, v));
const tondo = (v: number, passo: number) => Math.round(v / passo) * passo;
const D = MARGINE_PREDEFINITO;

interface PropFattore { p: ParametriMargine; cambia: (q: ParametriMargine) => void }

/** Età: due punti. In orizzontale dopo quanti giorni la curva è a metà strada, in verticale (a destra) quanto pesa una nota di 120 giorni. */
function CurvaEta({ p, cambia }: PropFattore) {
  const X = 120;
  const resto = 0.5 ** (X / p.eta.emivita); // quanto resterebbe a 120 giorni senza minimo
  const aMeta = pesoEta(p.eta.emivita, p);
  return (
    <>
      <CurvaModificabile
        nome="Curva dell'età" titoloY="quanto pesa la nota (100% = completata oggi)" titoloX="da quanti giorni è stata completata"
        xMax={X} yMax={1}
        tacchey={[{ v: 0, testo: '0%' }, { v: 0.5, testo: '50%' }, { v: 1, testo: '100%' }]}
        tacchex={[{ v: 0, testo: '0' }, { v: 30, testo: '30' }, { v: 60, testo: '60' }, { v: 90, testo: '90' }, { v: 120, testo: '120 giorni' }]}
        curva={(x) => pesoEta(x, p)} base={(x) => pesoEta(x, D)}
        maniglie={[
          { id: 'emivita', asse: 'x', x: p.eta.emivita, y: aMeta, passo: 1, nome: 'Dopo quanti giorni la curva è a metà strada', valore: `${Math.round(p.eta.emivita)} giorni`,
            muovi: (v) => cambia({ ...p, eta: { ...p.eta, emivita: Math.round(entro(v, LIMITI_MARGINE.emivita)) } }) },
          { id: 'minimo', asse: 'y', x: X, y: pesoEta(X, p), passo: 0.05, nome: 'Quanto pesa una nota di 120 giorni', valore: pc(pesoEta(X, p)),
            muovi: (v) => cambia({ ...p, eta: { ...p.eta, minimo: tondo(entro((v - resto) / (1 - resto), LIMITI_MARGINE.minimo), 0.01) } }) },
        ]}
      />
      <p className="cm-frase">Una nota completata oggi pesa <b>100%</b>, una di <b>{Math.round(p.eta.emivita)} giorni</b> fa pesa <b>{pc(aMeta)}</b> e una di 120 giorni fa <b>{pc(pesoEta(X, p))}</b>.</p>
    </>
  );
}

/** Lunghezza: due punti liberi (in orizzontale i minuti, in verticale il peso). Il grafico arriva a 2 ore: oltre, vale il peso del punto «lunghe». */
function CurvaLunghezza({ p, cambia }: PropFattore) {
  const X = 120;
  const l = p.lunghezza;
  const metti = (q: Partial<ParametriMargine['lunghezza']>) => cambia({ ...p, lunghezza: { ...l, ...q } });
  const min = (v: number) => `${Math.round(v)} min`;
  return (
    <>
      <CurvaModificabile
        nome="Curva della lunghezza" titoloY="quante volte conta la nota (1× = peso normale)" titoloX="tempo stimato della nota"
        xMax={X} yMax={2}
        tacchey={[{ v: 0, testo: '0×' }, { v: 0.5, testo: '0,5×' }, { v: 1, testo: '1×' }, { v: 1.5, testo: '1,5×' }, { v: 2, testo: '2×' }]}
        tacchex={[{ v: 0, testo: '0' }, { v: 30, testo: '30 min' }, { v: 60, testo: '1 ora' }, { v: 90, testo: '90 min' }, { v: 120, testo: '2 ore+' }]}
        curva={(x) => fattoreLunghezza(x, p)} base={(x) => fattoreLunghezza(x, D)}
        maniglie={[
          { id: 'breve', asse: 'xy', x: l.breveMin, y: l.breve, passo: 1, passoY: 0.05, nome: 'Note brevi: fino a quanti minuti e quanto contano', valore: `fino a ${min(l.breveMin)}: ${virgola(l.breve)}×`,
            muovi: (x, y) => metti({ breveMin: Math.round(entro(x, [LIMITI_MARGINE.breveMin[0], l.lungaMin - DISTANZA_PUNTI_MIN])), breve: tondo(entro(y, LIMITI_MARGINE.breve), 0.05) }) },
          { id: 'lunga', asse: 'xy', x: l.lungaMin, y: l.lunga, passo: 1, passoY: 0.05, nome: 'Note lunghe: da quanti minuti e quanto contano', valore: `da ${min(l.lungaMin)}: ${virgola(l.lunga)}×`,
            muovi: (x, y) => metti({ lungaMin: Math.round(entro(x, [l.breveMin + DISTANZA_PUNTI_MIN, LIMITI_MARGINE.lungaMin[1]])), lunga: tondo(entro(y, LIMITI_MARGINE.lunga), 0.05) }) },
        ]}
      />
      <p className="cm-frase">Fino a <b>{min(l.breveMin)}</b> una nota conta <b>{virgola(l.breve)}×</b>; da <b>{min(l.lungaMin)}</b> in su, anche oltre le 2 ore, conta <b>{virgola(l.lunga)}×</b>. In mezzo il peso sale gradualmente.</p>
    </>
  );
}

/** Errore: le note giuste (a sinistra) e quelle molto sbagliate (a destra) in verticale; il punto in mezzo, in orizzontale, dice quando si comincia a scendere. */
function CurvaErrore({ p, cambia }: PropFattore) {
  const metti = (chiave: keyof ParametriMargine['errore'], v: number) => cambia({ ...p, errore: { ...p.errore, [chiave]: v } });
  return (
    <>
      <CurvaModificabile
        nome="Curva dell'errore" titoloY="quanto pesa la nota" titoloX="errore rispetto al tempo previsto"
        xMax={1} yMax={1}
        tacchey={[{ v: 0, testo: '0%' }, { v: 0.5, testo: '50%' }, { v: 1, testo: '100%' }]}
        tacchex={[{ v: 0, testo: 'giusta' }, { v: 0.25, testo: '25%' }, { v: 0.5, testo: '50%' }, { v: 0.75, testo: '75%' }, { v: 1, testo: '100%' }]}
        curva={(x) => quotaErrore(x, p)} base={(x) => quotaErrore(x, D)}
        maniglie={[
          { id: 'giusta', asse: 'y', x: 0, y: p.errore.giusta, passo: 0.05, nome: 'Quanto pesa una nota giusta', valore: pc(p.errore.giusta),
            muovi: (v) => metti('giusta', tondo(entro(v, LIMITI_MARGINE.quota), 0.01)) },
          { id: 'scala', asse: 'x', x: p.errore.scala, y: quotaErrore(p.errore.scala, p), passo: 0.01, nome: 'Errore oltre il quale la nota conta molto meno', valore: `errore ${pc(p.errore.scala)}`,
            muovi: (v) => metti('scala', tondo(entro(v, LIMITI_MARGINE.scala), 0.01)) },
          { id: 'sbagliata', asse: 'y', x: 1, y: quotaErrore(1, p), passo: 0.05, nome: 'Quanto pesa una nota molto sbagliata', valore: pc(p.errore.sbagliata),
            muovi: (v) => metti('sbagliata', tondo(entro(v, LIMITI_MARGINE.quota), 0.01)) },
        ]}
      />
      <p className="cm-frase">Una nota con stima giusta pesa <b>{pc(p.errore.giusta)}</b>, una molto sbagliata <b>{pc(p.errore.sbagliata)}</b>: la giusta conta <b>{virgola(p.errore.giusta / p.errore.sbagliata)} volte</b> l’altra. La discesa avviene attorno a un errore del <b>{pc(p.errore.scala)}</b>.</p>
    </>
  );
}

const FATTORI: { id: keyof ParametriMargine; nome: string; domanda: string; Curva: (x: PropFattore) => ReactNode }[] = [
  { id: 'eta', nome: 'Età della nota', domanda: 'Quanto deve contare una nota completata tanto tempo fa?', Curva: CurvaEta },
  { id: 'lunghezza', nome: 'Lunghezza della nota', domanda: 'Una nota lunga deve contare più di una breve?', Curva: CurvaLunghezza },
  { id: 'errore', nome: 'Errore rispetto al previsto', domanda: 'Quanto deve pesare una nota a seconda di quanto hai sbagliato la stima?', Curva: CurvaErrore },
];

/**
 * Impostazioni › Bilanciatore del margine: per l’età, la lunghezza e l’errore rispetto al previsto un grafico con i punti da
 * trascinare (assi con nome e numeri, tratteggiata la curva di base) e una frase che dice cosa significa. Cambia subito il margine, si
 * sincronizza con gli altri dispositivi; sotto, il margine risultante e quanto pesa ognuna delle ultime note.
 */
export function PesiMargine() {
  const p = useSyncExternalStore(subscribeMargine, getMargineUtente);
  const items = useItems();
  const nav = useNav();
  const margine = useMemo(() => margineAtteso(items), [items, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const tutte = useMemo(() => storicoNote(items, Date.now()), [items, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const note = tutte.slice(0, 15);

  return (
    <>
      <Back label="Impostazioni" />
      <Top title="Bilanciatore del margine" sub="Opzione provvisoria" right={<span className="badge-sper">Sperimentale</span>} />
      <div className="scroll">
        <div className="sper-box">
          <b>Come si usa</b>
          <span>Il margine è il tempo da aggiungere (o togliere) alle tue stime: la media degli errori delle note completate, dove ogni nota ha un peso dato da età × lunghezza × errore. Ogni grafico regola una delle tre cose: <b>trascina i punti tondi</b> per cambiare la curva (la freccia nel punto dice dove si muove: ↕, ↔ oppure ✥ in tutte le direzioni). La linea tratteggiata è la curva di base. Le modifiche si sincronizzano con gli altri dispositivi.</span>
        </div>
        {FATTORI.map(({ id, nome, domanda, Curva }) => (
          <div key={id}>
            <Sec a={nome} />
            <div className="peso">
              <div className="cm-domanda">{domanda}</div>
              <Curva p={p} cambia={impostaMargineUtente} />
            </div>
          </div>
        ))}
        <div className="btns">
          <button className="btn" disabled={sonoMargineDiBase(p)} onClick={ripristinaMargine}>Ripristina le curve di base</button>
        </div>
        <Sec a="Anteprima" />
        <div className="field"><b style={{ fontWeight: 620 }}>Margine con queste curve</b><span className={clsx(`mg-${livelloMargine(margine)}`)}>{percentuale(margine)}</span></div>
        {tutte.length > 0 && <div className="t2" style={{ padding: '4px 0' }}>Calcolato su <b>{tutte.length} {tutte.length === 1 ? 'nota' : 'note'}</b>{tutte.length > note.length ? `, qui le ultime ${note.length}` : ''}. Per ognuna: quanto pesa rispetto a una nota media (1× = come la media) e, sotto, la sua parte del margine.</div>}
        {note.length === 0 && <div className="t2" style={{ padding: '8px 0' }}>Ancora nessuna nota completata con stima e tempo reale.</div>}
        {note.map((n) => (
          <button key={n.item.id} className="field link" onClick={() => nav.push({ k: 'item', id: n.item.id })}>
            <span><b style={{ fontWeight: 620 }}>{n.item.titolo}</b><span className="t2" style={{ display: 'block' }}>{nomeTempo(n.stimaMin)} → {nomeTempo(n.realeMin)} · {percentuale(n.scostamento)}</span></span>
            <span className="pm-peso"><b>{rispettoAllaMedia(n.quota * tutte.length)} la media</b><span className="t2">{n.quota > 0 && n.quota < 0.01 ? '<1' : Math.round(n.quota * 100)}% del margine</span></span>
          </button>
        ))}
        <button className="field link" onClick={() => nav.push({ k: 'storicomargine' })}><b style={{ fontWeight: 620 }}>Storico del margine</b><span className="muted">›</span></button>
      </div>
    </>
  );
}
