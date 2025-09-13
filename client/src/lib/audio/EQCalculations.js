/**
 * @file EQCalculations.js
 * @description "Complete Plugin System Overhaul Guide" dokümanında belirtilen,
 * bilimsel olarak doğru Biquad filtresi katsayılarını ve frekans tepkisini
 * hesaplayan profesyonel DSP sınıfı.
 */
export class EQCalculations {

  /**
   * Verilen parametreler için Biquad filtresi katsayılarını hesaplar.
   * @param {string} type - Filtre tipi ('peaking', 'lowshelf', 'highshelf').
   * @param {number} frequency - Merkez frekans (Hz).
   * @param {number} gain - Kazanç (dB).
   * @param {number} Q - Kalite faktörü.
   * @param {number} sampleRate - Örnekleme oranı.
   * @returns {object} - IIRFilterNode ile uyumlu, normalize edilmiş katsayılar.
   */
  static calculateBiquadCoefficients(type, frequency, gain, Q, sampleRate = 44100) {
    const w0 = 2 * Math.PI * frequency / sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const A = Math.pow(10, gain / 40);
    const alpha = sinw0 / (2 * Q);

    let b0, b1, b2, a0, a1, a2;

    switch (type) {
      case 'peaking':
        b0 = 1 + alpha * A;
        b1 = -2 * cosw0;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosw0;
        a2 = 1 - alpha / A;
        break;

      case 'lowshelf':
        b0 = A * ((A + 1) - (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
        b2 = A * ((A + 1) - (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha);
        a0 = (A + 1) + (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha;
        a1 = -2 * ((A - 1) + (A + 1) * cosw0);
        a2 = (A + 1) + (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha;
        break;

      case 'highshelf':
        b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
        b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha);
        a0 = (A + 1) - (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha;
        a1 = 2 * ((A - 1) - (A + 1) * cosw0);
        a2 = (A + 1) - (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha;
        break;
        
      default:
        // Varsayılan olarak 'pass-through' bir filtre döndür
        return { feedforward: [1, 0, 0], feedback: [1, 0, 0] };
    }

    // Web Audio API'nin IIRFilterNode formatına uygun hale getir
    return {
      feedforward: [b0 / a0, b1 / a0, b2 / a0], // b coeffs
      feedback: [1, a1 / a0, a2 / a0],         // a coeffs (a0 normalize edildi)
    };
  }
}
