// public/worklets/analysis-processor.js

class AnalysisProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    console.log('📊 AnalysisProcessor initialized');
  }

  process(inputs, outputs, parameters) {
    // Bu işlemci şimdilik hiçbir şey yapmayacak,
    // sadece motorun yükleme adımını geçmesi için var.
    // Gelecekte buradan ana thread'e metering verisi gönderebiliriz.
    return true; // İşlemciyi aktif tut
  }
}

registerProcessor('analysis-processor', AnalysisProcessor);