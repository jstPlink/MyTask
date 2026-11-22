// Impostazioni nell'app Zepp (telefono): indirizzo del server, codice dell'orologio (si crea in MyTask, Altro › Account › Orologio)
// e ogni quanti minuti vibrare mentre il timer corre.
AppSettingsPage({
  build() {
    return View({ style: { padding: '12px 20px' } }, [
      Text({ paragraph: true, bold: true }, 'MyTask'),
      TextInput({ label: 'Indirizzo del server', placeholder: 'mytask.tuodominio.it', settingsKey: 'server' }),
      TextInput({ label: 'Codice dell\'orologio', placeholder: 'incollalo da MyTask', settingsKey: 'codice' }),
      TextInput({ label: 'Vibra ogni (minuti)', placeholder: '5', settingsKey: 'intervallo' }),
    ])
  },
})
