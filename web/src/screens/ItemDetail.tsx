import { useEffect, useMemo, useRef, useState } from 'react';
import { NOMI_FASCIA, NOMI_TIPO, TIPI_INTRATTENIMENTO, type Fascia, type Item, type Promemoria, type Tipo } from '../../../shared/types.ts';
import { formatShortYear, relativeDays, today } from '../../../shared/dates.ts';
import { dueDate, score } from '../../../shared/priority.ts';
import { nomiPersone } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { assicuraPersone, completaVoce, nuovaVoce, riapriVoce } from '../lib/actions.ts';
import { getItem, removeItem, saveItem } from '../lib/store.ts';
import { mostraToast } from '../lib/toast.ts';
import { Back, DotsPick, Field, Gruppo, Scelta, Toggle, Top } from '../ui/kit.tsx';
import { BadgeTipo } from '../ui/Icone.tsx';
import { useNav } from '../ui/nav.tsx';
import { clsx, mapsUrl } from '../lib/util.ts';

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

const SFORZI = [5, 15, 30, 60, 120, 240, 360, 480, 720, 1440];
const nomeSforzo = (m: number) => (m === 1440 ? '1 giorno' : m >= 60 ? `${m / 60} ${m === 60 ? 'ora' : 'ore'}` : `${m} min`);

const TIPI_PIATTO = ['Antipasto', 'Primo', 'Secondo', 'Contorno', 'Dolce', 'Piatto unico', 'Zuppa', 'Pane e lievitati', 'Bevanda'];

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
    assicuraPersone(x);
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
  const t = d.tipo;
  const oggi = today();
  const persone = useMemo(() => nomiPersone(tutte), [tutte]);
  const piattaforme = useMemo(() => [...new Set(tutte.map((i) => i.piattaforma).filter((x): x is string => !!x))], [tutte]);
  const generi = (d.genere ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const puntegg = IS_AZIONE(t) ? score(withTemp(d), oggi) : undefined;
  const due = dueDate(d);

  function withTemp(x: Item): Item {
    return x.padreId ? { ...x, importanza: x.importanza ?? getItem(x.padreId)?.importanza, fine: x.fine ?? (x.inizio ? undefined : getItem(x.padreId)?.fine) } : x;
  }

  const cambiaTipo = (nt: Tipo) => {
    const p: Partial<Item> = { tipo: nt, inbox: undefined };
    if (HA_INTERESSE(nt) && d.interesse === undefined) p.interesse = 3;
    if (IS_AZIONE(nt) && d.importanza === undefined) p.importanza = 3;
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
        sub={`${NOMI_TIPO[t]}${d.area ? ` · ${d.area}` : ''}`}
        right={d.inbox ? <span className="badge">Da smistare</span> : undefined}
      />
      <div className="scroll">
        {puntegg !== undefined && d.stato !== 'fatto' && (
          <div className="card strong">
            <div className="t2">Punteggio di priorità</div>
            <div className="big">{puntegg}</div>
            <div className="t2">
              {due ? `${d.rigida ? 'Scadenza rigida' : 'Scadenza'} ${relativeDays(due, oggi)}` : 'Senza scadenza'} · importanza {d.importanza ?? 3}{d.sforzoMin ? ` · ${nomeSforzo(d.sforzoMin)}` : ''}
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
            <Field label="Data"><input type="date" value={d.inizio ?? ''} onChange={(e) => up({ inizio: e.target.value || undefined, fine: e.target.value ? d.fine : undefined, rigida: e.target.value ? d.rigida : undefined, oraInizio: e.target.value ? d.oraInizio : undefined, oraFine: e.target.value ? d.oraFine : undefined })} /></Field>
            {IS_AZIONE(t) && <Field label="Importanza"><DotsPick label="Importanza" valore={d.importanza} onChange={(v) => up({ importanza: v })} /></Field>}
            {t === 'esperienza' && <Field label="Interesse"><DotsPick label="Interesse" valore={d.interesse} onChange={(v) => up({ interesse: v })} /></Field>}
            {IS_AZIONE(t) && (
              <Field label="Tempo stimato">
                <select value={d.sforzoMin ?? ''} onChange={(e) => up({ sforzoMin: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Non stimato</option>{SFORZI.map((m) => <option key={m} value={m}>{nomeSforzo(m)}</option>)}
                </select>
              </Field>
            )}
            {t === 'esperienza' && d.titolo.trim() && (
              <a className="field link" href={mapsUrl(d.titolo, d.zona)} target="_blank" rel="noreferrer"><b style={{ fontWeight: 620 }}>Apri in Google Maps</b><span className="muted">›</span></a>
            )}
            {d.inizio && <Field label="Ora"><input type="time" value={d.oraInizio ?? ''} onChange={(e) => up({ oraInizio: e.target.value || undefined, oraFine: e.target.value ? d.oraFine : undefined })} /></Field>}
            {d.inizio && <Field label="Scadenza rigida"><Toggle on={!!d.rigida} label="Scadenza rigida" onChange={(v) => up({ rigida: v || undefined })} /></Field>}
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
          </Gruppo>
        )}

        {IS_COLLEZIONE(t) && (
          <Gruppo titolo={IS_INTRATT(t) ? 'Intrattenimento' : NOMI_TIPO[t]}>
            <Field label="Interesse"><DotsPick label="Interesse" valore={d.interesse} onChange={(v) => up({ interesse: v })} /></Field>
            {IS_VIDEO(t) && <Field label="Piattaforma"><input list="piattaforme" value={d.piattaforma ?? ''} placeholder="es. Netflix" onChange={(e) => up({ piattaforma: e.target.value || undefined })} /></Field>}
            <datalist id="piattaforme">{piattaforme.map((p) => <option key={p} value={p} />)}</datalist>
            {t !== 'ricetta' && (
              <>
                <Field label="Consigliato da"><input list="persone" value={d.consigliatoDa ?? ''} onChange={(e) => up({ consigliatoDa: e.target.value || undefined })} /></Field>
                <datalist id="persone">{persone.map((p) => <option key={p} value={p} />)}</datalist>
                <Field label="Con chi"><input list="persone" value={d.conChi ?? ''} onChange={(e) => up({ conChi: e.target.value || undefined })} /></Field>
                {(IS_VIDEO(t) || t === 'gioco') && <Field label="Durata (minuti)"><input inputMode="numeric" value={d.durataMin ?? ''} onChange={(e) => up({ durataMin: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></Field>}
                <Field label="Genere"><input value={d.genere ?? ''} onChange={(e) => up({ genere: e.target.value || undefined })} /></Field>
              </>
            )}
            {t === 'ricetta' && (
              <>
                <div className="t2" style={{ marginTop: 12 }}>Genere</div>
                <div className="chips" style={{ marginBottom: 12 }}>
                  {[...TIPI_PIATTO, ...generi.filter((g) => !TIPI_PIATTO.includes(g))].map((g) => {
                    const on = generi.includes(g);
                    return <button key={g} type="button" aria-pressed={on} className={clsx('chip', on && 'on')}
                      onClick={() => up({ genere: (on ? generi.filter((x) => x !== g) : [...generi, g]).join(', ') || undefined })}>{g}</button>;
                  })}
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

        <Gruppo titolo="Note">
          <textarea className="textarea" value={d.note ?? ''} placeholder="Appunti" onChange={(e) => up({ note: e.target.value || undefined })} />
        </Gruppo>

        {d.stato === 'fatto' && (
          <Gruppo titolo="Completata">
            <div className="field"><span>Fatta il</span><span>{d.completatoIl ? formatShortYear(d.completatoIl, oggi) : '—'}</span></div>
            {d.voto !== undefined && <div className="field"><span>Voto</span><span>{d.voto} / 10</span></div>}
            {d.commento && <div className="t2" style={{ padding: '10px 0 12px', whiteSpace: 'pre-wrap' }}>{d.commento}</div>}
          </Gruppo>
        )}

        {getItem(d.id) && (
          <div className="btns col" style={{ marginTop: 18 }}>
            {d.stato === 'fatto'
              ? <button className="btn solid" onClick={() => { riapriVoce(d); nav.pop(); }}>Riapri</button>
              : t !== 'routine' && t !== 'persona' && d.stato !== 'parcheggiato' && <button className="btn solid" onClick={() => { salva(d); completaVoce(getItem(d.id) ?? d); }}>Segna come fatto</button>}
            {d.stato === 'parcheggiato'
              ? <button className="btn" onClick={() => esci({ ...d, stato: 'da_fare' }, 'Rimessa in gioco')}>Rimetti in gioco</button>
              : d.stato !== 'fatto' && <button className="btn" onClick={() => esci({ ...d, stato: 'parcheggiato' }, 'Messa da parte')}>Metti da parte</button>}
            <button className="btn danger" onClick={elimina}>Elimina</button>
          </div>
        )}
      </div>
    </>
  );
}
