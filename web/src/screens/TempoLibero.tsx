import type { Disponibilita, FasciaOraria } from '../../../shared/piano.ts';
import { ORA_CHIEDI_PREDEFINITA, PAUSA_PREDEFINITA, minuti } from '../../../shared/piano.ts';
import { addDays, formatLong, today } from '../../../shared/dates.ts';
import { useDisponibilita } from '../lib/hooks.ts';
import { copiaSuggerita, impostaDisponibilita, usaSuggerita } from '../lib/disponibilita.ts';
import { useNav } from '../ui/nav.tsx';
import { Back, Sec, Seg, Top } from '../ui/kit.tsx';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const durata = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;

export function TempoLibero() {
  const disp = useDisponibilita();
  const nav = useNav();
  const oggi = today();
  const d: Disponibilita = disp ?? { settimana: Array.from({ length: 7 }, () => []) };

  const cambia = (giorno: number, fasce: FasciaOraria[]) => {
    const settimana = d.settimana.map((f, n) => (n === giorno ? fasce : f));
    impostaDisponibilita({ ...d, settimana });
  };
  const flex = !!d.flessibile;
  const inseriti = Object.entries(d.eccezioni ?? {}).filter(([g]) => g >= oggi).sort(([a], [b]) => a.localeCompare(b));
  const nomeGiorno = (g: string) => (g === oggi ? 'Oggi' : g === addDays(oggi, 1) ? 'Domani' : formatLong(g));
  const totale = d.settimana.reduce((n, g) => n + g.reduce((m, f) => m + Math.max(0, minuti(f.a) - minuti(f.da)), 0), 0);

  return (
    <>
      <Back label="Altro" />
      <Top title="Tempo libero" sub={flex ? 'Orari flessibili' : disp ? `${durata(totale)} a settimana` : 'Non ancora impostato'} />
      <div className="scroll">
        <Sec a="Come gestire il tempo libero" />
        <div className="gruppo">
          <Seg voci={[{ id: 'fissa', nome: 'Fasce fisse' }, { id: 'flessibile', nome: 'Orari flessibili' }]} attivo={flex ? 'flessibile' : 'fissa'}
            onChange={(v) => impostaDisponibilita({ ...d, flessibile: v === 'flessibile' ? true : undefined })} />
          <div className="t2" style={{ padding: '8px 0 10px' }}>
            {flex
              ? 'Ogni sera, all’ora che scegli, l’app ti chiede quando sarai libero il giorno dopo e prepara il calendario con quegli orari. Un giorno senza orari non ha tempo libero.'
              : 'Le stesse fasce valgono per ogni settimana.'}
          </div>
        </div>
        {flex && (
          <>
            <div className="gruppo">
              <div className="field">
                <span>Chiedimi gli orari alle</span>
                <input type="time" value={d.oraChiedi ?? ORA_CHIEDI_PREDEFINITA} aria-label="Ora della richiesta serale" onChange={(e) => e.target.value && impostaDisponibilita({ ...d, oraChiedi: e.target.value })} />
              </div>
              <div className="t2" style={{ padding: '2px 0 10px' }}>Serve il permesso per le notifiche. Sul sito la richiesta compare in Oggi.</div>
            </div>
            <div className="btns">
              <button className="btn" onClick={() => nav.push({ k: 'orari', giorno: oggi })}>Orari di oggi</button>
              <button className="btn solid" onClick={() => nav.push({ k: 'orari', giorno: addDays(oggi, 1) })}>Orari di domani</button>
            </div>
            <Sec a="Orari inseriti" b={inseriti.length || undefined} />
            {inseriti.length === 0 && <div className="t2" style={{ padding: '8px 0' }}>Nessun orario inserito per i prossimi giorni.</div>}
            {inseriti.map(([g, f]) => (
              <button key={g} className="field link" onClick={() => nav.push({ k: 'orari', giorno: g })}>
                <span>{nomeGiorno(g)}</span>
                <span className="t2">{f.length ? f.map((x) => `${x.da}–${x.a}`).join(', ') : 'nessun tempo libero'}</span>
              </button>
            ))}
          </>
        )}
        {!flex && (
        <div className="card">
          <div className="t1">Quando hai tempo per le attività</div>
          <div className="t2" style={{ marginTop: 4 }}>
            MyTask distribuisce le attività nei giorni in base a priorità, durata e a questo tempo libero. Le fasce valgono per ogni settimana e sono salvate su questo dispositivo.
          </div>
          <div className="btns">
            {!disp
              ? <button className="btn solid" onClick={usaSuggerita}>Usa le fasce suggerite</button>
              : <button className="btn" onClick={() => impostaDisponibilita(copiaSuggerita())}>Ripristina quelle suggerite</button>}
          </div>
        </div>
        )}
        <Sec a="Pausa tra le attività" />
        <div className="gruppo">
          <div className="field">
            <span>Pausa dopo ogni attività</span>
            <select value={d.pausaMin ?? PAUSA_PREDEFINITA} disabled={!disp} aria-label="Pausa tra le attività"
              onChange={(e) => impostaDisponibilita({ ...d, pausaMin: Number(e.target.value) })}>
              {[...new Set([0, 5, 10, 15, 20, 30, 45, 60, d.pausaMin ?? PAUSA_PREDEFINITA])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m === 0 ? 'Nessuna' : `${m} min`}</option>)}
            </select>
          </div>
          <div className="t2" style={{ padding: '2px 0 10px' }}>{disp ? `Di base ${PAUSA_PREDEFINITA} minuti: il piano lascia questo tempo tra un'attività e la successiva.` : 'Imposta prima le fasce di tempo libero.'}</div>
        </div>
        {!flex && <Sec a="Fasce per giorno" />}
        {!flex && GIORNI.map((nome, g) => (
          <div key={nome} className="tl-giorno">
            <div className="tl-nome">{nome}</div>
            <div className="tl-fasce">
              {d.settimana[g].length === 0 && <span className="t2">Nessun tempo libero</span>}
              {d.settimana[g].map((f, n) => (
                <div key={n} className="tl-fascia">
                  <input type="time" value={f.da} aria-label={`${nome}, inizio fascia ${n + 1}`} onChange={(e) => e.target.value && cambia(g, d.settimana[g].map((x, k) => (k === n ? { ...x, da: e.target.value } : x)))} />
                  <span aria-hidden="true">–</span>
                  <input type="time" value={f.a} aria-label={`${nome}, fine fascia ${n + 1}`} onChange={(e) => e.target.value && cambia(g, d.settimana[g].map((x, k) => (k === n ? { ...x, a: e.target.value } : x)))} />
                  <button className="tl-x" aria-label={`Togli la fascia ${n + 1} di ${nome}`} onClick={() => cambia(g, d.settimana[g].filter((_, k) => k !== n))}>×</button>
                </div>
              ))}
              <button className="tl-add" onClick={() => cambia(g, [...d.settimana[g], d.settimana[g].length ? { da: d.settimana[g][d.settimana[g].length - 1].a, a: '22:00' } : { da: '18:00', a: '21:00' }])}>+ Aggiungi fascia</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
