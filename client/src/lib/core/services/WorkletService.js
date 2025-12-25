/**
 * WorkletService - Extracted from NativeAudioEngine
 * 
 * Handles all AudioWorklet management:
 * - Worklet loading and initialization
 * - Worklet node creation
 * - Worklet communication
 * 
 * @module lib/core/services/WorkletService
 */

import { logger, NAMESPACES } from '../../utils/debugLogger.js';

/**
 * Default worklet configurations
 */
const DEFAULT_WORKLETS = [
    { path: '/worklets/text-encoder-polyfill.js', name: 'text-encoder-polyfill' },
    { path: '/worklets/instrument-processor.js', name: 'instrument-processor' },
    { path: '/worklets/mixer-processor.js', name: 'mixer-processor' },
    { path: '/worklets/analysis-processor.js', name: 'analysis-processor' },
    { path: '/worklets/wasm-sampler-processor.js', name: 'wasm-sampler-processor' }
];

export class WorkletService {
    /**
     * @param {NativeAudioEngine} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;
        this.loadedWorklets = new Set();
        this.workletNodes = new Map();
    }

    /**
     * Get audio context from parent engine
     */
    get audioContext() {
        return this.engine.audioContext;
    }

    /**
     * Get worklet manager from parent engine
     */
    get workletManager() {
        return this.engine.workletManager;
    }

    /**
     * Load all required worklets
     * @param {Array} workletConfigs - Optional custom worklet configs
     * @returns {Promise<{successful: number, failed: number}>}
     */
    async loadRequiredWorklets(workletConfigs = DEFAULT_WORKLETS) {
        if (!this.workletManager) {
            throw new Error('WorkletManager not initialized');
        }

        try {
            const results = await this.workletManager.loadMultipleWorklets(workletConfigs);

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.length - successful;

            // Track loaded worklets
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    this.loadedWorklets.add(workletConfigs[index].name);
                }
            });

            if (successful === 0) {
                throw new Error('No worklets could be loaded');
            }

            logger.info(NAMESPACES.AUDIO, `Worklets loaded: ${successful}/${results.length}`);

            return { successful, failed };
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, 'Failed to load worklets:', error);
            throw error;
        }
    }

    /**
     * Check if a worklet is loaded
     * @param {string} workletName 
     * @returns {boolean}
     */
    isWorkletLoaded(workletName) {
        return this.loadedWorklets.has(workletName);
    }

    /**
     * Create an AudioWorkletNode
     * @param {string} processorName - Name of the processor
     * @param {Object} options - AudioWorkletNode options
     * @returns {AudioWorkletNode}
     */
    createWorkletNode(processorName, options = {}) {
        if (!this.audioContext) {
            throw new Error('AudioContext not initialized');
        }

        try {
            const node = new AudioWorkletNode(this.audioContext, processorName, options);

            // Store reference for cleanup
            const nodeId = `${processorName}-${Date.now()}`;
            this.workletNodes.set(nodeId, node);

            logger.debug(NAMESPACES.AUDIO, `Created worklet node: ${processorName}`);

            return node;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, `Failed to create worklet node ${processorName}:`, error);
            throw error;
        }
    }

    /**
     * Send a message to a worklet node
     * @param {AudioWorkletNode} node 
     * @param {Object} message 
     */
    sendToWorklet(node, message) {
        if (node && node.port) {
            node.port.postMessage(message);
        }
    }

    /**
     * Get detailed stats from worklet manager
     * @returns {Object}
     */
    getStats() {
        return this.workletManager?.getDetailedStats() || {
            loadedWorklets: Array.from(this.loadedWorklets),
            activeNodes: this.workletNodes.size
        };
    }

    /**
     * Get list of loaded worklets
     * @returns {Array<string>}
     */
    getLoadedWorklets() {
        return Array.from(this.loadedWorklets);
    }

    /**
     * Dispose all worklet nodes
     */
    dispose() {
        this.workletNodes.forEach((node, id) => {
            try {
                node.disconnect();
                if (node.port) {
                    node.port.close();
                }
            } catch (error) {
                logger.warn(NAMESPACES.AUDIO, `Error disposing worklet node ${id}:`, error);
            }
        });

        this.workletNodes.clear();
        this.loadedWorklets.clear();

        if (this.workletManager?.dispose) {
            this.workletManager.dispose();
        }

        logger.info(NAMESPACES.AUDIO, 'WorkletService disposed');
    }
}
