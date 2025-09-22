// public/worklets/effects-processor.js
class EffectsProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'drive', defaultValue: 1, minValue: 1, maxValue: 10 },
      { name: 'tone', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'level', defaultValue: 0.8, minValue: 0, maxValue: 2 },
      { name: 'delayTime', defaultValue: 0.3, minValue: 0, maxValue: 2 },
      { name: 'feedback', defaultValue: 0.3, minValue: 0, maxValue: 0.9 },
      { name: 'mix', defaultValue: 0.3, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    
    this.effectType = options?.processorOptions?.effectType || 'delay';
    this.settings = options?.processorOptions?.settings || {};
    this.sampleRate = globalThis.sampleRate || 44100;
    
    // Delay buffer (2 seconds max)
    const maxDelayTime = 2;
    const maxDelaySamples = Math.floor(maxDelayTime * this.sampleRate);
    this.delayBuffer = new Float32Array(maxDelaySamples);
    this.delayWriteIndex = 0;
    
    // Filter states for tone control
    this.toneFilterState = [0, 0]; // [lowpass, highpass]
    
    // DC blocker state
    this.dcBlocker = { x1: 0, y1: 0 };
    
    // Distortion/saturation state
    this.saturationHistory = new Float32Array(4); // Short history for oversampling
    
    console.log(`🎚️ EffectsProcessor initialized: ${this.effectType}`);
    
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'updateSettings':
        this.settings = { ...this.settings, ...data };
        break;
      case 'setEffectType':
        this.effectType = data.effectType;
        break;
      case 'bypass':
        this.bypassed = data.bypassed;
        break;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !input[0] || !output || !output[0]) return true;
    
    const blockSize = input[0].length;
    
    for (let channel = 0; channel < Math.min(input.length, output.length); channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      
      for (let i = 0; i < blockSize; i++) {
        let sample = inputChannel[i];
        
        // Apply effects chain
        sample = this.processEffectChain(sample, parameters, i);
        
        outputChannel[i] = sample;
      }
    }

    return true;
  }

  processEffectChain(sample, parameters, sampleIndex) {
    const drive = this.getParameterValue(parameters.drive, sampleIndex);
    const tone = this.getParameterValue(parameters.tone, sampleIndex);
    const level = this.getParameterValue(parameters.level, sampleIndex);
    const delayTime = this.getParameterValue(parameters.delayTime, sampleIndex);
    const feedback = this.getParameterValue(parameters.feedback, sampleIndex);
    const mix = this.getParameterValue(parameters.mix, sampleIndex);
    
    const drySample = sample;
    
    // 1. Distortion/Saturation
    sample = this.applySaturation(sample, drive);
    
    // 2. Tone control
    sample = this.applyToneControl(sample, tone);
    
    // 3. Delay effect
    const delayedSample = this.applyDelay(sample, delayTime, feedback);
    
    // 4. Mix dry/wet
    sample = drySample * (1 - mix) + delayedSample * mix;
    
    // 5. Output level
    sample *= level;
    
    // 6. DC blocker
    sample = this.dcBlock(sample);
    
    // 7. Final limiting
    sample = this.softLimit(sample);
    
    return sample;
  }

  applySaturation(sample, drive) {
    // Multi-stage saturation for warmth
    
    // Stage 1: Pre-emphasis
    const preEmphasis = sample + this.saturationHistory[0] * 0.1;
    
    // Stage 2: Drive
    let driven = preEmphasis * drive;
    
    // Stage 3: Tube-style saturation
    if (Math.abs(driven) > 0.7) {
      const sign = Math.sign(driven);
      const magnitude = Math.abs(driven);
      driven = sign * (0.7 + (magnitude - 0.7) * 0.3);
    }
    
    // Stage 4: Soft clipping
    driven = Math.tanh(driven * 0.8);
    
    // Stage 5: Post-processing
    const processed = driven * 0.85; // Reduce level after saturation
    
    // Update history
    this.saturationHistory[3] = this.saturationHistory[2];
    this.saturationHistory[2] = this.saturationHistory[1];
    this.saturationHistory[1] = this.saturationHistory[0];
    this.saturationHistory[0] = sample;
    
    return processed;
  }

  applyToneControl(sample, tone) {
    // Tone control: 0 = dark (lowpass), 1 = bright (highpass), 0.5 = neutral
    
    if (tone < 0.5) {
      // Lowpass - darken the sound
      const cutoff = 500 + (tone * 2) * 4500; // 500Hz to 5000Hz
      const alpha = this.calculateLowpassAlpha(cutoff);
      
      this.toneFilterState[0] += alpha * (sample - this.toneFilterState[0]);
      return this.toneFilterState[0];
      
    } else if (tone > 0.5) {
      // Highpass - brighten the sound
      const cutoff = 200 + ((tone - 0.5) * 2) * 800; // 200Hz to 1000Hz
      const alpha = this.calculateHighpassAlpha(cutoff);
      
      this.toneFilterState[1] = alpha * (this.toneFilterState[1] + sample - this.toneFilterState[0]);
      this.toneFilterState[0] = sample;
      return this.toneFilterState[1];
      
    } else {
      // Neutral - pass through with minimal filtering
      return sample;
    }
  }

  applyDelay(sample, delayTime, feedback) {
    const delaySamples = Math.floor(delayTime * this.sampleRate);
    const maxDelay = this.delayBuffer.length;
    const clampedDelay = Math.max(1, Math.min(delaySamples, maxDelay - 1));
    
    // Calculate read index with bounds checking
    const readIndex = (this.delayWriteIndex - clampedDelay + maxDelay) % maxDelay;
    
    // Get delayed sample
    const delayedSample = this.delayBuffer[readIndex];
    
    // Write new sample to delay buffer with feedback
    const feedbackSample = sample + (delayedSample * feedback);
    this.delayBuffer[this.delayWriteIndex] = this.softLimit(feedbackSample);
    
    // Advance write index
    this.delayWriteIndex = (this.delayWriteIndex + 1) % maxDelay;
    
    return delayedSample;
  }

  dcBlock(sample) {
    // DC blocking filter: y[n] = x[n] - x[n-1] + 0.995 * y[n-1]
    const output = sample - this.dcBlocker.x1 + 0.995 * this.dcBlocker.y1;
    this.dcBlocker.x1 = sample;
    this.dcBlocker.y1 = output;
    return output;
  }

  softLimit(sample) {
    // Soft limiter to prevent clipping
    if (Math.abs(sample) > 0.95) {
      const sign = Math.sign(sample);
      const magnitude = Math.abs(sample);
      return sign * (0.95 + (magnitude - 0.95) * 0.1);
    }
    return sample;
  }

  // Filter coefficient calculations
  calculateLowpassAlpha(cutoffFreq) {
    const rc = 1 / (2 * Math.PI * cutoffFreq);
    const dt = 1 / this.sampleRate;
    return dt / (rc + dt);
  }

  calculateHighpassAlpha(cutoffFreq) {
    const rc = 1 / (2 * Math.PI * cutoffFreq);
    const dt = 1 / this.sampleRate;
    return rc / (rc + dt);
  }

  getParameterValue(param, sampleIndex) {
    return param.length > 1 ? param[sampleIndex] : param[0];
  }
}

registerProcessor('effects-processor', EffectsProcessor);