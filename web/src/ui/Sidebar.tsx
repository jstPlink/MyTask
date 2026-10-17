import { useMemo } from 'react';
import type { Tipo } from '../../../shared/types.ts';
import { collezione, curiosita, inbox, listaAzioni, listaEsperienze, listaProgetti, revisione, vistaOggi, daParte } from '../../../shared/views.ts';
import { useItems, useOggi, useSyncStatus } from '../lib/hooks.ts';
import { clsx } from '../lib/util.ts';
import { VERSIONE } from '../version.ts';
import { Icona, type NomeIcona } from './kit.tsx';
import { useNav, type Screen, type SubFare, type SubScoprire, type Tab } from './nav.tsx';

function Link({ nome, on, sub, main, n, warn, icona, onClick }: { nome: string; on?: boolean; sub?: boolean; main?: boolean; n?: number; warn?: boolean; icona?: NomeIcona; onClick: () => void }) {
  return (
    <button className={clsx('sb-link', on && 'on', sub && 'sub', main && 'princ')} onClick={onClick} aria-current={on ? 'page' : undefined}>
      <b>{icona && <Icona nome={icona} size={24} />}{nome}</b>
      {n !== undefined && <span className={clsx('sb-n', warn && n > 0 && 'warn')}>{n}</span>}
    </button>
  );
}

const SUB_FARE: { id: SubFare; nome: string }[] = [{ id: 'azioni', nome: 'Tutte le attività' }, { id: 'progetti', nome: 'Progetti' }, { id: 'esperienze', nome: 'Esperienze' }];
const SUB_SCOPRIRE: { id: SubScoprire; nome: string }[] = [
  { id: 'film', nome: 'Film' }, { id: 'serie', nome: 'Serie' }, { id: 'anime', nome: 'Anime' }, { id: 'gioco', nome: 'Giochi' },
  { id: 'libro', nome: 'Libri' }, { id: 'ricetta', nome: 'Ricette' },
];

/** Barra laterale per schermi larghi: sostituisce le schede in basso e il menu "Altro". */
export function Sidebar() {
  const nav = useNav();
  const items = useItems();
  const oggi = useOggi();
  const sync = useSyncStatus();

  const n = useMemo(() => {
    const per = (t: Tipo) => collezione(items, [t]).length;
    const esp = listaEsperienze(items, oggi);
    return {
      oggi: vistaOggi(items, oggi).fare.length,
      azioni: listaAzioni(items, oggi).length,
      progetti: listaProgetti(items, oggi).length,
      esperienze: esp.conData.length + esp.perZona.reduce((s, [, l]) => s + l.length, 0),
      film: per('film'), serie: per('serie'), anime: per('anime'), gioco: per('gioco'), libro: per('libro'), ricetta: per('ricetta'),
      curiosita: curiosita(items).length,
      inbox: inbox(items).length,
      daparte: daParte(items).length,
      revisione: revisione(items, oggi).length,
    } as Record<string, number>;
  }, [items, oggi]);

  const top = nav.stack[nav.stack.length - 1];
  const schermata = top && top.k !== 'item' ? top.k : undefined;
  const inTab = (t: Tab) => nav.tab === t && !schermata && !nav.query;
  const apriTab = (t: Tab) => { nav.setQuery(''); nav.setTab(t); };
  const apriFare = (s: SubFare) => { nav.setQuery(''); nav.vaTab('fare', { fare: s }); };
  const apriScoprire = (s: SubScoprire) => { nav.setQuery(''); nav.vaTab('scoprire', { scoprire: s }); };
  const vai = (s: Screen) => { nav.setQuery(''); nav.vai(s); };
  // con le sotto-sezioni aperte è la sotto-sezione a risultare attiva, non la categoria
  const subVisibili = (t: Tab) => nav.tab === t && !schermata && (t === 'fare' || t === 'scoprire');
  const scr = (k: Screen['k']) => schermata === k && !nav.query;

  return (
    <aside className="side" aria-label="Navigazione">
      <div className="sb-brand"><i aria-hidden="true" />MyTask</div>

      <div className="sb-top">
        <button className="btn solid sb-nuova" onClick={() => nav.openCapture(true)}>+ Nuova nota <kbd aria-hidden="true">N</kbd></button>
        <div className="sb-cerca">
          <input id="ricerca" type="search" value={nav.query} onChange={(e) => nav.setQuery(e.target.value)} placeholder="Cerca…" aria-label="Cerca" />
          <kbd aria-hidden="true">/</kbd>
        </div>
      </div>

      <Link main nome="Oggi" icona="oggi" on={inTab('oggi')} n={n.oggi} onClick={() => apriTab('oggi')} />

      <Link main nome="Attività" icona="fare" n={n.azioni + n.progetti + n.esperienze} on={inTab('fare') && !subVisibili('fare')} onClick={() => apriTab('fare')} />
      {nav.tab === 'fare' && !schermata && (
        <div className="sb-subs">
          {SUB_FARE.map((s) => <Link key={s.id} sub nome={s.nome} n={n[s.id]} on={inTab('fare') && nav.fareSub === s.id} onClick={() => apriFare(s.id)} />)}
        </div>
      )}

      <Link main nome="Intrattenimento" icona="scoprire" on={inTab('scoprire') && !subVisibili('scoprire')} onClick={() => apriTab('scoprire')} />
      {nav.tab === 'scoprire' && !schermata && (
        <div className="sb-subs">
          {SUB_SCOPRIRE.map((s) => <Link key={s.id} sub nome={s.nome} n={n[s.id]} on={inTab('scoprire') && nav.scoprireSub === s.id} onClick={() => apriScoprire(s.id)} />)}
        </div>
      )}

      <Link main nome="Curiosità" icona="curiosita" on={inTab('curiosita')} n={n.curiosita} onClick={() => apriTab('curiosita')} />

      <Link main nome="Routine" icona="routine" on={inTab('routine')} onClick={() => apriTab('routine')} />

      <div className="sb-group">
        <div className="sb-sec">Da sistemare</div>
        <Link nome="Inbox" n={n.inbox} on={scr('inbox')} onClick={() => vai({ k: 'inbox' })} />
        <Link nome="Revisione" n={n.revisione || undefined} warn on={scr('revisione')} onClick={() => vai({ k: 'revisione' })} />
      </div>

      <div className="sb-group">
        <div className="sb-sec">Altro</div>
        <Link nome="Archiviate" n={n.daparte} on={scr('daparte')} onClick={() => vai({ k: 'daparte' })} />
        <Link nome="Completato" on={scr('archivio')} onClick={() => vai({ k: 'archivio' })} />
      </div>

      <div className="sb-spacer" />
      <div className="sb-group">
        <Link nome="Tempo libero" on={scr('tempolibero')} onClick={() => vai({ k: 'tempolibero' })} />
        <Link nome="Aspetto" on={scr('aspetto')} onClick={() => vai({ k: 'aspetto' })} />
        <Link nome="Account" on={scr('account')} onClick={() => vai({ k: 'account' })} />
      </div>
      <div className="sb-foot">
        {!sync.online && <span className="pill-sync off">Offline</span>}
        <div>MyTask · versione {VERSIONE}</div>
      </div>
    </aside>
  );
}
