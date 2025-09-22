// public/worklets/mixer-processor.js

class MixerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    console.log('🎛️ MixerProcessor initialized');
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // Şimdilik sadece sinyali doğrudan geçiriyoruz (passthrough)
    if (input && input.length > 0 && output && output.length > 0) {
      for (let channel = 0; channel < input.length; channel++) {
        if(output[channel]) {
            output[channel].set(input[channel]);
        }
      }
    }
    
    return true; // İşlemciyi aktif tut
  }
}

registerProcessor('mixer-processor', MixerProcessor);