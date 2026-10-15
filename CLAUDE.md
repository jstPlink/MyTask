# MyTask: regole di lavoro

Leggi `docs/DOCUMENTAZIONE.md` (sezione "Come si lavora sul progetto") prima di iniziare. In breve:

- Anteprima in localhost col sito collegato al server vero (`MYTASK_SERVER`), prima di pubblicare.
- Dopo ogni modifica aggiorna sempre l'app sul telefono (debug wireless, `adb install -r`, senza disinstallare). L'APK arriva da GitHub Actions: serve commit e push, poi attendi la build e scarica `mytask.apk` dalla release.
- Chiedi il commit solo se è necessario per vedere le modifiche; altrimenti non committare né fare push senza richiesta.
- Aumenta la versione a ogni commit (`package.json`) e annota il registro in `docs/DOCUMENTAZIONE.md`.
- Non fare screenshot del telefono (notifiche private).
- Test: `npm run typecheck` e `npm test`.
