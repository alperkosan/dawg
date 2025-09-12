/**
 * @file keymapConfig.js
 * @description Uygulamadaki tüm klavye kısayollarının merkezi tanım dosyası.
 * Bu yapı, hem KeybindingsPanel'in dinamik olarak oluşturulmasını hem de
 * KeybindingService'in hangi tuşun hangi eylemi tetikleyeceğini bilmesini sağlar.
 */
export const keymap = {
  transport: {
    name: 'Transport Kontrolleri',
    bindings: {
      TOGGLE_PLAY_PAUSE: {
        name: 'Oynat / Duraklat',
        default: 'Space',
      },
      STOP: {
        name: 'Durdur ve Başa Sar',
        default: 'Numpad0',
      },
    },
  },
  windows: {
    name: 'Pencere Yönetimi',
    bindings: {
      OPEN_CHANNEL_RACK: {
        name: 'Channel Rack Aç/Kapat',
        default: 'F6',
      },
      OPEN_MIXER: {
        name: 'Mixer Aç/Kapat',
        default: 'F9',
      },
      OPEN_PIANO_ROLL: {
        name: 'Piano Roll Aç/Kapat',
        default: 'F7',
      },
    },
  },
  // Gelecekte eklenecek diğer kategoriler (örn: 'edit', 'file') buraya gelecek.
};
