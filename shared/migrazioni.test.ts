import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { checklistInPassi, eliminaPersone } from './migrazioni.ts';

const mk = (p: Partial<Item>): Item => ({ id: 'x', tipo: 'azione', titolo: 'T', stato: 'da_fare', creato: 1, aggiornato: 1, ...p });

test('migrazioni: le note di tipo persona vengono eliminate, le altre restano', () => {
  assert.equal(eliminaPersone(mk({ tipo: 'persona' }))?.eliminato, true);
  assert.equal(eliminaPersone(mk({ tipo: 'persona', eliminato: true })), undefined, 'già eliminata');
  assert.equal(eliminaPersone(mk({ tipo: 'azione' })), undefined);
  assert.equal(eliminaPersone(mk({ tipo: 'film' })), undefined);
});

test('migrazioni: le righe della checklist di un progetto diventano passi veri, prima dei passi esistenti', () => {
  const progetto: Item = { id: 'p', tipo: 'progetto', titolo: 'Annales', stato: 'da_fare', creato: 1, aggiornato: 1, checklist: [{ id: 'c1', testo: 'Trascrivere 2026', fatto: false }, { id: 'c2', testo: 'Rileggere', fatto: true }] };
  const esistente: Item = { id: 'e', tipo: 'azione', titolo: 'Già un passo', stato: 'da_fare', creato: 2, aggiornato: 2, padreId: 'p', ordine: 0 };
  let n = 0;
  const r = checklistInPassi(progetto, [progetto, esistente], () => `n${++n}`, '2026-10-24', 1000)!;
  const prog = r.find((x) => x.id === 'p')!;
  assert.equal(prog.checklist, undefined, 'il progetto non ha più la checklist');
  const nuovi = r.filter((x) => x.id.startsWith('n'));
  assert.deepEqual(nuovi.map((x) => [x.titolo, x.tipo, x.padreId, x.ordine, x.stato]), [['Trascrivere 2026', 'azione', 'p', 0, 'da_fare'], ['Rileggere', 'azione', 'p', 1, 'fatto']]);
  assert.equal(nuovi[1].completatoIl, '2026-10-24', 'la riga spuntata è un passo fatto');
  assert.equal(r.find((x) => x.id === 'e')!.ordine, 2, 'il passo già presente va dopo le righe convertite');
  // senza checklist non c'è niente da fare (la conversione non si ripete)
  assert.equal(checklistInPassi({ ...progetto, checklist: undefined }, [progetto], () => 'x', '2026-10-24', 1000), undefined);
  assert.equal(checklistInPassi({ ...esistente, checklist: [{ id: 'c', testo: 'x', fatto: false }] }, [esistente], () => 'x', '2026-10-24', 1000), undefined, 'solo i progetti');
});
