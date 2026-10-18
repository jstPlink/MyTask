import test from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { DISPONIBILITA_SUGGERITA, fasceDelGiorno, minutiDisponibili, minuti, orario, pianifica, senzaGiorniPassati, type Disponibilita } from './piano.ts';
import { richiesteOrari } from './pianifica.ts';
import { classificaPriorita, listaAzioni, posizionePriorita, punteggioEffettivo } from './views.ts';
import { impostaPesi, normalizzaPesi, PESI_PREDEFINITI, score } from './priority.ts';

// giovedì 15 ottobre 2026, ore 10:00
const NOW = new Date(2026, 9, 15, 10, 0, 0).getTime();
const OGGI = '2026-10-15';
let n = 0;
const mk = (p: Partial<Item>): Item => ({ id: `p${++n}`, tipo: 'azione', titolo: `Voce ${n}`, stato: 'da_fare', creato: NOW, aggiornato: NOW, ...p });
const sera: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '20:00' }]), pausaMin: 0 };

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
  const serata: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]), pausaMin: 0 };
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

test('piano: tra un\'attività e la successiva c\'è la pausa (5 minuti di base, regolabile)', () => {
  const a = mk({ titolo: 'Prima', importanza: 5, sforzoMin: 30 });
  const b = mk({ titolo: 'Seconda', importanza: 3, sforzoMin: 30 });
  const base: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '20:00' }]) };
  const x = pianifica([a, b], base, OGGI, NOW).giorni[0].blocchi;
  assert.equal(orario(x[0].a), '18:30');
  assert.equal(orario(x[1].da), '18:35'); // 5 minuti di pausa
  const y = pianifica([a, b], { ...base, pausaMin: 15 }, OGGI, NOW).giorni[0].blocchi;
  assert.equal(orario(y[1].da), '18:45');
  const z = pianifica([a, b], { ...base, pausaMin: 0 }, OGGI, NOW).giorni[0].blocchi;
  assert.equal(orario(z[1].da), '18:30');
});

// ---- stima del tempo scritta a mano
import { leggiDurata, scomponi, scriviDurata } from './tempo.ts';

test('tempo: legge minuti, ore e giorni scritti a mano', () => {
  const m = (t: string) => { const r = leggiDurata(t); return r.ok ? r.minuti : 'errore'; };
  assert.equal(m('45m'), 45);
  assert.equal(m('6h'), 360);
  assert.equal(m('4d'), 5760);
  assert.equal(m('4g'), 5760);
  assert.equal(m('5g 6h'), 5 * 1440 + 360);
  assert.equal(m('1h30'), 90);
  assert.equal(m('1h 30m'), 90);
  assert.equal(m('1:30'), 90);
  assert.equal(m('1,5h'), 90);
  assert.equal(m('90'), 90);
  assert.equal(m('2 ore'), 120);
  assert.equal(m('1 giorno 2 ore 15 min'), 1440 + 120 + 15);
  assert.equal(m(''), undefined);
  assert.equal(m('abc'), 'errore');
  assert.equal(m('5 6h'), 'errore');
  assert.equal(m('0'), 'errore');
  assert.equal(m('3x'), 'errore');
});

test('tempo: scrive e scompone le durate', () => {
  assert.equal(scriviDurata(45), '45m');
  assert.equal(scriviDurata(390), '6h 30m');
  assert.equal(scriviDurata(1440), '1g');
  assert.equal(scriviDurata(7500), '5g 5h');
  assert.equal(scriviDurata(undefined), '');
  assert.deepEqual(scomponi(1440 + 135), { g: 1, h: 2, m: 15 });
  const r = leggiDurata(scriviDurata(8123));
  assert.ok(r.ok && r.minuti === 8123);
});

// ---- indirizzo del server al login
import { componiIndirizzo, indirizzoValido, separaIndirizzo } from './indirizzo.ts';

test('indirizzo: separa lo schema e ricompone', () => {
  assert.deepEqual(separaIndirizzo('https://mytask.fplinio.it/'), { schema: 'https', resto: 'mytask.fplinio.it' });
  assert.deepEqual(separaIndirizzo('HTTP://192.168.1.5:8787'), { schema: 'http', resto: '192.168.1.5:8787' });
  assert.deepEqual(separaIndirizzo('mytask.fplinio.it'), { schema: 'https', resto: 'mytask.fplinio.it' });
  assert.deepEqual(separaIndirizzo('mytask.fplinio.it', 'http'), { schema: 'http', resto: 'mytask.fplinio.it' });
  assert.equal(componiIndirizzo('https', 'mytask.fplinio.it'), 'https://mytask.fplinio.it');
  assert.equal(componiIndirizzo('http', 'https://altro.it/'), 'https://altro.it');
  assert.ok(indirizzoValido('mytask.fplinio.it') && indirizzoValido('192.168.1.5:8787') && indirizzoValido('localhost:5173'));
  assert.ok(!indirizzoValido('') && !indirizzoValido('mytask') && !indirizzoValido('ciao come va'));
});

// ---- ordine dei passi di un progetto e ora di completamento
import { figli, prossimoPasso } from './views.ts';
import { completa, riapri } from './recurrence.ts';

test('progetto: l\'ordine scelto decide il prossimo passo', () => {
  const prog = mk({ tipo: 'progetto', titolo: 'Progetto' });
  const a = mk({ padreId: prog.id, titolo: 'A', ordine: 2 });
  const b = mk({ padreId: prog.id, titolo: 'B', ordine: 0 });
  const c = mk({ padreId: prog.id, titolo: 'C', ordine: 1 });
  const nuovo = mk({ padreId: prog.id, titolo: 'Nuovo senza ordine', creato: NOW + 5000 });
  assert.deepEqual(figli([prog, a, b, c, nuovo], prog.id).map((x) => x.titolo), ['B', 'C', 'A', 'Nuovo senza ordine']);
  assert.equal(prossimoPasso(prog, [prog, a, b, c, nuovo])?.titolo, 'B');
  // chiuso il primo, il prossimo è il secondo in ordine
  assert.equal(prossimoPasso(prog, [prog, a, { ...b, stato: 'fatto' }, c, nuovo])?.titolo, 'C');
});

test('completamento: si salva anche l\'ora e riaprendo si toglie', () => {
  const x = mk({});
  const fatta = completa(x, OGGI, NOW + 123456);
  assert.equal(fatta.completatoTs, NOW + 123456);
  assert.equal(fatta.completatoIl, OGGI);
  const riaperta = riapri(fatta, NOW + 200000);
  assert.equal(riaperta.completatoTs, undefined);
  assert.equal(riaperta.completatoIl, undefined);
});

// ---- formato di data/ora e tempo trascorso
import { scriviQuando, scriviTrascorso } from './tempo.ts';

test('cronologia: data e ora e tempo trascorso', () => {
  const t = new Date(2026, 9, 16, 14, 32).getTime(); // venerdì 16 ottobre 2026, 14:32
  assert.equal(scriviQuando(t), 'ven 16 ott · 14:32');
  assert.equal(scriviQuando(t, true), 'ven 16 ott');
  assert.equal(scriviTrascorso(12 * 60000), '12 min');
  assert.equal(scriviTrascorso((18 * 60 + 38) * 60000), '18 h 38 min');
  assert.equal(scriviTrascorso(3 * 3600000), '3 h');
  assert.equal(scriviTrascorso((2 * 1440 + 3 * 60 + 10) * 60000), '2 g 3 h');
  assert.equal(scriviTrascorso(20000), 'meno di un minuto');
});

// ---- numeri sotto la barra del piano
import { sistemaNumeri } from './linea.ts';

test('linea del piano: i numeri restano dentro la barra e nell\'ordine, anche se sono tanti', () => {
  const L = 325;
  // pochi: restano sotto il loro segmento
  const poche = sistemaNumeri([60, 160, 260], L);
  assert.deepEqual(poche.px, [60, 160, 260]);
  assert.equal(poche.diametro, 24);
  // tanti e vicini: si spostano ma restano dentro [r, L-r]
  const vicini = sistemaNumeri(Array.from({ length: 10 }, (_, i) => 150 + i * 3), L);
  for (let i = 1; i < vicini.px.length; i++) assert.ok(vicini.px[i] - vicini.px[i - 1] >= vicini.diametro, 'non si toccano');
  assert.ok(vicini.px[0] >= vicini.diametro / 2 && vicini.px[9] <= L - vicini.diametro / 2);
  // venti numeri tutti ammassati a destra (il caso rotto): dentro la barra, cerchi più piccoli
  const molti = sistemaNumeri(Array.from({ length: 20 }, (_, i) => 300 + i), L);
  assert.ok(molti.diametro < 24 && molti.diametro >= 12);
  assert.ok(molti.px.every((x) => x >= molti.diametro / 2 - 0.001 && x <= L - molti.diametro / 2 + 0.001), 'tutti dentro');
  assert.ok(molti.px.every((x, i) => i === 0 || x >= molti.px[i - 1]), 'ordine mantenuto');
  // cinquanta numeri: sempre dentro, anche sovrapposti
  const troppi = sistemaNumeri(Array.from({ length: 50 }, (_, i) => i * 6), L);
  assert.ok(troppi.px.every((x) => x >= 0 && x <= L));
  assert.deepEqual(sistemaNumeri([], L).px, []);
});

test('piano: in modalità flessibile contano solo gli orari inseriti per il giorno', () => {
  const a = mk({ importanza: 5, sforzoMin: 30 });
  const flex: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]), flessibile: true, pausaMin: 0 };
  assert.equal(fasceDelGiorno(flex, OGGI).length, 0);
  assert.equal(pianifica([a], flex, OGGI, NOW).giorni[0].blocchi.length, 0);
  const conOrari: Disponibilita = { ...flex, eccezioni: { [OGGI]: [{ da: '14:00', a: '15:00' }] } };
  const b = pianifica([a], conOrari, OGGI, NOW).giorni[0].blocchi;
  assert.equal(b.length, 1);
  assert.equal(orario(b[0].da), '14:00');
  // un giorno senza orari resta senza tempo libero, anche se in modalità fissa avrebbe le fasce della settimana
  assert.equal(minutiDisponibili(conOrari, '2026-10-16', OGGI, NOW), 0);
  assert.ok(minutiDisponibili({ ...flex, flessibile: false }, '2026-10-16', OGGI, NOW) > 0);
});

test('piano: senzaGiorniPassati toglie i giorni vecchi', () => {
  const r = senzaGiorniPassati({ '2026-10-10': [], '2026-10-15': [{ da: '10:00', a: '11:00' }], '2026-10-16': [] }, OGGI);
  assert.deepEqual(Object.keys(r ?? {}), ['2026-10-15', '2026-10-16']);
  assert.equal(senzaGiorniPassati({ '2026-10-01': [] }, OGGI), undefined);
});

test("notifiche: la richiesta serale degli orari c'è solo in modalità flessibile e salta i giorni già inseriti", () => {
  const flex: Disponibilita = { settimana: Array.from({ length: 7 }, () => []), flessibile: true, oraChiedi: '21:30' };
  assert.equal(richiesteOrari({ ...flex, flessibile: false }, new Date(NOW)).length, 0);
  assert.equal(richiesteOrari(null, new Date(NOW)).length, 0);
  const r = richiesteOrari(flex, new Date(NOW), 3);
  assert.equal(r.length, 3);
  assert.equal(r[0].giorno, '2026-10-16');
  assert.equal(new Date(r[0].quando).getHours(), 21);
  assert.equal(new Date(r[0].quando).getMinutes(), 30);
  const gia = richiesteOrari({ ...flex, eccezioni: { '2026-10-16': [] } }, new Date(NOW), 3);
  assert.deepEqual(gia.map((x) => x.giorno), ['2026-10-17', '2026-10-18']);
  // dopo l'ora scelta la richiesta di stasera è già passata
  const tardi = richiesteOrari(flex, new Date(2026, 9, 15, 22, 0), 2);
  assert.deepEqual(tardi.map((x) => x.giorno), ['2026-10-17']);
});

test('piano: una nota in corso resta dove era, anche se arrivano note più urgenti', () => {
  const a = mk({ titolo: 'Iniziata', importanza: 1, sforzoMin: 30, stato: 'in_corso', pianoData: OGGI, pianoDa: minuti('19:00') });
  const b = mk({ titolo: 'Urgente', importanza: 5, sforzoMin: 30 });
  const g = pianifica([a, b], { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]), pausaMin: 0 }, OGGI, NOW).giorni[0];
  const ba = g.blocchi.find((x) => x.item.id === a.id)!;
  const bb = g.blocchi.find((x) => x.item.id === b.id)!;
  assert.equal(orario(ba.da), '19:00');
  assert.equal(orario(bb.da), '18:00');
  assert.ok(bb.a <= ba.da, 'la nota urgente entra prima, senza toccare quella iniziata');
});

test('priorità: un passo di progetto non ha priorità più bassa dei passi che lo seguono', () => {
  const p = mk({ tipo: 'progetto', titolo: 'Progetto', importanza: 3 });
  const s1 = mk({ padreId: p.id, ordine: 0, importanza: 1, titolo: 'Primo' });
  const s2 = mk({ padreId: p.id, ordine: 1, importanza: 5, titolo: 'Secondo' });
  const items = [p, s1, s2];
  const eff1 = punteggioEffettivo(s1, items, OGGI, NOW);
  const eff2 = punteggioEffettivo(s2, items, OGGI, NOW);
  assert.ok(eff1 >= eff2, 'il primo eredita il punteggio più alto dei successivi');
  assert.equal(eff1, eff2);
  const lista = listaAzioni(items, OGGI, NOW).map((e) => e.item.titolo);
  assert.ok(lista.indexOf('Primo') < lista.indexOf('Secondo'));
});

test('priorità: i pesi sono configurabili e si normalizzano', () => {
  const urgente = mk({ importanza: 1, fine: OGGI });
  const importante = mk({ importanza: 5 });
  const base = score(urgente, OGGI, NOW) - score(importante, OGGI, NOW);
  try {
    impostaPesi({ urgenza: 0, importanza: 1, sforzo: 0, eta: 0 });
    assert.ok(score(importante, OGGI, NOW) > score(urgente, OGGI, NOW), "con solo l'importanza vince la nota importante");
    impostaPesi({ urgenza: 10, importanza: 0, sforzo: 0, eta: 0 });
    assert.equal(score(urgente, OGGI, NOW), 100);
    assert.deepEqual(normalizzaPesi({ urgenza: 0, importanza: 0, sforzo: 0, eta: 0 }), PESI_PREDEFINITI);
    assert.equal(Math.round(normalizzaPesi({ urgenza: 2, importanza: 2, sforzo: 0, eta: 0 }).urgenza * 100), 50);
  } finally {
    impostaPesi(undefined);
  }
  assert.equal(score(urgente, OGGI, NOW) - score(importante, OGGI, NOW), base, 'tornano i pesi di base');
});

test('priorità: la posizione nella scheda è quella che si legge in Oggi, anche a parità di punteggio', () => {
  const a = mk({ titolo: 'Uguale A', importanza: 3, creato: NOW - 5000 });
  const b = mk({ titolo: 'Uguale B', importanza: 3, creato: NOW - 1000 });
  const c = mk({ titolo: 'Più importante', importanza: 5 });
  const items = [b, a, c];
  const classifica = classificaPriorita(items, OGGI, NOW);
  assert.equal(classifica.get(c.id), 1);
  assert.equal(classifica.get(a.id), 2, 'a parità vince la più vecchia');
  assert.equal(classifica.get(b.id), 3);
  for (const x of items) assert.equal(posizionePriorita(items, x, OGGI, NOW).pos, classifica.get(x.id));
  assert.equal(posizionePriorita(items, a, OGGI, NOW).tot, 3);
});

test("piano: una nota in corso senza posto salvato parte dall'ora in cui è passata in corso", () => {
  const inizio = new Date(2026, 9, 15, 9, 0).getTime();
  const a = mk({ importanza: 1, sforzoMin: 30, stato: 'in_corso', inCorsoTs: inizio });
  const adesso = new Date(2026, 9, 15, 10, 55).getTime();
  const g = pianifica([a], { settimana: Array.from({ length: 7 }, () => [{ da: '08:00', a: '21:00' }]), pausaMin: 0 }, OGGI, adesso).giorni[0];
  assert.equal(orario(g.blocchi[0].da), '09:00');
});
