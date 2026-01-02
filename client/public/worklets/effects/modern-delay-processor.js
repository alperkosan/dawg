/**
 * MODERN DELAY PROCESSOR
 *
 * Multi-tap stereo delay with:
 * - Independent L/R delay lines
 * - Ping-pong cross-feedback
 * - Multi-mode filtering
 * - Tape-style saturation
 * - Diffusion (allpass)
 */

class ModernDelayProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'timeLeft', defaultValue: 0.375, minValue: 0.001, maxValue: 4 },
      { name: 'timeRight', defaultValue: 0.5, minValue: 0.001, maxValue: 4 },
      { name: 'feedbackLeft', defaultValue: 0.4, minValue: 0, maxValue: 1 },
      { name: 'feedbackRight', defaultValue: 0.4, minValue: 0, maxValue: 1 },
      { name: 'pingPong', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 0.35, minValue: 0, maxValue: 1 },
      { name: 'filterFreq', defaultValue: 8000, minValue: 100, maxValue: 20000 },
      { name: 'saturation', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'diffusion', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'wobble', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'flutter', defaultValue: 0, minValue: 0, maxValue: 1 },
      // ✅ NEW: Delay model (0=Digital, 1=Tape, 2=Analog, 3=BBD)
      { name: 'delayModel', defaultValue: 0, minValue: 0, maxValue: 3 },
      // ✅ NEW: Tempo sync (0=off, 1=on)
      { name: 'tempoSync', defaultValue: 0, minValue: 0, maxValue: 1 },
      // ✅ NEW: Note division (0=1/32, 1=1/16, 2=1/8, 3=1/4, 4=1/2, 5=1/1, 6=1/8., 7=1/4., 8=1/8t, 9=1/4t)
      { name: 'noteDivision', defaultValue: 3, minValue: 0, maxValue: 9 },
      // ✅ NEW: BPM (for tempo sync calculation)
      { name: 'bpm', defaultValue: 120, minValue: 60, maxValue: 200 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Delay buffers (4 seconds max)
    const maxDelay = this.sampleRate * 4;
    this.delayBufferLeft = new Float32Array(maxDelay);
    this.delayBufferRight = new Float32Array(maxDelay);
    this.writeIndex = 0;

    // Filter states (one-pole lowpass)
    this.filterStateLeft = 0;
    this.filterStateRight = 0;

    // Modulation states
    this.lfoPhase = 0;
    this.flutterPhase = 0;
    this.flutterTarget = 0;
    this.flutterCurrent = 0;

    // ✅ NEW: Delay model state
    this.delayModel = 0; // 0=Digital, 1=Tape, 2=Analog, 3=BBD
    this.tapePhase = 0; // For tape wow/flutter
    this.bbdNoise = 0; // For BBD noise simulation

    // 🎯 DLY-P1: Xorshift32 PRNG state (faster than Math.random)
    this.xorshiftState = 0x12345678 + (Date.now() & 0xFFFF);

    // Diffusion (allpass filters)
    const allpassSizes = [
      Math.floor(0.0073 * this.sampleRate),
      Math.floor(0.0113 * this.sampleRate),
      Math.floor(0.0079 * this.sampleRate),
      Math.floor(0.0119 * this.sampleRate)
    ];

    this.allpassFilters = allpassSizes.map(size => ({
      buffer: new Float32Array(size),
      index: 0,
      size: size
    }));

    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === 'updateSettings') {
        this.settings = { ...this.settings, ...data };
      } else if (type === 'bypass') {
        this.bypassed = data.bypassed;
      } else if (type === 'reset' || type === 'flush') {
        // Clear all delay buffers for clean stop
        this.delayBufferLeft.fill(0);
        this.delayBufferRight.fill(0);
        this.filterStateLeft = 0;
        this.filterStateRight = 0;
        this.allpassFilters.forEach(ap => ap.buffer.fill(0));
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input?.[0] || !output?.[0]) return true;

    const blockSize = input[0].length;

    // Get parameters
    const timeLeft = this.getParam(parameters.timeLeft, 0) ?? this.settings.timeLeft ?? 0.375;
    const timeRight = this.getParam(parameters.timeRight, 0) ?? this.settings.timeRight ?? 0.5;
    const feedbackLeft = this.getParam(parameters.feedbackLeft, 0) ?? this.settings.feedbackLeft ?? 0.4;
    const feedbackRight = this.getParam(parameters.feedbackRight, 0) ?? this.settings.feedbackRight ?? 0.4;
    const pingPong = this.getParam(parameters.pingPong, 0) ?? this.settings.pingPong ?? 0;
    const wet = this.getParam(parameters.wet, 0) ?? this.settings.wet ?? 0.35;
    const filterFreq = this.getParam(parameters.filterFreq, 0) ?? this.settings.filterFreq ?? 8000;
    const saturation = this.getParam(parameters.saturation, 0) ?? this.settings.saturation ?? 0;
    const diffusion = this.getParam(parameters.diffusion, 0) ?? this.settings.diffusion ?? 0;
    const wobble = this.getParam(parameters.wobble, 0) ?? this.settings.wobble ?? 0;
    const flutter = this.getParam(parameters.flutter, 0) ?? this.settings.flutter ?? 0;

    // ✅ NEW: Delay model and tempo sync parameters
    const delayModel = Math.floor(this.getParam(parameters.delayModel, 0) ?? this.settings.delayModel ?? 0);
    const tempoSync = this.getParam(parameters.tempoSync, 0) ?? this.settings.tempoSync ?? 0;
    const noteDivision = Math.floor(this.getParam(parameters.noteDivision, 0) ?? this.settings.noteDivision ?? 3);
    const bpm = this.getParam(parameters.bpm, 0) ?? this.settings.bpm ?? 120;

    this.delayModel = delayModel;

    if (this.bypassed) {
      output[0].set(input[0]);
      if (output[1] && input[1]) output[1].set(input[1]);
      return true;
    }

    // 🎯 PROFESSIONAL DELAY CALCULATIONS

    // ✅ NEW: Calculate delay time from tempo sync if enabled
    let effectiveTimeLeft = timeLeft;
    let effectiveTimeRight = timeRight;

    if (tempoSync > 0.5) {
      // Tempo sync mode: calculate delay time from BPM and note division
      const beatDuration = 60 / bpm; // One quarter note in seconds
      const noteDivisions = [
        beatDuration / 8,    // 1/32
        beatDuration / 4,    // 1/16
        beatDuration / 2,    // 1/8
        beatDuration,        // 1/4
        beatDuration * 2,    // 1/2
        beatDuration * 4,    // 1/1
        beatDuration * 0.75, // 1/8. (dotted)
        beatDuration * 1.5,  // 1/4. (dotted)
        beatDuration / 3,    // 1/8t (triplet)
        beatDuration * 2 / 3 // 1/4t (triplet)
      ];

      const syncTime = noteDivisions[noteDivision] || beatDuration;
      effectiveTimeLeft = syncTime;
      effectiveTimeRight = syncTime;
    }

    // Base delay samples
    const baseDelaySamplesLeft = effectiveTimeLeft * this.sampleRate;
    const baseDelaySamplesRight = effectiveTimeRight * this.sampleRate;

    // Professional filter coefficient: Pre-warped bilinear transform
    const omega = 2 * Math.PI * filterFreq / this.sampleRate;
    const filterCoeff = Math.exp(-omega);

    // 🎯 PROFESSIONAL PING-PONG: Variable cross-feedback (like Valhalla Delay)
    const straightFB = 1 - pingPong;
    const crossFB = pingPong * 0.9; // Increased for more pronounced ping-pong

    // LFO Parameters (Wobble)
    // Slow, drifting LFO: 0.5Hz - 3Hz
    const lfoFreq = 0.5 + wobble * 2.5;
    const lfoInc = (2 * Math.PI * lfoFreq) / this.sampleRate;
    // Depth: up to 5ms modulation
    const lfoDepth = wobble * 0.005 * this.sampleRate;

    // Random Parameters (Flutter)
    // Fast, erratic modulation
    const flutterSpeed = 0.002; // Rate of change for random target

    for (let i = 0; i < blockSize; i++) {
      const inputLeft = input[0][i];
      const inputRight = input[1]?.[i] ?? inputLeft;

      // 🎯 MODULATION CALCULATION

      // 1. Wobble (Sine LFO)
      this.lfoPhase += lfoInc;
      if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI;
      const wobbleMod = Math.sin(this.lfoPhase) * lfoDepth;

      // 2. Flutter (Smoothed Random Walk) - using xorshift for performance
      if (this.xorshift() < flutterSpeed) {
        this.flutterTarget = (this.xorshift() * 2 - 1) * flutter;
      }
      // Smooth approach to target
      this.flutterCurrent += (this.flutterTarget - this.flutterCurrent) * 0.01;
      // Depth: up to 2ms modulation
      const flutterMod = this.flutterCurrent * 0.002 * this.sampleRate;

      // Total Modulation
      const totalModLeft = wobbleMod + flutterMod;
      const totalModRight = -wobbleMod + flutterMod; // Invert wobble for stereo width

      // Calculate final delay times with modulation
      const modDelayLeft = baseDelaySamplesLeft + totalModLeft;
      const modDelayRight = baseDelaySamplesRight + totalModRight;

      // Store fractional parts for interpolation
      const delayIntLeft = Math.floor(modDelayLeft);
      const delayFracLeft = modDelayLeft - delayIntLeft;
      const delayIntRight = Math.floor(modDelayRight);
      const delayFracRight = modDelayRight - delayIntRight;

      // 🎯 FRACTIONAL DELAY INTERPOLATION: Cubic for smooth modulation
      // Read positions with fractional part
      const readIdxLeftBase = (this.writeIndex - delayIntLeft + this.delayBufferLeft.length) % this.delayBufferLeft.length;
      const readIdxRightBase = (this.writeIndex - delayIntRight + this.delayBufferRight.length) % this.delayBufferRight.length;

      // Cubic interpolation for smooth delay time changes
      let delayedLeft = this.cubicInterpolate(
        this.delayBufferLeft,
        readIdxLeftBase,
        delayFracLeft
      );
      let delayedRight = this.cubicInterpolate(
        this.delayBufferRight,
        readIdxRightBase,
        delayFracRight
      );

      // 🎯 PROFESSIONAL DIFFUSION: Variable feedback (like Eventide)
      if (diffusion > 0) {
        // Diffusion feedback: 0.3-0.6 range for natural sound
        const diffusionAmount = 0.3 + diffusion * 0.3;

        // Process left through first 2 allpass
        delayedLeft = this.processAllpass(delayedLeft, this.allpassFilters[0], diffusionAmount);
        delayedLeft = this.processAllpass(delayedLeft, this.allpassFilters[1], diffusionAmount);

        // Process right through last 2 allpass
        delayedRight = this.processAllpass(delayedRight, this.allpassFilters[2], diffusionAmount);
        delayedRight = this.processAllpass(delayedRight, this.allpassFilters[3], diffusionAmount);
      }

      // ✅ NEW: Apply delay model characteristics
      let modelProcessedLeft = delayedLeft;
      let modelProcessedRight = delayedRight;

      switch (delayModel) {
        case 1: // Tape
          // Tape characteristics: wow/flutter, saturation, high-frequency rolloff
          this.tapePhase += (2 * Math.PI * 0.5) / this.sampleRate; // 0.5 Hz wow
          if (this.tapePhase > Math.PI * 2) this.tapePhase -= Math.PI * 2;
          const tapeMod = Math.sin(this.tapePhase) * 0.001 * this.sampleRate; // 1ms modulation
          // Apply tape saturation
          modelProcessedLeft = Math.tanh(delayedLeft * 1.5) / Math.tanh(1.5);
          modelProcessedRight = Math.tanh(delayedRight * 1.5) / Math.tanh(1.5);
          // High-frequency rolloff (tape characteristic)
          const tapeFilterCoeff = Math.exp(-2 * Math.PI * 5000 / this.sampleRate);
          this.filterStateLeft = modelProcessedLeft + tapeFilterCoeff * (this.filterStateLeft - modelProcessedLeft);
          this.filterStateRight = modelProcessedRight + tapeFilterCoeff * (this.filterStateRight - modelProcessedRight);
          modelProcessedLeft = this.filterStateLeft;
          modelProcessedRight = this.filterStateRight;
          break;
        case 2: // Analog
          // Analog characteristics: warm saturation, slight filtering
          modelProcessedLeft = Math.tanh(delayedLeft * 1.2) / Math.tanh(1.2);
          modelProcessedRight = Math.tanh(delayedRight * 1.2) / Math.tanh(1.2);
          // Slight high-frequency rolloff
          const analogFilterCoeff = Math.exp(-2 * Math.PI * 8000 / this.sampleRate);
          this.filterStateLeft = modelProcessedLeft + analogFilterCoeff * (this.filterStateLeft - modelProcessedLeft);
          this.filterStateRight = modelProcessedRight + analogFilterCoeff * (this.filterStateRight - modelProcessedRight);
          modelProcessedLeft = this.filterStateLeft;
          modelProcessedRight = this.filterStateRight;
          break;
        case 3: // BBD (Bucket Brigade Delay)
          // BBD characteristics: noise, slight filtering, non-linear response
          this.bbdNoise = (this.xorshift() * 2 - 1) * 0.0001; // Small noise
          modelProcessedLeft = delayedLeft + this.bbdNoise;
          modelProcessedRight = delayedRight + this.bbdNoise;
          // BBD has limited bandwidth
          const bbdFilterCoeff = Math.exp(-2 * Math.PI * 6000 / this.sampleRate);
          this.filterStateLeft = modelProcessedLeft + bbdFilterCoeff * (this.filterStateLeft - modelProcessedLeft);
          this.filterStateRight = modelProcessedRight + bbdFilterCoeff * (this.filterStateRight - modelProcessedRight);
          modelProcessedLeft = this.filterStateLeft;
          modelProcessedRight = this.filterStateRight;
          break;
        default: // Digital (0)
          // Digital: clean, no processing
          this.filterStateLeft = delayedLeft + filterCoeff * (this.filterStateLeft - delayedLeft);
          this.filterStateRight = delayedRight + filterCoeff * (this.filterStateRight - delayedRight);
          modelProcessedLeft = this.filterStateLeft;
          modelProcessedRight = this.filterStateRight;
          break;
      }

      let filteredLeft = modelProcessedLeft;
      let filteredRight = modelProcessedRight;

      // 🎯 FIX: Saturation ONLY on output, NOT in feedback loop (prevents runaway feedback)
      // Saturation in feedback loop causes infinite buildup and crackling
      let saturatedLeft = filteredLeft;
      let saturatedRight = filteredRight;

      if (saturation > 0) {
        const drive = 1 + saturation * 30; // Reduced drive range for stability
        saturatedLeft = Math.tanh(filteredLeft * drive) / Math.tanh(drive);
        saturatedRight = Math.tanh(filteredRight * drive) / Math.tanh(drive);
      }

      // 🎯 FIX: Feedback loop with safety limiting (prevents infinite feedback)
      // Calculate feedback signals with soft limiting
      let fbLeft = filteredLeft * feedbackLeft * straightFB + filteredRight * feedbackRight * crossFB;
      let fbRight = filteredRight * feedbackRight * straightFB + filteredLeft * feedbackLeft * crossFB;

      // 🎯 SAFETY LIMITER: Prevent feedback from exceeding 0.95 (prevents runaway)
      const maxFeedbackLevel = 0.95;
      fbLeft = Math.max(-maxFeedbackLevel, Math.min(maxFeedbackLevel, fbLeft));
      fbRight = Math.max(-maxFeedbackLevel, Math.min(maxFeedbackLevel, fbRight));

      // Write to delay buffers with feedback (NO saturation in feedback path)
      this.delayBufferLeft[this.writeIndex] = inputLeft + fbLeft;
      this.delayBufferRight[this.writeIndex] = inputRight + fbRight;

      this.writeIndex = (this.writeIndex + 1) % this.delayBufferLeft.length;

      // Mix dry and wet (use saturated version for output only)
      output[0][i] = inputLeft * (1 - wet) + saturatedLeft * wet;
      if (output[1]) {
        output[1][i] = inputRight * (1 - wet) + saturatedRight * wet;
      }
    }

    return true;
  }

  processAllpass(input, allpass, feedback) {
    const delayed = allpass.buffer[allpass.index];
    allpass.buffer[allpass.index] = input + delayed * feedback;
    const output = delayed - input * feedback;
    allpass.index = (allpass.index + 1) % allpass.size;
    return output;
  }

  // 🎯 CUBIC INTERPOLATION: Smooth fractional delay (industry standard)
  cubicInterpolate(buffer, baseIdx, frac) {
    const len = buffer.length;
    const idx0 = (baseIdx - 1 + len) % len;
    const idx1 = baseIdx;
    const idx2 = (baseIdx + 1) % len;
    const idx3 = (baseIdx + 2) % len;

    const y0 = buffer[idx0];
    const y1 = buffer[idx1];
    const y2 = buffer[idx2];
    const y3 = buffer[idx3];

    // Catmull-Rom spline interpolation
    const c0 = y1;
    const c1 = 0.5 * (y2 - y0);
    const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

    return c0 + c1 * frac + c2 * frac * frac + c3 * frac * frac * frac;
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  // 🎯 DLY-P1: Xorshift32 PRNG (faster than Math.random)
  // Returns value in [0, 1) range
  xorshift() {
    let x = this.xorshiftState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.xorshiftState = x >>> 0; // Ensure unsigned
    return (this.xorshiftState & 0x7FFFFFFF) / 0x80000000;
  }
}

registerProcessor('modern-delay-processor', ModernDelayProcessor);
