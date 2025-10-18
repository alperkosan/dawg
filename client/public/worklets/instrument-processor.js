// public/worklets/instrument-processor.js

// ⚡ OPTIMIZATION: Pre-calculated frequency lookup table
// Covers C0 to B8 (108 semitones) for instant note-to-frequency conversion
const FREQUENCY_TABLE = (() => {
  const table = new Map();
  const A4_FREQ = 440.0;
  const A4_MIDI = 69;

  // Calculate frequencies for all MIDI notes (0-127)
  for (let midi = 0; midi <= 127; midi++) {
    const freq = A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
    table.set(midi, freq);
  }

  // Add note name mappings for common usage
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let octave = 0; octave <= 8; octave++) {
    for (let note = 0; note < 12; note++) {
      const noteName = noteNames[note] + octave;
      const midiNote = octave * 12 + note + 12; // C0 = MIDI 12
      if (midiNote <= 127) {
        table.set(noteName, table.get(midiNote));
      }
    }
  }

  console.log('⚡ Frequency lookup table initialized with', table.size, 'entries');
  return table;
})();

// ⚡ OPTIMIZATION: Voice Pool for efficient voice management
class VoicePool {
  constructor(poolSize = 16) {
    this.poolSize = poolSize;
    this.availableVoices = [];
    this.usedVoices = new Set();

    // Pre-allocate voice objects to avoid GC during audio processing
    for (let i = 0; i < poolSize; i++) {
      this.availableVoices.push(this.createVoiceObject(i));
    }

    console.log(`⚡ Voice pool initialized with ${poolSize} voices`);
  }

  createVoiceObject(id) {
    return {
      id: `pool_voice_${id}`,
      frequency: 0,
      velocity: 0,
      phase: 0,
      envelopePhase: 'release',
      envelopeTime: 0,
      envelopeValue: 0,
      duration: null,
      startTime: 0,
      isActive: false,
      // ⚡ OPTIMIZATION: Filter state and cached coefficients per voice
      filterStates: [0, 0, 0, 0],
      filterCoeffs: { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0 }, // Pre-normalized
      cachedFilterFreq: 0,
      cachedFilterQ: 0
    };
  }

  acquire() {
    if (this.availableVoices.length === 0) {
      // Pool exhausted, steal oldest voice
      const oldestVoice = this.findOldestVoice();
      if (oldestVoice) {
        this.release(oldestVoice);
      } else {
        // Fallback: create temporary voice
        console.warn('⚠️ Voice pool exhausted, creating temporary voice');
        return this.createVoiceObject('temp_' + Date.now());
      }
    }

    const voice = this.availableVoices.pop();
    voice.isActive = true;
    this.usedVoices.add(voice);
    return voice;
  }

  release(voice) {
    if (this.usedVoices.has(voice)) {
      // Reset voice to default state
      voice.frequency = 0;
      voice.velocity = 0;
      voice.phase = 0;
      voice.envelopePhase = 'release';
      voice.envelopeTime = 0;
      voice.envelopeValue = 0;
      voice.duration = null;
      voice.startTime = 0;
      voice.isActive = false;

      this.usedVoices.delete(voice);
      this.availableVoices.push(voice);
    }
  }

  findOldestVoice() {
    let oldest = null;
    let oldestTime = Infinity;

    for (const voice of this.usedVoices) {
      if (voice.startTime < oldestTime) {
        oldestTime = voice.startTime;
        oldest = voice;
      }
    }

    return oldest;
  }

  getStats() {
    return {
      poolSize: this.poolSize,
      available: this.availableVoices.length,
      used: this.usedVoices.size,
      utilization: (this.usedVoices.size / this.poolSize * 100).toFixed(1) + '%'
    };
  }
}

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
    this.isOfflineRendering = options?.processorOptions?.isOfflineRendering || false;

    // ⚡ OPTIMIZATION: Voice pool management for better performance
    this.voicePool = new VoicePool(16); // Pre-allocate 16 voices
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

    // ✅ Time tracking for offline rendering
    this.currentTime = 0;

    // ✅ Debug: Track if we've logged channel config
    this.hasLoggedChannelConfig = false;

    // Message handling
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    // ✅ OFFLINE RENDERING: Schedule notes immediately if provided
    if (this.isOfflineRendering && options?.processorOptions?.offlineNotes) {
      const offlineNotes = options.processorOptions.offlineNotes;
      console.log(`🎬 Scheduling ${offlineNotes.length} offline notes for ${this.instrumentName}`);

      offlineNotes.forEach(note => {
        this.triggerNote(
          note.pitch,
          note.velocity,
          note.noteId,
          note.duration,
          note.delay
        );
        console.log(`🎬 Offline note scheduled: ${note.pitch} at delay=${note.delay.toFixed(3)}s, dur=${note.duration.toFixed(3)}s`);
      });
    }

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
          // ✅ DÜZELTME: Duration ve delay parametrelerini al
          this.triggerNote(
            data.pitch || data.frequency,
            data.velocity || 1,
            data.noteId,
            data.duration, // Note duration
            data.delay || 0 // Delay before starting (for offline rendering)
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

        case 'dispose':
          console.log('🗑️ Disposing instrument processor');
          this.allNotesOff();
          // Cleanup işlemleri
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

  triggerNote(frequency, velocity, noteId = null, duration = null, delay = 0) {
    // ⚡ OPTIMIZATION: Use voice pool instead of manual polyphony management
    const voice = this.voicePool.acquire();

    // ⚡ OPTIMIZATION: Use frequency lookup table if input is note name
    let actualFrequency = frequency;
    if (typeof frequency === 'string') {
      actualFrequency = FREQUENCY_TABLE.get(frequency) || frequency;
    }

    // Configure voice with note data
    voice.id = noteId || `voice_${this.voiceId++}`;
    voice.frequency = actualFrequency;
    voice.velocity = velocity;
    voice.phase = 0;
    voice.envelopePhase = delay > 0 ? 'waiting' : 'attack'; // ✅ Add waiting phase for delayed notes
    voice.envelopeValue = 0;
    voice.envelopeTime = 0;
    voice.startTime = this.currentTime + delay; // ✅ Schedule note to start after delay
    voice.duration = duration;
    voice.filterStates = [0, 0, 0, 0];

    this.voices.set(voice.id, voice);

    // Message gönder
    this.port.postMessage({
        type: 'noteStarted',
        data: {
            noteId: voice.id,
            frequency,
            velocity,
            duration, // ✅ EKLENEN
            voiceCount: this.voices.size
        }
    });
    
    // Note triggered (log removed for performance)
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
    const delay = (time - this.currentTime) * 1000;
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

    // ✅ DEBUG: Log channel configuration on first call
    if (!this.hasLoggedChannelConfig && output) {
      console.log(`🎹 InstrumentProcessor[${this.instrumentId}] CHANNEL CONFIG:`, {
        outputChannels: output?.length || 0,
        stereo: (output?.length === 2) ? '✅ YES' : '❌ NO',
        instrumentName: this.instrumentName
      });
      this.hasLoggedChannelConfig = true;
    }

    for (let i = 0; i < blockSize; i++) {
        let mixedSample = 0;

        const sampleTime = this.currentTime + i / this.sampleRate;

        this.voices.forEach((voice, voiceId) => {
            // ✅ Check if note should start playing (transition from waiting to attack)
            if (voice.envelopePhase === 'waiting' && sampleTime >= voice.startTime) {
                voice.envelopePhase = 'attack';
                voice.envelopeTime = 0;
                // Note started (log removed for performance)
            }

            // ✅ YENİ MANTIK: Eğer notanın süresi dolduysa ve hala 'release' fazına geçmediyse, şimdi geçir.
            if (voice.duration && sampleTime >= voice.startTime + voice.duration && voice.envelopePhase !== 'release') {
                voice.envelopePhase = 'release';
                voice.envelopeTime = 0; // Release zamanlayıcısını sıfırla
            }

            const sample = this.processVoice(voice, parameters, i);
            mixedSample += sample;
            
            // ⚡ OPTIMIZATION: Voice cleanup with pool management
            if (voice.envelopePhase === 'off' && voice.envelopeValue < 0.0001) {
                this.voices.delete(voiceId);
                this.voicePool.release(voice);
            }
        });
        
        const finalSample = Math.tanh(mixedSample);

        // ✅ Output stereo signal (currently identical L/R, but preserves stereo capability for mixer pan)
        // Note: Even though both channels are identical, this ensures we're outputting TRUE stereo
        // so the downstream mixer can properly apply stereo panning
        if (output.length >= 2) {
            output[0][i] = finalSample; // Left channel
            output[1][i] = finalSample; // Right channel
        } else if (output.length === 1) {
            // Fallback for mono output (shouldn't happen with our config)
            output[0][i] = finalSample;
        }
    }

    // ✅ Update current time for next process call
    this.currentTime += blockSize / this.sampleRate;
    this.processedSamples += blockSize;

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
      case 'waiting':
        // ✅ Wait until scheduled start time (for offline rendering with delays)
        voice.envelopeValue = 0;
        break;

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

  // ⚡ OPTIMIZATION: Apply filter with coefficient caching per voice
  applyFilter(sample, voice, parameters, sampleIndex) {
    const freq = this.getParameterValue(parameters.filterFreq, sampleIndex);
    const Q = this.getParameterValue(parameters.filterQ, sampleIndex);

    // ⚡ OPTIMIZATION: Only recalculate coefficients if parameters changed
    if (freq !== voice.cachedFilterFreq || Q !== voice.cachedFilterQ) {
      this.updateVoiceFilterCoeffs(voice, freq, Q);
      voice.cachedFilterFreq = freq;
      voice.cachedFilterQ = Q;
    }

    // ⚡ OPTIMIZATION: Apply biquad filter using cached coefficients
    const output = (
      voice.filterCoeffs.b0 * sample +
      voice.filterCoeffs.b1 * voice.filterStates[0] +
      voice.filterCoeffs.b2 * voice.filterStates[1] -
      voice.filterCoeffs.a1 * voice.filterStates[2] -
      voice.filterCoeffs.a2 * voice.filterStates[3]
    );

    // Update filter states
    voice.filterStates[1] = voice.filterStates[0];
    voice.filterStates[0] = sample;
    voice.filterStates[3] = voice.filterStates[2];
    voice.filterStates[2] = output;

    return output;
  }

  // ⚡ OPTIMIZATION: Calculate and cache filter coefficients for a specific voice
  updateVoiceFilterCoeffs(voice, freq, Q) {
    const omega = 2 * Math.PI * freq / this.sampleRate;
    const sinOmega = Math.sin(omega);
    const cosOmega = Math.cos(omega);
    const alpha = sinOmega / (2 * Q);

    const b0 = (1 - cosOmega) / 2;
    const b1 = 1 - cosOmega;
    const b2 = (1 - cosOmega) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosOmega;
    const a2 = 1 - alpha;

    // Store pre-normalized coefficients
    voice.filterCoeffs.b0 = b0 / a0;
    voice.filterCoeffs.b1 = b1 / a0;
    voice.filterCoeffs.b2 = b2 / a0;
    voice.filterCoeffs.a1 = a1 / a0;
    voice.filterCoeffs.a2 = a2 / a0;
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