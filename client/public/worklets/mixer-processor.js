// public/worklets/mixer-processor.js
// DAWG - Native Mixer Processor - Advanced mixing capabilities
// ⚡ OPTIMIZED: EQ coefficients cached, hot loop cleaned

class MixerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'gain', defaultValue: 0.8, minValue: 0, maxValue: 2 },
            { name: 'pan', defaultValue: 0, minValue: -1, maxValue: 1 },
            { name: 'mono', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'lowGain', defaultValue: 1, minValue: 0, maxValue: 3 },
            { name: 'midGain', defaultValue: 1, minValue: 0, maxValue: 3 },
            { name: 'highGain', defaultValue: 1, minValue: 0, maxValue: 3 },
            { name: 'lowFreq', defaultValue: 200, minValue: 20, maxValue: 500 },
            { name: 'highFreq', defaultValue: 3000, minValue: 1000, maxValue: 8000 },
            { name: 'compThreshold', defaultValue: -12, minValue: -40, maxValue: 0 },
            { name: 'compRatio', defaultValue: 4, minValue: 1, maxValue: 20 },
            { name: 'send1', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'send2', defaultValue: 0, minValue: 0, maxValue: 1 }
        ];
    }

    constructor(options) {
        super();

        this.stripId = options?.processorOptions?.stripId || 'strip';
        this.stripName = options?.processorOptions?.stripName || 'Mixer Strip';

        // EQ state (filter memory)
        this.eqState = {
            low: [0, 0, 0, 0],
            mid: [0, 0, 0, 0],
            high: [0, 0, 0, 0]
        };

        // ⚡ OPTIMIZATION: Pre-calculated EQ coefficients
        this.eqCoeffs = {
            low: { b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 },
            mid: { b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 },
            high: { b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 }
        };

        // ⚡ OPTIMIZATION: Parameter cache to detect changes
        this.cachedParams = {
            lowGain: 1,
            midGain: 1,
            highGain: 1,
            lowFreq: 200,
            highFreq: 3000
        };

        // Compressor state
        this.compState = {
            envelope: 0,
            gain: 1
        };

        // VU meter
        this.vuMeter = {
            peakL: 0,
            peakR: 0,
            rmsL: 0,
            rmsR: 0,
            samples: []
        };

        this.sampleRate = globalThis.sampleRate || 44100;
        this.frameCount = 0;

        // ⚡ OPTIMIZATION: Dynamic VU meter update rate
        // Target: ~6 updates per second regardless of sample rate
        const TARGET_VU_UPDATE_HZ = 6;
        this.vuUpdateInterval = Math.floor(this.sampleRate / TARGET_VU_UPDATE_HZ / 128) * 128;
        // Round to nearest 128 samples for better alignment

        // Initialize EQ coefficients
        this.updateEQCoefficients(1, 1, 1, 200, 3000);
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (!input || !input.length || !output || !output.length) {
            return true;
        }

        const blockSize = output[0].length;
        const channelCount = Math.min(input.length, output.length, 2);

        // ⚡ OPTIMIZATION: Check for parameter changes OUTSIDE the hot loop
        const lowGain = this.getParamValue(parameters.lowGain, 0);
        const midGain = this.getParamValue(parameters.midGain, 0);
        const highGain = this.getParamValue(parameters.highGain, 0);
        const lowFreq = this.getParamValue(parameters.lowFreq, 0);
        const highFreq = this.getParamValue(parameters.highFreq, 0);

        // Only recalculate coefficients if parameters changed
        if (lowGain !== this.cachedParams.lowGain ||
            midGain !== this.cachedParams.midGain ||
            highGain !== this.cachedParams.highGain ||
            lowFreq !== this.cachedParams.lowFreq ||
            highFreq !== this.cachedParams.highFreq) {

            this.updateEQCoefficients(lowGain, midGain, highGain, lowFreq, highFreq);
            this.cachedParams.lowGain = lowGain;
            this.cachedParams.midGain = midGain;
            this.cachedParams.highGain = highGain;
            this.cachedParams.lowFreq = lowFreq;
            this.cachedParams.highFreq = highFreq;
        }

        // Get other parameters
        const gain = this.getParamValue(parameters.gain, 0);
        const pan = this.getParamValue(parameters.pan, 0);
        const mono = this.getParamValue(parameters.mono, 0);
        const threshold = this.getParamValue(parameters.compThreshold, 0);
        const ratio = this.getParamValue(parameters.compRatio, 0);

        // ⚡ OPTIMIZATION: Pre-calculate pan coefficients if needed
        let panGainL = 1, panGainR = 1;
        if (pan !== 0) {
            panGainL = Math.cos((pan + 1) * Math.PI / 4);
            panGainR = Math.sin((pan + 1) * Math.PI / 4);
        }

        // ⚡ HOT LOOP: Minimal calculations per sample
        for (let i = 0; i < blockSize; i++) {
            let samplesL = channelCount > 0 ? input[0][i] : 0;
            let samplesR = channelCount > 1 ? input[1][i] : samplesL;

            // EQ processing (using cached coefficients)
            samplesL = this.applyEQWithCachedCoeffs(samplesL);
            samplesR = this.applyEQWithCachedCoeffs(samplesR);

            // Compression
            const compGain = this.processCompression(samplesL, samplesR, threshold, ratio);
            samplesL *= compGain;
            samplesR *= compGain;

            // Gain
            samplesL *= gain;
            samplesR *= gain;

            // Pan processing (equal-power panning law)
            if (pan !== 0) {
                // Sum to mono first, then apply equal-power pan coefficients
                const monoSum = (samplesL + samplesR) * 0.5;
                samplesL = monoSum * panGainL;
                samplesR = monoSum * panGainR;
            }

            // Mono collapse (if mono button active)
            if (mono > 0.5) {
                const monoSum = (samplesL + samplesR) * 0.5;
                samplesL = monoSum;
                samplesR = monoSum;
            }

            // Output
            if (output.length > 0) output[0][i] = samplesL;
            if (output.length > 1) output[1][i] = samplesR;

            // VU metering
            this.updateVUMeter(samplesL, samplesR);
        }

        // Send VU data periodically (dynamic rate based on sample rate)
        this.frameCount++;
        if (this.frameCount % this.vuUpdateInterval === 0) {
            this.sendVUData();
        }

        return true;
    }

    // ⚡ OPTIMIZATION: Calculate EQ coefficients only when parameters change
    updateEQCoefficients(lowGain, midGain, highGain, lowFreq, highFreq) {
        // Low shelf
        this.calculateBiquadCoeffs(this.eqCoeffs.low, lowFreq, lowGain, 'lowshelf');

        // Mid peaking (fixed at 1kHz)
        this.calculateBiquadCoeffs(this.eqCoeffs.mid, 1000, midGain, 'peaking');

        // High shelf
        this.calculateBiquadCoeffs(this.eqCoeffs.high, highFreq, highGain, 'highshelf');
    }

    // ⚡ OPTIMIZATION: Pre-calculate biquad coefficients
    calculateBiquadCoeffs(coeffs, frequency, gain, type) {
        const omega = 2 * Math.PI * frequency / this.sampleRate;
        const sinOmega = Math.sin(omega);
        const cosOmega = Math.cos(omega);
        const alpha = sinOmega / 2;
        const A = Math.pow(10, gain / 40);
        const sqrtA = Math.sqrt(A);

        let b0, b1, b2, a0, a1, a2;

        switch (type) {
            case 'lowshelf':
                b0 = A * ((A + 1) - (A - 1) * cosOmega + 2 * sqrtA * alpha);
                b1 = 2 * A * ((A - 1) - (A + 1) * cosOmega);
                b2 = A * ((A + 1) - (A - 1) * cosOmega - 2 * sqrtA * alpha);
                a0 = (A + 1) + (A - 1) * cosOmega + 2 * sqrtA * alpha;
                a1 = -2 * ((A - 1) + (A + 1) * cosOmega);
                a2 = (A + 1) + (A - 1) * cosOmega - 2 * sqrtA * alpha;
                break;

            case 'highshelf':
                b0 = A * ((A + 1) + (A - 1) * cosOmega + 2 * sqrtA * alpha);
                b1 = -2 * A * ((A - 1) + (A + 1) * cosOmega);
                b2 = A * ((A + 1) + (A - 1) * cosOmega - 2 * sqrtA * alpha);
                a0 = (A + 1) - (A - 1) * cosOmega + 2 * sqrtA * alpha;
                a1 = 2 * ((A - 1) - (A + 1) * cosOmega);
                a2 = (A + 1) - (A - 1) * cosOmega - 2 * sqrtA * alpha;
                break;

            case 'peaking':
            default:
                b0 = 1 + alpha * A;
                b1 = -2 * cosOmega;
                b2 = 1 - alpha * A;
                a0 = 1 + alpha / A;
                a1 = -2 * cosOmega;
                a2 = 1 - alpha / A;
                break;
        }

        // Normalize and store
        coeffs.b0 = b0 / a0;
        coeffs.b1 = b1 / a0;
        coeffs.b2 = b2 / a0;
        coeffs.a1 = a1 / a0;
        coeffs.a2 = a2 / a0;
    }

    // ⚡ OPTIMIZATION: Apply 3-band EQ using pre-calculated coefficients
    applyEQWithCachedCoeffs(sample) {
        // All 3 bands in series (not parallel)
        let output = sample;

        // Low shelf
        output = this.applyBiquad(output, this.eqState.low, this.eqCoeffs.low);

        // Mid peaking
        output = this.applyBiquad(output, this.eqState.mid, this.eqCoeffs.mid);

        // High shelf
        output = this.applyBiquad(output, this.eqState.high, this.eqCoeffs.high);

        return output;
    }

    // ⚡ OPTIMIZATION: Biquad filter using cached coefficients
    applyBiquad(input, state, coeffs) {
        // Direct Form II implementation
        const output = coeffs.b0 * input + coeffs.b1 * state[0] + coeffs.b2 * state[1]
                     - coeffs.a1 * state[2] - coeffs.a2 * state[3];

        // Update state
        state[1] = state[0];
        state[0] = input;
        state[3] = state[2];
        state[2] = output;

        return output;
    }

    // ⚡ OPTIMIZATION: Simplified compressor (returns gain multiplier)
    processCompression(left, right, threshold, ratio) {
        const inputLevel = Math.max(Math.abs(left), Math.abs(right));

        // Fast path: no compression needed
        if (inputLevel < 0.001) {
            return this.compState.gain;
        }

        const inputLevelDB = 20 * Math.log10(inputLevel);

        let gainReduction = 0;
        if (inputLevelDB > threshold) {
            const excess = inputLevelDB - threshold;
            gainReduction = excess * (1 - 1/ratio);
        }

        const targetGain = Math.pow(10, -gainReduction / 20);

        // Smooth gain changes
        const attack = 0.003;
        const release = 0.1;
        const timeConstant = targetGain < this.compState.gain ? attack : release;

        this.compState.gain += (targetGain - this.compState.gain) *
                              (1 - Math.exp(-1 / (timeConstant * this.sampleRate)));

        return this.compState.gain;
    }

    updateVUMeter(left, right) {
        this.vuMeter.peakL = Math.max(this.vuMeter.peakL * 0.95, Math.abs(left));
        this.vuMeter.peakR = Math.max(this.vuMeter.peakR * 0.95, Math.abs(right));

        this.vuMeter.samples.push({ left: left * left, right: right * right });

        if (this.vuMeter.samples.length > 128) {
            this.vuMeter.samples.shift();
        }
    }

    sendVUData() {
        if (this.vuMeter.samples.length === 0) return;

        const rmsL = Math.sqrt(
            this.vuMeter.samples.reduce((sum, s) => sum + s.left, 0) / this.vuMeter.samples.length
        );
        const rmsR = Math.sqrt(
            this.vuMeter.samples.reduce((sum, s) => sum + s.right, 0) / this.vuMeter.samples.length
        );

        this.port.postMessage({
            type: 'vuMeter',
            data: {
                peakL: this.vuMeter.peakL,
                peakR: this.vuMeter.peakR,
                rmsL: rmsL,
                rmsR: rmsR
            }
        });
    }

    getParamValue(param, sampleIndex) {
        return param.length > 1 ? param[sampleIndex] : param[0];
    }
}

registerProcessor('mixer-processor', MixerProcessor);
