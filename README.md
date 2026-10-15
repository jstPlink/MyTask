# MyTask

App personale per idee, cose da fare e da scoprire. Web app installabile (PWA) che funziona anche offline,
con un server leggero da far girare in Docker sul NAS. La documentazione completa è in [docs/DOCUMENTAZIONE.md](docs/DOCUMENTAZIONE.md).

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

Se il comando scarica l'immagine con errore `denied`, il pacchetto su GitHub è ancora privato: vedi sotto. Se invece
lavori dalla cartella clonata puoi anche costruirla sul posto con `docker compose up -d --build` (serve il file `Dockerfile` nella cartella).

**Una tantum, su GitHub:** dopo la prima esecuzione del workflow vai su *Profilo > Packages > mytask > Package settings*
e imposta la visibilità su **Public**, così il NAS la scarica senza credenziali.

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

Il modo più comodo è preparare l'importazione **sul tuo computer**, dove ci sono le regole personali, e caricare solo il risultato:

```bash
# sul computer (serve Node 24)
node server/scripts/import-notion.ts NOME_DEL_FILE_all.csv --dry-run --json items.json --report report-importazione.md

# poi, sul NAS
docker cp items.json mytask:/data/items.json
docker compose exec mytask node server/scripts/import-notion.ts --from-json /data/items.json
```

Nel report trovi tutto ciò che è stato sistemato. Se il database ha già dei dati, il comando si rifiuta di proseguire
senza `--force`. In alternativa puoi importare direttamente nel container con il file CSV, ma userà le regole di esempio.

### Copie di sicurezza

Il database è un solo file nel volume Docker `mytask-data` (`/data/mytask.db`): per salvarlo basta copiare quel file, o il
volume, con lo strumento di backup che usi per il NAS. Come rete di sicurezza il server ne fa anche una copia al giorno in
`/data/backups` (le ultime 14), dentro lo stesso volume. Dall'app puoi inoltre scaricare tutti i dati in JSON da
*Altro > Account e sincronizzazione*.

### Aggiornare

```bash
docker compose pull && docker compose up -d
```

## Come è fatta

- `shared/`: logica comune (priorità, ricorrenze, routine, cattura rapida), scritta in TypeScript e provata con i test.
- `server/`: Fastify + SQLite (`node:sqlite`, nessuna dipendenza nativa), login, sincronizzazione, IA (Gemini).
- `web/`: React + Vite, archivio locale in IndexedDB, service worker per l'uso offline.
- `docs/`: documentazione, decisioni di setup, mockup e report dell'importazione.
