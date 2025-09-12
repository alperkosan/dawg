/**
 * @file KeybindingService.js
 * @description Global klavye olaylarını dinleyen ve bunları merkezi
 * keymap'teki eylemlerle eşleştiren servis.
 */

// Aktif olan olay dinleyicisini tutar, böylece kaldırabiliriz.
let keydownListener = null;

/**
 * Gelen keymap ve eylemlerle klavye dinleyicisini başlatır.
 * @param {object} keymap - `keymapConfig.js`'ten gelen yapılandırma.
 * @param {object} actions - Eylem ID'lerini gerçek fonksiyonlarla eşleştiren harita.
 */
export const initKeybindings = (keymap, actions) => {
  // Mevcut bir dinleyici varsa, önce onu kaldır.
  if (keydownListener) {
    destroyKeybindings();
  }

  // Hızlı arama için tuşları eylem ID'leriyle eşleştiren bir ters harita oluştur.
  // Örn: { "Space": "TOGGLE_PLAY_PAUSE", "F9": "OPEN_MIXER" }
  const reverseKeymap = {};
  for (const category of Object.values(keymap)) {
    for (const [actionId, binding] of Object.entries(category.bindings)) {
      reverseKeymap[binding.default] = actionId;
    }
  }

  keydownListener = (event) => {
    // Kullanıcı bir input alanına yazıyorsa kısa yolları devre dışı bırak.
    if (['input', 'textarea'].includes(event.target.tagName.toLowerCase())) {
      return;
    }

    const actionId = reverseKeymap[event.code];
    if (actionId && actions[actionId]) {
      event.preventDefault();
      actions[actionId]();
    }
  };

  window.addEventListener('keydown', keydownListener);
  console.log('[KeybindingService] Kısayollar başlatıldı.');
};

/**
 * Global klavye dinleyicisini kaldırır.
 */
export const destroyKeybindings = () => {
  if (keydownListener) {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
    console.log('[KeybindingService] Kısayollar devre dışı bırakıldı.');
  }
};
