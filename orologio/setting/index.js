// Impostazioni nell'app Zepp (telefono): tre riquadri con titolo e spiegazione, uno per ogni dato.
// Il codice dell'orologio si crea in MyTask, Altro › Account › Orologio. I valori si salvano da soli mentre si scrive.

const COLORE = '#2F7D5B'

const riquadro = {
  background: '#FFFFFF',
  borderRadius: '14px',
  padding: '14px 16px',
  marginBottom: '14px',
  border: '1px solid #E4E4E7',
}

/** Un riquadro: titolo, spiegazione, campo. */
function campo(titolo, spiegazione, input) {
  return View({ style: riquadro }, [
    Text({ bold: true, paragraph: true, style: { fontSize: '15px', color: '#18181B', marginBottom: '2px' } }, titolo),
    Text({ paragraph: true, style: { fontSize: '12px', lineHeight: '17px', color: '#71717A', marginBottom: '8px' } }, spiegazione),
    input,
  ])
}

/** Stato in alto: dice cosa manca, oppure che è tutto pronto. */
function riepilogo(store) {
  const get = (k) => ((store && store.getItem(k)) || '').trim()
  const manca = []
  if (!get('server')) manca.push('indirizzo del server')
  if (!get('codice')) manca.push('codice dell\'orologio')
  const pronto = manca.length === 0
  return View({
    style: {
      background: pronto ? '#E8F3EE' : '#FFF4E5',
      color: pronto ? COLORE : '#B45309',
      borderRadius: '12px',
      padding: '10px 14px',
      marginBottom: '16px',
      fontSize: '13px',
      lineHeight: '18px',
    },
  }, [Text({ bold: true }, pronto ? 'Tutto pronto: apri MyTask sull\'orologio.' : 'Manca: ' + manca.join(' e '))])
}

AppSettingsPage({
  build(props) {
    return View({ style: { padding: '16px', background: '#F4F4F5' } }, [
      Text({ bold: true, paragraph: true, style: { fontSize: '22px', color: '#18181B', marginBottom: '4px' } }, 'MyTask'),
      Text({ paragraph: true, style: { fontSize: '13px', lineHeight: '18px', color: '#71717A', marginBottom: '14px' } }, 'Collega l\'orologio al tuo server. Il codice si crea in MyTask: Altro › Account › Orologio › Crea codice.'),
      riepilogo(props.settingsStorage),
      campo(
        'Indirizzo del server',
        'Quello che usi nel browser, senza https://.',
        TextInput({ placeholder: 'mytask.tuodominio.it', settingsKey: 'server', subStyle: { fontSize: '15px' } }),
      ),
      campo(
        'Codice dell\'orologio',
        'Si vede una sola volta alla creazione: incollalo qui. Se lo perdi, creane uno nuovo.',
        TextInput({ placeholder: 'incolla il codice', settingsKey: 'codice', subStyle: { fontSize: '15px' } }),
      ),
      campo(
        'Vibra ogni (minuti)',
        'Mentre il timer corre l\'orologio vibra a questo intervallo, come la notifica del telefono. Vuoto = 5.',
        TextInput({ placeholder: '5', settingsKey: 'intervallo', subStyle: { fontSize: '15px' } }),
      ),
    ])
  },
})
