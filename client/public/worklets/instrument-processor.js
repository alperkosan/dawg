// public/worklets/instrument-processor.js
class InstrumentProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'pitch', defaultValue: 440, minValue: 20, maxValue: 20000 },
      { name: 'gate', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'velocity', defaultValue: 1, minValue: 0, maxValue: 1 },
      { name: 'detune', defaultValue: 0, minValue: -1200, maxValue: 1200 },
      { name: 'filterFreq', defaultValue: 1000, minValue: 20, maxValue: 20000 },
      { name: 'filterQ', defaultValue: 1, minValue: 0.1, maxValue: 30 },
      { name: 'attack', defaultValue: 0.01, minValue: 0.001, maxValue: 4 },
      { name: 'decay', defaultValue: 0.3, minValue: 0.001, maxValue: 4 },
      { name: 'sustain', defaultValue: 0.7, minValue: 0, maxValue: 1 },
      { name: 'release', defaultValue: 1, minValue: 0.001, maxValue: 4 }
    ];
  }

  constructor(options) {
    super();
    
    // Instrument info
    this.instrumentId = options?.processorOptions?.instrumentId || 'unknown';
    this.instrumentName = options?.processorOptions?.instrumentName || 'Unnamed';
    
    // Polyphonic voices
    this.voices = new Map();
    this.voiceId = 0;
    this.maxPolyphony = 8;
    
    // Synthesis state
    this.sampleRate = globalThis.sampleRate || 44100;
    
    // Pattern playback
    this.patternNotes = [];
    this.isPatternPlaying = false;
    this.patternStartTime = 0;
    
    // Performance tracking
    this.processedSamples = 0;
    this.activeVoiceCount = 0;
    
    // Message handling
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    console.log(`🎵 InstrumentProcessor initialized: ${this.instrumentName} (${this.instrumentId})`);
    this.port.postMessage({
      type: 'debug',
      data: { message: `Processor ready: ${this.instrumentName}` }
    });
  }

  handleMessage(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'noteOn':
          // ✅ DÜZELTME: Duration parametresini de al
          this.triggerNote(
            data.pitch || data.frequency, 
            data.velocity || 1, 
            data.noteId,
            data.duration // ← Bu parametre eksikti
          );
          break;
          
        case 'noteOff':
          this.releaseNote(data.pitch || data.frequency);
          break;
          
        case 'allNotesOff':
          this.allNotesOff();
          break;
          
        case 'loadPattern':
          this.loadPattern(data.notes || []);
          break;
          
        case 'startPattern':
          this.startPatternPlayback(data.startTime || 0);
          break;
          
        case 'stopPattern':
          this.stopPatternPlayback();
          break;
          
        case 'setParam':
          // Real-time parameter changes (if needed)
          break;

        case 'automation':
          this.applyAutomation(data.parameter, data.value, data.time);
          break;
          
        case 'scheduleAutomation':
          this.scheduleAutomationEvent(data.parameter, data.value, data.time);
          break;
          
        default:
          console.warn(`Unknown message type: ${type}`);
      }
    } catch (error) {
      this.port.postMessage({
        type: 'error',
        data: { error: error.message, messageType: type }
      });
    }
  }

  triggerNote(frequency, velocity, noteId = null, duration = null) {
    if (this.voices.size >= this.maxPolyphony) {
        const oldestVoiceId = this.voices.keys().next().value;
        this.voices.delete(oldestVoiceId);
    }

    const voiceData = {
        id: noteId || `voice_${this.voiceId++}`,
        frequency,
        velocity,
        phase: 0,
        envelopePhase: 'attack',
        envelopeValue: 0,
        envelopeTime: 0,
        startTime: currentTime, // `currentTime` global bir değişkendir (AudioWorkletGlobalScope)
        duration: duration, // ✅ EKLENEN: Nota süresini saniye olarak sakla
        filterStates: [0, 0, 0, 0]
    };
    
    this.voices.set(voiceData.id, voiceData);

    // Message gönder
    this.port.postMessage({
        type: 'noteStarted',
        data: {
            noteId: voiceData.id,
            frequency,
            velocity,
            duration, // ✅ EKLENEN
            voiceCount: this.voices.size
        }
    });
    
    console.log(`🎵 Worklet note triggered: ${frequency}Hz, duration: ${duration}s`);
  }


  releaseNote(frequency) {
    // Find voice with matching frequency (within tolerance)
    const voiceToRelease = Array.from(this.voices.values()).find(
      voice => Math.abs(voice.frequency - frequency) < 1
    );

    if (voiceToRelease) {
      voiceToRelease.envelopePhase = 'release';
      voiceToRelease.envelopeTime = 0;
    }
  }

  allNotesOff() {
    this.voices.forEach(voice => {
      voice.envelopePhase = 'release';
      voice.envelopeTime = 0;
    });
  }

  loadPattern(notes) {
    this.patternNotes = notes;
    this.port.postMessage({
      type: 'debug',
      data: { message: `Pattern loaded: ${notes.length} notes` }
    });
  }

  startPatternPlayback(startTime) {
    this.isPatternPlaying = true;
    this.patternStartTime = startTime;
  }

  stopPatternPlayback() {
    this.isPatternPlaying = false;
    this.allNotesOff();
  }

  applyAutomation(parameter, value, time) {
    const param = this.parameters.get(parameter);
    if (param) {
      if (time) {
        param.setTargetAtTime(value, time, 0.01);
      } else {
        param.value = value;
      }
    }
  }

  scheduleAutomationEvent(parameter, value, time) {
    // Schedule future automation events
    const delay = (time - currentTime) * 1000;
    if (delay > 0) {
      setTimeout(() => {
        this.applyAutomation(parameter, value);
      }, delay);
    } else {
      this.applyAutomation(parameter, value);
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const blockSize = output[0].length;
    
    for (let i = 0; i < blockSize; i++) {
        let mixedSample = 0;
        
        const sampleTime = currentTime + i / this.sampleRate;

        this.voices.forEach((voice, voiceId) => {
            // ✅ YENİ MANTIK: Eğer notanın süresi dolduysa ve hala 'release' fazına geçmediyse, şimdi geçir.
            if (voice.duration && sampleTime >= voice.startTime + voice.duration && voice.envelopePhase !== 'release') {
                voice.envelopePhase = 'release';
                voice.envelopeTime = 0; // Release zamanlayıcısını sıfırla
                console.log(`🎵 Note duration ended: ${voice.frequency}Hz`);
            }

            const sample = this.processVoice(voice, parameters, i);
            mixedSample += sample;
            
            // Voice cleanup
            if (voice.envelopePhase === 'off' && voice.envelopeValue < 0.0001) {
                this.voices.delete(voiceId);
                console.log(`🗑️ Voice cleaned up: ${voice.frequency}Hz`);
            }
        });
        
        const finalSample = Math.tanh(mixedSample);
        
        for (let channel = 0; channel < output.length; channel++) {
            output[channel][i] = finalSample;
        }
    }

    return true;
  }

  processVoice(voice, parameters, sampleIndex) {
    // Get current parameter values
    const detune = this.getParameterValue(parameters.detune, sampleIndex);
    const attack = this.getParameterValue(parameters.attack, sampleIndex);
    const decay = this.getParameterValue(parameters.decay, sampleIndex);
    const sustain = this.getParameterValue(parameters.sustain, sampleIndex);
    const release = this.getParameterValue(parameters.release, sampleIndex);
    
    // Calculate frequency with detune
    const frequency = voice.frequency * Math.pow(2, detune / 1200);
    
    // Generate oscillator
    voice.phase += (frequency * 2 * Math.PI) / this.sampleRate;
    if (voice.phase > Math.PI * 2) voice.phase -= Math.PI * 2;
    
    // Multiple waveforms for richer sound
    const saw = this.sawWave(voice.phase);
    const square = this.squareWave(voice.phase);
    const sine = Math.sin(voice.phase);
    
    // Mix waveforms (sawtooth + subtle sine for warmth)
    let sample = (saw * 0.7 + sine * 0.3) * voice.velocity;
    
    // Apply envelope
    const envelopeValue = this.processEnvelope(voice, attack, decay, sustain, release);
    sample *= envelopeValue;
    
    // Apply filter
    sample = this.applyFilter(sample, voice, parameters, sampleIndex);
    
    return sample * 0.3; // Voice level adjustment
  }

  processEnvelope(voice, attack, decay, sustain, release) {
    const dt = 1 / this.sampleRate;
    voice.envelopeTime += dt;
    
    switch (voice.envelopePhase) {
      case 'attack':
        voice.envelopeValue = voice.envelopeTime / attack;
        if (voice.envelopeValue >= 1) {
          voice.envelopeValue = 1;
          voice.envelopePhase = 'decay';
          voice.envelopeTime = 0;
        }
        break;
        
      case 'decay':
        voice.envelopeValue = 1 - (voice.envelopeTime / decay) * (1 - sustain);
        if (voice.envelopeValue <= sustain) {
          voice.envelopeValue = sustain;
          voice.envelopePhase = 'sustain';
        }
        break;
        
      case 'sustain':
        voice.envelopeValue = sustain;
        break;
        
      case 'release':
        voice.envelopeValue = sustain * (1 - voice.envelopeTime / release);
        if (voice.envelopeValue <= 0) {
          voice.envelopeValue = 0;
          voice.envelopePhase = 'off';
        }
        break;
        
      default:
        voice.envelopeValue = 0;
    }
    
    return voice.envelopeValue;
  }

  applyFilter(sample, voice, parameters, sampleIndex) {
    const freq = this.getParameterValue(parameters.filterFreq, sampleIndex);
    const Q = this.getParameterValue(parameters.filterQ, sampleIndex);
    
    // Biquad lowpass filter coefficients
    const omega = 2 * Math.PI * freq / this.sampleRate;
    const alpha = Math.sin(omega) / (2 * Q);
    const cos_omega = Math.cos(omega);
    
    const b0 = (1 - cos_omega) / 2;
    const b1 = 1 - cos_omega;
    const b2 = (1 - cos_omega) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cos_omega;
    const a2 = 1 - alpha;
    
    // Apply biquad filter
    const output = (
      b0 * sample + 
      b1 * voice.filterStates[0] + 
      b2 * voice.filterStates[1] -
      a1 * voice.filterStates[2] - 
      a2 * voice.filterStates[3]
    ) / a0;
    
    // Update filter states
    voice.filterStates[1] = voice.filterStates[0];
    voice.filterStates[0] = sample;
    voice.filterStates[3] = voice.filterStates[2];
    voice.filterStates[2] = output;
    
    return output;
  }

  applyMasterProcessing(sample) {
    // Soft clipping/saturation
    sample = Math.tanh(sample * 1.2) * 0.8;
    
    // Simple limiting
    return Math.max(-1, Math.min(1, sample));
  }

  // Waveform generators
  sawWave(phase) {
    return (2 * phase / (Math.PI * 2)) - 1;
  }

  squareWave(phase) {
    return phase < Math.PI ? 1 : -1;
  }

  // Utility
  getParameterValue(param, sampleIndex) {
    return param.length > 1 ? param[sampleIndex] : param[0];
  }
}

registerProcessor('instrument-processor', InstrumentProcessor);