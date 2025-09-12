// src/core/Keybindings.js

// İleride bu haritayı kullanıcı arayüzünden değiştirilebilir hale getirebiliriz.
const keymap = {
  TOGGLE_PLAY_PAUSE: 'Space', // Boşluk tuşu
  // Örnek: STOP: 'Escape'
};

/**
 * Basılan tuşu tanımlanmış aksiyonlarla eşleştirir ve ilgili fonksiyonu çalıştırır.
 * @param {KeyboardEvent} event - Tarayıcıdan gelen klavye olayı.
 * @param {Object} actions - 'TOGGLE_PLAY_PAUSE' gibi aksiyon isimlerini fonksiyonlarla eşleştiren obje.
 */
export const handleKeyDown = (event, actions) => {
  // Kullanıcı bir input alanına yazıyorsa kısa yolları devre dışı bırak.
  if (event.target.tagName.toLowerCase() === 'input') {
    return;
  }

  // Basılan tuşun kodunu (örn: "Space", "KeyA") keymap'te ara.
  const actionName = Object.keys(keymap).find(key => keymap[key] === event.code);

  // Eğer bir aksiyon bulunduysa ve bu aksiyon için bir fonksiyon tanımlanmışsa...
  if (actionName && actions[actionName]) {
    event.preventDefault(); // Tarayıcının varsayılan eylemini engelle (örn: space ile sayfa kaydırma).
    actions[actionName]();   // Tanımlı fonksiyonu çalıştır.
  }
};