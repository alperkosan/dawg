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
