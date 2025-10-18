// public/worklets/analysis-processor.js - GÜNCELLENMİŞ

class AnalysisProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.channelId = options?.processorOptions?.channelId || 'unknown';
    this._lastUpdate = 0;
    // Saniyede yaklaşık 30 kez veri gönder (33ms)
    this._updateInterval = 1000 / 30; 
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Gelen veri var mı kontrol et
    if (!input || !input[0]) {
      return true; // Sinyal yoksa bile çalışmaya devam et
    }

    // Veri gönderme zamanı geldi mi?
    const now = currentTime * 1000; // currentTime saniye cinsindendir
    if (now - this._lastUpdate > this._updateInterval) {
      // ✅ Stereo metering: Analyze both channels separately
      const leftData = input[0];
      const rightData = input[1] || input[0]; // Fallback to left if mono

      // Calculate RMS for left channel
      let sumL = 0;
      for (let i = 0; i < leftData.length; i++) {
        sumL += leftData[i] * leftData[i];
      }
      const rmsL = Math.sqrt(sumL / leftData.length);
      const dbL = 20 * Math.log10(rmsL);

      // Calculate RMS for right channel
      let sumR = 0;
      for (let i = 0; i < rightData.length; i++) {
        sumR += rightData[i] * rightData[i];
      }
      const rmsR = Math.sqrt(sumR / rightData.length);
      const dbR = 20 * Math.log10(rmsR);

      // Find peak across both channels
      const peak = Math.max(rmsL, rmsR);
      const dbPeak = 20 * Math.log10(peak);

      this.port.postMessage({
        type: 'meteringData',
        data: {
          db: isFinite(dbL) ? dbL : -144, // Legacy mono (left channel)
          dbL: isFinite(dbL) ? dbL : -144,
          dbR: isFinite(dbR) ? dbR : -144,
          peak: isFinite(dbPeak) ? dbPeak : -144
        }
      });
      this._lastUpdate = now;
    }
    
    // Bu işlemci sinyali değiştirmez, sadece dinler ve pas geçer.
    // Ancak bu mimaride sinyali output'a bağlamamız gerekiyor.
    const output = outputs[0];
    if (output && output[0]) {
        for (let channel = 0; channel < input.length; channel++) {
            output[channel].set(input[channel]);
        }
    }

    return true; // İşlemciyi aktif tut
  }
}

registerProcessor('analysis-processor', AnalysisProcessor);