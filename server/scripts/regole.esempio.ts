// Regole di esempio, generiche. Per le tue copia questo file in `regole.locale.ts` (ignorato da git)
// e adattalo ai tuoi dati: l'importazione usa quello se c'è.
import type { Regole } from './regole.ts';

export const REGOLE: Regole = {
  serie: ['una serie di esempio'],
  anime: ['un anime di esempio'],
  tipoForzato: {
    // un "Video" che in realtà è un gioco
    'un videogioco': 'gioco',
    // Admin che sono progetti o routine
    'portfolio': 'progetto',
    'dieta': 'routine',
  },
  routine: {
    'dieta': { fascia: 'mattina', obiettivo: 'Seguire il piano', stato: 'in_corso' },
  },
  zone: {
    'un museo di esempio': 'Roma',
  },
  personeVoce: {
    'scrivere a mario rossi': ['Mario Rossi'],
  },
  daContattare: [],
  noteSpeciali: {
    'consigliato da mario ecc': { consigliatoDa: 'Mario' },
    'romantico': { genere: 'Romantico' },
    'netflix': { piattaforma: 'Netflix' },
    'disney +': { piattaforma: 'Disney+' },
    'serie tv': {},
  },
  aree: [
    ['Burocrazia', 'contratto|fornitore|bolletta|assicurazione|notaio|tasse|documento'],
    ['Salute', 'medico|dentista|dieta|visita'],
    ['Lavoro', 'lavoro|colloquio|portfolio'],
    ['Persone', 'contattare|scrivere a|chiamare|feedback'],
    ['Casa', 'casa|caldaia|pulizie|comprare'],
    ['Creatività', 'disegn|fotografie|pubblicare'],
    ['Digitale', 'backup|server|software|password|app\\b'],
  ],
  rigide: ['un concerto di esempio'],
  daVerificare: {
    'un videogioco': 'serie o gioco?',
  },
};
