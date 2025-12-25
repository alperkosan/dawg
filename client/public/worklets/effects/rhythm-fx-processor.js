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
      { name: 'bpm', defaultValue: 128, minValue: 60, maxValue: 200 },
      { name: 'tempoSync', defaultValue: 0, minValue: 0, maxValue: 1 }, // 0=off, 1=on
      { name: 'noteDivision', defaultValue: 0.25, minValue: 0.01, maxValue: 4 } // e.g., 0.25 for 1/16, 1 for 1/4
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

    // Step-based buffer capture (for reverse, stutter, repeat)
    this.stepBuffer = {
      left: new Float32Array(0),
      right: new Float32Array(0),
      length: 0,
      readIndex: 0,
      isActive: false,
      mode: -1
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
        case 'parameters':
          // Handle batched parameter updates from ParameterBatcher
          if (e.data.parameters) {
            Object.assign(this.settings, e.data.parameters);
          }
          break;
        case 'bypass':
          this.bypassed = data.value;
          break;
        default:
          break;
      }
    };
  }

  getParam(param, index, paramName = null) {
    if (param && param.length > 0) {
      return param.length > 1 ? param[index] : param[0];
    }
    if (paramName && this.settings && this.settings[paramName] !== undefined) {
      return this.settings[paramName];
    }
    return undefined;
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
  // ✅ FIX: Align with transport system's step timing (16th note = 1 step)
  calculateStepLength(bpm, division, tempoSync, noteDivision) {
    if (tempoSync > 0.5) {
      // Tempo sync mode: use note division
      const beatDuration = 60 / bpm; // Duration of one beat in seconds
      const noteDuration = beatDuration * noteDivision; // Duration of the selected note division
      return Math.floor(this.sampleRate * noteDuration);
    } else {
      // Manual division mode
      // ✅ FIX: Align with transport system (16th note = 1 step, 4 steps per beat)
      // Transport system uses: stepsPerBar = 16, stepsPerBeat = 4
      // Division parameter: 16 = 1 step, 8 = 2 steps, 4 = 4 steps, etc.
      const beatsPerSecond = bpm / 60;
      const stepsPerBeat = 4; // ✅ FIX: Always 4 steps per beat (16th note resolution)
      const stepsPerSecond = beatsPerSecond * stepsPerBeat;
      // Division is used to subdivide steps: division=16 means 1 step, division=8 means 2 steps, etc.
      const stepSubdivision = 16 / division; // How many RhythmFX steps per transport step
      const rhythmFXStepsPerSecond = stepsPerSecond * stepSubdivision;
      return Math.floor(this.sampleRate / rhythmFXStepsPerSecond);
    }
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

  // Capture buffer for current step (for reverse, stutter, repeat)
  captureStepBuffer(bufferSizeMs) {
    const bufferSizeSamples = Math.floor((bufferSizeMs / 1000) * this.sampleRate);
    const maxSamples = Math.min(bufferSizeSamples, this.circularBuffer.size);
    
    // Resize buffer if needed
    if (this.stepBuffer.left.length < maxSamples) {
      this.stepBuffer.left = new Float32Array(maxSamples);
      this.stepBuffer.right = new Float32Array(maxSamples);
    }
    
    this.stepBuffer.length = maxSamples;
    
    // Capture buffer from circular buffer (most recent samples)
    for (let i = 0; i < maxSamples; i++) {
      const readIdx = (this.circularBuffer.writeIndex - maxSamples + i + this.circularBuffer.size) % this.circularBuffer.size;
      this.stepBuffer.left[i] = this.circularBuffer.left[readIdx];
      this.stepBuffer.right[i] = this.circularBuffer.right[readIdx];
    }
    
    this.stepBuffer.readIndex = 0;
    this.stepBuffer.isActive = true;
  }

  // Reverse effect - read from captured buffer in reverse order
  processReverse() {
    if (!this.stepBuffer.isActive || this.stepBuffer.length === 0) {
      return { left: 0, right: 0 };
    }
    
    // Read from buffer in reverse order
    // readIndex starts at 0, so we read from end backwards
    const reverseIndex = this.stepBuffer.length - 1 - this.stepBuffer.readIndex;
    const outL = this.stepBuffer.left[reverseIndex];
    const outR = this.stepBuffer.right[reverseIndex];
    
    // Advance read index
    this.stepBuffer.readIndex++;
    
    // If we've read the entire buffer, loop back to start (for longer steps)
    if (this.stepBuffer.readIndex >= this.stepBuffer.length) {
      this.stepBuffer.readIndex = 0;
    }
    
    return { left: outL, right: outR };
  }
  
  // Stutter/Repeat effect - read from captured buffer in forward order
  processStutterFromBuffer() {
    if (!this.stepBuffer.isActive || this.stepBuffer.length === 0) {
      return { left: 0, right: 0 };
    }
    
    const outL = this.stepBuffer.left[this.stepBuffer.readIndex];
    const outR = this.stepBuffer.right[this.stepBuffer.readIndex];
    
    // Advance read index (wraps around for looping)
    this.stepBuffer.readIndex = (this.stepBuffer.readIndex + 1) % this.stepBuffer.length;
    
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

    const bpm = this.getParam(parameters.bpm, 0, 'bpm') ?? 128;
    const division = this.getParam(parameters.division, 0, 'division') ?? 16;
    const chance = this.getParam(parameters.chance, 0, 'chance') ?? 100;
    const intensity = this.getParam(parameters.intensity, 0, 'intensity') ?? 100;
    const swing = this.getParam(parameters.swing, 0, 'swing') ?? 50;
    const bufferSize = this.getParam(parameters.bufferSize, 0, 'bufferSize') ?? 500;
    const fadeTime = this.getParam(parameters.fadeTime, 0, 'fadeTime') ?? 10;
    const glitchAmount = this.getParam(parameters.glitchAmount, 0, 'glitchAmount') ?? 50;
    const tapeSpeed = this.getParam(parameters.tapeSpeed, 0, 'tapeSpeed') ?? 100;
    const mode = Math.floor(this.getParam(parameters.mode, 0, 'mode') || 0);
    const tempoSync = this.getParam(parameters.tempoSync, 0, 'tempoSync') ?? 0;
    const noteDivision = this.getParam(parameters.noteDivision, 0, 'noteDivision') ?? 0.25;

    this.samplesPerStep = this.calculateStepLength(bpm, division, tempoSync, noteDivision);
    const intensityAmount = intensity / 100;

    const blockSize = inputLeft.length;
    const outputLeft = output[0];
    const outputRight = output[1] || output[0];

    for (let i = 0; i < blockSize; i++) {
      // Write to circular buffer
      this.circularBuffer.left[this.circularBuffer.writeIndex] = inputLeft[i];
      this.circularBuffer.right[this.circularBuffer.writeIndex] = inputRight[i];
      this.circularBuffer.writeIndex = (this.circularBuffer.writeIndex + 1) % this.circularBuffer.size;

      // Check if current step is active (before step progression)
      const stepActive = this.pattern[this.currentStep] > 0;
      
      // Step progression
      const wasNewStep = this.stepProgress === 0;
      this.stepProgress++;
      if (this.stepProgress >= this.samplesPerStep) {
        this.stepProgress = 0;
        this.currentStep = (this.currentStep + 1) % this.pattern.length;
        this.stutterState.repeating = false; // Reset stutter on new step
        this.stepBuffer.isActive = false; // Reset step buffer on new step
        this.stepBuffer.readIndex = 0; // Reset read index
      }
      
      // Capture buffer at the START of an active step
      // We capture immediately when step becomes active to get the most recent audio
      if (wasNewStep && stepActive && (mode === 1 || mode === 2 || mode === 3)) {
        const captureSize = mode === 2 ? bufferSize * 2 : bufferSize;
        // Capture buffer immediately - circular buffer already has enough data
        // because we write to it before processing
        this.captureStepBuffer(captureSize);
        this.stepBuffer.mode = mode;
      }

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

          case 1: // STUTTER - use captured buffer
            if (this.stepBuffer.isActive && this.stepBuffer.mode === 1) {
              const stutter = this.processStutterFromBuffer();
              processedL = stutter.left;
              processedR = stutter.right;
            } else {
              // Fallback to old method if buffer not ready
              const stutter = this.processStutter(inputLeft[i], inputRight[i], bufferSize);
              processedL = stutter.left;
              processedR = stutter.right;
            }
            break;

          case 2: // REPEAT - use captured buffer (longer)
            if (this.stepBuffer.isActive && this.stepBuffer.mode === 2) {
              const repeat = this.processStutterFromBuffer();
              processedL = repeat.left;
              processedR = repeat.right;
            } else {
              // Fallback to old method if buffer not ready
              const repeat = this.processStutter(inputLeft[i], inputRight[i], bufferSize * 2);
              processedL = repeat.left;
              processedR = repeat.right;
            }
            break;

          case 3: // REVERSE - use captured buffer in reverse order
            if (this.stepBuffer.isActive && this.stepBuffer.mode === 3) {
              const reverse = this.processReverse();
              processedL = reverse.left;
              processedR = reverse.right;
            } else {
              // Fallback: read from circular buffer backwards
              const bufferSizeSamples = Math.floor((bufferSize / 1000) * this.sampleRate);
              const readIdx = (this.circularBuffer.writeIndex - bufferSizeSamples + this.circularBuffer.size) % this.circularBuffer.size;
              processedL = this.circularBuffer.left[readIdx];
              processedR = this.circularBuffer.right[readIdx];
            }
            break;

          case 4: // GLITCH (random slice)
            // Use glitchAmount as probability (0-100% -> 0.0-1.0)
            const glitchProbability = glitchAmount / 100;
            if (Math.random() < glitchProbability) {
              const randomOffset = Math.floor(Math.random() * bufferSize * this.sampleRate / 1000);
              const readIdx = (this.circularBuffer.writeIndex - randomOffset + this.circularBuffer.size) % this.circularBuffer.size;
              processedL = this.circularBuffer.left[readIdx];
              processedR = this.circularBuffer.right[readIdx];
            }
            break;

          case 5: // TAPE STOP (speed-based fade)
            // Use tapeSpeed to control playback rate (100% = normal, 0% = stopped)
            const speedRatio = tapeSpeed / 100;
            const progressRatio = this.stepProgress / this.samplesPerStep;
            // Apply speed-based fade: faster speed = less fade, slower speed = more fade
            const fadeAmount = 1 - (progressRatio * (1 - speedRatio));
            processedL = inputLeft[i] * fadeAmount;
            processedR = inputRight[i] * fadeAmount;
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
