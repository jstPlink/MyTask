import test from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { archivioWidget, lavoroWidget, righeWidget } from './widget.ts';

const NOW = new Date(2026, 9, 15, 10, 0, 0).getTime();
const OGGI = '2026-10-15';
let n = 0;
const mk = (p: Partial<Item>): Item => ({ id: `w${++n}`, tipo: 'azione', titolo: `Voce ${n}`, stato: 'da_fare', creato: NOW, aggiornato: NOW, ...p });

test('widget: righe nell\'ordine di priorità, con posizione e tempo già lavorato', () => {
  const a = mk({ titolo: 'Importante', importanza: 5, sforzoMin: 30, fine: OGGI, lavoratoMs: 120_000 });
  const b = mk({ titolo: 'Meno', importanza: 2, sforzoMin: 30, fine: OGGI });
  const r = righeWidget([b, a], OGGI);
  assert.equal(r.length, 2);
  assert.equal(r[0].t, 'Importante');
  assert.equal(r[0].r, 1);
  assert.equal(r[0].w, 120_000);
  assert.equal(r[1].r, 2);
  assert.equal(r[1].w, undefined);
});

test('widget: la sessione «Sto lavorando» mostra il task, il tempo accumulato e l\'inizio del tratto', () => {
  const a = mk({ titolo: 'Garage', lavoratoMs: 60_000 });
  assert.deepEqual(lavoroWidget([a], { stato: 'lavoro', taskId: a.id, inizio: 5000, aggiornato: 1 }), { stato: 'lavoro', id: a.id, t: 'Garage', base: 60_000, ref: 5000 });
  assert.equal(lavoroWidget([a], { stato: 'pausa', taskId: a.id, aggiornato: 1 })?.stato, 'pausa');
  assert.equal(lavoroWidget([a], { stato: 'ferma', aggiornato: 1 }), null);
  assert.equal(lavoroWidget([], { stato: 'lavoro', taskId: 'x', inizio: 1, aggiornato: 1 }), null, 'task sparito');
});

test('widget: archivio compatto con testo di ricerca normalizzato, senza contatti ed eliminate', () => {
  const a = mk({ titolo: "Chiamare l'idraulico", note: 'Perdita nel Bagno' });
  const p = mk({ tipo: 'persona', titolo: 'Marco' });
  const e = mk({ titolo: 'Vecchia', eliminato: true });
  const arch = archivioWidget([a, p, e]);
  assert.equal(arch.length, 1);
  assert.equal(arch[0].c, 0);
  assert.ok(arch[0].k.includes('perdita nel bagno'));
  assert.equal(archivioWidget([mk({ stato: 'fatto' })])[0].c, 1);
});
