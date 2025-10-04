/**
 * 🎛️ AUDIO PROCESSOR
 *
 * Advanced audio manipulation utilities
 * Supports normalization, effects, format conversion, and more
 */

export class AudioProcessor {
  constructor() {
    this.sampleRate = 44100;
    this.maxAmplitude = 1.0;

    console.log('🎛️ AudioProcessor initialized');
  }

  // =================== CORE PROCESSING METHODS ===================

  /**
   * Process audio buffer with various effects and adjustments
   * @param {AudioBuffer} audioBuffer - Input audio buffer
   * @param {object} options - Processing options
   * @returns {Promise<AudioBuffer>} Processed audio buffer
   */
  async processAudio(audioBuffer, options = {}) {
    const {
      normalize = false,
      fadeIn = false,
      fadeOut = false,
      fadeInDuration = 0.1,
      fadeOutDuration = 0.1,
      gain = 1.0,
      highpass = null,
      lowpass = null,
      compress = false,
      reverb = false
    } = options;

    console.log('🎛️ Processing audio:', options);

    // Create a copy of the audio buffer
    let processedBuffer = this._copyAudioBuffer(audioBuffer);

    // Apply gain
    if (gain !== 1.0) {
      processedBuffer = await this._applyGain(processedBuffer, gain);
    }

    // Apply normalization
    if (normalize) {
      processedBuffer = await this._normalize(processedBuffer);
    }

    // Apply fade in
    if (fadeIn) {
      processedBuffer = await this._applyFadeIn(processedBuffer, fadeInDuration);
    }

    // Apply fade out
    if (fadeOut) {
      processedBuffer = await this._applyFadeOut(processedBuffer, fadeOutDuration);
    }

    // Apply filters
    if (highpass) {
      processedBuffer = await this._applyHighpass(processedBuffer, highpass);
    }

    if (lowpass) {
      processedBuffer = await this._applyLowpass(processedBuffer, lowpass);
    }

    // Apply compression
    if (compress) {
      processedBuffer = await this._applyCompression(processedBuffer, compress);
    }

    // Apply reverb
    if (reverb) {
      processedBuffer = await this._applyReverb(processedBuffer, reverb);
    }

    return processedBuffer;
  }

  // =================== AUDIO EFFECTS ===================

  /**
   * Normalize audio to maximum amplitude
   */
  async _normalize(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    // Create new buffer
    const normalizedBuffer = new AudioBuffer({
      numberOfChannels,
      length,
      sampleRate
    });

    // Find peak amplitude across all channels
    let peak = 0;
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        peak = Math.max(peak, Math.abs(channelData[i]));
      }
    }

    // Apply normalization if peak > 0
    const normalizationFactor = peak > 0 ? this.maxAmplitude / peak : 1;

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = normalizedBuffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        outputData[i] = inputData[i] * normalizationFactor;
      }
    }

    console.log(`🎛️ Normalized audio, peak: ${peak.toFixed(3)}, factor: ${normalizationFactor.toFixed(3)}`);
    return normalizedBuffer;
  }

  /**
   * Apply gain to audio buffer
   */
  async _applyGain(audioBuffer, gainValue) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    const gainBuffer = new AudioBuffer({
      numberOfChannels,
      length,
      sampleRate
    });

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = gainBuffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        outputData[i] = inputData[i] * gainValue;
      }
    }

    return gainBuffer;
  }

  /**
   * Apply fade in effect
   */
  async _applyFadeIn(audioBuffer, duration) {
    const fadeInSamples = Math.floor(duration * audioBuffer.sampleRate);
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    const fadedBuffer = this._copyAudioBuffer(audioBuffer);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = fadedBuffer.getChannelData(channel);

      for (let i = 0; i < Math.min(fadeInSamples, length); i++) {
        const fadeMultiplier = i / fadeInSamples;
        channelData[i] *= fadeMultiplier;
      }
    }

    return fadedBuffer;
  }

  /**
   * Apply fade out effect
   */
  async _applyFadeOut(audioBuffer, duration) {
    const fadeOutSamples = Math.floor(duration * audioBuffer.sampleRate);
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    const fadedBuffer = this._copyAudioBuffer(audioBuffer);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = fadedBuffer.getChannelData(channel);

      for (let i = Math.max(0, length - fadeOutSamples); i < length; i++) {
        const fadeMultiplier = (length - i) / fadeOutSamples;
        channelData[i] *= fadeMultiplier;
      }
    }

    return fadedBuffer;
  }

  /**
   * Apply simple highpass filter
   */
  async _applyHighpass(audioBuffer, frequency) {
    // Simple first-order highpass filter
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    const filteredBuffer = this._copyAudioBuffer(audioBuffer);
    const rc = 1.0 / (2 * Math.PI * frequency);
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = filteredBuffer.getChannelData(channel);

      let prevInput = 0;
      let prevOutput = 0;

      for (let i = 0; i < length; i++) {
        outputData[i] = alpha * (prevOutput + inputData[i] - prevInput);
        prevInput = inputData[i];
        prevOutput = outputData[i];
      }
    }

    return filteredBuffer;
  }

  /**
   * Apply simple lowpass filter
   */
  async _applyLowpass(audioBuffer, frequency) {
    // Simple first-order lowpass filter
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    const filteredBuffer = this._copyAudioBuffer(audioBuffer);
    const rc = 1.0 / (2 * Math.PI * frequency);
    const dt = 1.0 / sampleRate;
    const alpha = dt / (rc + dt);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = filteredBuffer.getChannelData(channel);

      let prevOutput = 0;

      for (let i = 0; i < length; i++) {
        outputData[i] = prevOutput + alpha * (inputData[i] - prevOutput);
        prevOutput = outputData[i];
      }
    }

    return filteredBuffer;
  }

  /**
   * Apply simple compression
   */
  async _applyCompression(audioBuffer, options = {}) {
    const {
      threshold = 0.7,
      ratio = 4,
      attack = 0.01,
      release = 0.1
    } = options;

    // Simple compressor implementation
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    const compressedBuffer = this._copyAudioBuffer(audioBuffer);
    const attackSamples = Math.floor(attack * sampleRate);
    const releaseSamples = Math.floor(release * sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = compressedBuffer.getChannelData(channel);
      let envelope = 1.0;

      for (let i = 0; i < length; i++) {
        const input = Math.abs(channelData[i]);

        if (input > threshold) {
          const excess = input - threshold;
          const compressedExcess = excess / ratio;
          const targetGain = (threshold + compressedExcess) / input;

          // Attack/release envelope
          if (targetGain < envelope) {
            envelope = Math.max(targetGain, envelope - (1.0 / attackSamples));
          } else {
            envelope = Math.min(1.0, envelope + (1.0 / releaseSamples));
          }
        } else {
          envelope = Math.min(1.0, envelope + (1.0 / releaseSamples));
        }

        channelData[i] *= envelope;
      }
    }

    return compressedBuffer;
  }

  /**
   * Apply simple reverb (convolution with impulse response)
   */
  async _applyReverb(audioBuffer, options = {}) {
    const {
      roomSize = 0.5,
      damping = 0.5,
      wetLevel = 0.3
    } = options;

    // Generate simple impulse response
    const impulseLength = Math.floor(roomSize * audioBuffer.sampleRate * 2);
    const impulse = new Float32Array(impulseLength);

    for (let i = 0; i < impulseLength; i++) {
      const decay = Math.pow(1 - damping, i / audioBuffer.sampleRate);
      impulse[i] = (Math.random() * 2 - 1) * decay * 0.1;
    }

    // Apply convolution (simplified)
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const reverbedBuffer = this._copyAudioBuffer(audioBuffer);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = reverbedBuffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        let reverbSample = 0;

        for (let j = 0; j < Math.min(impulseLength, i); j++) {
          reverbSample += inputData[i - j] * impulse[j];
        }

        outputData[i] = inputData[i] * (1 - wetLevel) + reverbSample * wetLevel;
      }
    }

    return reverbedBuffer;
  }

  // =================== FORMAT CONVERSION ===================

  /**
   * Convert AudioBuffer to WAV blob
   */
  async audioBufferToWav(audioBuffer, bitDepth = 16) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const bytesPerSample = bitDepth / 8;

    // Calculate buffer size
    const bufferLength = 44 + length * numberOfChannels * bytesPerSample;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    let pos = 0;

    // RIFF header
    writeString(pos, 'RIFF'); pos += 4;
    view.setUint32(pos, bufferLength - 8, true); pos += 4;
    writeString(pos, 'WAVE'); pos += 4;

    // fmt chunk
    writeString(pos, 'fmt '); pos += 4;
    view.setUint32(pos, 16, true); pos += 4; // chunk size
    view.setUint16(pos, 1, true); pos += 2; // PCM format
    view.setUint16(pos, numberOfChannels, true); pos += 2;
    view.setUint32(pos, sampleRate, true); pos += 4;
    view.setUint32(pos, sampleRate * numberOfChannels * bytesPerSample, true); pos += 4;
    view.setUint16(pos, numberOfChannels * bytesPerSample, true); pos += 2;
    view.setUint16(pos, bitDepth, true); pos += 2;

    // data chunk
    writeString(pos, 'data'); pos += 4;
    view.setUint32(pos, length * numberOfChannels * bytesPerSample, true); pos += 4;

    // Convert and write audio data
    if (bitDepth === 16) {
      for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sample = audioBuffer.getChannelData(channel)[i];
          const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
          view.setInt16(pos, intSample, true);
          pos += 2;
        }
      }
    } else if (bitDepth === 32) {
      for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sample = audioBuffer.getChannelData(channel)[i];
          view.setFloat32(pos, sample, true);
          pos += 4;
        }
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  // =================== UTILITY METHODS ===================

  /**
   * Create a copy of AudioBuffer
   */
  _copyAudioBuffer(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    const newBuffer = new AudioBuffer({
      numberOfChannels,
      length,
      sampleRate
    });

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      newBuffer.getChannelData(channel).set(channelData);
    }

    return newBuffer;
  }

  /**
   * Analyze audio buffer (get peak, RMS, etc.)
   */
  analyzeAudio(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    let peak = 0;
    let rmsSum = 0;
    let sampleCount = 0;

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        const sample = Math.abs(channelData[i]);
        peak = Math.max(peak, sample);
        rmsSum += sample * sample;
        sampleCount++;
      }
    }

    const rms = Math.sqrt(rmsSum / sampleCount);
    const duration = length / audioBuffer.sampleRate;

    return {
      duration,
      peak,
      rms,
      dynamicRange: peak / (rms + 1e-10),
      sampleRate: audioBuffer.sampleRate,
      channels: numberOfChannels,
      samples: length
    };
  }

  /**
   * Mix multiple audio buffers together
   */
  async mixAudioBuffers(audioBuffers, weights = null) {
    if (audioBuffers.length === 0) return null;

    const firstBuffer = audioBuffers[0];
    const sampleRate = firstBuffer.sampleRate;
    const numberOfChannels = firstBuffer.numberOfChannels;

    // Find maximum length
    const maxLength = Math.max(...audioBuffers.map(buffer => buffer.length));

    const mixedBuffer = new AudioBuffer({
      numberOfChannels,
      length: maxLength,
      sampleRate
    });

    // Mix all buffers
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const outputData = mixedBuffer.getChannelData(channel);

      for (let bufferIndex = 0; bufferIndex < audioBuffers.length; bufferIndex++) {
        const buffer = audioBuffers[bufferIndex];
        const inputData = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
        const weight = weights ? weights[bufferIndex] : (1.0 / audioBuffers.length);

        for (let i = 0; i < Math.min(buffer.length, maxLength); i++) {
          outputData[i] += inputData[i] * weight;
        }
      }
    }

    return mixedBuffer;
  }
}

export default AudioProcessor;