// Temel matematik fonksiyonları
export const AudioMath = {
  // RMS (Root Mean Square) hesaplama
  calculateRMS(audioData) {
    const sum = audioData.reduce((acc, sample) => acc + sample * sample, 0);
    return Math.sqrt(sum / audioData.length);
  },

  // Zero-crossing rate hesaplama
  calculateZCR(audioData) {
    let crossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / audioData.length;
  },

  // Spectral centroid hesaplama (basitleştirilmiş)
  calculateSpectralCentroid(fftData) {
    let numerator = 0;
    let denominator = 0;
    
    fftData.forEach((magnitude, index) => {
      const frequency = (index / fftData.length) * 22050; // Nyquist frequency
      numerator += frequency * magnitude;
      denominator += magnitude;
    });
    
    return denominator > 0 ? numerator / denominator : 0;
  },

  // dB conversion
  linearToDb(linear) {
    return 20 * Math.log10(Math.max(linear, 0.0001));
  },

  dbToLinear(db) {
    return Math.pow(10, db / 20);
  },

  // Frequency to MIDI note
  frequencyToMidi(frequency) {
    return 69 + 12 * Math.log2(frequency / 440);
  }
};