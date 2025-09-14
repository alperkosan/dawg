// src/lib/utils/patternUtils.js

/**
 * Aranjmandaki en son klibin bitiş zamanına göre ses motorunun döngü uzunluğunu hesaplar.
 * @param {Array} clips - Aranjmandaki klipleri içeren dizi.
 * @returns {number} - 16'nın katı olarak hesaplanmış döngü uzunluğu.
 */
export const calculateArrangementLoopLength = (clips) => {
  if (!Array.isArray(clips) || clips.length === 0) {
    return 16; // Hiç klip yoksa varsayılan olarak 1 bar (16 adım) döndür.
  }

  let lastStep = 0;
  clips.forEach(clip => {
    // Kliplerin başlangıç ve sürelerinin "ölçü" (bar) cinsinden olduğunu varsayıyoruz.
    // 1 ölçü = 16 adım (4/4'lük bir ritimde).
    const clipEndStep = (clip.startTime + clip.duration) * 16;
    if (clipEndStep > lastStep) {
      lastStep = clipEndStep;
    }
  });

  // Gerekli uzunluğu en yakın üst 16'lık adıma yuvarla.
  const requiredLength = Math.ceil(lastStep / 16) * 16;
  return Math.max(16, requiredLength); // Minimum 16 adım olmalı.
};

/**
 * Kanallardaki en son notanın pozisyonuna göre ses motorunun döngü uzunluğunu hesaplar.
 * ARTIK ARANJMAN MODUNU DA DESTEKLİYOR.
 * @param {Array} instruments - Enstrüman verilerini içeren dizi.
 * @param {Array} [clips] - (Opsiyonel) Aranjmandaki klipler.
 * @returns {number} - 16'nın katı olarak hesaplanmış döngü uzunluğu (minimum 16).
 */
export const calculateAudioLoopLength = (instruments, clips) => {
  // Eğer klipler varsa, aranjman uzunluğunu hesapla.
  if (Array.isArray(clips) && clips.length > 0) {
    return calculateArrangementLoopLength(clips);
  }
  
  // Klipler yoksa, eski pattern tabanlı yönteme geri dön.
  if (!Array.isArray(instruments)) {
    console.warn("calculateAudioLoopLength'e geçersiz enstrüman verisi gönderildi.");
    return 16;
  }

  let lastStep = 0;
  instruments.forEach(instrument => {
    if (Array.isArray(instrument.notes) && instrument.notes.length > 0) {
      const maxTime = Math.max(...instrument.notes.map(note => note.time));
      if (maxTime > lastStep) {
        lastStep = maxTime;
      }
    }
  });

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
  return audioLoopLength + 16;
};

/**
 * Tek bir pattern içindeki notalara göre döngü uzunluğunu hesaplar.
 * @param {object} pattern - { id, name, data: { instId: [notes] } } yapısındaki pattern objesi.
 * @returns {number} 16'nın katı olarak hesaplanmış döngü uzunluğu.
 */
export const calculatePatternLoopLength = (pattern) => {
  if (!pattern?.data) return 16;

  let lastStep = 0;
  Object.values(pattern.data).forEach(notes => {
    if (Array.isArray(notes) && notes.length > 0) {
      const maxTime = Math.max(...notes.map(note => note.time));
      if (maxTime > lastStep) {
        lastStep = maxTime;
      }
    }
  });

  const requiredLength = Math.floor(lastStep / 16) * 16 + 16;
  return Math.max(16, requiredLength);
};