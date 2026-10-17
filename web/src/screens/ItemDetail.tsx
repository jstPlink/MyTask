import { useEffect, useMemo, useRef, useState } from 'react';
import { NOMI_FASCIA, NOMI_TIPO, TIPI_INTRATTENIMENTO, type Fascia, type Item, type Promemoria, type Tipo, type VoceChecklist } from '../../../shared/types.ts';
import { formatShortYear, relativeDays, today } from '../../../shared/dates.ts';
import { barLevel, componentiPunteggio, dueDate, score } from '../../../shared/priority.ts';
import { avanzamento, figli, listaAzioni, nomiUsati } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { completaVoce, nuovaVoce, ordinaPassi, riapriVoce } from '../lib/actions.ts';
import { getItem, removeItem, saveItem } from '../lib/store.ts';
import { mostraToast } from '../lib/toast.ts';
import { cercaPagine } from '../lib/libri.ts';
import { ENERGIE, MOOD, PIATTAFORME_BASE, TIPOLOGIE } from '../../../shared/stasera.ts';
import { useRiordino } from '../ui/riordina.tsx';
import { Back, DotsPick, Field, Gruppo, Row, Scelta, SliderImportanza, Toggle, Top } from '../ui/kit.tsx';
import { BadgeTipo } from '../ui/Icone.tsx';
import { CampoTempo } from '../ui/CampoTempo.tsx';
import { AllegatiNote } from '../ui/AllegatiNote.tsx';
import { scriviQuando, scriviTrascorso } from '../../../shared/tempo.ts';
import { useNav } from '../ui/nav.tsx';
import { clsx, mapsUrl, newId, nomeTempo } from '../lib/util.ts';
import { intervallo, margineAtteso, percentuale, stimaPer } from '../../../shared/stima.ts';

type GruppoTipo = 'azione' | 'progetto' | 'esperienza' | 'routine' | 'intrattenimento' | 'ricetta' | 'curiosita' | 'persona';
const GRUPPI_TIPO: GruppoTipo[] = ['azione', 'progetto', 'esperienza', 'routine', 'intrattenimento', 'ricetta', 'curiosita'];
const NOMI_GRUPPO: Record<GruppoTipo, string> = {
  azione: NOMI_TIPO.azione, progetto: NOMI_TIPO.progetto, esperienza: NOMI_TIPO.esperienza, routine: NOMI_TIPO.routine,
  intrattenimento: 'Intrattenimento', ricetta: NOMI_TIPO.ricetta, curiosita: NOMI_TIPO.curiosita, persona: NOMI_TIPO.persona,
};
const IS_INTRATT = (t: Tipo) => TIPI_INTRATTENIMENTO.includes(t);
const gruppoDi = (t: Tipo): GruppoTipo => (IS_INTRATT(t) ? 'intrattenimento' : (t as GruppoTipo));
const IS_AZIONE = (t: Tipo) => t === 'azione' || t === 'progetto';
const IS_DATATO = (t: Tipo) => t === 'azione' || t === 'progetto' || t === 'esperienza';
const IS_VIDEO = (t: Tipo) => t === 'film' || t === 'serie' || t === 'anime';
const IS_COLLEZIONE = (t: Tipo) => IS_VIDEO(t) || t === 'gioco' || t === 'libro' || t === 'ricetta';
const HA_INTERESSE = (t: Tipo) => IS_COLLEZIONE(t) || t === 'esperienza' || t === 'curiosita';

const PROMEMORIA_PRESET: { giorni: number; nome: string }[] = [
  { giorni: 7, nome: '7 giorni prima' }, { giorni: 3, nome: '3 giorni prima' }, { giorni: 1, nome: '1 giorno prima' }, { giorni: 0, nome: 'Il giorno stesso' },
];

const nomeSforzo = nomeTempo;

const TIPI_PIATTO = ['Antipasto', 'Primo', 'Secondo', 'Contorno', 'Dolce', 'Piatto unico', 'Zuppa', 'Pane e lievitati', 'Bevanda'];

export function ItemDetail({ id, nuovo }: { id?: string; nuovo?: Partial<Item> }) {
  const nav = useNav();
  const tutte = useItems();
  const iniziale = useMemo<Item>(() => (id && getItem(id)) || nuovaVoce({ tipo: nuovo?.tipo ?? 'azione', titolo: '', ...(nuovo?.tipo === 'curiosita' ? { sforzoMin: 15 } : {}), ...nuovo }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [d, setD] = useState<Item>(iniziale);
  const ultimoSalvato = useRef<string>(id && getItem(id) ? JSON.stringify(iniziale) : '');
  const ref = useRef(d);
  ref.current = d;

  const salva = (x: Item) => {
    if (!x.titolo.trim()) return;
    const s = JSON.stringify(x);
    if (s === ultimoSalvato.current) return;
    saveItem({ ...x, inbox: undefined }); // una voce modificata nell'editor è considerata smistata
    ultimoSalvato.current = s;
  };

  // salvataggio automatico poco dopo ogni modifica, e all'uscita dalla schermata
  useEffect(() => {
    const t = setTimeout(() => salva(d), 500);
    return () => clearTimeout(t);
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => salva(ref.current), []); // eslint-disable-line react-hooks/exhaustive-deps

  const up = (p: Partial<Item>) => setD((x) => ({ ...x, ...p }));

  // la voce può essere completata fuori da questa scheda (pulsante, finestra del voto o del tempo): la scheda ne segue lo stato
  const salvataOra = tutte.find((i) => i.id === d.id);
  useEffect(() => {
    if (!salvataOra) return;
    const { stato, completatoIl, completatoTs, voto, commento, durataRealeMin } = salvataOra;
    setD((x) => (x.stato === stato && x.completatoIl === completatoIl && x.completatoTs === completatoTs && x.voto === voto && x.commento === commento && x.durataRealeMin === durataRealeMin
      ? x
      : { ...x, stato, completatoIl, completatoTs, voto, commento, durataRealeMin }));
    if (ultimoSalvato.current) {
      try { ultimoSalvato.current = JSON.stringify({ ...JSON.parse(ultimoSalvato.current), stato, completatoIl, completatoTs, voto, commento, durataRealeMin }); } catch { /* ignora */ }
    }
  }, [salvataOra?.stato, salvataOra?.completatoIl, salvataOra?.completatoTs, salvataOra?.voto, salvataOra?.commento, salvataOra?.durataRealeMin]); // eslint-disable-line react-hooks/exhaustive-deps
  // aprire una voce messa in Revisione vale come averla vista: esce dalla Revisione (si salva da sola)
  useEffect(() => { if (id && iniziale.daRivedere) setD((x) => ({ ...x, daRivedere: undefined })); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const t = d.tipo;
  const oggi = today();
  const persone = useMemo(() => nomiUsati(tutte), [tutte]);
  const piattaforme = useMemo(() => [...new Set(tutte.map((i) => i.piattaforma).filter((x): x is string => !!x))], [tutte]);
  const progetti = useMemo(() => tutte.filter((i) => !i.eliminato && i.tipo === 'progetto' && i.id !== d.id && (i.id === d.padreId || (i.stato !== 'fatto' && i.stato !== 'saltato' && i.stato !== 'parcheggiato'))), [tutte, d.id, d.padreId]);
  // stima del tempo: da attività simili già fatte, con il margine d'errore atteso
  const suggerita = useMemo(() => (t === 'azione' && d.titolo.trim().length >= 3 ? stimaPer(d.titolo, tutte.filter((i) => i.id !== d.id)) : undefined), [tutte, t, d.titolo, d.id]);
  const margine = useMemo(() => (suggerita ? suggerita.margine : margineAtteso(tutte)), [suggerita, tutte]);
  const passi = useMemo(() => (t === 'progetto' ? figli(tutte, d.id).filter((c) => c.stato !== 'parcheggiato') : []), [tutte, t, d.id]);
  const checklist = d.checklist ?? [];
  const setCheck = (c: VoceChecklist[]) => up({ checklist: c.length ? c : undefined });
  const ordChecklist = useRiordino(checklist.map((c) => c.id), (idsNuovi) => setCheck(idsNuovi.map((i) => checklist.find((c) => c.id === i)!)));
  const ordPassi = useRiordino(passi.map((c) => c.id), (idsNuovi) => ordinaPassi(d.id, idsNuovi));
  const avanz = t === 'progetto' ? avanzamento(d, tutte) : undefined;
  const [oreTesto, setOreTesto] = useState(() => (d.durataMin ? String(+(d.durataMin / 60).toFixed(1)).replace('.', ',') : ''));
  const [ricercaPagine, setRicercaPagine] = useState<'' | 'cerco' | 'trovate' | 'nonTrovate'>('');
  const ultimoTitoloCercato = useRef('');

  // libro: le pagine si cercano da sole online, quando il titolo è scritto e le pagine non ci sono
  useEffect(() => {
    if (d.tipo !== 'libro' || d.pagine !== undefined) return;
    const titolo = d.titolo.trim();
    if (titolo.length < 3 || titolo === ultimoTitoloCercato.current) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      ultimoTitoloCercato.current = titolo;
      setRicercaPagine('cerco');
      const pagine = await cercaPagine(titolo, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (pagine) { setD((x) => (x.pagine === undefined && x.titolo.trim() === titolo ? { ...x, pagine } : x)); setRicercaPagine('trovate'); }
      else setRicercaPagine('nonTrovate');
    }, 900);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [d.titolo, d.tipo, d.pagine]);

  const generi = (d.genere ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const puntegg = IS_AZIONE(t) ? score(withTemp(d), oggi) : undefined;
  const due = dueDate(d);
  const componenti = componentiPunteggio(withTemp(d), oggi);
  // posizione in classifica tra le attività aperte (1 = la più prioritaria)
  const posizione = useMemo(() => {
    if (puntegg === undefined) return { pos: 1, tot: 1 };
    const altre = listaAzioni(tutte, oggi).filter((e) => e.item.id !== d.id);
    return { pos: 1 + altre.filter((e) => e.punteggio > puntegg).length, tot: altre.length + 1 };
  }, [tutte, oggi, d.id, puntegg]);

  function withTemp(x: Item): Item {
    return x.padreId ? { ...x, importanza: x.importanza ?? getItem(x.padreId)?.importanza, fine: x.fine ?? (x.inizio ? undefined : getItem(x.padreId)?.fine) } : x;
  }

  const cambiaTipo = (nt: Tipo) => {
    const p: Partial<Item> = { tipo: nt, inbox: undefined };
    if (nt !== 'azione') p.padreId = undefined;
    if (HA_INTERESSE(nt) && d.interesse === undefined) p.interesse = 3;
    if (IS_AZIONE(nt) && d.importanza === undefined) p.importanza = 3;
    if (nt === 'curiosita' && d.sforzoMin === undefined) p.sforzoMin = 15;
    if (nt === 'routine') { p.fascia = d.fascia ?? 'sera'; p.log = d.log ?? []; }
    up(p);
  };

  const togglePromemoria = (giorni: number, on: boolean) => {
    const lista = (d.promemoria ?? []).filter((p) => p.giorniPrima !== giorni);
    if (on) lista.push({ giorniPrima: giorni, ora: '09:00' } satisfies Promemoria);
    up({ promemoria: lista.length ? lista.sort((a, b) => b.giorniPrima - a.giorniPrima) : undefined });
  };


  /** Salva subito lo stato indicato e torna indietro (per "Metti da parte" e "Rimetti in gioco"). */
  const esci = (nuovo: Item, testo: string) => {
    const statoPrima = d.stato;
    salva(nuovo);
    ref.current = nuovo;
    setD(nuovo);
    nav.pop();
    mostraToast(testo, { label: 'Annulla', fn: () => saveItem({ ...nuovo, stato: statoPrima }) });
  };

  const elimina = () => {
    if (!window.confirm(`Eliminare «${d.titolo || 'questa voce'}»?`)) return;
    ultimoSalvato.current = JSON.stringify(d);
    ref.current = { ...ref.current, titolo: '' }; // evita il salvataggio all'uscita
    if (getItem(d.id)) {
      const prima = getItem(d.id)!;
      removeItem(d.id);
      mostraToast('Eliminata', { label: 'Annulla', fn: () => saveItem(prima) });
    }
    nav.pop();
  };


  return (
    <>
      <Back label={nuovo && !id ? 'Annulla' : 'Indietro'} />
      <Top
        title={d.titolo || 'Nuova voce'}
        sub={NOMI_TIPO[t]}
        right={d.inbox ? <span className="badge">Da smistare</span> : undefined}
      />
      <div className="scroll">
        {puntegg !== undefined && d.stato !== 'fatto' && (
          <div className={clsx('prio', `p${barLevel(puntegg)}`)} aria-label={`Priorità ${['', 'bassa', 'media', 'alta'][barLevel(puntegg)]}, ${posizione.pos}ª da fare su ${posizione.tot}`}>
            <div className="prio-testa">
              <span className="prio-n">{posizione.pos}</span>
              <div className="prio-t">
                <b>{posizione.pos}ª da fare</b>
                <span>su {posizione.tot}</span>
              </div>
              <span className="prio-lvl">Priorità {['', 'bassa', 'media', 'alta'][barLevel(puntegg)]}</span>
            </div>
            <div className="prio-parti">
              {([['Urgenza', componenti.urgenza], ['Importanza', componenti.importanza], ['Poco sforzo', componenti.sforzo], ['Età', componenti.eta]] as const).map(([nome, v]) => (
                <div key={nome} className="prio-riga"><span>{nome}</span><div className="prio-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, v))}%` }} /></div></div>
              ))}
            </div>
            <div className="prio-dati">
              <span className={clsx(d.rigida && 'hard')}>{due ? `${d.rigida ? 'Scadenza rigida' : 'Scadenza'} ${relativeDays(due, oggi)}` : 'Senza scadenza'}</span>
              <span>Importanza {['', 'molto bassa', 'bassa', 'media', 'alta', 'molto alta'][Math.round(d.importanza ?? 3)]}</span>
              {d.sforzoMin ? <span>{nomeSforzo(d.sforzoMin)} {percentuale(margine)}</span> : null}
            </div>
          </div>
        )}

        <Gruppo>
          <Field label="Titolo"><input value={d.titolo} placeholder="Cosa?" autoFocus={!id} onChange={(e) => up({ titolo: e.target.value })} /></Field>
          <Scelta label="Tipo" valore={gruppoDi(t)}
            onChange={(g) => cambiaTipo(g === 'intrattenimento' ? (IS_INTRATT(t) ? t : 'film') : (g as Tipo))}
            voci={(GRUPPI_TIPO.includes(gruppoDi(t)) ? GRUPPI_TIPO : [...GRUPPI_TIPO, gruppoDi(t)]).map((g) => ({ id: g, nome: NOMI_GRUPPO[g], icona: <BadgeTipo tipo={g === 'intrattenimento' ? 'film' : (g as Tipo)} /> }))} />
          {IS_INTRATT(t) && (
            <Scelta label="Sezione" valore={t} onChange={cambiaTipo}
              voci={TIPI_INTRATTENIMENTO.map((x) => ({ id: x, nome: NOMI_TIPO[x], icona: <BadgeTipo tipo={x} /> }))} />
          )}
        </Gruppo>

        {IS_DATATO(t) && (
          <Gruppo titolo={NOMI_TIPO[t]}>
            {t === 'azione' && (
              <Field label="Progetto">
                <select value={d.padreId ?? ''} onChange={(e) => up({ padreId: e.target.value || undefined })}>
                  <option value="">Nessuno</option>{progetti.map((p) => <option key={p.id} value={p.id}>{p.titolo}</option>)}
                </select>
              </Field>
            )}
            <Field label="Data"><input type="date" value={d.inizio ?? ''} onChange={(e) => up({ inizio: e.target.value || undefined, fine: e.target.value ? d.fine : undefined, rigida: e.target.value ? d.rigida : undefined, oraInizio: e.target.value ? d.oraInizio : undefined, oraFine: e.target.value ? d.oraFine : undefined })} /></Field>
            {d.inizio && (
              <Field label="Scadenza rigida">
                <button type="button" role="checkbox" aria-checked={!!d.rigida} aria-label="Scadenza rigida" className={clsx('cb sq', d.rigida && 'done')} onClick={() => up({ rigida: d.rigida ? undefined : true })} />
              </Field>
            )}
            {IS_AZIONE(t) && <Field label="Importanza"><SliderImportanza label="Importanza" valore={d.importanza} onChange={(v) => up({ importanza: v })} /></Field>}
            {t === 'esperienza' && <Field label="Interesse"><DotsPick label="Interesse" valore={d.interesse} onChange={(v) => up({ interesse: v })} /></Field>}
            {IS_AZIONE(t) && (
              <CampoTempo label="Tempo stimato" valore={d.sforzoMin} onChange={(m) => up({ sforzoMin: m })} />
            )}
            {IS_AZIONE(t) && (d.sforzoMin || suggerita) && (
              <div className="t2" style={{ padding: '6px 0 10px' }}>
                {d.sforzoMin ? (
                  <>Errore atteso <b>{percentuale(margine)}</b>: tra {nomeTempo(intervallo(d.sforzoMin, margine)[0])} e {nomeTempo(intervallo(d.sforzoMin, margine)[1])}.</>
                ) : suggerita && (
                  <>
                    Stima suggerita da {suggerita.campioni} {suggerita.campioni === 1 ? 'attività simile' : 'attività simili'}: <b>{nomeTempo(suggerita.minuti)} {percentuale(suggerita.margine)}</b>{' '}
                    <button type="button" className="chip" onClick={() => up({ sforzoMin: suggerita.minuti })}>Usa</button>
                  </>
                )}
              </div>
            )}
            {t === 'esperienza' && d.titolo.trim() && (
              <a className="field link" href={mapsUrl(d.titolo, d.zona)} target="_blank" rel="noreferrer"><b style={{ fontWeight: 620 }}>Apri in Google Maps</b><span className="muted">›</span></a>
            )}
            {d.inizio && <Field label="Ora"><input type="time" value={d.oraInizio ?? ''} onChange={(e) => up({ oraInizio: e.target.value || undefined, oraFine: e.target.value ? d.oraFine : undefined })} /></Field>}
            {d.inizio && (
              <>
                <div className="t2" style={{ marginTop: 12 }}>Promemoria (alle 9:00)</div>
                <div className="chips">
                  {PROMEMORIA_PRESET.map((p) => {
                    const on = (d.promemoria ?? []).some((x) => x.giorniPrima === p.giorni);
                    return <button key={p.giorni} className={clsx('chip', on && 'on')} onClick={() => togglePromemoria(p.giorni, !on)}>{p.nome}</button>;
                  })}
                </div>
                <Field label="Ripeti finché non spunto"><Toggle on={!!d.insisti} label="Ripeti il promemoria" onChange={(v) => up({ insisti: v ? { ogniMinuti: 60 } : undefined })} /></Field>
                {d.insisti && (
                  <Field label="Ogni">
                    <select value={d.insisti.ogniMinuti} onChange={(e) => up({ insisti: { ogniMinuti: Number(e.target.value) } })}>
                      <option value={30}>30 minuti</option><option value={60}>1 ora</option><option value={120}>2 ore</option><option value={240}>4 ore</option>
                    </select>
                  </Field>
                )}
              </>
            )}
          </Gruppo>
        )}

        {t === 'curiosita' && (
          <Gruppo titolo="Interesse">
            <Field label="Interesse"><DotsPick label="Interesse" valore={d.interesse} onChange={(v) => up({ interesse: v })} /></Field>
            <CampoTempo label="Tempo stimato" valore={d.sforzoMin} onChange={(m) => up({ sforzoMin: m ?? 15 })} />
          </Gruppo>
        )}

        {IS_COLLEZIONE(t) && (
          <Gruppo titolo={IS_INTRATT(t) ? 'Intrattenimento' : NOMI_TIPO[t]}>
            <Field label="Interesse"><DotsPick label="Interesse" valore={d.interesse} onChange={(v) => up({ interesse: v })} /></Field>
            {IS_VIDEO(t) && <Field label="Piattaforma"><input list="piattaforme" value={d.piattaforma ?? ''} placeholder="es. Netflix" onChange={(e) => up({ piattaforma: e.target.value || undefined })} /></Field>}
            <datalist id="piattaforme">{[...new Set([...piattaforme, ...PIATTAFORME_BASE])].map((p) => <option key={p} value={p} />)}</datalist>
            {t !== 'ricetta' && t !== 'film' && (
              <>
                <Field label="Consigliato da"><input list="persone" value={d.consigliatoDa ?? ''} onChange={(e) => up({ consigliatoDa: e.target.value || undefined })} /></Field>
                <datalist id="persone">{persone.map((p) => <option key={p} value={p} />)}</datalist>
                <Field label="Con chi"><input list="persone" value={d.conChi ?? ''} onChange={(e) => up({ conChi: e.target.value || undefined })} /></Field>
              </>
            )}
            {(t === 'serie' || t === 'anime') && <Field label="Durata (minuti)"><input inputMode="numeric" value={d.durataMin ?? ''} onChange={(e) => up({ durataMin: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></Field>}
            {t === 'gioco' && (
              <Field label="Durata (ore)">
                <input inputMode="decimal" value={oreTesto} placeholder="es. 12" onChange={(e) => {
                  const testo = e.target.value.replace(/[^\d.,]/g, '');
                  setOreTesto(testo);
                  const ore = parseFloat(testo.replace(',', '.'));
                  up({ durataMin: Number.isFinite(ore) && ore > 0 ? Math.round(ore * 60) : undefined });
                }} />
              </Field>
            )}
            {t === 'libro' && (
              <>
                <Field label="Pagine"><input inputMode="numeric" value={d.pagine ?? ''} placeholder="cerco online…" onChange={(e) => up({ pagine: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></Field>
                {ricercaPagine === 'cerco' && d.pagine === undefined && <div className="t2" style={{ padding: '6px 0' }}>Cerco le pagine online…</div>}
                {ricercaPagine === 'trovate' && d.pagine !== undefined && <div className="t2" style={{ padding: '6px 0' }}>Pagine trovate online (puoi correggerle).</div>}
                {ricercaPagine === 'nonTrovate' && d.pagine === undefined && <div className="t2" style={{ padding: '6px 0' }}>Non ho trovato le pagine: scrivile tu.</div>}
              </>
            )}
            {(t === 'gioco' || t === 'libro') && <Field label="Genere"><input value={d.genere ?? ''} onChange={(e) => up({ genere: e.target.value || undefined })} /></Field>}
            {(t === 'ricetta' || IS_VIDEO(t)) && (
              <>
                <div className="t2" style={{ marginTop: 12 }}>{t === 'ricetta' ? 'Genere' : 'Tipologia'}</div>
                <div className="chips" style={{ marginBottom: 12 }}>
                  {[...(t === 'ricetta' ? TIPI_PIATTO : TIPOLOGIE), ...generi.filter((g) => !(t === 'ricetta' ? TIPI_PIATTO : TIPOLOGIE).includes(g))].map((g) => {
                    const on = generi.includes(g);
                    return <button key={g} type="button" aria-pressed={on} className={clsx('chip', on && 'on')}
                      onClick={() => up({ genere: (on ? generi.filter((x) => x !== g) : [...generi, g]).join(', ') || undefined })}>{g}</button>;
                  })}
                </div>
              </>
            )}
            {IS_VIDEO(t) && (
              <>
                <div className="t2">Mood</div>
                <div className="chips">
                  {MOOD.map((m) => <button key={m} type="button" aria-pressed={d.mood === m} className={clsx('chip', d.mood === m && 'on')} onClick={() => up({ mood: d.mood === m ? undefined : m })}>{m}</button>)}
                </div>
                <div className="t2" style={{ marginTop: 12 }}>Energia richiesta</div>
                <div className="chips" style={{ marginBottom: 12 }}>
                  {ENERGIE.map((e) => <button key={e.id} type="button" aria-pressed={d.energia === e.id} className={clsx('chip', d.energia === e.id && 'on')} onClick={() => up({ energia: d.energia === e.id ? undefined : e.id })}>{e.nome}</button>)}
                </div>
              </>
            )}
          </Gruppo>
        )}

        {t === 'routine' && (
          <Gruppo titolo="Routine">
            <Field label="Momento">
              <select value={d.fascia ?? 'sera'} onChange={(e) => up({ fascia: e.target.value as Fascia })}>
                {(Object.keys(NOMI_FASCIA) as Fascia[]).map((f) => <option key={f} value={f}>{NOMI_FASCIA[f]}</option>)}
              </select>
            </Field>
            <Field label="Frequenza">
              <select value={d.volteSettimana ?? 0} onChange={(e) => up({ volteSettimana: Number(e.target.value) || undefined })}>
                <option value={0}>Ogni giorno</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'volta' : 'volte'} a settimana</option>)}
              </select>
            </Field>
            <Field label="Obiettivo minimo"><input value={d.obiettivo ?? ''} placeholder="es. Leggere 10 minuti" onChange={(e) => up({ obiettivo: e.target.value || undefined })} /></Field>
            <Field label="Promemoria alle"><input type="time" value={d.oraPromemoria ?? ''} onChange={(e) => up({ oraPromemoria: e.target.value || undefined })} /></Field>
          </Gruppo>
        )}

        {t === 'progetto' && (
          <Gruppo titolo={`Checklist${avanz && avanz.totale ? ` · ${avanz.fatti} su ${avanz.totale}` : ''}`}>
            {avanz && avanz.totale > 0 && <div className="bar"><i style={{ width: `${(avanz.fatti / avanz.totale) * 100}%` }} /></div>}
            <div ref={ordChecklist.cont} className="riordinabile">
              {ordChecklist.ordinati(checklist).map((c) => (
                <div key={c.id} className={clsx('row', ordChecklist.preso === c.id && 'sollevata')} {...ordChecklist.presa(c.id)}>
                  <span className="maniglia" data-grip aria-hidden="true"><i /></span>
                  <div className={clsx('grow t1 light', c.fatto && 'struck')}>{c.testo}</div>
                  <button className="chip" aria-label="Togli la voce" onClick={() => setCheck(checklist.filter((x) => x.id !== c.id))}>✕</button>
                  <button className={clsx('cb', c.fatto && 'done')} aria-label={`Segna «${c.testo}»`} onClick={() => setCheck(checklist.map((x) => x.id === c.id ? { ...x, fatto: !x.fatto } : x))} />
                </div>
              ))}
            </div>
            <div ref={ordPassi.cont} className="riordinabile">
              {ordPassi.ordinati(passi).map((c) => (
                <div key={c.id} className={clsx('row passo-riga', ordPassi.preso === c.id && 'sollevata')} {...ordPassi.presa(c.id)}>
                  <span className="maniglia" data-grip aria-hidden="true"><i /></span>
                  <button className="passo-titolo" onClick={() => nav.push({ k: 'item', id: c.id })}>
                    <span className={clsx('t1', c.stato === 'fatto' && 'light struck')}>{c.titolo}</span>
                    {dueDate(c) && <span className="t2" style={{ display: 'block' }}>{formatShortYear(dueDate(c)!, oggi)}</span>}
                  </button>
                  <button className={clsx('cb', c.stato === 'fatto' && 'done')} role="checkbox" aria-checked={c.stato === 'fatto'} aria-label={`Segna «${c.titolo}»`} onClick={() => (c.stato === 'fatto' ? riapriVoce(c) : completaVoce(c))} />
                </div>
              ))}
            </div>
            {(passi.length > 1 || checklist.length > 1) && <div className="t2" style={{ padding: '6px 0 4px' }}>L'ordine è la priorità: il primo passo aperto è il prossimo da fare. Tieni premuta una riga, o trascinala dal bordo sinistro, per spostarla.</div>}
            <AggiungiRiga placeholder="Aggiungi un passo" onAdd={(txt) => setCheck([...checklist, { id: newId(), testo: txt, fatto: false }])} />
          </Gruppo>
        )}

        <Gruppo titolo="Note">
          <textarea className="textarea" value={d.note ?? ''} placeholder="Appunti" onChange={(e) => up({ note: e.target.value || undefined })} />
          <AllegatiNote link={d.link} immagini={d.immagini} onChange={(p) => up(p)} />
        </Gruppo>

        {getItem(d.id) && (
          <Gruppo titolo="Cronologia">
            <div className="field"><span>Creata</span><b style={{ fontWeight: 650 }}>{scriviQuando(d.creato)}</b></div>
            {d.stato === 'fatto' && (d.completatoTs || d.completatoIl) && (
              <div className="field"><span>Completata</span><b style={{ fontWeight: 650 }}>{d.completatoTs ? scriviQuando(d.completatoTs) : scriviQuando(new Date(`${d.completatoIl}T12:00:00`).getTime(), true)}</b></div>
            )}
            {d.stato === 'fatto' && d.completatoTs && d.completatoTs >= d.creato && (
              <div className="field"><span>Tempo trascorso</span><span className="cron-trascorso">{scriviTrascorso(d.completatoTs - d.creato)}</span></div>
            )}
          </Gruppo>
        )}

        {d.stato === 'fatto' && (
          <Gruppo titolo="Completata">
            <div className="field"><span>Fatta il</span><span>{d.completatoIl ? formatShortYear(d.completatoIl, oggi) : '—'}</span></div>
            {d.durataRealeMin !== undefined && <div className="field"><span>Tempo impiegato</span><span>{nomeTempo(d.durataRealeMin)}{d.sforzoMin ? ` (stimato ${nomeTempo(d.sforzoMin)})` : ''}</span></div>}
            {d.voto !== undefined && <div className="field"><span>Voto</span><span>{d.voto} / 10</span></div>}
            {d.commento && <div className="t2" style={{ padding: '10px 0 12px', whiteSpace: 'pre-wrap' }}>{d.commento}</div>}
          </Gruppo>
        )}

        {getItem(d.id) && (
          <div className="btns tre" style={{ marginTop: 18 }}>
            <button className="btn danger" onClick={elimina}>Elimina</button>
            {d.stato === 'parcheggiato'
              ? <button className="btn" onClick={() => esci({ ...d, stato: 'da_fare' }, 'Ripristinata')}>Ripristina</button>
              : d.stato !== 'fatto' && <button className="btn" onClick={() => esci({ ...d, stato: 'parcheggiato' }, 'Archiviata')}>Archivia</button>}
            {d.stato === 'fatto'
              ? <button className="btn solid" onClick={() => { riapriVoce(d); nav.pop(); }}>Riapri</button>
              : t !== 'routine' && t !== 'persona' && d.stato !== 'parcheggiato' && <button className="btn solid" onClick={() => { salva(d); completaVoce(getItem(d.id) ?? d); }}>Completato</button>}
          </div>
        )}
      </div>
    </>
  );
}

function AggiungiRiga({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  const invia = () => { const x = v.trim(); if (x) { onAdd(x); setV(''); } };
  return (
    <form className="field" onSubmit={(e) => { e.preventDefault(); invia(); }}>
      <input value={v} placeholder={placeholder} style={{ textAlign: 'left' }} onChange={(e) => setV(e.target.value)} />
      <button type="submit" className="chip" disabled={!v.trim()}>Aggiungi</button>
    </form>
  );
}
