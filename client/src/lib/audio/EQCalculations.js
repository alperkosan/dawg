/**
 * @file EQCalculations.js
 * @description Profesyonel ve bilimsel olarak doğru Biquad filtresi katsayılarını
 * ve frekans tepki eğrilerini hesaplayan yardımcı kütüphane.
 * REHBERE GÖRE GÜNCELLENDİ: Tüm formüller endüstri standardı "Audio EQ Cookbook" temel alınarak düzeltilmiştir.
 */
export class EQCalculations {

  /**
   * Belirli bir filtre tipi için Biquad filtresi katsayılarını hesaplar.
   * @param {string} type - 'peaking', 'lowshelf', 'highshelf'
   * @param {number} frequency - Merkez frekans (Hz)
   * @param {number} gain - Kazanç (dB)
   * @param {number} Q - Q faktörü
   * @param {number} sampleRate - Örnekleme oranı
   * @returns {object} a ve b katsayılarını içeren bir nesne.
   */
  static calculateBiquadCoefficients(type, frequency, gain, Q, sampleRate = 44100) {
    const w0 = 2 * Math.PI * frequency / sampleRate;
    const cos_w0 = Math.cos(w0);
    const sin_w0 = Math.sin(w0);
    const A = Math.pow(10, gain / 40);
    const alpha = sin_w0 / (2 * Q);

    let b0, b1, b2, a0, a1, a2;

    switch (type) {
      case 'peaking':
        b0 = 1 + alpha * A;
        b1 = -2 * cos_w0;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cos_w0;
        a2 = 1 - alpha / A;
        break;
      case 'lowshelf':
        // Düzeltilmiş ve doğru Lowshelf formülü
        b0 = A * ((A + 1) - (A - 1) * cos_w0 + 2 * Math.sqrt(A) * alpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * cos_w0);
        b2 = A * ((A + 1) - (A - 1) * cos_w0 - 2 * Math.sqrt(A) * alpha);
        a0 = (A + 1) + (A - 1) * cos_w0 + 2 * Math.sqrt(A) * alpha;
        a1 = -2 * ((A - 1) + (A + 1) * cos_w0);
        a2 = (A + 1) + (A - 1) * cos_w0 - 2 * Math.sqrt(A) * alpha;
        break;
      case 'highshelf':
        // Düzeltilmiş ve doğru Highshelf formülü
        b0 = A * ((A + 1) + (A - 1) * cos_w0 + 2 * Math.sqrt(A) * alpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * cos_w0);
        b2 = A * ((A + 1) + (A - 1) * cos_w0 - 2 * Math.sqrt(A) * alpha);
        a0 = (A + 1) - (A - 1) * cos_w0 + 2 * Math.sqrt(A) * alpha;
        a1 = 2 * ((A - 1) - (A + 1) * cos_w0);
        a2 = (A + 1) - (A - 1) * cos_w0 - 2 * Math.sqrt(A) * alpha;
        break;
      case 'highpass':
        // Highpass filter
        b0 = (1 + cos_w0) / 2;
        b1 = -(1 + cos_w0);
        b2 = (1 + cos_w0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cos_w0;
        a2 = 1 - alpha;
        break;
      case 'lowpass':
        // Lowpass filter
        b0 = (1 - cos_w0) / 2;
        b1 = 1 - cos_w0;
        b2 = (1 - cos_w0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cos_w0;
        a2 = 1 - alpha;
        break;
      case 'notch':
        // Notch filter (band-stop)
        b0 = 1;
        b1 = -2 * cos_w0;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cos_w0;
        a2 = 1 - alpha;
        break;
      default:
        return { b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 };
    }

    // Katsayıları a0'a bölerek normalize et
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }
  
  /**
   * Verilen katsayılar ve frekans için büyüklük (dB) ve faz tepkisini hesaplar.
   * REHBERE GÖRE GÜNCELLENDİ: Karmaşık sayılarla daha doğru bir hesaplama. 
   */
  static getFrequencyResponse(coeffs, freq, sampleRate) {
    const { b0, b1, b2, a1, a2 } = coeffs;
    const w = 2 * Math.PI * freq / sampleRate;
    
    const numReal = b0 + b1 * Math.cos(-w) + b2 * Math.cos(-2 * w);
    const numImag = b1 * Math.sin(-w) + b2 * Math.sin(-2 * w);
    const denReal = 1 + a1 * Math.cos(-w) + a2 * Math.cos(-2 * w);
    const denImag = a1 * Math.sin(-w) + a2 * Math.sin(-2 * w);
    
    const denMagSq = denReal * denReal + denImag * denImag;
    
    const real = (numReal * denReal + numImag * denImag) / denMagSq;
    const imag = (numImag * denReal - numReal * denImag) / denMagSq;
    
    const magnitude = Math.sqrt(real * real + imag * imag);
    const magnitudeDB = 20 * Math.log10(magnitude);
    const phase = Math.atan2(imag, real);

    return { magnitudeDB, phase };
  }

  /**
   * Tüm EQ bantlarının birleşik frekans tepki eğrisini oluşturur.
   */
  static generateResponseCurve(bands, sampleRate = 44100, points = 128) {
    // *** ONARIM: Savunma mekanizması eklendi ***
    // 'bands' parametresinin bir dizi olduğundan emin ol. Değilse, boş bir eğri döndür.
    if (!Array.isArray(bands)) {
        console.warn("EQCalculations: 'generateResponseCurve' fonksiyonuna dizi olmayan bir 'bands' parametresi gönderildi.", bands);
        return [];
    }

    const curve = [];
    const minFreq = 20;
    const maxFreq = sampleRate / 2;
    
    for (let i = 0; i < points; i++) {
        const percent = i / (points - 1);
        const freq = minFreq * Math.pow(maxFreq / minFreq, percent);
        
        let totalMagnitudeDB = 0;
        
        bands.forEach(band => {
            if (!band.active) return;
            const coeffs = this.calculateBiquadCoefficients(band.type, band.frequency, band.gain, band.q, sampleRate);
            const response = this.getFrequencyResponse(coeffs, freq, sampleRate);
            totalMagnitudeDB += response.magnitudeDB;
        });
        
        curve.push({ frequency: freq, magnitudeDB: totalMagnitudeDB });
    }
    return curve;
  }
}