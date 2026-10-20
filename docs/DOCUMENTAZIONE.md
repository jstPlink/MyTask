# MyTask: documentazione

Documento vivo: descrive **com'è l'app oggi**. Ogni modifica va riportata nelle sezioni giuste e annotata nel registro in fondo.

- **Versione documento:** 0.68.5
- **Stato progetto:** in uso. Il server gira sul NAS (immagine Docker da GitHub), il sito ha il layout per schermi larghi, l'app Android è installata sul telefono con notifiche locali e widget «Oggi». Aperti: verifica delle notifiche e del service worker sul telefono, Google Calendar, altre funzioni IA (sezione 9).
- **Codice:** [README.md](../README.md) (come avviarla, metterla sul NAS, installare l'app Android)
- **Mockup:** `docs/mockups/` (minimalisti ed estetici, chiaro/scuro). Sono locali, non pubblicati perché usano i dati reali dell'utente.
- **Decisioni di dettaglio:** `docs/01-setup-decisioni.md` (registro locale, non pubblicato)

## Come si lavora sul progetto (regole dell'utente)

Regole fisse per chi sviluppa (anche Claude), da rispettare a ogni modifica:

1. **Anteprima in locale:** sito e server in localhost, con il sito collegato al server vero (`MYTASK_SERVER`, vedi `web/vite.config.ts`), così l'utente vede le modifiche prima di pubblicarle.
2. **Commit e push solo su richiesta dell'utente:** non si fanno mai da soli, nemmeno per aggiornare il telefono. A fine modifiche si dice che l'app sul telefono resta com'è finché non vengono chiesti. Quando l'utente chiede commit e push si fanno e basta: **non si aspetta né si controlla la build su GitHub, lo verifica l'utente**. Si dice che la build è partita e si aspetta che sia l'utente a dire che l'app è pronta; solo allora (o se chiede di aggiornare il telefono) si scarica `mytask.apk` dalla release e si installa sul telefono.
3. **Telefono:** si aggiorna con il debug wireless e `adb install -r`, senza disinstallare per non perdere i dati locali. Se l'utente chiede di aggiornare solo il telefono (senza commit) si costruisce l'APK in locale (sezione 7.3) e lo si installa allo stesso modo. Se serve davvero disinstallare (per esempio cambia la chiave di firma) si salvano prima i dati: si apre l'app con la rete attiva per sincronizzarli e a reinstallazione fatta si controlla che le voci siano tornate (i dati stanno sul server: se non tornano si controlla la sincronizzazione in Altro › Account). Se il telefono non è raggiungibile (debug wireless spento) lo si dice e si riprova alla richiesta successiva.
4. **Versione e documentazione:** si aumenta la versione a ogni commit (`package.json` principale) e si annota il registro in fondo a questo documento.
5. **Privacy:** niente screenshot del telefono (può mostrare notifiche private); per verificare si usano il browser o i test.
6. **Test:** `npm run typecheck` e `npm test`.

## 1. Scopo e principi

Un'app personale, mirata e veloce, per raccogliere idee, cose da fare, cose da vedere, leggere, giocare, mangiare e visitare, con priorità calcolate. Sostituisce l'uso di Notion per questo scopo. Funziona sul web (PWA) e sul telefono Android (APK), anche offline, e gira in Docker sul NAS dell'utente.

1. **Mirata**: poche azioni chiare, niente interfaccia da strumento generico.
2. **Veloce**: si apre su «Oggi»; un'idea si salva in pochi secondi.
3. **Local-first**: funziona senza rete, sincronizza appena possibile.
4. **I dati sono dell'utente**: database sul NAS, nessun upload di documenti (solo collegamenti a Seafile).
5. **L'IA aiuta, non è obbligatoria**: ogni funzione si può fare a mano; le chiavi IA le mette l'utente e restano sul dispositivo.

## 2. Aree dell'app e navigazione

| Area | Contenuto |
|---|---|
| **Priorità** (prima «Oggi») | Blocco del cronometro (stato «In corso» / «Nessuna nota in corso», nota, timer e barra), correzione alle tue stime, routine del giorno, le attività in ordine di priorità e le cinque curiosità più interessanti |
| **Attività** | Quattro sotto-schede: Tutte le attività (con i passi dei progetti e le esperienze), Progetti, Esperienze, Game design (idee di videogiochi) |
| **Intrattenimento** | Film, Serie, Anime, Giochi, Libri, Ricette, con «Cosa guardo stasera» |
| **Curiosità** | Cose da approfondire |
| **Routine** | Abitudini quotidiane o settimanali |
| **Inbox** | Note catturate al volo, ancora da smistare |
| **Altro** | Archiviate, Completato, Intelligenza artificiale, Regole della priorità, Aspetto, Account |

### 2.1 Telefono (colonna singola)

- **Cinque schede in basso** con icona e nome (Priorità, Attività, Intratten.[mento], Curiosità, Routine: «Intrattenimento» è abbreviato nella barra perché non entra), con una pillola dietro l'icona della scheda attiva; le icone ci sono solo sul telefono, la barra laterale del sito resta senza; e il pulsante tondo **«+»** (62 px) per la cattura rapida.
- In cima a ogni scheda principale tre pulsanti tondi: **Stile e aspetto** (tavolozza: tema e colore), **Inbox** (con il numero di note da smistare) e **Altro** (tre pallini).
- **Indietro (pila unica):** ogni spostamento è un livello di una pila: cambio di scheda o sotto-sezione, apertura di una schermata o di una voce, apertura di una finestra o di un menu a tendina (cattura rapida, scelta del mese, voto, Tipo, Sezione…). Il tasto indietro del telefono, quello del browser e il pulsante «Indietro» dell'app ripercorrono l'ordine inverso: prima si chiude la finestra aperta, poi si torna alla schermata precedente, poi alla scheda precedente. Sul sito la pila è agganciata alla cronologia del browser; nell'app Android è gestita dall'app stessa (la cronologia del WebView non era affidabile) e il tasto indietro del telefono arriva dal plugin `@capacitor/app`: a pila vuota esce dall'app (`web/src/App.tsx`, `useLayer` in `web/src/ui/nav.tsx`).
- L'app Android resta sempre in verticale.

### 2.2 Sito per schermi larghi (da 900 px)

Il sito usa lo spazio degli schermi larghi (breakpoint a 900 e 1300 px); sotto i 900 px è identico al telefono.

- **Barra laterale** al posto delle schede: in cima il nome dell'app, poi il campo **«Scrivi una nota…»** (scorciatoia N, vedi sotto) e la **ricerca generale** (scorciatoia /), poi, **subito sotto, la voce Inbox con il contatore** (voce principale come le altre, senza intestazione e **separata dalle sezioni da una linea sottile**, sopra le cinque sezioni, che nella barra non hanno icone: perché il campo nota alimenta proprio l'Inbox), poi le cinque sezioni principali con i conteggi (Attività con il totale; i gruppi Attività e Intrattenimento mostrano le loro sotto-sezioni solo quando sono attivi), Archiviate, Completato, Aspetto, Account, la versione e, solo se si è offline, lo stato di sincronizzazione. I selettori a schede delle sotto-sezioni spariscono perché li sostituisce la barra.
- **Contenuto centrato:** la barra resta a sinistra e tutto il resto (titolo e corpo) sta in una colonna larga al massimo 760 px, centrata nello spazio a destra; la griglia della settimana in Routine usa una colonna fino a 1120 px.
- **Dettaglio in finestra:** la voce si apre in una finestra in sovraimpressione al centro (fino al 96% dell'altezza), sopra la schermata corrente; si chiude con «Indietro», Esc o toccando lo sfondo. Anche la cattura rapida si apre al centro come finestra.
- **Campo nuova nota** (`web/src/ui/CampoNuovaNota.tsx`): al posto del vecchio pulsante «+ Nuova nota». Ha un contorno grigio sempre visibile che, mentre si scrive, diventa verde più spesso con un alone morbido, e il tasto a destra passa da «N» a «↵». Invio salva il testo così com'è come nota non assegnata in Inbox, senza finestre, e mostra «Salvata in Inbox · Apri»; Esc svuota il campo; mentre si scrive, sotto il campo compaiono le note con le stesse parole. Il «+» del telefono apre invece la finestra di cattura (3.8).
- **Ricerca** (`web/src/screens/Ricerca.tsx`): è la ricerca generale della barra laterale; sul sito le singole schede (Attività, Intrattenimento, Curiosità) non hanno una ricerca propria: per parole, senza maiuscole né accenti, nel titolo, nelle note, in «consigliato da» e «con chi», nelle zone e nelle checklist; le voci aperte vengono prima delle chiuse; si attiva da 2 lettere.
- **Scorciatoie da tastiera:** N (porta il cursore nel campo «nuova nota»), / (ricerca), Esc (svuota il campo, chiude finestra o ricerca). Non esistono J/K per scorrere né F per segnare fatto.
- **Oggi** è una sola colonna (titolo, «Inizia», routine, prime attività); **Routine** ha una griglia settimanale a sette colonne in cui si può spuntare qualsiasi giorno.
- **Sito pubblicato:** gira sull'immagine Docker sul NAS, quindi mostra le novità solo dopo commit, push e aggiornamento dell'immagine; l'app sul telefono si aggiorna con l'APK.

### 2.3 Estetica

- **Un solo colore d'accento**, scelto dall'utente tra **Verde** (predefinito), **Petrolio** e **Indaco**: usato per azione principale, scheda attiva, avanzamento, spunte, interesse. Un **colore d'avviso** (arancio) è riservato a scadenze fisse e voci scadute. Tutto il resto è neutro: sfondo caldo e superfici bianche (chiaro) o grigio scuro (scuro).
- **Altro › Aspetto:** tema Sistema / Chiaro / Scuro (di base **Chiaro** dalla 0.67.1; chi ha già scelto un tema lo conserva) e colore, con anteprima; si applica subito, si salva sul dispositivo e funziona offline (`web/src/lib/theme.ts`, attributi `data-theme` e `data-accent`; nell'app regola anche le icone della barra di stato).
- **Icona dell'app** (mockup 33, variante 5): fondo verde sfumato (#3FA97F → #1D5A42), due onde bianche tenui e un pallino bianco con la spunta verde scuro; ha sempre gli stessi colori, non segue l'accento scelto in Aspetto, e non ha livello monocromatico (quindi le icone a tema di Android non la ricolorano). File: `web/public/icon.svg` (sito, notifiche), `web/android/app/src/main/res/drawable/ic_launcher_background.xml` e `ic_launcher_foreground.xml` (icona adattiva, disegno nella zona sicura di 66 su 108), `desktop/build/icon.png` (app per computer, 512 px, ricavata da `icon.svg`).
- Angoli morbidi; l'ombra compare solo sull'elemento più importante. I colori di base hanno un buon contrasto verso lo sfondo (rapporto WCAG).
- **Gerarchia visiva in tre livelli:** grassetto grande = ciò che conta; testo normale = contesto; grigio piccolo = dettaglio.

| Token | Chiaro | Scuro |
|---|---|---|
| Sfondo | #F1F0EC | #0E0F12 |
| Superficie | #FFFFFF | #1D1F23 |
| Rilievo | #E3E1DC | #272930 |
| Linee | #DDDAD4 | #2F3138 |
| Testo | #111115 | #F3F3F6 |
| Secondario | #65656E | #A5A5B0 |
| Tenue | #919199 | #72737D |
| Accento Verde (predefinito) | #2F7D5B | #6FCF9B |
| Accento Petrolio | #0E7490 | #4FC3DD |
| Accento Indaco | #4F46E5 | #9A9EFF |
| Avviso | #D1430B | #FF9466 |

### 2.4 Componenti comuni delle liste

- **Riga** (`Row` in `web/src/ui/kit.tsx`): da sinistra a destra l'orario (solo nel piano di Oggi), il **pallino numerato della priorità**, il titolo con sotto la riga grigia che comincia con l'icona del tipo di nota, la scadenza e, all'estrema destra, la **casella di stato**. Il numero nel pallino è la posizione in classifica (1 = la prima da fare); il pallino ha il contorno nel colore del livello (arancio-rosso alta, ambra media, grigio bassa) e **batte** a ritmo di cuore, più veloce quanto più la scadenza è vicina: da 11 bpm (scadenza oltre 30 giorni) a 88 bpm (oggi o scaduta), calando di 2 punti percentuali a ogni posto in classifica, con i tratti legati alle soglie delle regole (6.1), fermo senza scadenza; il colpo dura sempre 0,45 s e con «Riduci animazioni» il pallino resta fermo (`battitoBpm` in `shared/priority.ts`, `web/src/lib/battito.ts`).
- **Casella di stato:** quadrato stondato neutro, uguale per tutte le note (anche passi di progetto e checklist). Con la nota (`voce`) ha quattro stati: un tocco avanza (da fare → in corso → fatta; fatta e archiviata tornano a da fare); la pressione lunga (450 ms) o il tasto destro aprono il foglio con tutti gli stati. «In corso» è mezza casella gialla, «archiviata» è tratteggiata. Le righe di routine e quelle senza nota restano a due stati. Una scadenza fissa mostra un lucchetto invece del pallino rotondo di scadenza.
- **Interesse** (1-5): nelle liste di Intrattenimento, Curiosità ed Esperienze è un pallino verde col numero, più pieno quanto più è alto; nella scheda è una barra verde (stessa forma dell'importanza).
- **Sezione** (`Sezione`): fascia con titolo grande in grassetto, chiusa sopra e sotto da una linea sottile, con il conteggio a destra e le righe libere sotto, senza contenitori. Usata in Oggi, Attività, Intrattenimento, Curiosità e Routine.
- **Gruppo di progetto** (`GruppoProgetto`): testata a cartella con nome (tocco = apre il progetto), avanzamento «fatti / totale» seguito dalla **stima del progetto** (la somma dei tempi stimati dei suoi passi ancora da fare, `stimaProgetto`: dipende dai passi, non si inserisce a mano; es. «1 / 4 · 2,5 ore») e barra; sotto i passi, con le stesse indentazioni delle righe normali.
- **Margine:** il margine delle tue stime ha un segno: **rosso** se positivo (conviene aggiungere tempo), **verde** se negativo (stai stimando più del necessario). Si vede nella scheda della nota, nel selettore del tempo e nell'animazione di completamento; **non** compare più sotto le singole note nelle liste (in studio un posto nella pagina Priorità, mockup 47).
- **Feedback aptico** (`web/src/lib/haptic.ts`): ogni tocco a un pulsante dà una vibrazione leggera, il segno di fatto una più marcata. Nell'app Android usa il plugin nativo `Haptica` (ampiezza 77 e 126, ridotta del 30% rispetto ai valori standard di Capacitor), nel browser del telefono `navigator.vibrate` (6 ms, 10 per il segno di fatto), sul computer nulla.
- **Animazioni** (solo CSS): dissolvenza dal basso delle schermate, righe in sequenza, scatto del segno di fatto, fogli che salgono, menu con leggero zoom, barre che si riempiono, pulsanti che si schiacciano. Con «Riduci animazioni» attivo nel sistema sono disattivate.

## 3. Schermate

### 3.1 Priorità (prima «Oggi»)

La scheda si chiama **Priorità** (nel codice resta `oggi`; il widget Android conserva il nome «Oggi»): non promette né un orario né di finire tutto in giornata, mostra solo le cose più prioritarie. Una lista semplice: in cima il pulsante **Inizia**, poi le routine del giorno, il gruppo **Attività** (le più prioritarie) e il gruppo **Curiosità**. Attività e curiosità restano in gruppi separati. Niente giorni da sfogliare né piano a orari.

- **Blocco del cronometro** (6.16, mockup 57): in alto a sinistra solo lo stato. **Senza nota in corso** compare solo «Nessuna nota in corso» (scheda tratteggiata, niente timer né pulsante). **Con una nota in corso** (una sola alla volta, attività o curiosità) compaiono il pulsante ▶, la nota (pallino di priorità, titolo, tempo previsto, casella) e, **sempre visibile**, la barra del tempo lavorato sul previsto (timer a sinistra, previsto a destra). Premendo ▶ **il timer grande scorre accanto al tasto** (verde) e la barra si riempie; con ⏸ il timer grande scompare e la barra resta con il tempo trascorso. Il cronometro parte dalla nota in corso; se si segna «in corso» un'altra nota, la precedente torna «da fare» e il cronometro (se c'è) passa alla nuova. Le altre note mostrano **accanto alla casella il tempo già lavorato** (es. «00:42:10»). Nessun pulsante «Ho finito di lavorare»: vale la pausa.
- **Aggiornamento del sito/app per computer:** ogni 10 minuti, all'avvio e al ritorno sulla finestra il sito confronta la sua versione con `/api/health`; se il server è più nuovo compare l'avviso «Nuova versione X disponibile» con «Aggiorna» (toglie service worker e cache e ricarica, i dati locali restano), ripetuto in Altro › Account (`web/src/lib/aggiornamento.ts`; non nell'APK). L'installer per Windows si chiama `MyTask-v<versione>.exe` (GitHub non accetta spazi nei nomi) e si scarica da una riga di Account (solo sito web, mockup 30 variante B3).
- **Note «in corso» in coda:** una nota segnata «in corso» che non è tra quelle scelte in automatico compare comunque in Priorità, in fondo alla lista (`vistaOggi`, dopo le altre, per posizione in classifica).
- **Blocchi fissi** (classe `fisso`, fuori dall'area che scorre, con un filo e un'ombra morbida sotto: mockup 31 variante A): in Priorità la scheda del cronometro (o «Inizia») con «Correzione alle tue stime»; in Attività, Intrattenimento e Curiosità il selettore delle sotto-schede e la barra di ricerca.
- **Nessuna nota «in corso»:** solo quando si tocca «Inizia» e né le attività né le curiosità hanno una nota «in corso» (non prima: non si sa su cosa lavorare finché non c'è il tempo), al posto del cronometro compare una scheda tratteggiata gialla («Nessuna nota in corso», spiega di toccare la casella di una nota; pulsanti «Parti dalla prima» e «Chiudi») e le caselle delle note da fare pulsano. Sparisce da sola appena una nota passa «in corso» (mockup 27, variante B).
- **Attività** (le più prioritarie; `vistaOggi`, 6.8): le **5 note con la posizione migliore** nella classifica unica (anche con una scadenza futura, così i numeri partono da 1), più le scadute o in scadenza oggi che restassero fuori; quelle di uno stesso progetto stanno sotto la testata del progetto. Il numero nel pallino è la posizione in classifica; la riga non cambia mai stile: sotto il task su cui corre il cronometro **si apre una barra** (si anima in apertura e in chiusura, passando alla nota successiva) con a sinistra il timer che scorre e a destra il tempo previsto, nello stesso font monospazio, sopra un filo sottile a tutta larghezza che parte dal bordo del pallino di priorità (giallo se in pausa, arancione oltre il previsto); ogni altro task già iniziato mostra nella riga grigia il **tempo lavorato sul previsto** («42 min su 1 h 20 min»).
- **Curiosità** (`curiositaDaSmaltire`, `vistaOggi().curiosita`): al massimo **cinque curiosità** (`MAX_CURIOSITA_OGGI`), le più interessanti e, a parità, quelle aggiornate da più tempo; le parcheggiate, le fatte e quelle in Inbox non compaiono. Stanno in un gruppo a parte, dopo «Attività», **senza numero di priorità** (hanno un interesse, non un'importanza, quindi non entrano nella classifica né nel widget né in «Inizia»): riga con il pallino verde dell'interesse, il tempo stimato e la prima riga della nota. La casella le segna come approfondite, il tocco apre la nota.
- **Tocco su una riga:** apre sempre la scheda della nota, senza menu: non serve scegliere su quale nota lavorare, perché il cronometro parte dalla prima della lista e passa da solo alla successiva quando si completa una nota. La casella a destra completa il task.
- **Routine di oggi** (chip da spuntare) e, sul telefono, lo stato di sincronizzazione (solo se si è offline o ci sono modifiche in attesa).
- **Telefono:** in cima Aspetto, Inbox (con contatore), Altro e «+». **Sito largo:** niente pulsanti tondi, il riepilogo sta nel titolo.

### 3.2 Attività

Intestazione con i conteggi reali («N attività · N progetti · N esperienze») e, **solo sul telefono**, una ricerca comune alle sotto-schede (`cercaVoci`: tutte le parole devono comparire; filtra anche i passi dei progetti); sul sito c'è la ricerca generale. Le quattro sotto-schede hanno un carattere compatto per entrare in una riga.

- **Tutte le attività:** nella riga del titolo compare il **tempo stimato per completarle tutte**, in giorni e ore («3 giorni 13 ore, 12 senza stima»; il numero delle attività non si ripete, è già nell'intestazione della scheda; un giorno = 24 ore; somma dei tempi stimati, passi dei progetti compresi; segue la ricerca); tutte le attività aperte (comprese le scadute) in ordine di priorità, con i task dei progetti raggruppati sotto la testata del progetto; il numero d'ordine resta quello della classifica completa anche con la ricerca. Sotto, le esperienze. Le archiviate non compaiono.
- **Progetti:** un gruppo per progetto con tutti i suoi passi (aperti per priorità, poi i completati barrati).
- **Game design:** le idee di videogiochi che l'utente vuole realizzare, in **ordine di priorità** (6.15). Sono note di tipo `gamedesign` («Game design» nella tendina Tipo) con interesse, tempo stimato, difficoltà e note libere; senza date: non compaiono in Oggi né nel piano. La riga mostra tempo, difficoltà e il punteggio di priorità.
- **Esperienze:** un selettore sceglie l'ordine (si ricorda in `mytask.esperienze.ordine`): **Data** (di base: «Con data» poi «Senza data»), **Luogo** (una sezione per luogo, «Senza luogo» in fondo), **Interesse** (un'unica lista dal più al meno interessante) e **Per te** (sezione 6.9).

### 3.3 Intrattenimento

Sei sotto-schede (Film, Serie, Anime, Giochi, Libri, Ricette), tutte della stessa larghezza, con ricerca sul telefono (titolo, note, campi di testo) e filtro per piattaforma. Le voci sono ordinate per interesse. Per film, serie e anime c'è **«Cosa guardo stasera»** (sezione 6.10).

### 3.4 Curiosità

Scheda propria (ricerca solo sul telefono). Ogni riga mostra l'interesse; una curiosità «da fare» si legge «da approfondire». Le curiosità hanno il campo **tempo stimato** (facoltativo).

### 3.5 Routine

Le abitudini non sono task: non scadono e non finiscono (sezione 6.7). Una sezione per fascia della giornata (Mattina, Pomeriggio, Sera, Prima di dormire) e **Parcheggiate** per quelle messe da parte. Ogni riga ha i sette giorni della settimana; **una routine si disattiva** dalla sua scheda con l'interruttore **Attiva** (spenta passa in «Parcheggiate» e non compare in Oggi; da lì «Attiva» la riporta); sul sito largo c'è la griglia della settimana in cui si spunta qualsiasi giorno.

### 3.6 Inbox, Archiviate, Completato

- **Inbox:** note da smistare, la più recente prima. Si smistano aprendole e scegliendo il tipo. Righe normali (titolo e riga grigia).
- **Archiviate** (Altro): note con stato «archiviata»; non compaiono nelle liste e si ripristinano aprendole.
- **Completato** (Altro): note fatte o saltate (non routine né passi), con filtro per tipo, sezioni per mese e voto a destra; la spunta riapre la nota.

### 3.7 Altro e impostazioni

- **Intelligenza artificiale** (`IA`, `Chat`): sezione 6.12.
- **Regole della priorità** (`PesiPriorita`, etichetta «Sperimentale»): sei barre (importanza, giorni di scadenza e posizioni per il rosso e per l'ambra), il selettore dell'ordine dentro lo stesso colore e l'anteprima delle prime sei attività; si sincronizzano e cambiano subito liste, colori, battito e widget (6.1).
- **Aspetto:** sezione 2.3.
- **Account:** email, ultima sincronizzazione (lo stato compare solo se si è offline, si sta sincronizzando o ci sono modifiche da inviare: non c'è più «Tutto sincronizzato»), riepilogo delle voci locali (totale con aperte / completate / archiviate, conteggio per tipo e possibili doppioni, cioè voci dello stesso tipo e titolo a parità di progetto; il totale comprende tutto, anche completate, archiviate e passi dei progetti), versione dell'app e del server (con avviso se diverse), «Sincronizza ora», esci. Non ci sono esportazione e importazione JSON.
- La versione compare anche nella schermata di accesso e in Altro.

### 3.8 Cattura rapida

Il «+» del telefono apre «Cosa ti è venuto in mente?» (sul sito si scrive direttamente nel campo della barra laterale, 2.2). Il testo **non viene interpretato** (nessun tipo, data o persona dedotti, nessuna IA): «Salva in Inbox» (o Invio) crea una nota **«Non assegnata»** (tipo `nota`, `inbox: true`). Mentre si scrive compaiono **tutte le note che contengono le stesse parole**, anche in forme diverse (stessa radice: «pagare» e «pagamento»), con tipo e stato, per capire subito se la nota esiste già; toccandone una si apre (`cercaSimili` in `shared/views.ts`). Sul telefono l'elenco sta sopra il box di scrittura (che resta in basso), sul sito sotto. C'è anche la dettatura, dove il browser la offre. Funziona offline. La cattura è la stessa nel widget (sezione 7.4).

## 4. Scheda di una voce

La scheda (`ItemDetail`) salva da sola dopo 500 ms e all'uscita; non salva senza titolo. Dall'alto:

1. **Stato** (solo per voci già salvate, non routine né note non assegnate): selettore a quattro segmenti **Da fare, In corso, Fatta, Archiviata** (sezione 6.2).
2. **Blocco della priorità** (collassabile, ricorda l'ultima scelta in `mytask.prio.aperta`; chiuso di base): la **posizione** in classifica («3ª da fare su 28», senza punteggio) con il livello (alta/media/bassa) e il contorno nel colore del livello; aperto, cinque barre con il peso di urgenza, importanza, poco sforzo, età e scadenza fissa, e una riga con scadenza, importanza a parole e tempo con margine.
3. **Titolo**, **Tipo** e, per l'intrattenimento, **Sezione** (due tendine che si chiudono a vicenda con la pila). I tipi scelti sono Attività, Progetto, Esperienza, Routine, Intrattenimento (Film, Serie, Anime, Gioco, Libro), Ricetta, Curiosità, Game design. La tendina si espande per mostrare tutte le voci, senza scorrimento. Una nota **non assegnata** ha solo titolo, note, link e immagini: scegliendo un tipo lascia l'Inbox.
4. **Campi per tipo:**
   - **Attività** e **Progetto**: un solo gruppo con Progetto (solo per le attività: tendina dell'app con icona, leggibile anche sul sito e scorrevole se i progetti sono molti; «Nessuno» se non collegata), Data, **Scadenza fissa** (appena c'è una data), Importanza (slider continuo da 1 a 5 a cuneo grigio→rosso, anche 3,4; **non si chiede per un'attività collegata a un progetto**: vale quella del progetto, e scegliendo il progetto il valore proprio si toglie), **Tempo stimato** (solo per le attività: in un progetto dipende dai passi, quindi il campo non c'è; si sceglie con le rotelle, vedi sotto) con margine e suggerimento «Usa», promemoria (7 giorni, 3 giorni, 1 giorno prima, il giorno stesso, alle 9:00) e «Ripeti».
   - **Progetto**: subito sotto la barra dell'importanza ci sono i **passi** («Passi · X su Y», con barra a tacchette; non c'è più un blocco «Checklist» a parte) con le righe e i passi già esistenti, tutti spuntabili e **riordinabili trascinando** (dalla maniglia subito, con pressione lunga di 380 ms sul dito, con clic e trascinamento col mouse); «Aggiungi un passo». L'ordine è anche la priorità e la dipendenza (sezione 6.6).
   - **Esperienza**: Data, Interesse, **Luogo** (campo `zona`, con sotto come chip i luoghi già usati, dal più usato; si restringono mentre si scrive) e «Apri in Google Maps» (cerca il nome).
   - **Curiosità**: Interesse e Tempo stimato (15 minuti di base, si può togliere).
   - **Game design**: gruppo «Idea» con **Interesse** (1-5), **Tempo stimato** e **Difficoltà** (1 = facile, 5 = molto difficile) e, in sola lettura, la **Priorità** calcolata («72 su 100 · 2ª su 5»); la descrizione dell'idea sta nelle note.
   - **Film, serie, anime**: Interesse, Piattaforma (con chip delle già usate più Prime Video e Disney+), Genere/Tipologia, Mood ed Energia richiesta; serie e anime anche Consigliato da, Con chi e Durata in minuti (il film non li ha: la durata arriva dall'arricchimento).
   - **Gioco**: Interesse e Durata in ore (salvata in minuti: 12,5 ore).
   - **Libro**: Interesse e **Pagine** (cercate da sole su Open Library dal titolo, correggibili).
   - **Ricetta**: Interesse e Genere a scelta multipla (Antipasto, Primo, Secondo, Contorno, Dolce, Piatto unico, Zuppa, Pane e lievitati, Bevanda), salvato come elenco separato da virgole.
   - **Routine**: interruttore **Attiva** (spento = «Parcheggiate»), Momento della giornata, Frequenza (volte a settimana), Obiettivo minimo, ora del promemoria.
5. **Note** con i pulsanti «＋ Link» e «＋ Immagine»: i link si aprono dall'elenco e si tolgono con ✕; le immagini sono rimpicciolite (lato massimo 960 px, JPEG, fino a circa 70 KB ciascuna e 130 KB per voce, perché sul server una voce non può pesare più di 200 KB), salvate dentro la voce (`immagini`) e ingrandite con un tocco.
6. **Cronologia** (voce salvata): Creata (es. «ven 16 ott · 14:32»), In corso dal, **Tempo lavorato** (il tempo del cronometro sul previsto, es. «42 min su 1 h 20 min», con la barra e, se il cronometro corre su quella nota, «in lavorazione adesso»), Completata e Tempo trascorso (es. 18 h 38 min).
7. **Completata** (voto e commento, per l'intrattenimento) e il pulsante **Elimina** (cancellazione logica).

**Tempo stimato** (`CampoTempo`): **non si scrive a mano**; il campo mostra il valore (o «Scegli») e toccandolo si apre il foglio con tre rotelle (giorni 0-30, ore 0-23, minuti a passi di 5; un tempo già salvato fuori passo resta scegliibile). Un giorno vale 24 ore; l'avviso «Più di un giorno» compare solo oltre le 24 ore. Sul sito (da 900 px) le rotelle sono alte 280 px invece di 160.

**Voto e commento:** segnando come fatto un film, un libro, un gioco o simili si apre «Com'è andata?» con il voto da 1 a 10 e un commento facoltativo; la voce risulta fatta quel giorno.

**Avanzamento del progetto:** completando un passo si apre per circa 4 secondi il pannello del progetto (foglio sul telefono, finestra al centro sul sito): il passo si spunta con un rimbalzo, la barra passa da «N su M» a «N+1 su M», poi il pannello si richiude da solo (o con un tocco o «indietro»). Con «Riduci animazioni» non si vede.

## 5. Modello dati

Un'unica tabella **Elemento** (`Item` in `shared/types.ts`) con un campo `tipo`. Sul server ogni voce è un documento JSON con un numero di sequenza per la sincronizzazione; sul dispositivo sta in IndexedDB. I campi sono opzionali tranne `id`, `tipo`, `titolo`, `stato`, `creato`, `aggiornato`.

| Campo | Note |
|---|---|
| `tipo` | azione, progetto, esperienza, routine, film, serie, anime, gioco, libro, ricetta, curiosita, gamedesign (idea di videogioco); `nota` = non assegnata (Inbox); `persona` solo nei dati vecchi (eliminate all'avvio) |
| `stato` | `da_fare`, `in_corso`, `fatto`, `saltato` (conta come fatta), `parcheggiato` (= archiviata). **«Scaduto» non è uno stato**: si calcola da data e stato |
| `creato`, `aggiornato` | millisecondi; `aggiornato` decide chi vince nella sincronizzazione |
| `eliminato` | cancellazione logica: la voce resta, così la cancellazione arriva agli altri dispositivi |
| `inbox` | catturata ma non ancora smistata; si toglie scegliendo un tipo |
| `note`, `link[]`, `immagini[]` | link ammessi anche a file su Seafile; immagini come testo `data:` ridotte |
| `inizio`, `fine`, `oraInizio`, `oraFine` | date YYYY-MM-DD e orari HH:MM; la scadenza è `fine`, altrimenti `inizio`; se c'è un'ora la nota è un impegno con orario fisso nel piano |
| `rigida` | scadenza fissa (non spostabile; in interfaccia «scadenza fissa») |
| `ricorrenza`, `promemoria[]`, `insisti` | ricorrenza ogni N giorni/settimane/mesi/anni; promemoria a N giorni dalla scadenza; insistenza ogni N minuti |
| `importanza` (1-5, anche decimali), `sforzoMin`, `durataRealeMin` | attività e progetti; tempo stimato in minuti (anche per curiosità e game design); tempo reale misurato per affinare la stima |
| `difficolta` (1-5) | game design: 1 = facile, 5 = molto difficile |
| `interesse` (1-5) | intrattenimento, esperienze, curiosità e game design |
| `padreId`, `ordine`, `checklist[]` | un passo ha il progetto come padre e una posizione nel progetto (0 = il primo); checklist = righe da spuntare dentro un progetto |
| `zona`, `linkMaps` | esperienze: il «Luogo» (`zona`) e, se presente, un link Google Maps da cui leggere le coordinate |
| `piattaforma`, `consigliatoDa`, `conChi`, `durataMin`, `genere`, `mood`, `energia`, `pagine` | intrattenimento; `genere`, `mood`, `energia`, `durataMin`, `pagine` si compilano anche da soli (6.11) |
| `arricchitoIl`, `descrittoIl` | quando si è cercato su internet genere/mood/durata e la descrizione |
| `voto`, `commento`, `completatoIl`, `completatoTs` | completamento (giorno e millisecondi) |
| `lavoratoMs` | millisecondi realmente lavorati sul task con il cronometro «Inizia» (6.16) |
| `inCorsoTs` | quando la nota è passata «in corso» |
| `fascia`, `volteSettimana`, `obiettivo`, `oraPromemoria`, `log[]` | routine: momento della giornata, quota settimanale, obiettivo minimo, ora del promemoria, giorni in cui è stata fatta |
| `persone[]`, `area`, `luogo`, `daContattare` | non più usati dalle schermate: restano nei dati già salvati (`persone` e checklist non dei progetti sono spostate nelle note all'avvio) |

**Conversione dal vecchio Priority di Notion (per l'import):** Very high → 5, High → 4, Medium → 3, Low → 2, Very low → 1 (importanza per le attività, interesse per l'intrattenimento); vuoto → 3 per l'intrattenimento.

## 6. Regole principali

### 6.1 Priorità (`shared/priority.ts`)

**Nessun punteggio da 0 a 100** (tolto dalla 0.67.2): colore del pallino, ordine e battito nascono dalle **regole** di Altro › Regole della priorità (`RegolePriorita` in `shared/priority.ts`, sincronizzate tra i dispositivi con la chiave `regole`, `web/src/lib/pesi.ts`). I tre segnali, vale il più alto:

- **Importanza** impostata (da 1 a 5, di base 3; si imposta a doppio livello con `ImportanzaDoppia`: un grado e poi lo slider a cuneo che rifinisce dentro il grado, per esempio 4,20; un passo di progetto eredita quella del progetto).
- **Scadenza:** giorni alla data (scaduta e oggi comprese); senza data non conta.
- **Posizione** nella classifica unica.

Colore (`livelloPriorita`): **rosso** se importanza ≥ 4,5, scadenza entro 5 giorni o tra le prime 3; **ambra** se importanza ≥ 3, scadenza entro 7 giorni o tra le prime 10; **grigio** il resto. Sono i valori di base: in Regole della priorità ci sono sei barre (importanza, giorni e posizioni per il rosso e per l'ambra; l'ambra non è mai più severa del rosso) e un selettore dell'ordine.

Ordine (`chiavePriorita`, una chiave di confronto, non un punteggio): prima tutte le rosse, poi le ambra, poi le grigie (calcolate senza la posizione, che nasce dall'ordine e può solo alzare il colore); dentro lo stesso colore, a scelta **la scadenza più vicina** (di base; a parità l'importanza più alta) oppure **l'importanza più alta** (a parità la scadenza); poi scadenza fissa, attività brevi, note più vecchie. Così nessuna nota gialla sta sopra una rossa.

**Battito del pallino** (`intensitaBattito`): segue il colore. Le note grigie non battono; **tutte le rosse battono** (almeno circa 43 bpm, anche senza scadenza) e le ambra piano (circa 22 bpm); più la scadenza è vicina più sale: 88 bpm oggi o scaduta, 11 a 30 giorni (scala 10-80 aumentata del 10%). In più il battito **cala di 2 punti percentuali per ogni posto** in classifica (al massimo del 30%). Cambia con le barre.

**Posizione in classifica** (`elencoPriorita`, `classificaPriorita`, `posizionePriorita` in `shared/views.ts`): **una sola classifica per tutte le note e i progetti**, calcolata sempre sull'insieme completo e mai sulle voci della schermata aperta. Contiene ogni attività aperta (i passi dei progetti uno per uno), per punteggio; a parità vince il gruppo (progetto o nota) creato prima e dentro un progetto restano i passi nell'ordine scelto. Un progetto ha la posizione del suo passo più avanti; esperienze, curiosità, Inbox e progetti senza passi non hanno posizione. Il numero di una nota è lo stesso in Priorità, Attività, nella lista dei passi del progetto, nella scheda e nel widget.

L'intrattenimento non ha punteggio di urgenza: si ordina per **interesse**.

### 6.2 Stati di una nota

Quattro stati visibili: **Da fare** (`da_fare`), **In corso** (`in_corso`), **Fatta** (`fatto`, anche `saltato`), **Archiviata** (`parcheggiato`). Logica in `cambiaStato` e `avanzaStato` (`web/src/lib/actions.ts`):

- «Fatta» passa sempre da `completaVoce` (voto, durata misurata, ricorrenze, avanzamento dei progetti, messaggio con «Annulla»); riaprire una nota fatta usa `riapri` (toglie giorno e ora di completamento).
- Quando una nota passa «in corso» si salva `inCorsoTs`; torna vuoto se la nota torna «da fare».
- **Archiviare un progetto archivia anche i suoi passi aperti**; ripristinarlo (da fare o in corso) riporta «da fare» i passi archiviati. Il messaggio ha «Annulla» che rimette tutto com'era.
- **Scaduto** non è uno stato: le voci scadute restano nelle liste e nel piano con la data in arancio (non esiste una schermata di revisione).

### 6.5 Stima e tempo impiegato

- **Margine** (`shared/stima.ts`): è il **tempo da aggiungere alle tue stime**, con segno. Parte da **0%** (nessun dato, nessuna correzione) e, dopo ogni attività completata con stima e tempo reale (nell'ordine di completamento), si sposta del **35% della differenza** tra reale e stimato in proporzione alla stima: stima 60 min, reale 30 → −50% × 35% = −17,5 punti (da 0% a −17,5%, verde); reale 90 → +17,5 punti (+17,5%, rosso). Resta tra −50% e +150%. Il tempo da mettere in conto è stima × (1 + margine).
- **Stima per titoli simili:** per una nuova nota l'app cerca attività simili già fatte (somiglianza tra le parole del titolo, fino a 5), usa la mediana dei loro tempi reali e mostra il margine generale; nella scheda compare un suggerimento con «Usa».
- **Tempo misurato dall'app:** non si chiede «Quanto ci hai messo?». Il tempo reale (`durataRealeMin`) è quello del cronometro «Inizia» (`lavoratoMs` della nota, almeno 30 secondi per contare come misura). Senza cronometro non si registra nessuna durata. Il messaggio dopo il completamento dice, ad esempio, «Fatto in 1 h 30 (stimati 2 ore)».

### 6.6 Progetti e passi

1. **Un solo livello:** un passo non può avere figli.
2. **Il progetto non compare in Oggi: compare il suo prossimo passo**, il primo passo aperto in ordine (`prossimoPasso`), con l'importanza (sempre quella del progetto) e la scadenza ereditate dal progetto (`withInheritance`). Un progetto senza passi compare come voce a sé.
3. **Avanzamento calcolato** («3 su 8») dai passi completati; mai inserito a mano.
4. **Ordine = priorità e dipendenza:** i passi si riordinano trascinando e l'ordine è salvato in `ordine`; un passo non ha priorità più bassa dei successivi (`punteggioEffettivo` dà a ogni passo aperto il punteggio più alto tra il suo e quello dei successivi), e questo vale per liste, piano e widget.
5. **Checklist o passo?** Una riga con solo un nome da spuntare è una **checklist** interna; con data, note o priorità proprie è un **passo** (voce figlia). Solo i progetti (e i giochi, come obiettivi) hanno la checklist.
6. Completando l'ultimo passo non si chiude il progetto da solo; nessun avviso per i progetti fermi.
7. **Nelle collezioni** i figli sono obiettivi, non task: non finiscono in Oggi.

### 6.7 Routine (`shared/routine.ts`)

- Una routine ha una **fascia della giornata** e una frequenza flessibile (volte a settimana), più un obiettivo minimo piccolo («leggere 10 minuti») per abbassare l'attrito.
- Compare in «Routine di oggi» solo nei giorni utili (giornaliera, oppure a quota settimanale finché la quota non è raggiunta), con una spunta singola; i giorni fatti stanno in `log`.
- Nessuna colpa sui giorni saltati: si guardano i conteggi settimanali, non le serie perfette.
- Una routine si **disattiva** con l'interruttore «Attiva» della sua scheda: resta in **Parcheggiate** (stato archiviata) e non compare in Oggi finché non viene riattivata («Attiva» nella riga o l'interruttore).

### 6.8 Cosa compare in Priorità (`vistaOggi`)

1. **Routine** del giorno.
2. **Da fare:** tutte le note con scadenza oggi o già scaduta (senza limite di giorni, anche se più di 5), più le note senza data con il punteggio più alto fino a un massimo di 5 in tutto; a parità vengono prima quelle «in corso».
3. Di un progetto compare solo il prossimo passo.
4. Le **esperienze senza data** non compaiono mai in Oggi: sono una lista di desideri.
5. Le archiviate e le note in Inbox non compaiono.
6. **Curiosità:** fino a cinque curiosità (3.1), in un gruppo separato dalle attività.
7. Non c'è un piano a orari: da questa lista parte «Inizia» (6.16).

### 6.9 Esperienze «Per te» (`shared/esperienze.ts`)

Una lista ordinata da un punteggio che unisce **interesse** (40%), **data più vicina** (35%: oggi 100%, poi 90, 75, 50, 25; senza data un valore neutro; già passata, bassa) e **distanza** dalla tua posizione (25%: 100% sul posto, circa metà a 20 km). Se posizione o luogo non sono noti la distanza non conta e interesse e data pesano metà ciascuno. Nelle righe compare «a N km».

- **Posizione:** si chiede al telefono (permessi `ACCESS_COARSE_LOCATION` e `ACCESS_FINE_LOCATION`); resta sul dispositivo e non viene inviata; vale 10 minuti, si aggiorna con «Aggiorna posizione». Senza permesso l'ordine usa solo interesse e data.
- **Luoghi:** le coordinate vengono dal link Google Maps della nota se le contiene, altrimenti si cerca il nome del luogo (o il titolo) su OpenStreetMap (Nominatim, una richiesta al secondo, solo il nome va su internet). Il risultato, anche «non trovato» (riprovato dopo 7 giorni), si ricorda nel telefono (`mytask.luoghi`).

### 6.10 Cosa guardo stasera (`shared/stasera.ts`)

Per film, serie e anime, **senza IA**: punteggi euristici. I filtri sono Con chi (Da solo, Con il partner, Con amici), Piattaforma (quelle già usate più Prime Video e Disney+), Mood (Spensierato, Rilassante, Emozionante, Intenso, Riflessivo), Energia che hai stasera (Bassa, Media, Alta) e Tipologia (Comico, Drammatico, Azione, Thriller, Horror, Fantascienza, Fantasy, Animazione, Documentario). I filtri spostano il punteggio senza escludere: le voci senza il dato restano neutre. Compaiono una proposta principale con «Lo guardo» (mette la voce «in corso») e «Un altro», più due alternative.

### 6.11 Arricchimento da internet (`shared/arricchimento.ts`, `web/src/lib/arricchimento.ts`)

Quando una voce di film, serie, anime, gioco o libro ha dati mancanti, l'app li cerca in background: **genere** (per film, serie e anime la tipologia dell'app; per giochi e libri il testo trovato), **mood** ed **energia** (ricavati dai generi con regole fisse), **durata** dei film, **pagine** dei libri e una breve **descrizione** (prime frasi di Wikipedia, messa nelle note se sono vuote). Fonti: Wikidata e Wikipedia (gratuite e senza chiave; va solo il titolo) e Open Library per le pagine. Non si sovrascrive mai ciò che l'utente ha scritto. Parte all'apertura, a ogni modifica, al ritorno della rete e ogni 30 minuti, una voce alla volta con una pausa (circa 1,6 s) e gestione del limite di richieste; `arricchitoIl` ricorda la ricerca (una voce non trovata si riprova dopo 30 giorni). Se il titolo corrisponde a un omonimo sbagliato i campi si correggono a mano.

### 6.12 Intelligenza artificiale (`web/src/lib/ia.ts`, `shared/ia.ts`)

Facoltativa e **scelta dall'utente**: in Altro › Intelligenza artificiale si inserisce la chiave di Gemini (Google AI Studio) e/o di Groq (console.groq.com) e, se serve, il modello (di base `gemini-2.0-flash` e `llama-3.3-70b-versatile`). «Salva e controlla» prova la chiave. Le chiavi stanno solo nel dispositivo (`localStorage`, `mytask.ia`, mai sincronizzate) e le chiamate partono dal dispositivo verso il servizio scelto, **senza passare dal server di MyTask** (che non ha funzioni IA).

- **Chat:** con Gemini, Groq o entrambe (due risposte). Il pulsante «Condividi un riepilogo delle mie note» è spento di base: se acceso, alla richiesta si aggiunge un riepilogo compatto (conteggi, attività più prioritarie, esperienze, film e serie da vedere, senza note e testi lunghi). La conversazione non viene salvata.
- **Autocompila le opere:** passa in rassegna film, serie, anime, giochi e libri senza tipologia, a gruppi di 15 titoli con una pausa tra le richieste (con «Ferma»), e compila la tipologia (solo valori noti all'app) e, per film, serie e anime, mood ed energia. Non cambia mai quello che c'è già; al servizio vanno solo titolo, tipo e piattaforma.
- Le note sensibili (banca, salute, contratti) non partono mai da sole: l'autocompilazione invia solo titolo, tipo e piattaforma delle opere, la chat solo ciò che l'utente scrive più il riepilogo, se acceso.

### 6.13 Promemoria e notifiche

- Si scelgono nella scheda di ogni voce (7 giorni, 3 giorni, 1 giorno prima, il giorno stesso, alle 9:00); non sono mai impostati in automatico. Possono essere ripetuti; l'**insistenza** ripete il promemoria ogni N minuti finché la voce non viene spuntata o rimandata.
- **App Android:** notifiche locali programmate nel telefono (`shared/pianifica.ts` calcola quelle dei prossimi 14 giorni: promemoria, insistenza fino a 12 ripetizioni, routine all'ora scelta, richiesta serale degli orari). Arrivano anche ad app chiusa e senza rete; si riprogrammano a ogni modifica dei dati (con 2 s di attesa) e al ritorno nell'app. Il permesso si chiede al primo avvio e, se negato, si riattiva dalle impostazioni di Android.
- **Sito:** `Notification` del browser, finché la pagina è aperta (controllo ogni 30 s).

### 6.14 Priorità del Game design (`shared/gamedesign.ts`)

Punteggio da 0 a 100 che mescola tre parametri, con pesi **interesse 50% › tempo stimato 30% › difficoltà 20%**: si fa prima ciò che interessa di più, è più breve ed è meno difficile.

- **Interesse:** da 1 a 5 riportato su 0-100 (di base 3).
- **Tempo stimato:** scala logaritmica da 1 ora (100) a 30 giorni (0); oltre i limiti vale come il limite.
- **Difficoltà:** 1 (facile) = 100, 5 (molto difficile) = 0.
- Un parametro non compilato vale 50 (neutro: né premia né penalizza). Idea perfetta = 100, peggiore = 0.
- La lista (sotto-scheda Game design) è in ordine di punteggio, a parità vince l'idea più vecchia; archiviate e bozze in Inbox non compaiono. La scheda mostra «punteggio su 100 · posizione su totale».

### 6.15 Sincronizzazione e offline

- I dati vivono nel dispositivo (IndexedDB: voci, coda delle modifiche in attesa, `auth` e `since`). La UI legge l'archivio locale e funziona senza rete.
- `POST /api/sync` con `since`, le modifiche in coda e le impostazioni; il server risponde con le voci cambiate, `seq` e le impostazioni. Parte 1,2 s dopo una modifica, al ritorno della rete o in primo piano e ogni 60 s. Un 401 cancella il token ma lascia i dati.
- Utente unico: conflitti risolti **per voce** con la modifica più recente (`aggiornato`); una voce remota non sovrascrive una modifica locale più recente. Le cancellazioni sono logiche.
- Il database sul NAS è il riferimento. Il server ne salva una copia al giorno nel volume Docker (le ultime 14); il backup vero lo gestisce l'utente con gli strumenti del NAS. Dall'app non c'è più l'esportazione JSON.
- All'avvio e a ogni sincronizzazione (`web/src/lib/migrazioni.ts`, `shared/migrazioni.ts`): `persone` e le checklist non dei progetti passano nelle note, la checklist di un progetto finita nelle note torna nel campo, le note in Inbox create come attività e mai toccate diventano «non assegnate».

### 6.16 Sessione di lavoro («Inizia») (`shared/sessione.ts`, `web/src/lib/sessione.ts`)

Un solo cronometro alla volta, che corre su un task. Stati: **ferma**, **lavoro** (il cronometro corre) e **pausa** (fermo, sessione aperta). Il tempo di ogni task si accumula in `lavoratoMs` e alla fine diventa il tempo reale che affina stima e margine d'errore (6.5).

- **Avvio:** «Inizia» (in Oggi o nel widget) parte sul primo task della lista, senza cambiarne lo stato (il cronometro può correre anche su una curiosità). Il task passa a «in corso» solo quando il cronometro si sposta su un altro (Non ora, completamento).
- **Tempo lavorato e previsto:** per ogni task già avviato si vedono il tempo lavorato e, se c'è una stima, quanto ne è passato sul totale previsto (nella scheda del cronometro con una barra, nelle righe di Oggi, nella Cronologia della nota e nel widget). Il salvataggio automatico della scheda non sovrascrive mai il tempo lavorato aggiornato dal cronometro.
- **Completare un task** (casella): se il cronometro correva su di lui, il tempo contato diventa il suo tempo reale e il cronometro **passa da solo al successivo** della lista (restando in pausa se era in pausa); se la lista è finita la sessione si chiude. Completare un altro task non sposta il cronometro.
- **Cambiare task:** «Lavora su questo» sposta il cronometro; il primo resta «in corso» con il tempo accumulato. «Non ora» passa al successivo senza completare.
- **Pausa e fine:** ⏸ ferma il cronometro (▶ riprende dallo stesso task); «Ho finito di lavorare» chiude la sessione senza completare nulla.
- **Controllo periodico:** dopo 45 minuti senza conferme l'app chiede «Stai ancora lavorando?» (anche con una notifica locale su Android): «Sì», «Ho smesso 15 minuti fa» / «30 minuti fa» / «un'ora fa» (il tempo conta solo fino a quel momento e la sessione va in pausa) o «Ho finito di lavorare». Così una dimenticanza non rompe la misura.
- **Coerenza:** se il task su cui si lavora viene archiviato, eliminato o completato altrove, la sessione passa al successivo.
- **Sincronizzazione:** lo stato della sessione viaggia come impostazione (`sessione`, vince la più recente), quindi telefono e sito vedono lo stesso cronometro; `lavoratoMs` viaggia con le voci.

## 7. Architettura

| Parte | Scelta |
|---|---|
| Hosting | Un container Docker su un NAS. L'immagine è costruita da GitHub Actions e pubblicata su `ghcr.io/jstplink/mytask`; il NAS la scarica, senza costruire nulla in locale |
| Backend | Node.js 24 con Fastify e SQLite integrato (`node:sqlite`, nessuna dipendenza nativa); TypeScript eseguito direttamente, senza passaggio di compilazione |
| Frontend | React + Vite, web app installabile (PWA) con archivio locale in IndexedDB e service worker |
| App Android | Capacitor (PWA impacchettata in APK) con notifiche locali e widget «Oggi» |
| Accesso | Email e password; HTTPS e accesso da fuori casa tramite **Cloudflare Tunnel** con un sottodominio dedicato |
| IA | Nessuna sul server: Gemini e Groq con chiavi dell'utente, chiamati dal dispositivo (6.12) |
| Documenti | Solo collegamenti a Seafile, incollati a mano |
| Calendario | Dati pronti (inizio, fine, orario); modulo Google Calendar **non scritto** (richiederà consenso OAuth e un indirizzo HTTPS raggiungibile) |

### 7.1 Server (`server/src`)

- `config.ts` legge le variabili d'ambiente (`MYTASK_EMAIL`, `MYTASK_PASSWORD`, `MYTASK_PORT`, cartella dati, origini CORS…). `index.ts` apre il database, fa una copia subito e poi ogni 24 ore (`mytask-AAAA-MM-GG.db`, ultime 14) e mette in ascolto l'app. `db.ts`: SQLite con documenti JSON e numero di sequenza, tabelle utenti, sessioni e `settings`. `auth.ts`: password con scrypt, token di sessione salvati come hash SHA-256, limite di 8 tentativi sbagliati ogni 15 minuti.
- `app.ts` espone: `GET /api/health` (con la versione), `POST /api/auth/login` (verifica sempre un hash per non rivelare con i tempi se l'email esiste), `POST /api/auth/logout`, `GET /api/me`, `POST /api/sync` e serve l'interfaccia web compilata (con ripiego su `index.html`, senza uscire dalla cartella). Sessioni di 180 giorni; una voce può pesare al massimo 200 KB; le impostazioni sono al massimo 10 chiavi da 20 KB. Il primo avvio crea l'unico utente dalle variabili d'ambiente. Intestazioni di sicurezza su ogni risposta.
- **CORS:** ammesse le origini dell'app (`https://localhost`, `http://localhost`, `capacitor://localhost`) e quelle in `CORS_ORIGINS`.
- **Sicurezza:** con il tunnel Cloudflare l'app è raggiungibile da Internet, quindi il login è obbligatorio. **Cloudflare Access** davanti all'app è una decisione aperta: l'app Android non riuscirebbe più a collegarsi senza le credenziali di servizio di Cloudflare. Il NAS ha un processore di fascia bassa: nessun modello IA locale.

### 7.2 Web (`web/src`)

- `lib/`: `store` (IndexedDB con copia in memoria, `saveItem` con `aggiornato` sempre crescente, cancellazione logica), `sync`, `api` (indirizzo del server in `localStorage`: vuoto sul sito, assoluto nell'APK), `actions` (creare, completare, cambiare stato, ordinare i passi), `arricchimento`, `libri`, `luoghi`, `posizione`, `ia`, `native` (notifiche locali Android), `reminders` (notifiche del sito), `widget` (ponte verso il widget), `theme`, `pesi`, `haptic`, `battito`, `immagini`, `migrazioni`, store a eventi (`toast`, `avanzamento`, `completamento`, `recensione`, `statoMenu`) con gli hook `use…` in `hooks`, `util`, `media`.
- `ui/`: componenti condivisi (`kit` con Row, Sezione, Gruppo, Seg, Field, Scelta…; `nav` con pila e livelli; `Sidebar`; `riordina`; fogli animati; `CampoTempo`; `AllegatiNote`; icone).
- `screens/`: le schermate dei capitoli 3 e 4. `App.tsx` tiene la pila di «istantanee» (scheda, schermate, finestre) e sceglie il layout stretto (TabBar) o largo (Sidebar, voce in finestra) a 900 px.
- **Versione** (`web/src/version.ts`): arriva dal `package.json` principale.

### 7.3 App Android e build

- **Capacitor**: la web app è impacchettata in `web/android`; al primo accesso chiede l'indirizzo del server (menu `https://`/`http://` e solo il resto da scrivere, per esempio `mytask.tuodominio.it`; incollando un indirizzo completo lo schema passa da solo: `shared/indirizzo.ts`).
- **Codice nativo** (`web/android/app/src/main/java/app/mytask/android`): `MainActivity` (estende `BridgeActivity` e registra i plugin `Haptica` e `Widget`), `HapticaPlugin`, `WidgetPlugin`, i widget (7.4). Il manifest dichiara `INTERNET` e la posizione (`ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, per l'ordine «Per te»); notifiche e vibrazione arrivano dai plugin Capacitor.
- **Costruzione:** l'APK si costruisce nel workflow di GitHub (Releases, `mytask.apk`) oppure in locale, senza commit né push. Build locale (il PC ha Java 21 in `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot` e l'SDK in `%LOCALAPPDATA%\Android\Sdk`): `JAVA_HOME` al JDK 21, `ANDROID_HOME` all'SDK, `MYTASK_VERSION_NAME=x.y.z` e `MYTASK_VERSION_CODE=x*10000+y*100+z`, poi `npm run build`, `npx cap sync android` (in `web`) e `./gradlew --no-daemon assembleRelease` (in `web/android`, circa 2 minuti). L'APK è in `web/android/app/build/outputs/apk/release/app-release.apk`, firmato con la chiave pubblica del repository come quello di GitHub. `cap sync` modifica `web/android/app/capacitor.build.gradle` e `web/android/capacitor.settings.gradle`: dopo la build vanno ripristinati con `git checkout`. Il nome del telefono per `adb` cambia (controllare `adb devices`). Se il debug wireless non si collega (errore 10013 su `adb connect` o «protocol fault» su `adb pair`, di solito per firewall o antivirus che bloccano `adb.exe`, o per codice/porta scaduti: porta e codice di abbinamento cambiano ogni volta e il codice vale solo a schermata aperta) si può installare con il cavo USB (`adb install -r`) oppure copiare l'APK sul telefono e aprirlo.
- **Firma:** chiave pubblica nel repository per poter aggiornare l'app sopra la versione precedente; chiave privata facoltativa tramite segreti del repository.
- **Da sapere:** se il telefono chiude comunque l'app in background serve togliere il risparmio batteria per MyTask (Impostazioni › App › MyTask › Batteria › Senza restrizioni); il tocco dal widget (`AzioneActivity`, `taskAffinity=""`) non toglie l'app dai recenti.

- **App per computer (Windows):** la cartella `desktop/` (fuori dai workspace) contiene un'app Electron che apre una finestra col sito del tuo server: al primo avvio chiede l'indirizzo (poi menu «Cambia indirizzo del server»), controlla `/api/health`, apre i link esterni nel browser e ammette una sola finestra. L'installer `MyTask-Setup.exe` (NSIS, per utente, senza firma: Windows SmartScreen può avvisare) lo costruisce il job `windows` del workflow (dopo `android`) e lo aggiunge alla stessa release dell'APK. In **Altro › Account** il pulsante «Scarica MyTask per Windows» (nascosto nell'app Android e in quella per computer) scarica l'ultima release da GitHub. Nella schermata dell'indirizzo il protocollo `https://` sta in un menu (cambiabile in `http://`) e si scrive solo il resto, come nel login del telefono. Per aggiornare si riscarica e si lancia l'installer; il sito dentro la finestra segue il server.

### 7.4 Widget «Oggi» (Android)

- Due widget, **«MyTask · chiaro»** e **«MyTask · scuro»** (4×3, ridimensionabili, sfondo semi-trasparente, nessun aggiornamento periodico), che estendono `WidgetBase` e scelgono solo il layout.
- In cima il pulsante **Inizia** (verde) oppure, a sessione aperta, la scheda del **cronometro** (riquadro chiaro con bordo verde, come nell'app; un `Chronometer` nativo che avanza da solo, senza consumare batteria) con il titolo del task e «su 1 h 20 min» (il tempo previsto), «Fine» e il pulsante pausa/riprendi (giallo se in pausa). Sotto la **lista di oggi** in ordine di priorità (`righeWidget` in `shared/widget.ts`, con test): pallino con la posizione in classifica, colorato per priorità, che **batte** come nell'app (un `ViewFlipper` a quadri: periodo 60000/bpm tra 450 e 2550 ms; le righe fatte non battono), titolo, checkbox quadrato; il task «in corso» (o quello su cui corre il cronometro, anche se avviato dal widget) ha la **casella mezza gialla** come nell'app (`cb_corso_*`); la riga non cambia sfondo. In basso a destra il pulsante **+** (56 dp) apre `NotaRapidaActivity`.
- **Sessione dal widget:** i tocchi su Inizia, pausa/riprendi, Fine e sulla casella del task in lavorazione (che passa il cronometro al successivo) cambiano subito lo stato del widget (`WidgetDati`, chiave «lavoro») e mettono in coda un'azione con il suo orario (`avvia`, `pausa`, `riprendi`, `fine`, `fatto`); l'app le riapplica in ordine, con quegli orari, appena si apre (`web/src/lib/widget.ts`), così il tempo misurato è corretto anche se l'app era chiusa.
- **Nota veloce:** barra sopra la tastiera nello stile dell'app (chiara o scura come il widget) che, mentre si scrive, mostra le note con parole simili (stessa logica di `cercaSimili`, su un archivio compatto); l'invio mette la nota in coda come «non assegnata» in Inbox senza aprire l'app.
- **Dati:** il widget non usa la rete e non legge i dati dell'app. L'app (`web/src/lib/widget.ts`) invia la lista, la sessione di lavoro e l'archivio compatto (plugin `Widget`: `aggiorna`) a ogni modifica, ogni 5 minuti e al ritorno in primo piano; il widget li tiene in `WidgetDati` (SharedPreferences con tre chiavi JSON: righe, archivio, coda). Note e spunte vanno in una **coda locale** che l'app svuota (`coda`, atomica) e applica (nuova voce con `inbox`, `completa`) alla prima apertura; fino ad allora la riga spuntata appare sbarrata e la nota non è ancora nell'Inbox. Toccare una riga apre l'app; toccare il checkbox la segna come fatta (di nuovo per annullare, finché l'app non è stata aperta).

### 7.5 Versione e aggiornamenti

La versione sta in un solo posto, il `package.json` principale, e da lì arriva ovunque: l'app (sito e telefono: schermata di accesso, Altro, Account), il server (`/api/health`, mostrata in Account con un avviso se differisce da quella dell'app), l'APK (`versionName`; il `versionCode` è maggiore×10000 + minore×100 + patch) e l'etichetta dell'immagine Docker. La versione si aumenta a ogni commit. A ogni push GitHub Actions esegue il controllo dei tipi e i test, pubblica l'immagine `ghcr.io/jstplink/mytask` e l'APK nelle Releases. Il NAS si aggiorna con `docker compose pull && docker compose up -d`; il telefono con il nuovo `mytask.apk`.

### 7.6 Codice condiviso (`shared/`)

Funzioni pure in TypeScript, provate con i test (`npm test`), usate da server, sito e widget: `types` (modello), `dates`, `priority`, `recurrence` (completare una voce ricorrente la sposta all'occorrenza dopo oggi e registra il giorno nel `log`), `routine`, `views` (le liste: Oggi, Attività, Progetti, Esperienze, collezioni, Inbox, Archivio, ricerche), `piano`, `pianifica`, `stima`, `stasera`, `esperienze`, `arricchimento`, `ia`, `widget`, `migrazioni`, `tempo`, `indirizzo`, `validate` (controllo dei file importati), `linea`, `testo` (normalizzazione per le ricerche).

## 8. Importazione da Notion

Una sola volta, dal CSV esportato, con lo script `server/scripts/import-notion.ts`: lettura del CSV (430 righe), unione dei duplicati (10 nomi), smistamento dei tipi con regole esplicite, estrazione da note (piattaforma, consigliato da, con chi, genere, link ripuliti), conversione di priorità, stati e date (orari che diventano scadenza fissa), ricostruzione di padri e figli, report finale (non pubblicato; riporta anche le voci già scadute dopo l'importazione).

Il tipo di Notion non basta a decidere il tipo in MyTask, quindi le regole sono esplicite: elenchi di titoli che sono serie o anime, titoli da trasformare in progetti o routine, zone, persone, aree delle azioni. Sono dati personali: stanno in `regole.locale.ts` (ignorato da git); nel repository c'è solo `regole.esempio.ts`.

| Padre in Notion | Diventa |
|---|---|
| Progetto concluso con molti figli | Progetto archiviato, con i figli raggruppati in checklist |
| Videogioco con obiettivi | Gioco con checklist di obiettivi |
| Progetto aperto con passi da fare | Progetto con passi (e date se presenti) |
| Abitudine con passi di impostazione | Routine, con i passi come checklist iniziale |

Risultato: 383 voci più 14 persone. Il file si prepara sul computer (`--json`), dove stanno le regole personali, e si carica dentro il container con `--from-json` (l'importazione da file dall'app è stata tolta). Nessun identificativo né link a Notion viene conservato.

## 9. Stato e cose da fare

| Parte | Stato |
|---|---|
| Server: login, sessioni, limite ai tentativi, CORS per l'app, sincronizzazione, versione, copia giornaliera | Fatto, con test; in funzione sul NAS |
| App web: tutte le schermate dei capitoli 3 e 4 | Fatta, provata nel browser su dati reali |
| Layout per schermi larghi | Fatto e provato a 1440, 1100 e 375 px |
| Uso offline: modifiche in coda e sincronizzazione al ritorno della rete | Provato in locale |
| Importazione da Notion | Fatta |
| Docker | Immagine costruita e verificata da GitHub Actions; l'app gira sul NAS dietro Cloudflare Tunnel |
| App Android (Capacitor) | Costruita da GitHub Actions o in locale, installata sul telefono con debug wireless |
| Widget «Oggi» | Fatti (chiaro e scuro, con nota veloce) |
| IA con Gemini e Groq (chiavi, chat, autocompilazione) | Fatta; dipende dalle chiavi dell'utente |
| Notifiche locali programmate nel telefono | Scritte e provate con i test del pianificatore; **da verificare sul telefono** |
| Service worker (apertura senza rete) | Generato dalla build, **non verificato** in un browser reale |
| Google Calendar | Solo i dati sono pronti; il modulo non è scritto |

**Ancora da fare / aperto:**

- Verificare sul telefono le notifiche (scadenze, insistenza, routine) e il service worker.
- Scorciatoie J e K per scorrere l'elenco e F per segnare fatto (layout largo).
- Altre funzioni IA: stima dello sforzo, spezzare un'idea in passi, revisione settimanale.
- Collegamento a Google Calendar.
- Decidere se mettere Cloudflare Access davanti al sito (richiede di gestire l'accesso dell'app Android).
- Chiave di firma privata per l'APK, se si vuole.

## 10. Registro aggiornamenti

Storico dei cambiamenti: alcune righe descrivono funzioni poi cambiate o tolte (per esempio la Revisione, la cattura interpretata dall'IA del server, tag e area, i selettori Giorno/Mese). **Fa fede il testo dei capitoli precedenti.**

| Data | Versione | Modifica |
|---|---|---|
| 2026-10-15 | 0.1 | Prima stesura: aree, modello dati, regole, architettura proposta, roadmap |
| 2026-10-15 | 0.2 | Confermati: routine, persone, luoghi, scadenza fissa, Gemini come provider IA, 26 voci scadute in Revisione, collegamento Google Calendar predisposto. Aggiunta sezione 4.7 (progetti e voci con figli) |
| 2026-10-15 | 0.3 | Fase 0 chiusa. Confermati: gestione voci con figli, promemoria ripetuti con insistenza, widget rimandati, Cloudflare Tunnel come accesso, PWA + APK Capacitor, link a Seafile incollati. Aggiunta sezione 5.1 (sicurezza e risorse) |
| 2026-10-15 | 0.4 | Prima bozza dei mockup minimalisti (17 schermate: Oggi, cattura rapida, Altro, Azioni, dettaglio azione, Progetti, dettaglio progetto, Esperienze, Film, Cosa guardo stasera, dettaglio collezione, Curiosità, Routine, Revisione, Completato, Persone, Luoghi). Aggiunta sezione 2.1 (navigazione) |
| 2026-10-15 | 0.5 | Layout approvato dall'utente. Prima proposta estetica: accento indaco (alternative verde e petrolio), colore d'avviso arancio, tema chiaro e scuro, stesse 17 schermate (`02-estetica.html`). Aggiunta sezione 2.2. Corretto nei mockup l'esempio con data passata (le date future sono esempi) |
| 2026-10-15 | 0.6 | Stile e palette approvati. Accento predefinito Verde, con Petrolio e Indaco selezionabili. Aggiunta schermata 18 (Altro > Aspetto: tema Sistema/Chiaro/Scuro e colore) e voce "Aspetto" nel menu Altro. Il tema si salva sul dispositivo |
| 2026-10-15 | 0.7 | Mockup confermati. Scritta l'applicazione (fasi 3 e 4): server, app web, importazione da Notion, Docker. Aggiunta sezione 4.8 (cosa compare in Oggi) e 8.1 (stato dell'implementazione). Sincronizzazione per voce invece che per campo. Rilevamento dei duplicati nella cattura rapida |
| 2026-10-15 | 0.8 | Progetto spostato nella cartella collegata a GitHub (`MyTaskGit`). Docker compose aggiornato: volume Docker per il database, porta configurabile con `MYTASK_PORT`, nessun conflitto di permessi. File personali (esportazioni CSV, report dell'importazione) esclusi da git. APK messo in pausa. Primo commit su un repository pubblico: dati personali tolti (mockup, registro delle decisioni e regole di importazione restano solo in locale; nel repository c'è `regole.esempio.ts`); l'importazione si può preparare sul computer con `--json` e caricare con `--from-json` |
| 2026-10-15 | 0.8.1 | Docker: immagine pubblicata da GitHub Actions su ghcr.io (il NAS non costruisce più nulla), test e controllo dei tipi su ogni push, tolta l'opzione BACKUP_DIR e la cartella di backup dal compose e da `.env.example` (il backup lo gestisce l'utente; resta solo la copia giornaliera dentro il volume). Rimosso `image: mytask:latest`, che causava l'avviso "pull access denied" |
| 2026-10-15 | 0.8.2 | Corretto il controllo su GitHub: il caricamento delle regole personali di importazione non fa più fallire il controllo dei tipi quando il file locale non c'è |
| 2026-10-15 | 0.8.3 | Il workflow su GitHub ha costruito e pubblicato l'immagine (build Docker verificato) e il pacchetto risulta scaricabile senza credenziali: tolto dal README il passaggio per renderlo pubblico |
| 2026-10-15 | 0.9.0 | App Android (Capacitor): APK costruito da GitHub Actions e pubblicato nelle Releases, firmato con una chiave pubblica inclusa (aggiornamenti senza disinstallare; chiave privata facoltativa via segreti). Notifiche locali programmate nel telefono per i prossimi 14 giorni (scadenze, insistenza, routine), riprogrammate a ogni modifica. Indirizzo del server richiesto al primo accesso nell'app. CORS nel server per l'app. Importazione delle voci da file JSON dentro l'app (Altro > Account), che sostituisce i comandi Docker per caricare i dati di Notion |
| 2026-10-15 | 0.9.1 | La versione compare nell'app (sito e telefono: Altro e Account, schermata di accesso) e nel server (`/api/health`, mostrata in Account con l'avviso se differisce da quella dell'app). Aggiunta la proposta di layout web per schermi larghi (sezione 2.3, mockup locale `03-web-desktop.html`) |
| 2026-10-15 | 0.10.0 | Layout web per schermi larghi (sezione 2.3): barra laterale, barra in alto con cattura rapida e ricerca, pannello di dettaglio, cruscotto in Oggi, griglia settimanale in Routine, scorciatoie N / Esc. Telefono (sezione 2.4): icone per Oggi, Fare, Scoprire e Routine; Inbox e Altro come pulsanti tondi più grandi. Ricerca nelle voci |
| 2026-10-15 | 0.10.1 | Documentazione allineata allo stato reale: modello dati con i nomi dei campi effettivi, cattura rapida, backup, importazione da file, funzioni IA con lo stato, sezione 5.3 (versione e aggiornamenti), stato dell'implementazione e cose ancora da fare (8.2). Riordinate le sezioni 4.7 e 4.8 |
| 2026-10-15 | 0.10.2 | La categoria "Fare" si chiama "Attività". Corretto il selettore del tema (Aspetto), nascosto per errore sugli schermi larghi. Barra laterale più grande (288 px, testo e icone più grandi), sotto-sezioni rientrate con linea guida e gruppi "Da sistemare", "Altro" e impostazioni separati (mockup locale `04-barra-laterale.html`). Pagina di accesso con lo stesso logo e stile dell'app, senza cornice da telefono sugli schermi larghi |
| 2026-10-15 | 0.10.3 | Navigazione con cronologia: "indietro" (tasto del telefono o del browser) chiude la schermata aperta e poi torna alla scheda e sotto-sezione visitate prima. Tasto "Indietro" più grande da toccare. Nel dettaglio di una voce il punteggio di priorità sta sopra il campo Titolo. App Android: le icone della barra di stato seguono il tema dell'app (plugin `@capacitor/status-bar`). Mockup locali di tag area e vista calendario (`05-tag-e-calendario.html`), da approvare |
| 2026-10-15 | 0.11.0 | Tag area colorati sulla riga del titolo (sezione 2.3.1). Vista Calendario in Attività, con elenco del giorno (telefono) e agenda (web). Corretto lo stack di navigazione, che in sviluppo registrava due volte l'apertura di una voce |
| 2026-10-15 | 0.11.1 | Selettore Elenco / Calendario nella scheda Oggi. Il testo "Sincronizzato" in fondo a Oggi (telefono) compare solo quando serve: offline o modifiche in attesa |
| 2026-10-15 | 0.12.0 | Piano della giornata: le attività sono distribuite nei giorni in base a priorità, tempo libero e durata, con spezzatura dei task lunghi e rinvio dei meno prioritari (sezione 2.3.2). Nuova schermata Altro > Tempo libero. Per provare il sito in locale col server vero: `MYTASK_SERVER` in `web/vite.config.ts` |
| 2026-10-15 | 0.12.1 | Tolto il Calendario da Attività e il selettore Elenco/Calendario: Oggi è una pagina sola, con la giornata a orari, frecce per cambiare giorno e vista Mese per spostarsi rapidamente (sezione 2.3.1) |
| 2026-10-15 | 0.12.2 | Targhette delle aree tutte della stessa larghezza (96 px). Inbox: ogni voce è una scheda con bordo e si smista aprendola; tolte le etichette di smistamento rapido. Scheda di una voce: Tipo e Stato sono tendine con icona e colore per ogni voce; i campi sono raggruppati in schede (Voce, Quando, Priorità, Interesse, Persone e link, Checklist, Note). Verificata la cronologia del tasto indietro: voce, scheda, Oggi, uscita dall'app |
| 2026-10-15 | 0.13.0 | Feedback aptico leggero sui tocchi ai pulsanti e animazioni (sezione 2.5). Comprende le modifiche della 0.12.2 (Inbox a schede, tendine con icone, gruppi nella scheda di una voce, targhette di larghezza uguale) |
| 2026-10-15 | 0.14.0 | "Scoprire" diventa "Intrattenimento"; il tipo "Azione" diventa "Attività" ovunque. Tipi accorpati sotto Intrattenimento con seconda scelta; stato non più scelto, con "Metti da parte" e la sezione Altro > Da parte; gruppo Intrattenimento unico; finestra del voto e del commento al segno di fatto; tolti "Link e documenti". Più spazio tra titolo, selettore, filtri ed elenco nelle schede (sezione 2.4.1) |
| 2026-10-15 | 0.15.0 | Pannelli unici per Attività, Progetto (data, importanza, tempo stimato fino a 1 giorno) ed Esperienza (data, interesse, apri in Google Maps); tolti area, ricorrenza, zona, link Maps e sotto-task dalla scheda; ricetta con genere a scelta multipla; persone e checklist spostate nelle note; schermo bloccato in verticale; mockup del peso dell'importanza (locale, `06-peso-importanza.html`) |
| 2026-10-15 | 0.16.0 | Pulsanti della scheda in fila; film senza consigliato da, con chi e durata; gioco con durata in ore; libro con pagine cercate online (Open Library); scheda attiva della barra in basso con sfondo su icona e testo; nuovi mockup del peso dell'importanza (locali, `07-peso-importanza-altre.html`) |
| 2026-10-15 | 0.17.0 | Checklist e passi solo per i progetti (con ripristino dalle note); Oggi a sezioni separate, giorni successivi apribili, swipe tra i giorni e navigazione incapsulata; titoli più leggibili con tag e orario; nuovi mockup tra G e F per l'importanza (locali, `08-peso-importanza-g-f.html`) |
| 2026-10-15 | 0.18.0 | Tolti tag e area dalle righe e dai filtri; Esperienze in un solo elenco senza raggruppamento per luogo; feedback aptico ridotto del 30% (plugin Android `HapticaPlugin`) |
| 2026-10-15 | 0.19.0 | Stile J per le righe: sfondo sfumato nel colore del livello, checkbox colorato, numero d'ordine a destra (sezione 2.3.1) |
| 2026-10-15 | 0.19.1 | Stile P1 al posto del J: checkbox colorato e pallino numerato con contorno a destra, righe senza sfondo colorato (sezione 2.3.1) |
| 2026-10-15 | 0.20.0 | Pulsanti Elimina, Archivia, Completato (in quest'ordine); "Da parte" diventa "Archiviate"; tolti i "Prossimi 7 giorni" da Oggi; Cosa guardo stasera con Con chi (solo, partner, amici), piattaforme di base, mood, energia e tipologia al posto del tempo disponibile |
| 2026-10-16 | 0.21.0 | Tolta la riga "Nei prossimi giorni" da Oggi. Curiosità diventa una scheda principale (cinque schede in basso e voce nella barra laterale). Nel piano, pause di 15 minuti con una curiosità tra le attività grandi. Tolto il selettore Giorno/Mese: il nome del giorno apre una finestra con il mese. Pulsante tondo "Stile e aspetto" in cima alle schede principali e nella barra in alto. Colori di base con contrasto più alto di almeno il 5%. Le attività senza scadenza ferme da 45 giorni vanno in Revisione. Il tempo libero ora si sincronizza tra telefono e sito (tabella `settings` sul server, campo `impostazioni` in `/api/sync`); per vederlo servono la nuova app e l'immagine aggiornata sul NAS |
| 2026-10-16 | 0.22.0 | Task collegato al progetto: campo Progetto in prima posizione nella scheda di un'attività e raggruppamento sotto la testata del progetto (con avanzamento) in Attività e in Oggi (mockup locale `09-task-progetto.html`, variante C) |
| 2026-10-16 | 0.23.0 | Pila unica di navigazione con finestre nella cronologia; "+" sempre cattura con bozza in Inbox; checkbox Scadenza fissa sotto la data; Attività con tutte le voci; Archivio diventa Completato; tolta l'etichetta "oggi" in Oggi; checkbox con tinta della priorità; stima dei tempi con margine d'errore che si affina (sezione 2.4.2) |
| 2026-10-16 | 0.24.0 | Task figli rientrati nei gruppi; checkbox senza colore di priorità; scheda Progetti con lo stesso aspetto a gruppi e tutti i task; interesse a pallini nelle Curiosità; barre di scorrimento nascoste; icona progetto neutra con contorno |
| 2026-10-16 | 0.25.0 | Attività con tutti i conteggi e le esperienze; nuovo blocco di priorità nella scheda; barra del piano divisa per attività con margine per blocco; mockup barra a 24 ore |
| 2026-10-16 | 0.26.0 | Vista web: barra laterale con voci tutte della stessa dimensione, cattura e ricerca della stessa larghezza, tolti Aspetto e Nuova voce dalla barra in alto; mockup barra a 24 ore con 5 varianti |
| 2026-10-16 | 0.27.0 | Revisione senza contatore se vuota; sincronizzazione visibile solo offline nella barra web; tolta la schermata Notifiche; mockup D (ore con altezza minima, scorrevole) ed E (4 varianti) |
| 2026-10-16 | 0.28.0 | Piano di Oggi con la linea E3 (24 ore + zoom sulle prossime 3 ore, margine per attività); mockup del blocco di priorità (locale, `12-blocco-priorita.html`) |
| 2026-10-16 | 0.29.0 | Vista web: la voce si apre in una finestra in sovraimpressione al centro; mockup delle varianti del blocco di priorità C con la posizione (1 = più prioritaria) come numero principale (locale, `13-blocco-priorita-c.html`) |
| 2026-10-16 | 0.30.0 | Blocco di priorità della scheda in variante C1: posizione, targhetta con il livello, contorno colorato, componenti del punteggio, senza punteggio numerico |
| 2026-10-16 | 0.31.0 | Piano di Oggi: barra delle 24 ore con fasce libere cliccabili, orari della fascia e barra a segmenti numerata (C2); elenco filtrato sulla fascia; tolto il riepilogo ore/attività |
| 2026-10-16 | 0.32.0 | Tempo stimato nelle curiosità (15 min), importanza con slider; vista web: Nuova nota e ricerca in cima alla barra laterale, finestra della voce più alta, Oggi senza Inbox e con la routine sopra il piano |
| 2026-10-16 | 0.33.0 | Arricchimento automatico di film, serie, anime, giochi e libri (genere, mood, energia, durata, pagine) per i filtri di "Cosa guardo stasera", anche per le voci già inserite; eliminate le sezioni Persone e Luoghi; barra laterale web con nome app, nuova nota e ricerca e contatore totale su Attività; più spazio sotto la timeline; mockup dell'interesse (locale, `18-interesse-righe.html`) |
| 2026-10-16 | 0.34.0 | Interesse con cinque pallini grandi (22 px) a destra nelle righe di intrattenimento e curiosità, senza contatore |
| 2026-10-16 | 0.35.0 | Pallini dell'interesse dimezzati (11 px) e checkbox/pallini centrati in verticale sulla riga |
| 2026-10-16 | 0.36.0 | Vista web: Revisione sotto la barra del giorno e sopra la routine, più spazio nella barra laterale; mockup dei numeri sotto la barra della fascia |
| 2026-10-16 | 0.37.0 | Piano di Oggi: numeri d'ordine come pallini sotto la barra della fascia (stile B1, senza linee guida) |
| 2026-10-16 | 0.38.0 | Cattura rapida senza interpretazione, con elenco delle note che contengono le stesse parole; attività importate da Notion e mai toccate in Revisione; divisori nella barra laterale web e spazi uniformi in Oggi; pulsante + più grande sul telefono |
| 2026-10-16 | 0.39.0 | Cattura sul telefono: le note con le stesse parole compaiono sopra il box di scrittura |
| 2026-10-16 | 0.40.0 | Parametro "Pausa dopo ogni attività" nelle impostazioni del tempo libero (5 minuti di base) usato dal piano; slider dell'importanza continuo a cuneo con gradiente grigio-rosso e senza etichette |
| 2026-10-16 | 0.41.0 | Il pallino di priorità batte (si contrae) a frequenza crescente con l'urgenza, da 10 a 80 bpm, con colpo di durata fissa (sezione 2.3.2) |
| 2026-10-17 | 0.43.0 | Navigazione a pila: copre anche i menu a tendina (Tipo, Sezione…), il pannello della data di Revisione e il selettore del tempo; nell'app Android la pila è interna e il tasto indietro passa dal plugin `@capacitor/app` (a pila vuota esce); tempo stimato scritto a mano (45m, 6h, 4g, 5g 6h) o scelto con giorni, ore e minuti a passi di 15 |
| 2026-10-17 | 0.44.0 | Login dell'app Android con scelta di http/https (di base https://) e solo il resto dell'indirizzo da scrivere; comprende la pila a livello app per il tasto indietro del telefono e il tempo stimato scritto a mano o scelto (0.43.0). Mockup locale dell'animazione di avanzamento del progetto (`10-avanzamento-progetto-animato.html`), da approvare |
| 2026-10-17 | 0.45.0 | Animazione dell'avanzamento del progetto al completamento di un passo (foglio sul telefono, finestra sul web); link e immagini allegabili alle note; sotto-scheda "Tutte le attività"; Inbox e Altro in cima a tutte le schede sul telefono |
| 2026-10-17 | 0.46.0 | Frecce per riordinare i passi di un progetto (l'ordine è la priorità); Inbox e Archiviate con le righe standard; salvata l'ora di completamento (`completatoTs`); mockup di come mostrare ora di creazione e completamento |
| 2026-10-17 | 0.47.0 | Scheda Cronologia nella voce (creata, completata, tempo trascorso; variante A); la pagina della voce segue i completamenti fatti fuori; progetti nell'elenco con le stesse indentazioni delle righe normali (stile cartella invariato) |
| 2026-10-17 | 0.47.1 | La cornice della cartella del progetto non è più appiccicata al bordo: sporge di 8 px invece di 12 (10 px di distacco dallo schermo) mantenendo checkbox e pallino allineati alle righe normali |
| 2026-10-17 | 0.47.2 | Numeri sotto la barra del piano sempre dentro la barra (cerchi più piccoli se sono tanti, fili verso i segmenti, larghezza rimisurata a ogni disegno); cartella del progetto con 14 px di distacco dal bordo (cornice che sporge di 4 px) |
| 2026-10-17 | 0.48.0 | Versione web con il contenuto centrato in una colonna da 760 px (1120 px per la griglia di Routine) e la barra laterale a sinistra |
| 2026-10-17 | 0.49.0 | Stile M3 per le sezioni in tutte le schede (fascia con titolo grande tra due linee e conteggio, righe libere, niente contenitori), al posto dei contenitori di Oggi; componente `Sezione` |
| 2026-10-17 | 0.50.0 | Riga V2 in tutte le liste: priorità a sinistra, icona del tipo nella riga grigia, checkbox quadrato stondato uguale per tutte le note all'estrema destra. Passi e checklist dei progetti si riordinano trascinando, senza frecce. L'interesse (Intrattenimento, Curiosità, Esperienze) è un pallino verde a sinistra con il numero 1-5, sempre più pieno con l'interesse e senza animazione (`interesse` in `Row`). La linea dell'ora sulla timeline si aggiorna anche sul telefono: `useMinuto` ricalcola ogni 15 s e al ritorno in primo piano (i timer in background su Android si fermano) |
| 2026-10-17 | 0.51.0 | Piano di oggi: tempo reale = stima + margine (`pianifica(..., margine)`, `Blocco.margineMin`), il margine è la coda tratteggiata del segmento nella barra con legenda; tolta la sezione «Non entrano oggi»; scadenza fissa con lucchetto (classe `.hard.rigida`) invece del pallino; «scaduta» al posto di «oltre la scadenza» |
| 2026-10-17 | 0.52.0 | Widget Android «Oggi» (proposta C, trasparente) in due versioni, MyTask · chiaro e MyTask · scuro: in cima un campo per scrivere una nota in Inbox (finestrella, senza aprire l'app), sotto la lista di oggi con orario, posizione e checkbox per spuntare. Nativo in `web/android/.../Widget*.java`; l'app scrive la lista (`web/src/lib/widget.ts`, `shared/widget.ts`) e applica note e spunte accodate dal widget appena viene aperta |
| 2026-10-17 | 0.53.0 | Tempo libero flessibile: interruttore in Impostazioni › Tempo libero (Fasce fisse / Orari flessibili); in modalità flessibile ogni sera all'ora scelta una notifica chiede gli orari liberi del giorno dopo e prepara il calendario (`Disponibilita.flessibile`, `oraChiedi`, `fasceDelGiorno`, `richiesteOrari`, schermata `OrariGiorno`). Widget: orario sotto il titolo e pallino di priorità che batte come nell'app (ViewFlipper a quadri) |
| 2026-10-17 | 0.53.1 | Oggi: tolto l'avviso «x attività non entrano nelle prossime due settimane»; linea divisoria tra la timeline del piano e la lista delle attività; tolta la legenda del tratteggio sotto la barra (il margine resta tratteggiato) |
| 2026-10-18 | 0.53.2 | Widget: tolta la barra «Scrivi una nota…», più spazio alla lista e pulsante + tondo nell'angolo in basso a destra per la nota veloce |
| 2026-10-18 | 0.53.3 | Widget: nota veloce nello stile dell'app (barra sopra la tastiera con campo tondo e pulsante ↑, chiara o scura come il widget) e pulsante + più grande (56 dp) |
| 2026-10-18 | 0.54.0 | Nota veloce del widget: mentre si scrive compaiono le note con parole simili (stessa logica di `cercaSimili`, con radici delle parole), come nella cattura rapida dell'app. L'app invia al widget un archivio compatto (`archivioWidget`) insieme alla lista di oggi |
| 2026-10-18 | 0.55.0 | Stati di una nota (da fare, in corso, fatta, archiviata): la casella nelle righe ha quattro stati (un tocco avanza, pressione lunga o tasto destro apre il menu), «in corso» è mezza casella gialla, «archiviata» tratteggiata; nella nota un selettore a segmenti sotto il titolo al posto dei pulsanti Archivia/Completato; la Cronologia mostra anche «In corso dal» (`inCorsoTs`) |
| 2026-10-18 | 0.55.1 | Nota: il blocco priorità è collassabile (proposta A): chiuso di base con posizione e livello, un tocco sulla testata mostra barre e dati; ricorda l'ultima scelta (`mytask.prio.aperta`) |
| 2026-10-18 | 0.55.2 | Nota: apertura e chiusura del blocco priorità animate (altezza e dissolvenza, 0,28 s); testi dei quattro stati centrati nei pulsanti del selettore |
| 2026-10-18 | 0.55.3 | Nota: barra dell'importanza più stretta del 30% (da 220 a 154 px) |
| 2026-10-18 | 0.55.4 | Nota: tolto il campo «Ora» dall'editor (le note che hanno già un'ora la mantengono e il piano continua a trattarle come impegni con orario) |
| 2026-10-18 | 0.56.0 | Passi di progetto come righe normali (con maniglia, priorità, casella a stati) e più respiro nella cartella del progetto; l'ordine dei passi vale anche nelle liste e un passo non ha priorità più bassa dei successivi (`punteggioEffettivo`); targhetta con l'ora nella seconda barra di Oggi; archiviando o ripristinando un progetto si archiviano o ripristinano i suoi passi; una nota «in corso» resta dove era nel piano (`pianoData`, `pianoDa`); esperienze: luogo, «Senza data» al posto di «Da fare quando capita», interesse con barra verde; intrattenimento: descrizione cercata anche su Wikipedia e messa nelle note vuote (`descrittoIl`); Android: il tocco dal widget non toglie più l'app dai recenti |
| 2026-10-18 | 0.57.0 | Opzione provvisoria e sperimentale (gialla) in Altro › «Pesi della priorità»: quattro cursori per il peso di urgenza, importanza, poco sforzo ed età nel punteggio, con ripristino ai valori di base e anteprima delle prime attività. I pesi valgono solo sul dispositivo (`mytask.pesi`) e cambiano subito liste, piano e widget |
| 2026-10-18 | 0.57.1 | La posizione di priorità è la stessa in Oggi e nella scheda della nota (`classificaPriorita`, `posizionePriorita`, a parità vince la nota più vecchia); una nota «in corso» resta ferma nella timeline: se non ha un posto salvato (segnata prima) parte dall'ora in cui è passata in corso (`inCorsoTs`) |
| 2026-10-18 | 0.58.0 | «Scadenza rigida» si chiama «scadenza fissa» (il campo resta `rigida`); la scadenza fissa è un parametro a parte della formula di priorità (peso 10%, prima moltiplicava l'urgenza per 1,3; pesi di base 36/28/8/8/20, poi corretti nella 0.58.1) e ha il suo cursore nei pesi sperimentali; Esperienze ordinabili per data (di base), luogo o interesse; barra dell'interesse (verde, come l'importanza) anche per curiosità e intrattenimento |
| 2026-10-18 | 0.58.1 | Corretta la formula della 0.58.0: il peso della scadenza fissa abbassava il punteggio di tutte le note senza scadenza fissa e nessuna risultava rossa. Ora i quattro parametri di sempre (45/35/10/10) danno il punteggio di base e la scadenza fissa è un bonus a parte (peso di base 20%, pesi mostrati 36/28/8/8/20) |
| 2026-10-18 | 0.58.2 | Esperienze: sotto il campo «Luogo» compaiono i luoghi già inseriti nell'app (`luoghiUsati`, dal più usato) come chip da toccare; si restringono mentre si scrive |
| 2026-10-18 | 0.59.0 | Esperienze: nuovo ordine «Per te» che unisce interesse (40%), data più vicina (35%) e distanza dalla tua posizione (25%); la posizione resta sul telefono, i luoghi si cercano su OpenStreetMap e si ricordano (`shared/esperienze.ts`, `lib/posizione.ts`, `lib/luoghi.ts`); permesso di posizione nell'app |
| 2026-10-18 | 0.59.1 | Tab di Attività, di Intrattenimento e del selettore delle esperienze tutte della stessa larghezza (`Seg uguali`); barra di ricerca (`Cerca`) in Attività, Intrattenimento e Curiosità: filtra mentre si scrive per titolo, note e campi di testo (stessa ricerca di `cercaVoci`), anche nei passi dei progetti |
| 2026-10-18 | 0.60.0 | Note dell'Inbox senza tipo: la cattura (app e widget) crea una nota «Non assegnata» (nuovo tipo `nota`) invece di una attività; il tipo lo sceglie l'utente quando la smista. Resta in Inbox finché non ne ha uno; le note già in Inbox mai toccate diventano «non assegnate» (`inboxNonAssegnata`) |
| 2026-10-18 | 0.61.0 | IA scelta dall'utente: in Altro › Intelligenza artificiale si inseriscono le chiavi di Gemini e Groq (restano sul dispositivo), c'è una chat con Gemini, Groq o entrambe e l'autocompilazione della tipologia (mood ed energia per i video) delle opere di intrattenimento; chip delle piattaforme già inserite; curiosità possono restare senza tempo; alla chiusura non si chiede più il tempo impiegato: si misura da «in corso» a «fatta» contando solo il tempo libero segnato |
| 2026-10-18 | 0.62.0 | Tolta la Revisione (schermata, voce nel menu, scheda in Oggi, contatore, progetti «fermi» e il campo `daRivedere`): le note scadute o vecchie restano nelle liste e nel piano; sul sito la tendina «Sezione» di film, serie e simili si apre (le due tendine della scheda si chiudevano a vicenda); titolo della scheda col margine giusto nella finestra del sito; mockup del campo rapido per le nuove note sul sito |
| 2026-10-18 | 0.62.1 | Pulizia del codice e documentazione riscritta sullo stato attuale: tolti l'endpoint IA del server (`/api/ai/capture`, `GEMINI_API_KEY`), la cattura interpretata in locale (`shared/capture.ts`; `chiaveTitolo` è in `shared/testo.ts`), codice, regole CSS e risorse Android inutilizzati; commenti dei file riscritti sul funzionamento attuale. «Riapri» in Completato azzera anche l'ora di completamento. Nessun altro cambio di comportamento |
| 2026-10-18 | 0.63.0 | Tendina del tipo non più scorrevole (mostra tutte le voci); tolta la ricerca dalle singole schede sul sito (resta quella generale); pulsante Tempo libero in cima a Oggi sul telefono; sul sito il pulsante «Nuova nota» diventa un campo con contorno sempre visibile, più marcato mentre si scrive (Invio salva in Inbox, N porta il cursore); nuovo tipo e sotto-scheda «Game design» in Attività; interruttore «Attiva» per mettere una routine in Parcheggiate; ripristinate le tinte dei tipi (`--c1…--c5s`) tolte per errore dalla pulizia della 0.62.1 |
| 2026-10-18 | 0.64.0 | Tolta la «Pausa dopo ogni attività» (parametro `pausaMin`, impostazione in Tempo libero e relativo spazio nel piano; restano le pause curiosità); Game design con tempo stimato e difficoltà e una priorità calcolata (interesse 50%, tempo 30%, difficoltà 20%), lista ordinata per priorità |
| 2026-10-18 | 0.64.1 | Una nota «in corso» che non entra nella fascia libera in cui è iniziata prosegue nelle fasce libere successive; il margine d'errore si vede solo sull'ultimo pezzo, quando tutto il tempo di base è entrato |
| 2026-10-18 | 0.65.0 | Nuovo tracciamento del tempo «Sto lavorando»: Oggi diventa una lista semplice (pulsante Sto lavorando o cronometro, routine, prime attività) con menu «Lavora su questo / Non ora / Apri»; un solo cronometro che passa da solo al task successivo quando si completa quello in corso, con pausa, controllo periodico «Stai ancora lavorando?» (anche notifica su Android) e sincronizzazione tra telefono e sito; il widget Android ha il pulsante Sto lavorando e il cronometro nativo, con azioni accodate e riapplicate dall'app. Tolti da Oggi il piano a orari, la scelta del giorno e il mese; il pulsante rapido del tempo libero è stato tolto e la voce Tempo libero è gialla «provvisorio» (telefono e sito) |
| 2026-10-19 | 0.65.1 | Il cronometro «Sto lavorando» ha lo stile delle schede dell'app (anche nel widget) e mostra tempo lavorato, totale previsto e una barra; i task già avviati mostrano il tempo lavorato sul previsto nelle righe di Oggi e nella Cronologia della nota; il pulsante non dice più «Parte dal primo task» (la prima riga ha un contorno tratteggiato); il salvataggio della scheda non perde più il tempo lavorato |
| 2026-10-19 | 0.65.2 | Intrattenimento: i filtri per piattaforma sono a scelta multipla (più piattaforme insieme valgono «una o l'altra», quindi si escludono le altre; «Tutte» azzera) e c'è il filtro «Senza piattaforma» per le opere che non ne hanno (`ChipsMulti`, `collezione(…, piattaforme[])`, `SENZA_PIATTAFORMA` in `shared/views.ts`, con test) |
| 2026-10-19 | 0.65.3 | Tempo stimato con tre rotelle (giorni, ore, minuti a passi di 5) al posto dei pulsanti più/meno, con il margine d'errore e l'intervallo che ne deriva; oltre un giorno compare un avviso giallo che lampeggia piano, con «Mostra esempio» (un lavoro diviso in task piccoli, solo da leggere) e il collegamento «Passa a progetto»; nella scheda resta una riga discreta con lo stesso collegamento (`CampoTempo`, `Rotella`) |
| 2026-10-19 | 0.65.4 | La nota in lavorazione non cambia più stile (tolti sfondo evidenziato, contorno tratteggiato della prima riga e timer a destra): sotto la riga si apre, con un'animazione, la barra con il timer che scorre a sinistra, il previsto a destra e il filo sottile a tutta larghezza fino al pallino; verde, giallo in pausa, arancione oltre il previsto (`Row` con `sotto`/`aperto`, `sottoRiga` in `Oggi`); l'importanza si imposta a doppio livello: cinque gradi e, sotto, lo slider che rifinisce dentro il grado (`ImportanzaDoppia`) |
| 2026-10-19 | 0.65.5 | Widget: il task «in corso» ha la casella mezza gialla (prima non si vedeva, la riga restava come da fare) e non cambia più sfondo; la testata di una cartella progetto mostra, accanto a «fatti / totale», la stima del progetto calcolata dai suoi passi ancora da fare (`stimaProgetto`) |
| 2026-10-19 | 0.66.0 | Sito: l'**Inbox** è una voce principale della barra laterale, sopra le cinque sezioni; la scheda «Oggi» si chiama **«Priorità»** e ha, nell'ordine, «Sto lavorando», le routine, il gruppo **«Attività»** (le più prioritarie) e poi il gruppo **«Curiosità»** con le cinque più interessanti (`curiositaDaSmaltire`, `MAX_CURIOSITA_OGGI`), in gruppi separati e senza mescolare le curiosità nella classifica numerata; **tolte le icone** dalle voci principali (barra laterale e schede in basso). **Tolto del tutto il tempo libero**: schermate «Tempo libero» e «Quando sei libero?», notifica serale, impostazione sincronizzata `tempoLibero`, motore del piano a orari (`shared/piano.ts`) e relativi test, posto nel piano delle note «in corso» (campi `pianoData`, `pianoDa`) e misura della durata dal tempo libero (resta solo il cronometro «Sto lavorando»); le impostazioni sincronizzate restano per la sessione di lavoro. Dati vecchi già salvati (chiave `tempoLibero` sul server e in `localStorage`, campi `pianoData`/`pianoDa` nelle voci) restano inerti. Inoltre: l'Inbox è separata dalle sezioni da una linea; la testata di un progetto mostra «stima del tempo · fatti / totale» (prima era invertito) e la barra è a **tacchette**, una per attività figlia (anche nella checklist del progetto e nel pannello di avanzamento, dove si accendono una dopo l'altra); nelle righe dei passi riordinabili la maniglia e la casella stanno staccate dal pallino e dal bordo e lo sfondo non cambia colore; nella riga «Tutte le attività» compare accanto al conteggio il tempo stimato totale in giorni e ore; nelle righe dei passi di un progetto si vede la stima del tempo; il tempo stimato non si scrive più a mano (solo rotelle), l'avviso «più di un giorno» scatta solo oltre le 24 ore (non a 24 ore esatte) e sul sito le rotelle sono più alte; Account senza «Tutto sincronizzato», con il riepilogo delle voci (aperte / completate / archiviate, per tipo, possibili doppioni) e **senza esportazione e importazione JSON** (tolti anche `GET /api/export` e `shared/validate.ts`) |
| 2026-10-19 | 0.66.1 | Schede in basso del telefono: tornano le **icone** (proposta A del mockup 48: icona con pillola dietro quella attiva e nome sotto, «Intrattenimento» abbreviato in «Intratten.»); il sito e la barra laterale restano senza icone |
| 2026-10-19 | 0.66.2 | Scheda della nota: nei progetti tolti il campo «Tempo stimato» (dipende dai passi) e il blocco «Checklist» (i passi stanno sotto la barra dell'importanza, con «Passi · X su Y»); un'attività collegata a un progetto non chiede più l'importanza (vale quella del progetto: `withInheritance` usa sempre la sua, e scegliendo il progetto il valore proprio si toglie); il progetto di un'attività si sceglie con la tendina dell'app (`Scelta`, scorrevole, nomi lunghi accorciati) invece del select del browser, che sul sito aveva testo bianco su sfondo bianco; le opzioni di tutti i select hanno ora sfondo e colore del tema |
| 2026-10-19 | 0.66.3 | Pausa: tolto il quadrato arancione (icone SVG nell'app, glifi di testo nel widget); slider dell'importanza più fluido (passi di 0,01, salvataggio al rilascio) |
| 2026-10-19 | 0.66.4 | **Nuovo margine delle stime**: con segno, parte da +15% e dopo ogni attività si sposta del 35% della differenza tra reale e stimato (stime corte → sale, rosso; stime abbondanti → scende anche sotto zero, verde), mostrato in rosso/verde nell'animazione di completamento, nelle righe, nella scheda e nel selettore del tempo (`margineDopo`, `tempoAtteso`, `Margine`); sito: tolto il contatore da Priorità, aggiunto il totale a Intrattenimento, le vecchie note «Persona» non si contano più in Account |
| 2026-10-19 | 0.66.5 | Le note di tipo «Persona» rimaste dalla vecchia importazione vengono eliminate (cancellazione logica all'avvio, `eliminaPersone` in `shared/migrazioni.ts`; arriva anche al server e agli altri dispositivi, il NAS tiene la copia di sicurezza giornaliera) |
| 2026-10-19 | 0.66.9 | **Classifica di priorità unica**: la posizione (il numero nel pallino) si calcola sempre su tutte le note e i progetti insieme (`elencoPriorita`) ed è la stessa in Priorità, Attività, nella lista dei passi del progetto, nella scheda e nel widget (prima ogni schermata contava solo le proprie voci); i passi dei progetti contano uno per uno e un progetto ha la posizione del suo passo più avanti; il margine delle stime non compare più sotto le singole note; in Priorità un **blocco sotto il timer** mostra solo la **correzione alle tue stime** (il margine, che ora **parte da 0%**: verde se stimi più del necessario, rosso se stimi troppo poco) e le fasce «Attività» e «Curiosità» mostrano, al posto del conteggio (sempre 5), il tempo necessario a finire le voci elencate e, accanto, il valore corretto col margine («2 h → 1 h 29 min»; a 0% solo il totale), con «N senza stima»; la pagina Priorità mostra le 5 note con la posizione migliore in assoluto (anche con scadenza futura) invece delle sole note di oggi o senza data; il tocco su una riga di Priorità apre sempre la nota (tolto il menu «Lavora su questo» / «Non ora») |
| 2026-10-20 | 0.67.0 | **Installer per computer** (Windows, `desktop/`, Electron + NSIS) costruito da GitHub Actions e scaricabile da Altro › Account; tolta la riga «Calendario · non collegato» da Altro; tolto il numero delle attività dalla barra «Tutte le attività» (resta il tempo stimato) |
| 2026-10-20 | 0.67.1 | **Pesi della priorità sincronizzati** tra telefono, sito e app per computer (chiave `pesi` delle impostazioni di `/api/sync`, vince la modifica più recente, «Ripristina» vale per tutti; prima erano solo sul dispositivo e le priorità potevano differire). Tema chiaro di base (chi ha già scelto un tema lo conserva); app per computer: nella schermata dell'indirizzo del server `https://` è un menu come nel login del telefono |
| 2026-10-20 | 0.68.0 | **Regole della priorità al posto dei 100 punti** (`RegolePriorita`, Altro › Regole della priorità, sincronizzate): colore (rosso/ambra/grigio) e ordine da importanza, scadenza e posizione, prima tutti i rossi; sei barre e selettore dell'ordine; battito legato al colore (rosse tutte pulsanti, +10%, cala del 2% a posto); scheda «Nessuna nota in corso» al tocco di «Inizia»; note «in corso» in coda a Priorità; blocchi fissi con filo e ombra in Priorità, Attività, Intrattenimento e Curiosità; avviso «Nuova versione» con pulsante Aggiorna e installer `MyTask-v<versione>.exe` con riga in Account; icona cartella dei progetti più chiara |
| 2026-10-20 | 0.68.1 | **Nuova icona dell'app** (mockup 33, variante 5): fondo verde sfumato, onde bianche e pallino bianco con spunta verde, dentro la zona sicura dell'icona adattiva di Android (non più tagliata), colori sempre uguali e senza livello monocromatico; aggiornati `icon.svg` del sito e `icon.png` dell'app per computer |
| 2026-10-20 | 0.68.2 | **Sito e computer:** nella pagina Priorità del sito la parte fissa (Inizia, ricerca) sta nella colonna centrata invece di allargarsi a tutto lo schermo e senza ombra sotto la riga; nelle altre schede l'ombra sotto la riga è più marcata. Icone dedicate: `favicon.svg` (linguetta del browser, senza onde, pallino e spunta grandi), logo della barra laterale uguale all'icona dell'app, `desktop/build/icon.svg` e `icon.png` per il computer (un'onda tenue, pallino grande). |
| 2026-10-20 | 0.68.3 | **«Inizia» parte dalla nota «in corso»** (se ce n'è più di una, l'ultima segnata; `notaInCorso` in `shared/sessione.ts`) e non più dalla prima della lista; se nessuna è in corso parte dalla prima e la segna «in corso»; mockup 51 del timer vuoto senza nota in corso, con la nota in corso sotto il timer e con la riga che ha già del tempo trascorso (la regola «una sola nota in corso» è ancora da implementare) |
| 2026-10-20 | 0.68.4 | **Blocco del cronometro nuovo in Priorità** (mockup 57-58): stato in alto a sinistra, «Nessuna nota in corso» pulito, nota in corso con barra sempre visibile e timer grande accanto al tasto mentre corre, pausa che lascia la barra; **una sola nota «in corso»** (le altre tornano da fare, il cronometro segue la nuova nota; `altreInCorso`, `lasciaInCorsoSolo`, `seguiNotaInCorso`); il **tempo già lavorato** compare accanto alla casella delle altre note (testo); tolta la barra sotto le righe, l'invito «Inizia» e «Ho finito di lavorare» dalla scheda; il widget avvia il cronometro dalla nota «in corso» (campo `c`). Vale anche per sito e app per computer, che mostrano il sito del server |
| 2026-10-20 | 0.68.5 | Documentazione: cosa fare se il debug wireless non si collega (cavo USB o APK copiato sul telefono); nessun cambiamento al codice |

## Selettore del tempo a rotelle (0.65.3)

- Il tempo stimato (Attività, progetti, curiosità) si scrive ancora a mano («45m», «1g 2h»), oppure con «Scegli»: un foglio con tre rotelle che scorrono e si fermano sul valore (giorni 0-30, ore 0-23, minuti a passi di 5; un tempo già scritto con minuti diversi, per esempio 7, resta scegliibile). Si può anche toccare una riga o usare le frecce su/giù.
- In alto il tempo scelto e, nelle Attività e nei progetti, il margine delle tue stime con il tempo da mettere in conto («+15% · in conto 48 min», rosso se positivo e verde se negativo), che cambia mentre si scorre.
- **Oltre un giorno** (1440 minuti) compare l'avviso giallo «Più di un giorno di lavoro», che lampeggia piano tre volte; «Mostra esempio» apre un esempio di lavoro diviso in task piccoli (solo da leggere: l'app non divide nulla da sola, perché servirebbe un'IA) e, solo per le Attività, il collegamento «Passa a progetto» (cambia il tipo in progetto, con l'elenco dei passi vuoto da scrivere a mano). Dopo «Imposta» nella scheda resta una riga discreta con lo stesso avviso e collegamento.
- Mockup: `docs/mockups/32`, `33` e `34` (flusso animato).

## Lavorare o installare da un altro computer

- **Solo installare l'app:** dal telefono apri la pagina delle Releases del repository, scarica `mytask.apk` dell'ultima versione e aprilo: si installa sopra la versione precedente e i dati restano (stessa chiave di firma pubblica). Dal computer: `adb install -r mytask.apk` col debug wireless attivo.
- **Sviluppare:** serve Git, Node.js 24 e le dipendenze (`git clone`, poi `npm ci` nella cartella del progetto). Anteprima in locale: `cd web && MYTASK_SERVER=https://<indirizzo del server> npx vite` per vedere il sito con i dati veri, oppure un server di prova locale (`node server/src/index.ts` con `DATA_DIR`, `MYTASK_EMAIL` e `MYTASK_PASSWORD` d'esempio). Controlli: `npm run typecheck` e `npm test`.
- **Costruire l'APK in locale:** servono Java 21 (per esempio Microsoft OpenJDK 21) e l'SDK Android (piattaforma 36, `platform-tools`, `build-tools`); i passaggi sono sotto «Costruzione» in questo documento. In alternativa basta il workflow di GitHub, che costruisce l'APK a ogni push su `main`.
- **Dati:** non stanno nel repository. Il telefono e il sito li prendono dal server (sul NAS) con email e password; la chiave dell'IA (Gemini, Groq) resta invece solo sul dispositivo in cui è stata inserita e sul nuovo computer o telefono va reinserita.
