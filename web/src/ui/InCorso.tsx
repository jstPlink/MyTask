import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { NOMI_TIPO } from '../../../shared/types.ts';
import { formatShortYear } from '../../../shared/dates.ts';
import { dueDate, daysOverdue } from '../../../shared/priority.ts';
import { formatoCronometro, notaInCorso } from '../../../shared/sessione.ts';
import { useAdesso, useItems, useOggi, useSessione } from '../lib/hooks.ts';
import { cambiaStato, completaVoce } from '../lib/actions.ts';
import { getVerde, impostaVerde, subscribeFocus } from '../lib/focus.ts';
import { iniziaLavoro, riprendi, tempoDi } from '../lib/sessione.ts';
import { schermoAcceso } from '../lib/schermo.ts';
import { tocco } from '../lib/haptic.ts';
import { clsx, durataLavoro } from '../lib/util.ts';
import { GlifoTipo } from './Icone.tsx';

/** Dopo quanto tempo senza toccare lo schermo il nome della nota sparisce. */
const NASCONDI_NOME_MS = 5000;
/** Quanto resta lo schermo verde di «Fatta!» prima di tornare all'elenco (e di mostrare il margine di stima). */
const DURATA_VERDE_MS = 1500;
/** Durata dell'animazione con cui la schermata scende via quando si mette «in pausa». */
const DURATA_USCITA_MS = 450;

/**
 * Nota «in corso» a tutto schermo: appena una nota (attività o curiosità) passa «in corso» questa schermata riempie lo schermo e
 * ci si concentra solo su quella nota (stile C dei mockup `docs/mockup-focus-*.html`): stato, titolo, tipo, progetto e scadenza,
 * timer grande e barra del tempo previsto, Pausa e Fatta della stessa dimensione. Lo schermo resta sempre acceso e si torna alla
 * schermata normale solo con «Pausa» (la nota passa «in pausa») o «Fatta» (schermo verde, poi il foglio con il margine di stima).
 * Dopo 5 secondi restano solo il timer (ingrandito e al centro esatto dello schermo) e la barra del tempo sul totale, subito sotto:
 * tutto il resto sparisce e riappare toccando lo schermo (il tocco che lo fa riapparire non preme i pulsanti). «Pausa» chiude la
 * schermata con un'animazione.
 */
export function InCorso() {
  const items = useItems();
  const sessione = useSessione();
  const oggi = useOggi();
  const verde = useSyncExternalStore(subscribeFocus, getVerde);
  const nota = useMemo(() => notaInCorso(items), [items]);
  const lavoro = sessione.stato === 'lavoro';
  const adesso = useAdesso(lavoro);
  const [nascosto, setNascosto] = useState(false);
  const [tocchi, setTocchi] = useState(0);
  const [uscita, setUscita] = useState(false);
  const timerRef = useRef<HTMLDivElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const ignoraClick = useRef(false);
  const aperta = verde || !!nota;

  // schermo sempre acceso finché la schermata è aperta
  useEffect(() => {
    schermoAcceso(aperta);
    return () => schermoAcceso(false);
  }, [aperta]);

  // il cronometro parte con la nota «in corso» (anche se arriva da un altro dispositivo)
  useEffect(() => {
    if (nota && !verde && sessione.stato === 'ferma') iniziaLavoro(nota.id);
  }, [nota, verde, sessione.stato]);

  // il nome sparisce dopo 5 secondi senza tocchi; una nota nuova lo mostra di nuovo
  const id = nota?.id;
  useEffect(() => { setNascosto(false); setUscita(false); }, [id]);
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => setNascosto(true), NASCONDI_NOME_MS);
    return () => clearTimeout(t);
  }, [id, tocchi]);

  // timer e barra: da soli, il timer va al centro dello schermo (più grande) e la barra gli si mette sotto; al tocco tornano al loro posto
  const lungo = nota ? formatoCronometro(tempoDi(nota, adesso)).length : 0;
  useLayoutEffect(() => {
    const t = timerRef.current;
    const b = barraRef.current;
    if (!t) return;
    t.style.transition = 'none';
    if (b) b.style.transition = 'none';
    t.style.transform = '';
    if (b) b.style.transform = '';
    const r = t.getBoundingClientRect();
    const rb = b?.getBoundingClientRect();
    void t.offsetWidth;
    t.style.transition = '';
    if (b) b.style.transition = '';
    if (!nascosto) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scala = Math.min(2.2, (vw * 0.8) / Math.max(1, r.width));
    t.style.transform = `translate(${vw / 2 - (r.left + r.width / 2)}px, ${vh / 2 - (r.top + r.height / 2)}px) scale(${scala})`;
    if (b && rb) {
      const centro = vh / 2 + (r.height * scala) / 2 + 22 + rb.height / 2;
      b.style.transform = `translateY(${centro - (rb.top + rb.height / 2)}px)`;
    }
  }, [nascosto, lungo, id]);

  if (verde) {
    return (
      <div className="incorso incorso-verde" role="status">
        <div className="iv-segno" aria-hidden="true">✓</div>
        <div className="iv-testo">Fatta!</div>
      </div>
    );
  }
  if (!nota) return null;

  const progetto = nota.padreId ? items.find((i) => i.id === nota.padreId) : undefined;
  const ms = tempoDi(nota, adesso);
  const stimaMs = nota.sforzoMin ? nota.sforzoMin * 60_000 : 0;
  const quota = stimaMs ? Math.min(1, ms / stimaMs) : 0;
  const oltre = stimaMs > 0 && ms > stimaMs;
  const d = dueDate(nota);
  const ritardo = daysOverdue(nota, oggi);
  const data = d && d !== oggi ? (ritardo > 0 ? (ritardo === 1 ? 'ieri' : `${ritardo} gg fa`) : formatShortYear(d, oggi)) : d === oggi ? 'oggi' : '';

  const fatta = () => {
    if (verde) return;
    tocco('medio');
    const ora = Date.now();
    impostaVerde(true);
    setTimeout(() => { completaVoce(nota, ora, { sempreFoglio: true }); impostaVerde(false); }, DURATA_VERDE_MS);
  };
  const pausa = () => {
    tocco();
    if (sessione.stato === 'pausa') { riprendi(); return; }
    if (uscita) return;
    // la schermata scende via con un'animazione, poi la nota passa «in pausa» (e con lei sparisce la schermata)
    setUscita(true);
    setTimeout(() => cambiaStato(nota, 'in_pausa'), DURATA_USCITA_MS);
  };

  return (
    <div className={clsx('incorso', uscita && 'esce', nascosto && 'solo')} onClickCapture={(e) => { if (ignoraClick.current) { e.stopPropagation(); e.preventDefault(); } }}
      onPointerDown={() => {
        if (nascosto) { ignoraClick.current = true; setTimeout(() => { ignoraClick.current = false; }, 450); }
        setNascosto(false); setTocchi((n) => n + 1);
      }}>
      <div className="ic-col">
        <div className="ic-alto"><span className="ic-stato"><span className="cb viva" aria-hidden="true" /><span>In corso</span></span></div>
        <div className="ic-centro">
          <div className={clsx('ic-nome', nascosto && 'nascosto')}><h1 className="ic-titolo">{nota.titolo}</h1></div>
          <div className={clsx('ic-info', 'ic-vela', nascosto && 'nascosto')}>
            <span className="ic-tipo" aria-hidden="true"><GlifoTipo tipo={nota.tipo} size={18} /></span>
            <b>{NOMI_TIPO[nota.tipo]}</b>
            {progetto && <span>· {progetto.titolo}</span>}
            {data && <span className={clsx('ic-data', ritardo > 0 && 'hard')}>{data}</span>}
          </div>
          <div ref={timerRef} className={clsx('ic-timer', sessione.stato === 'pausa' && 'fermo')} aria-live="off">{formatoCronometro(ms)}</div>
          {stimaMs > 0 ? (
            <>
              <div ref={barraRef} className={clsx('ic-barra', oltre && 'oltre')}><i style={{ width: `${quota * 100}%` }} /></div>
              <div className={clsx('ic-prev', 'ic-vela', nascosto && 'nascosto')}><span className={clsx(oltre && 'oltre')}>{oltre ? 'Oltre il previsto' : 'lavorato'}</span><span>previsto {durataLavoro(stimaMs)}</span></div>
            </>
          ) : <div className={clsx('ic-prev', 'ic-vela', nascosto && 'nascosto')}><span>Nessun tempo previsto</span></div>}
        </div>
        <div className="ic-az">
          <button className="ic-btn ic-sec" onClick={pausa} disabled={uscita}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
              {sessione.stato === 'pausa' ? <path d="M8 5l11 7-11 7z" /> : <path d="M7 4.5h3.6v15H7zM13.4 4.5H17v15h-3.4z" />}
            </svg>
            {sessione.stato === 'pausa' ? 'Riprendi' : 'Pausa'}
          </button>
          <button className="ic-btn ic-pri" onClick={fatta} disabled={uscita}><span className="cb done" aria-hidden="true" />Fatta</button>
        </div>
      </div>
    </div>
  );
}
