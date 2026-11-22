# MyTask per Amazfit GTR 3 Pro (Zepp OS 1.0)

Mini-app dell'orologio con un anello da 22 px attorno al quadrante. Senza timer: anello spento e «nessuna nota / in corso». Con una nota avviata (dal telefono, dal sito o dal widget): l'anello bianco avanza in proporzione alla stima (tutto pieno se non c'è), titolo, tempo e due pulsanti tondi con icona (pausa o riprendi, fatto). Lo schermo resta acceso 30 minuti dall'avvio o dall'ultimo tocco (dopo basta toccarlo per ripartire); vibra forte ogni N minuti di tratto in corso come la notifica del timer (N nelle impostazioni, di base 5). Le impostazioni nell'app Zepp hanno un riquadro per dato e dicono cosa manca.

## Come parla con MyTask
orologio → app Zepp sul telefono (`app-side/index.js`) → server MyTask (`/api/orologio/stato` e `/api/orologio/comando`), con un **codice dedicato** (Altro › Account › Orologio › Crea codice; si può sostituire o revocare, e non apre la sincronizzazione). Lo stato si aggiorna ogni 5 secondi, quindi c'è un piccolo ritardo. I comandi dell'orologio arrivano al telefono alla prossima sincronizzazione (al massimo un minuto, subito se l'app è aperta).

## Cartella `shared/`
I file di comunicazione orologio-telefono (`message.js`, `device-polyfill.js` e i loro moduli) vengono dagli esempi ufficiali Zepp OS 1.0 (`zeppos-samples/application/1.0/fetch-api/shared`), licenza Apache-2.0 (`shared/LICENSE.txt`). Sono copiati senza modifiche.

## Provarla
1. `npm i -g @zeppos/zeus-cli`, poi `zeus login` (account Zepp, si apre il browser). `zeus build` costruisce il pacchetto in `dist/`.
2. Nella cartella `orologio`: `zeus dev` (simulatore) oppure `zeus preview` (codice QR da leggere con l'app Zepp, con l'orologio collegato in modalità sviluppatore).
3. Nell'app Zepp: impostazioni di MyTask → indirizzo del server, codice, ogni quanti minuti vibrare.

## Limiti
- Lo schermo resta acceso 30 minuti (`setBrightScreen`), ma con l'orologio **al polso** il sistema lo mette comunque in always on quando abbassi il braccio: per evitarlo bisogna spegnere il gesto del polso (alza/abbassa) nelle impostazioni dell'orologio. Sul tavolo resta acceso.
- Ogni QR di prova deve avere una versione nuova: usa `anteprima.ps1` (aumenta la versione, che compare in piccolo sull'orologio, e genera il QR).
- La mini-app deve essere **aperta** sull'orologio (da elenco app o scelta come tasto rapido): da sola non si apre quando parte un timer.
- Il telefono deve essere collegato all'orologio e l'app Zepp attiva in background.
- `appId` in `app.json` e `app.js` è provvisorio: va bene per la prova, ne serve uno vero solo per pubblicare.
