/**
 * @file CompressorCalculations.js
 * @description "Complete Plugin System Overhaul Guide" dokümanında belirtilen,
 * "soft knee" davranışını doğru modelleyen profesyonel compressor DSP sınıfı.
 * Not: Bu sınıf, anlık kazanç azaltma (gain reduction) hesaplaması yapar.
 * Attack/release gibi zamana bağlı dinamikler için bir envelope follower gerekir.
 */
export class CompressorCalculations {
  /**
   * "Soft knee" dahil olmak üzere doğru kazanç azaltma miktarını hesaplar.
   * @param {number} inputLevelDb - Giriş sinyalinin anlık seviyesi (dB).
   * @param {number} threshold - Eşik (dB).
   * @param {number} ratio - Oran.
   * @param {number} knee - Knee genişliği (dB).
   * @returns {number} - Uygulanacak kazanç azaltma miktarı (dB cinsinden, negatif bir değer).
   */
  static calculateGainReduction(inputLevelDb, threshold, ratio, knee) {
    const kneeHalf = knee / 2;
    const inputOverThreshold = inputLevelDb - threshold;

    // Sinyal, knee bölgesinin altındaysa, sıkıştırma yok.
    if (inputOverThreshold < -kneeHalf) {
      return 0;
    }

    // Sinyal, knee bölgesinin üzerindeyse, tam sıkıştırma.
    if (inputOverThreshold > kneeHalf) {
      return inputOverThreshold * (1 - 1 / ratio);
    }

    // Sinyal tam olarak knee bölgesinin içindeyse, parabolik bir eğri ile yumuşak sıkıştırma.
    const x = inputOverThreshold + kneeHalf;
    return (ratio - 1) * Math.pow(x, 2) / (2 * knee * ratio);
  }
}