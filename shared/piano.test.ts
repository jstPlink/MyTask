import test from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { DISPONIBILITA_SUGGERITA, minuti, orario, pianifica, type Disponibilita } from './piano.ts';

// giovedì 15 ottobre 2026, ore 10:00
const NOW = new Date(2026, 9, 15, 10, 0, 0).getTime();
const OGGI = '2026-10-15';
let n = 0;
const mk = (p: Partial<Item>): Item => ({ id: `p${++n}`, tipo: 'azione', titolo: `Voce ${n}`, stato: 'da_fare', creato: NOW, aggiornato: NOW, ...p });
const sera: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '20:00' }]) };

test('piano: ordine per priorità dentro la fascia, in sequenza', () => {
  const a = mk({ titolo: 'Poco importante', importanza: 1, sforzoMin: 30 });
  const b = mk({ titolo: 'Importante', importanza: 5, sforzoMin: 45 });
  const p = pianifica([a, b], sera, OGGI, NOW);
  const oggi = p.giorni[0].blocchi;
  assert.equal(oggi.length, 2);
  assert.equal(oggi[0].item.titolo, 'Importante');
  assert.equal(orario(oggi[0].da), '18:00');
  assert.equal(orario(oggi[0].a), '18:45');
  assert.equal(orario(oggi[1].da), '18:45');
  assert.equal(p.giorni[0].usati, 75);
  assert.equal(p.giorni[0].liberi, 45);
});

test('piano: i meno prioritari che non entrano passano al giorno dopo', () => {
  const grande = mk({ importanza: 5, sforzoMin: 90 });
  const medio = mk({ importanza: 4, sforzoMin: 45 });
  const p = pianifica([grande, medio], sera, OGGI, NOW);
  assert.equal(p.giorni[0].blocchi.length, 1);
  assert.equal(p.giorni[1].blocchi.length, 1);
  assert.equal(p.giorni[1].blocchi[0].item.id, medio.id);
});

test('piano: un task lungo si spezza su più giorni', () => {
  const lungo = mk({ importanza: 5, sforzoMin: 240 });
  const p = pianifica([lungo], sera, OGGI, NOW);
  const parti = p.giorni.flatMap((g) => g.blocchi);
  assert.equal(parti.length, 2);
  assert.deepEqual(parti.map((b) => b.parte), [{ n: 1, di: 2 }, { n: 2, di: 2 }]);
  assert.equal(parti.reduce((s, b) => s + (b.a - b.da), 0), 240);
});

test('piano: i task brevi non si spezzano', () => {
  const quasi = mk({ importanza: 5, sforzoMin: 90 });
  const breve = mk({ importanza: 2, sforzoMin: 45 });
  const stretta: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '19:00' }]) };
  const p = pianifica([breve], stretta, OGGI, NOW);
  assert.equal(p.giorni[0].blocchi[0].parte, undefined);
  assert.ok(quasi);
});

test('piano: oggi si parte dall\'ora attuale', () => {
  const tardi = new Date(2026, 9, 15, 18, 22, 0).getTime();
  const p = pianifica([mk({ sforzoMin: 30 })], sera, OGGI, tardi);
  assert.equal(orario(p.giorni[0].blocchi[0].da), '18:25');
});

test('piano: gli impegni con orario restano fermi e tolgono tempo', () => {
  const fisso = mk({ inizio: OGGI, oraInizio: '18:30', oraFine: '19:00', importanza: 3 });
  const altro = mk({ importanza: 5, sforzoMin: 30 });
  const p = pianifica([fisso, altro], sera, OGGI, NOW);
  const oggi = p.giorni[0].blocchi;
  assert.equal(oggi.find((b) => b.fisso)?.item.id, fisso.id);
  assert.equal(orario(oggi.find((b) => !b.fisso)!.da), '18:00');
  assert.equal(p.giorni[0].liberi, 60);
});

test('piano: segnala se finisce dopo la scadenza', () => {
  const piena: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '18:30' }]) };
  const a = mk({ importanza: 5, sforzoMin: 30, fine: OGGI });
  const b = mk({ importanza: 4, sforzoMin: 30, fine: OGGI });
  const p = pianifica([a, b], piena, OGGI, NOW);
  const ritardo = p.giorni.flatMap((g) => g.blocchi).filter((x) => x.inRitardo);
  assert.equal(ritardo.length, 1);
});

test('piano: senza fasce non pianifica nulla e usa i valori suggeriti', () => {
  const vuota: Disponibilita = { settimana: Array.from({ length: 7 }, () => []) };
  const p = pianifica([mk({})], vuota, OGGI, NOW);
  assert.equal(p.fuori.length, 1);
  const q = pianifica([mk({})], DISPONIBILITA_SUGGERITA, OGGI, NOW);
  assert.equal(q.fuori.length, 0);
  assert.equal(minuti('09:30'), 570);
});
