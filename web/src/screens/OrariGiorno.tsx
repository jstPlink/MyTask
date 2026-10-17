import { useState } from 'react';
import type { FasciaOraria } from '../../../shared/piano.ts';
import { minuti } from '../../../shared/piano.ts';
import { addDays, formatLong, today } from '../../../shared/dates.ts';
import { getDisponibilita, impostaOrariGiorno } from '../lib/disponibilita.ts';
import { mostraToast } from '../lib/toast.ts';
import { useNav } from '../ui/nav.tsx';
import { Back, Top } from '../ui/kit.tsx';

const PRESET: { nome: string; f: FasciaOraria }[] = [
  { nome: 'Mattina', f: { da: '09:00', a: '13:00' } },
  { nome: 'Pomeriggio', f: { da: '14:00', a: '18:00' } },
  { nome: 'Sera', f: { da: '18:00', a: '21:00' } },
];
const durata = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;

/** Modalità flessibile: si inseriscono gli orari in cui si è liberi in un giorno (di solito domani) e MyTask prepara il calendario. */
export function OrariGiorno({ giorno }: { giorno: string }) {
  const nav = useNav();
  const oggi = today();
  const [fasce, setFasce] = useState<FasciaOraria[]>(() => getDisponibilita()?.eccezioni?.[giorno] ?? []);
  const nome = giorno === addDays(oggi, 1) ? 'domani' : giorno === oggi ? 'oggi' : formatLong(giorno).toLowerCase();
  const totale = fasce.reduce((n, f) => n + Math.max(0, minuti(f.a) - minuti(f.da)), 0);
  const valide = fasce.every((f) => minuti(f.a) > minuti(f.da));

  const salva = (lista: FasciaOraria[]) => {
    impostaOrariGiorno(giorno, lista, oggi);
    mostraToast(lista.length ? `Calendario di ${nome} preparato` : `Nessun tempo libero ${nome}`);
    nav.pop();
  };
  const cambia = (n: number, p: Partial<FasciaOraria>) => setFasce(fasce.map((f, k) => (k === n ? { ...f, ...p } : f)));

  return (
    <>
      <Back label="Indietro" />
      <Top title={`Quando sei libero ${nome}?`} sub={formatLong(giorno)} />
      <div className="scroll">
        <div className="card">
          <div className="t2">Inserisci gli orari in cui avrai tempo: MyTask prepara il calendario con le attività in ordine di priorità.</div>
        </div>
        <div className="chips" style={{ margin: '12px 0' }}>
          {PRESET.map((p) => <button key={p.nome} className="chip" onClick={() => setFasce([...fasce, p.f])}>+ {p.nome} {p.f.da}–{p.f.a}</button>)}
        </div>
        <div className="tl-giorno">
          <div className="tl-nome">{nome[0].toUpperCase() + nome.slice(1)}</div>
          <div className="tl-fasce">
            {fasce.length === 0 && <span className="t2">Nessuna fascia: aggiungine una o usa i pulsanti qui sopra</span>}
            {fasce.map((f, n) => (
              <div key={n} className="tl-fascia">
                <input type="time" value={f.da} aria-label={`Inizio fascia ${n + 1}`} onChange={(e) => e.target.value && cambia(n, { da: e.target.value })} />
                <span aria-hidden="true">–</span>
                <input type="time" value={f.a} aria-label={`Fine fascia ${n + 1}`} onChange={(e) => e.target.value && cambia(n, { a: e.target.value })} />
                <button className="tl-x" aria-label={`Togli la fascia ${n + 1}`} onClick={() => setFasce(fasce.filter((_, k) => k !== n))}>×</button>
              </div>
            ))}
            <button className="tl-add" onClick={() => setFasce([...fasce, fasce.length ? { da: fasce[fasce.length - 1].a, a: '22:00' } : { da: '18:00', a: '21:00' }])}>+ Aggiungi fascia</button>
          </div>
        </div>
        {fasce.length > 0 && <div className="t2" style={{ padding: '4px 0 0' }}>{valide ? `${durata(totale)} di tempo libero` : 'Controlla gli orari: la fine deve essere dopo l’inizio.'}</div>}
        <div className="btns tre" style={{ marginTop: 18 }}>
          <button className="btn" onClick={() => salva([])}>Nessun tempo libero</button>
          <button className="btn solid" disabled={!fasce.length || !valide} onClick={() => salva(fasce)}>Prepara il calendario</button>
        </div>
      </div>
    </>
  );
}
