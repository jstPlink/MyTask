import { INTERVALLO_CONTROLLO_MS, formatoCronometro } from '../../../shared/sessione.ts';
import { useAdesso, useItems, useSessione } from '../lib/hooks.ts';
import { confermaControllo, finisciSessione, scadenzaControllo, smessoMinutiFa, tempoDi } from '../lib/sessione.ts';

/**
 * Controllo periodico della sessione di lavoro: se il cronometro corre da `INTERVALLO_CONTROLLO_MS` (45 minuti) senza
 * conferme, compare «Stai ancora lavorando?». Si risponde «Sì», «Ho smesso N minuti fa» (il tempo conta solo fino a quel
 * momento e la sessione va in pausa) o «Ho finito di lavorare». Serve a non perdere la misura se ci si dimentica di fermarlo.
 */
export function ControlloSessione() {
  const s = useSessione();
  const items = useItems();
  const adesso = useAdesso(s.stato === 'lavoro');
  const scadenza = scadenzaControllo(s);
  if (s.stato !== 'lavoro' || scadenza === undefined || adesso < scadenza) return null;
  const task = items.find((i) => i.id === s.taskId);
  return (
    <>
      <div className="dim" />
      <div className="sheet" role="alertdialog" aria-label="Stai ancora lavorando?">
        <div className="grip" />
        <div className="t1" style={{ fontSize: 18, fontWeight: 800 }}>Stai ancora lavorando?</div>
        <div className="t2" style={{ margin: '4px 0 14px' }}>
          «{task?.titolo ?? 'Attività'}» · {formatoCronometro(task ? tempoDi(task, adesso) : 0)} · nessuna conferma da {Math.round(INTERVALLO_CONTROLLO_MS / 60000)} minuti
        </div>
        <div className="btns" style={{ flexDirection: 'column' }}>
          <button className="btn solid" onClick={() => confermaControllo()}>Sì, sto ancora lavorando</button>
          <button className="btn" onClick={() => smessoMinutiFa(15)}>Ho smesso 15 minuti fa</button>
          <button className="btn" onClick={() => smessoMinutiFa(30)}>Ho smesso 30 minuti fa</button>
          <button className="btn" onClick={() => smessoMinutiFa(60)}>Ho smesso un'ora fa</button>
          <button className="btn" onClick={() => finisciSessione()}>Ho finito di lavorare</button>
        </div>
      </div>
    </>
  );
}
