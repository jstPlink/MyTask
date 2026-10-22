# MyTask

App personale per idee, cose da fare e da scoprire: sito (installabile come PWA, anche offline), app Android e un server
leggero da far girare in Docker sul NAS. La documentazione completa è in [docs/DOCUMENTAZIONE.md](docs/DOCUMENTAZIONE.md).

## Cosa fa

- **Oggi:** la giornata a orari: l'app distribuisce da sola le attività nel tempo libero, in base a priorità calcolata, durata e scadenze; routine del giorno e frecce per cambiare giorno.
- **Attività:** attività, progetti (con passi ordinabili) ed esperienze, queste anche ordinate «per te» (interesse, data, distanza). **Intrattenimento:** film, serie, anime, giochi, libri e ricette, con «Cosa guardo stasera». **Curiosità** e **Routine** (abitudini con quota settimanale).
- **Cattura rapida:** una riga di testo (o la voce) diventa una nota non assegnata in Inbox, da smistare; mostra le note già esistenti con le stesse parole. Ricerca in tutte le voci.
- **Stati e tempo:** ogni nota è da fare, in corso, fatta o archiviata; il tempo impiegato si misura da «in corso» a «fatta» e affina le stime.
- **Notifiche e widget:** promemoria delle scadenze, insistenza e routine, anche ad app Android chiusa; widget «Oggi» (chiaro e scuro) con nota veloce.
- Sul computer: barra laterale, dettaglio in finestra e scorciatoie da tastiera (N nuova nota, / ricerca, Esc chiude).

## Provarla sul computer

Serve Node 24 o più recente.

```bash
npm install
npm run build
MYTASK_EMAIL=tu@example.com MYTASK_PASSWORD=una-password-lunga npm start
```

Poi apri http://localhost:8787. Per sviluppare con ricarica automatica: `npm run dev:server` e, in un altro terminale, `npm run dev:web` (porta 5173).

Altri comandi: `npm test` (test), `npm run typecheck`.

## Metterla sul NAS (Docker)

Non serve costruire nulla sul NAS: a ogni aggiornamento GitHub costruisce l'immagine Docker e la pubblica come
`ghcr.io/jstplink/mytask`. Sul NAS bastano due file nella stessa cartella: `docker-compose.yml` e `.env`.

1. Metti `docker-compose.yml` in una cartella del NAS (basta quel file, oppure clona il repository con
   `git clone https://github.com/jstPlink/MyTask.git`).
2. Nella stessa cartella crea `.env` partendo da `.env.example`: compila email e password (password lunga e unica). Se la porta 8787 è occupata, cambia `MYTASK_PORT`.
3. `docker compose pull && docker compose up -d`
4. Controlla che sia partita: `docker compose ps` deve mostrare il container come `healthy`, e `docker compose logs mytask` non deve avere errori.

L'immagine è pubblica: il NAS la scarica senza credenziali. Se lavori dalla cartella clonata puoi anche costruirla sul
posto con `docker compose up -d --build` (serve il file `Dockerfile` nella cartella).

Il database sta nel volume Docker `mytask-data`, quindi `docker compose down` non lo cancella (`docker compose down -v` sì: non usarlo).

### Accesso da fuori casa (Cloudflare Tunnel)

Nel tunnel Cloudflare (lo stesso che usi per gli altri servizi del NAS) aggiungi un nome di dominio pubblico, per esempio
`mytask.tuodominio.it`, che punta a `http://IP-DEL-NAS:8787` (o la porta che hai scelto in `MYTASK_PORT`). Dato che l'app contiene dati personali, conviene aggiungere anche una regola
**Cloudflare Access** davanti al dominio. Attenzione: con Access attivo, l'app Android dovrà passare le credenziali
di Cloudflare; ne parliamo quando si arriva all'APK.

Il login dell'app (email e password) resta comunque obbligatorio, con un limite ai tentativi sbagliati.

### Importare i dati da Notion (una volta sola)

Il file `..._all.csv` esportato da Notion non va su GitHub (contiene i tuoi dati). Lo smistamento dipende dai tuoi dati
(quali titoli sono serie o anime, quali voci sono progetti o routine, nomi di persone, luoghi), quindi le regole stanno in
due file: `server/scripts/regole.esempio.ts` (pubblico, generico) e `server/scripts/regole.locale.ts` (tuo, ignorato da git).
Per prepararle copia l'esempio in `regole.locale.ts` e adattalo.

1. **Sul tuo computer** (serve Node 24) prepara il file con le voci:

   ```bash
   node server/scripts/import-notion.ts NOME_DEL_FILE_all.csv --dry-run --json voci.json --report report.md
   ```

   Nel report trovi tutto ciò che è stato sistemato.
2. **Nell'app** (sito o telefono): *Altro > Account e sincronizzazione > Importa le voci da un file (JSON)* e scegli `voci.json`.
   Le voci vengono salvate sul dispositivo e inviate al server.

In alternativa, dentro il container: `docker cp voci.json mytask:/data/voci.json` e poi
`docker compose exec mytask node server/scripts/import-notion.ts --from-json /data/voci.json` (con il database vuoto, o con `--force`).

### Copie di sicurezza

Il database è un solo file nel volume Docker `mytask-data` (`/data/mytask.db`): per salvarlo basta copiare quel file, o il
volume, con lo strumento di backup che usi per il NAS. Come rete di sicurezza il server ne fa anche una copia al giorno in
`/data/backups` (le ultime 14), dentro lo stesso volume. Dall'app puoi inoltre scaricare tutti i dati in JSON da
*Altro > Account e sincronizzazione*.

### Aggiornare

```bash
docker compose pull && docker compose up -d
```

## App Android

A ogni aggiornamento GitHub costruisce anche l'APK e lo pubblica nelle *Releases*. Dal telefono:

1. Apri https://github.com/jstPlink/MyTask/releases/latest e scarica `mytask.apk`.
2. Aprilo. Se Android lo chiede, consenti l'installazione da questa fonte (una volta, per il browser o il gestore di file che usi).
3. Apri MyTask, scrivi l'indirizzo del server (quello del tunnel Cloudflare), email e password, e consenti le notifiche.

Per aggiornare scarichi il nuovo `mytask.apk` e lo apri: si installa sopra il precedente e i dati restano. Le notifiche
(scadenze, insistenza, routine) sono programmate nel telefono e arrivano anche ad app chiusa; dopo un riavvio del telefono
si riattivano da sole.

Firma: l'APK è firmato con una chiave pubblica inclusa nel repository (`web/android/app/public-signing.keystore`), che serve
solo a poter aggiornare l'app senza disinstallarla. Se vuoi una chiave tua, aggiungi nei segreti del repository
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`: il workflow la usa al posto di quella pubblica
(dovrai disinstallare e reinstallare l'app una volta, e i dati si risincronizzano dal server).

Sviluppo: `cd web && npm run build && npx cap sync android`, poi `web/android` si apre con Android Studio.

## App per computer (Windows)

Da *Altro > Account > Scarica MyTask per Windows* (o da https://github.com/jstPlink/MyTask/releases/latest, file `MyTask-Setup.exe`) si scarica l'installer: apri il file, al primo avvio scrivi l'indirizzo del server. È una finestra dedicata che mostra il sito del tuo server. L'installer non è firmato, quindi Windows può mostrare un avviso (Maggiori informazioni > Esegui comunque). Sviluppo: `cd desktop && npm ci && npm start`; installer: `npm run dist`.

## Come è fatta

- `shared/`: logica comune (priorità, piano della giornata, stime, ricorrenze, routine, liste), scritta in TypeScript e provata con i test.
- `server/`: Fastify + SQLite (`node:sqlite`, nessuna dipendenza nativa), login, sincronizzazione.
- `web/`: React + Vite, archivio locale in IndexedDB, service worker per l'uso offline; layout a colonna singola (telefono) e con barra laterale (schermi larghi). `web/android` è l'app Android (Capacitor).
- `.github/workflows/`: controllo dei tipi e test a ogni push, immagine Docker e APK.
- `docs/`: documentazione, decisioni di setup, mockup e report dell'importazione.
