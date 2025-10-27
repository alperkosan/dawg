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
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
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

    for (let i = 0; i < leftInput.length; i++) {
      const width = widthParam.length > 1 ? widthParam[i] : widthParam[0];
      const midGain = midGainParam.length > 1 ? midGainParam[i] : midGainParam[0];
      const sideGain = sideGainParam.length > 1 ? sideGainParam[i] : sideGainParam[0];
      const wet = wetParam.length > 1 ? wetParam[i] : wetParam[0];

      // Dry signals
      const dryLeft = leftInput[i];
      const dryRight = rightInput[i];

      // Process with Mid/Side
      const [wetLeft, wetRight] = this.processStereo(dryLeft, dryRight, width, midGain, sideGain);

      // Mix
      leftOutput[i] = dryLeft * (1 - wet) + wetLeft * wet;
      rightOutput[i] = dryRight * (1 - wet) + wetRight * wet;
    }

    return true;
  }
}

registerProcessor('imager-processor', ImagerProcessor);
