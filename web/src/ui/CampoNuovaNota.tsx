import { useMemo, useRef, useState } from 'react';
import { NOMI_TIPO } from '../../../shared/types.ts';
import { cercaSimili } from '../../../shared/views.ts';
import { useItems } from '../lib/hooks.ts';
import { nuovaVoce } from '../lib/actions.ts';
import { saveItem } from '../lib/store.ts';
import { mostraToast } from '../lib/toast.ts';
import { useNav } from './nav.tsx';

/**
 * Campo per scrivere subito una nota, in cima alla barra laterale del sito (al posto del vecchio pulsante «Nuova nota»).
 * Ha un contorno sempre visibile, che diventa più marcato mentre si scrive. Invio salva il testo così com'è come nota non
 * assegnata in Inbox (senza finestre) e mostra «Apri» per smistarla; Esc svuota il campo. Mentre si scrive compaiono sotto
 * le note che contengono le stesse parole, per accorgersi se esiste già. La scorciatoia N porta qui il cursore (`#nota-rapida`).
 */
export function CampoNuovaNota() {
  const nav = useNav();
  const items = useItems();
  const [testo, setTesto] = useState('');
  const [attivo, setAttivo] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const simili = useMemo(() => cercaSimili(items, testo), [items, testo]);
  const scrivendo = testo.trim().length > 0;

  const salva = () => {
    const titolo = testo.trim();
    if (!titolo) return;
    const item = nuovaVoce({ tipo: 'nota', titolo, inbox: true });
    saveItem(item);
    setTesto('');
    mostraToast('Salvata in Inbox', { label: 'Apri', fn: () => nav.push({ k: 'item', id: item.id }) });
  };

  return (
    <form className={`sb-nota${attivo ? ' f' : ''}`} onSubmit={(e) => { e.preventDefault(); salva(); }}>
      <input
        id="nota-rapida" ref={campo} value={testo} autoComplete="off"
        placeholder="Scrivi una nota…" aria-label="Nuova nota"
        onChange={(e) => setTesto(e.target.value)}
        onFocus={() => setAttivo(true)} onBlur={() => setAttivo(false)}
        onKeyDown={(e) => { if (e.key === 'Escape' && testo) { e.stopPropagation(); setTesto(''); } }}
      />
      <kbd aria-hidden="true">{scrivendo ? '↵' : 'N'}</kbd>
      {attivo && scrivendo && (
        <div className="sb-nota-simili" onMouseDown={(e) => e.preventDefault()}>
          <div className="t2">
            {simili.length === 0 ? 'Nessuna nota con queste parole: è nuova.' : `${simili.length} ${simili.length === 1 ? 'nota contiene' : 'note contengono'} queste parole`}
          </div>
          {simili.map((i) => (
            <button type="button" key={i.id} onClick={() => { setTesto(''); campo.current?.blur(); nav.push({ k: 'item', id: i.id }); }}>
              <b>{i.titolo}</b>
              <small>{[NOMI_TIPO[i.tipo], i.stato === 'fatto' ? 'completata' : i.stato === 'saltato' ? 'saltata' : i.stato === 'parcheggiato' ? 'archiviata' : i.inbox ? 'in Inbox' : undefined].filter(Boolean).join(' · ')}</small>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
