import { useMemo } from 'react';
import type { Tipo } from '../../../shared/types.ts';
import { collezione, curiosita, inbox, listaAzioni, listaEsperienze, listaProgetti, revisione, vistaOggi } from '../../../shared/views.ts';
import { useItems, useOggi, useSyncStatus } from '../lib/hooks.ts';
import { clsx } from '../lib/util.ts';
import { VERSIONE } from '../version.ts';
import { Icona, type NomeIcona } from './kit.tsx';
import { useNav, type Screen, type SubFare, type SubScoprire, type Tab } from './nav.tsx';

function Link({ nome, on, sub, n, warn, icona, onClick }: { nome: string; on?: boolean; sub?: boolean; n?: number; warn?: boolean; icona?: NomeIcona; onClick: () => void }) {
  return (
    <button className={clsx('sb-link', on && 'on', sub && 'sub')} onClick={onClick} aria-current={on ? 'page' : undefined}>
      <b>{icona && <Icona nome={icona} size={18} />}{nome}</b>
      {n !== undefined && <span className={clsx('sb-n', warn && n > 0 && 'warn')}>{n}</span>}
    </button>
  );
}

const SUB_FARE: { id: SubFare; nome: string }[] = [{ id: 'azioni', nome: 'Azioni' }, { id: 'progetti', nome: 'Progetti' }, { id: 'esperienze', nome: 'Esperienze' }];
const SUB_SCOPRIRE: { id: SubScoprire; nome: string }[] = [
  { id: 'film', nome: 'Film' }, { id: 'serie', nome: 'Serie' }, { id: 'anime', nome: 'Anime' }, { id: 'gioco', nome: 'Giochi' },
  { id: 'libro', nome: 'Libri' }, { id: 'ricetta', nome: 'Ricette' }, { id: 'curiosita', nome: 'Curiosità' },
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
      revisione: revisione(items, oggi).length,
    } as Record<string, number>;
  }, [items, oggi]);

  const top = nav.stack[nav.stack.length - 1];
  const schermata = top && top.k !== 'item' ? top.k : undefined;
  const inTab = (t: Tab) => nav.tab === t && !schermata && !nav.query;
  const apriTab = (t: Tab) => { nav.setQuery(''); nav.setTab(t); };
  const apriFare = (s: SubFare) => { nav.setFareSub(s); apriTab('fare'); };
  const apriScoprire = (s: SubScoprire) => { nav.setScoprireSub(s); apriTab('scoprire'); };
  const vai = (s: Screen) => { nav.setQuery(''); nav.vai(s); };
  const scr = (k: Screen['k']) => schermata === k && !nav.query;

  return (
    <aside className="side" aria-label="Navigazione">
      <div className="sb-brand"><i aria-hidden="true" />MyTask</div>

      <Link nome="Oggi" icona="oggi" on={inTab('oggi')} n={n.oggi} onClick={() => apriTab('oggi')} />

      <Link nome="Fare" icona="fare" onClick={() => apriTab('fare')} />
      {nav.tab === 'fare' && !schermata && SUB_FARE.map((s) => (
        <Link key={s.id} sub nome={s.nome} n={n[s.id]} on={inTab('fare') && nav.fareSub === s.id} onClick={() => apriFare(s.id)} />
      ))}

      <Link nome="Scoprire" icona="scoprire" onClick={() => apriTab('scoprire')} />
      {nav.tab === 'scoprire' && !schermata && SUB_SCOPRIRE.map((s) => (
        <Link key={s.id} sub nome={s.nome} n={n[s.id]} on={inTab('scoprire') && nav.scoprireSub === s.id} onClick={() => apriScoprire(s.id)} />
      ))}

      <Link nome="Routine" icona="routine" on={inTab('routine')} onClick={() => apriTab('routine')} />

      <div className="sb-sec">Da sistemare</div>
      <Link nome="Inbox" icona="inbox" n={n.inbox} on={scr('inbox')} onClick={() => vai({ k: 'inbox' })} />
      <Link nome="Revisione" n={n.revisione} warn on={scr('revisione')} onClick={() => vai({ k: 'revisione' })} />

      <div className="sb-sec">Altro</div>
      <Link nome="Archivio" on={scr('archivio')} onClick={() => vai({ k: 'archivio' })} />
      <Link nome="Persone" on={scr('persone') || scr('persona')} onClick={() => vai({ k: 'persone' })} />
      <Link nome="Luoghi" on={scr('luoghi')} onClick={() => vai({ k: 'luoghi' })} />

      <div className="sb-spacer" />
      <Link nome="Aspetto" on={scr('aspetto')} onClick={() => vai({ k: 'aspetto' })} />
      <Link nome="Notifiche" on={scr('notifiche')} onClick={() => vai({ k: 'notifiche' })} />
      <Link nome="Account" on={scr('account')} onClick={() => vai({ k: 'account' })} />
      <div className="sb-foot">
        <span className={clsx('pill-sync', !sync.online && 'off')}>
          {!sync.online ? 'Offline' : sync.inAttesa ? `${sync.inAttesa} da sincronizzare` : 'Sincronizzato'}
        </span>
        <div>MyTask · versione {VERSIONE}</div>
      </div>
    </aside>
  );
}
