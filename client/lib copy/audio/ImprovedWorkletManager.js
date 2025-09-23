// lib/audio/ImprovedWorkletManager.js
// DAWG - Improved Worklet Manager - ToneJS bağımlılığından tamamen arındırılmış

export class ImprovedWorkletManager {
    constructor(audioContext = null) {
        this.audioContext = null;
        this.loadedWorklets = new Set();
        this.activeNodes = new Map();
        this.nodeCounter = 0;

        // Performance tracking
        this.metrics = {
            totalNodesCreated: 0,
            totalNodesDisposed: 0,
            loadedWorkletCount: 0,
            failedLoads: 0,
            processorErrors: 0
        };

        // Error handling
        this.errorHandler = null;
        this.debugMode = false;

        this.initializeAudioContext(audioContext);
    }

    // =================== AUDIO CONTEXT MANAGEMENT ===================

    initializeAudioContext(providedContext = null) {
        if (providedContext) {
            this.audioContext = this.validateAndExtractContext(providedContext);
        } else {
            this.audioContext = this.createNativeAudioContext();
        }

        this.log(`🎵 WorkletManager: AudioContext initialized (${this.audioContext.constructor.name})`);
        this.log(`   Sample Rate: ${this.audioContext.sampleRate}Hz`);
        this.log(`   State: ${this.audioContext.state}`);
    }

    validateAndExtractContext(context) {
        // Direct native context check
        if (context instanceof AudioContext || context instanceof BaseAudioContext) {
            return context;
        }

        // WebKit compatibility
        if (window.webkitAudioContext && context instanceof window.webkitAudioContext) {
            return context;
        }

        // If context has native properties, extract them
        if (context && typeof context === 'object') {
            // Check for common native context properties
            if (context.destination && context.createGain && context.currentTime !== undefined) {
                return context;
            }
        }

        this.warn('🔧 Invalid context provided, creating new native context...');
        return this.createNativeAudioContext();
    }

    createNativeAudioContext() {
        const ContextClass = window.AudioContext || window.webkitAudioContext;
        if (!ContextClass) {
            throw new Error('AudioContext not supported in this browser');
        }

        try {
            return new ContextClass({
                latencyHint: 'interactive',
                sampleRate: 48000 // High quality
            });
        } catch (error) {
            // Fallback without options
            this.warn('Creating AudioContext without options due to:', error.message);
            return new ContextClass();
        }
    }

    // =================== CONTEXT VALIDATION ===================

    validateContextForWorklet() {
        if (!this.audioContext) {
            throw new Error('AudioContext is not available');
        }

        if (!window.AudioWorkletNode) {
            throw new Error('AudioWorkletNode is not supported in this browser');
        }

        if (!this.audioContext.audioWorklet) {
            throw new Error('audioWorklet property is not available');
        }

        // Check context state
        if (this.audioContext.state === 'closed') {
            throw new Error('AudioContext is closed');
        }

        // Verify it's a valid native context
        const isValidContext = 
            this.audioContext instanceof AudioContext || 
            this.audioContext instanceof BaseAudioContext ||
            (window.webkitAudioContext && this.audioContext instanceof window.webkitAudioContext);

        if (!isValidContext) {
            throw new Error(`Invalid AudioContext type: ${this.audioContext.constructor.name}`);
        }

        return true;
    }

    async ensureContextActive() {
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                this.log('✅ AudioContext resumed');
            } catch (error) {
                throw new Error(`Failed to resume AudioContext: ${error.message}`);
            }
        }
    }

    // =================== WORKLET LOADING ===================

    async loadWorklet(workletPath, processorName, options = {}) {
        if (this.loadedWorklets.has(processorName)) {
            this.log(`📦 Worklet already loaded: ${processorName}`);
            return true;
        }

        try {
            this.validateContextForWorklet();
            await this.ensureContextActive();

            this.log(`📦 Loading AudioWorklet: ${processorName} from ${workletPath}`);

            // Load with timeout
            const loadPromise = this.audioContext.audioWorklet.addModule(workletPath);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Worklet load timeout')), options.timeout || 10000);
            });

            await Promise.race([loadPromise, timeoutPromise]);

            this.loadedWorklets.add(processorName);
            this.metrics.loadedWorkletCount++;

            this.log(`✅ AudioWorklet loaded successfully: ${processorName}`);
            return true;

        } catch (error) {
            this.metrics.failedLoads++;
            this.error(`❌ Failed to load AudioWorklet: ${processorName}`, error);

            if (options.throwOnError !== false) {
                throw error;
            }
            return false;
        }
    }

    async loadMultipleWorklets(workletConfigs) {
        const results = await Promise.allSettled(
            workletConfigs.map(config => 
                this.loadWorklet(config.path, config.name, config.options)
            )
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');

        this.log(`📦 Worklet batch load complete: ${successful}/${workletConfigs.length} successful`);

        if (failed.length > 0) {
            this.warn(`⚠️ ${failed.length} worklets failed to load:`, 
                failed.map(r => r.reason?.message).join(', '));
        }

        return results;
    }

    // =================== NODE CREATION ===================

    async createWorkletNode(processorName, options = {}) {
        if (!this.loadedWorklets.has(processorName)) {
            throw new Error(`AudioWorklet processor not loaded: ${processorName}`);
        }

        try {
            this.validateContextForWorklet();
            await this.ensureContextActive();

            const nodeOptions = this.processNodeOptions(options);

            this.log(`🔧 Creating AudioWorkletNode: ${processorName}`, {
                inputs: nodeOptions.numberOfInputs,
                outputs: nodeOptions.numberOfOutputs,
                channels: nodeOptions.outputChannelCount
            });

            const node = new AudioWorkletNode(this.audioContext, processorName, nodeOptions);

            // Error handling setup
            this.setupNodeErrorHandling(node, processorName);

            // Performance monitoring
            this.setupNodePerformanceMonitoring(node, processorName);

            const nodeId = this.generateNodeId(processorName);
            const nodeData = {
                node,
                processorName,
                created: Date.now(),
                options: nodeOptions,
                id: nodeId
            };

            this.activeNodes.set(nodeId, nodeData);
            this.metrics.totalNodesCreated++;

            this.log(`✅ AudioWorkletNode created: ${nodeId}`);
            return { node, nodeId, nodeData };

        } catch (error) {
            this.error(`❌ Failed to create AudioWorkletNode: ${processorName}`, error);
            throw error;
        }
    }

    processNodeOptions(options) {
        return {
            numberOfInputs: options.numberOfInputs ?? 1,
            numberOfOutputs: options.numberOfOutputs ?? 1,
            outputChannelCount: options.outputChannelCount ?? [2],
            channelCount: options.channelCount ?? 2,
            channelCountMode: options.channelCountMode ?? 'explicit',
            channelInterpretation: options.channelInterpretation ?? 'speakers',
            processorOptions: options.processorOptions ?? {},
            ...options
        };
    }

    setupNodeErrorHandling(node, processorName) {
        node.onprocessorerror = (event) => {
            this.metrics.processorErrors++;
            this.error(`🔥 Processor Error in ${processorName}:`, event);

            if (this.errorHandler) {
                this.errorHandler({
                    type: 'processorError',
                    processorName,
                    event,
                    node
                });
            }
        };

        // Port message error handling
        if (node.port) {
            const originalPostMessage = node.port.postMessage;
            node.port.postMessage = (data) => {
                try {
                    originalPostMessage.call(node.port, data);
                } catch (error) {
                    this.error(`❌ Port message error in ${processorName}:`, error);
                }
            };
        }
    }

    setupNodePerformanceMonitoring(node, processorName) {
        // Add performance monitoring if debug mode is enabled
        if (this.debugMode && node.port) {
            let messageCount = 0;
            let lastReport = Date.now();

            const originalPostMessage = node.port.postMessage;
            node.port.postMessage = (data) => {
                messageCount++;
                const now = Date.now();

                if (now - lastReport > 5000) { // Report every 5 seconds
                    this.log(`📊 Node stats ${processorName}: ${messageCount} messages in 5s`);
                    messageCount = 0;
                    lastReport = now;
                }

                originalPostMessage.call(node.port, data);
            };
        }
    }

    generateNodeId(processorName) {
        return `${processorName}_${++this.nodeCounter}_${Date.now()}`;
    }

    // =================== NODE MANAGEMENT ===================

    getActiveNode(nodeId) {
        const nodeData = this.activeNodes.get(nodeId);
        return nodeData ? nodeData.node : null;
    }

    getNodeData(nodeId) {
        return this.activeNodes.get(nodeId);
    }

    getNodesByProcessor(processorName) {
        const nodes = [];
        this.activeNodes.forEach((nodeData, nodeId) => {
            if (nodeData.processorName === processorName) {
                nodes.push({ nodeId, ...nodeData });
            }
        });
        return nodes;
    }

    disposeNode(nodeId) {
        const nodeData = this.activeNodes.get(nodeId);
        if (!nodeData) {
            this.warn(`⚠️ Node not found for disposal: ${nodeId}`);
            return false;
        }

        try {
            const { node, processorName } = nodeData;

            // Disconnect all connections
            node.disconnect();

            // Send disposal message to worklet if it has a port
            if (node.port) {
                try {
                    node.port.postMessage({ type: 'dispose' });
                } catch (error) {
                    // Ignore post message errors during disposal
                }
            }

            // Remove from tracking
            this.activeNodes.delete(nodeId);
            this.metrics.totalNodesDisposed++;

            this.log(`🗑️ AudioWorkletNode disposed: ${nodeId} (${processorName})`);
            return true;

        } catch (error) {
            this.error(`❌ Error disposing node ${nodeId}:`, error);
            return false;
        }
    }

    disposeNodesByProcessor(processorName) {
        const nodes = this.getNodesByProcessor(processorName);
        let disposed = 0;

        nodes.forEach(({ nodeId }) => {
            if (this.disposeNode(nodeId)) {
                disposed++;
            }
        });

        this.log(`🗑️ Disposed ${disposed} nodes for processor: ${processorName}`);
        return disposed;
    }

    disposeAllNodes() {
        const nodeIds = Array.from(this.activeNodes.keys());
        let disposed = 0;

        nodeIds.forEach(nodeId => {
            if (this.disposeNode(nodeId)) {
                disposed++;
            }
        });

        this.log(`🗑️ Disposed all ${disposed} AudioWorkletNodes`);
        return disposed;
    }

    // =================== ADVANCED FEATURES ===================

    async createNodePool(processorName, poolSize = 5, options = {}) {
        const pool = [];

        for (let i = 0; i < poolSize; i++) {
            try {
                const nodeData = await this.createWorkletNode(processorName, options);
                pool.push(nodeData);
            } catch (error) {
                this.warn(`⚠️ Failed to create node ${i+1}/${poolSize} for pool:`, error);
            }
        }

        this.log(`🏊 Created node pool for ${processorName}: ${pool.length}/${poolSize} nodes`);
        return pool;
    }

    async hotSwapWorklet(oldProcessorName, newProcessorName, newWorkletPath) {
        try {
            // Load new worklet
            await this.loadWorklet(newWorkletPath, newProcessorName);

            // Get existing nodes
            const existingNodes = this.getNodesByProcessor(oldProcessorName);

            // Create new nodes with same options
            const newNodes = [];
            for (const existingData of existingNodes) {
                const newNodeData = await this.createWorkletNode(newProcessorName, existingData.options);
                newNodes.push({ old: existingData, new: newNodeData });
            }

            this.log(`🔄 Hot swap complete: ${oldProcessorName} -> ${newProcessorName}`);
            return newNodes;

        } catch (error) {
            this.error(`❌ Hot swap failed: ${oldProcessorName} -> ${newProcessorName}`, error);
            throw error;
        }
    }

    // =================== DEBUGGING & MONITORING ===================

    enableDebugMode(enable = true) {
        this.debugMode = enable;
        this.log(`🐛 Debug mode ${enable ? 'enabled' : 'disabled'}`);
    }

    setErrorHandler(handler) {
        this.errorHandler = handler;
    }

    getDetailedStats() {
        const contextStats = {
            state: this.audioContext?.state || 'unknown',
            sampleRate: this.audioContext?.sampleRate || 'unknown',
            currentTime: this.audioContext?.currentTime?.toFixed(3) || 'unknown',
            baseLatency: this.audioContext?.baseLatency?.toFixed(6) || 'unknown',
            outputLatency: this.audioContext?.outputLatency?.toFixed(6) || 'unknown'
        };

        const nodeStats = {};
        this.activeNodes.forEach((nodeData, nodeId) => {
            const processorName = nodeData.processorName;
            if (!nodeStats[processorName]) {
                nodeStats[processorName] = 0;
            }
            nodeStats[processorName]++;
        });

        return {
            metrics: { ...this.metrics },
            audioContext: contextStats,
            loadedWorklets: Array.from(this.loadedWorklets),
            activeNodes: this.activeNodes.size,
            nodesByProcessor: nodeStats,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    estimateMemoryUsage() {
        // Rough estimation
        const nodeMemory = this.activeNodes.size * 64; // Approximate KB per node
        const workletMemory = this.loadedWorklets.size * 32; // Approximate KB per worklet
        return {
            estimatedKB: nodeMemory + workletMemory,
            nodes: nodeMemory,
            worklets: workletMemory
        };
    }

    // =================== CONTEXT MANAGEMENT ===================

    async reinitializeContext(options = {}) {
        try {
            this.log('🔄 Reinitializing AudioContext...');

            // Dispose all nodes first
            this.disposeAllNodes();

            // Close old context
            if (this.audioContext && this.audioContext.state !== 'closed') {
                await this.audioContext.close();
            }

            // Create new context
            this.audioContext = this.createNativeAudioContext(options);
            await this.ensureContextActive();

            // Clear worklet registry (they need to be reloaded)
            const previousWorklets = Array.from(this.loadedWorklets);
            this.loadedWorklets.clear();
            this.metrics.loadedWorkletCount = 0;

            this.log('✅ AudioContext reinitialized successfully');
            return { previousWorklets, newContext: this.audioContext };

        } catch (error) {
            this.error('❌ Context reinitialization failed:', error);
            throw error;
        }
    }

    // =================== UTILITY METHODS ===================

    isWorkletLoaded(processorName) {
        return this.loadedWorklets.has(processorName);
    }

    isContextValid() {
        try {
            this.validateContextForWorklet();
            return true;
        } catch {
            return false;
        }
    }

    // =================== LOGGING ===================

    log(message, ...args) {
        if (this.debugMode) {
            console.log(message, ...args);
        }
    }

    warn(message, ...args) {
        console.warn(message, ...args);
    }

    error(message, ...args) {
        console.error(message, ...args);
    }

    // =================== CLEANUP ===================

    async dispose() {
        this.log('🗑️ Disposing ImprovedWorkletManager...');

        // Dispose all nodes
        this.disposeAllNodes();

        // Clear collections
        this.loadedWorklets.clear();
        this.activeNodes.clear();

        // Close context if we created it
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try {
                await this.audioContext.close();
            } catch (error) {
                this.warn('⚠️ Error closing AudioContext:', error);
            }
        }

        this.audioContext = null;
        this.errorHandler = null;

        this.log('✅ ImprovedWorkletManager disposed');
    }
}
