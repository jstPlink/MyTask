import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { diffDays, addDays, addMonths, startOfWeek, formatShort } from './dates.ts';
import { score, daysOverdue, barLevel } from './priority.ts';
import { completa, nextOccurrence } from './recurrence.ts';
import { dueToday, toggleOggi, weekCount } from './routine.ts';
import { vistaOggi, revisione, avanzamento, listaProgetti } from './views.ts';
import { parseCapture } from './capture.ts';
import { suggerisciStasera } from './stasera.ts';

const NOW = Date.UTC(2026, 9, 15, 10, 0, 0);
const OGGI = '2026-10-15';
let n = 0;
const mk = (p: Partial<Item>): Item => ({ id: `i${++n}`, tipo: 'azione', titolo: `Voce ${n}`, stato: 'da_fare', creato: NOW, aggiornato: NOW, ...p });

test('date: differenze, mesi e settimane', () => {
  assert.equal(diffDays('2026-10-15', '2026-10-01'), 14);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(startOfWeek('2026-10-15'), '2026-10-12'); // giovedì → lunedì
  assert.equal(formatShort('2026-10-21'), '21 ott');
});

test('priorità: la scadenza rigida vale di più di quella flessibile', () => {
  const flessibile = mk({ fine: addDays(OGGI, 5), importanza: 3 });
  const rigida = mk({ fine: addDays(OGGI, 5), importanza: 3, rigida: true });
  assert.ok(score(rigida, OGGI, NOW) > score(flessibile, OGGI, NOW));
});

test('priorità: importanza alta senza data batte importanza bassa', () => {
  assert.ok(score(mk({ importanza: 5 }), OGGI, NOW) > score(mk({ importanza: 1 }), OGGI, NOW));
  assert.equal(barLevel(80), 3);
  assert.equal(barLevel(40), 2);
  assert.equal(barLevel(10), 1);
});

test('scaduta: solo se la data è passata e la voce è aperta', () => {
  assert.equal(daysOverdue(mk({ fine: '2026-10-01' }), OGGI), 14);
  assert.equal(daysOverdue(mk({ fine: '2026-10-01', stato: 'fatto' }), OGGI), 0);
  assert.equal(daysOverdue(mk({}), OGGI), 0);
});

test('ricorrenza: completare sposta la scadenza, non chiude la voce', () => {
  const i = mk({ fine: '2026-10-10', ricorrenza: { ogni: 1, unita: 'anni' } });
  const c = completa(i, OGGI, NOW);
  assert.equal(c.stato, 'da_fare');
  assert.equal(c.fine, '2027-10-10');
  assert.deepEqual(c.log, [OGGI]);
  assert.equal(nextOccurrence('2026-10-01', { ogni: 1, unita: 'settimane' }, OGGI), '2026-10-22');
  const semplice = completa(mk({}), OGGI, NOW);
  assert.equal(semplice.stato, 'fatto');
  assert.equal(semplice.completatoIl, OGGI);
});

test('routine: la quota settimanale la toglie da Oggi quando è raggiunta', () => {
  let r = mk({ tipo: 'routine', volteSettimana: 2 });
  assert.equal(dueToday(r, OGGI), true);
  r = toggleOggi(r, '2026-10-12', NOW);
  r = toggleOggi(r, '2026-10-13', NOW);
  assert.equal(weekCount(r, OGGI), 2);
  assert.equal(dueToday(r, OGGI), false);
  assert.equal(dueToday(toggleOggi(r, OGGI, NOW), OGGI), true); // fatta oggi: resta visibile, spuntata
  assert.equal(dueToday({ ...r, stato: 'parcheggiato' }, OGGI), false);
});

test('Oggi: un progetto compare con il solo prossimo passo', () => {
  const p = mk({ tipo: 'progetto', titolo: 'Progetto', importanza: 4 });
  const a = mk({ padreId: p.id, titolo: 'Passo 1' });
  const b = mk({ padreId: p.id, titolo: 'Passo 2' });
  const v = vistaOggi([p, a, b], OGGI, NOW);
  const titoli = v.fare.map((e) => e.item.titolo);
  assert.deepEqual(titoli, ['Passo 1']);
  assert.equal(v.fare[0].padre?.titolo, 'Progetto');
  assert.deepEqual(avanzamento(p, [p, a, b]), { fatti: 0, totale: 2 });
  assert.equal(listaProgetti([p, a, b], OGGI, NOW)[0].prossimo?.titolo, 'Passo 1');
});

test('Oggi: le voci scadute da molto vanno in Revisione, non in Oggi', () => {
  const vecchia = mk({ fine: '2026-02-02' });
  const ieri = mk({ fine: '2026-10-14' });
  const v = vistaOggi([vecchia, ieri], OGGI, NOW);
  assert.deepEqual(v.fare.map((e) => e.item.id), [ieri.id]);
  assert.equal(v.revisione, 1);
  assert.equal(revisione([vecchia], OGGI, NOW)[0].motivo, 'scaduta');
});

test('Oggi: prossimi 7 giorni e voci parcheggiate', () => {
  const tra3 = mk({ fine: addDays(OGGI, 3) });
  const tra20 = mk({ fine: addDays(OGGI, 20) });
  const park = mk({ stato: 'parcheggiato' });
  const v = vistaOggi([tra3, tra20, park], OGGI, NOW);
  assert.deepEqual(v.prossimi.map((e) => e.item.id), [tra3.id]);
  assert.ok(!v.fare.some((e) => e.item.id === park.id));
});

test('cattura: film consigliato su una piattaforma', () => {
  const p = parseCapture("Titolo di prova, me l'ha consigliato Mario, su Netflix");
  assert.equal(p.titolo, 'Titolo di prova');
  assert.equal(p.tipo, 'film');
  assert.equal(p.piattaforma, 'Netflix');
  assert.equal(p.consigliatoDa, 'Mario');
  assert.equal(p.sicura, true);
});

test('cattura: azione con data e tipo incerto in Inbox', () => {
  const oggi = new Date(2026, 9, 15);
  const a = parseCapture('chiamare il dentista domani', oggi);
  assert.equal(a.tipo, 'azione');
  assert.equal(a.inizio, '2026-10-16');
  const x = parseCapture('Neal.fun', oggi);
  assert.equal(x.sicura, false);
  assert.equal(x.tipo, 'curiosita');
  assert.equal(parseCapture('Museo anatomia da visitare').tipo, 'esperienza');
  assert.equal(parseCapture('Cowboy Bebop anime').tipo, 'anime');
});

test('stasera: preferisce interesse alto e rispetta la durata', () => {
  const breve = mk({ tipo: 'film', titolo: 'Film breve', interesse: 4, durataMin: 77 });
  const lungo = mk({ tipo: 'film', titolo: 'Film lungo', interesse: 4, durataMin: 180 });
  const basso = mk({ tipo: 'film', titolo: 'Film poco interessante', interesse: 1, durataMin: 100 });
  const s = suggerisciStasera([lungo, basso, breve], { durata: 'breve' });
  assert.equal(s[0].item.titolo, 'Film breve');
  const serie = mk({ tipo: 'serie', titolo: 'Serie interessante', interesse: 5 });
  assert.equal(suggerisciStasera([breve, serie], { durata: 'serie' })[0].item.titolo, 'Serie interessante');
});

test('titoli: maiuscole, accenti e apostrofi non contano', async () => {
  const { chiaveTitolo } = await import('./capture.ts');
  assert.equal(chiaveTitolo("L’Èrba  del Vicino!"), "l'erba del vicino");
  assert.equal(chiaveTitolo('Sensi  e sensibilità'), chiaveTitolo('sensi e sensibilita'));
  assert.notEqual(chiaveTitolo('Serie s1'), chiaveTitolo('Serie s2'));
});
