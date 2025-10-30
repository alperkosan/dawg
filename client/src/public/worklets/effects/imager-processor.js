/**
 * MULTIBAND IMAGER PROCESSOR V3.0
 *
 * Professional multiband stereo imaging
 * 
 * Features:
 * - 4-band frequency-specific stereo width control
 * - Linkwitz-Riley crossover filters
 * - Per-band solo/mute
 * - Stereoize (mono-to-stereo conversion)
 * - Real-time correlation metering
 */

class ImagerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // Band frequencies (crossover points)
      { name: 'band1Freq', defaultValue: 100, minValue: 20, maxValue: 200 },
      { name: 'band2Freq', defaultValue: 600, minValue: 200, maxValue: 1000 },
      { name: 'band3Freq', defaultValue: 3000, minValue: 1000, maxValue: 6000 },
      { name: 'band4Freq', defaultValue: 6000, minValue: 3000, maxValue: 20000 },
      
      // Band widths
      { name: 'band1Width', defaultValue: 0, minValue: -100, maxValue: 100 },
      { name: 'band2Width', defaultValue: 0, minValue: -100, maxValue: 100 },
      { name: 'band3Width', defaultValue: 0, minValue: -100, maxValue: 100 },
      { name: 'band4Width', defaultValue: 0, minValue: -100, maxValue: 100 },
      
      // Band mutes
      { name: 'band1Mute', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'band2Mute', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'band3Mute', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'band4Mute', defaultValue: 0, minValue: 0, maxValue: 1 },
      
      // Band solos
      { name: 'band1Solo', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'band2Solo', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'band3Solo', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'band4Solo', defaultValue: 0, minValue: 0, maxValue: 1 },
      
      // Global controls
      { name: 'stereoize', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'globalWidth', defaultValue: 1.0, minValue: 0, maxValue: 2 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;

    // Crossover filter states (Linkwitz-Riley 4th order = 2 cascaded 2nd order)
    this.crossoverState = [
      // Channel 0 (Left)
      {
        band1LP: [{ x1: 0, x2: 0, y1: 0, y2: 0 }, { x1: 0, x2: 0, y1: 0, y2: 0 }], // 2-stage LPF
        band2BP: [{ x1: 0, x2: 0, y1: 0, y2: 0 }, { x1: 0, x2: 0, y1: 0, y2: 0 }], // HPF + LPF
        band3BP: [{ x1: 0, x2: 0, y1: 0, y2: 0 }, { x1: 0, x2: 0, y1: 0, y2: 0 }],
        band4HP: [{ x1: 0, x2: 0, y1: 0, y2: 0 }, { x1: 0, x2: 0, y1: 0, y2: 0 }] // 2-stage HPF
      },
      // Channel 1 (Right)
      {
        band1LP: [{ x1: 0, x2: 0, y1: 0, y2: 0 }, { x1: 0, x2: 0, y1: 0, y2: 0 }],
        band2BP: [{ x1: 0, x2: 0, y1: 0, y2: 0 }, { x1: 0, x2: 0, y1: 0, y2: 0 }],
        band3BP: [{ x1: 0, x2: 0, y1: 0, y2: 0 }, { x1: 0, x2: 0, y1: 0, y2: 0 }],
        band4HP: [{ x1: 0, x2: 0, y1: 0, y2: 0 }, { x1: 0, x2: 0, y1: 0, y2: 0 }]
      }
    ];

    // Correlation metering
    this.sumLR = 0;
    this.sumL2 = 0;
    this.sumR2 = 0;
    this.blockCount = 0;

    // Cached filter coefficients
    this.cachedCoeffs = {
      band1: null,
      band2: null,
      band3: null,
      band4: null
    };

    // Parameter storage for message-based updates
    this.messageParams = {};

    this.port.onmessage = (e) => {
      if (e.data?.type === 'setParameters') {
        // Store parameters for use in process()
        Object.assign(this.messageParams, e.data.data);
        console.log('🎛️ Imager processor received params:', this.messageParams);
      }
    };
  }

  /**
   * Linkwitz-Riley 2nd order low-pass filter
   */
  processLR2LP(sample, filter, freq) {
    const w0 = 2 * Math.PI * freq / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / 2; // Q = 0.5 for Butterworth

    const b0 = (1 - cosw0) / 2;
    const b1 = 1 - cosw0;
    const b2 = (1 - cosw0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;

    const y = (b0 / a0) * sample +
              (b1 / a0) * filter.x1 +
              (b2 / a0) * filter.x2 -
              (a1 / a0) * filter.y1 -
              (a2 / a0) * filter.y2;

    filter.x2 = filter.x1;
    filter.x1 = sample;
    filter.y2 = filter.y1;
    filter.y1 = y;

    return y;
  }

  /**
   * Linkwitz-Riley 2nd order high-pass filter
   */
  processLR2HP(sample, filter, freq) {
    const w0 = 2 * Math.PI * freq / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / 2;

    const b0 = (1 + cosw0) / 2;
    const b1 = -(1 + cosw0);
    const b2 = (1 + cosw0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;

    const y = (b0 / a0) * sample +
              (b1 / a0) * filter.x1 +
              (b2 / a0) * filter.x2 -
              (a1 / a0) * filter.y1 -
              (a2 / a0) * filter.y2;

    filter.x2 = filter.x1;
    filter.x1 = sample;
    filter.y2 = filter.y1;
    filter.y1 = y;

    return y;
  }

  /**
   * Split signal into frequency bands using Linkwitz-Riley crossovers
   */
  splitIntoBands(left, right, band1Freq, band2Freq, band3Freq, channel) {
    const state = this.crossoverState[channel];

    // Update filter coefficients if frequencies changed
    if (!this.cachedCoeffs.band1 || this.cachedCoeffs.band1.freq !== band1Freq) {
      this.cachedCoeffs.band1 = { freq: band1Freq };
    }
    if (!this.cachedCoeffs.band2 || this.cachedCoeffs.band2.freq !== band2Freq) {
      this.cachedCoeffs.band2 = { freq: band2Freq };
    }
    if (!this.cachedCoeffs.band3 || this.cachedCoeffs.band3.freq !== band3Freq) {
      this.cachedCoeffs.band3 = { freq: band3Freq };
    }

    // Band 1: Low (0 - band1Freq)
    // 4th order LPF = 2 cascaded 2nd order LPFs
    let band1 = this.processLR2LP(left, state.band1LP[0], band1Freq);
    band1 = this.processLR2LP(band1, state.band1LP[1], band1Freq);

    // Band 2: Low-Mid (band1Freq - band2Freq)
    // HPF @ band1Freq + LPF @ band2Freq
    let band2 = this.processLR2HP(left, state.band2BP[0], band1Freq);
    band2 = this.processLR2LP(band2, state.band2BP[1], band2Freq);

    // Band 3: High-Mid (band2Freq - band3Freq)
    let band3 = this.processLR2HP(left, state.band3BP[0], band2Freq);
    band3 = this.processLR2LP(band3, state.band3BP[1], band3Freq);

    // Band 4: High (band3Freq - 20kHz)
    // 4th order HPF = 2 cascaded 2nd order HPFs
    let band4 = this.processLR2HP(left, state.band4HP[0], band3Freq);
    band4 = this.processLR2HP(band4, state.band4HP[1], band3Freq);

    return { band1, band2, band3, band4 };
  }

  /**
   * Apply stereo width to a mono signal (for stereoize)
   */
  applyStereoize(sample, width) {
    if (width <= 0.01) return { left: sample, right: sample };

    // Convert mono to stereo with width
    const mid = sample;
    const side = sample * width * 0.5; // Create stereo from mono

    return {
      left: mid + side,
      right: mid - side
    };
  }

  /**
   * Apply stereo width processing
   */
  processWidth(left, right, width) {
    if (Math.abs(width) < 0.01) {
      return { left, right };
    }

    // Encode to Mid/Side
    let mid = (left + right) * 0.5;
    let side = (left - right) * 0.5;

    // Width: -100 to +100, map to 0-2 range
    const widthFactor = (width / 100) + 1.0; // -100 -> 0, 0 -> 1, 100 -> 2

    if (widthFactor <= 1.0) {
      // Narrow to mono
      side = side * widthFactor;
    } else {
      // Widen
      const widenFactor = widthFactor - 1.0; // 0-1 range
      mid = mid * (1 - widenFactor * 0.25);
      side = side * (1 + widenFactor * 0.8);
    }

    // Decode back to L/R
    return {
      left: mid + side,
      right: mid - side
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length) {
      return true;
    }

    // Ensure stereo
    if (input.length < 2 || output.length < 2) {
      // Mono input - duplicate
      for (let i = 0; i < input[0].length; i++) {
        output[0][i] = input[0][i];
        output[1][i] = input[0][i];
      }
      return true;
    }

    const leftInput = input[0];
    const rightInput = input[1];
    const leftOutput = output[0];
    const rightOutput = output[1];

    // Get parameters (prefer message params, fallback to automation)
    const getParam = (paramName, defaultValue) => {
      if (this.messageParams[paramName] !== undefined) {
        return this.messageParams[paramName];
      }
      const param = parameters[paramName];
      if (!param) return defaultValue;
      return param.length > 1 ? param[0] : param[0];
    };

    const band1Freq = getParam('band1Freq', 100);
    const band2Freq = getParam('band2Freq', 600);
    const band3Freq = getParam('band3Freq', 3000);

    const stereoize = getParam('stereoize', 0);
    const globalWidth = getParam('globalWidth', 1.0);
    const wet = getParam('wet', 1.0);

    // Reset correlation meters
    this.sumLR = 0;
    this.sumL2 = 0;
    this.sumR2 = 0;

    // Check solo state
    const soloStates = [
      getParam('band1Solo', 0),
      getParam('band2Solo', 0),
      getParam('band3Solo', 0),
      getParam('band4Solo', 0)
    ];

    const hasSolo = soloStates.some(s => s >= 0.5);

    // Get band widths and mutes (static per block for performance)
    const bandWidths = [
      getParam('band1Width', 0),
      getParam('band2Width', 0),
      getParam('band3Width', 0),
      getParam('band4Width', 0)
    ];

    const bandMutes = [
      getParam('band1Mute', 0),
      getParam('band2Mute', 0),
      getParam('band3Mute', 0),
      getParam('band4Mute', 0)
    ];

    for (let i = 0; i < leftInput.length; i++) {
      // Split into bands
      const leftBands = this.splitIntoBands(leftInput[i], rightInput[i], band1Freq, band2Freq, band3Freq, 0);
      const rightBands = this.splitIntoBands(rightInput[i], leftInput[i], band1Freq, band2Freq, band3Freq, 1);

      // Process each band
      let leftSum = 0;
      let rightSum = 0;

      for (let bandIdx = 0; bandIdx < 4; bandIdx++) {
        const isMuted = bandMutes[bandIdx] >= 0.5;
        const isSolo = hasSolo && soloStates[bandIdx] >= 0.5;
        const shouldProcess = !hasSolo || isSolo;

        if (isMuted || !shouldProcess) {
          continue;
        }

        let bandLeft = [leftBands.band1, leftBands.band2, leftBands.band3, leftBands.band4][bandIdx];
        let bandRight = [rightBands.band1, rightBands.band2, rightBands.band3, rightBands.band4][bandIdx];

        const width = bandWidths[bandIdx] * globalWidth;

        // Stereoize (mono-to-stereo)
        if (stereoize >= 0.5) {
          const mono = (bandLeft + bandRight) * 0.5;
          const stereoized = this.applyStereoize(mono, width);
          bandLeft = stereoized.left;
          bandRight = stereoized.right;
        } else {
          // Apply width processing
          const processed = this.processWidth(bandLeft, bandRight, width);
          bandLeft = processed.left;
          bandRight = processed.right;
        }

        leftSum += bandLeft;
        rightSum += bandRight;
      }

      // Mix wet/dry
      leftOutput[i] = leftInput[i] * (1 - wet) + leftSum * wet;
      rightOutput[i] = rightInput[i] * (1 - wet) + rightSum * wet;

      // Correlation metering
      const L = leftOutput[i];
      const R = rightOutput[i];
      this.sumLR += L * R;
      this.sumL2 += L * L;
      this.sumR2 += R * R;
    }

    // Emit correlation
    this.blockCount++;
    if (this.blockCount >= 3) {
      const denom = Math.sqrt(this.sumL2 * this.sumR2) + 1e-9;
      const corr = Math.max(-1, Math.min(1, this.sumLR / denom));
      this.port.postMessage({ type: 'corr', value: corr });
      this.blockCount = 0;
      this.sumLR = this.sumL2 = this.sumR2 = 0;
    }

    return true;
  }
}

registerProcessor('imager-processor', ImagerProcessor);
