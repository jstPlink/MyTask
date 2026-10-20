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

test('widget: un task «in corso» è segnalato per la casella mezza gialla', () => {
  const a = mk({ titolo: 'Iniziata', importanza: 5, fine: OGGI, stato: 'in_corso' });
  const b = mk({ titolo: 'Da fare', importanza: 2, fine: OGGI });
  const r = righeWidget([a, b], OGGI);
  assert.equal(r.find((x) => x.t === 'Iniziata')?.c, 1);
  assert.equal(r.find((x) => x.t === 'Da fare')?.c, undefined);
});

test('widget: dopo le attività ci sono le curiosità, senza posizione, con la stima', () => {
  const a = mk({ titolo: 'Attività', importanza: 5, fine: OGGI, sforzoMin: 80 });
  const cs = Array.from({ length: 6 }, (_, i) => mk({ tipo: 'curiosita', titolo: `Curiosità ${i}`, interesse: 5 - (i % 3) as 3 | 4 | 5, sforzoMin: i === 0 ? 25 : undefined }));
  const r = righeWidget([a, ...cs], OGGI);
  assert.equal(r[0].t, 'Attività');
  assert.equal(r[0].p, 80);
  assert.equal(r[0].k, undefined);
  const c = r.filter((x) => x.k === 'c');
  assert.equal(c.length, 5, 'tutte e cinque le curiosità, nessuna tagliata');
  assert.ok(c.every((x) => x.r === undefined));
  assert.ok(c.every((x) => x.i !== undefined && x.i >= 1 && x.i <= 5), 'ogni curiosità ha il suo interesse per il pallino');
  assert.equal(r.indexOf(c[0]), 1, 'le curiosità vengono dopo le attività');
});

test('widget: la sessione «Inizia» mostra il task, il tempo accumulato e l\'inizio del tratto', () => {
  const a = mk({ titolo: 'Garage', lavoratoMs: 60_000, sforzoMin: 80 });
  assert.deepEqual(lavoroWidget([a], { stato: 'lavoro', taskId: a.id, inizio: 5000, aggiornato: 1 }), { stato: 'lavoro', id: a.id, t: 'Garage', base: 60_000, ref: 5000, p: 80 });
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
