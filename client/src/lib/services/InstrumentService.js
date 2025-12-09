/**
 * InstrumentService
 * 
 * Centralized service for instrument operations.
 * Manages instrument creation, parameter updates, routing, and preview.
 * 
 * Architecture:
 * - InstrumentService → AudioEngine (direct instrument manipulation)
 * - Store updates are handled separately by callers
 */

import { AudioEngineGlobal } from '../core/AudioEngineGlobal';

export class InstrumentService {
    /**
     * Get audio engine instance
     * @private
     */
    static _getEngine() {
        return AudioEngineGlobal.get();
    }

    // =================== CREATE INSTRUMENT ===================

    /**
     * Create a new instrument in the audio engine
     * @param {object} instrument - Instrument configuration
     * @returns {Promise<object|null>}
     */
    static async createInstrument(instrument) {
        const engine = this._getEngine();
        if (!engine) return null;

        try {
            // Ensure mixer insert exists for the instrument's track
            if (instrument.mixerTrackId) {
                let mixerInsert = engine.mixerInserts?.get(instrument.mixerTrackId);
                if (!mixerInsert && engine.createMixerInsert) {
                    mixerInsert = engine.createMixerInsert(instrument.mixerTrackId, instrument.mixerTrackId);
                }
            }

            // Create instrument in audio engine
            if (engine.createInstrument) {
                const createdInstrument = await engine.createInstrument(instrument);
                await this._syncInstrumentParams(instrument.id);
                return createdInstrument;
            }
        } catch (error) {
            console.error('InstrumentService: Failed to create instrument:', error);
        }

        return null;
    }

    // =================== UPDATE PARAMETERS ===================

    /**
     * Update instrument parameters in the audio engine
     * @param {string} instrumentId - Instrument ID
     * @param {object} params - Parameters to update
     */
    static updateParameters(instrumentId, params) {
        const engine = this._getEngine();
        if (engine?.updateInstrumentParameters) {
            return engine.updateInstrumentParameters(instrumentId, params);
        }
    }

    /**
     * Sync instrument parameters from store to audio engine
     * @private
     */
    static async _syncInstrumentParams(instrumentId) {
        const engine = this._getEngine();
        if (!engine || !instrumentId) return;

        const instrument = engine.instruments?.get(instrumentId);
        if (!instrument || typeof instrument.updateParameters !== 'function') return;

        try {
            const { useInstrumentsStore } = await import('@/store/useInstrumentsStore');
            const state = useInstrumentsStore.getState();
            const instrumentData = state.instruments.find(i => i.id === instrumentId);
            if (!instrumentData) return;

            const envelopeEnabled = instrumentData.envelopeEnabled !== undefined
                ? instrumentData.envelopeEnabled
                : !!instrumentData.envelope;
            const envelope = instrumentData.envelope || {};

            const paramsToSync = {
                envelopeEnabled,
                attack: instrumentData.attack ?? (envelope.attack !== undefined ? envelope.attack * 1000 : undefined),
                decay: instrumentData.decay ?? (envelope.decay !== undefined ? envelope.decay * 1000 : undefined),
                sustain: instrumentData.sustain ?? envelope.sustain,
                release: instrumentData.release ?? (envelope.release !== undefined ? envelope.release * 1000 : undefined),
                gain: instrumentData.gain,
                pan: instrumentData.pan,
                pitchOffset: instrumentData.pitchOffset,
                sampleStart: instrumentData.sampleStart,
                sampleEnd: instrumentData.sampleEnd,
                cutItself: instrumentData.cutItself,
            };

            // Remove undefined values
            Object.keys(paramsToSync).forEach((key) => {
                if (paramsToSync[key] === undefined) delete paramsToSync[key];
            });

            if (Object.keys(paramsToSync).length > 0) {
                instrument.updateParameters(paramsToSync);
            }
        } catch (e) {
            console.warn('InstrumentService: Failed to sync params:', e);
        }
    }

    // =================== MUTE ===================

    /**
     * Set instrument mute state
     * @param {string} instrumentId - Instrument ID
     * @param {boolean} isMuted - Mute state
     */
    static setMute(instrumentId, isMuted) {
        const engine = this._getEngine();
        if (engine?.setInstrumentMute) {
            return engine.setInstrumentMute(instrumentId, isMuted);
        }
    }

    // =================== RECONCILE ===================

    /**
     * Reconcile instrument (re-render with effects)
     * @param {string} instrumentId - Instrument ID
     * @param {object} instrumentData - Instrument data
     * @returns {Promise<AudioBuffer|null>}
     */
    static async reconcile(instrumentId, instrumentData) {
        const engine = this._getEngine();
        if (engine?.reconcileInstrument) {
            return await engine.reconcileInstrument(instrumentId, instrumentData);
        }
        return null;
    }

    // =================== ROUTING ===================

    /**
     * Route instrument to a mixer insert
     * @param {string} instrumentId - Instrument ID
     * @param {string} trackId - Mixer track ID
     */
    static routeToInsert(instrumentId, trackId) {
        const engine = this._getEngine();
        if (engine?.routeInstrumentToInsert) {
            engine.routeInstrumentToInsert(instrumentId, trackId);
        }
    }

    /**
     * Route instrument with retry (for async initialization)
     * @param {string} instrumentId - Instrument ID
     * @param {string} mixerTrackId - Mixer track ID
     * @param {number} maxRetries - Max retry attempts
     * @param {number} baseDelay - Base delay in ms
     * @returns {Promise<boolean>}
     */
    static async routeWithRetry(instrumentId, mixerTrackId, maxRetries = 5, baseDelay = 100) {
        const engine = this._getEngine();
        if (!engine) return false;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const instrument = engine.instruments?.get(instrumentId);
            const insert = engine.mixerInserts?.get(mixerTrackId);
            const currentRoute = engine.instrumentToInsert?.get(instrumentId);

            // Already routed correctly
            if (currentRoute === mixerTrackId) {
                if (insert?.instruments?.has(instrumentId)) return true;
            }

            // Attempt to route
            if (instrument?.output && insert) {
                try {
                    const success = insert.connectInstrument(instrumentId, instrument.output);
                    if (success) {
                        engine.instrumentToInsert.set(instrumentId, mixerTrackId);
                        return true;
                    }
                } catch (e) {
                    // Retry on next iteration
                }
            }

            // Wait with exponential backoff
            await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(1.5, attempt)));
        }

        return false;
    }

    // =================== PREVIEW ===================

    /**
     * Preview sample playback
     * @param {string} instrumentId - Instrument ID
     * @param {string} trackId - Track ID
     * @param {number} velocity - Velocity (0-1)
     */
    static previewSample(instrumentId, trackId, velocity = 0.8) {
        const engine = this._getEngine();
        if (engine?.previewSample) {
            engine.previewSample(instrumentId, trackId, velocity);
        }
    }

    /**
     * Stop sample preview
     * @param {string} instrumentId - Instrument ID
     */
    static stopPreview(instrumentId) {
        const engine = this._getEngine();
        if (engine?.stopSamplePreview) {
            engine.stopSamplePreview(instrumentId);
        }
    }


    // =================== AUDITION ===================

    /**
     * Audition a note on an instrument
     * @param {string} instrumentId - Instrument ID
     * @param {string|number} note - Note pitch (e.g. 'C4' or MIDI number)
     * @param {number} velocity - Velocity (0-1)
     */
    static auditionNoteOn(instrumentId, note, velocity = 0.8) {
        const engine = this._getEngine();
        if (engine?.auditionNoteOn) {
            engine.auditionNoteOn(instrumentId, note, velocity);
        }
    }

    /**
     * Stop auditioning a note
     * @param {string} instrumentId - Instrument ID
     * @param {string|number} note - Note pitch (e.g. 'C4' or MIDI number)
     */
    static auditionNoteOff(instrumentId, note) {
        const engine = this._getEngine();
        if (engine?.auditionNoteOff) {
            engine.auditionNoteOff(instrumentId, note);
        }
    }

    // =================== BUFFER ===================

    /**
     * Request instrument audio buffer
     * @param {string} instrumentId - Instrument ID
     * @returns {Promise<AudioBuffer|null>}
     */
    static async requestBuffer(instrumentId) {
        const engine = this._getEngine();
        if (!engine) return null;

        const instrument = engine.instruments?.get(instrumentId);
        if (instrument?.buffer) {
            return instrument.buffer;
        }
        return null;
    }

    // =================== UTILITY ===================

    /**
     * Get an instrument from the audio engine
     * @param {string} instrumentId - Instrument ID
     * @returns {BaseInstrument|null}
     */
    static getInstrument(instrumentId) {
        const engine = this._getEngine();
        return engine?.instruments?.get(instrumentId) || null;
    }
}
