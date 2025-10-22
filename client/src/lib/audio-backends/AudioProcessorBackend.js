/**
 * Audio Processor Backend Interface
 *
 * Provides abstraction layer for audio processing implementations:
 * - JavaScript (baseline, 1x performance)
 * - WebAssembly (4-5x performance)
 * - Native Extension (10-20x performance)
 */

export const BackendType = {
    JAVASCRIPT: 'javascript',
    WASM: 'wasm',
    NATIVE: 'native'
};

export const ProcessingMode = {
    SAMPLE_BY_SAMPLE: 'sample',  // Process one sample at a time
    BUFFER: 'buffer'              // Process entire buffer at once (more efficient)
};

/**
 * Base class for audio processor backends
 * All backends must implement this interface
 */
export class AudioProcessorBackend {
    constructor(sampleRate) {
        if (new.target === AudioProcessorBackend) {
            throw new Error('AudioProcessorBackend is abstract and cannot be instantiated directly');
        }

        this.sampleRate = sampleRate;
        this.isInitialized = false;
        this.processingMode = ProcessingMode.SAMPLE_BY_SAMPLE;
    }

    /**
     * Initialize backend (load WASM module, connect native extension, etc.)
     * @returns {Promise<void>}
     */
    async initialize() {
        throw new Error('Must implement initialize()');
    }

    /**
     * Process entire audio buffer (more efficient, if supported)
     * @param {Float32Array} inputL - Left channel input
     * @param {Float32Array} inputR - Right channel input
     * @param {Float32Array} outputL - Left channel output
     * @param {Float32Array} outputR - Right channel output
     * @param {ProcessingParams} params - Processing parameters
     * @returns {void}
     */
    processBuffer(inputL, inputR, outputL, outputR, params) {
        throw new Error('Must implement processBuffer()');
    }

    /**
     * Process single sample (fallback for JS compatibility)
     * @param {number} sampleL - Left channel sample
     * @param {number} sampleR - Right channel sample
     * @param {ProcessingParams} params - Processing parameters
     * @returns {{left: number, right: number}}
     */
    processSample(sampleL, sampleR, params) {
        throw new Error('Must implement processSample()');
    }

    /**
     * Update EQ coefficients (called when EQ parameters change)
     * @param {number} lowGain - Low shelf gain (0-3)
     * @param {number} midGain - Mid peak gain (0-3)
     * @param {number} highGain - High shelf gain (0-3)
     * @param {number} lowFreq - Low shelf frequency (20-500Hz)
     * @param {number} highFreq - High shelf frequency (1000-8000Hz)
     * @returns {void}
     */
    updateEQCoefficients(lowGain, midGain, highGain, lowFreq, highFreq) {
        // Optional: backends can override for optimization
    }

    /**
     * Reset internal state (filters, envelopes, etc.)
     * @returns {void}
     */
    reset() {
        // Optional: backends can override
    }

    /**
     * Cleanup resources (free WASM memory, disconnect native, etc.)
     * @returns {void}
     */
    cleanup() {
        this.isInitialized = false;
    }

    /**
     * Get backend capabilities and performance characteristics
     * @returns {BackendCapabilities}
     */
    getCapabilities() {
        throw new Error('Must implement getCapabilities()');
    }

    /**
     * Get current processing statistics
     * @returns {ProcessingStats}
     */
    getStats() {
        return {
            samplesProcessed: 0,
            averageProcessingTime: 0,
            peakProcessingTime: 0,
            cpuUsage: 0
        };
    }
}

/**
 * @typedef {Object} ProcessingParams
 * @property {boolean} eqActive - Whether EQ is active
 * @property {boolean} compActive - Whether compression is active
 * @property {number} gain - Output gain (0-2)
 * @property {number} pan - Pan position (-1 to 1)
 * @property {number} mono - Mono collapse amount (0-1)
 * @property {number} lowGain - Low shelf gain (0-3)
 * @property {number} midGain - Mid peak gain (0-3)
 * @property {number} highGain - High shelf gain (0-3)
 * @property {number} lowFreq - Low shelf frequency (20-500Hz)
 * @property {number} highFreq - High shelf frequency (1000-8000Hz)
 * @property {number} threshold - Compression threshold (-40 to 0 dB)
 * @property {number} ratio - Compression ratio (1-20)
 */

/**
 * @typedef {Object} BackendCapabilities
 * @property {string} type - Backend type (js/wasm/native)
 * @property {boolean} supportsBufferProcessing - Can process entire buffer at once
 * @property {boolean} supportsSIMD - Has SIMD optimization
 * @property {boolean} supportsMultiThreading - Can use multiple CPU cores
 * @property {number} maxPolyphony - Maximum simultaneous voices
 * @property {number} averageLatency - Average processing latency (ms)
 * @property {number} cpuEfficiency - CPU efficiency multiplier (1.0 = baseline JS)
 */

/**
 * @typedef {Object} ProcessingStats
 * @property {number} samplesProcessed - Total samples processed
 * @property {number} averageProcessingTime - Average time per block (ms)
 * @property {number} peakProcessingTime - Peak time per block (ms)
 * @property {number} cpuUsage - Estimated CPU usage (%)
 */
