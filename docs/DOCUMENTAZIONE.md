# MyTask: documentazione

Documento vivo. Si aggiorna a ogni modifica e ogni aggiornamento va annotato nel registro in fondo.

- **Versione documento:** 0.8
- **Stato progetto:** app web e server scritti e provati in locale. Prossimo passo: prova su Docker sul NAS. L'APK è in pausa fino ad allora
- **Codice:** [README.md](../README.md) (come avviarla e metterla sul NAS)
- **Mockup:** `docs/mockups/` (minimalisti ed estetici, chiaro/scuro). Non sono pubblicati perché usano i dati reali dell'utente
- **Decisioni di dettaglio:** `docs/01-setup-decisioni.md` (registro locale delle decisioni, non pubblicato)

## 1. Scopo

Un'app personale, mirata e veloce, per raccogliere idee, cose da fare, cose da vedere, leggere, giocare, mangiare e visitare, con priorità calcolate. Sostituisce l'uso di Notion per questo scopo. Funziona sul web (PWA) e sul telefono Android (APK), anche offline, e gira in Docker sul NAS dell'utente.

### Principi

1. **Mirata**: poche azioni chiare, niente interfaccia da strumento generico.
2. **Veloce**: aprire l'app e vedere subito "Oggi"; salvare un'idea in pochi secondi.
3. **Local-first**: funziona senza rete, sincronizza appena possibile.
4. **I dati sono dell'utente**: database sul NAS, nessun upload di documenti (solo collegamenti a Seafile).
5. **L'IA aiuta, non è obbligatoria**: ogni funzione deve poter essere fatta a mano.

## 2. Aree dell'app

Dato che si progetta tutto insieme, ecco la mappa completa.

| Area | Contenuto | Origine in Notion |
|---|---|---|
| **Oggi** | Cose da fare oggi, scadenze imminenti, routine, voci scadute da rivedere | Nuovo |
| **Azioni** | Burocrazia, casa, digitale, salute, lavoro, ecc. | Type "Admin" |
| **Progetti** | Obiettivi con sotto-attività e avanzamento | Voci con figli |
| **Esperienze** | Cose da fare fuori casa, eventi, uscite, luoghi | Type "Attività" |
| **Routine** | Abitudini quotidiane o settimanali | Voci come dieta o attività fisica |
| **Collezioni** | Film, Serie, Anime, Giochi, Libri, Ricette | Type Video, Gioco, Libri, Cibo |
| **Curiosità** | Cose da approfondire | Type "Info" |
| **Inbox** | Idee catturate al volo, ancora da smistare | Nuovo |
| **Archivio** | Tutto ciò che è completato, consultabile come diario | Status "Done" |
| **Revisione** | Voci scadute o dimenticate, da ripianificare o chiudere | Nuovo |

### 2.1 Navigazione (proposta nei mockup, da validare)

- **Quattro schede in basso:** Oggi, Fare, Scoprire, Routine. Più un pulsante "+" fisso per la cattura rapida.
- **Fare** contiene tre sezioni: Azioni, Progetti, Esperienze.
- **Scoprire** contiene le collezioni (Film, Serie, Anime, Giochi, Libri, Ricette) e le Curiosità.
- **Altro** (da Oggi): Inbox, Revisione, Archivio, Persone, Luoghi, impostazioni.
- **Gerarchia visiva in tre livelli:** grassetto grande = ciò che conta; testo normale = contesto; grigio piccolo = dettaglio. La priorità si vede da una barra a sinistra (3 spessori), non da etichette "Alta/Bassa". Il pallino pieno segna la scadenza rigida.

### 2.2 Estetica (stile e palette approvati dall'utente)

Layout identico ai mockup minimalisti, con questi cambi:

- **Un solo colore d'accento**, scelto dall'utente tra **Verde** (predefinito), **Petrolio** e **Indaco**. Usato solo per: azione principale, priorità alta, scheda attiva, avanzamento, spunte.
- **Aspetto modificabile dalle impostazioni** (Altro > Aspetto): tema Sistema / Chiaro / Scuro e colore d'accento. Si applica subito, viene salvato sul dispositivo e funziona offline.
- **Un colore d'avviso** (arancio), riservato a scadenze rigide e voci scadute.
- **Tutto il resto neutro**, con sfondo caldo e superfici bianche (chiaro) o grigio scuro (scuro).
- **Tema chiaro e tema scuro** con la stessa gerarchia; il tema segue il sistema, con possibilità di forzarlo.
- **Angoli più morbidi**; l'ombra compare solo sull'elemento più importante della schermata.
- **Priorità**: la barra a sinistra usa tre intensità dell'accento (alta piena, media 42%, bassa quasi invisibile).

| Token | Chiaro | Scuro |
|---|---|---|
| Sfondo | #F7F6F2 | #0E0F12 |
| Superficie | #FFFFFF | #181A1F |
| Testo | #1C1C21 | #EDEDF2 |
| Secondario | #6C6C75 | #A0A0AC |
| Accento Verde (predefinito) | #2F7D5B | #6FCF9B |
| Accento Petrolio | #0E7490 | #4FC3DD |
| Accento Indaco | #4F46E5 | #9A9EFF |
| Avviso | #D1430B | #FF9466 |

## 3. Modello dati (bozza v0.1)

Un'unica tabella **Elemento** con un campo `tipo`, più tabelle di supporto. I campi sono opzionali tranne quelli indicati.

### Elemento

| Campo | Note |
|---|---|
| id, titolo (obbligatori) | |
| tipo (obbligatorio) | azione, progetto, esperienza, routine, film, serie, anime, gioco, libro, ricetta, curiosità |
| stato | da_fare, in_corso, fatto, saltato, parcheggiato, da_approfondire. **"Scaduto" non è uno stato**: si calcola da data e stato |
| note, link[] | link ammessi anche a file su Seafile |
| inizio, fine, ora_inizio, ora_fine | orario facoltativo |
| rigida | `true` se la scadenza non è spostabile |
| ricorrenza | regola (giornaliera, settimanale, mensile, annuale, ogni N…) |
| promemoria[] | uno o più, anche periodici |
| importanza (1-5) | solo azioni e progetti |
| sforzo_min | stima in minuti, anche proposta dall'IA |
| interesse (1-5) | solo collezioni, esperienze e curiosità |
| padre_id | per sotto-task (un solo livello) |
| checklist[] | liste semplici dentro una voce |
| persone[] | campo con completamento automatico, più flag "da contattare" (confermato) |
| luogo, zona, link_maps | lista luoghi con zona e link a Google Maps, senza mappa propria (confermato) |
| piattaforma, consigliato_da, con_chi | collezioni |
| voto, completato_il | collezioni e archivio |
| creato, aggiornato | |

### Conversione dal vecchio Priority (per l'import)

| Notion | Azioni → importanza | Collezioni → interesse |
|---|---|---|
| Very high | 5 | 5 |
| High | 4 | 4 |
| Medium | 3 | 3 |
| Low | 2 | 2 |
| Very low | 1 | 1 |
| vuoto | da stimare con l'IA | 3 |

## 4. Regole principali

### 4.1 Priorità delle azioni (bozza, da tarare)

Punteggio da 0 a 100 usato per ordinare "Oggi" e le liste:

- **Urgenza** (peso 45%): scaduta/oggi = 100; entro 3 giorni = 80; entro 7 = 60; entro 30 = 35; oltre = 15; senza data = 0. Se la scadenza è rigida, l'urgenza vale 1,3 volte.
- **Importanza** (peso 35%): da 1 a 5, normalizzata.
- **Sforzo basso** (peso 10%): le attività sotto i 15 minuti salgono (le "vittorie rapide").
- **Età** (peso 10%): cresce di poco ogni settimana per evitare che le voci marciscano.

Le collezioni non hanno punteggio di urgenza: si ordinano per **interesse**, filtrate da contesto (piattaforma, durata, con chi).

### 4.2 Stato "scaduto"

Calcolato: data finale passata e stato diverso da fatto/saltato. Le voci scadute compaiono nell'area **Revisione**, con azioni rapide: ripianifica, segna come saltato, segna come fatto.

### 4.3 Promemoria

- Possono essere singoli o ripetuti (giornalieri, settimanali, ogni N giorni, a orari fissi).
- **Insistenza:** su alcune voci scelte dall'utente il promemoria si ripete (a intervalli configurabili) finché la voce non viene spuntata o rimandata.
- Sull'APK sono notifiche locali, quindi funzionano anche offline.
- Per le scadenze rigide: promemoria predefiniti a 7 giorni e 1 giorno prima (modificabili).

### 4.4 Routine (confermata)

Le abitudini non sono task: non scadono e non finiscono.

- Una routine ha una **fascia della giornata** ("mattina", "dopo cena", "prima di dormire") e una frequenza flessibile (es. 3 volte a settimana).
- Compare nella sezione "Routine di oggi" solo nei giorni utili, con una spunta singola.
- Obiettivo minimo piccolo (es. "leggere 10 minuti") per abbassare l'attrito.
- Nessuna colpa sui giorni saltati: si guardano i conteggi settimanali, non le serie perfette.
- Una routine con interesse quasi nullo (chitarra) resta in **Parcheggiato** e non compare in Oggi finché non viene attivata.

### 4.5 Cattura rapida

Una riga di testo (o voce) crea una voce in Inbox. L'IA propone tipo, titolo, piattaforma, chi l'ha consigliato, ecc. L'utente conferma con un tocco. Esempio: "Titolo di un film, me l'ha consigliato Mario, su Netflix".

### 4.6 Sincronizzazione e offline

- I dati vivono anche nel dispositivo; le modifiche si accumulano e vengono inviate al server appena c'è rete.
- Utente unico: conflitti risolti con l'ultima modifica **per voce** (vince la versione con data di modifica più recente).
- Le modifiche fatte offline restano in coda e partono da sole al ritorno della rete (provato in locale).
- Il database sul NAS è il riferimento; backup periodico in una cartella Seafile.

### 4.8 Cosa compare in Oggi (implementato)

1. **Routine** del giorno: giornaliere, oppure a quota settimanale finché la quota non è raggiunta.
2. **Da fare oggi**: tutte le voci con scadenza oggi o scaduta da non più di 2 giorni, più le voci senza data con il punteggio più alto, fino a un massimo di 5 (se le scadenze sono di più, compaiono tutte). A parità di punteggio vengono prima quelle già in corso.
3. Di un progetto compare **solo il prossimo passo**, con le eredità di importanza e scadenza.
4. Le **esperienze senza data** non compaiono mai in Oggi: sono una lista di desideri.
5. **Prossimi 7 giorni**: qualunque voce aperta con scadenza nei 7 giorni successivi.
6. Le voci scadute da **più di 2 giorni**, quelle segnate "da rivedere" e i progetti fermi da 30 giorni vanno in **Revisione**, non in Oggi né nelle liste di Fare.
7. Le voci parcheggiate non compaiono in Oggi.

### 4.7 Progetti e voci con figli (confermata)

Nei dati ci sono 9 voci con figli (da 2 a 25). Il problema di Notion è che un padre con molti figli riempie tutte le liste. Regole proposte:

1. **Un solo livello.** Un sotto-task non può avere figli.
2. **Il padre non compare in Oggi, compare il suo prossimo passo.** In Oggi si vede il primo sotto-task non completato (o il più urgente), con il nome del progetto accanto. Un progetto con 25 figli occupa una riga sola.
3. **Avanzamento calcolato** (es. 3 su 8) dai figli completati. Mai inserito a mano.
4. **Lo stato del padre segue i figli.** Almeno un figlio avviato = in corso. Quando tutti i figli sono completati, l'app propone di chiudere il progetto (conferma con un tocco).
5. **Scadenza e importanza ereditate.** Un figlio senza data o importanza usa quelle del padre. L'urgenza del progetto è quella del suo figlio più urgente.
6. **Checklist o sotto-task?** Se un elemento ha solo un nome da spuntare (es. "Controllare le foto del 2019, 2020…"), è una **checklist** interna, che non compare nelle liste né in Oggi. Se ha data, note o priorità proprie, è un **sotto-task**. Con un tocco si promuove una riga di checklist a sotto-task.
7. **Progetti fermi.** Un progetto aperto senza attività da 30 giorni va in Revisione.
8. **Nelle collezioni i figli sono obiettivi, non task.** Un videogioco da finire è una voce con una checklist di obiettivi (battere il boss, esplorare la mappa…) e non finisce in Oggi.
9. **Chiusi e archiviati:** i figli completati si comprimono in un solo elenco leggibile, per non rovinare la lettura dell'archivio.

Come vengono importati i padri (le regole esatte stanno in `server/scripts/regole.esempio.ts`, quelle personali in un file locale non pubblicato):

| Padre | Diventa |
|---|---|
| Progetto concluso con molti figli | Progetto archiviato, con i figli raggruppati in checklist |
| Videogioco con obiettivi | Gioco con checklist di obiettivi |
| Progetto aperto con passi da fare | Progetto con sotto-task (e date se presenti) |
| Abitudine con passi di impostazione | Routine, con i passi come checklist iniziale |

### 4.9 Tipi e regole di smistamento nell'importazione

Il tipo di Notion non basta a decidere il tipo in MyTask, quindi l'importazione usa regole esplicite: elenchi di titoli che sono serie o anime, titoli da trasformare in progetti o routine, zone, persone nominate nelle note, aree delle azioni (casa, burocrazia, digitale…). Sono dati personali, quindi stanno in `regole.locale.ts` (ignorato da git); nel repository c'è solo `regole.esempio.ts`.

## 5. Architettura

Le scelte marcate "confermato" sono decise dall'utente; le altre sono proposte tecniche mie, modificabili.

| Parte | Scelta |
|---|---|
| Hosting | Un container Docker su un NAS (confermato) |
| Backend | Node.js 24 con Fastify e SQLite integrato (`node:sqlite`, nessuna dipendenza nativa); TypeScript eseguito direttamente, senza passaggio di compilazione |
| Frontend | React + Vite, web app installabile (PWA) con archivio locale in IndexedDB e service worker |
| App Android | PWA + APK tramite Capacitor, con notifiche locali (confermato). I widget sono rimandati a una versione successiva |
| Accesso | Email e password. HTTPS e accesso da fuori casa tramite **Cloudflare Tunnel**, come già per Seafile, con un sottodominio dedicato che punta al container sul NAS (confermato) |
| IA | Gemini per iniziare (scelta dell'utente), dietro un modulo con interfaccia comune per poter cambiare provider senza riscrivere nulla |
| Documenti | Solo collegamenti a Seafile, incollati a mano (confermato) |
| Calendario | Dati già pronti (inizio, fine, orario) e modulo di sincronizzazione con Google Calendar predisposto, ma non attivo. L'attivazione richiederà il consenso OAuth di Google e un indirizzo HTTPS raggiungibile |

### 5.1 Note su sicurezza e risorse

- Con il tunnel Cloudflare l'app è raggiungibile da Internet. Si consiglia (da decidere) **Cloudflare Access** davanti all'app, oltre al login, limiti ai tentativi di accesso e password lunga, perché ci sono dati personali.
- Il NAS ha un processore di fascia bassa e poca RAM: un modello IA locale non è pratico. L'IA passa dal servizio esterno (Gemini).
- Il database è un solo file SQLite; backup notturno in una cartella Seafile (da implementare).
- Essendo l'app raggiungibile con HTTPS, la sincronizzazione con Google Calendar è tecnicamente fattibile quando vorrai attivarla.

## 6. Importazione da Notion

Una sola volta, dal CSV esportato. Passi:

1. Lettura dei due file CSV (430 voci).
2. Unione dei duplicati (8 nomi).
3. Smistamento dei tipi: Video → Film/Serie/Anime; "Info" che in realtà sono film → Film; "Attività" con data → Esperienze; "Admin" tecnici → Azioni.
4. Estrazione dalle note: piattaforma (netflix, disney+, Infinity), consigliato da, con chi.
5. Conversione di priorità, stati e date; ricostruzione dei padri/figli; checklist al posto dei figli ripetitivi.
6. Le 26 voci con data passata e non fatte vanno tutte in Revisione (decisione dell'utente).
7. Report finale a lui con tutto ciò che è stato modificato.

Nessun identificativo né link a Notion viene conservato.

## 7. Funzioni IA previste

| Funzione | Quando |
|---|---|
| Compilazione automatica dalla riga di cattura | Cattura rapida |
| Pulizia e riorganizzazione | Una sola volta, all'import |
| Stima dello sforzo | Alla creazione di un'azione |
| "Cosa guardo stasera?" | A richiesta, per tempo/umore/piattaforma |
| Spezzare un'idea in passi | A richiesta |
| Revisione settimanale | Una volta a settimana |

Le voci sensibili (banca, salute, contratti) vanno escluse dall'invio a servizi esterni oppure l'utente sceglie se includerle.

## 8. Roadmap

| Fase | Obiettivo | Stato |
|---|---|---|
| 0 | Chiudere le domande di setup | Completata (2026-10-15) |
| 1 | Mockup minimalisti (gerarchia delle informazioni) | Bozza pronta (17 schermate), in attesa di feedback |
| 2 | Mockup estetici | Pronti (`02-estetica.html`, 18 schermate, chiaro/scuro, 3 colori); in attesa di conferma finale |
| 3 | Scrittura dell'app: base, Oggi, Inbox, import | Fatta e provata in locale |
| 4 | Collezioni, Routine, Revisione | Fatta insieme alla fase 3 (progettazione unica) |
| 5 | APK con notifiche e widget | In pausa (deciso dall'utente: prima la prova su Docker). Un primo scheletro Capacitor era stato generato ma non è nel repository. Widget rimandati |
| 6 | IA | Cattura rapida con Gemini fatta (serve la chiave); le altre funzioni IA da fare |

### 8.1 Stato dell'implementazione (2026-10-15)

| Parte | Stato |
|---|---|
| Server: login, sessioni, limite ai tentativi, sincronizzazione, esportazione JSON, backup giornaliero | Fatto, con test |
| App web: Oggi, Fare (azioni, progetti, esperienze), Scoprire (6 collezioni e curiosità), Routine, Inbox, Revisione, Archivio, Persone, Luoghi, Cosa guardo stasera, editor completo, Aspetto, Notifiche, Account | Fatta, provata nel browser su dati reali importati |
| Uso offline: modifiche in coda e sincronizzazione al ritorno della rete | Provato in locale |
| Importazione da Notion con report | Fatta (il report con il dettaglio si genera a ogni importazione e non è pubblicato) |
| Cattura rapida: interpretazione locale, IA (Gemini) con ripiego, voce, rilevamento dei duplicati | Fatta. L'IA è provata solo con una risposta simulata |
| Promemoria | Funzionano nel browser ad app aperta. Ad app chiusa serve l'APK |
| Collegamento Google Calendar | Solo i dati sono pronti (date e orari). Il modulo di sincronizzazione non è ancora scritto |
| Docker | Dockerfile e compose scritti, **non ancora provati** (Docker non è installato sul computer di sviluppo) |
| Service worker (uso offline all'apertura dell'app) | Generato dalla build, **non verificato** nel browser di prova |
| APK (Capacitor), widget | Da fare |

## 9. Registro aggiornamenti

| Data | Versione | Modifica |
|---|---|---|
| 2026-10-15 | 0.1 | Prima stesura: aree, modello dati, regole, architettura proposta, roadmap |
| 2026-10-15 | 0.2 | Confermati: routine, persone, luoghi, scadenza rigida, Gemini come provider IA, 26 voci scadute in Revisione, collegamento Google Calendar predisposto. Aggiunta sezione 4.7 (progetti e voci con figli) |
| 2026-10-15 | 0.3 | Fase 0 chiusa. Confermati: gestione voci con figli, promemoria ripetuti con insistenza, widget rimandati, Cloudflare Tunnel come accesso, PWA + APK Capacitor, link a Seafile incollati. Aggiunta sezione 5.1 (sicurezza e risorse) |
| 2026-10-15 | 0.4 | Prima bozza dei mockup minimalisti (17 schermate: Oggi, cattura rapida, Altro, Azioni, dettaglio azione, Progetti, dettaglio progetto, Esperienze, Film, Cosa guardo stasera, dettaglio collezione, Curiosità, Routine, Revisione, Archivio, Persone, Luoghi). Aggiunta sezione 2.1 (navigazione) |
| 2026-10-15 | 0.5 | Layout approvato dall'utente. Prima proposta estetica: accento indaco (alternative verde e petrolio), colore d'avviso arancio, tema chiaro e scuro, stesse 17 schermate (`02-estetica.html`). Aggiunta sezione 2.2. Corretto nei mockup l'esempio con data passata (le date future sono esempi) |
| 2026-10-15 | 0.6 | Stile e palette approvati. Accento predefinito Verde, con Petrolio e Indaco selezionabili. Aggiunta schermata 18 (Altro > Aspetto: tema Sistema/Chiaro/Scuro e colore) e voce "Aspetto" nel menu Altro. Il tema si salva sul dispositivo |
| 2026-10-15 | 0.7 | Mockup confermati. Scritta l'applicazione (fasi 3 e 4): server, app web, importazione da Notion, Docker. Aggiunta sezione 4.8 (cosa compare in Oggi) e 8.1 (stato dell'implementazione). Sincronizzazione per voce invece che per campo. Rilevamento dei duplicati nella cattura rapida |
| 2026-10-15 | 0.8 | Progetto spostato nella cartella collegata a GitHub (`MyTaskGit`). Docker compose aggiornato: volume Docker per il database, porta configurabile con `MYTASK_PORT`, nessun conflitto di permessi. File personali (esportazioni CSV, report dell'importazione) esclusi da git. APK messo in pausa. Primo commit su un repository pubblico: dati personali tolti (mockup, registro delle decisioni e regole di importazione restano solo in locale; nel repository c'è `regole.esempio.ts`); l'importazione si può preparare sul computer con `--json` e caricare con `--from-json` |
