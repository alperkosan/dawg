/**
 * @file keymapConfig.js
 * @description Uygulamadaki tüm klavye kısayollarının merkezi tanım dosyası.
 */
export const keymap = {
  transport: {
    name: 'Transport Kontrolleri',
    bindings: {
      TOGGLE_PLAY_PAUSE: { name: 'Oynat / Duraklat', default: 'Space' },
      STOP: { name: 'Durdur ve Başa Sar', default: 'Numpad0' },
    },
  },
  windows: {
    name: 'Pencere Yönetimi',
    bindings: {
      OPEN_CHANNEL_RACK: { name: 'Channel Rack Aç/Kapat', default: 'F6' },
      OPEN_MIXER: { name: 'Mixer Aç/Kapat', default: 'F9' },
      OPEN_PIANO_ROLL: { name: 'Piano Roll Aç/Kapat', default: 'F7' },
    },
  },
  // YENİ: Düzenleme kısayolları eklendi
  editing: {
    name: 'Düzenleme',
    bindings: {
      UNDO: { name: 'Geri Al', default: 'Control+Z' },
      REDO: { name: 'Yinele', default: 'Control+Y' },
    }
  },
};
