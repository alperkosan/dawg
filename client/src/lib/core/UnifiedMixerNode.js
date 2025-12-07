/**
 * UnifiedMixerNode - High-level wrapper for WASM MegaMixer
 *
 * Manages the UnifiedMixerWorklet and provides a clean API for:
 * - Multi-channel input (up to 32 stereo channels)
 * - Per-channel gain, pan, mute, solo
 * - Per-channel EQ and compression
 * - Performance monitoring
 *
 * Expected performance gain: 11x faster mixer (168% CPU → 15% CPU)
 */

import { logger } from '../utils/debugLogger.js';

export class UnifiedMixerNode {
    /**
     * Create UnifiedMixerNode
     *
     * @param {AudioContext} audioContext - Web Audio context
     * @param {number} numChannels - Number of input channels (default: 32)
     */
    constructor(audioContext, numChannels = 32) {
        this.audioContext = audioContext;
        this.numChannels = numChannels;
        this.workletNode = null;
        this.isInitialized = false;

        // WASM module
        this.wasmModule = null;

        // Channel connections (track what's connected to each input)
        this.channelConnections = new Map();

        // Statistics
        this.stats = {
            samplesProcessed: 0,
            averageTime: 0,
            peakTime: 0,
            processCount: 0
        };

        // Callbacks
        this.onLevelsUpdate = null;
    }

    /**
     * Initialize the unified mixer
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing UnifiedMixerNode...');

            // Load WASM module
            await this._loadWasmModule();

            // Create AudioWorkletNode
            await this._createWorkletNode();

            // Initialize WASM in worklet
            await this._initializeWasmInWorklet();

            this.isInitialized = true;
            logger.info('✅ UnifiedMixerNode initialized successfully');

            return true;
        } catch (error) {
            logger.error('❌ Failed to initialize UnifiedMixerNode:', error);
            throw error;
        }
    }

    /**
     * Load WASM module and get exports
     */
    async _loadWasmModule() {
        try {
            // Dynamic import to bypass Vite bundling
            const dynamicImport = new Function('path', 'return import(path)');
            this.wasmModule = await dynamicImport(`/wasm/dawg_audio_dsp.js?t=${Date.now()}`);
            await this.wasmModule.default();

            logger.info('✅ WASM module loaded in main thread');
        } catch (error) {
            logger.error('❌ Failed to load WASM module:', error);
            throw error;
        }
    }

    /**
     * Create AudioWorkletNode
     */
    async _createWorkletNode() {
        try {
            // Register worklet module (only if not already registered)
            // Use public folder to avoid Vite bundling issues
            const workletPath = `/worklets/UnifiedMixerWorklet.js?t=${Date.now()}`;

            try {
                await this.audioContext.audioWorklet.addModule(workletPath);
            } catch (error) {
                // If already registered, that's fine
                if (!error.message.includes('already registered')) {
                    throw error;
                }
                logger.debug('Worklet already registered, reusing');
            }

            this.workletNode = new AudioWorkletNode(
                this.audioContext,
                'unified-mixer-worklet',
                {
                    numberOfInputs: this.numChannels,
                    numberOfOutputs: 1,
                    outputChannelCount: [2],
                    channelCount: 2,  // Default channel count for connections
                    channelCountMode: 'explicit',  // Don't auto-adjust channel count
                    channelInterpretation: 'speakers',  // Stereo interpretation
                    processorOptions: {
                        maxBlockSize: 4096,
                        numChannels: this.numChannels
                    }
                }
            );

            // Handle messages from worklet (stats, errors, meters)
            this.workletNode.port.onmessage = (event) => {
                const { type, data, levels } = event.data;

                if (type === 'stats') {
                    this.stats = data;
                } else if (type === 'set-levels') {
                    if (this.onLevelsUpdate) {
                        this.onLevelsUpdate(levels);
                    }
                } else if (type === 'error') {
                    logger.error(`❌ UnifiedMixerWorklet Error: ${data.message}`);
                }
            };

            this.workletNode.onprocessorerror = (err) => {
                logger.error('❌ Worklet Processor Error:', err);
            };

            logger.info('✅ AudioWorkletNode created');
        } catch (error) {
            logger.error('❌ Failed to create worklet node:', error);
            throw error;
        }
    }

    /**
     * Initialize WASM processor in worklet
     */
    async _initializeWasmInWorklet() {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WASM initialization timeout'));
            }, 10000);

            // Listen for initialization response
            const handleInit = (event) => {
                const { type, data, levels } = event.data;

                if (type === 'wasm-initialized') {
                    clearTimeout(timeout);

                    // ✅ Restore standard message handler
                    this.workletNode.port.onmessage = (evt) => {
                        const { type, data, levels } = evt.data;
                        if (type === 'stats') {
                            this.stats = data;
                        } else if (type === 'set-levels') {
                            if (this.onLevelsUpdate) this.onLevelsUpdate(levels);
                        } else if (type === 'error') {
                            logger.error(`❌ UnifiedMixerWorklet Error: ${data.message}`);
                        }
                    };

                    if (event.data.success) {
                        resolve();
                    } else {
                        reject(new Error(event.data.error || 'WASM initialization failed'));
                    }
                }
            };

            this.workletNode.port.onmessage = handleInit;

            try {
                // Fetch WASM binary in main thread (has fetch API)
                logger.info('⏳ Fetching WASM binary...');
                const wasmResponse = await fetch(`/wasm/dawg_audio_dsp_bg.wasm?t=${Date.now()}`);
                const wasmArrayBuffer = await wasmResponse.arrayBuffer();
                logger.info(`✅ Fetched WASM binary: ${wasmArrayBuffer.byteLength} bytes`);

                // Send ArrayBuffer to worklet (ArrayBuffer can be transferred/cloned)
                this.workletNode.port.postMessage({
                    type: 'init-wasm',
                    data: {
                        wasmArrayBuffer: wasmArrayBuffer
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                reject(new Error(`Failed to fetch WASM binary: ${error.message}`));
            }
        });
    }

    /**
    /**
     * Connect an audio source to a specific channel
     *
     * @param {AudioNode} sourceNode - Audio source to connect
     * @param {number} channelIdx - Channel index (0-31)
     */
    connectToChannel(sourceNode, channelIdx) {
        if (channelIdx < 0 || channelIdx >= this.numChannels) {
            logger.error(`❌ Invalid channel index: ${channelIdx}`);
            return false;
        }

        if (!this.isInitialized) {
            logger.error('❌ UnifiedMixerNode not initialized');
            return false;
        }

        try {
            // Connect to specific input
            sourceNode.connect(this.workletNode, 0, channelIdx);
            this.channelConnections.set(channelIdx, sourceNode);

            logger.debug(`✅ Connected source to channel ${channelIdx}`);
            return true;
        } catch (error) {
            logger.error(`❌ Failed to connect to channel ${channelIdx}:`, error);
            return false;
        }
    }

    /**
     * Disconnect a channel
     *
     * @param {number} channelIdx - Channel index to disconnect
     */
    disconnectChannel(channelIdx) {
        const sourceNode = this.channelConnections.get(channelIdx);
        if (sourceNode) {
            try {
                sourceNode.disconnect(this.workletNode);
                this.channelConnections.delete(channelIdx);
                logger.debug(`✅ Disconnected channel ${channelIdx}`);
            } catch (error) {
                logger.error(`❌ Failed to disconnect channel ${channelIdx}:`, error);
            }
        }
    }

    /**
     * Set channel parameters
     *
     * @param {number} channelIdx - Channel index
     * @param {Object} params - Parameters to update
     * @param {number} [params.gain] - Channel gain (0-2)
     * @param {number} [params.pan] - Pan (-1 to +1)
     * @param {boolean} [params.mute] - Mute state
     * @param {boolean} [params.solo] - Solo state
     * @param {boolean} [params.eqActive] - EQ active state
     * @param {boolean} [params.compActive] - Compression active state
     */
    setChannelParams(channelIdx, params) {
        if (!this.isInitialized) return;

        this.workletNode.port.postMessage({
            type: 'set-channel-params',
            data: {
                channelIdx,
                ...params
            }
        });
    }

    /**
     * Reset a specific channel to default state
     * @param {number} channelIdx - Channel index to reset
     */
    resetChannel(channelIdx) {
        if (!this.isInitialized) return;

        // Disconnect any source
        this.disconnectChannel(channelIdx);

        // Reset parameters to default
        this.setChannelParams(channelIdx, {
            gain: 1.0,
            pan: 0.0,
            mute: false,
            solo: false,
            eqActive: false,
            compActive: false
        });

        // Clear effects (if logic allows, currently just params)
        logger.debug(`✅ Reset channel ${channelIdx}`);
    }

    /**
     * Set channel EQ
     *
     * @param {number} channelIdx - Channel index
     * @param {number} lowGain - Low band gain (dB)
     * @param {number} midGain - Mid band gain (dB)
     * @param {number} highGain - High band gain (dB)
     * @param {number} lowFreq - Low frequency cutoff (Hz)
     * @param {number} highFreq - High frequency cutoff (Hz)
     */
    setChannelEQ(channelIdx, lowGain, midGain, highGain, lowFreq = 250, highFreq = 4000) {
        if (!this.isInitialized) return;

        this.workletNode.port.postMessage({
            type: 'set-channel-eq',
            data: {
                channelIdx,
                lowGain,
                midGain,
                highGain,
                lowFreq,
                highFreq
            }
        });
    }

    /**
     * Add an effect to a channel
     * @param {number} channelIdx - Channel index
     * @param {number} effectType - Effect Type ID (0=Delay)
     */
    addChannelEffect(channelIdx, effectType) {
        if (!this.isInitialized) return;

        this.workletNode.port.postMessage({
            type: 'add-channel-effect',
            data: {
                channelIdx,
                effectType
            }
        });
    }

    /**
     * Reset all processing state
     */
    reset() {
        if (!this.isInitialized) return;

        this.workletNode.port.postMessage({
            type: 'reset'
        });
    }

    /**
     * Get processing statistics
     */
    async getStats() {
        if (!this.isInitialized) return this.stats;

        return new Promise((resolve) => {
            const handleStats = (event) => {
                if (event.data.type === 'stats') {
                    this.workletNode.port.onmessage = this._handleMessage.bind(this);
                    resolve(event.data.data);
                }
            };

            this.workletNode.port.onmessage = handleStats;
            this.workletNode.port.postMessage({ type: 'get-stats' });

            // Timeout fallback
            setTimeout(() => {
                this.workletNode.port.onmessage = this._handleMessage.bind(this);
                resolve(this.stats);
            }, 100);
        });
    }

    /**
     * Connect output to destination
     *
     * @param {AudioNode} destination - Destination node
     */
    connect(destination) {
        if (!this.isInitialized) {
            logger.error('❌ Cannot connect: UnifiedMixerNode not initialized');
            return;
        }

        this.workletNode.connect(destination);
    }

    /**
     * Disconnect output
     */
    disconnect() {
        if (this.workletNode) {
            this.workletNode.disconnect();
        }
    }

    /**
     * Get output node (for direct connections)
     */
    getOutputNode() {
        return this.workletNode;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Disconnect all channels
        for (const channelIdx of this.channelConnections.keys()) {
            this.disconnectChannel(channelIdx);
        }

        // Disconnect output
        this.disconnect();

        // Clear references
        this.workletNode = null;
        this.wasmModule = null;
        this.isInitialized = false;

        logger.info('✅ UnifiedMixerNode cleaned up');
    }
}
