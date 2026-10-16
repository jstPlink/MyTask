import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { campiDaDati, daArricchire, descrizioneCompatibile, energiaDa, moodDa, tipologieDa } from './arricchimento.ts';

let n = 0;
const mk = (p: Partial<Item>): Item => ({ id: `a${++n}`, tipo: 'film', titolo: `Titolo ${n}`, stato: 'da_fare', creato: 1, aggiornato: 1, ...p });

test('arricchimento: dai generi italiani e inglesi alle tipologie dell\'app', () => {
  const g = ['film di fantascienza', 'film thriller', "film d'azione", 'film drammatico'];
  assert.deepEqual(tipologieDa(g), ['Drammatico', 'Azione', 'Thriller', 'Fantascienza']);
  assert.deepEqual(tipologieDa(['thriller anime', 'mystery anime', 'supernatural anime']), ['Thriller', 'Fantasy', 'Animazione']);
  assert.deepEqual(tipologieDa(['black comedy television series']), ['Comico']);
});

test('arricchimento: mood ed energia dai generi', () => {
  assert.equal(moodDa(['film thriller', 'film drammatico']), 'Intenso');
  assert.equal(moodDa(['film commedia']), 'Spensierato');
  assert.equal(moodDa(['documentario']), 'Riflessivo');
  assert.equal(moodDa(["film d'avventura"]), 'Emozionante');
  assert.equal(moodDa(['film musicale']), 'Rilassante');
  assert.equal(energiaDa(['film di fantascienza']), 'alta');
  assert.equal(energiaDa(['film commedia']), 'bassa');
  assert.equal(energiaDa(["film d'avventura"]), 'media');
  assert.equal(energiaDa([]), undefined);
});

test('arricchimento: riconosce il tipo giusto dalla descrizione', () => {
  assert.ok(descrizioneCompatibile('film', 'film del 2010 diretto da Christopher Nolan'));
  assert.ok(!descrizioneCompatibile('film', 'album di McCoy Tyner del 1962'));
  assert.ok(!descrizioneCompatibile('film', 'serie televisiva statunitense'));
  assert.ok(descrizioneCompatibile('serie', 'serie televisiva statunitense (2008-2013)'));
  assert.ok(descrizioneCompatibile('anime', 'anime'));
  assert.ok(descrizioneCompatibile('gioco', 'videogioco action/RPG a tema fantasy del 2015'));
  assert.ok(descrizioneCompatibile('libro', 'romanzo di Umberto Eco'));
});

test('arricchimento: non sovrascrive quello che c\'è già e compila durata e pagine', () => {
  const film = mk({ genere: 'Comico' });
  const c = campiDaDati(film, { generi: ['film thriller', 'film di fantascienza'], durataMin: 148 });
  assert.equal(c.genere, undefined);
  assert.equal(c.mood, 'Intenso');
  assert.equal(c.energia, 'alta');
  assert.equal(c.durataMin, 148);
  const libro = mk({ tipo: 'libro' });
  const l = campiDaDati(libro, { generi: ['romanzo storico', 'giallo'], pagine: 520 });
  assert.equal(l.genere, 'Romanzo storico, Giallo');
  assert.equal(l.pagine, 520);
  assert.equal(campiDaDati(mk({ tipo: 'film' }), { generi: [], durataMin: 3 }).durataMin, undefined);
});

test('arricchimento: scelta delle voci da cercare', () => {
  const NOW = 100 * 86400000;
  const nuova = mk({});
  const completa = mk({ genere: 'Azione', mood: 'Emozionante', energia: 'media', durataMin: 100 });
  const giaCercata = mk({ arricchitoIl: NOW - 86400000 });
  const vecchiaRicerca = mk({ arricchitoIl: NOW - 40 * 86400000 });
  const azione = mk({ tipo: 'azione' });
  const ids = daArricchire([nuova, completa, giaCercata, vecchiaRicerca, azione], NOW).map((i) => i.id);
  assert.deepEqual(ids.sort(), [nuova.id, vecchiaRicerca.id].sort());
});
