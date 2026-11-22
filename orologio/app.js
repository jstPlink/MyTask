// MyTask per Amazfit GTR 3 Pro (Zepp OS 1.0): lo stato del timer arriva dal server passando dal telefono (app-side), vedi README.md.
import './shared/device-polyfill'
import { MessageBuilder } from './shared/message'

const appId = 1070421 // lo stesso di app.json

App({
  globalData: {},
  onCreate() {
    const messageBuilder = new MessageBuilder({ appId })
    this.globalData.messageBuilder = messageBuilder
    messageBuilder.connect()
  },
  onDestroy() {
    try { hmSetting.setBrightScreenCancel() } catch (e) { /* lo schermo torna normale */ }
    this.globalData.messageBuilder && this.globalData.messageBuilder.disConnect()
  },
})
