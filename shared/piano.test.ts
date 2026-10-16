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

// ---- migrazioni di persone e checklist
import { ripristinaChecklistProgetto, segnaImportataDaRivedere, spostaInNote } from './migrazioni.ts';

test('migrazione: persone e checklist passano nelle note, ma non la checklist dei progetti', () => {
  const a = mk({ note: 'Idee', persone: ['Mario'], checklist: [{ id: 'x', testo: 'Torta', fatto: true }, { id: 'y', testo: 'Inviti', fatto: false }] });
  const r = spostaInNote(a)!;
  assert.equal(r.persone, undefined);
  assert.equal(r.checklist, undefined);
  assert.equal(r.note, 'Idee\n\nPersone: Mario\n\nChecklist:\n- [x] Torta\n- [ ] Inviti');
  const p = mk({ tipo: 'progetto', persone: ['Anna'], checklist: [{ id: 'z', testo: 'Passo', fatto: false }] });
  const rp = spostaInNote(p)!;
  assert.equal(rp.checklist?.length, 1);
  assert.equal(rp.note, 'Persone: Anna');
  assert.equal(spostaInNote(mk({})), undefined);
});

test('migrazione: la checklist di un progetto già finita nelle note torna nel campo', () => {
  let k = 0;
  const p = mk({ tipo: 'progetto', note: 'Obiettivo chiaro\n\nPersone: Anna\n\nChecklist:\n- [x] Primo\n- [ ] Secondo' });
  const r = ripristinaChecklistProgetto(p, () => `id${++k}`)!;
  assert.deepEqual(r.checklist, [{ id: 'id1', testo: 'Primo', fatto: true }, { id: 'id2', testo: 'Secondo', fatto: false }]);
  assert.equal(r.note, 'Obiettivo chiaro\n\nPersone: Anna');
  assert.equal(ripristinaChecklistProgetto(r, () => 'q'), undefined);
  assert.equal(ripristinaChecklistProgetto(mk({ note: 'Checklist:\n- [ ] a' }), () => 'q'), undefined);
});

// ---- Cosa guardo stasera: nuovi filtri
import { suggerisciStasera } from './stasera.ts';

test('stasera: tipologia, mood ed energia spostano i suggerimenti', () => {
  const comico = mk({ tipo: 'film', titolo: 'Commedia', genere: 'Comico, Sentimentale', mood: 'Spensierato', energia: 'bassa', interesse: 3 });
  const thriller = mk({ tipo: 'film', titolo: 'Thriller teso', genere: 'Thriller', mood: 'Intenso', energia: 'alta', interesse: 3 });
  const s1 = suggerisciStasera([thriller, comico], { tipologia: 'Comico' });
  assert.equal(s1[0].item.titolo, 'Commedia');
  const s2 = suggerisciStasera([thriller, comico], { energia: 'bassa', mood: 'Spensierato' });
  assert.equal(s2[0].item.titolo, 'Commedia');
  assert.ok(s2[0].motivo.includes('mood spensierato'));
  // senza filtri decide l'interesse; le voci senza dati restano neutre
  const neutro = mk({ tipo: 'film', titolo: 'Senza dati', interesse: 5 });
  assert.equal(suggerisciStasera([comico, neutro], { tipologia: 'Horror' })[0].item.titolo, 'Senza dati');
});

test('stasera: la compagnia riconosce partner e amici e non filtra per durata', () => {
  const coppia = mk({ tipo: 'serie', titolo: 'Serie in coppia', conChi: 'il mio partner', interesse: 3 });
  const altro = mk({ tipo: 'film', titolo: 'Film qualsiasi', interesse: 3 });
  assert.equal(suggerisciStasera([altro, coppia], { compagnia: 'partner' })[0].item.titolo, 'Serie in coppia');
  assert.equal(suggerisciStasera([altro, coppia], {}).length, 2);
});

test('piano: dopo un\'attività grande c\'è una pausa curiosità, poi si riparte', async () => {
  const { DURATA_PAUSA } = await import('./piano.ts');
  const grande = mk({ titolo: 'Grande', importanza: 5, sforzoMin: 90 });
  const piccola = mk({ titolo: 'Piccola', importanza: 3, sforzoMin: 30 });
  const cur = mk({ tipo: 'curiosita', titolo: 'Come funziona il GPS', interesse: 5 });
  const serata: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]) };
  const b = pianifica([grande, piccola, cur], serata, OGGI, NOW).giorni[0].blocchi;
  assert.deepEqual(b.map((x) => x.item.titolo), ['Grande', 'Come funziona il GPS', 'Piccola']);
  assert.equal(b[1].pausa, true);
  assert.equal(b[1].a - b[1].da, DURATA_PAUSA);
  assert.equal(orario(b[2].da), '19:45'); // la pausa sposta in avanti l'attività successiva
});

test('piano: niente pausa senza curiosità, con soli lavori piccoli o senza spazio', () => {
  const grande = mk({ importanza: 5, sforzoMin: 90 });
  const piccola = mk({ importanza: 3, sforzoMin: 30 });
  const cur = mk({ tipo: 'curiosita', titolo: 'Una curiosità' });
  const serata: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]) };
  assert.ok(!pianifica([grande, piccola], serata, OGGI, NOW).giorni[0].blocchi.some((x) => x.pausa));
  assert.ok(!pianifica([piccola, mk({ importanza: 2, sforzoMin: 45 }), cur], serata, OGGI, NOW).giorni[0].blocchi.some((x) => x.pausa));
  const stretta: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '19:40' }]) };
  assert.ok(!pianifica([grande, cur], stretta, OGGI, NOW).giorni[0].blocchi.some((x) => x.pausa)); // 90 min + pausa non lasciano spazio ad altro lavoro
});

test('piano: ogni curiosità serve a una sola pausa e le pause sono al massimo due al giorno', () => {
  const grandi = [1, 2, 3, 4, 5].map((n) => mk({ titolo: `G${n}`, importanza: 5, sforzoMin: 60 }));
  const curs = [1, 2, 3].map((n) => mk({ tipo: 'curiosita', titolo: `C${n}` }));
  const lunga: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '09:00', a: '19:00' }]) };
  const p = pianifica([...grandi, ...curs], lunga, OGGI, NOW);
  const pause = p.giorni.flatMap((g) => g.blocchi).filter((x) => x.pausa);
  assert.equal(new Set(pause.map((x) => x.item.id)).size, pause.length);
  for (const g of p.giorni) assert.ok(g.blocchi.filter((x) => x.pausa).length <= 2);
  assert.ok(pause.length >= 1);
});

test('migrazione: le attività importate da Notion e mai toccate vanno in Revisione, una volta sola', () => {
  const imp = mk({ id: 'n0123456789ab', creato: 5, aggiornato: 5 });
  const r = segnaImportataDaRivedere(imp)!;
  assert.equal(r.daRivedere, true);
  assert.equal(segnaImportataDaRivedere({ ...imp, aggiornato: 6 }), undefined); // già toccata
  assert.equal(segnaImportataDaRivedere({ ...imp, id: 'a1b2c3d4e5f60718' }), undefined); // creata nell'app
  assert.equal(segnaImportataDaRivedere({ ...imp, stato: 'fatto' }), undefined);
  assert.equal(segnaImportataDaRivedere({ ...imp, tipo: 'film' }), undefined);
});
