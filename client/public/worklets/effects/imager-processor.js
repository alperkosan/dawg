/**
 * Imager Processor
 *
 * Stereo imaging with Mid/Side processing:
 * - Width control (0 = mono, 1 = normal, 2 = ultra wide)
 * - Mid/Side balance
 * - Phase correlation safe
 */

class ImagerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'width', defaultValue: 1.0, minValue: 0, maxValue: 2 },
      { name: 'midGain', defaultValue: 1.0, minValue: 0, maxValue: 2 },
      { name: 'sideGain', defaultValue: 1.0, minValue: 0, maxValue: 2 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      // New: Low-band mono and crossover, correlation meter
      { name: 'lowMono', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'crossover', defaultValue: 160, minValue: 20, maxValue: 500 }
    ];
  }

  constructor() {
    super();
    // One-pole LPF state for side channel (for low-band mono split)
    this.sideLP = 0;
    this.lpCoef = 0; // updated per block from crossover

    // Correlation metering
    this.sumLR = 0;
    this.sumL2 = 0;
    this.sumR2 = 0;
    this.blockCount = 0;
  }

  /**
   * Mid/Side encoding and width processing
   */
  processStereo(left, right, width, midGain, sideGain) {
    // Encode to Mid/Side
    let mid = (left + right) * 0.5;
    let side = (left - right) * 0.5;

    // Apply width
    if (width <= 1.0) {
      // Narrow to normal (0-1)
      // Reduce side signal
      mid = mid * 1.0;
      side = side * width;
    } else {
      // Widen (1-2)
      // Enhance side signal
      const widthFactor = (width - 1.0); // 0-1 range
      mid = mid * (1 - widthFactor * 0.3); // Slightly reduce mid
      side = side * (1 + widthFactor);     // Boost side
    }

    // Apply manual mid/side gain adjustments
    mid = mid * midGain;
    side = side * sideGain;

    // Decode back to L/R
    const newLeft = mid + side;
    const newRight = mid - side;

    return [newLeft, newRight];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length) {
      return true;
    }

    const widthParam = parameters.width;
    const midGainParam = parameters.midGain;
    const sideGainParam = parameters.sideGain;
    const wetParam = parameters.wet;
    const lowMonoParam = parameters.lowMono;
    const xoParam = parameters.crossover;

    // Ensure we have at least 2 channels (stereo)
    if (input.length < 2 || output.length < 2) {
      // Mono input - just pass through
      for (let i = 0; i < input[0].length; i++) {
        output[0][i] = input[0][i];
        if (output[1]) output[1][i] = input[0][i];
      }
      return true;
    }

    const leftInput = input[0];
    const rightInput = input[1];
    const leftOutput = output[0];
    const rightOutput = output[1];

    // Update LPF coefficient once per block
    const xoHz = xoParam.length > 1 ? xoParam[0] : xoParam[0];
    const sr = sampleRate;
    const omega = 2 * Math.PI * Math.max(20, Math.min(500, xoHz)) / sr;
    const alpha = Math.exp(-omega);
    this.lpCoef = alpha;

    const lowMonoOn = (lowMonoParam.length > 1 ? lowMonoParam[0] : lowMonoParam[0]) >= 0.5;

    // Reset meters per block
    this.sumLR = 0; this.sumL2 = 0; this.sumR2 = 0;

    for (let i = 0; i < leftInput.length; i++) {
      const width = widthParam.length > 1 ? widthParam[i] : widthParam[0];
      const midGain = midGainParam.length > 1 ? midGainParam[i] : midGainParam[0];
      const sideGain = sideGainParam.length > 1 ? sideGainParam[i] : sideGainParam[0];
      const wet = wetParam.length > 1 ? wetParam[i] : wetParam[0];

      // Dry signals
      const dryLeft = leftInput[i];
      const dryRight = rightInput[i];

      // Encode
      let mid = (dryLeft + dryRight) * 0.5;
      let side = (dryLeft - dryRight) * 0.5;

      // Low-band mono: remove low frequencies from side
      if (lowMonoOn) {
        // One-pole LPF on side
        this.sideLP = this.sideLP + (1 - this.lpCoef) * (side - this.sideLP);
        const sideLow = this.sideLP;
        side = side - sideLow; // keep only high side
      }

      // Width
      if (width <= 1.0) {
        side = side * width;
      } else {
        const widthFactor = (width - 1.0);
        mid = mid * (1 - widthFactor * 0.3);
        side = side * (1 + widthFactor);
      }

      // Mid/Side gain
      mid *= midGain;
      side *= sideGain;

      // Decode
      const wetLeft = mid + side;
      const wetRight = mid - side;

      // Mix
      leftOutput[i] = dryLeft * (1 - wet) + wetLeft * wet;
      rightOutput[i] = dryRight * (1 - wet) + wetRight * wet;

      // Correlation accumulators (after processing)
      const L = leftOutput[i];
      const R = rightOutput[i];
      this.sumLR += L * R;
      this.sumL2 += L * L;
      this.sumR2 += R * R;
    }

    // Emit correlation meter ~ per block
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
