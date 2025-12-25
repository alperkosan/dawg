/**
 * InstrumentService - Extracted from NativeAudioEngine
 * 
 * Handles all instrument lifecycle management:
 * - Creation and destruction
 * - Mute/Solo control
 * - Routing to mixer channels
 * - Sample buffer management
 * 
 * @module lib/core/services/InstrumentService
 */

import { InstrumentFactory } from '../../audio/instruments/index.js';
import { logger, NAMESPACES } from '../../utils/debugLogger.js';

export class InstrumentService {
    /**
     * @param {NativeAudioEngine} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;
        this.instruments = new Map();
        this.sampleBuffers = new Map();
        this.sampleCache = new Map();
        this.metrics = {
            instrumentsCreated: 0
        };
    }

    /**
     * Get audio context from parent engine
     */
    get audioContext() {
        return this.engine.audioContext;
    }

    /**
     * Create a new instrument
     * @param {Object} instrumentData - Instrument configuration
     * @returns {Promise<Object>} Created instrument instance
     */
    async createInstrument(instrumentData) {
        try {
            // Use InstrumentFactory for centralized creation
            const existingBuffer = instrumentData.audioBuffer || this.sampleBuffers.get(instrumentData.id);

            const instrument = await InstrumentFactory.createPlaybackInstrument(
                instrumentData,
                this.audioContext,
                {
                    useCache: true,
                    existingBuffer: existingBuffer
                }
            );

            if (!instrument) {
                throw new Error(`InstrumentFactory returned null for ${instrumentData.name}`);
            }

            this.instruments.set(instrumentData.id, instrument);
            this.metrics.instrumentsCreated++;

            logger.info(NAMESPACES.AUDIO, `Instrument created: ${instrumentData.name} (${instrumentData.type})`);

            return instrument;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to create instrument ${instrumentData.name}:`, error);
            throw error;
        }
    }

    /**
     * Remove an instrument
     * @param {string} instrumentId - ID of instrument to remove
     */
    removeInstrument(instrumentId) {
        const instrument = this.instruments.get(instrumentId);
        if (!instrument) return false;

        try {
            // Stop all voices
            if (typeof instrument.allNotesOff === 'function') {
                instrument.allNotesOff();
            }

            // Cleanup instrument resources
            if (typeof instrument.dispose === 'function') {
                instrument.dispose();
            } else if (typeof instrument.destroy === 'function') {
                instrument.destroy();
            }

            // Remove from maps
            this.instruments.delete(instrumentId);
            this.sampleBuffers.delete(instrumentId);

            logger.info(NAMESPACES.AUDIO, `Instrument removed: ${instrumentId}`);
            return true;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to remove instrument ${instrumentId}:`, error);
            return false;
        }
    }

    /**
     * Get an instrument by ID
     * @param {string} instrumentId 
     * @returns {Object|undefined}
     */
    getInstrument(instrumentId) {
        return this.instruments.get(instrumentId);
    }

    /**
     * Check if instrument exists
     * @param {string} instrumentId 
     * @returns {boolean}
     */
    hasInstrument(instrumentId) {
        return this.instruments.has(instrumentId);
    }

    /**
     * Set instrument mute state
     * @param {string} instrumentId 
     * @param {boolean} isMuted 
     */
    setInstrumentMute(instrumentId, isMuted) {
        const instrument = this.instruments.get(instrumentId);
        if (!instrument) {
            logger.warn(NAMESPACES.AUDIO, `Instrument ${instrumentId} not found for mute operation`);
            return false;
        }

        try {
            if (typeof instrument.setMute === 'function') {
                instrument.setMute(isMuted);
            } else if (instrument.output?.gain) {
                // Fallback: control gain for mute/unmute
                const gainValue = isMuted ? 0 : (instrument.volume || 1);
                instrument.output.gain.setValueAtTime(gainValue, this.audioContext.currentTime);
            }

            logger.info(NAMESPACES.AUDIO, `Instrument ${instrumentId} ${isMuted ? 'muted' : 'unmuted'}`);
            return true;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to set mute for instrument ${instrumentId}:`, error);
            return false;
        }
    }

    /**
     * Stop all notes on all instruments
     */
    allNotesOff() {
        this.instruments.forEach(instrument => {
            if (typeof instrument.allNotesOff === 'function') {
                instrument.allNotesOff();
            }
        });
    }

    /**
     * Update BPM for all instruments that support it
     * @param {number} bpm 
     */
    updateBPM(bpm) {
        this.instruments.forEach(instrument => {
            if (typeof instrument.updateBPM === 'function') {
                try {
                    instrument.updateBPM(bpm);
                } catch (error) {
                    logger.warn(NAMESPACES.AUDIO, `Failed to update BPM for instrument:`, error);
                }
            }
        });
    }

    /**
     * Clean unused sample buffers
     * @param {Set<string>} activeInstrumentIds 
     */
    cleanUnusedBuffers(activeInstrumentIds = new Set()) {
        const toRemove = [];

        this.sampleBuffers.forEach((buffer, instrumentId) => {
            if (!activeInstrumentIds.has(instrumentId)) {
                toRemove.push(instrumentId);
            }
        });

        toRemove.forEach(id => {
            this.sampleBuffers.delete(id);
        });

        if (toRemove.length > 0) {
            logger.debug(NAMESPACES.AUDIO, `Cleaned ${toRemove.length} unused sample buffers`);
        }
    }

    /**
     * Preload samples for instruments
     * @param {Array<Object>} instrumentDataList 
     */
    async preloadSamples(instrumentDataList) {
        const activeIds = new Set(instrumentDataList.map(inst => inst.id));
        this.cleanUnusedBuffers(activeIds);

        const samplePromises = instrumentDataList
            .filter(inst => inst.type === 'sample' && inst.url)
            .map(async (inst) => {
                try {
                    if (this.sampleCache.has(inst.url)) {
                        this.sampleBuffers.set(inst.id, this.sampleCache.get(inst.url));
                        return;
                    }

                    const response = await fetch(inst.url);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

                    this.sampleCache.set(inst.url, audioBuffer);
                    this.sampleBuffers.set(inst.id, audioBuffer);
                } catch (error) {
                    logger.warn(NAMESPACES.AUDIO, `Failed to preload sample for ${inst.id}:`, error);
                }
            });

        await Promise.allSettled(samplePromises);
    }

    /**
     * Get all instruments
     * @returns {Map<string, Object>}
     */
    getAll() {
        return this.instruments;
    }

    /**
     * Get instrument count
     * @returns {number}
     */
    get count() {
        return this.instruments.size;
    }

    /**
     * Dispose all instruments and cleanup
     */
    dispose() {
        this.instruments.forEach((instrument, id) => {
            this.removeInstrument(id);
        });
        this.sampleBuffers.clear();
        this.sampleCache.clear();
    }
}
