/**
 * VortexPhaser Processor v2.0
 * Professional phaser with multiple all-pass stages
 *
 * Features:
 * - Adjustable stage count (2-12 stages)
 * - Stereo phase offset for wide imaging
 * - Smooth LFO modulation
 * - Feedback control for resonance
 */

class VortexPhaserProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 0.5, minValue: 0.01, maxValue: 10 },
      { name: 'depth', defaultValue: 0.7, minValue: 0, maxValue: 1 },
      { name: 'stages', defaultValue: 4, minValue: 2, maxValue: 12 },
      { name: 'feedback', defaultValue: 0.5, minValue: 0, maxValue: 0.95 },
      { name: 'stereoPhase', defaultValue: 90, minValue: 0, maxValue: 180 },
      { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'VortexPhaser';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // ✅ DEBUG: Log initialization
    console.log('🌀 VortexPhaser constructor called', {
      sampleRate: this.sampleRate,
      effectType: this.effectType,
      settings: this.settings
    });

    // Per-channel state
    this.channelState = [
      {
        lfoPhase: 0,
        allpassStates: Array(12).fill(0).map(() => ({ x1: 0, y1: 0 })),
        feedbackSample: 0
      },
      {
        lfoPhase: Math.PI / 2, // 90 degree offset for stereo
        allpassStates: Array(12).fill(0).map(() => ({ x1: 0, y1: 0 })),
        feedbackSample: 0
      }
    ];

    // ✅ DEBUG: Track process calls
    this.processCallCount = 0;
    this.errorCount = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === 'updateSettings') {
        Object.assign(this.settings, e.data.data);
      } else if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      }
    };

    console.log('✅ VortexPhaser initialized successfully');
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  // First-order all-pass filter (corrected formula)
  // Standard all-pass: H(z) = (a + z^-1) / (1 + a*z^-1)
  processAllpass(sample, state, coefficient) {
    // ✅ SAFETY: Reset state if corrupted
    if (!isFinite(state.x1)) state.x1 = 0;
    if (!isFinite(state.y1)) state.y1 = 0;

    // Standard all-pass filter difference equation
    // y[n] = -a*x[n] + x[n-1] + a*y[n-1]
    const output = coefficient * (sample - state.y1) + state.x1;

    // Update state variables
    state.x1 = sample;
    state.y1 = output;

    // ✅ SAFETY: Clamp output to reasonable range
    if (!isFinite(output) || Math.abs(output) > 10) {
      state.x1 = 0;
      state.y1 = 0;
      return 0;
    }

    return output;
  }

  processEffect(sample, channel, parameters) {
    try {
      // ✅ FIX: Parameters are per-block, not per-sample. Always use index 0.
      const rate = this.getParam(parameters.rate, 0) || 0.5;
      const depth = this.getParam(parameters.depth, 0) || 0.7;
      const stages = Math.floor(this.getParam(parameters.stages, 0) || 4);
      const feedback = Math.min(0.95, this.getParam(parameters.feedback, 0) || 0.5); // ✅ Clamp feedback
      const stereoPhase = this.getParam(parameters.stereoPhase, 0) || 90;

    const state = this.channelState[channel];

    // ✅ DEBUG: Log parameters for first sample of first channel
    if (!this._paramsLogged && channel === 0) {
      console.log('🔍 VortexPhaser params:', { rate, depth, stages, feedback, stereoPhase });
      console.log('🔍 Raw parameters:', {
        rate: parameters.rate,
        depth: parameters.depth,
        stages: parameters.stages
      });
      console.log('🔍 State initialized:', {
        hasState: !!state,
        allpassStatesCount: state?.allpassStates?.length,
        lfoPhase: state?.lfoPhase,
        feedbackSample: state?.feedbackSample
      });
      this._paramsLogged = true;
    }

    // ✅ SAFETY: Check state exists
    if (!state) {
      console.error('❌ No state for channel:', channel);
      return sample;
    }

    // Apply stereo phase offset
    const phaseOffset = channel === 1 ? (stereoPhase / 180) * Math.PI : 0;

    // Update LFO
    const lfoIncrement = (rate / this.sampleRate) * 2 * Math.PI;
    state.lfoPhase += lfoIncrement;
    if (state.lfoPhase > 2 * Math.PI) {
      state.lfoPhase -= 2 * Math.PI;
    }

    // Calculate modulated frequency (200 Hz to 2000 Hz)
    const lfoValue = (Math.sin(state.lfoPhase + phaseOffset) + 1) / 2; // 0 to 1
    const minFreq = 200;
    const maxFreq = 2000;
    const modulatedFreq = minFreq + (maxFreq - minFreq) * lfoValue * depth;

    // Calculate all-pass coefficient
    const wc = 2 * Math.PI * modulatedFreq / this.sampleRate;
    // ✅ SAFETY: Clamp wc to prevent tan(π/2) = ∞
    const clampedWc = Math.min(wc / 2, Math.PI / 2 - 0.01);
    const tanHalfWc = Math.tan(clampedWc);
    const apCoeff = (tanHalfWc - 1) / (tanHalfWc + 1);

    // ✅ DEBUG: Log coefficient calculation once
    if (!this._coeffLogged && channel === 0) {
      console.log('🔍 All-pass coefficient calc:', {
        modulatedFreq,
        wc,
        clampedWc,
        tanHalfWc,
        apCoeff
      });
      this._coeffLogged = true;
    }

    // ✅ SAFETY: Validate coefficient
    if (!isFinite(apCoeff)) {
      console.error('❌ Invalid apCoeff:', apCoeff);
      return sample;
    }

    // Add feedback with safety check
    let processed = sample + state.feedbackSample * feedback;

    // ✅ SAFETY: Clamp feedback to prevent explosion
    if (!isFinite(processed)) {
      state.feedbackSample = 0;
      return sample;
    }

    // Process through all-pass stages
    for (let i = 0; i < Math.min(stages, 12); i++) {
      const before = processed;
      processed = this.processAllpass(processed, state.allpassStates[i], apCoeff);

      // ✅ DEBUG: Log first stage processing once
      if (!this._stageLogged && channel === 0 && i === 0) {
        console.log('🔍 First all-pass stage:', {
          inputSample: before,
          outputSample: processed,
          stateX1: state.allpassStates[i].x1,
          stateY1: state.allpassStates[i].y1,
          apCoeff
        });
        this._stageLogged = true;
      }

      // ✅ SAFETY: Check for NaN/Infinity after each stage
      if (!isFinite(processed)) {
        console.error('❌ Invalid output at stage', i, ':', processed, 'input was:', before);
        // Reset state and bail out
        state.feedbackSample = 0;
        state.allpassStates[i] = { x1: 0, y1: 0 };
        return sample;
      }
    }

      // Store for feedback
      state.feedbackSample = processed;

      return processed;
    } catch (error) {
      // ✅ CRITICAL ERROR IN processEffect
      console.error('❌ VortexPhaser processEffect error:', error);
      console.error('Sample:', sample, 'Channel:', channel);
      return sample; // Bypass on error
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // ✅ DEBUG: Log first few process calls
    if (this.processCallCount < 3) {
      console.log(`🌀 VortexPhaser process call #${this.processCallCount}`, {
        hasInput: !!input,
        inputChannels: input?.length,
        hasOutput: !!output,
        outputChannels: output?.length,
        inputBufferLength: input?.[0]?.length,
        outputBufferLength: output?.[0]?.length,
        bypassed: this.bypassed,
        parameters: {
          rate: parameters.rate?.[0],
          depth: parameters.depth?.[0],
          wet: parameters.wet?.[0]
        }
      });
    }
    this.processCallCount++;

    // ✅ SAFETY: Check for valid input/output
    if (!input || !input.length || !output || !output.length) {
      if (this.processCallCount <= 3) {
        console.warn('⚠️ VortexPhaser: No valid input/output');
      }
      return true;
    }

    // ✅ TEMPORARY DEBUG: Force bypass to test if processing is the issue
    const FORCE_BYPASS = false; // DSP is the issue, now debugging

    // ✅ BYPASS: Pass through if bypassed
    if (this.bypassed || FORCE_BYPASS) {
      for (let channel = 0; channel < output.length; channel++) {
        if (input[channel] && output[channel]) {
          output[channel].set(input[channel]);
        } else if (output[channel]) {
          output[channel].fill(0);
        }
      }
      return true;
    }

    try {
      const wetParam = this.getParam(parameters.wet, 0);
      const wet = wetParam !== undefined ? wetParam :
                  (this.settings.wet !== undefined ? this.settings.wet : 0.5);
      const dry = 1 - wet;

      // ✅ SAFETY: Process only available channels
      const numChannels = Math.min(input.length, output.length, this.channelState.length);

      for (let channel = 0; channel < numChannels; channel++) {
        const inputChannel = input[channel];
        const outputChannel = output[channel];

        // ✅ SAFETY: Check channel existence
        if (!inputChannel || !outputChannel) continue;

        let nanCount = 0;
        let processedCount = 0;

        for (let i = 0; i < inputChannel.length; i++) {
          const inputSample = inputChannel[i];

          // ✅ SAFETY: Validate input sample
          if (!isFinite(inputSample)) {
            outputChannel[i] = 0;
            continue;
          }

          // ✅ FIX: Don't pass sample index, parameters are per-block
          const processedSample = this.processEffect(inputSample, channel, parameters);

          // ✅ SAFETY: Validate processed sample
          if (isFinite(processedSample)) {
            outputChannel[i] = dry * inputSample + wet * processedSample;
            processedCount++;
          } else {
            // Fallback to dry signal if processing fails
            outputChannel[i] = inputSample;
            nanCount++;
          }
        }

        // ✅ DEBUG: Log first block's stats
        if (this.processCallCount === 1 && channel === 0) {
          // Find max input sample
          let maxInput = 0;
          let maxOutput = 0;
          for (let i = 0; i < inputChannel.length; i++) {
            maxInput = Math.max(maxInput, Math.abs(inputChannel[i]));
            maxOutput = Math.max(maxOutput, Math.abs(outputChannel[i]));
          }
          console.log('🔍 First block stats:', {
            wet, dry,
            processedCount,
            nanCount,
            firstInput: inputChannel[0],
            firstOutput: outputChannel[0],
            maxInput,
            maxOutput
          });
        }
      }
    } catch (error) {
      // ✅ ERROR HANDLING: Bypass on error
      this.errorCount++;
      console.error(`❌ VortexPhaser error #${this.errorCount}:`, error);
      console.error('Stack:', error.stack);
      console.error('Input:', input?.length, 'Output:', output?.length);

      // Passthrough on error
      for (let channel = 0; channel < Math.min(input.length, output.length); channel++) {
        if (input[channel] && output[channel]) {
          output[channel].set(input[channel]);
        }
      }

      // Stop processing after too many errors
      if (this.errorCount > 10) {
        console.error('❌ VortexPhaser: Too many errors, entering permanent bypass');
        this.bypassed = true;
      }
    }

    return true;
  }
}

registerProcessor('vortex-phaser-processor', VortexPhaserProcessor);
