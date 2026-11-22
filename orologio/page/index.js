// Pagina unica con un anello attorno al quadrante (22 px). Senza timer: anello spento e «nessuna nota / in corso».
// Con una nota avviata: l'anello bianco avanza in proporzione alla stima (tutto pieno se non c'è), titolo, tempo e due pulsanti tondi
// (pausa o riprendi, fatto). Misure della variante 1 del mockup 5 (spazi larghi).
// Ogni 5 secondi chiede lo stato (al telefono, che lo chiede al server); il tempo scorre da solo ogni secondo.
// Lo schermo resta acceso per 30 minuti dall'ultimo tocco o dall'avvio del timer; dopo basta toccarlo per ripartire.
// Vibra ogni N minuti di tratto in corso (come la notifica del timer del telefono; N si sceglie nelle impostazioni, di base 5).

const { messageBuilder } = getApp()._options.globalData

const L = 480 // larghezza dello schermo (designWidth)
const INTERVALLO_STATO_MS = 5000
const SCHERMO_ACCESO_S = 30 * 60
const ANELLO = 22 // spessore dell'anello in px
const GRIGIO_ANELLO = 0x424242 // anello spento (26% di bianco su nero)
const BIANCO = 0xffffff
const AGGIORNA_ANELLO_S = 10 // ogni quanti secondi si ridisegna l'arco
// vibrazione del ping periodico: scena 28 = forte, 600 ms (prima la 0: due impulsi brevi, più debole). Altre: 25 forte e breve, 27 forte 1 s, 9 quattro impulsi
const VIBRAZIONE_SCENA = 28
const VIBRAZIONE_MS = 600

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
    chiaveAnello: '', // ultimo disegno dell'arco (stato e gradi), per non ridisegnarlo senza motivo
    accesoFinoA: 0, // fino a quando (ora locale) lo schermo va tenuto acceso
    timerStato: null,
    timerSecondi: null,
  },

  build() {
    const s = this
    this.vibrazione = hmSensor.createSensor(hmSensor.id.VIBRATE) // una sola istanza per pagina
    // sfondo a tutto schermo: un tocco ovunque rinnova i 30 minuti di schermo acceso
    this.sfondo = hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: L, h: L, color: 0x000000 })
    this.sfondo.addEventListener(hmUI.event.CLICK_UP, () => s.tieniAcceso(true))

    // anello spento: lo stesso in tutti gli stati; l'arco bianco dell'avanzamento si crea sopra (vedi aggiornaAnello)
    hmUI.createWidget(hmUI.widget.ARC, { x: 0, y: 0, w: L, h: L, radius: L / 2 - ANELLO / 2, start_angle: 0, end_angle: 360, line_width: ANELLO, color: GRIGIO_ANELLO })

    // senza timer: «nessuna nota» sopra e «in corso» sotto
    this.vuoto1 = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 80, y: 168, w: L - 160, h: 54, color: 0xa6a6ab, text_size: 40,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text_style: hmUI.text_style.NONE, text: 'nessuna nota',
    })
    this.vuoto2 = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 80, y: 226, w: L - 160, h: 54, color: 0xa6a6ab, text_size: 40,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text_style: hmUI.text_style.NONE, text: 'in corso',
    })

    this.titolo = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 96, y: 84, w: L - 192, h: 64, color: BIANCO, text_size: 26,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text_style: hmUI.text_style.ELLIPSIS, text: '',
    })
    this.tempo = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 40, y: 184, w: L - 80, h: 80, color: BIANCO, text_size: 72,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text_style: hmUI.text_style.NONE, text: '',
    })
    this.pausa = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 110, y: 316, w: 70, h: 70, text: '', normal_src: 'pausa.png', press_src: 'pausa_p.png',
      click_func: () => s.comando(s.state.nota && s.state.nota.stato === 'pausa' ? 'riprendi' : 'pausa'),
    })
    this.completa = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 300, y: 316, w: 70, h: 70, text: '', normal_src: 'fatto.png', press_src: 'fatto_p.png',
      click_func: () => s.comando('completa'),
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

  /**
   * Lo schermo resta acceso 30 minuti da adesso (ogni tocco li rinnova). Il sistema chiude la mini-app 10 secondi dopo ogni spegnimento
   * e, di base, al risveglio mostra il quadrante: `setScreenKeep(true)` la riapre sulla stessa pagina. Il tempo acceso si ribadisce
   * ogni minuto con i secondi che restano, così un valore ignorato o cancellato dal sistema non fa spegnere lo schermo prima.
   */
  tieniAcceso(nuovoTocco) {
    if (!this.attivo()) return
    if (nuovoTocco !== false || !this.state.accesoFinoA) this.state.accesoFinoA = Date.now() + SCHERMO_ACCESO_S * 1000
    const resta = Math.max(1, Math.round((this.state.accesoFinoA - Date.now()) / 1000))
    if (Date.now() > this.state.accesoFinoA) return
    try { hmApp.setScreenKeep(true) } catch (e) { /* niente */ }
    try { hmSetting.setBrightScreen(resta); this.state.schermoAcceso = true } catch (e) { /* niente */ }
  },

  lasciaSpegnere() {
    this.state.accesoFinoA = 0
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
    this.tieniAcceso(true)
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
    if (this.attivo() && !prima) this.tieniAcceso(true)
    if (!this.attivo()) this.lasciaSpegnere()
    this.disegna()
  },

  mostraErrore(testo) {
    if (this.attivo()) return // si continua a mostrare l'ultimo stato noto
    this.state.nota = null
    this.disegna()
    this.vuoto1.setProperty(hmUI.prop.MORE, { text: testo, text_size: 28, y: 190, h: 100, w: L - 160, x: 80 })
    this.vuoto2.setProperty(hmUI.prop.VISIBLE, false)
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
    this.vuoto1.setProperty(hmUI.prop.VISIBLE, !on)
    this.vuoto2.setProperty(hmUI.prop.VISIBLE, !on)
    if (!on) {
      this.vuoto1.setProperty(hmUI.prop.MORE, { text: 'nessuna nota', text_size: 40, x: 80, y: 168, w: L - 160, h: 54 })
      this.vuoto2.setProperty(hmUI.prop.MORE, { text: 'in corso', text_size: 40, x: 80, y: 226, w: L - 160, h: 54 })
      this.aggiornaAnello()
      return
    }
    this.titolo.setProperty(hmUI.prop.MORE, { text: n.titolo, text_size: 26, color: BIANCO })
    const inPausa = n.stato === 'pausa'
    this.pausa.setProperty(hmUI.prop.MORE, { x: 110, y: 316, w: 70, h: 70, normal_src: inPausa ? 'play.png' : 'pausa.png', press_src: inPausa ? 'play_p.png' : 'pausa_p.png' })
    this.tempo.setProperty(hmUI.prop.MORE, { text: cronometro(this.tempoOra()), color: inPausa ? 0xb3a999 : BIANCO })
    this.aggiornaAnello()
  },

  /** L'arco bianco sopra l'anello spento: da ore 12, in senso orario, in proporzione alla stima; tutto pieno senza stima; più spento in pausa. */
  aggiornaAnello() {
    const n = this.state.nota
    let chiave = 'nessuno'
    if (this.attivo()) {
      const q = n.stimaMin > 0 ? Math.min(1, this.tempoOra() / (n.stimaMin * 60000)) : 1
      chiave = n.stato + ':' + Math.round(q * 360)
    }
    if (chiave === this.state.chiaveAnello) return
    this.state.chiaveAnello = chiave
    if (this.arco) { hmUI.deleteWidget(this.arco); this.arco = null }
    if (!this.attivo()) return
    const gradi = Math.max(3, Math.min(359.5, Number(chiave.split(':')[1])))
    this.arco = hmUI.createWidget(hmUI.widget.ARC, {
      x: 0, y: 0, w: L, h: L, radius: L / 2 - ANELLO / 2, start_angle: -90, end_angle: -90 + gradi, line_width: ANELLO,
      color: n.stato === 'pausa' ? 0x7a7a7a : BIANCO,
    })
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
    this.contaSecondi = (this.contaSecondi || 0) + 1
    if (this.contaSecondi % 60 === 0) this.tieniAcceso(false)
    if (this.contaSecondi % AGGIORNA_ANELLO_S === 0) this.aggiornaAnello()
    this.tempo.setProperty(hmUI.prop.MORE, { text: cronometro(this.tempoOra()) })
    if (n.stato !== 'lavoro') return
    const passi = Math.floor(((n.trattoMs || 0) + (Date.now() - this.state.ricevutoIl)) / this.intervalloMs())
    if (passi > this.state.ultimaVibrazione) {
      this.state.ultimaVibrazione = passi
      this.vibrazione.stop()
      this.vibrazione.scene = VIBRAZIONE_SCENA
      this.vibrazione.start()
      // dopo la vibrazione va chiamato stop(), altrimenti la successiva non parte
      setTimeout(() => { this.vibrazione && this.vibrazione.stop() }, VIBRAZIONE_MS + 150)
    }
  },
})
