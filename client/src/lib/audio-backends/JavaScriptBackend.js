/**
 * JavaScript Audio Backend
 *
 * Baseline implementation using pure JavaScript
 * - Baseline performance (1.0x)
 * - Sample-by-sample processing
 * - Compatible with all browsers
 */

import { AudioProcessorBackend, BackendType, ProcessingMode } from './AudioProcessorBackend.js';

export class JavaScriptBackend extends AudioProcessorBackend {
    constructor(sampleRate) {
        super(sampleRate);

        // EQ state (biquad filter memory)
        // Format: [x1, x2, y1, y2]
        this.eqState = {
            low: [0, 0, 0, 0],
            mid: [0, 0, 0, 0],
            high: [0, 0, 0, 0]
        };

        // EQ coefficients (pre-calculated for performance)
        // Format: { b0, b1, b2, a1, a2 } (pre-normalized by a0)
        this.eqCoeffs = {
            low: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 },
            mid: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 },
            high: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        };

        // Cached EQ parameters (to detect changes)
        this.cachedEQParams = {
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

        // Cached threshold linear value (avoid repeated Math.pow)
        this.cachedThresholdLinear = 1.0;
        this.cachedThreshold = 0;

        // Processing mode
        this.processingMode = ProcessingMode.SAMPLE_BY_SAMPLE;

        // Statistics
        this.stats = {
            samplesProcessed: 0,
            totalProcessingTime: 0,
            peakProcessingTime: 0,
            processCount: 0
        };
    }

    /**
     * Initialize JavaScript backend (no async work needed)
     */
    async initialize() {
        // Initialize with default EQ
        this.updateEQCoefficients(1, 1, 1, 200, 3000);

        this.isInitialized = true;
        return Promise.resolve();
    }

    /**
     * Process entire buffer (not optimized for JS, but provided for interface compatibility)
     */
    processBuffer(inputL, inputR, outputL, outputR, params) {
        const startTime = performance.now();

        // Process sample-by-sample (JS backend doesn't benefit from buffer processing)
        for (let i = 0; i < inputL.length; i++) {
            const result = this.processSample(inputL[i], inputR[i], params);
            outputL[i] = result.left;
            outputR[i] = result.right;
        }

        // Update stats
        const processingTime = performance.now() - startTime;
        this.stats.totalProcessingTime += processingTime;
        this.stats.peakProcessingTime = Math.max(this.stats.peakProcessingTime, processingTime);
        this.stats.processCount++;
        this.stats.samplesProcessed += inputL.length;
    }

    /**
     * Process single sample
     * @param {number} sampleL - Left channel input
     * @param {number} sampleR - Right channel input
     * @param {Object} params - Processing parameters
     * @returns {{left: number, right: number}}
     */
    processSample(sampleL, sampleR, params) {
        let outL = sampleL;
        let outR = sampleR;

        // EQ processing (only if active)
        if (params.eqActive) {
            outL = this.applyEQ(outL);
            outR = this.applyEQ(outR);
        }

        // Compression (only if active)
        if (params.compActive) {
            const compGain = this.applyCompression(outL, outR, params.threshold, params.ratio);
            outL *= compGain;
            outR *= compGain;
        }

        // Gain
        outL *= params.gain;
        outR *= params.gain;

        // Pan (if not center)
        if (params.pan !== 0) {
            // Equal-power panning law
            const panGainL = Math.cos((params.pan + 1) * Math.PI / 4);
            const panGainR = Math.sin((params.pan + 1) * Math.PI / 4);

            const monoSum = (outL + outR) * 0.5;
            outL = monoSum * panGainL;
            outR = monoSum * panGainR;
        }

        // Mono collapse (if enabled)
        if (params.mono > 0.5) {
            const monoSum = (outL + outR) * 0.5;
            outL = monoSum;
            outR = monoSum;
        }

        return { left: outL, right: outR };
    }

    /**
     * Apply 3-band EQ using cached coefficients
     * @param {number} sample - Input sample
     * @returns {number} - Filtered sample
     */
    applyEQ(sample) {
        let output = sample;

        // Low shelf
        output = this.applyBiquad(output, this.eqState.low, this.eqCoeffs.low);

        // Mid peaking
        output = this.applyBiquad(output, this.eqState.mid, this.eqCoeffs.mid);

        // High shelf
        output = this.applyBiquad(output, this.eqState.high, this.eqCoeffs.high);

        return output;
    }

    /**
     * Apply biquad filter (Direct Form II)
     * @param {number} input - Input sample
     * @param {Array<number>} state - Filter state [x1, x2, y1, y2]
     * @param {Object} coeffs - Filter coefficients { b0, b1, b2, a1, a2 }
     * @returns {number} - Filtered sample
     */
    applyBiquad(input, state, coeffs) {
        // Direct Form II implementation
        const output = coeffs.b0 * input + coeffs.b1 * state[0] + coeffs.b2 * state[1]
                     - coeffs.a1 * state[2] - coeffs.a2 * state[3];

        // Update state
        state[1] = state[0];  // x2 = x1
        state[0] = input;      // x1 = x
        state[3] = state[2];  // y2 = y1
        state[2] = output;     // y1 = y

        return output;
    }

    /**
     * Apply compression (returns gain multiplier)
     * @param {number} left - Left channel sample
     * @param {number} right - Right channel sample
     * @param {number} threshold - Threshold in dB (-40 to 0)
     * @param {number} ratio - Compression ratio (1-20)
     * @returns {number} - Gain multiplier
     */
    applyCompression(left, right, threshold, ratio) {
        const inputLevel = Math.max(Math.abs(left), Math.abs(right));

        // Fast path: no signal or threshold disabled
        if (inputLevel < 0.001 || threshold >= 0) {
            // Smooth gain back to 1.0
            this.compState.gain += (1 - this.compState.gain) * 0.003;
            return this.compState.gain;
        }

        // Update cached threshold if changed
        if (threshold !== this.cachedThreshold) {
            this.cachedThresholdLinear = Math.pow(10, threshold / 20);
            this.cachedThreshold = threshold;
        }

        // Calculate target gain
        let targetGain = 1.0;

        if (inputLevel > this.cachedThresholdLinear) {
            // Linear compression approximation (much faster than log/pow)
            const excess = (inputLevel - this.cachedThresholdLinear) / this.cachedThresholdLinear;
            const reduction = excess / ratio;
            targetGain = 1.0 / (1.0 + reduction);
        }

        // Smooth gain changes (attack/release envelope)
        const timeConstant = targetGain < this.compState.gain ? 0.003 : 0.1;
        const smoothingFactor = 1 - Math.exp(-1 / (timeConstant * this.sampleRate));

        this.compState.gain += (targetGain - this.compState.gain) * smoothingFactor;

        return this.compState.gain;
    }

    /**
     * Update EQ coefficients (called when parameters change)
     */
    updateEQCoefficients(lowGain, midGain, highGain, lowFreq, highFreq) {
        // Only recalculate if parameters actually changed
        if (lowGain === this.cachedEQParams.lowGain &&
            midGain === this.cachedEQParams.midGain &&
            highGain === this.cachedEQParams.highGain &&
            lowFreq === this.cachedEQParams.lowFreq &&
            highFreq === this.cachedEQParams.highFreq) {
            return;
        }

        // Low shelf
        this.calculateBiquadCoeffs(this.eqCoeffs.low, lowFreq, lowGain, 'lowshelf');

        // Mid peaking (fixed at 1kHz)
        this.calculateBiquadCoeffs(this.eqCoeffs.mid, 1000, midGain, 'peaking');

        // High shelf
        this.calculateBiquadCoeffs(this.eqCoeffs.high, highFreq, highGain, 'highshelf');

        // Update cache
        this.cachedEQParams.lowGain = lowGain;
        this.cachedEQParams.midGain = midGain;
        this.cachedEQParams.highGain = highGain;
        this.cachedEQParams.lowFreq = lowFreq;
        this.cachedEQParams.highFreq = highFreq;
    }

    /**
     * Calculate biquad filter coefficients
     * @param {Object} coeffs - Coefficient object to update
     * @param {number} frequency - Frequency in Hz
     * @param {number} gain - Gain (linear, 0-3)
     * @param {string} type - Filter type ('lowshelf', 'highshelf', 'peaking')
     */
    calculateBiquadCoeffs(coeffs, frequency, gain, type) {
        const omega = 2 * Math.PI * frequency / this.sampleRate;
        const sinOmega = Math.sin(omega);
        const cosOmega = Math.cos(omega);
        const alpha = sinOmega / 2;
        const A = Math.pow(10, gain / 40);  // Convert to dB scale
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

        // Normalize coefficients by a0
        coeffs.b0 = b0 / a0;
        coeffs.b1 = b1 / a0;
        coeffs.b2 = b2 / a0;
        coeffs.a1 = a1 / a0;
        coeffs.a2 = a2 / a0;
    }

    /**
     * Reset all internal state
     */
    reset() {
        // Reset filter state
        this.eqState.low.fill(0);
        this.eqState.mid.fill(0);
        this.eqState.high.fill(0);

        // Reset compressor state
        this.compState.envelope = 0;
        this.compState.gain = 1;

        // Reset statistics
        this.stats.samplesProcessed = 0;
        this.stats.totalProcessingTime = 0;
        this.stats.peakProcessingTime = 0;
        this.stats.processCount = 0;
    }

    /**
     * Get backend capabilities
     */
    getCapabilities() {
        return {
            type: BackendType.JAVASCRIPT,
            supportsBufferProcessing: true, // Implemented, but not optimized
            supportsSIMD: false,
            supportsMultiThreading: false,
            maxPolyphony: 8,
            averageLatency: 2.67, // 128 samples @ 48kHz
            cpuEfficiency: 1.0    // Baseline
        };
    }

    /**
     * Get processing statistics
     */
    getStats() {
        const avgTime = this.stats.processCount > 0
            ? this.stats.totalProcessingTime / this.stats.processCount
            : 0;

        const idealBlockTime = (128 / this.sampleRate) * 1000; // 2.67ms @ 48kHz
        const cpuUsage = this.stats.processCount > 0
            ? (avgTime / idealBlockTime) * 100
            : 0;

        return {
            samplesProcessed: this.stats.samplesProcessed,
            averageProcessingTime: avgTime,
            peakProcessingTime: this.stats.peakProcessingTime,
            cpuUsage: cpuUsage
        };
    }

    /**
     * Cleanup (nothing to cleanup for JS backend)
     */
    cleanup() {
        this.reset();
        super.cleanup();
    }
}
