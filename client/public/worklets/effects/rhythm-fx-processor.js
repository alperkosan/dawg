/**
 * Rhythm FX Processor - The Groove Sculptor
 * Infinite rhythmic possibilities - gate, stutter, glitch, repeat, reverse
 *
 * Features:
 * - 16-32 step sequencer
 * - 6 effect modes (Gate, Stutter, Repeat, Reverse, Glitch, Tape Stop)
 * - Euclidean pattern generator
 * - Multi-lane patterns
 * - Host sync
 * - Probability per step
 */

class RhythmFXProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'division', defaultValue: 16, minValue: 1, maxValue: 64 }, // Steps per bar
      { name: 'chance', defaultValue: 100, minValue: 0, maxValue: 100 },
      { name: 'intensity', defaultValue: 100, minValue: 0, maxValue: 100 },
      { name: 'swing', defaultValue: 50, minValue: 0, maxValue: 100 },
      { name: 'bufferSize', defaultValue: 500, minValue: 10, maxValue: 2000 },
      { name: 'fadeTime', defaultValue: 10, minValue: 1, maxValue: 50 },
      { name: 'glitchAmount', defaultValue: 50, minValue: 0, maxValue: 100 },
      { name: 'tapeSpeed', defaultValue: 100, minValue: -200, maxValue: 200 },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 5 }, // 0-5: effect modes
      { name: 'bpm', defaultValue: 128, minValue: 60, maxValue: 200 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'RhythmFX';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Circular buffer for effects (2 seconds max)
    const maxBufferSize = Math.ceil(2 * this.sampleRate);
    this.circularBuffer = {
      left: new Float32Array(maxBufferSize),
      right: new Float32Array(maxBufferSize),
      writeIndex: 0,
      size: maxBufferSize
    };

    // Pattern state
    this.pattern = new Array(16).fill(1); // Default: all steps active
    this.currentStep = 0;
    this.stepProgress = 0;
    this.samplesPerStep = 0;

    // Effect state
    this.effectBuffer = {
      left: new Float32Array(this.sampleRate), // 1 sec buffer for effects
      right: new Float32Array(this.sampleRate),
      readIndex: 0,
      isActive: false
    };

    // Stutter state
    this.stutterState = {
      repeating: false,
      repeatBuffer: { left: new Float32Array(8192), right: new Float32Array(8192) },
      repeatLength: 0,
      repeatIndex: 0
    };

    // Gate envelope
    this.gateEnvelope = 1.0;

    // Message handling
    this.port.onmessage = (e) => {
      const { type, data } = e.data;

      switch (type) {
        case 'setPattern':
          this.pattern = data.pattern || this.pattern;
          break;
        case 'setStep':
          if (typeof data.step === 'number' && typeof data.value === 'number') {
            this.pattern[data.step] = data.value;
          }
          break;
        case 'generateEuclidean':
          this.generateEuclideanPattern(data.steps, data.pulses, data.rotation);
          break;
        case 'updateSettings':
          Object.assign(this.settings, data);
          break;
        case 'bypass':
          this.bypassed = data.value;
          break;
        default:
          break;
      }
    };
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  // Euclidean rhythm generator (Bjorklund's algorithm)
  generateEuclideanPattern(steps, pulses, rotation = 0) {
    if (pulses > steps) pulses = steps;
    if (pulses <= 0) {
      this.pattern = new Array(steps).fill(0);
      return;
    }

    const pattern = new Array(steps).fill(0);
    const bucket = pulses;
    let accumulator = 0;

    for (let i = 0; i < steps; i++) {
      accumulator += bucket;
      if (accumulator >= steps) {
        accumulator -= steps;
        pattern[i] = 1;
      }
    }

    // Apply rotation
    const rotated = [...pattern.slice(rotation), ...pattern.slice(0, rotation)];
    this.pattern = rotated;

    // Send pattern back to UI
    this.port.postMessage({
      type: 'patternGenerated',
      pattern: this.pattern
    });
  }

  // Calculate samples per step based on BPM and division
  calculateStepLength(bpm, division) {
    const beatsPerSecond = bpm / 60;
    const stepsPerBeat = division / 4; // Assuming 4/4 time
    const stepsPerSecond = beatsPerSecond * stepsPerBeat;
    return Math.floor(this.sampleRate / stepsPerSecond);
  }

  // Apply swing/groove
  applySwing(stepIndex, swing) {
    if (stepIndex % 2 === 1) {
      // Odd steps (off-beats) are delayed
      const swingAmount = (swing - 50) / 100; // -0.5 to +0.5
      return swingAmount * 0.3; // Max 30% delay
    }
    return 0;
  }

  // Gate effect
  processGate(sample, isActive, fadeTime) {
    const target = isActive ? 1.0 : 0.0;
    const fadeSamples = (fadeTime / 1000) * this.sampleRate;
    const step = 1.0 / fadeSamples;

    if (this.gateEnvelope < target) {
      this.gateEnvelope = Math.min(target, this.gateEnvelope + step);
    } else if (this.gateEnvelope > target) {
      this.gateEnvelope = Math.max(target, this.gateEnvelope - step);
    }

    return sample * this.gateEnvelope;
  }

  // Stutter effect
  processStutter(inputL, inputR, bufferSizeMs) {
    const bufferSizeSamples = Math.floor((bufferSizeMs / 1000) * this.sampleRate);

    if (!this.stutterState.repeating) {
      // Capture buffer
      this.stutterState.repeatLength = Math.min(bufferSizeSamples, this.stutterState.repeatBuffer.left.length);
      for (let i = 0; i < this.stutterState.repeatLength; i++) {
        const readIdx = (this.circularBuffer.writeIndex - this.stutterState.repeatLength + i + this.circularBuffer.size) % this.circularBuffer.size;
        this.stutterState.repeatBuffer.left[i] = this.circularBuffer.left[readIdx];
        this.stutterState.repeatBuffer.right[i] = this.circularBuffer.right[readIdx];
      }
      this.stutterState.repeating = true;
      this.stutterState.repeatIndex = 0;
    }

    // Read from repeat buffer
    const outL = this.stutterState.repeatBuffer.left[this.stutterState.repeatIndex];
    const outR = this.stutterState.repeatBuffer.right[this.stutterState.repeatIndex];

    this.stutterState.repeatIndex++;
    if (this.stutterState.repeatIndex >= this.stutterState.repeatLength) {
      this.stutterState.repeatIndex = 0;
    }

    return { left: outL, right: outR };
  }

  // Reverse effect
  processReverse(bufferSizeMs) {
    const bufferSizeSamples = Math.floor((bufferSizeMs / 1000) * this.sampleRate);
    const readIdx = (this.circularBuffer.writeIndex - bufferSizeSamples + this.circularBuffer.size) % this.circularBuffer.size;

    const outL = this.circularBuffer.left[readIdx];
    const outR = this.circularBuffer.right[readIdx];

    return { left: outL, right: outR };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length || this.bypassed) {
      if (output && output.length) {
        for (let channel = 0; channel < output.length; channel++) {
          output[channel].set(input?.[channel] || new Float32Array(128));
        }
      }
      return true;
    }

    const inputLeft = input[0];
    const inputRight = input[1] || input[0];

    const bpm = this.getParam(parameters.bpm, 0) ?? 128;
    const division = this.getParam(parameters.division, 0) ?? 16;
    const chance = this.getParam(parameters.chance, 0) ?? 100;
    const intensity = this.getParam(parameters.intensity, 0) ?? 100;
    const swing = this.getParam(parameters.swing, 0) ?? 50;
    const bufferSize = this.getParam(parameters.bufferSize, 0) ?? 500;
    const fadeTime = this.getParam(parameters.fadeTime, 0) ?? 10;
    const mode = Math.floor(this.getParam(parameters.mode, 0) || 0);

    this.samplesPerStep = this.calculateStepLength(bpm, division);
    const intensityAmount = intensity / 100;

    const blockSize = inputLeft.length;
    const outputLeft = output[0];
    const outputRight = output[1] || output[0];

    for (let i = 0; i < blockSize; i++) {
      // Write to circular buffer
      this.circularBuffer.left[this.circularBuffer.writeIndex] = inputLeft[i];
      this.circularBuffer.right[this.circularBuffer.writeIndex] = inputRight[i];
      this.circularBuffer.writeIndex = (this.circularBuffer.writeIndex + 1) % this.circularBuffer.size;

      // Step progression
      this.stepProgress++;
      if (this.stepProgress >= this.samplesPerStep) {
        this.stepProgress = 0;
        this.currentStep = (this.currentStep + 1) % this.pattern.length;
        this.stutterState.repeating = false; // Reset stutter on new step
      }

      // Check if current step is active
      const stepActive = this.pattern[this.currentStep] > 0;
      const randomChance = Math.random() * 100 < chance;
      const shouldProcess = stepActive && randomChance;

      let processedL = inputLeft[i];
      let processedR = inputRight[i];

      if (shouldProcess) {
        switch (mode) {
          case 0: // GATE
            processedL = this.processGate(inputLeft[i], true, fadeTime);
            processedR = this.processGate(inputRight[i], true, fadeTime);
            break;

          case 1: // STUTTER
            const stutter = this.processStutter(inputLeft[i], inputRight[i], bufferSize);
            processedL = stutter.left;
            processedR = stutter.right;
            break;

          case 2: // REPEAT (similar to stutter but longer)
            const repeat = this.processStutter(inputLeft[i], inputRight[i], bufferSize * 2);
            processedL = repeat.left;
            processedR = repeat.right;
            break;

          case 3: // REVERSE
            const reverse = this.processReverse(bufferSize);
            processedL = reverse.left;
            processedR = reverse.right;
            break;

          case 4: // GLITCH (random slice)
            if (Math.random() < 0.3) {
              const randomOffset = Math.floor(Math.random() * bufferSize * this.sampleRate / 1000);
              const readIdx = (this.circularBuffer.writeIndex - randomOffset + this.circularBuffer.size) % this.circularBuffer.size;
              processedL = this.circularBuffer.left[readIdx];
              processedR = this.circularBuffer.right[readIdx];
            }
            break;

          case 5: // TAPE STOP (not implemented in real-time, placeholder)
            processedL = inputLeft[i] * (this.stepProgress / this.samplesPerStep);
            processedR = inputRight[i] * (this.stepProgress / this.samplesPerStep);
            break;

          default:
            break;
        }

        // Apply intensity
        processedL = inputLeft[i] * (1 - intensityAmount) + processedL * intensityAmount;
        processedR = inputRight[i] * (1 - intensityAmount) + processedR * intensityAmount;
      } else {
        // Step not active, pass through or gate
        if (mode === 0) { // Gate mode mutes inactive steps
          processedL = this.processGate(inputLeft[i], false, fadeTime);
          processedR = this.processGate(inputRight[i], false, fadeTime);
        }
      }

      outputLeft[i] = processedL;
      outputRight[i] = processedR;
    }

    // Send current step to UI
    if (this.stepProgress === 0) {
      this.port.postMessage({
        type: 'currentStep',
        step: this.currentStep
      });
    }

    return true;
  }
}

registerProcessor('rhythm-fx-processor', RhythmFXProcessor);
