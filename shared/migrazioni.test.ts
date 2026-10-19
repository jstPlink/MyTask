import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { eliminaPersone } from './migrazioni.ts';

const mk = (p: Partial<Item>): Item => ({ id: 'x', tipo: 'azione', titolo: 'T', stato: 'da_fare', creato: 1, aggiornato: 1, ...p });

test('migrazioni: le note di tipo persona vengono eliminate, le altre restano', () => {
  assert.equal(eliminaPersone(mk({ tipo: 'persona' }))?.eliminato, true);
  assert.equal(eliminaPersone(mk({ tipo: 'persona', eliminato: true })), undefined, 'già eliminata');
  assert.equal(eliminaPersone(mk({ tipo: 'azione' })), undefined);
  assert.equal(eliminaPersone(mk({ tipo: 'film' })), undefined);
});
