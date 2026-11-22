// Parte che gira nell'app Zepp sul telefono: riceve le richieste dell'orologio e le gira al server di MyTask
// con il codice dedicato (Altro › Account › Orologio), scritto nelle impostazioni dell'app.
import { MessageBuilder } from '../shared/message'

const messageBuilder = new MessageBuilder()

function leggi(chiave) {
  return (settings.settingsStorage.getItem(chiave) || '').trim()
}

/** Indirizzo del server senza barre finali, con https:// se manca. */
function server() {
  let u = leggi('server').replace(/\/+$/, '')
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u
  return u
}

/** Chiama una rotta /api/orologio/* e restituisce lo stato, con l'intervallo delle vibrazioni scelto nelle impostazioni. */
async function chiama(percorso, metodo, corpo) {
  const base = server()
  const codice = leggi('codice')
  if (!base || !codice) return { errore: 'Imposta server e codice nell\'app Zepp' }
  try {
    const res = await fetch({
      url: base + '/api/orologio/' + percorso,
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + codice },
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
    const dati = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    if (dati && dati.error === 'non_autenticato') return { errore: 'Codice non valido' }
    const min = parseInt(leggi('intervallo'), 10)
    return Object.assign({}, dati, { intervalloMin: min > 0 ? min : 5 })
  } catch (e) {
    return { errore: 'Server non raggiungibile' }
  }
}

AppSideService({
  onInit() {
    messageBuilder.listen(() => {})
    messageBuilder.on('request', (ctx) => {
      const r = messageBuilder.buf2Json(ctx.request.payload)
      if (r.method === 'STATO') {
        return chiama('stato', 'GET').then((result) => ctx.response({ data: { result } }))
      }
      if (r.method === 'COMANDO') {
        return chiama('comando', 'POST', { comando: r.comando, id: r.id }).then((result) => ctx.response({ data: { result } }))
      }
    })
  },
  onRun() {},
  onDestroy() {},
})
