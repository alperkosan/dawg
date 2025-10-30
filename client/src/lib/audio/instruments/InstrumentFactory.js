/**
 * InstrumentFactory - Centralized instrument creation
 *
 * Factory pattern for creating all instrument types:
 * - Sample instruments (single and multi-sampled)
 * - VASynth instruments
 * - ForgeSynth instruments (legacy)
 *
 * Used by:
 * - NativeAudioEngine (playback)
 * - PreviewManager (preview/keyboard piano)
 */

import { SampleLoader } from './loaders/SampleLoader.js';
import { MultiSampleInstrument } from './sample/MultiSampleInstrument.js';
import { SingleSampleInstrument } from './sample/SingleSampleInstrument.js';
import { VASynthInstrument } from './synth/VASynthInstrument.js';
import { INSTRUMENT_TYPES } from '../../../config/constants.js';

export class InstrumentFactory {
    /**
     * Create instrument for playback (NativeAudioEngine)
     *
     * @param {Object} instrumentData - Instrument configuration
     * @param {AudioContext} audioContext - Web Audio context
     * @param {Object} options - Creation options
     * @returns {Promise<BaseInstrument>}
     */
    static async createPlaybackInstrument(instrumentData, audioContext, options = {}) {
        const {
            preloadSamples = true,
            onProgress = null
        } = options;

        console.log(`🏭 Creating playback instrument: ${instrumentData.name} (${instrumentData.type})`);

        try {
            switch (instrumentData.type) {
                case INSTRUMENT_TYPES.SAMPLE:
                    return await this._createSampleInstrument(
                        instrumentData,
                        audioContext,
                        { preloadSamples, onProgress }
                    );

                case INSTRUMENT_TYPES.VASYNTH:
                    return await this._createVASynthInstrument(
                        instrumentData,
                        audioContext
                    );

                case INSTRUMENT_TYPES.GRANULAR:
                    return await this._createGranularInstrument(
                        instrumentData,
                        audioContext,
                        { preloadSamples, onProgress }
                    );

                case INSTRUMENT_TYPES.SYNTH:
                    // Legacy ForgeSynth - not implemented yet in new system
                    console.warn(`ForgeSynth not yet supported in InstrumentFactory`);
                    return null;

                default:
                    throw new Error(`Unknown instrument type: ${instrumentData.type}`);
            }

        } catch (error) {
            console.error(`❌ Failed to create instrument ${instrumentData.name}:`, error);
            throw error;
        }
    }

    /**
     * Create instrument for preview (keyboard piano, hover)
     *
     * @param {Object} instrumentData - Instrument configuration
     * @param {AudioContext} audioContext - Web Audio context
     * @param {Object} options - Creation options
     * @returns {Promise<BaseInstrument>}
     */
    static async createPreviewInstrument(instrumentData, audioContext, options = {}) {
        const {
            preloadSamples = true,
            mode = 'keyboard' // 'keyboard' or 'hover'
        } = options;

        console.log(`👁️ Creating preview instrument: ${instrumentData.name} (${instrumentData.type}, ${mode} mode)`);

        // For preview, we use the same creation logic
        return this.createPlaybackInstrument(instrumentData, audioContext, { preloadSamples });
    }

    /**
     * Create sample-based instrument (single or multi-sampled)
     * @private
     */
    static async _createSampleInstrument(instrumentData, audioContext, options) {
        const { preloadSamples, onProgress } = options;

        // Check if multi-sampled
        const isMultiSampled = instrumentData.multiSamples && instrumentData.multiSamples.length > 0;

        if (isMultiSampled) {
            // Multi-sampled instrument (e.g., Piano)
            console.log(`  Multi-sampled instrument: ${instrumentData.multiSamples.length} samples`);

            // Load all samples
            const sampleBuffers = preloadSamples
                ? await SampleLoader.preloadInstrument(instrumentData, audioContext)
                : new Map();

            // Create instrument
            const instrument = new MultiSampleInstrument(
                instrumentData,
                audioContext,
                sampleBuffers
            );

            await instrument.initialize();

            return instrument;

        } else {
            // Single sample instrument (e.g., Kick, Snare)
            console.log(`  Single sample instrument: ${instrumentData.url}`);

            // Load single sample
            let sampleBuffer = null;
            if (preloadSamples) {
                const buffers = await SampleLoader.preloadInstrument(instrumentData, audioContext);
                sampleBuffer = buffers.get(instrumentData.url);
            }

            // Create instrument
            const instrument = new SingleSampleInstrument(
                instrumentData,
                audioContext,
                sampleBuffer
            );

            await instrument.initialize();

            return instrument;
        }
    }

    /**
     * Create VASynth instrument
     * @private
     */
    static async _createVASynthInstrument(instrumentData, audioContext) {
        console.log(`  VASynth preset: ${instrumentData.presetName}`);

        // ✅ Use VASynthInstrument (existing implementation)
        const { VASynthInstrument } = await import('./synth/VASynthInstrument.js');
        const instrument = new VASynthInstrument(instrumentData, audioContext);
        await instrument.initialize();

        return instrument;
    }

    /**
     * Create Granular Sampler instrument
     * @private
     */
    static async _createGranularInstrument(instrumentData, audioContext, options) {
        const { preloadSamples, onProgress } = options;

        console.log(`  Granular sampler: ${instrumentData.url || 'No sample'}`);

        // Load sample if URL provided
        let sampleBuffer = null;
        if (preloadSamples && instrumentData.url) {
            const buffers = await SampleLoader.preloadInstrument(instrumentData, audioContext);
            sampleBuffer = buffers.get(instrumentData.url);
            console.log(`    Sample loaded: ${sampleBuffer ? sampleBuffer.duration.toFixed(2) + 's' : 'Failed'}`);
        }

        // Import and create instrument
        const { GranularSamplerInstrument } = await import('./granular/GranularSamplerInstrument.js');
        const instrument = new GranularSamplerInstrument(
            instrumentData,
            audioContext,
            sampleBuffer
        );

        await instrument.initialize();

        return instrument;
    }

    /**
     * Preload samples for an instrument
     *
     * @param {Object} instrumentData - Instrument configuration
     * @param {AudioContext} audioContext - Web Audio context
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Map<string, AudioBuffer>>}
     */
    static async preloadSamples(instrumentData, audioContext, onProgress = null) {
        if (instrumentData.type !== INSTRUMENT_TYPES.SAMPLE && instrumentData.type !== INSTRUMENT_TYPES.GRANULAR) {
            console.log(`${instrumentData.name}: No samples to preload (${instrumentData.type})`);
            return new Map();
        }

        return SampleLoader.preloadInstrument(instrumentData, audioContext);
    }

    /**
     * Get instrument capabilities
     *
     * @param {string} instrumentType - INSTRUMENT_TYPES value
     * @returns {Object}
     */
    static getCapabilities(instrumentType) {
        switch (instrumentType) {
            case INSTRUMENT_TYPES.SAMPLE:
                return {
                    supportsPolyphony: true,
                    supportsPitchBend: true,
                    supportsVelocity: true,
                    supportsAftertouch: false,
                    supportsPresetChange: false,
                    supportsParameterAutomation: false,
                    requiresSamples: true
                };

            case INSTRUMENT_TYPES.VASYNTH:
                return {
                    supportsPolyphony: true,
                    supportsPitchBend: false,
                    supportsVelocity: true,
                    supportsAftertouch: false,
                    supportsPresetChange: true,
                    supportsParameterAutomation: true,
                    requiresSamples: false
                };

            case INSTRUMENT_TYPES.GRANULAR:
                return {
                    supportsPolyphony: true,
                    supportsPitchBend: true,
                    supportsVelocity: true,
                    supportsAftertouch: false,
                    supportsPresetChange: true,
                    supportsParameterAutomation: true,
                    requiresSamples: true
                };

            case INSTRUMENT_TYPES.SYNTH:
                return {
                    supportsPolyphony: true,
                    supportsPitchBend: false,
                    supportsVelocity: true,
                    supportsAftertouch: false,
                    supportsPresetChange: true,
                    supportsParameterAutomation: true,
                    requiresSamples: false
                };

            default:
                return null;
        }
    }

    /**
     * Check if instrument type requires samples
     *
     * @param {string} instrumentType - INSTRUMENT_TYPES value
     * @returns {boolean}
     */
    static requiresSamples(instrumentType) {
        return instrumentType === INSTRUMENT_TYPES.SAMPLE || instrumentType === INSTRUMENT_TYPES.GRANULAR;
    }

    /**
     * Validate instrument data
     *
     * @param {Object} instrumentData - Instrument configuration
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validate(instrumentData) {
        const errors = [];

        // Required fields
        if (!instrumentData.id) errors.push('Missing id');
        if (!instrumentData.name) errors.push('Missing name');
        if (!instrumentData.type) errors.push('Missing type');

        // Type-specific validation
        if (instrumentData.type === INSTRUMENT_TYPES.SAMPLE) {
            if (!instrumentData.url && (!instrumentData.multiSamples || instrumentData.multiSamples.length === 0)) {
                errors.push('Sample instrument requires url or multiSamples');
            }

            if (instrumentData.multiSamples) {
                instrumentData.multiSamples.forEach((sample, index) => {
                    if (!sample.url) errors.push(`multiSamples[${index}]: Missing url`);
                    if (sample.midiNote === undefined) errors.push(`multiSamples[${index}]: Missing midiNote`);
                });
            }
        }

        if (instrumentData.type === INSTRUMENT_TYPES.VASYNTH) {
            if (!instrumentData.presetName) {
                errors.push('VASynth instrument requires presetName');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get factory statistics
     *
     * @returns {Object}
     */
    static getStats() {
        return {
            sampleCache: SampleLoader.getCacheStats(),
            supportedTypes: Object.values(INSTRUMENT_TYPES)
        };
    }

    /**
     * Clear all caches
     */
    static clearCaches() {
        SampleLoader.clearCache();
        console.log('🗑️ InstrumentFactory: All caches cleared');
    }
}
