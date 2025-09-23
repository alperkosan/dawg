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
      const channelData = input[0];
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sum / channelData.length);
      const db = 20 * Math.log10(rms);
      
      this.port.postMessage({
        type: 'meteringData',
        data: {
          db: isFinite(db) ? db : -144 // -Infinity'ye karşı koruma
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