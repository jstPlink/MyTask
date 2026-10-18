import test from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import type { Disponibilita } from './piano.ts';
import { archivioWidget, righeWidget } from './widget.ts';

const NOW = new Date(2026, 9, 15, 10, 0, 0).getTime();
const OGGI = '2026-10-15';
let n = 0;
const mk = (p: Partial<Item>): Item => ({ id: `w${++n}`, tipo: 'azione', titolo: `Voce ${n}`, stato: 'da_fare', creato: NOW, aggiornato: NOW, ...p });
const sera: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]), pausaMin: 0 };

test('widget: righe nell\'ordine del piano, con orario e posizione', () => {
  const a = mk({ titolo: 'Importante', importanza: 5, sforzoMin: 30, fine: OGGI });
  const b = mk({ titolo: 'Meno', importanza: 2, sforzoMin: 30, fine: OGGI });
  const r = righeWidget([b, a], sera, OGGI, NOW, 0);
  assert.equal(r.length, 2);
  assert.equal(r[0].t, 'Importante');
  assert.equal(r[0].o, '18:00');
  assert.equal(r[0].r, 1);
  assert.equal(r[1].r, 2);
});

test('widget: senza tempo libero è la lista semplice di Oggi, senza orari', () => {
  const a = mk({ titolo: 'Scade oggi', importanza: 4, fine: OGGI });
  const r = righeWidget([a], null, OGGI, NOW, 0);
  assert.equal(r.length, 1);
  assert.equal(r[0].o, undefined);
  assert.equal(r[0].r, 1);
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
