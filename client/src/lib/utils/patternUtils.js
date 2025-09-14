/**
 * @file patternUtils.js
 * @description Döngü uzunluklarını hesaplamak için merkezi ve standart yardımcı fonksiyonlar.
 */

/**
 * Tek bir pattern içindeki notalara göre döngü uzunluğunu ADIM cinsinden hesaplar.
 * @param {object} pattern - { id, name, data: { instId: [notes] } } yapısındaki pattern objesi.
 * @returns {number} 16'nın katı olarak hesaplanmış döngü uzunluğu (adım sayısı).
 */
export const calculatePatternLoopLength = (pattern) => {
  if (!pattern?.data) return 16; // Varsayılan 1 bar (16 adım)

  let lastStep = 0;
  Object.values(pattern.data).forEach(notes => {
    if (Array.isArray(notes) && notes.length > 0) {
      const maxTime = Math.max(...notes.map(note => note.time));
      if (maxTime > lastStep) {
        lastStep = maxTime;
      }
    }
  });

  const requiredBars = Math.floor(lastStep / 16) + 1;
  return Math.max(4, requiredBars) * 16; // Minimum 4 bar (64 adım) varsayalım
};

/**
 * Aranjmandaki en son klibin bitiş zamanına göre döngü uzunluğunu ADIM cinsinden hesaplar.
 * @param {Array} clips - Aranjmandaki klipleri içeren dizi.
 * @returns {number} - 16'nın katı olarak hesaplanmış döngü uzunluğu.
 */
export const calculateArrangementLoopLength = (clips) => {
  if (!Array.isArray(clips) || clips.length === 0) {
    return 64; // Varsayılan 4 bar (64 adım)
  }

  let lastBar = 0;
  clips.forEach(clip => {
    const clipEndBar = (clip.startTime || 0) + (clip.duration || 0);
    if (clipEndBar > lastBar) {
      lastBar = clipEndBar;
    }
  });

  const requiredBars = Math.ceil(lastBar / 4) * 4;
  return Math.max(4, requiredBars) * 16; // Adım sayısını döndür
};

/**
 * === KAYIP FONKSİYON (GÜÇLENDİRİLEREK GERİ GELDİ) ===
 * Projenin o anki moduna göre doğru ses döngüsü uzunluğunu hesaplayan ana fonksiyon.
 * @param {string} mode - 'pattern' veya 'song'.
 * @param {object} data - Gerekli verileri içeren obje: { patterns, activePatternId, clips }.
 * @returns {number} - Adım cinsinden hesaplanmış ses motoru döngü uzunluğu.
 */
export const calculateAudioLoopLength = (mode, data) => {
    if (mode === 'song') {
        return calculateArrangementLoopLength(data.clips);
    }
    // Varsayılan olarak ve 'pattern' modunda
    const activePattern = data.patterns?.[data.activePatternId];
    return calculatePatternLoopLength(activePattern);
};


/**
 * Channel Rack gibi UI bileşenlerinde gösterilecek uzunluğu hesaplar.
 * @param {number} audioLoopLengthInSteps - Adım cinsinden ses döngüsü uzunluğu.
 * @returns {number} - UI'da gösterilecek toplam adım sayısı.
 */
export const calculateUIRackLength = (audioLoopLengthInSteps) => {
  return audioLoopLengthInSteps + 16; // Her zaman fazladan 1 bar boşluk bırak
};