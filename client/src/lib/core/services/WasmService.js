/**
 * WasmService - WASM Audio Processing Service
 * 
 * Manages WASM module lifecycle and provides high-level API for:
 * - WASM module loading and initialization
 * - UnifiedMixer integration
 * - WASM-based instrument routing
 * - Performance monitoring
 * 
 * @module lib/core/services/WasmService
 */

import { logger, NAMESPACES } from '../../utils/debugLogger.js';
import { UnifiedMixerNode } from '../UnifiedMixerNode.js';
import { wasmAudioEngine } from '../WasmAudioEngine.js';

export class WasmService {
    /**
     * @param {Object} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;

        // WASM state
        this.isInitialized = false;
        this.wasmModule = null;
        this.wasmGraph = null;

        // UnifiedMixer
        this.unifiedMixer = null;
        this.useWasmMixer = true;

        // Channel allocation
        this.channelAllocator = new Map(); // insertId -> channelIdx
        this.nextChannelIdx = 0;
        this.maxChannels = 32;

        // Effect allocation (NEW)
        this.nextEffectId = 0;
        this.activeEffects = new Map(); // effectId -> effect metadata

        // Performance stats
        this.stats = {
            mixerProcessTime: 0,
            mixerPeakTime: 0,
            mixerSamplesProcessed: 0,
            wasmHeapUsed: 0
        };
    }

    /**
     * Get audio context from parent engine
     */
    get audioContext() {
        return this.engine.audioContext;
    }

    /**
     * Initialize WASM subsystem
     * @returns {Promise<boolean>}
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            logger.info(NAMESPACES.AUDIO, '🚀 Initializing WasmService...');

            // 1. Initialize WASM Audio Engine
            await wasmAudioEngine.initialize(this.audioContext);
            this.wasmGraph = wasmAudioEngine.getGraph();

            logger.info(NAMESPACES.AUDIO, '✅ WASM Audio Engine initialized');

            // 2. Initialize UnifiedMixer (WASM-based multi-channel mixer)
            if (this.useWasmMixer) {
                await this._initializeUnifiedMixer();
            }

            this.isInitialized = true;
            logger.info(NAMESPACES.AUDIO, '✅ WasmService fully initialized');

            return true;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, '❌ WasmService initialization failed:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Initialize UnifiedMixer with WASM backend
     * @private
     */
    async _initializeUnifiedMixer() {
        try {
            this.unifiedMixer = new UnifiedMixerNode(this.audioContext, this.maxChannels);
            await this.unifiedMixer.initialize();

            // Connect mixer output to master bus
            if (this.engine.masterBusInput) {
                this.unifiedMixer.connect(this.engine.masterBusInput);
                logger.info(NAMESPACES.AUDIO, '✅ UnifiedMixer connected to Master Bus');
            }

            // Set up level update callback
            this.unifiedMixer.onLevelsUpdate = (levels) => {
                this._processLevels(levels);
            };

            logger.info(NAMESPACES.AUDIO, '✅ UnifiedMixer initialized with WASM backend');
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, '❌ UnifiedMixer initialization failed:', error);
            this.useWasmMixer = false;
            throw error;
        }
    }

    /**
     * Allocate a WASM mixer channel for an insert
     * @param {string} insertId - Mixer insert ID
     * @returns {number} Channel index or -1 if failed
     */
    allocateChannel(insertId) {
        if (!this.useWasmMixer || !this.unifiedMixer) {
            return -1;
        }

        // Check if already allocated
        if (this.channelAllocator.has(insertId)) {
            return this.channelAllocator.get(insertId);
        }

        // Allocate new channel
        if (this.nextChannelIdx < this.maxChannels) {
            const channelIdx = this.nextChannelIdx++;
            this.channelAllocator.set(insertId, channelIdx);

            logger.debug(NAMESPACES.AUDIO, `🎫 Allocated WASM channel ${channelIdx} for ${insertId}`);
            return channelIdx;
        }

        logger.warn(NAMESPACES.AUDIO, `⚠️ No available WASM channels for ${insertId}`);
        return -1;
    }

    /**
     * Free a WASM mixer channel
     * @param {string} insertId - Mixer insert ID
     */
    freeChannel(insertId) {
        if (this.channelAllocator.has(insertId)) {
            const channelIdx = this.channelAllocator.get(insertId);
            this.channelAllocator.delete(insertId);

            logger.debug(NAMESPACES.AUDIO, `🗑️ Freed WASM channel ${channelIdx} for ${insertId}`);
        }
    }

    /**
   * Get WASM channel for an insert
   * @param {string} insertId 
   * @returns {number} Channel index or -1
   */
    getChannelForInsert(insertId) {
        return this.channelAllocator.get(insertId) ?? -1;
    }

    // ============================================================================
    // EFFECT MANAGEMENT (for UnifiedEffect)
    // ============================================================================

    /**
     * Create WASM effect instance
     * @param {number} wasmEffectTypeId - WASM effect type ID from WASM_EFFECT_TYPE_MAP
     * @returns {number} Effect ID or -1 if failed
     */
    createEffect(wasmEffectTypeId) {
        if (!this.isInitialized || !this.wasmGraph) {
            logger.warn(NAMESPACES.AUDIO, 'WASM not initialized, cannot create effect');
            return -1;
        }

        try {
            const effectId = this.nextEffectId++;
            let wasmInstance = null;
            let effectType = null;

            // Map effect type ID to WASM class
            switch (wasmEffectTypeId) {
                // === DYNAMICS (0-9) ===
                case 0: // compressor
                    effectType = 'compressor';
                    wasmInstance = new wasmAudioEngine.wasmModule.Compressor(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM Compressor (ID: ${effectId})`);
                    break;

                case 1: // saturator
                    effectType = 'saturator';
                    wasmInstance = new wasmAudioEngine.wasmModule.Saturator(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM Saturator (ID: ${effectId})`);
                    break;

                case 2: // limiter
                    effectType = 'limiter';
                    wasmInstance = new wasmAudioEngine.wasmModule.Limiter(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM Limiter (ID: ${effectId})`);
                    break;

                case 3: // clipper
                    effectType = 'clipper';
                    wasmInstance = new wasmAudioEngine.wasmModule.Clipper(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM Clipper (ID: ${effectId})`);
                    break;

                // === EQ & FILTERS (10-19) ===
                case 10: // multiband-eq
                    effectType = 'eq';
                    wasmInstance = new wasmAudioEngine.wasmModule.ThreeBandEQ(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM ThreeBandEQ (ID: ${effectId})`);
                    break;

                // === SPACETIME (20-29) ===
                case 20: // modern-reverb
                    effectType = 'reverb';
                    wasmInstance = new wasmAudioEngine.wasmModule.ReverbProcessor(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM ReverbProcessor (ID: ${effectId})`);
                    break;

                case 21: // modern-delay
                case 22: // feedback-delay
                    effectType = 'delay';
                    wasmInstance = new wasmAudioEngine.wasmModule.SimpleDelay(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM SimpleDelay (ID: ${effectId})`);
                    break;

                // === MODULATION (30-39) ===
                case 30: // stardust-chorus
                    effectType = 'chorus';
                    wasmInstance = new wasmAudioEngine.wasmModule.Chorus(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM Chorus (ID: ${effectId})`);
                    break;

                case 31: // vortex-phaser
                    effectType = 'phaser';
                    wasmInstance = new wasmAudioEngine.wasmModule.Phaser(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM Phaser (ID: ${effectId})`);
                    break;

                case 32: // orbit-panner
                    effectType = 'panner';
                    wasmInstance = new wasmAudioEngine.wasmModule.StereoPanner(this.audioContext.sampleRate);
                    logger.info(NAMESPACES.AUDIO, `✅ Created WASM StereoPanner (ID: ${effectId})`);
                    break;

                default:
                    logger.warn(NAMESPACES.AUDIO, `WASM effect type ${wasmEffectTypeId} not yet implemented, using placeholder`);
                    // Create placeholder for unsupported effects
                    effectType = 'placeholder';
                    wasmInstance = { type: 'placeholder', typeId: wasmEffectTypeId };
            }

            // Store effect metadata
            this.activeEffects.set(effectId, {
                id: effectId,
                wasmTypeId: wasmEffectTypeId,
                effectType,
                instance: wasmInstance,
                parameters: new Map(), // Track parameter values
                createdAt: Date.now()
            });

            logger.info(NAMESPACES.AUDIO, `✅ Created WASM effect ID: ${effectId} (type: ${effectType})`);
            return effectId;

        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `❌ Failed to create WASM effect type ${wasmEffectTypeId}:`, error);
            return -1;
        }
    }

    /**
     * Destroy WASM effect instance
     * @param {number} effectId - Effect ID from createEffect()
     */
    destroyEffect(effectId) {
        const effect = this.activeEffects.get(effectId);

        if (!effect) {
            logger.warn(NAMESPACES.AUDIO, `Effect ${effectId} not found`);
            return;
        }

        try {
            // Free WASM memory if available
            if (effect.instance?.free) {
                effect.instance.free();
            }

            this.activeEffects.delete(effectId);
            logger.info(NAMESPACES.AUDIO, `✅ Destroyed WASM effect ID: ${effectId}`);

        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `❌ Failed to destroy effect ${effectId}:`, error);
        }
    }

    /**
     * Set WASM effect parameter
     * @param {number} effectId - Effect ID
     * @param {number} paramIndex - Parameter index
     * @param {number} value - Parameter value
     */
    setEffectParameter(effectId, paramIndex, value) {
        const effect = this.activeEffects.get(effectId);

        if (!effect) {
            logger.debug(NAMESPACES.AUDIO, `Effect ${effectId} not found`);
            return;
        }

        try {
            // Store parameter value
            effect.parameters.set(paramIndex, value);

            const instance = effect.instance;

            // Map parameters to WASM methods based on effect type
            switch (effect.effectType) {
                case 'reverb':
                    // ReverbProcessor parameters (called during process())
                    // Parameters stored for use in process() call
                    break;

                case 'delay':
                    // SimpleDelay has set methods
                    if (paramIndex === 0 && instance.set_time) {
                        instance.set_time(value); // time in seconds
                    } else if (paramIndex === 1 && instance.set_feedback) {
                        instance.set_feedback(value);
                    } else if (paramIndex === 2 && instance.set_mix) {
                        instance.set_mix(value);
                    }
                    break;

                case 'eq':
                    // ThreeBandEQ parameters
                    if (instance.set_low_gain && paramIndex === 0) {
                        instance.set_low_gain(value);
                    } else if (instance.set_mid_gain && paramIndex === 1) {
                        instance.set_mid_gain(value);
                    } else if (instance.set_high_gain && paramIndex === 2) {
                        instance.set_high_gain(value);
                    }
                    break;

                case 'compressor':
                    // Compressor parameters
                    if (paramIndex === 0 && instance.set_threshold) {
                        instance.set_threshold(value);
                    } else if (paramIndex === 1 && instance.set_ratio) {
                        instance.set_ratio(value);
                    } else if (paramIndex === 2 && instance.set_attack) {
                        instance.set_attack(value);
                    } else if (paramIndex === 3 && instance.set_release) {
                        instance.set_release(value);
                    } else if (paramIndex === 4 && instance.set_knee) {
                        instance.set_knee(value);
                    } else if (paramIndex === 5 && instance.set_makeup_gain) {
                        instance.set_makeup_gain(value);
                    }
                    break;

                case 'saturator':
                    // Saturator parameters
                    if (paramIndex === 0 && instance.set_drive) {
                        instance.set_drive(value);
                    } else if (paramIndex === 1 && instance.set_mix) {
                        instance.set_mix(value);
                    } else if (paramIndex === 2 && instance.set_mode) {
                        instance.set_mode(Math.round(value));
                    } else if (paramIndex === 3 && instance.set_output_gain) {
                        instance.set_output_gain(value);
                    }
                    break;

                case 'limiter':
                    // Limiter parameters
                    if (paramIndex === 0 && instance.set_threshold) {
                        instance.set_threshold(value);
                    } else if (paramIndex === 1 && instance.set_release) {
                        instance.set_release(value);
                    } else if (paramIndex === 2 && instance.set_ceiling) {
                        instance.set_ceiling(value);
                    }
                    break;

                case 'clipper':
                    // Clipper parameters
                    if (paramIndex === 0 && instance.set_threshold) {
                        instance.set_threshold(value);
                    } else if (paramIndex === 1 && instance.set_softness) {
                        instance.set_softness(value);
                    }
                    break;

                case 'chorus':
                    // Chorus parameters
                    if (paramIndex === 0 && instance.set_rate) {
                        instance.set_rate(value);
                    } else if (paramIndex === 1 && instance.set_depth) {
                        instance.set_depth(value);
                    } else if (paramIndex === 2 && instance.set_mix) {
                        instance.set_mix(value);
                    }
                    break;

                case 'phaser':
                    // Phaser parameters
                    if (paramIndex === 0 && instance.set_rate) {
                        instance.set_rate(value);
                    } else if (paramIndex === 1 && instance.set_depth) {
                        instance.set_depth(value);
                    } else if (paramIndex === 2 && instance.set_feedback) {
                        instance.set_feedback(value);
                    } else if (paramIndex === 3 && instance.set_stages) {
                        instance.set_stages(Math.round(value));
                    } else if (paramIndex === 4 && instance.set_mix) {
                        instance.set_mix(value);
                    }
                    break;

                case 'panner':
                    // StereoPanner parameters
                    if (paramIndex === 0 && instance.set_pan) {
                        instance.set_pan(value);
                    } else if (paramIndex === 1 && instance.set_width) {
                        instance.set_width(value);
                    } else if (paramIndex === 2 && instance.set_lfo_rate) {
                        instance.set_lfo_rate(value);
                    } else if (paramIndex === 3 && instance.set_lfo_depth) {
                        instance.set_lfo_depth(value);
                    }
                    break;

                case 'placeholder':
                    // Just store the value
                    logger.debug(NAMESPACES.AUDIO, `Placeholder effect ${effectId} param ${paramIndex} = ${value}`);
                    break;
            }

            logger.debug(NAMESPACES.AUDIO, `Set effect ${effectId} param ${paramIndex} = ${value}`);

        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to set param on effect ${effectId}:`, error);
        }
    }

    /**
     * Get WASM effect parameter
     * @param {number} effectId - Effect ID
     * @param {number} paramIndex - Parameter index
     * @returns {number} Parameter value
     */
    getEffectParameter(effectId, paramIndex) {
        const effect = this.activeEffects.get(effectId);

        if (!effect) {
            return 0;
        }

        // Return stored parameter value
        return effect.parameters.get(paramIndex) || 0;
    }

    /**
     * Get WASM effect statistics
     * @param {number} effectId - Effect ID
     * @returns {Object} Performance stats
     */
    getEffectStats(effectId) {
        const effect = this.activeEffects.get(effectId);

        if (!effect) {
            return {
                cpuTime: 0,
                sampleCount: 0,
                exists: false
            };
        }

        return {
            cpuTime: 0, // TODO: Measure processing time
            sampleCount: 0, // TODO: Track samples processed
            exists: true,
            effectType: effect.effectType,
            wasmTypeId: effect.wasmTypeId,
            parameterCount: effect.parameters.size
        };
    }

    /**
     * Get effect instance (for direct WASM processing)
     * @param {number} effectId - Effect ID
     * @returns {Object|null} WASM effect instance
     */
    getEffectInstance(effectId) {
        const effect = this.activeEffects.get(effectId);
        return effect?.instance || null;
    }

    /**
     * Connect audio source to WASM mixer channel
         * @param {AudioNode} source - Audio source node
         * @param {string} insertId - Mixer insert ID
         * @returns {boolean} Success
         */
    connectToChannel(source, insertId) {
        if (!this.unifiedMixer || !source) {
            return false;
        }

        const channelIdx = this.getChannelForInsert(insertId);
        if (channelIdx === -1) {
            // Try to allocate
            const newIdx = this.allocateChannel(insertId);
            if (newIdx === -1) return false;
        }

        try {
            this.unifiedMixer.connectToChannel(source, this.getChannelForInsert(insertId));
            logger.debug(NAMESPACES.AUDIO, `🔗 Connected source to WASM channel for ${insertId}`);
            return true;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `❌ Failed to connect to WASM channel:`, error);
            return false;
        }
    }

    /**
     * Disconnect from WASM mixer channel
     * @param {string} insertId 
     */
    disconnectFromChannel(insertId) {
        if (!this.unifiedMixer) return;

        const channelIdx = this.getChannelForInsert(insertId);
        if (channelIdx !== -1) {
            try {
                this.unifiedMixer.disconnectChannel(channelIdx);
                logger.debug(NAMESPACES.AUDIO, `🔌 Disconnected WASM channel ${channelIdx} for ${insertId}`);
            } catch (error) {
                logger.warn(NAMESPACES.AUDIO, `⚠️ Failed to disconnect channel:`, error);
            }
        }
    }

    /**
     * Set WASM channel parameters
     * @param {string} insertId 
     * @param {Object} params - { gain, pan, mute, solo, eq, etc. }
     */
    setChannelParams(insertId, params) {
        if (!this.unifiedMixer) return;

        const channelIdx = this.getChannelForInsert(insertId);
        if (channelIdx === -1) return;

        try {
            this.unifiedMixer.setChannelParams(channelIdx, params);
        } catch (error) {
            logger.warn(NAMESPACES.AUDIO, `⚠️ Failed to set channel params:`, error);
        }
    }

    /**
     * Add WASM effect to channel
     * @param {string} insertId 
     * @param {number} effectType - WASM effect type ID
     * @returns {boolean} Success
     */
    addChannelEffect(insertId, effectType) {
        if (!this.unifiedMixer) return false;

        const channelIdx = this.getChannelForInsert(insertId);
        if (channelIdx === -1) return false;

        try {
            this.unifiedMixer.addChannelEffect(channelIdx, effectType);
            logger.info(NAMESPACES.AUDIO, `✨ Added WASM effect type ${effectType} to channel ${channelIdx}`);
            return true;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `❌ Failed to add WASM effect:`, error);
            return false;
        }
    }

    /**
     * Get WASM effect type ID from effect name
     * @param {string} effectName 
     * @returns {number} WASM effect type ID or -1
     */
    getWasmEffectType(effectName) {
        // Map effect names to WASM type IDs
        const effectMap = {
            'eq': 0,
            'eq3band': 0,
            'compressor': 1,
            'limiter': 2,
            'reverb': 3,
            'delay': 4,
            'filter': 5
        };

        return effectMap[effectName.toLowerCase()] ?? -1;
    }

    /**
     * Process level updates from WASM mixer
     * @private
     */
    _processLevels(levels) {
        // Forward to engine callback
        if (this.engine.callbacks?.onLevelsUpdate) {
            this.engine.callbacks.onLevelsUpdate(levels);
        }

        // Update mixer store if available
        if (typeof window !== 'undefined' && window.__DAWG_STORES__?.useMixerStore) {
            const store = window.__DAWG_STORES__.useMixerStore;
            store.getState().batchUpdateLevels(levels);
        }
    }

    /**
     * Get WASM service stats
     * @returns {Object}
     */
    getStats() {
        const mixerStats = this.unifiedMixer?.getStats() || {};

        return {
            isInitialized: this.isInitialized,
            useWasmMixer: this.useWasmMixer,
            allocatedChannels: this.channelAllocator.size,
            maxChannels: this.maxChannels,
            mixer: mixerStats,
            ...this.stats
        };
    }

    /**
     * Get allocated channels info
     * @returns {Array}
     */
    getAllocatedChannels() {
        return Array.from(this.channelAllocator.entries()).map(([insertId, channelIdx]) => ({
            insertId,
            channelIdx
        }));
    }

    /**
     * Dispose WASM service
     */
    dispose() {
        try {
            // Dispose UnifiedMixer
            if (this.unifiedMixer) {
                this.unifiedMixer.dispose();
                this.unifiedMixer = null;
            }

            // Clear allocations
            this.channelAllocator.clear();
            this.nextChannelIdx = 0;

            // Dispose WASM graph
            if (this.wasmGraph) {
                wasmAudioEngine.dispose();
                this.wasmGraph = null;
            }

            this.isInitialized = false;
            logger.info(NAMESPACES.AUDIO, '✅ WasmService disposed');
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, '❌ WasmService dispose error:', error);
        }
    }
}
