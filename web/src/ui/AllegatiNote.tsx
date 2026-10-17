import { useRef, useState } from 'react';
import { MAX_IMMAGINI_VOCE, pesoImmagini, riduciImmagine } from '../lib/immagini.ts';
import { mostraToast } from '../lib/toast.ts';

/** Sotto le note: pulsanti per aggiungere un link o un'immagine, con l'elenco di quelli già allegati. */
export function AllegatiNote({ link, immagini, onChange }: {
  link: string[] | undefined;
  immagini: string[] | undefined;
  onChange: (p: { link?: string[]; immagini?: string[] }) => void;
}) {
  const [inserendo, setInserendo] = useState(false);
  const [testo, setTesto] = useState('');
  const [grande, setGrande] = useState<number | undefined>();
  const file = useRef<HTMLInputElement>(null);
  const elenco = link ?? [];
  const foto = immagini ?? [];

  const aggiungiLink = () => {
    const u = testo.trim();
    if (!u) return;
    const url = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    onChange({ link: [...elenco, url] });
    setTesto('');
    setInserendo(false);
  };

  const aggiungiImmagine = async (f: File | undefined) => {
    if (!f) return;
    const url = await riduciImmagine(f);
    if (!url) { mostraToast('Non riesco a usare questa immagine'); return; }
    if (pesoImmagini(foto) + url.length > MAX_IMMAGINI_VOCE) { mostraToast('Spazio finito: togli un\'immagine per aggiungerne un\'altra'); return; }
    onChange({ immagini: [...foto, url] });
  };

  return (
    <div className="allegati">
      <div className="btns" style={{ marginTop: 6 }}>
        <button type="button" className="btn" onClick={() => setInserendo(true)}>＋ Link</button>
        <button type="button" className="btn" onClick={() => file.current?.click()}>＋ Immagine</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void aggiungiImmagine(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {inserendo && (
        <form className="field" onSubmit={(e) => { e.preventDefault(); aggiungiLink(); }}>
          <input value={testo} autoFocus inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="Incolla un link" style={{ textAlign: 'left' }} onChange={(e) => setTesto(e.target.value)} aria-label="Link da aggiungere" />
          <button type="submit" className="chip" disabled={!testo.trim()}>Aggiungi</button>
        </form>
      )}
      {elenco.map((l, i) => (
        <div key={`${l}-${i}`} className="field">
          <a href={l} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere', flex: 1 }}>{l.replace(/^https?:\/\//, '').slice(0, 60)}</a>
          <button type="button" aria-label="Togli il link" className="chip" onClick={() => onChange({ link: elenco.filter((_, j) => j !== i).length ? elenco.filter((_, j) => j !== i) : undefined })}>✕</button>
        </div>
      ))}
      {foto.length > 0 && (
        <div className="allegati-foto">
          {foto.map((src, i) => (
            <div key={i} className={grande === i ? 'allegato grande' : 'allegato'}>
              <img src={src} alt={`Immagine ${i + 1}`} onClick={() => setGrande(grande === i ? undefined : i)} />
              <button type="button" className="allegato-x" aria-label={`Togli l'immagine ${i + 1}`} onClick={() => { onChange({ immagini: foto.filter((_, j) => j !== i).length ? foto.filter((_, j) => j !== i) : undefined }); setGrande(undefined); }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
