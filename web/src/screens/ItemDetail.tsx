/**
 * Scheda di una voce (editor): mostra e modifica una nota esistente oppure ne crea una nuova (`nuovo`).
 * Sul telefono occupa tutta la schermata; da 900 px il guscio dell'app la apre come finestra sopra la
 * schermata corrente (il contenuto è lo stesso).
 *
 * Il salvataggio è automatico (mezzo secondo dopo l'ultima modifica e all'uscita). Dall'alto in basso:
 * selettore dello stato, blocco della priorità, titolo e tipo, poi i gruppi di campi del tipo scelto
 * (vedi sotto), note e allegati, cronologia, riepilogo di ciò che è stato completato, Elimina.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { NOMI_FASCIA, NOMI_TIPO, TIPI_INTRATTENIMENTO, type Fascia, type Item, type Promemoria, type Tipo, type VoceChecklist } from '../../../shared/types.ts';
import { formatShortYear, relativeDays, today } from '../../../shared/dates.ts';
import { barLevel, componentiPunteggio, dueDate } from '../../../shared/priority.ts';
import { avanzamento, figli, luoghiUsati, nomiUsati, posizionePriorita, punteggioEffettivo } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { STATI_NOTA, cambiaStato, nuovaVoce, ordinaPassi, statoVisto } from '../lib/actions.ts';
import { getItem, removeItem, saveItem } from '../lib/store.ts';
import { mostraToast } from '../lib/toast.ts';
import { cercaPagine } from '../lib/libri.ts';
import { ENERGIE, MOOD, PIATTAFORME_BASE, TIPOLOGIE } from '../../../shared/stasera.ts';
import { useRiordino } from '../ui/riordina.tsx';
import { Back, Field, Gruppo, Row, Scelta, SliderImportanza, Toggle, Top } from '../ui/kit.tsx';
import { BadgeTipo } from '../ui/Icone.tsx';
import { CampoTempo } from '../ui/CampoTempo.tsx';
import { AllegatiNote } from '../ui/AllegatiNote.tsx';
import { scriviQuando, scriviTrascorso } from '../../../shared/tempo.ts';
import { useNav } from '../ui/nav.tsx';
import { clsx, mapsUrl, newId, nomeTempo } from '../lib/util.ts';
import { listaGameDesign, punteggioGameDesign } from '../../../shared/gamedesign.ts';
import { intervallo, margineAtteso, percentuale, stimaPer } from '../../../shared/stima.ts';

// Nella tendina «Tipo» film, serie, anime, gioco e libro sono un solo gruppo «Intrattenimento»
// (la tendina «Sezione» sotto sceglie quale); gli altri tipi corrispondono a un gruppo ciascuno.
// Un tipo fuori elenco (per esempio «nota», la bozza non assegnata dell'Inbox) viene aggiunto alle voci
// finché la voce lo ha, così la tendina mostra sempre il valore reale.
type GruppoTipo = Tipo | 'intrattenimento';
const GRUPPI_TIPO: GruppoTipo[] = ['azione', 'progetto', 'esperienza', 'routine', 'intrattenimento', 'ricetta', 'curiosita', 'gamedesign'];
const NOMI_GRUPPO: Record<string, string> = { ...NOMI_TIPO, intrattenimento: 'Intrattenimento' };
const IS_INTRATT = (t: Tipo) => TIPI_INTRATTENIMENTO.includes(t);
const gruppoDi = (t: Tipo): GruppoTipo => (IS_INTRATT(t) ? 'intrattenimento' : t);

// Famiglie di tipi: decidono quali gruppi di campi compaiono nell'editor.
const IS_AZIONE = (t: Tipo) => t === 'azione' || t === 'progetto'; // importanza, tempo stimato, priorità calcolata
const IS_DATATO = (t: Tipo) => t === 'azione' || t === 'progetto' || t === 'esperienza'; // data, scadenza fissa, promemoria
const IS_VIDEO = (t: Tipo) => t === 'film' || t === 'serie' || t === 'anime'; // piattaforma, tipologia, mood, energia
const IS_COLLEZIONE = (t: Tipo) => IS_VIDEO(t) || t === 'gioco' || t === 'libro' || t === 'ricetta'; // gruppo «Intrattenimento» o «Ricetta»
const HA_INTERESSE = (t: Tipo) => IS_COLLEZIONE(t) || t === 'esperienza' || t === 'curiosita' || t === 'gamedesign'; // slider dell'interesse

const PROMEMORIA_PRESET: { giorni: number; nome: string }[] = [
  { giorni: 7, nome: '7 giorni prima' }, { giorni: 3, nome: '3 giorni prima' }, { giorni: 1, nome: '1 giorno prima' }, { giorni: 0, nome: 'Il giorno stesso' },
];

const TIPI_PIATTO = ['Antipasto', 'Primo', 'Secondo', 'Contorno', 'Dolce', 'Piatto unico', 'Zuppa', 'Pane e lievitati', 'Bevanda'];

/** Editor di una voce. `id` apre una voce esistente; `nuovo` precompila una voce da creare (tipo, titolo…). */
export function ItemDetail({ id, nuovo }: { id?: string; nuovo?: Partial<Item> }) {
  const nav = useNav();
  const tutte = useItems();
  const iniziale = useMemo<Item>(() => (id && getItem(id)) || nuovaVoce({ tipo: nuovo?.tipo ?? 'azione', titolo: '', ...nuovo }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [d, setD] = useState<Item>(iniziale);
  const ultimoSalvato = useRef<string>(id && getItem(id) ? JSON.stringify(iniziale) : '');
  const ref = useRef(d);
  ref.current = d;

  const salva = (x: Item) => {
    if (!x.titolo.trim()) return;
    const s = JSON.stringify(x);
    if (s === ultimoSalvato.current) return;
    saveItem({ ...x, inbox: x.tipo === 'nota' ? true : undefined }); // una voce modificata nell'editor è smistata, ma resta in Inbox finché non ha un tipo
    ultimoSalvato.current = s;
  };

  // Salvataggio automatico: mezzo secondo dopo l'ultima modifica e all'uscita dalla schermata.
  // Una voce senza titolo non viene salvata.
  useEffect(() => {
    const t = setTimeout(() => salva(d), 500);
    return () => clearTimeout(t);
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => salva(ref.current), []); // eslint-disable-line react-hooks/exhaustive-deps

  const up = (p: Partial<Item>) => setD((x) => ({ ...x, ...p }));

  // La voce può cambiare stato fuori da questa scheda (casella della riga, finestra del voto): la scheda ne segue
  // stato e dati di completamento senza perdere ciò che si sta scrivendo.
  const salvataOra = tutte.find((i) => i.id === d.id);
  useEffect(() => {
    if (!salvataOra) return;
    const { stato, completatoIl, completatoTs, inCorsoTs, voto, commento, durataRealeMin } = salvataOra;
    setD((x) => (x.stato === stato && x.completatoIl === completatoIl && x.completatoTs === completatoTs && x.inCorsoTs === inCorsoTs && x.voto === voto && x.commento === commento && x.durataRealeMin === durataRealeMin
      ? x
      : { ...x, stato, completatoIl, completatoTs, inCorsoTs, voto, commento, durataRealeMin }));
    if (ultimoSalvato.current) {
      try { ultimoSalvato.current = JSON.stringify({ ...JSON.parse(ultimoSalvato.current), stato, completatoIl, completatoTs, inCorsoTs, voto, commento, durataRealeMin }); } catch { /* ignora */ }
    }
  }, [salvataOra?.stato, salvataOra?.completatoIl, salvataOra?.completatoTs, salvataOra?.inCorsoTs, salvataOra?.voto, salvataOra?.commento, salvataOra?.durataRealeMin]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = d.tipo;
  const oggi = today();
  const persone = useMemo(() => nomiUsati(tutte), [tutte]);
  const piattaforme = useMemo(() => [...new Set(tutte.map((i) => i.piattaforma).filter((x): x is string => !!x))], [tutte]);
  const progetti = useMemo(() => tutte.filter((i) => !i.eliminato && i.tipo === 'progetto' && i.id !== d.id && (i.id === d.padreId || (i.stato !== 'fatto' && i.stato !== 'saltato' && i.stato !== 'parcheggiato'))), [tutte, d.id, d.padreId]);
  // Stima del tempo: da attività simili già fatte, con il margine d'errore atteso (solo per le attività).
  const suggerita = useMemo(() => (t === 'azione' && d.titolo.trim().length >= 3 ? stimaPer(d.titolo, tutte.filter((i) => i.id !== d.id)) : undefined), [tutte, t, d.titolo, d.id]);
  const margine = useMemo(() => (suggerita ? suggerita.margine : margineAtteso(tutte)), [suggerita, tutte]);
  // Game design: punteggio di priorità dell'idea e posizione tra le altre idee aperte
  const prioritaIdea = useMemo(() => {
    if (t !== 'gamedesign') return '';
    const altre = listaGameDesign(tutte.filter((i) => i.id !== d.id));
    const mio = punteggioGameDesign(d);
    return `${Math.round(mio)} su 100 · ${altre.filter((e) => e.punteggio > mio).length + 1}ª su ${altre.length + 1}`;
  }, [tutte, d, t]);
  const passi = useMemo(() => (t === 'progetto' ? figli(tutte, d.id).filter((c) => c.stato !== 'parcheggiato') : []), [tutte, t, d.id]);
  const checklist = d.checklist ?? [];
  // Blocco della priorità in cima: chiuso di base, ricorda l'ultima scelta (solo su questo dispositivo).
  const [prioAperta, setPrioAperta] = useState(() => { try { return localStorage.getItem('mytask.prio.aperta') === '1'; } catch { return false; } });
  const alternaPrio = () => setPrioAperta((v) => { try { localStorage.setItem('mytask.prio.aperta', v ? '0' : '1'); } catch { /* ignora */ } return !v; });
  const setCheck = (c: VoceChecklist[]) => up({ checklist: c.length ? c : undefined });
  const ordChecklist = useRiordino(checklist.map((c) => c.id), (idsNuovi) => setCheck(idsNuovi.map((i) => checklist.find((c) => c.id === i)!)));
  const ordPassi = useRiordino(passi.map((c) => c.id), (idsNuovi) => ordinaPassi(d.id, idsNuovi));
  const avanz = t === 'progetto' ? avanzamento(d, tutte) : undefined;
  // La durata di un gioco si scrive in ore (anche con la virgola) ma si salva in minuti: serve il testo grezzo.
  const [oreTesto, setOreTesto] = useState(() => (d.durataMin ? String(+(d.durataMin / 60).toFixed(1)).replace('.', ',') : ''));
  const [ricercaPagine, setRicercaPagine] = useState<'' | 'cerco' | 'trovate' | 'nonTrovate'>('');
  const ultimoTitoloCercato = useRef('');

  // Libro: le pagine si cercano da sole su Open Library (in rete va solo il titolo) quando il titolo è
  // scritto e le pagine mancano; il risultato non sovrascrive ciò che si è scritto nel frattempo.
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

  // Luoghi già inseriti nelle esperienze: si scelgono con un tocco (si restringono mentre si scrive, escluso quello già scelto).
  const luoghiProposti = useMemo(() => {
    const scritto = (d.zona ?? '').trim().toLowerCase();
    return luoghiUsati(tutte).filter((z) => z.toLowerCase() !== scritto && z.toLowerCase().includes(scritto)).slice(0, 12);
  }, [tutte, d.zona]);
  const generi = (d.genere ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  // Priorità: solo attività e progetti hanno un punteggio; un'attività di un progetto eredita importanza e scadenza dal progetto.
  const puntegg = IS_AZIONE(t) ? punteggioEffettivo(withTemp(d), tutte, oggi) : undefined;
  const due = dueDate(d);
  const componenti = componentiPunteggio(withTemp(d), oggi);
  // Posizione in classifica tra le attività aperte (1 = la più prioritaria), la stessa dei numeri in Oggi e in Attività.
  const posizione = useMemo(() => {
    if (puntegg === undefined) return { pos: 1, tot: 1 };
    return posizionePriorita(tutte, withTemp(d), oggi);
  }, [tutte, oggi, d, puntegg]); // eslint-disable-line react-hooks/exhaustive-deps

  /** La voce con importanza e scadenza prese dal progetto, se non le ha proprie. */
  function withTemp(x: Item): Item {
    return x.padreId ? { ...x, importanza: x.importanza ?? getItem(x.padreId)?.importanza, fine: x.fine ?? (x.inizio ? undefined : getItem(x.padreId)?.fine) } : x;
  }

  // Cambiando tipo la voce esce dall'Inbox e riceve i valori di base dei campi del nuovo tipo.
  const cambiaTipo = (nt: Tipo) => {
    const p: Partial<Item> = { tipo: nt, inbox: undefined };
    if (nt !== 'azione') p.padreId = undefined;
    if (HA_INTERESSE(nt) && d.interesse === undefined) p.interesse = 3;
    if (IS_AZIONE(nt) && d.importanza === undefined) p.importanza = 3;
    if (nt === 'routine') { p.fascia = d.fascia ?? 'sera'; p.log = d.log ?? []; }
    up(p);
  };

  // I promemoria preimpostati scattano alle 9:00 del giorno indicato.
  const togglePromemoria = (giorni: number, on: boolean) => {
    const lista = (d.promemoria ?? []).filter((p) => p.giorniPrima !== giorni);
    if (on) lista.push({ giorniPrima: giorni, ora: '09:00' } satisfies Promemoria);
    up({ promemoria: lista.length ? lista.sort((a, b) => b.giorniPrima - a.giorniPrima) : undefined });
  };


  const elimina = () => {
    if (!window.confirm(`Eliminare «${d.titolo || 'questa voce'}»?`)) return;
    ultimoSalvato.current = JSON.stringify(d);
    ref.current = { ...ref.current, titolo: '' }; // senza titolo l'uscita non risalva la voce
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
        {/* Stato: solo per voci già salvate, escluse routine (si spuntano per giorno) e bozze non assegnate */}
        {getItem(d.id) && t !== 'routine' && t !== 'nota' && (
          <div className="stati-seg" role="tablist" aria-label="Stato della nota">
            {STATI_NOTA.map((s) => (
              <button key={s.id} role="tab" aria-selected={statoVisto(d.stato) === s.id}
                className={clsx(statoVisto(d.stato) === s.id && 'on', s.id === 'in_corso' && 'prog', s.id === 'fatto' && 'fatto')}
                onClick={() => { salva(d); cambiaStato(getItem(d.id) ?? d, s.id); }}>{s.nome}</button>
            ))}
          </div>
        )}
        {/* Blocco della priorità: posizione in classifica, livello e, se aperto, il peso di ciascun parametro */}
        {puntegg !== undefined && d.stato !== 'fatto' && (
          <div className={clsx('prio', `p${barLevel(puntegg)}`, prioAperta && 'aperta')} aria-label={`Priorità ${['', 'bassa', 'media', 'alta'][barLevel(puntegg)]}, ${posizione.pos}ª da fare su ${posizione.tot}`}>
            <button type="button" className="prio-testa" aria-expanded={prioAperta} aria-controls="prio-dettagli" onClick={alternaPrio}>
              <span className="prio-n">{posizione.pos}</span>
              <div className="prio-t">
                <b>{posizione.pos}ª da fare</b>
                <span>su {posizione.tot}</span>
              </div>
              <span className="prio-lvl">Priorità {['', 'bassa', 'media', 'alta'][barLevel(puntegg)]}</span>
              <span className="prio-chev" aria-hidden="true">▾</span>
            </button>
            <div className="prio-corpo" id="prio-dettagli" aria-hidden={!prioAperta} inert={!prioAperta}>
              <div className="prio-corpo-in">
            <div className="prio-parti">
              {([['Urgenza', componenti.urgenza], ['Importanza', componenti.importanza], ['Poco sforzo', componenti.sforzo], ['Età', componenti.eta], ['Scad. fissa', componenti.fissa]] as const).map(([nome, v]) => (
                <div key={nome} className="prio-riga"><span>{nome}</span><div className="prio-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, v))}%` }} /></div></div>
              ))}
            </div>
            <div className="prio-dati">
              <span className={clsx(d.rigida && 'hard')}>{due ? `${d.rigida ? 'Scadenza fissa' : 'Scadenza'} ${relativeDays(due, oggi)}` : 'Senza scadenza'}</span>
              <span>Importanza {['', 'molto bassa', 'bassa', 'media', 'alta', 'molto alta'][Math.round(d.importanza ?? 3)]}</span>
              {d.sforzoMin ? <span>{nomeTempo(d.sforzoMin)} {percentuale(margine)}</span> : null}
            </div>
              </div>
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

        {/* Attività, progetto, esperienza: progetto di appartenenza, data e scadenza fissa, importanza o interesse, tempo stimato, luogo, promemoria */}
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
              <Field label="Scadenza fissa">
                <button type="button" role="checkbox" aria-checked={!!d.rigida} aria-label="Scadenza fissa" className={clsx('cb sq', d.rigida && 'done')} onClick={() => up({ rigida: d.rigida ? undefined : true })} />
              </Field>
            )}
            {IS_AZIONE(t) && <Field label="Importanza"><SliderImportanza label="Importanza" valore={d.importanza} onChange={(v) => up({ importanza: v })} /></Field>}
            {t === 'esperienza' && <Field label="Interesse"><SliderImportanza verde label="Interesse" valore={d.interesse} onChange={(v) => up({ interesse: v })} /></Field>}
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
            {t === 'esperienza' && <Field label="Luogo"><input value={d.zona ?? ''} placeholder="es. Torino, Osteria da Gigi" onChange={(e) => up({ zona: e.target.value || undefined })} /></Field>}
            {t === 'esperienza' && luoghiProposti.length > 0 && (
              <div className="chips luoghi-scelta" role="group" aria-label="Luoghi già inseriti">
                {luoghiProposti.map((z) => <button key={z} type="button" className="chip" onClick={() => up({ zona: z })}>{z}</button>)}
              </div>
            )}
            {t === 'esperienza' && d.titolo.trim() && (
              <a className="field link" href={mapsUrl(d.titolo, d.zona)} target="_blank" rel="noreferrer"><b style={{ fontWeight: 620 }}>Apri in Google Maps</b><span className="muted">›</span></a>
            )}
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

        {/* Game design: un'idea di videogioco con interesse, tempo stimato e difficoltà; dalla loro media pesata (50/30/20) esce la priorità */}
        {t === 'gamedesign' && (
          <Gruppo titolo="Idea">
            <Field label="Interesse"><SliderImportanza verde label="Interesse" valore={d.interesse} onChange={(v) => up({ interesse: v })} /></Field>
            <CampoTempo label="Tempo stimato" valore={d.sforzoMin} onChange={(m) => up({ sforzoMin: m })} />
            <Field label="Difficoltà"><SliderImportanza label="Difficoltà" valore={d.difficolta} onChange={(v) => up({ difficolta: v })} /></Field>
            <Field label="Priorità"><b>{prioritaIdea}</b></Field>
          </Gruppo>
        )}

        {/* Curiosità: interesse e tempo stimato (la durata delle pause curiosità del piano) */}
        {t === 'curiosita' && (
          <Gruppo titolo="Interesse">
            <Field label="Interesse"><SliderImportanza verde label="Interesse" valore={d.interesse} onChange={(v) => up({ interesse: v })} /></Field>
            <CampoTempo label="Tempo stimato" valore={d.sforzoMin} onChange={(m) => up({ sforzoMin: m })} />
          </Gruppo>
        )}

        {/* Intrattenimento e ricette: interesse e, secondo il tipo, piattaforma, consigliato da, con chi, durata,
            pagine, genere o tipologia, mood ed energia (genere, mood ed energia li compila anche l'arricchimento) */}
        {IS_COLLEZIONE(t) && (
          <Gruppo titolo={IS_INTRATT(t) ? 'Intrattenimento' : NOMI_TIPO[t]}>
            <Field label="Interesse"><SliderImportanza verde label="Interesse" valore={d.interesse} onChange={(v) => up({ interesse: v })} /></Field>
            {IS_VIDEO(t) && <Field label="Piattaforma"><input list="piattaforme" value={d.piattaforma ?? ''} placeholder="es. Netflix" onChange={(e) => up({ piattaforma: e.target.value || undefined })} /></Field>}
            {IS_VIDEO(t) && piattaforme.length > 0 && (
              <div className="chips luoghi-scelta" role="group" aria-label="Piattaforme già inserite">
                {piattaforme.map((p) => <button key={p} type="button" className={clsx('chip', d.piattaforma === p && 'on')} aria-pressed={d.piattaforma === p} onClick={() => up({ piattaforma: d.piattaforma === p ? undefined : p })}>{p}</button>)}
              </div>
            )}
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

        {/* Routine: momento della giornata, frequenza settimanale, obiettivo minimo, ora del promemoria */}
        {t === 'routine' && (
          <Gruppo titolo="Routine">
            <Field label="Attiva"><Toggle label="Routine attiva" on={d.stato !== 'parcheggiato'} onChange={(on) => up({ stato: on ? 'da_fare' : 'parcheggiato' })} /></Field>
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

        {/* Progetto: checklist e passi (voci figlie) riordinabili; l'ordine è la priorità, il primo passo aperto è il prossimo da fare */}
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
              {ordPassi.ordinati(passi).map((c, n) => (
                <Row key={c.id} voce={c} titolo={c.titolo} tipo={c.tipo} maniglia rank={n + 1}
                  level={barLevel(punteggioEffettivo(c, tutte, oggi))}
                  meta={dueDate(c) ? formatShortYear(dueDate(c)!, oggi) : undefined}
                  classe={ordPassi.preso === c.id ? 'sollevata' : undefined}
                  extra={ordPassi.presa(c.id)}
                  onOpen={() => nav.push({ k: 'item', id: c.id })} />
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

        {/* Cronologia: creata, in corso dal, completata e tempo trascorso */}
        {getItem(d.id) && (
          <Gruppo titolo="Cronologia">
            <div className="field"><span>Creata</span><b style={{ fontWeight: 650 }}>{scriviQuando(d.creato)}</b></div>
            {d.inCorsoTs && d.stato !== 'parcheggiato' && (
              <div className="field"><span>In corso dal</span><b style={{ fontWeight: 650 }}>{scriviQuando(d.inCorsoTs)}</b></div>
            )}
            {d.stato === 'fatto' && (d.completatoTs || d.completatoIl) && (
              <div className="field"><span>Completata</span><b style={{ fontWeight: 650 }}>{d.completatoTs ? scriviQuando(d.completatoTs) : scriviQuando(new Date(`${d.completatoIl}T12:00:00`).getTime(), true)}</b></div>
            )}
            {d.stato === 'fatto' && d.completatoTs && d.completatoTs >= d.creato && (
              <div className="field"><span>Tempo trascorso</span><span className="cron-trascorso">{scriviTrascorso(d.completatoTs - d.creato)}</span></div>
            )}
          </Gruppo>
        )}

        {/* Riepilogo di una nota fatta: giorno, tempo impiegato rispetto alla stima, voto e commento */}
        {d.stato === 'fatto' && (
          <Gruppo titolo="Completata">
            <div className="field"><span>Fatta il</span><span>{d.completatoIl ? formatShortYear(d.completatoIl, oggi) : '—'}</span></div>
            {d.durataRealeMin !== undefined && <div className="field"><span>Tempo impiegato</span><span>{nomeTempo(d.durataRealeMin)}{d.sforzoMin ? ` (stimato ${nomeTempo(d.sforzoMin)})` : ''}</span></div>}
            {d.voto !== undefined && <div className="field"><span>Voto</span><span>{d.voto} / 10</span></div>}
            {d.commento && <div className="t2" style={{ padding: '10px 0 12px', whiteSpace: 'pre-wrap' }}>{d.commento}</div>}
          </Gruppo>
        )}

        {getItem(d.id) && (
          <div className="btns" style={{ marginTop: 18 }}>
            <button className="btn danger" onClick={elimina}>Elimina</button>
          </div>
        )}
      </div>
    </>
  );
}

/** Campo con pulsante «Aggiungi» per inserire una riga di checklist. */
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
