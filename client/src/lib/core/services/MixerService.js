/**
 * MixerService - Extracted from NativeAudioEngine
 * 
 * Handles all mixer channel management:
 * - Channel volume, pan, mute, mono
 * - Mixer insert creation and routing
 * - Master bus control
 * - Level metering
 * 
 * @module lib/core/services/MixerService
 */

import { MixerInsert } from '../MixerInsert.js';
import { logger, NAMESPACES } from '../../utils/debugLogger.js';
import AudioEngineConfig from '../AudioEngineConfig.js';

export class MixerService {
    /**
     * @param {NativeAudioEngine} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;
        this.mixerInserts = new Map();
        this.instrumentToInsert = new Map();
        this.channelAllocator = new Map();
        this.nextChannelIdx = 0;

        // Master bus references (set during initialization)
        this.masterBusInput = null;
        this.masterBusGain = null;
        this.masterGain = null;
        this.masterAnalyzer = null;
    }

    /**
     * Get audio context from parent engine
     */
    get audioContext() {
        return this.engine.audioContext;
    }

    /**
     * Get unified mixer from parent engine
     */
    get unifiedMixer() {
        return this.engine.unifiedMixer;
    }

    /**
     * Check if WASM mixer is in use
     */
    get useWasmMixer() {
        return this.engine.useWasmMixer;
    }

    /**
     * Initialize master audio chain
     */
    async initializeMasterBus() {
        logger.debug(NAMESPACES.AUDIO, 'Setting up master bus...');

        // Master Bus Input - all inserts connect here
        this.masterBusInput = this.audioContext.createGain();
        this.masterBusInput.gain.value = 1.0;

        // Master Bus Gain - pre-effects gain stage
        this.masterBusGain = this.audioContext.createGain();
        this.masterBusGain.gain.value = 1.0;

        // Master Volume - final output control
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.8;

        // Master Analyzer - metering
        this.masterAnalyzer = this.audioContext.createAnalyser();
        this.masterAnalyzer.fftSize = 256;
        this.masterAnalyzer.smoothingTimeConstant = 0.8;

        // Initial routing
        this.masterBusInput.connect(this.masterBusGain);
        this.masterBusGain.connect(this.masterGain);
        this.masterGain.connect(this.masterAnalyzer);
        this.masterAnalyzer.connect(this.audioContext.destination);

        // Create master insert
        const masterInsert = new MixerInsert(this.audioContext, 'master', 'Master');

        // Rewire: masterBusInput → masterInsert → masterGain
        this.masterBusInput.disconnect();
        this.masterBusInput.connect(masterInsert.input);
        masterInsert.output.disconnect();
        masterInsert.output.connect(this.masterGain);

        this.mixerInserts.set('master', masterInsert);

        logger.info(NAMESPACES.AUDIO, 'Master bus initialized');
    }

    /**
     * Create a mixer insert for a track
     * @param {string} insertId - Unique insert ID
     * @param {string} label - Display label
     * @returns {MixerInsert}
     */
    createMixerInsert(insertId, label = '') {
        if (this.mixerInserts.has(insertId)) {
            return this.mixerInserts.get(insertId);
        }

        const insert = new MixerInsert(this.audioContext, insertId, label);
        insert.output.connect(this.masterBusInput);
        this.mixerInserts.set(insertId, insert);

        // Allocate WASM channel if enabled
        if (this.useWasmMixer && this.unifiedMixer) {
            const chIdx = this.nextChannelIdx++;
            this.channelAllocator.set(insertId, chIdx);
        }

        logger.debug(NAMESPACES.AUDIO, `Created mixer insert: ${insertId}`);
        return insert;
    }

    /**
     * Remove a mixer insert
     * @param {string} insertId 
     */
    removeMixerInsert(insertId) {
        const insert = this.mixerInserts.get(insertId);
        if (!insert) return false;

        try {
            insert.disconnect();
            if (typeof insert.dispose === 'function') {
                insert.dispose();
            }
            this.mixerInserts.delete(insertId);
            this.channelAllocator.delete(insertId);

            logger.debug(NAMESPACES.AUDIO, `Removed mixer insert: ${insertId}`);
            return true;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to remove mixer insert ${insertId}:`, error);
            return false;
        }
    }

    /**
     * Route an instrument to a mixer insert
     * @param {string} instrumentId 
     * @param {string} insertId 
     */
    routeInstrumentToInsert(instrumentId, insertId) {
        const instrument = this.engine.instrumentService?.getInstrument(instrumentId)
            || this.engine.instruments?.get(instrumentId);
        const insert = this.mixerInserts.get(insertId);

        if (!instrument || !insert) {
            logger.warn(NAMESPACES.AUDIO, `Cannot route: instrument or insert not found`);
            return false;
        }

        if (!instrument.output) {
            logger.warn(NAMESPACES.AUDIO, `Instrument ${instrumentId} has no output node`);
            return false;
        }

        try {
            // Disconnect from previous routing
            try {
                instrument.output.disconnect();
            } catch (e) {
                // May not be connected
            }

            // Route to WASM mixer if enabled
            if (this.useWasmMixer && this.unifiedMixer) {
                const chIdx = this.channelAllocator.get(insertId);
                if (chIdx !== undefined) {
                    const channelInput = this.unifiedMixer.getChannelInput(chIdx);
                    if (channelInput) {
                        instrument.output.connect(channelInput);
                        this.instrumentToInsert.set(instrumentId, insertId);
                        return true;
                    }
                }
            }

            // Fallback to MixerInsert routing
            instrument.output.connect(insert.input);
            this.instrumentToInsert.set(instrumentId, insertId);

            logger.debug(NAMESPACES.AUDIO, `Routed ${instrumentId} → ${insertId}`);
            return true;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Routing failed for ${instrumentId}:`, error);
            return false;
        }
    }

    /**
     * Set channel volume
     * @param {string} channelId 
     * @param {number} volume 
     */
    setChannelVolume(channelId, volume) {
        // WASM mode
        if (this.useWasmMixer && this.unifiedMixer) {
            const chIdx = this.channelAllocator.get(channelId);
            if (chIdx !== undefined) {
                this.unifiedMixer.setChannelParams(chIdx, { gain: volume });
                return;
            }
        }

        // MixerInsert mode
        const insert = this.mixerInserts.get(channelId);
        if (insert) {
            insert.setGain(volume);
        }
    }

    /**
     * Set channel pan
     * @param {string} channelId 
     * @param {number} pan - -1 (left) to 1 (right)
     */
    setChannelPan(channelId, pan) {
        if (this.useWasmMixer && this.unifiedMixer) {
            const chIdx = this.channelAllocator.get(channelId);
            if (chIdx !== undefined) {
                this.unifiedMixer.setChannelParams(chIdx, { pan });
                return;
            }
        }

        const insert = this.mixerInserts.get(channelId);
        if (insert) {
            insert.setPan(pan);
        }
    }

    /**
     * Set channel mute
     * @param {string} channelId 
     * @param {boolean} muted 
     */
    setChannelMute(channelId, muted) {
        if (this.useWasmMixer && this.unifiedMixer) {
            const chIdx = this.channelAllocator.get(channelId);
            if (chIdx !== undefined) {
                this.unifiedMixer.setChannelParams(chIdx, { mute: muted });
                return;
            }
        }

        const insert = this.mixerInserts.get(channelId);
        if (insert) {
            insert.setMute(muted);
        }
    }

    /**
     * Set channel mono
     * @param {string} channelId 
     * @param {boolean} mono 
     */
    setChannelMono(channelId, mono) {
        const insert = this.mixerInserts.get(channelId);
        if (insert && typeof insert.setMono === 'function') {
            insert.setMono(mono);
        }
    }

    /**
     * Set master volume
     * @param {number} volume 
     */
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
            logger.debug(NAMESPACES.AUDIO, `Master volume: ${volume.toFixed(2)}`);
        }
    }

    /**
     * Get master volume
     * @returns {number}
     */
    getMasterVolume() {
        return this.masterGain?.gain.value || AudioEngineConfig.gain.masterVolume.default;
    }

    /**
     * Get mixer insert by ID
     * @param {string} insertId 
     * @returns {MixerInsert|undefined}
     */
    getInsert(insertId) {
        return this.mixerInserts.get(insertId);
    }

    /**
     * Get all mixer inserts
     * @returns {Map<string, MixerInsert>}
     */
    getAllInserts() {
        return this.mixerInserts;
    }

    /**
     * Dispose all mixer resources
     */
    dispose() {
        this.mixerInserts.forEach((insert, id) => {
            if (id !== 'master') {
                this.removeMixerInsert(id);
            }
        });
        this.instrumentToInsert.clear();
        this.channelAllocator.clear();
    }
}
