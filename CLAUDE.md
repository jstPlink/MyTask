# MyTask: regole di lavoro

Leggi `docs/DOCUMENTAZIONE.md` (sezione "Come si lavora sul progetto") prima di iniziare. In breve:

- Anteprima in localhost col sito collegato al server vero (`MYTASK_SERVER`), prima di pubblicare.
- **COMMIT E PUSH SOLO QUANDO LO CHIEDE L'UTENTE, MAI DA SOLO** (nemmeno per aggiornare il telefono). A fine modifiche dì che l'app sul telefono resta com'è finché non li chiede.
- Quando l'utente chiede commit e push: commit e push, poi fermati. **Non attendere né controllare la build su GitHub: la verifica l'utente.** Quando l'utente dice che l'app è pronta (o chiede di aggiornare il telefono), scarica `mytask.apk` dalla release e aggiorna il telefono (debug wireless, `adb install -r`, senza disinstallare).
- Se l'utente chiede di aggiornare solo il telefono (senza commit): costruisci l'APK in locale (vedi "Costruzione" in `docs/DOCUMENTAZIONE.md`) e installalo con `adb install -r`.
- Aumenta la versione a ogni commit (`package.json`) e annota il registro in `docs/DOCUMENTAZIONE.md`.
- Non fare screenshot del telefono (notifiche private).
- Test: `npm run typecheck` e `npm test`.
