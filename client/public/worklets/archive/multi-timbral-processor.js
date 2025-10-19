// public/worklets/multi-timbral-processor.js
class MultiTimbralProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.voices = new Map(); // voice pools per timbre
    this.timbres = new Map(); // different instrument configs
    this.maxPolyphony = 16;
    
    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'addTimbre':
          this.addTimbre(data.id, data.config);
          break;
        case 'noteOn':
          this.triggerNote(data.timbreId, data.pitch, data.velocity);
          break;
        case 'noteOff':
          this.releaseNote(data.timbreId, data.pitch);
          break;
      }
    };
  }

  addTimbre(id, config) {
    this.timbres.set(id, config);
    this.voices.set(id, new Map());
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const blockSize = output[0].length;
    
    // Mix all timbres
    for (let i = 0; i < blockSize; i++) {
      let mixedSample = 0;
      
      this.timbres.forEach((config, timbreId) => {
        const voices = this.voices.get(timbreId);
        
        voices.forEach((voice) => {
          mixedSample += this.processVoiceWithConfig(voice, config, i);
        });
      });
      
      // ✅ Stereo output (currently identical L/R, but preserves stereo capability)
      // Future: Add per-timbre panning for stereo spread
      if (output.length >= 2) {
        output[0][i] = mixedSample * 0.1; // Left
        output[1][i] = mixedSample * 0.1; // Right
      } else if (output.length === 1) {
        output[0][i] = mixedSample * 0.1; // Mono fallback
      }
    }

    return true;
  }

  processVoiceWithConfig(voice, config, sampleIndex) {
    // Timbre-specific processing
    const oscType = config.oscillator?.type || 'sawtooth';
    const filterType = config.filter?.type || 'lowpass';
    
    // Custom processing per timbre
    return this.generateOscillator(voice, oscType) * 
           this.processEnvelope(voice, config) *
           this.applyFilter(voice.lastSample, config, filterType);
  }
}

registerProcessor('multi-timbral-processor', MultiTimbralProcessor);