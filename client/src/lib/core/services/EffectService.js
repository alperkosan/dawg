/**
 * EffectService - Extracted from NativeAudioEngine
 * 
 * Handles all audio effect management:
 * - Effect creation and destruction
 * - Effect chain management per mixer insert
 * - Effect parameter control
 * - Master effect chain
 * 
 * @module lib/core/services/EffectService
 */

import { EffectFactory } from '../../audio/effects/index.js';
import { effectRegistry } from '../../audio/EffectRegistry.js';
import { logger, NAMESPACES } from '../../utils/debugLogger.js';

export class EffectService {
    /**
     * @param {NativeAudioEngine} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;
        this.effects = new Map(); // effectId -> effect instance
        this.effectIdToInsertId = new Map(); // effectId -> insertId
        this.metrics = {
            effectsCreated: 0
        };
    }

    /**
     * Get audio context from parent engine
     */
    get audioContext() {
        return this.engine.audioContext;
    }

    /**
     * Get mixer inserts from engine
     */
    get mixerInserts() {
        return this.engine.mixerInserts || this.engine.mixerService?.mixerInserts;
    }

    /**
     * Add an effect to a mixer insert
     * @param {string} insertId - Mixer insert ID
     * @param {string} effectType - Effect type (e.g., 'reverb', 'delay')
     * @param {Object} settings - Initial effect settings
     * @param {string} storeEffectId - Optional store effect ID for mapping
     * @returns {string|null} Audio engine effect ID or null on failure
     */
    addEffect(insertId, effectType, settings = {}, storeEffectId = null) {
        const insert = this.mixerInserts?.get(insertId);
        if (!insert) {
            logger.error(NAMESPACES.AUDIO, `MixerInsert ${insertId} not found for effect`);
            return null;
        }

        try {
            // Create effect using factory
            const effect = EffectFactory.createEffect(this.audioContext, effectType, settings);

            if (!effect) {
                logger.error(NAMESPACES.AUDIO, `Failed to create effect: ${effectType}`);
                return null;
            }

            // Add to mixer insert chain
            // ✅ FIX: Use effect.id instead of waiting for return value (MixerInsert.addEffect is void)
            // Signature: addEffect(effectId, effectNode, settings, bypass, type)
            const audioEffectId = effect.id;
            insert.addEffect(audioEffectId, effect, settings, false, effectType);

            if (audioEffectId) {
                // Store mapping
                this.effects.set(audioEffectId, { effect, type: effectType, insertId });
                this.effectIdToInsertId.set(audioEffectId, insertId);

                // Store mapping for store effect ID if provided
                if (storeEffectId && storeEffectId !== audioEffectId) {
                    this.effects.set(storeEffectId, { effect, type: effectType, insertId, audioEffectId });
                }

                this.metrics.effectsCreated++;
                logger.info(NAMESPACES.AUDIO, `Added effect ${effectType} to ${insertId}: ${audioEffectId}`);

                return audioEffectId;
            }

            return null;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to add effect ${effectType} to ${insertId}:`, error);
            return null;
        }
    }

    /**
     * Remove an effect from a mixer insert
     * @param {string} insertId - Mixer insert ID
     * @param {string} effectId - Effect ID
     * @returns {boolean}
     */
    removeEffect(insertId, effectId) {
        const insert = this.mixerInserts?.get(insertId);
        if (!insert) {
            logger.warn(NAMESPACES.AUDIO, `MixerInsert ${insertId} not found`);
            return false;
        }

        try {
            const success = insert.removeEffect(effectId);

            if (success) {
                this.effects.delete(effectId);
                this.effectIdToInsertId.delete(effectId);
                logger.info(NAMESPACES.AUDIO, `Removed effect ${effectId} from ${insertId}`);
            }

            return success;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to remove effect ${effectId}:`, error);
            return false;
        }
    }

    /**
     * Toggle effect bypass
     * @param {string} insertId - Mixer insert ID
     * @param {string} effectId - Effect ID
     * @returns {boolean}
     */
    toggleEffect(insertId, effectId) {
        const insert = this.mixerInserts?.get(insertId);
        if (!insert) return false;

        try {
            return insert.toggleEffect(effectId);
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to toggle effect ${effectId}:`, error);
            return false;
        }
    }

    /**
     * Update effect parameters
     * @param {string} insertId - Mixer insert ID
     * @param {string} effectId - Effect ID
     * @param {string|Object} paramOrSettings - Parameter name or settings object
     * @param {any} value - Parameter value (if paramOrSettings is a string)
     * @returns {boolean}
     */
    updateEffect(insertId, effectId, paramOrSettings, value = undefined) {
        const insert = this.mixerInserts?.get(insertId);
        if (!insert) return false;

        try {
            if (typeof paramOrSettings === 'string') {
                // Single parameter update
                return insert.setEffectParam(effectId, paramOrSettings, value);
            } else {
                // Multiple parameters update
                Object.entries(paramOrSettings).forEach(([param, val]) => {
                    insert.setEffectParam(effectId, param, val);
                });
                return true;
            }
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to update effect ${effectId}:`, error);
            return false;
        }
    }

    /**
     * Reorder effects in a mixer insert
     * @param {string} insertId - Mixer insert ID
     * @param {number} sourceIndex - Source position
     * @param {number} destIndex - Destination position
     * @returns {boolean}
     */
    reorderEffect(insertId, sourceIndex, destIndex) {
        const insert = this.mixerInserts?.get(insertId);
        if (!insert) return false;

        try {
            return insert.reorderEffect(sourceIndex, destIndex);
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to reorder effects in ${insertId}:`, error);
            return false;
        }
    }

    /**
     * Get effect chain for a mixer insert
     * @param {string} insertId - Mixer insert ID
     * @returns {Array}
     */
    getEffectChain(insertId) {
        const insert = this.mixerInserts?.get(insertId);
        return insert?.getEffectChain() || [];
    }

    /**
     * Get available effect types
     * @returns {Array<string>}
     */
    getAvailableEffectTypes() {
        return effectRegistry.getAvailableEffects() || [];
    }

    /**
     * Get effect info by ID
     * @param {string} effectId 
     * @returns {Object|undefined}
     */
    getEffect(effectId) {
        return this.effects.get(effectId);
    }

    /**
     * Clear all effects from a mixer insert
     * @param {string} insertId - Mixer insert ID
     * @returns {boolean}
     */
    clearEffects(insertId) {
        const insert = this.mixerInserts?.get(insertId);
        if (!insert) return false;

        try {
            insert.clearEffects();

            // Remove from tracking
            for (const [effectId, data] of this.effects.entries()) {
                if (data.insertId === insertId) {
                    this.effects.delete(effectId);
                    this.effectIdToInsertId.delete(effectId);
                }
            }

            logger.info(NAMESPACES.AUDIO, `Cleared all effects from ${insertId}`);
            return true;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to clear effects from ${insertId}:`, error);
            return false;
        }
    }

    /**
     * Dispose all effects
     */
    dispose() {
        this.effects.forEach((data, effectId) => {
            try {
                if (data.effect?.dispose) {
                    data.effect.dispose();
                }
            } catch (error) {
                logger.warn(NAMESPACES.AUDIO, `Error disposing effect ${effectId}:`, error);
            }
        });

        this.effects.clear();
        this.effectIdToInsertId.clear();

        logger.info(NAMESPACES.AUDIO, 'EffectService disposed');
    }
}
