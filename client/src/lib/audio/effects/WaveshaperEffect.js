/**
 * WAVESHAPER EFFECT (Distortion/Saturation)
 *
 * Perfect for Brazilian funk kick boosting and aggressive sound design.
 * Uses various waveshaping curves for different distortion characters.
 */

import { BaseEffect } from './BaseEffect.js';

export class WaveshaperEffect extends BaseEffect {
  constructor(context) {
    super(context, 'waveshaper', 'Waveshaper');

    // Parameters
    this.parameters = {
      drive: {
        value: 1.0,
        min: 1.0,
        max: 20.0,
        default: 1.0,
        label: 'Drive',
        unit: 'x'
      },
      mix: {
        value: 1.0,
        min: 0.0,
        max: 1.0,
        default: 1.0,
        label: 'Mix',
        unit: '%'
      },
      curve: {
        value: 'tanh',  // 'tanh', 'soft', 'hard', 'tube', 'foldback'
        options: ['tanh', 'soft', 'hard', 'tube', 'foldback'],
        default: 'tanh',
        label: 'Curve Type'
      },
      outputGain: {
        value: 1.0,
        min: 0.0,
        max: 2.0,
        default: 1.0,
        label: 'Output Gain',
        unit: 'x'
      }
    };

    // Create audio nodes
    this.inputNode = context.createGain();
    this.waveshaperNode = context.createWaveShaper();
    this.dryNode = context.createGain();
    this.wetNode = context.createGain();
    this.outputGainNode = context.createGain();
    this.outputNode = context.createGain();

    // Setup routing
    this._setupRouting();
    this._updateCurve();
  }

  _setupRouting() {
    // Split signal for dry/wet mix
    this.inputNode.connect(this.dryNode);
    this.inputNode.connect(this.waveshaperNode);

    // Wet signal through waveshaper
    this.waveshaperNode.connect(this.wetNode);

    // Mix dry and wet
    this.dryNode.connect(this.outputGainNode);
    this.wetNode.connect(this.outputGainNode);

    // Output
    this.outputGainNode.connect(this.outputNode);
  }

  /**
   * Update waveshaper curve based on drive and curve type
   */
  _updateCurve() {
    const drive = this.getParameter('drive');
    const curveType = this.getParameter('curve');
    const samples = 4096;
    const curve = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const x = (i * 2 / samples) - 1; // -1 to 1

      switch (curveType) {
        case 'tanh':
          // Smooth saturation (best for kicks and bass)
          curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
          break;

        case 'soft':
          // Soft clipping (gentle saturation)
          const softDrive = x * drive;
          if (Math.abs(softDrive) < 1) {
            curve[i] = softDrive;
          } else {
            curve[i] = Math.sign(softDrive) * (2 - Math.abs(softDrive));
          }
          curve[i] /= drive * 0.5;
          break;

        case 'hard':
          // Hard clipping (aggressive distortion)
          curve[i] = Math.max(-1, Math.min(1, x * drive)) / drive;
          break;

        case 'tube':
          // Tube-style saturation (warm harmonics)
          const tubeDrive = x * drive;
          if (tubeDrive < -1) {
            curve[i] = -2/3;
          } else if (tubeDrive > 1) {
            curve[i] = 2/3;
          } else {
            curve[i] = tubeDrive - (tubeDrive * tubeDrive * tubeDrive) / 3;
          }
          curve[i] /= (drive * 0.7);
          break;

        case 'foldback':
          // Foldback distortion (extreme/experimental)
          let foldDrive = x * drive;
          while (Math.abs(foldDrive) > 1) {
            foldDrive = Math.sign(foldDrive) * (2 - Math.abs(foldDrive));
          }
          curve[i] = foldDrive / drive;
          break;

        default:
          curve[i] = x;
      }
    }

    this.waveshaperNode.curve = curve;
    this.waveshaperNode.oversample = drive > 5 ? '4x' : '2x'; // Higher oversampling for heavy distortion
  }

  /**
   * Update dry/wet mix
   */
  _updateMix() {
    const mix = this.getParameter('mix');
    this.dryNode.gain.value = 1 - mix;
    this.wetNode.gain.value = mix;
  }

  /**
   * Update output gain
   */
  _updateOutputGain() {
    const gain = this.getParameter('outputGain');
    this.outputGainNode.gain.value = gain;
  }

  /**
   * Parameter change callback
   */
  onParameterChange(name, value) {
    if (name === 'drive' || name === 'curve') {
      this._updateCurve();
    } else if (name === 'mix') {
      this._updateMix();
    } else if (name === 'outputGain') {
      this._updateOutputGain();
    }
  }

  /**
   * Process audio (for worklet-based processing)
   */
  process(inputSamples, outputSamples, sampleRate) {
    const drive = this.getParameter('drive');
    const mix = this.getParameter('mix');
    const curveType = this.getParameter('curve');
    const outputGain = this.getParameter('outputGain');

    for (let i = 0; i < inputSamples.length; i++) {
      const input = inputSamples[i];
      let wet = input * drive;

      // Apply waveshaping curve
      switch (curveType) {
        case 'tanh':
          wet = Math.tanh(wet) / Math.tanh(drive);
          break;
        case 'soft':
          if (Math.abs(wet) < 1) {
            // No change
          } else {
            wet = Math.sign(wet) * (2 - Math.abs(wet));
          }
          wet /= drive * 0.5;
          break;
        case 'hard':
          wet = Math.max(-1, Math.min(1, wet)) / drive;
          break;
        case 'tube':
          if (wet < -1) wet = -2/3;
          else if (wet > 1) wet = 2/3;
          else wet = wet - (wet * wet * wet) / 3;
          wet /= (drive * 0.7);
          break;
        case 'foldback':
          while (Math.abs(wet) > 1) {
            wet = Math.sign(wet) * (2 - Math.abs(wet));
          }
          wet /= drive;
          break;
      }

      // Mix dry and wet
      outputSamples[i] = (input * (1 - mix) + wet * mix) * outputGain;
    }
  }

  /**
   * Preset: Brazilian Funk Kick Boost
   */
  static presetKickBoost() {
    return {
      drive: 8.0,
      mix: 0.7,
      curve: 'tanh',
      outputGain: 1.2
    };
  }

  /**
   * Preset: Warm Saturation
   */
  static presetWarmSaturation() {
    return {
      drive: 3.0,
      mix: 0.5,
      curve: 'tube',
      outputGain: 1.0
    };
  }

  /**
   * Preset: Hard Distortion
   */
  static presetHardDistortion() {
    return {
      drive: 12.0,
      mix: 1.0,
      curve: 'hard',
      outputGain: 0.8
    };
  }
}
