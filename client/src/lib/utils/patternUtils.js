// src/utils/patternUtils.js
/**
 * Kanallardaki en son notanın pozisyonuna göre ses motorunun döngü uzunluğunu hesaplar.
 * @param {Array} channels - Kanal verilerini içeren dizi.
 * @returns {number} - 16'nın katı olarak hesaplanmış döngü uzunluğu (minimum 16).
 */
export const calculateAudioLoopLength = (channels) => {
  if (!Array.isArray(channels)) {
    console.warn("calculateAudioLoopLength'e geçersiz kanal verisi gönderildi.");
    return 16;
  }

  let lastStep = 0;
  channels.forEach(channel => {
    // YENİ: 'notes' dizisini kontrol et
    if (Array.isArray(channel.notes) && channel.notes.length > 0) {
      // Notalar arasındaki en yüksek 'time' değerini bul
      const maxTime = Math.max(...channel.notes.map(note => note.time));
      if (maxTime > lastStep) {
        lastStep = maxTime;
      }
    }
  });

  // Gerekli uzunluğu hesapla: son notanın bulunduğu 16'lık bloğu tamamla.
  // Örn: Son nota 15. adımdaysa (index 15), uzunluk 16 olur.
  // Örn: Son nota 16. adımdaysa, uzunluk 32 olur.
  const requiredLength = Math.floor(lastStep / 16) * 16 + 16;
  return Math.max(16, requiredLength);
};

/**
 * Channel Rack'te gösterilecek olan UI (kullanıcı arayüzü) uzunluğunu hesaplar.
 * Bu, gerçek ses döngüsünden her zaman bir bar (16 adım) daha uzundur.
 * @param {number} audioLoopLength - calculateAudioLoopLength'ten gelen değer.
 * @returns {number} - UI'da gösterilecek toplam adım sayısı.
 */
export const calculateUIRackLength = (audioLoopLength) => {
  // Kullanıcının yeni notalar ekleyebilmesi için her zaman fazladan bir boş bar göster.
  return audioLoopLength + 16;
};