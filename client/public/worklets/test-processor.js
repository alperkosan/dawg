// Basit test processor - sadece sinyal geçirir
class TestProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isWorking = true;
    
    // Test için basit bir counter
    this.sampleCount = 0;
    
    console.log('🎵 TestProcessor initialized successfully!');
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (input && input[0] && output && output[0]) {
      // Input'u output'a kopyala (passthrough)
      for (let channel = 0; channel < input.length; channel++) {
        if (output[channel]) {
          output[channel].set(input[channel]);
        }
      }
    } else {
      // Input yoksa silence üret
      for (let channel = 0; channel < output.length; channel++) {
        if (output[channel]) {
          output[channel].fill(0);
        }
      }
    }
    
    this.sampleCount++;
    
    // Her 44100 sample'da bir (yaklaşık 1 saniye) mesaj gönder
    if (this.sampleCount % 44100 === 0) {
      this.port.postMessage({
        type: 'heartbeat',
        sampleCount: this.sampleCount,
        timestamp: Date.now()
      });
    }
    
    return true;
  }
}

registerProcessor('test-processor', TestProcessor);