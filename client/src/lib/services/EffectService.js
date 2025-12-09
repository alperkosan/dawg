/**
 * EffectService
 * 
 * Centralized service for audio effect operations.
 * Manages effect add/remove/update/bypass operations on mixer inserts.
 * 
 * Architecture:
 * - EffectService → AudioEngine (direct effect manipulation)
 * - Store updates are handled separately by callers
 */

import { AudioEngineGlobal } from '../core/AudioEngineGlobal';
import { effectRegistry } from '../audio/EffectRegistry';
import { normalizeEffectParam, normalizeEffectSettings } from '../audio/effects/parameterMappings.js';

export class EffectService {
    /**
     * Get audio engine instance
     * @private
     */
    static _getEngine() {
        return AudioEngineGlobal.get();
    }

    // =================== ADD EFFECT ===================

    /**
     * Add effect to a mixer insert
     * @param {string} trackId - Mixer track ID
     * @param {string} effectType - Effect type (e.g., 'Compressor', 'Delay')
     * @param {object} settings - Initial effect settings
     * @returns {Promise<string|null>} Effect ID or null if failed
     */
    static async addEffect(trackId, effectType, settings = {}) {
        const engine = this._getEngine();
        if (!engine?.addEffectToInsert) return null;

        try {
            const effectId = await engine.addEffectToInsert(trackId, effectType, settings);

            // Sync instruments connected to this insert
            const insert = engine.mixerInserts?.get(trackId);
            if (insert?.instruments) {
                const { useInstrumentsStore } = await import('@/store/useInstrumentsStore');
                const instrumentsStore = useInstrumentsStore.getState();

                for (const [instrumentId] of insert.instruments) {
                    const instrument = engine.instruments?.get(instrumentId);
                    if (!instrument) continue;

                    const instrumentData = instrumentsStore.instruments.find(inst => inst.id === instrumentId);
                    if (instrumentData) {
                        try {
                            insert.connectInstrument(instrumentId, instrument.output);
                        } catch (e) {
                            console.warn('EffectService: Could not reconnect instrument:', e);
                        }
                    }
                }
            }

            return effectId;
        } catch (error) {
            console.error('EffectService: Failed to add effect:', error);
            return null;
        }
    }

    // =================== REMOVE EFFECT ===================

    /**
     * Remove effect from a mixer insert
     * @param {string} trackId - Mixer track ID
     * @param {string} effectId - Effect ID to remove
     */
    static removeEffect(trackId, effectId) {
        const engine = this._getEngine();
        if (engine?.removeEffectFromInsert) {
            engine.removeEffectFromInsert(trackId, effectId);
        }
    }

    // =================== UPDATE EFFECT PARAM ===================

    /**
     * Update a single effect parameter
     * @param {string} trackId - Mixer track ID
     * @param {string} effectId - Effect ID
     * @param {string} param - Parameter name
     * @param {*} value - New parameter value
     */
    static updateEffectParam(trackId, effectId, param, value) {
        const engine = this._getEngine();
        if (!engine?.mixerInserts) return;

        const insert = engine.mixerInserts.get(trackId);
        if (!insert) return;

        const effect = insert.effects?.get(effectId);
        if (!effect) return;

        const effectType = effect.type || effect.settings?.type;
        const normalizedParam = normalizeEffectParam(effectType, param);
        const effectiveSettings = normalizeEffectSettings(effectType, effect.settings || {});
        effect.settings = effectiveSettings;

        // Handle bypass
        if (normalizedParam === 'bypass') {
            insert.setEffectBypass(effectId, value);
            return;
        }

        // Handle sidechain source
        if (normalizedParam === 'scSourceId') {
            const getSourceInsert = (id) => engine.mixerInserts.get(id);
            insert.updateSidechainSource(effectId, value, getSourceInsert);
            return;
        }

        const node = effect.node;
        if (!node) return;

        // Handle MultiBandEQ bands (RAF throttled)
        if (effectType === 'MultiBandEQ' && normalizedParam === 'bands') {
            if (node.port) {
                if (!effect._rafPending) {
                    effect._rafPending = true;
                    effect._pendingBands = value;
                    requestAnimationFrame(() => {
                        node.port.postMessage({ type: 'updateBands', bands: effect._pendingBands });
                        effect._rafPending = false;
                        effect._pendingBands = null;
                    });
                } else {
                    effect._pendingBands = value;
                }
                effect.settings[normalizedParam] = value;
                return;
            }
        }

        // Handle AudioWorklet parameters (Map-like)
        if (node.parameters && typeof node.parameters.has === 'function' && node.parameters.has(normalizedParam)) {
            const audioParam = node.parameters.get(normalizedParam);
            if (audioParam?.setValueAtTime) {
                const now = engine.audioContext.currentTime;
                audioParam.cancelScheduledValues(now);
                audioParam.setValueAtTime(audioParam.value, now);
                audioParam.linearRampToValueAtTime(value, now + 0.015);
                effect.settings[normalizedParam] = value;
                return;
            }
        }

        // Handle direct node properties
        if (normalizedParam in node) {
            node[normalizedParam] = value;
            effect.settings[normalizedParam] = value;
            return;
        }

        // Handle custom updateParameter method
        if (node.updateParameter) {
            node.updateParameter(normalizedParam, value);
            effect.settings[normalizedParam] = value;
            return;
        }

        // Fallback: just update settings
        effect.settings[normalizedParam] = value;
    }

    // =================== TOGGLE BYPASS ===================

    /**
     * Toggle effect bypass state
     * @param {string} trackId - Mixer track ID
     * @param {string} effectId - Effect ID
     * @param {boolean} bypass - Bypass state
     */
    static toggleBypass(trackId, effectId, bypass) {
        const engine = this._getEngine();
        if (!engine?.mixerInserts) return;

        const insert = engine.mixerInserts.get(trackId);
        if (insert) {
            insert.setEffectBypass(effectId, bypass);
        }
    }

    // =================== REORDER EFFECTS ===================

    /**
     * Reorder effects in a mixer insert
     * @param {string} trackId - Mixer track ID
     * @param {number} sourceIndex - Source index
     * @param {number} destinationIndex - Destination index
     */
    static reorderEffects(trackId, sourceIndex, destinationIndex) {
        const engine = this._getEngine();
        if (!engine?.mixerInserts) return;

        const insert = engine.mixerInserts.get(trackId);
        if (insert?.reorderEffects) {
            insert.reorderEffects(sourceIndex, destinationIndex);
        }
    }

    // =================== GET EFFECT NODE ===================

    /**
     * Get effect node by ID (with fallback lookups)
     * @param {string} trackId - Mixer track ID
     * @param {string} effectId - Effect ID
     * @returns {AudioNode|null}
     */
    static getEffectNode(trackId, effectId) {
        const engine = this._getEngine();
        if (!engine?.mixerInserts) return null;

        const insert = engine.mixerInserts.get(trackId);
        if (!insert?.effects) return null;

        // Direct lookup
        let effect = insert.effects.get(effectId);

        // Fallback lookups
        if (!effect) {
            effect = Array.from(insert.effects.values()).find(fx => fx.id === effectId);
        }
        if (!effect) {
            effect = Array.from(insert.effects.values()).find(fx => fx.audioEngineId === effectId);
        }
        if (!effect) {
            effect = Array.from(insert.effects.values()).find(fx => fx.type === effectId);
        }

        return effect?.node || null;
    }

    /**
     * Get effect audio node (same as getEffectNode, for compatibility)
     * @param {string} trackId - Mixer track ID
     * @param {string} effectId - Effect ID
     * @returns {AudioNode|null}
     */
    static getEffectAudioNode(trackId, effectId) {
        return this.getEffectNode(trackId, effectId);
    }

    // =================== REBUILD MASTER CHAIN ===================

    /**
     * Rebuild master channel effect chain
     * @param {object} trackState - Track state with insertEffects array
     */
    static async rebuildMasterChain(trackState) {
        const engine = this._getEngine();
        if (!engine?.mixerInserts) return;

        const masterInsert = engine.mixerInserts.get('master');
        if (!masterInsert) return;

        try {
            // Remove all existing effects
            const existingEffectIds = Array.from(masterInsert.effects.keys());
            for (const effectId of existingEffectIds) {
                masterInsert.removeEffect(effectId);
            }

            // Add effects from track state
            const insertEffects = trackState?.insertEffects || [];
            for (const effectConfig of insertEffects) {
                const effectNode = await effectRegistry.createEffectNode(
                    effectConfig.type,
                    engine.audioContext,
                    effectConfig.settings
                );

                if (effectNode) {
                    masterInsert.addEffect(
                        effectConfig.id,
                        effectNode,
                        effectConfig.settings,
                        effectConfig.bypass || false,
                        effectConfig.type
                    );

                    if (!effectConfig.bypass) {
                        masterInsert.setEffectBypass(effectConfig.id, false);
                    }
                }
            }
        } catch (error) {
            console.error('EffectService: Error rebuilding master chain:', error);
        }
    }

    /**
     * Rebuild signal chain for a track
     * @param {string} trackId - Track ID
     * @param {object} trackState - Track state
     */
    static async rebuildSignalChain(trackId, trackState) {
        if (trackId === 'master') {
            return this.rebuildMasterChain(trackState);
        }
        // Dynamic mixer handles standard tracks automatically
    }
}
