// Pagina unica: vuota (nera) finché non c'è un timer; con una nota avviata mostra titolo, tempo e i pulsanti Pausa/Riprendi e Completa.
// Ogni 5 secondi chiede lo stato (al telefono, che lo chiede al server); il tempo scorre da solo ogni secondo.
// Lo schermo resta acceso per 30 minuti dall'ultimo tocco o dall'avvio del timer; dopo basta toccarlo per ripartire.
// Vibra ogni N minuti di tratto in corso (come la notifica del timer del telefono; N si sceglie nelle impostazioni, di base 5).

const { messageBuilder } = getApp()._options.globalData

const L = 480 // larghezza dello schermo (designWidth)
const INTERVALLO_STATO_MS = 5000
const SCHERMO_ACCESO_S = 30 * 60

/** «M:SS» o «H:MM:SS». */
function cronometro(ms) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const due = (n) => (n < 10 ? '0' + n : '' + n)
  return h > 0 ? h + ':' + due(m) + ':' + due(s) : m + ':' + due(s)
}

Page({
  state: {
    nota: null, // ultimo stato ricevuto: { stato, id, titolo, tempoMs, trattoMs, stimaMin, intervalloMin }
    ricevutoIl: 0, // quando (ora locale dell'orologio) è arrivato
    ultimaVibrazione: -1, // numero dell'ultimo multiplo di N minuti già segnalato
    inviando: false,
    schermoAcceso: false,
    timerStato: null,
    timerSecondi: null,
  },

  build() {
    const s = this
    this.vibrazione = hmSensor.createSensor(hmSensor.id.VIBRATE) // una sola istanza per pagina
    // sfondo a tutto schermo: un tocco ovunque rinnova i 30 minuti di schermo acceso
    this.sfondo = hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: L, h: L, color: 0x000000 })
    this.sfondo.addEventListener(hmUI.event.CLICK_UP, () => s.tieniAcceso())

    this.titolo = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 40, y: 50, w: L - 80, h: 110, color: 0xffffff, text_size: 34,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text_style: hmUI.text_style.ELLIPSIS, text: '',
    })
    this.tempo = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 40, y: 170, w: L - 80, h: 110, color: 0xffffff, text_size: 84,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text_style: hmUI.text_style.NONE, text: '',
    })
    this.pausa = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 50, y: 310, w: 175, h: 90, text: 'Pausa', text_size: 32, radius: 24,
      normal_color: 0x3c3c3f, press_color: 0x5b5b60, click_func: () => s.comando(s.state.nota && s.state.nota.stato === 'pausa' ? 'riprendi' : 'pausa'),
    })
    this.completa = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 255, y: 310, w: 175, h: 90, text: 'Fatto', text_size: 32, radius: 24,
      normal_color: 0x2f7d5b, press_color: 0x4aa37c, click_func: () => s.comando('completa'),
    })
    this.disegna()

    this.chiediStato()
    this.state.timerStato = timer.createTimer(INTERVALLO_STATO_MS, INTERVALLO_STATO_MS, () => s.chiediStato(), {})
    this.state.timerSecondi = timer.createTimer(1000, 1000, () => s.secondo(), {})
  },

  onDestroy() {
    if (this.state.timerStato) timer.stopTimer(this.state.timerStato)
    if (this.state.timerSecondi) timer.stopTimer(this.state.timerSecondi)
    this.vibrazione && this.vibrazione.stop()
    try { hmSetting.setBrightScreenCancel() } catch (e) { /* niente */ }
  },

  /** Lo schermo resta acceso 30 minuti da adesso (ogni tocco li rinnova). */
  tieniAcceso() {
    if (!this.attivo()) return
    try { hmSetting.setBrightScreen(SCHERMO_ACCESO_S); this.state.schermoAcceso = true } catch (e) { /* niente */ }
  },

  lasciaSpegnere() {
    if (!this.state.schermoAcceso) return
    this.state.schermoAcceso = false
    try { hmSetting.setBrightScreenCancel() } catch (e) { /* niente */ }
  },

  attivo() {
    const n = this.state.nota
    return !!n && (n.stato === 'lavoro' || n.stato === 'pausa')
  },

  /** Chiede al telefono lo stato del timer e lo applica. */
  chiediStato() {
    this.chiedi({ method: 'STATO' })
  },

  /** Comanda il timer (pausa, riprendi, completa): la risposta è il nuovo stato. */
  comando(nome) {
    const n = this.state.nota
    this.tieniAcceso()
    this.chiedi({ method: 'COMANDO', comando: nome, id: n ? n.id : undefined })
  },

  chiedi(richiesta) {
    if (this.state.inviando) return
    this.state.inviando = true
    messageBuilder
      .request(richiesta)
      .then((data) => {
        this.state.inviando = false
        const r = data && data.result
        if (r && r.errore) return this.mostraErrore(r.errore)
        this.applica(r)
      })
      .catch(() => {
        this.state.inviando = false
        this.mostraErrore('Telefono non raggiungibile')
      })
  },

  applica(r) {
    const prima = this.attivo()
    if (!r || (r.stato !== 'lavoro' && r.stato !== 'pausa')) {
      this.state.nota = null
    } else {
      const nuovaNota = !this.state.nota || this.state.nota.id !== r.id
      this.state.nota = r
      this.state.ricevutoIl = Date.now()
      // il contatore delle vibrazioni riparte a ogni nota e a ogni nuovo tratto (pausa/ripresa)
      const n = this.intervalloMs()
      this.state.ultimaVibrazione = nuovaNota || !prima || r.stato === 'pausa' ? Math.floor((r.trattoMs || 0) / n) : Math.min(this.state.ultimaVibrazione, Math.floor((r.trattoMs || 0) / n))
    }
    if (this.attivo() && !prima) this.tieniAcceso()
    if (!this.attivo()) this.lasciaSpegnere()
    this.disegna()
  },

  mostraErrore(testo) {
    if (this.attivo()) return // si continua a mostrare l'ultimo stato noto
    this.state.nota = null
    this.disegna()
    this.titolo.setProperty(hmUI.prop.MORE, { text: testo, text_size: 26, color: 0x9f9fa4 })
    this.titolo.setProperty(hmUI.prop.VISIBLE, true)
  },

  intervalloMs() {
    const n = this.state.nota
    const min = n && n.intervalloMin > 0 ? n.intervalloMin : 5
    return min * 60000
  },

  /** Mostra o nasconde i pezzi della pagina secondo lo stato. */
  disegna() {
    const n = this.state.nota
    const on = this.attivo()
    this.titolo.setProperty(hmUI.prop.VISIBLE, on)
    this.tempo.setProperty(hmUI.prop.VISIBLE, on)
    this.pausa.setProperty(hmUI.prop.VISIBLE, on)
    this.completa.setProperty(hmUI.prop.VISIBLE, on)
    if (!on) return
    this.titolo.setProperty(hmUI.prop.MORE, { text: n.titolo, text_size: 34, color: 0xffffff })
    this.pausa.setProperty(hmUI.prop.MORE, { x: 50, y: 310, w: 175, h: 90, text: n.stato === 'pausa' ? 'Riprendi' : 'Pausa', text_size: 32, radius: 24, normal_color: 0x3c3c3f, press_color: 0x5b5b60 })
    this.tempo.setProperty(hmUI.prop.MORE, { text: cronometro(this.tempoOra()), color: n.stato === 'pausa' ? 0xb3a999 : 0xffffff })
  },

  /** Il tempo di adesso: quello ricevuto più i secondi passati da allora (solo se il timer corre). */
  tempoOra() {
    const n = this.state.nota
    return n.tempoMs + (n.stato === 'lavoro' ? Date.now() - this.state.ricevutoIl : 0)
  },

  /** Ogni secondo: aggiorna il tempo e vibra al passare di ogni intervallo. */
  secondo() {
    const n = this.state.nota
    if (!this.attivo()) return
    this.tempo.setProperty(hmUI.prop.MORE, { text: cronometro(this.tempoOra()) })
    if (n.stato !== 'lavoro') return
    const passi = Math.floor(((n.trattoMs || 0) + (Date.now() - this.state.ricevutoIl)) / this.intervalloMs())
    if (passi > this.state.ultimaVibrazione) {
      this.state.ultimaVibrazione = passi
      this.vibrazione.stop()
      this.vibrazione.scene = 0 // due impulsi brevi, come una notifica
      this.vibrazione.start()
    }
  },
})
