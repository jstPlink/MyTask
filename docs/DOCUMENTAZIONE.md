# MyTask: documentazione

Documento vivo. Si aggiorna a ogni modifica e ogni aggiornamento va annotato nel registro in fondo.

- **Versione documento:** 0.21.0
- **Stato progetto:** in uso. Il server gira sul NAS (immagine Docker da GitHub), il sito ha il layout per schermi larghi, l'app Android è installata sul telefono con icone e notifiche locali. Aperti: verifica delle notifiche e del service worker sul telefono, Google Calendar, altre funzioni IA, widget (vedi 8.2)
- **Codice:** [README.md](../README.md) (come avviarla, metterla sul NAS, installare l'app Android)
- **Mockup:** `docs/mockups/` (minimalisti ed estetici, chiaro/scuro). Non sono pubblicati perché usano i dati reali dell'utente
- **Decisioni di dettaglio:** `docs/01-setup-decisioni.md` (registro locale delle decisioni, non pubblicato)

## Come si lavora sul progetto (regole dell'utente)

Regole fisse per chi sviluppa (anche Claude), da rispettare a ogni modifica:

1. **Anteprima in locale:** sito e server in localhost, con il sito collegato al server vero (`MYTASK_SERVER`, vedi `web/vite.config.ts`), così l'utente vede le modifiche prima di pubblicarle.
2. **Telefono sempre aggiornato, senza chiedere il permesso:** l'app Android sul telefono si aggiorna ogni volta che è possibile (debug wireless, `adb install -r`, senza disinstallare per non perdere i dati locali), senza chiedere conferma. Se serve davvero disinstallare e reinstallare (per esempio perché cambia la chiave di firma), si può fare senza chiedere, ma prima si salvano i dati locali: si apre l'app con la rete attiva per farli sincronizzare con il server e, se si può, si copiano in un file per reinserirli dopo; a reinstallazione fatta si riaccede e si controlla che le voci siano tornate (altrimenti si reimportano da quel file con Altro > Account > Importa). L'APK si costruisce solo su GitHub Actions, quindi l'aggiornamento è possibile quando esiste una build pubblicata, cioè dopo che l'utente ha chiesto commit e push; se il telefono non è raggiungibile (debug wireless spento) si dice e si riprova alla richiesta successiva.
3. **Commit e push solo su richiesta dell'utente:** non si fanno mai da soli, nemmeno per aggiornare il telefono; si aspetta sempre che l'utente li chieda. Quando li chiede si fa tutto di seguito: commit, push, attesa della build e aggiornamento del telefono.
4. **Versione e documentazione:** si aumenta la versione a ogni commit e si annota il registro in fondo a questo documento.
5. **Privacy:** niente screenshot del telefono (può mostrare notifiche private); per verificare si usa il browser o i test.

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
| **Attività** | Burocrazia, casa, digitale, salute, lavoro, ecc. | Type "Admin" |
| **Progetti** | Obiettivi con sotto-attività e avanzamento | Voci con figli |
| **Esperienze** | Cose da fare fuori casa, eventi, uscite, luoghi | Type "Attività" |
| **Routine** | Abitudini quotidiane o settimanali | Voci come dieta o attività fisica |
| **Collezioni** | Film, Serie, Anime, Giochi, Libri, Ricette | Type Video, Gioco, Libri, Cibo |
| **Curiosità** | Cose da approfondire | Type "Info" |
| **Inbox** | Idee catturate al volo, ancora da smistare | Nuovo |
| **Completato** (ex Archivio) | Tutto ciò che è completato, consultabile come diario | Status "Done" |
| **Revisione** | Voci scadute o dimenticate, da ripianificare o chiudere | Nuovo |

### 2.1 Navigazione (telefono)

- **Cinque schede in basso** con icona (Oggi, Attività, Intrattenimento, Curiosità, Routine), più un pulsante "+" fisso per la cattura rapida. Su schermi larghi la navigazione diventa una barra laterale (sezione 2.3).
- **Attività** (prima "Fare") contiene tre sezioni: Attività, Progetti ed Esperienze.
- **Intrattenimento** contiene le collezioni (Film, Serie, Anime, Giochi, Libri, Ricette). Le **Curiosità** hanno una scheda propria.
- In cima a ogni scheda principale c'è il pulsante tondo con la tavolozza (**Stile e aspetto**), che apre subito tema e colore. In "Oggi", accanto a lui, ci sono **Inbox** e **Altro**, due pulsanti tondi. Altro apre: Inbox, Revisione, Archiviate, Completato, Tempo libero, Aspetto, Account (con la versione in fondo). Anche Revisione compare in Oggi come scheda quando ci sono voci da rivedere.
- **Gerarchia visiva in tre livelli:** grassetto grande = ciò che conta; testo normale = contesto; grigio piccolo = dettaglio. La priorità si vede da una barra a sinistra (3 spessori), non da etichette "Alta/Bassa". Il pallino pieno segna la scadenza rigida.

### 2.2 Estetica (stile e palette approvati dall'utente)

Layout identico ai mockup minimalisti, con questi cambi:

- **Un solo colore d'accento**, scelto dall'utente tra **Verde** (predefinito), **Petrolio** e **Indaco**. Usato solo per: azione principale, priorità alta, scheda attiva, avanzamento, spunte.
- **Aspetto modificabile dalle impostazioni** (Altro > Aspetto): tema Sistema / Chiaro / Scuro e colore d'accento. Si applica subito, viene salvato sul dispositivo e funziona offline.
- **Un colore d'avviso** (arancio), riservato a scadenze rigide e voci scadute.
- **Tutto il resto neutro**, con sfondo caldo e superfici bianche (chiaro) o grigio scuro (scuro).
- **Contrasto:** i colori di base (testo, testo secondario, testo tenue, linee, rilievi e superficie) hanno un contrasto verso lo sfondo più alto di almeno il 5% (rapporto WCAG) rispetto alla versione precedente, con la stessa tinta neutra. Nel tema chiaro lo sfondo è un po' più scuro, così le schede bianche risaltano di più.
- **Tema chiaro e tema scuro** con la stessa gerarchia; il tema segue il sistema, con possibilità di forzarlo.
- **Angoli più morbidi**; l'ombra compare solo sull'elemento più importante della schermata.
- **Priorità**: la barra a sinistra usa tre intensità dell'accento (alta piena, media 42%, bassa quasi invisibile).

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

### 2.3 Layout web per schermi larghi (implementato)

Il sito usa lo spazio degli schermi larghi (breakpoint a 900 e 1300 px); sul telefono e nelle finestre strette resta la colonna singola con le schede in basso.

- **Da 900 px:** barra laterale al posto delle schede (Oggi, Fare con Attività/Progetti/Esperienze, Intrattenimento con le sei collezioni, Curiosità, Routine; "Da sistemare": Inbox e Revisione con contatori; Completato; Tempo libero, Aspetto, Account; versione e, solo se si è offline, lo stato di sincronizzazione). I gruppi Fare e Intrattenimento si aprono solo quando sono attivi. I selettori a schede di Fare e Intrattenimento spariscono perché li sostituisce la barra laterale. Il dettaglio di una voce si apre a tutta pagina, con "Indietro".
- **Dettaglio in finestra (0.29.0):** da 900 px la voce si apre in una finestra in sovraimpressione al centro, sopra la schermata corrente (non più a tutta pagina né in un pannello a destra); si chiude con "Indietro", Esc o toccando lo sfondo.
- **Barra in alto:** cattura rapida (scrivi e premi Invio: si apre la conferma con la proposta), ricerca, pulsante Stile e aspetto e "+ Nuova voce" (il tipo segue la sezione in cui si è).
- **Ricerca:** per parole, senza maiuscole né accenti, nel titolo, nelle note, in "consigliato da" e "con chi", nelle zone e nelle checklist; le voci aperte vengono prima di quelle chiuse. Si attiva da 2 lettere.
- **Oggi** è un cruscotto a due colonne (cose da fare; routine, revisione e inbox). **Routine** ha una griglia settimanale a sette colonne in cui si può spuntare qualsiasi giorno.
- **Scorciatoie da tastiera:** N (cattura rapida), / (ricerca), Esc (chiude la conferma, la ricerca o il pannello). Spostarsi nell'elenco con J e K e segnare fatto con F non sono ancora implementati.
- La cattura rapida si apre al centro, come finestra, invece che dal basso.

### 2.3.1 Tag area e calendario (implementato)

- **Stile delle righe (P1):** ogni riga con priorità ha il checkbox bordato nel colore del livello (arancio-rosso = alta, ambra = media, grigio = bassa) e, a destra, un pallino con contorno colorato e sfondo tenue che contiene il numero d'ordine (1 = la prima da fare), senza raggruppamenti né sfondi sulle righe. Il numero è la posizione per punteggio nell'elenco delle attività, tra i blocchi del giorno nel piano di Oggi (gli impegni con orario fisso non lo hanno) e nella lista semplice di Oggi. Le liste di Intrattenimento ed Esperienze hanno il checkbox colorato ma non il numero.
- **Tag e area:** tolti dall'interfaccia (nessuna pillola sulle righe, nessun filtro per area; il campo `area` resta solo nei dati).
- **Oggi a sezioni:** Routine, Piano di oggi e Non entrano oggi sono schede separate e distanziate (la riga "Nei prossimi giorni" e la vecchia lista "Prossimi 7 giorni" non ci sono più). Nel giorno si scorre con lo swipe (a sinistra il giorno dopo, a destra quello prima; non scatta sullo scorrimento verticale o sui filtri scorrevoli). La navigazione tra giorni è un riquadro unico con le frecce ai lati.
- **Giorno e mese in Oggi:** Oggi è un'unica pagina e mostra la giornata con i blocchi orari; con le frecce si passa al giorno prima o dopo ("Torna a oggi" riporta indietro). Non c'è più il selettore Giorno/Mese: toccando il nome del giorno (con la freccetta) si apre una finestra con il mese, con un pallino per i giorni con attività (arancio se c'è una scadenza rigida o scaduta); toccando un giorno la finestra si chiude e si vede quel giorno. Un altro giorno mostra il suo piano (per i prossimi 14 giorni), le voci con scadenza quel giorno e, per i giorni passati, quelle rimaste aperte. Routine, Revisione e Inbox compaiono solo su oggi. Non c'è più una vista Calendario separata in Attività.
- **Stato di sincronizzazione:** in Oggi (telefono) compare solo se si è offline o ci sono modifiche in attesa; nella barra laterale del sito resta sempre visibile.
- **Indietro (pila unica):** ogni spostamento è una voce della cronologia del browser: cambio scheda o sotto-sezione, apertura di una schermata o di una voce, apertura di una finestra (cattura rapida, scelta del mese, voto, "quanto ci hai messo"). Il tasto indietro del telefono, quello del browser e il pulsante "Indietro" dell'app ripercorrono esattamente l'ordine inverso: prima si chiude la finestra aperta, poi si torna alla schermata precedente, poi alla scheda precedente. Aprire qualcosa da una finestra la chiude senza lasciare voci in sospeso (`web/src/App.tsx`, `useLayer` in `web/src/ui/nav.tsx`).

### 2.3.2 Piano della giornata (implementato)

L'app distribuisce da sola le attività nei giorni, in base alle priorità, al tempo libero e alla durata (`shared/piano.ts`, con test).

- **Tempo libero:** in Altro > Tempo libero si impostano, per ogni giorno della settimana, una o più fasce orarie (es. lun-ven 18:00-21:00). Si salva sul dispositivo. Finché non è impostato, Oggi mostra la lista semplice con un invito a impostarlo.
- **Algoritmo:** si prendono le azioni aperte e i prossimi passi dei progetti (stessi candidati di Oggi), ordinati per punteggio di priorità. Ognuna va nella prima fascia libera con spazio sufficiente, partendo da oggi (e per oggi dall'ora attuale), entro 14 giorni. Durata = sforzo stimato, 30 minuti se non è stimato.
- **Rimandare:** se non c'è spazio, le meno prioritarie passano ai giorni successivi. In Oggi compaiono in "Non entrano oggi" quelle che scadono oggi o sono scadute, con il giorno e l'ora a cui sono state spostate. Se finiscono dopo la scadenza il blocco è segnato "oltre la scadenza".
- **Spezzare:** le attività oltre i 60 minuti si dividono in blocchi (minimo 30 minuti) su più fasce e giorni ("parte 1 di 2"); quelle più brevi non si spezzano.
- **Pause curiosità:** dopo un blocco grande (60 minuti o più), ogni due blocchi grandi dello stesso giorno, il piano inserisce una pausa di 15 minuti con una curiosità da approfondire, per spezzare il ritmo; al massimo due al giorno, una curiosità diversa per ogni pausa (prima le più interessanti, a parità le più vecchie), e solo se nella fascia resta spazio per altro lavoro. Nel piano compaiono come "Pausa curiosità" e si spuntano come approfondite.
- **Impegni con orario:** le voci con data e ora di inizio restano dove sono e tolgono tempo libero.
- **Oggi:** "Piano di oggi" è una giornata scandita da blocchi con ora di inizio e durata, con una barra del tempo usato sul tempo libero; sotto, un riepilogo dei prossimi giorni. Il piano si ricalcola a ogni modifica e ogni minuto, quindi segue l'ora che passa.
- **Sincronizzazione del tempo libero:** il tempo libero viaggia nella stessa sincronizzazione delle voci (campo `impostazioni` di `/api/sync`, tabella `settings` del server, chiave `tempoLibero`). Ogni dispositivo ricorda quando l'ha modificato e vince la modifica più recente, così telefono e sito vedono gli stessi orari. Serve l'app e il server alla 0.21.0 o successiva; un valore impostato con una versione precedente sale al primo collegamento.
- **Non ancora:** eccezioni per un singolo giorno (il modello le prevede), piano nel calendario.

- **Barra in alto e barra laterale (0.26.0):** cattura rapida e ricerca hanno la stessa larghezza; tolti l'icona Aspetto (resta nella barra laterale) e il pulsante "+ Nuova voce" (la cattura resta nella barra e con N); le cinque sezioni principali della barra laterale (Oggi, Attività, Intrattenimento, Curiosità, Routine) hanno la stessa dimensione delle altre voci.

- **Barra in alto e barra laterale (0.26.0):** cattura rapida e ricerca hanno la stessa larghezza; tolti l'icona Aspetto (resta nella barra laterale) e il pulsante "+ Nuova voce" (la cattura resta nella barra e con N); le cinque sezioni principali della barra laterale hanno la stessa dimensione delle altre voci.

- **Barra laterale (0.27.0):** il contatore di Revisione compare solo se ci sono voci da rivedere; l'indicatore di sincronizzazione compare solo quando il sito è offline. La schermata **Notifiche** è stata tolta (telefono e web): le notifiche continuano a funzionare, il permesso viene chiesto al primo avvio dell'app Android e, se negato, si riattiva dalle impostazioni di Android.

- **Importanza e curiosità (0.32.0):** l'importanza di attività e progetti si sceglie con uno **slider** da 1 a 5 (etichette molto bassa ... molto alta) al posto dei pallini; le curiosità hanno il campo **Tempo stimato** (di base 15 minuti, anche se create dalla cattura) e la pausa curiosità nel piano dura quanto il loro tempo.
- **Vista web (0.32.0):** tolta la barra in alto: in cima alla barra laterale ci sono il pulsante **+ Nuova nota** (apre "Cosa ti è venuto in mente?", scorciatoia N) e subito sotto la **ricerca** (scorciatoia /); la finestra della voce è più alta (fino al 96% dello schermo); in Oggi non c'è più la scheda Inbox e la Routine sta tra la barra del giorno e il piano.

### 2.4 Telefono: icone e pulsanti circolari (implementato)

- **Icone** per le sezioni principali (Oggi: sole; Fare: spunta in un quadrato; Intrattenimento: bussola; Routine: frecce che si ripetono), nella barra in basso con un'evidenziazione tonda sulla scheda attiva, e nella barra laterale del sito.
- **Inbox e Altro** in "Oggi" sono ora due pulsanti tondi da 46 px, più facili da toccare: Inbox con un contatore (se ci sono idee da smistare) e Altro con tre pallini.

### 2.4.1 Scheda di una voce, tipi e stato (implementato)

- **Tipo accorpato:** nella scelta del tipo ci sono Attività, Progetto, Esperienza, Routine, Intrattenimento, Ricetta e Curiosità. Scegliendo Intrattenimento compare sotto una seconda scelta "Sezione" (Film, Serie, Anime, Gioco, Libro). Sotto il cofano i tipi restano quelli di prima.
- **Niente stato da scegliere:** ogni voce nuova è "da fare". In fondo alla scheda ci sono, nell'ordine, "Elimina", "Archivia" e "Completato". Le voci archiviate stanno in **Altro > Archiviate** (non compaiono più nelle liste) e si ripristinano aprendole ("Ripristina"). Non va confusa con l'**Archivio**, che raccoglie le voci completate.
- **Gruppo Intrattenimento:** per film, serie, anime, giochi e libri un solo gruppo unisce interesse, piattaforma, consigliato da, con chi, durata e genere (per le ricette il gruppo si chiama Ricetta).
- **Voto e commento:** segnando come fatto un film, un libro, un gioco o simili (dal segno di spunta o dal pulsante) si apre "Com'è andata?" con il voto da 1 a 10 e un commento facoltativo; confermando la voce risulta fatta quel giorno. Non esiste più la sezione "Dopo averlo fatto". Voto e commento si vedono nel gruppo "Completata".
- **Link e documenti:** per ora tolti dalla scheda (il campo resta nei dati).
- **Pannello unico per Attività e Progetto:** un solo gruppo con, in ordine, Progetto (solo per le attività: tendina con i progetti aperti, "Nessuno" se non è collegata), Data, Importanza e Tempo stimato (da 5 minuti a 1 giorno: 5, 15, 30 min, 1, 2, 4, 6, 8, 12 ore, 1 giorno). Se c'è una data compaiono sotto Ora, Scadenza rigida e Promemoria. Tolti Area, Ricorrenza e la sezione dei sotto-task (le voci già esistenti con quei dati continuano a funzionare); il campo Progetto è il vecchio "Progetto padre" (`padreId`) tornato in prima posizione.
- **Attività raggruppate per progetto:** in Attività e in Oggi (piano del giorno e lista semplice) i task di uno stesso progetto stanno insieme sotto una testata con icona, nome (toccandola si apre il progetto), avanzamento "fatti / totale" e barra; le attività senza progetto restano righe singole. Il gruppo sta dove si trova il suo task più prioritario e il numero d'ordine resta quello globale. In Attività compaiono tutti i task aperti del progetto, in Oggi solo il prossimo passo (`raggruppaPerProgetto` in `shared/views.ts`).
- **Elenco Esperienze:** un solo elenco, "Con data" e "Da fare quando capita", senza raggruppamenti per luogo.
- **Pannello Esperienza:** Data, Interesse e il pulsante "Apri in Google Maps", che cerca il nome dell'esperienza. Tolti Zona e il link a Google Maps.
- **Ricetta:** solo Interesse e Genere, a scelta multipla tra Antipasto, Primo, Secondo, Contorno, Dolce, Piatto unico, Zuppa, Pane e lievitati, Bevanda (salvata come elenco separato da virgole in `genere`). Tolti Consigliato da e Con chi.
- **Progetto con checklist:** solo i progetti hanno la checklist (gruppo "Checklist · X su Y", con barra di avanzamento): contiene le righe della checklist e i passi già esistenti (voci figlie), tutti spuntabili; si aggiungono righe di checklist con "Aggiungi un passo". Le checklist dei progetti già finite nelle note tornano nel campo da sole (`shared/migrazioni.ts`).
- **Persone e checklist (altri tipi):** non si modificano più. All'avvio e a ogni sincronizzazione le voci che li hanno li vedono spostati nelle note (`web/src/lib/migrazioni.ts`), e i campi vengono svuotati.
- **Cosa guardo stasera:** i filtri sono Con chi (Da solo, Con il partner, Con amici), Piattaforma (quelle già usate più Prime Video e Disney+), Mood (Spensierato, Rilassante, Emozionante, Intenso, Riflessivo), Energia che hai stasera (Bassa, Media, Alta) e Tipologia (Comico, Drammatico, Azione, Thriller, Horror, Fantascienza, Fantasy, Animazione, Documentario). Non c'è più "Quanto tempo hai?". I filtri spostano il punteggio senza escludere: le voci senza il dato restano neutre. Per film, serie e anime la scheda ha le scelte Tipologia (campo `genere`), Mood (`mood`) ed Energia richiesta (`energia`) (`shared/stasera.ts`).
- **Intrattenimento per tipo:** il film ha Interesse, Piattaforma e Genere (niente Consigliato da, Con chi e Durata); serie e anime mantengono Consigliato da, Con chi e Durata in minuti; il gioco ha Durata in ore (salvata in minuti, per esempio 12,5 ore); il libro ha le **Pagine**, cercate online da sole su Open Library a partire dal titolo (al servizio esterno va solo il titolo; si possono correggere) (`web/src/lib/libri.ts`).
- **Tre pulsanti in fila:** in fondo alla scheda "Elimina", "Archivia" e "Completato" stanno uno accanto all'altro.
- **Barra in basso:** la scheda attiva ha lo sfondo che copre icona e testo.
- **Rotazione:** l'app Android resta sempre in verticale (`screenOrientation` nel manifest).

### 2.4.2 Cattura, stime del tempo e scadenza rigida (implementato)

- **Pulsante "+":** in ogni scheda (e "+ Nuova nota" sullo schermo largo) apre sempre "Cosa ti è venuto in mente?". Il salvataggio crea una **bozza in Inbox** (anche se il tipo è chiaro), da rivedere e smistare aprendola.
- **Scadenza rigida:** appena si imposta una data compare il checkbox "Scadenza rigida", subito sotto la Data.
- **Attività:** la lista mostra tutte le attività aperte (anche quelle in Revisione), con i task dei progetti raggruppati sotto il progetto.
- **Completato:** la voce "Archivio" di Altro si chiama ora "Completato".
- **Stima con margine d'errore** (`shared/stima.ts`, con test): ogni attività ha un margine d'errore atteso. Parte da ±30% (vale come 3 misurazioni) e si affina con l'uso: al segno di fatto di un'attività l'app chiede, in una finestra facoltativa, "Quanto ci hai messo?" (campo `durataRealeMin`); l'errore medio |reale − stimato| / stimato delle attività completate sposta il margine verso l'alto o il basso (tra 5% e 100%). Per una nuova nota l'app cerca attività simili già fatte (somiglianza tra le parole del titolo, fino a 5), usa la mediana dei loro tempi reali come stima e mostra margine e intervallo atteso; nella cattura rapida la stima viene inserita da sola, nella scheda compare un suggerimento con "Usa". Il margine si vede in Attività e in Oggi accanto al tempo (es. "30 min ±30%"). Il piano della giornata non lo usa ancora per allargare i blocchi.

- **Gruppi di progetto (0.24.0):** i task sotto la testata sono rientrati e allineati (stessa indentazione per aperti e chiusi); l'icona del progetto è una cartella senza colore dentro un tondino con contorno. Il checkbox dei task non cambia più colore con la priorità (resta solo il numero d'ordine colorato). La scheda **Progetti** usa lo stesso aspetto: un gruppo per progetto con tutti i suoi task (aperti per priorità, poi i completati barrati).
- **Curiosità:** ogni riga mostra l'interesse con cinque pallini. Le barre di scorrimento delle pagine sono nascoste.

- **Attività (0.25.0):** l'intestazione elenca i conteggi reali ("N attività · N progetti · N esperienze", più quelle da rivedere) e la scheda Attività mostra tutto: i task (raggruppati per progetto) e, sotto, le esperienze (comprese quelle in Revisione).
- **Blocco di priorità nella scheda (0.30.0, variante C1):** riquadro col contorno del colore della priorità; il numero grande è la **posizione** in classifica (1 = la più prioritaria, "3ª da fare su 28"), niente punteggio; a destra la targhetta "Priorità alta/media/bassa"; sotto quattro barre con quanto pesano urgenza, importanza, poco sforzo ed età, e una riga con scadenza, importanza a parole e tempo con margine d'errore.
- **Barra del piano per attività:** la barra del tempo libero in Oggi è divisa in un segmento per blocco, colorato dalla priorità (le pause sono più chiare); ogni riga del piano mostra il margine d'errore (es. "margine ±9 min"). Dalla 0.31.0 il piano usa la **linea a fasce** (mockup `17-piano-c2-orari.html`, variante 4): in alto la barra sottile delle 24 ore con le fasce libere **cliccabili** (tempo libero, attività colorate dalla priorità, impegni fissi con bordo, ora attuale; le fasce già passate sono disattivate); sotto gli orari di inizio e fine della fascia scelta e la sua barra sottile a segmenti colorati dalla priorità; sotto la barra, senza linee di collegamento, un pallino numerato (24 px, come i pallini delle righe, mockup `20-numeri-sotto-barra.html` stile B1) per attività, centrato sotto il suo segmento e spostato di lato quando due pallini si toccherebbero. L'elenco sotto mostra solo le attività di quella fascia, con il margine d'errore di ciascuna; di default è scelta la fascia in corso o la prossima. Tolto il riepilogo "ore usate su totale". Se una fascia è molto lunga e le attività vicine, i segmenti stretti possono sovrapporsi. Mockup locali: `10`-`17` in `docs/mockups/`.

- **Interesse a pallini grandi (0.34.0):** nelle righe di intrattenimento e di curiosità l'interesse (1-5) è mostrato a destra con cinque pallini da 11 px (dalla 0.35.0; erano 22 px) pieni nel colore d'accento o vuoti con il contorno, senza numero, con checkbox e pallini centrati in verticale sulla riga; non compare più nella riga delle informazioni. Mockup locali: `18-interesse-righe.html`, `19-interesse-pallini.html`.

- **Oggi sul web (0.36.0):** una sola colonna: titolo, barra del giorno, **Revisione** (solo se ci sono voci da rivedere), routine e piano. Nella barra laterale c'è più spazio tra il logo e "+ Nuova nota" e tra la ricerca e le sezioni. Mockup locali dei numeri sotto la barra (senza linee guida): `20-numeri-sotto-barra.html`.

- **Barra laterale e Oggi web (0.38.0):** il logo, il blocco "+ Nuova nota" con la ricerca e le sezioni sono separati da divisori, come i gruppi più in basso; tra la barra del giorno, la Revisione e la routine c'è lo stesso spazio (16 px). Il pulsante "+" sul telefono è più grande (62 px).
- **Revisione delle voci importate:** le attività e i progetti importati da Notion (identificativo "n" + 12 cifre) che non sono mai stati toccati dopo l'importazione (data di modifica uguale a quella di creazione) vengono messi in **Revisione** una sola volta, all'avvio (`segnaImportataDaRivedere` in `shared/migrazioni.ts`, con test). Aprire una voce da rivedere nella scheda la toglie dalla Revisione.

### 2.4.3 Arricchimento da internet e cosa guardo stasera (implementato, 0.33.0)

- **Cosa fa:** quando una voce di tipo film, serie, anime, gioco o libro ha dati mancanti, l'app li cerca su internet da sola, in background: **genere** (per film, serie e anime la tipologia dell'app: Comico, Drammatico, Azione, Thriller, Horror, Fantascienza, Fantasy, Animazione, Documentario), **mood** (Spensierato, Rilassante, Emozionante, Intenso, Riflessivo), **energia / impegno mentale** (bassa, media, alta), **durata** dei film e **pagine** dei libri. Per giochi e libri il genere è il testo trovato. I dati si salvano nella voce (e si sincronizzano), quindi i filtri di "Cosa guardo stasera" funzionano davvero.
- **Fonti:** Wikidata (gratuita e senza chiave; al servizio va solo il titolo) e, per le pagine dei libri, Open Library. Mood ed energia si ricavano dai generi con regole fisse (`shared/arricchimento.ts`, con test). Non si sovrascrive mai ciò che l'utente ha già scritto.
- **Voci già inserite:** vengono arricchite automaticamente al primo avvio con rete, una alla volta (circa una ogni 2 secondi, per non superare i limiti del servizio); nelle sessioni successive si completano quelle rimaste. `arricchitoIl` ricorda quando è stata fatta la ricerca: una voce non trovata si riprova dopo 30 giorni. Se il titolo non corrisponde a nulla (o a un omonimo sbagliato) il campo si corregge a mano dalla scheda.
- **Persone e Luoghi:** le sezioni sono state eliminate dall'app e dal sito. "Consigliato da" e "Con chi" restano campi di testo.

### 2.5 Feedback aptico e animazioni (implementato)

- **Intensità aptica:** nell'app Android il tocco usa un plugin nostro (`HapticaPlugin`) con ampiezza ridotta del 30% rispetto ai valori standard di Capacitor (leggero 77 invece di 110, marcato 126 invece di 180); nel browser del telefono la vibrazione dura 6 ms (10 per il segno di fatto).
- **Feedback aptico:** ogni tocco a un pulsante attivo (pulsanti, schede, interruttori, scelte nei menu) dà una vibrazione leggera; il segno di fatto una più marcata. Nell'app Android usa il motore aptico (`@capacitor/haptics`), nel browser del telefono la vibrazione breve del browser, sul computer nulla (`web/src/lib/haptic.ts`, un solo ascoltatore in cattura per tutta l'app).
- **Animazioni** (solo CSS, in fondo a `web/src/styles.css`): le schermate e le schede entrano con una breve dissolvenza dal basso; le righe appaiono in sequenza; i tag compaiono con un piccolo ingrandimento; il segno di fatto e il giorno scelto nel mese "scattano"; foglio di cattura e avvisi salgono dal basso; i menu a tendina si aprono con un leggero zoom; le barre di avanzamento e del tempo usato si riempiono con una transizione; i pulsanti si schiacciano leggermente quando premuti.
- Con "Riduci animazioni" attivo nel sistema, le animazioni sono disattivate.

## 3. Modello dati

Un'unica tabella **Elemento** (`shared/types.ts`) con un campo `tipo`. Sul server ogni voce è un documento JSON con un numero di sequenza per la sincronizzazione; sul dispositivo sta in IndexedDB. I campi sono opzionali tranne quelli indicati.

### Elemento

| Campo | Note |
|---|---|
| `id`, `titolo` (obbligatori) | |
| `tipo` (obbligatorio) | azione, progetto, esperienza, routine, film, serie, anime, gioco, libro, ricetta, curiosita, persona |
| `stato` | da_fare, in_corso, fatto, saltato, parcheggiato. **"Scaduto" non è uno stato**: si calcola da data e stato. Per le curiosità "da_fare" si legge "da approfondire" |
| `creato`, `aggiornato` | millisecondi; `aggiornato` decide chi vince nella sincronizzazione |
| `eliminato` | cancellazione logica: la voce resta, così la cancellazione arriva agli altri dispositivi |
| `inbox` | catturata ma non ancora smistata; si toglie da sola alla prima modifica nell'editor |
| `daRivedere` | messa in Revisione a mano o dall'importazione |
| `note`, `link[]` | link ammessi anche a file su Seafile |
| `inizio`, `fine`, `oraInizio`, `oraFine` | date YYYY-MM-DD e orari HH:MM facoltativi |
| `rigida` | `true` se la scadenza non è spostabile |
| `ricorrenza` | ogni N giorni/settimane/mesi/anni |
| `promemoria[]`, `insisti` | promemoria a N giorni dalla scadenza; insistenza ogni N minuti |
| `importanza` (1-5), `sforzoMin`, `area` | azioni e progetti |
| `interesse` (1-5) | collezioni, esperienze e curiosità |
| `padreId`, `checklist[]` | sotto-task (un solo livello) e liste semplici dentro una voce |
| `persone[]`, `daContattare` | non più usati (le sezioni Persone e Luoghi sono state tolte); restano nei dati vecchi, ignorati |
| `zona`, `luogo`, `linkMaps` | non più usati dalle schermate (restano nei dati vecchi) |
| `piattaforma`, `consigliatoDa`, `conChi`, `durataMin`, `genere`, `mood`, `energia`, `pagine`, `arricchitoIl` | collezioni (gli ultimi cinque si compilano da soli, vedi 2.4.3) |
| `voto`, `completatoIl` | collezioni e archivio |
| `fascia`, `volteSettimana`, `obiettivo`, `oraPromemoria`, `log[]` | routine: momento della giornata, quota settimanale, obiettivo minimo, ora del promemoria, giorni in cui è stata fatta |

### Conversione dal vecchio Priority (per l'import)

| Notion | Attività → importanza | Collezioni → interesse |
|---|---|---|
| Very high | 5 | 5 |
| High | 4 | 4 |
| Medium | 3 | 3 |
| Low | 2 | 2 |
| Very low | 1 | 1 |
| vuoto | da stimare con l'IA | 3 |

## 4. Regole principali

### 4.1 Priorità delle azioni (implementata, pesi da tarare con l'uso)

Punteggio da 0 a 100 usato per ordinare "Oggi" e le liste:

- **Urgenza** (peso 45%): scaduta/oggi = 100; entro 3 giorni = 80; entro 7 = 60; entro 30 = 35; oltre = 15; senza data = 0. Se la scadenza è rigida, l'urgenza vale 1,3 volte.
- **Importanza** (peso 35%): da 1 a 5, normalizzata.
- **Sforzo basso** (peso 10%): le attività sotto i 15 minuti salgono (le "vittorie rapide").
- **Età** (peso 10%): cresce di poco ogni settimana per evitare che le voci marciscano.

Le collezioni non hanno punteggio di urgenza: si ordinano per **interesse**, filtrate da contesto (piattaforma, durata, con chi). Nelle liste la barra a sinistra ha tre livelli: punteggio da 60 in su = alta, da 35 = media, altrimenti bassa.

### 4.2 Stato "scaduto"

Calcolato: data finale passata e stato diverso da fatto/saltato. Le voci scadute compaiono nell'area **Revisione**, con azioni rapide: ripianifica, segna come saltato, segna come fatto.

Entrano in Revisione anche le **attività senza scadenza che non vengono modificate da più di 45 giorni** (costante `GIORNI_ATTIVITA_VECCHIA` in `shared/views.ts`), perché la priorità o altri parametri potrebbero non essere più giusti. Le azioni sono: "Va ancora bene" (conferma e riparte il conteggio), "Cambia priorità e parametri" (apre la scheda), "Parcheggia" e "Salta". Non riguarda le attività con scadenza, quelle parcheggiate, i sotto-task e i progetti (che hanno la loro regola dei 30 giorni). Finché sono in Revisione, queste attività non compaiono in Oggi né nel piano.

### 4.3 Promemoria

- Possono essere singoli o ripetuti (giornalieri, settimanali, ogni N giorni, a orari fissi).
- **Insistenza:** su alcune voci scelte dall'utente il promemoria si ripete (a intervalli configurabili) finché la voce non viene spuntata o rimandata.
- I promemoria si scelgono nella scheda di ogni voce (7 giorni, 3 giorni, 1 giorno prima, il giorno stesso, alle 9:00); non vengono impostati in automatico.
- Nell'app Android sono notifiche programmate nel telefono (sezione 5.2), che arrivano anche ad app chiusa e senza rete. Nel browser compaiono finché l'app è aperta.

### 4.4 Routine (confermata)

Le abitudini non sono task: non scadono e non finiscono.

- Una routine ha una **fascia della giornata** ("mattina", "dopo cena", "prima di dormire") e una frequenza flessibile (es. 3 volte a settimana).
- Compare nella sezione "Routine di oggi" solo nei giorni utili, con una spunta singola.
- Obiettivo minimo piccolo (es. "leggere 10 minuti") per abbassare l'attrito.
- Nessuna colpa sui giorni saltati: si guardano i conteggi settimanali, non le serie perfette.
- Una routine con interesse quasi nullo (chitarra) resta in **Parcheggiato** e non compare in Oggi finché non viene attivata.

### 4.5 Cattura rapida (cambiata nella 0.38.0)

Una riga di testo (o dettatura) crea una **bozza in Inbox**: **il testo non viene interpretato** (nessun tipo, data o persona dedotti, nessuna IA). Mentre si scrive compaiono **tutte le note che contengono le stesse parole**, anche in forme diverse (stessa radice, per esempio "pagare" e "pagamento"), con tipo e stato, così si capisce subito se la nota esiste già; toccandone una si apre. Sul telefono l'elenco sta **sopra** il box di scrittura (che resta in basso, così i campi non si spostano); sul web sta sotto. "Salva in Inbox" (o Invio) salva il testo così com'è; il tipo si sceglie poi aprendo la bozza dall'Inbox (`cercaSimili` in `shared/views.ts`, con test). Offline funziona allo stesso modo; le voci si sincronizzano al ritorno della rete.

### 4.6 Sincronizzazione e offline

- I dati vivono anche nel dispositivo; le modifiche si accumulano e vengono inviate al server appena c'è rete.
- Utente unico: conflitti risolti con l'ultima modifica **per voce** (vince la versione con data di modifica più recente).
- Le modifiche fatte offline restano in coda e partono da sole al ritorno della rete (provato in locale).
- Il database sul NAS è il riferimento. Il server ne salva una copia al giorno nel volume Docker (le ultime 14); il backup vero e proprio lo gestisce l'utente con gli strumenti del NAS. Dall'app si scarica anche tutto in JSON (Altro > Account) e si può reimportare da file.

### 4.7 Progetti e voci con figli (confermata)

Nei dati di Notion c'erano 9 voci con figli (da 2 a 25). Il problema è che un padre con molti figli riempie tutte le liste. Regole adottate:

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

### 4.8 Cosa compare in Oggi (implementato)

1. **Routine** del giorno: giornaliere, oppure a quota settimanale finché la quota non è raggiunta.
2. **Da fare oggi**: tutte le voci con scadenza oggi o scaduta da non più di 2 giorni, più le voci senza data con il punteggio più alto, fino a un massimo di 5 (se le scadenze sono di più, compaiono tutte). A parità di punteggio vengono prima quelle già in corso.
3. Di un progetto compare **solo il prossimo passo**, con le eredità di importanza e scadenza.
4. Le **esperienze senza data** non compaiono mai in Oggi: sono una lista di desideri.
5. I giorni successivi si guardano scegliendo il giorno dalla finestra del mese (il piano copre 14 giorni).
6. Le voci scadute da **più di 2 giorni**, quelle segnate "da rivedere" e i progetti fermi da 30 giorni e le attività senza scadenza ferme da 45 giorni vanno in **Revisione**, non in Oggi né nelle liste di Fare.
7. Le voci parcheggiate non compaiono in Oggi.

### 4.9 Tipi e regole di smistamento nell'importazione

Il tipo di Notion non basta a decidere il tipo in MyTask, quindi l'importazione usa regole esplicite: elenchi di titoli che sono serie o anime, titoli da trasformare in progetti o routine, zone, persone nominate nelle note, aree delle azioni (casa, burocrazia, digitale…). Sono dati personali, quindi stanno in `regole.locale.ts` (ignorato da git); nel repository c'è solo `regole.esempio.ts`.

## 5. Architettura

Le scelte marcate "confermato" sono decise dall'utente; le altre sono proposte tecniche mie, modificabili.

| Parte | Scelta |
|---|---|
| Hosting | Un container Docker su un NAS (confermato). L'immagine viene costruita da GitHub Actions e pubblicata su `ghcr.io/jstplink/mytask`; il NAS la scarica, senza costruire nulla in locale |
| Backend | Node.js 24 con Fastify e SQLite integrato (`node:sqlite`, nessuna dipendenza nativa); TypeScript eseguito direttamente, senza passaggio di compilazione |
| Frontend | React + Vite, web app installabile (PWA) con archivio locale in IndexedDB e service worker |
| App Android | PWA + APK tramite Capacitor, con notifiche locali (confermato). I widget sono rimandati a una versione successiva |
| Accesso | Email e password. HTTPS e accesso da fuori casa tramite **Cloudflare Tunnel**, come già per Seafile, con un sottodominio dedicato che punta al container sul NAS (confermato) |
| IA | Gemini per iniziare (scelta dell'utente), dietro un modulo con interfaccia comune per poter cambiare provider senza riscrivere nulla |
| Documenti | Solo collegamenti a Seafile, incollati a mano (confermato) |
| Calendario | Dati già pronti (inizio, fine, orario) e modulo di sincronizzazione con Google Calendar predisposto, ma non attivo. L'attivazione richiederà il consenso OAuth di Google e un indirizzo HTTPS raggiungibile |

### 5.1 Note su sicurezza e risorse

- Con il tunnel Cloudflare l'app è raggiungibile da Internet. Il login (email e password con hash scrypt, sessioni a token, limite ai tentativi sbagliati) è obbligatorio. Si consiglia (da decidere) **Cloudflare Access** davanti all'app, ma l'app Android non riuscirebbe più a collegarsi senza le credenziali di servizio di Cloudflare.
- Il NAS ha un processore di fascia bassa e poca RAM: un modello IA locale non è pratico. L'IA passa dal servizio esterno (Gemini).
- Il database è un solo file SQLite nel volume Docker; copia giornaliera interna (ultime 14) e backup esterno a cura dell'utente.
- Essendo l'app raggiungibile con HTTPS, la sincronizzazione con Google Calendar è tecnicamente fattibile quando vorrai attivarla.

### 5.2 App Android

- **Capacitor**: la web app è impacchettata in un'app Android (`web/android`); l'interfaccia è la stessa. Al primo accesso chiede l'indirizzo del server.
- **Notifiche locali**: `shared/pianifica.ts` calcola, per i prossimi 14 giorni, le notifiche da programmare nel sistema operativo (promemoria delle scadenze, insistenza ogni N minuti, routine all'ora scelta). Il telefono le consegna anche ad app chiusa; si riprogrammano a ogni modifica dei dati e quando si torna nell'app. Nel browser restano i promemoria ad app aperta.
- **Costruzione**: il PC di sviluppo non ha l'SDK Android; l'APK si costruisce nel workflow di GitHub e finisce nelle Releases (`mytask.apk`).
- **Firma**: chiave pubblica nel repository per poter aggiornare l'app sopra la versione precedente; chiave privata facoltativa tramite segreti del repository.
- **CORS**: il server ammette le origini dell'app (`https://localhost`, `capacitor://localhost`) e quelle in `CORS_ORIGINS`.
- Se davanti al dominio c'è Cloudflare Access, l'app non riuscirebbe a collegarsi senza le credenziali di servizio di Cloudflare.

### 5.3 Versione e aggiornamenti

La versione sta in un solo posto, il `package.json` principale, e da lì arriva ovunque: l'app (sito e telefono: schermata di accesso, Altro, Account), il server (`/api/health`, mostrata in Account con un avviso se differisce da quella dell'app), l'APK (`versionName`; il `versionCode` è maggiore×10000 + minore×100 + patch) e l'etichetta dell'immagine Docker. La versione si aumenta a ogni commit. A ogni push GitHub Actions esegue il controllo dei tipi e i test, pubblica l'immagine `ghcr.io/jstplink/mytask` e l'APK nelle Releases. Il NAS si aggiorna con `docker compose pull && docker compose up -d`; il telefono con il nuovo `mytask.apk`.

## 6. Importazione da Notion

Una sola volta, dal CSV esportato, con lo script `server/scripts/import-notion.ts`:

1. Lettura del CSV (430 righe).
2. Unione dei duplicati (10 nomi).
3. Smistamento dei tipi con regole esplicite (sezione 4.9): Video → Film/Serie/Anime; voci "Info" che sono film o giochi → tipo giusto; "Attività" → Attività, Progetti, Routine o Esperienze; "Admin" tecnici → Attività; parole come progetto o routine da elenchi.
4. Estrazione dalle note: piattaforma, consigliato da, con chi, genere, link ripuliti dai parametri di tracciamento.
5. Conversione di priorità (importanza o interesse), stati e date; orari che diventano scadenza rigida; ricostruzione dei padri e dei figli (sotto-task o checklist).
6. Le 26 voci con data passata e non fatte finiscono in Revisione, perché la data è scaduta da più di due giorni.
7. Report finale (non pubblicato) con tutto ciò che è stato modificato.

Risultato: 383 voci più 14 persone. Il file si prepara sul computer (`--json`), dove stanno le regole personali, e si carica nell'app da *Altro > Account > Importa le voci da un file (JSON)*; in alternativa dentro il container con `--from-json`. Nessun identificativo né link a Notion viene conservato.

## 7. Funzioni IA

| Funzione | Stato |
|---|---|
| Compilazione automatica dalla riga di cattura | Fatta (Gemini, con ripiego locale). Serve `GEMINI_API_KEY` sul server; provata solo con una risposta simulata |
| Pulizia e riorganizzazione all'importazione | Fatta una volta, con regole esplicite scritte per i dati dell'utente |
| "Cosa guardo stasera?" | Fatta senza IA: ragionamento locale su interesse, durata, piattaforma e compagnia |
| Stima dello sforzo | Da fare |
| Spezzare un'idea in passi | Da fare |
| Revisione settimanale | Da fare |

Le voci sensibili (banca, salute, contratti) vanno escluse dall'invio a servizi esterni oppure l'utente sceglie se includerle. Oggi al servizio esterno va solo il testo della riga di cattura scritta dall'utente.

## 8. Roadmap

| Fase | Obiettivo | Stato |
|---|---|---|
| 0 | Chiudere le domande di setup | Completata (2026-10-15) |
| 1 | Mockup minimalisti (gerarchia delle informazioni) | Completata, layout approvato |
| 2 | Mockup estetici | Completata, stile e palette approvati |
| 3 | Scrittura dell'app: base, Oggi, Inbox, import | Fatta e provata in locale |
| 4 | Collezioni, Routine, Revisione | Fatta insieme alla fase 3 (progettazione unica) |
| 5 | APK con notifiche e widget | Fatta: APK costruito da GitHub Actions, notifiche locali programmate nel telefono. Widget rimandati |
| 6 | IA | Cattura rapida con Gemini fatta (serve la chiave); le altre funzioni IA da fare |
| 7 | Layout web per schermi larghi, icone e pulsanti tondi sul telefono, ricerca | Fatta (0.10.0) |

### 8.1 Stato dell'implementazione

| Parte | Stato |
|---|---|
| Server: login, sessioni, limite ai tentativi, CORS per l'app, sincronizzazione, esportazione JSON, versione, copia giornaliera | Fatto, con test; in funzione sul NAS |
| App web: Oggi, Fare (azioni, progetti, esperienze), Intrattenimento (6 collezioni e curiosità), Routine, Inbox, Revisione, Completato, Cosa guardo stasera, ricerca, editor completo, Aspetto, Account | Fatta, provata nel browser su dati reali importati |
| Layout per schermi larghi (barra laterale, pannello di dettaglio, cruscotto, griglia della routine, scorciatoie N, /, Esc) | Fatto e provato nel browser a 1440, 1100 e 375 px |
| Uso offline: modifiche in coda e sincronizzazione al ritorno della rete | Provato in locale |
| Importazione da Notion con report e caricamento da file nell'app | Fatta; il caricamento nell'app è provato in locale |
| Cattura rapida: interpretazione locale, IA (Gemini) con ripiego, voce, rilevamento dei duplicati | Fatta. L'IA è provata solo con una risposta simulata |
| Docker | Immagine costruita e verificata da GitHub Actions, pubblica; l'app gira sul NAS dietro Cloudflare Tunnel |
| App Android (Capacitor) | Costruita da GitHub Actions, installata sul telefono con debug wireless, parte senza errori |
| Notifiche locali programmate nel telefono | Scritte e provate con i test del pianificatore; **da verificare sul telefono** |
| Service worker (apertura dell'app senza rete) | Generato dalla build, **non verificato** in un browser reale |
| Collegamento Google Calendar | Solo i dati sono pronti (date e orari). Il modulo di sincronizzazione non è scritto |
| Widget | Rimandati (decisione dell'utente) |

### 8.2 Ancora da fare

- Verificare sul telefono le notifiche (scadenze, insistenza, routine) e il service worker.
- Scorciatoie J e K per scorrere l'elenco e F per segnare fatto (layout largo).
- Funzioni IA: stima dello sforzo, spezzare un'idea in passi, revisione settimanale.
- Collegamento a Google Calendar.
- Widget Android.
- Decidere se mettere Cloudflare Access davanti al sito (richiede di gestire l'accesso dell'app Android).
- Chiave di firma privata per l'APK, se si vuole (oggi si usa una chiave pubblica inclusa nel repository).

## 9. Registro aggiornamenti

| Data | Versione | Modifica |
|---|---|---|
| 2026-10-15 | 0.1 | Prima stesura: aree, modello dati, regole, architettura proposta, roadmap |
| 2026-10-15 | 0.2 | Confermati: routine, persone, luoghi, scadenza rigida, Gemini come provider IA, 26 voci scadute in Revisione, collegamento Google Calendar predisposto. Aggiunta sezione 4.7 (progetti e voci con figli) |
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
| 2026-10-16 | 0.23.0 | Pila unica di navigazione con finestre nella cronologia; "+" sempre cattura con bozza in Inbox; checkbox Scadenza rigida sotto la data; Attività con tutte le voci; Archivio diventa Completato; tolta l'etichetta "oggi" in Oggi; checkbox con tinta della priorità; stima dei tempi con margine d'errore che si affina (sezione 2.4.2) |
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
