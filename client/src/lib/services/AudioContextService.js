// lib/services/AudioContextService.js - Enhanced with Interface Layer
// DAWG - AudioContextService v3.0 with Native Interface APIs

import { TimelineSelectionAPI } from '../interfaces/TimelineSelectionAPI';
import { RealtimeParameterSync } from '../interfaces/RealtimeParameterSync';
import { DynamicLoopManager } from '../interfaces/DynamicLoopManager';
import EventBus from '../core/EventBus';
import { audioAssetManager } from '../audio/AudioAssetManager';
import { effectRegistry } from '../audio/EffectRegistry';

export class AudioContextService {
  static instance = null;
  static audioEngine = null;
  static isSubscriptionsSetup = false;
  
  // =================== NEW: INTERFACE LAYER ===================
  static interfaceManager = null;
  static eventBus = EventBus;

  // Specialized APIs
  static timelineAPI = null;
  static parameterSync = null;
  static loopManager = null;

  // =================== SINGLETON PATTERN ===================

  static getInstance() {
    if (!this.instance) {
      this.instance = new AudioContextService();
    }
    return this.instance;
  };

  static async setAudioEngine(engine) {
    this.audioEngine = engine;

    // Initialize AudioAssetManager with AudioContext
    if (engine?.audioContext) {
      audioAssetManager.setAudioContext(engine.audioContext);
      console.log("✅ AudioAssetManager initialized");
    }

    // Initialize interface layer
    await this.initializeInterfaceLayer();

    // Setup store subscriptions for reactive updates
    if (!this.isSubscriptionsSetup) {
      this._setupStoreSubscriptions();
      this.isSubscriptionsSetup = true;
    }

    console.log("✅ AudioContextService v3.0: Native Engine + Interface Layer ready");
    return engine;
  };

  static getAudioEngine() {
    if (!this.audioEngine) {
      console.warn("⚠️ AudioContextService: Audio engine not ready!");
    }
    return this.audioEngine;
  };

  static getAudioContext() {
    return this.audioEngine?.audioContext || null;
  };

  // =================== INTERFACE LAYER INITIALIZATION ===================

  static async initializeInterfaceLayer() {
    if (!this.audioEngine) {
      throw new Error('Audio engine must be set before initializing interface layer');
    }

    console.log('🔌 Initializing Interface Layer...');

    // Initialize Event Bus
    this.eventBus = EventBus;

    // Initialize Timeline Selection API
    this.timelineAPI = new TimelineSelectionAPI(this.audioEngine, this.eventBus);

    // Initialize Real-time Parameter Sync
    this.parameterSync = new RealtimeParameterSync(this.audioEngine, this.eventBus);

    // Initialize Dynamic Loop Manager
    this.loopManager = new DynamicLoopManager(this.audioEngine, this.eventBus);

    // Setup interface event forwarding
    this.setupInterfaceEventForwarding();

    console.log('✅ Interface Layer initialized with Timeline, Parameters, and Loop APIs');
  };

  static setupInterfaceEventForwarding() {
    // Forward engine events to interface APIs
    this.audioEngine.transport?.on('tick', (data) => {
      this.eventBus.emit('transportTick', data);
    });

    this.audioEngine.transport?.on('loop', (data) => {
      this.eventBus.emit('transportLoop', data);
      this.loopManager?.handleTransportLoop(data);
    });

    this.audioEngine.transport?.on('start', () => {
      this.eventBus.emit('transportStart');
    });

    this.audioEngine.transport?.on('stop', () => {
      this.eventBus.emit('transportStop');
    });

    // Forward interface events to UI (via callbacks)
    this.eventBus.on('loopChanged', (data) => {
      // Notify UI components about loop changes
      if (this.audioEngine.callbacks?.onLoopChange) {
        this.audioEngine.callbacks.onLoopChange(data);
      }
    });

    this.eventBus.on('parameterChanged', (data) => {
      // Notify UI components about parameter changes  
      if (this.audioEngine.callbacks?.onParameterChange) {
        this.audioEngine.callbacks.onParameterChange(data);
      }
    });
  };

  // =================== TIMELINE INTERFACE METHODS ===================

  /**
   * Timeline selection and navigation
   */
  static timeline = {
    // Selection methods
    startSelection: (step) => {
      return this.timelineAPI?.startSelection(step);
    },

    updateSelection: (step) => {
      return this.timelineAPI?.updateSelection(step);
    },

    endSelection: (setAsLoop = false) => {
      return this.timelineAPI?.endSelection(setAsLoop);
    },

    clearSelection: () => {
      this.timelineAPI?.clearSelection();
    },

    // Loop methods
    setLoopFromSelection: () => {
      return this.timelineAPI?.setLoopFromSelection();
    },

    selectCurrentLoop: () => {
      return this.timelineAPI?.selectCurrentLoop();
    },

    // Scrubbing methods
    startScrub: (step) => {
      return this.timelineAPI?.startScrub(step);
    },

    updateScrub: (step) => {
      return this.timelineAPI?.updateScrub(step);
    },

    endScrub: (resumePlayback = false) => {
      this.timelineAPI?.endScrub(resumePlayback);
    },

    // Navigation methods
    jumpToStep: (step) => {
      return this.timelineAPI?.jumpToStep(step);
    },

    jumpToBar: (bar) => {
      return this.timelineAPI?.jumpToBar(bar);
    },

    jumpToPercent: (percent) => {
      return this.timelineAPI?.jumpToPercent(percent);
    },

    // Grid and zoom
    setGridSnap: (enabled, snapValue = 1) => {
      this.timelineAPI?.setGridSnap(enabled, snapValue);
    },

    setZoom: (pixelsPerStep) => {
      this.timelineAPI?.setZoom(pixelsPerStep);
    },

    // State getters
    getSelection: () => {
      return this.timelineAPI?.getSelection();
    },

    getTimelineState: () => {
      return this.timelineAPI?.getTimelineState();
    },

    // Utility methods
    pixelToStep: (pixelX, timelineWidth, totalSteps) => {
      return this.timelineAPI?.pixelToStep(pixelX, timelineWidth, totalSteps);
    },

    stepToPixel: (step, timelineWidth, totalSteps) => {
      return this.timelineAPI?.stepToPixel(step, timelineWidth, totalSteps);
    }
  };

  // =================== PARAMETER INTERFACE METHODS ===================

  /**
   * Real-time parameter control
   */
  static parameters = {
    // Single parameter control
    set: (targetId, parameter, value, time = null, smooth = true) => {
      return this.parameterSync?.setParameter(targetId, parameter, value, time, smooth);
    },

    // Multiple parameters
    setMultiple: (targetId, parameters, time = null) => {
      return this.parameterSync?.setParameters(targetId, parameters, time);
    },

    // Get current value
    get: (targetId, parameter) => {
      return this.parameterSync?.getParameterValue(targetId, parameter);
    },

    // Automation recording
    startRecording: (targetId, parameter) => {
      this.parameterSync?.startAutomationRecording(targetId, parameter);
    },

    stopRecording: (targetId, parameter) => {
      return this.parameterSync?.stopAutomationRecording(targetId, parameter);
    },

    // Subscriptions for UI updates
    subscribe: (targetId, callback) => {
      this.parameterSync?.subscribeToParameters(targetId, callback);
    },

    unsubscribe: (targetId, callback) => {
      this.parameterSync?.unsubscribeFromParameters(targetId, callback);
    },

    // Performance control
    setPerformanceSettings: (settings) => {
      this.parameterSync?.setPerformanceSettings(settings);
    },

    getPerformanceStats: () => {
      return this.parameterSync?.getPerformanceStats();
    }
  };

  // =================== LOOP INTERFACE METHODS ===================

  /**
   * Dynamic loop management
   */
  static loop = {
    // Mode control
    setMode: (mode) => {
      return this.loopManager?.setLoopMode(mode);
    },

    getMode: () => {
      return this.loopManager?.getLoopMode();
    },

    // Manual loop control
    setManual: (start, end, source = 'user') => {
      return this.loopManager?.setManualLoop(start, end, source);
    },

    clearManualOverride: () => {
      return this.loopManager?.clearManualOverride();
    },

    hasManualOverride: (patternId = null) => {
      return this.loopManager?.hasManualOverride(patternId);
    },

    // Auto calculation
    recalculate: () => {
      return this.loopManager?.recalculateLoop();
    },

    calculateFromPattern: (patternId = null) => {
      return this.loopManager?.calculateLoopFromPattern(patternId);
    },

    // Configuration
    updateAutoSettings: (settings) => {
      this.loopManager?.updateAutoSettings(settings);
    },

    getAutoSettings: () => {
      return this.loopManager?.getAutoSettings();
    },

    getStatus: () => {
      return this.loopManager?.getStatus();
    }
  };

  // =================== VALIDATION INTERFACE METHODS ===================

  /**
   * Pattern validation and cleanup
   */
  static validation = {
    // Validate single pattern
    validatePattern: (patternId) => {
      return this.patternValidator?.validatePattern(patternId);
    },

    // Validate all patterns
    validateAllPatterns: (reason = 'manual') => {
      return this.patternValidator?.validateAllPatterns(reason);
    },

    // Schedule pattern validation
    scheduleValidation: (patternId, reason = 'manual') => {
      this.patternValidator?.scheduleValidation(patternId, reason);
    },

    // Get validation result
    getValidationResult: (patternId) => {
      return this.patternValidator?.getValidationResult(patternId);
    },

    // Get all validation results
    getAllValidationResults: () => {
      return this.patternValidator?.getAllValidationResults();
    },

    // Clear validation cache
    clearCache: (patternId = null) => {
      this.patternValidator?.clearCache(patternId);
    },

    // Update validation settings
    updateSettings: (settings) => {
      this.patternValidator?.updateSettings(settings);
    },

    // Enable/disable auto-validation
    setAutoValidation: (enabled) => {
      this.patternValidator?.setAutoValidation(enabled);
    },

    // Get validation system status
    getStatus: () => {
      return this.patternValidator?.getStatus();
    }
  };

  // =================== PERFORMANCE INTERFACE METHODS ===================

  /**
   * Performance monitoring and optimization
   */
  static performance = {
    // Start monitoring
    startMonitoring: (interval = 1000) => {
      this.performanceMonitor?.startMonitoring(interval);
    },

    // Stop monitoring
    stopMonitoring: () => {
      this.performanceMonitor?.stopMonitoring();
    },

    // Toggle monitoring
    toggleMonitoring: () => {
      this.performanceMonitor?.toggleMonitoring();
    },

    // Get current metrics
    getMetrics: () => {
      return this.performanceMonitor?.getMetrics();
    },

    // Get performance report
    getReport: () => {
      return this.performanceMonitor?.getPerformanceReport();
    },

    // Get performance history
    getHistory: (duration = null) => {
      return this.performanceMonitor?.getHistory(duration);
    },

    // Clear performance history
    clearHistory: () => {
      this.performanceMonitor?.clearHistory();
    },

    // Alert management
    alerts: {
      subscribe: (callback) => {
        return this.performanceMonitor?.subscribeToAlerts(callback);
      },

      getAlerts: (severity = null) => {
        return this.performanceMonitor?.getAlerts(severity);
      },

      clearAlerts: (type = null) => {
        this.performanceMonitor?.clearAlerts(type);
      }
    },

    // Configuration
    updateThresholds: (thresholds) => {
      this.performanceMonitor?.updateThresholds(thresholds);
    },

    updateInterval: (interval) => {
      this.performanceMonitor?.updateInterval(interval);
    },

    // Monitoring state
    isMonitoring: () => {
      return this.performanceMonitor?.isMonitoring || false;
    }
  };

  // =================== EVENT BUS INTERFACE ===================

  /**
   * Event subscription for external components
   */
  static events = {
    // Subscribe to events
    on: (eventName, callback) => {
      this.eventBus.on(eventName, callback);
    },

    // Unsubscribe from events
    off: (eventName, callback) => {
      this.eventBus.off(eventName, callback);
    },

    // Emit events (usually for internal use)
    emit: (eventName, data) => {
      this.eventBus.emit(eventName, data);
    }
  };

  // =================== UNIFIED INTERFACE METHODS ===================

  /**
   * Unified interface for all timeline, parameter, and loop operations
   */
  static interface = {
    // Timeline operations
    timeline: this.timeline,

    // Parameter operations
    parameters: this.parameters,

    // Loop operations
    loop: this.loop,

    // Event system
    events: this.events,

    // Quick access methods
    setParameter: (targetId, parameter, value, time = null) => {
      return this.parameters.set(targetId, parameter, value, time);
    },

    jumpToStep: (step) => {
      return this.timeline.jumpToStep(step);
    },

    setLoopPoints: (start, end) => {
      return this.loop.setManual(start, end);
    },

    // Batch operations
    batch: {
      parameters: (updates) => {
        Object.entries(updates).forEach(([targetId, params]) => {
          this.parameters.setMultiple(targetId, params);
        });
      },

      timeline: (operations) => {
        operations.forEach(op => {
          switch (op.type) {
            case 'jump':
              this.timeline.jumpToStep(op.step);
              break;
            case 'select':
              this.timeline.startSelection(op.start);
              this.timeline.updateSelection(op.end);
              this.timeline.endSelection(op.setAsLoop);
              break;
            default:
              console.warn(`Unknown timeline operation: ${op.type}`);
          }
        });
      }
    }
  };

  // =================== LEGACY COMPATIBILITY ===================

  /**
   * Legacy methods for backward compatibility
   * These delegate to the new interface layer
   */

  static play() {
    return this.audioEngine?.play() || null;
  }

  static stop() {
    return this.audioEngine?.stop() || null;
  }

  static pause() {
    return this.audioEngine?.pause() || null;
  }

  static setBPM(bpm) {
    return this.audioEngine?.setBPM(bpm) || null;
  }

  static reschedule() {
    return this.audioEngine?.schedulePattern() || null;
  }

  static setChannelVolume(channelId, volume) {
    return this.parameters.set(`mixer-${channelId}`, 'volume', volume);
  }

  static setChannelPan(channelId, pan) {
    return this.parameters.set(`mixer-${channelId}`, 'pan', pan);
  }

  static setChannelMute(channelId, muted) {
    return this.parameters.set(`mixer-${channelId}`, 'mute', muted);
  }

  static setMasterVolume(volume) {
    if (this.audioEngine?.setMasterVolume) {
      this.audioEngine.setMasterVolume(volume);
    }
  }

  static auditionNoteOn(instrumentId, pitch, velocity) {
    return this.audioEngine?.auditionNoteOn(instrumentId, pitch, velocity) || null;
  }

  static auditionNoteOff(instrumentId, pitch) {
    return this.audioEngine?.auditionNoteOff(instrumentId, pitch) || null;
  }

  // =================== ADVANCED FEATURES ===================

  /**
   * Advanced interface features for power users
   */
  static advanced = {
    // Real-time performance monitoring
    monitor: {
      start: () => {
        this.performanceMonitor?.start();
      },

      stop: () => {
        this.performanceMonitor?.stop();
      },

      getStats: () => {
        return {
          interface: {
            timeline: this.timelineAPI?.getPerformanceStats?.() || {},
            parameters: this.parameterSync?.getPerformanceStats?.() || {},
            loop: this.loopManager?.getPerformanceStats?.() || {}
          },
          engine: this.audioEngine?.getEngineStats?.() || {}
        };
      }
    },

    // Bulk operations
    bulk: {
      setParameters: (parameterMap) => {
        Object.entries(parameterMap).forEach(([targetId, params]) => {
          Object.entries(params).forEach(([param, value]) => {
            this.parameters.set(targetId, param, value);
          });
        });
      },

      createAutomationClips: (automationData) => {
        automationData.forEach(({ targetId, parameter, events }) => {
          this.parameters.startRecording(targetId, parameter);
          events.forEach(event => {
            this.parameters.set(targetId, parameter, event.value, event.time);
          });
          this.parameters.stopRecording(targetId, parameter);
        });
      }
    },

    // Macro operations
    macros: {
      quantizeToGrid: (gridSize = '16n') => {
        // Get current selection
        const selection = this.timeline.getSelection();
        if (selection) {
          // Implement quantization logic
          console.log(`Quantizing selection to ${gridSize}`);
        }
      },

      fadeInOut: (targetId, fadeInTime, fadeOutTime) => {
        const currentTime = this.audioEngine?.audioContext?.currentTime || 0;
        this.parameters.set(targetId, 'volume', 0, currentTime);
        this.parameters.set(targetId, 'volume', 1, currentTime + fadeInTime);
        this.parameters.set(targetId, 'volume', 0, currentTime + fadeInTime + fadeOutTime);
      },

      createSend: (fromChannelId, toChannelId, level = -6) => {
        // Implementation would depend on mixer architecture
        console.log(`Creating send: ${fromChannelId} -> ${toChannelId} at ${level}dB`);
      }
    },

    // Snapshot system
    snapshots: {
      capture: (name) => {
        const snapshot = {
          name,
          timestamp: Date.now(),
          timeline: this.timeline.getTimelineState(),
          loop: this.loop.getCurrent(),
          parameters: {} // Would capture current parameter states
        };

        if (!this.snapshots) this.snapshots = [];
        this.snapshots.push(snapshot);
        return snapshot;
      },

      restore: (snapshotId) => {
        const snapshot = this.snapshots?.find(s => s.timestamp === snapshotId);
        if (snapshot) {
          // Restore timeline state
          if (snapshot.timeline.selection) {
            this.timeline.startSelection(snapshot.timeline.selection.start);
            this.timeline.endSelection();
          }

          // Restore loop state
          if (snapshot.loop) {
            this.loop.setManual(snapshot.loop.start, snapshot.loop.end);
          }

          console.log(`Restored snapshot: ${snapshot.name}`);
        }
      },

      list: () => {
        return this.snapshots || [];
      }
    }
  };

  // =================== DEBUGGING & DIAGNOSTICS ===================

  /**
   * Debugging and diagnostic tools
   */
  static debug = {
    // Interface layer status
    getInterfaceStatus: () => {
      return {
        initialized: !!this.interfaceManager,
        audioEngine: !!this.audioEngine,
        eventBus: !!this.eventBus,
        apis: {
          timeline: !!this.timelineAPI,
          parameters: !!this.parameterSync,
          loop: !!this.loopManager
        }
      };
    },

    // Performance metrics
    getPerformanceMetrics: () => {
      return this.advanced.monitor.getStats();
    },

    // Event bus diagnostics
    getEventBusStatus: () => {
      return {
        listenerCount: this.eventBus?.listenerCount?.() || 0,
        events: this.eventBus?.getRegisteredEvents?.() || []
      };
    },

    // Component health check
    healthCheck: () => {
      const status = this.debug.getInterfaceStatus();
      const health = {
        overall: 'healthy',
        components: {},
        issues: []
      };

      // Check each component
      Object.entries(status.apis).forEach(([name, isReady]) => {
        health.components[name] = isReady ? 'healthy' : 'missing';
        if (!isReady) {
          health.issues.push(`${name} API not initialized`);
        }
      });

      if (health.issues.length > 0) {
        health.overall = health.issues.length > 2 ? 'critical' : 'degraded';
      }

      return health;
    },

    // Reset interface layer
    reset: async () => {
      console.log('🔄 Resetting interface layer...');
      
      // Dispose existing components
      this.timelineAPI?.dispose?.();
      this.parameterSync?.dispose?.();
      this.loopManager?.dispose?.();

      // Clear references
      this.timelineAPI = null;
      this.parameterSync = null;
      this.loopManager = null;
      this.eventBus = null;

      // Re-initialize if audio engine is available
      if (this.audioEngine) {
        await this.initializeInterfaceLayer();
        console.log('✅ Interface layer reset complete');
      }
    }
  };

  // =================== STORE INTEGRATION ===================

  /**
   * Store subscription management
   */
  static _setupStoreSubscriptions() {
    // This would typically be called from setAudioEngine
    // Implementation depends on specific store structure
    console.log('📡 Setting up store subscriptions...');
    
    // Example subscription pattern:
    /*
    useArrangementStore.subscribe((state, prevState) => {
      if (state.activePatternId !== prevState.activePatternId) {
        this.loop.recalculate();
      }
    });

    usePlaybackStore.subscribe((state, prevState) => {
      if (state.bpm !== prevState.bpm) {
        this.setBPM(state.bpm);
      }
    });

    useMixerStore.subscribe((state, prevState) => {
      // Handle mixer parameter changes
      // Use this.parameters.set() for real-time updates
    });
    */
  }

  // =================== CLEANUP ===================

  /**
   * Update mixer parameter (volume, pan, etc.)
   * Direct bridge to audio engine
   */
  static updateMixerParam(trackId, param, value) {
    console.log('🎛️ AudioContextService.updateMixerParam:', trackId, param, value);

    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    // Use the audio engine's specific mixer methods
    if (param === 'volume' && this.audioEngine.setChannelVolume) {
      // Convert dB to linear (knob sends dB -60 to +6, engine expects linear 0-2)
      const linearValue = this.dbToLinear(value);
      // Removed excessive logging (throttled by RAF already)
      this.audioEngine.setChannelVolume(trackId, linearValue);
    } else if (param === 'pan' && this.audioEngine.setChannelPan) {
      // Pan is already in correct range (-1 to +1)
      // Removed excessive logging (throttled by RAF already)
      this.audioEngine.setChannelPan(trackId, value);
    } else if (param.startsWith('eq.') && this.audioEngine.setChannelEQ) {
      // Handle EQ parameters like 'eq.highGain'
      const eqParam = param.split('.')[1];
      // Removed excessive logging (throttled by RAF already)
      this.audioEngine.setChannelEQ(trackId, eqParam, value);
    } else {
      console.warn('⚠️ Unknown mixer parameter or missing audio engine method:', param);
    }
  }

  /**
   * Set mute state for a channel
   */
  static setMuteState(trackId, muted) {
    console.log('🔇 AudioContextService.setMuteState:', trackId, muted);

    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    if (this.audioEngine.setChannelMute) {
      this.audioEngine.setChannelMute(trackId, muted);
    } else {
      console.warn('⚠️ Audio engine missing setChannelMute method');
    }
  }

  /**
   * Set mono state for a channel
   */
  static setMonoState(trackId, mono) {
    console.log('📻 AudioContextService.setMonoState:', trackId, mono);

    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    if (this.audioEngine.setChannelMono) {
      this.audioEngine.setChannelMono(trackId, mono);
    } else {
      console.warn('⚠️ Audio engine missing setChannelMono method');
    }
  }

  /**
   * Set solo state for channels
   * @param {Set} soloedChannels - Set of channel IDs that are soloed
   * @param {Set} mutedChannels - Set of channel IDs that are manually muted (from store)
   */
  static setSoloState(soloedChannels, mutedChannels = new Set()) {
    console.log('🎧 AudioContextService.setSoloState:', {
      soloed: Array.from(soloedChannels),
      muted: Array.from(mutedChannels)
    });

    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    // Use MixerChannel's setSolo method if available
    if (this.audioEngine.mixerChannels) {
      const isAnySoloed = soloedChannels.size > 0;

      this.audioEngine.mixerChannels.forEach((channel, channelId) => {
        // NEVER mute master channel
        if (channel.isMaster || channelId === 'master') {
          console.log(`  Channel ${channelId}: SKIP (master channel never mutes)`);
          return;
        }

        const isSoloed = soloedChannels.has(channelId);

        // Use MixerChannel's built-in setSolo method
        if (channel.setSolo && typeof channel.setSolo === 'function') {
          console.log(`  Channel ${channelId}: setSolo(${isSoloed}, ${isAnySoloed})`);
          channel.setSolo(isSoloed, isAnySoloed);
        } else {
          // Fallback to manual mute control
          if (isAnySoloed) {
            const shouldMute = !isSoloed;
            if (this.audioEngine.setChannelMute) {
              this.audioEngine.setChannelMute(channelId, shouldMute);
            }
          } else {
            // No solo, restore original mute state
            const isManuallyMuted = mutedChannels.has(channelId);
            if (this.audioEngine.setChannelMute) {
              this.audioEngine.setChannelMute(channelId, isManuallyMuted);
            }
          }
        }
      });
    }
  }

  // =================== EFFECTS MANAGEMENT ===================

  /**
   * Rebuild master bus effect chain
   */
  static async rebuildMasterChain(trackState) {
    console.log('🔗 Rebuilding master chain:', trackState);

    if (!this.audioEngine || !this.audioEngine.masterBusGain || !this.audioEngine.masterGain) {
      console.warn('⚠️ Master bus nodes not available');
      return;
    }

    const { audioContext, masterBusGain, masterGain } = this.audioEngine;

    try {
      // Disconnect master bus (will reconnect with effects)
      masterBusGain.disconnect();

      // Clear existing master effects
      if (!this.audioEngine.masterEffects) {
        this.audioEngine.masterEffects = new Map();
      } else {
        // Dispose existing effects
        for (const [id, effect] of this.audioEngine.masterEffects) {
          try {
            if (effect.node) effect.node.disconnect();
            if (effect.dispose) effect.dispose();
          } catch (err) {
            console.warn('Error disposing master effect:', id, err);
          }
        }
        this.audioEngine.masterEffects.clear();
      }

      // Build effect chain
      let currentNode = masterBusGain;
      const insertEffects = trackState?.insertEffects || [];

      for (const effectConfig of insertEffects) {
        if (effectConfig.bypass) continue;

        try {
          const effectNode = await effectRegistry.createEffectNode(
            effectConfig.type,
            audioContext,
            effectConfig.settings
          );

          if (effectNode) {
            // Connect in chain
            currentNode.connect(effectNode.input || effectNode);
            currentNode = effectNode.output || effectNode;

            // Store effect
            this.audioEngine.masterEffects.set(effectConfig.id, {
              id: effectConfig.id,
              type: effectConfig.type,
              node: effectNode,
              settings: effectConfig.settings,
              bypass: effectConfig.bypass
            });

            console.log('✅ Master effect added:', effectConfig.type);
          }
        } catch (err) {
          console.error('❌ Failed to create master effect:', effectConfig.type, err);
        }
      }

      // Final connection to master gain
      currentNode.connect(masterGain);
      console.log('✅ Master chain rebuilt with', insertEffects.length, 'effects');

    } catch (error) {
      console.error('❌ Error rebuilding master chain:', error);
      // Fallback: direct connection
      masterBusGain.disconnect();
      masterBusGain.connect(masterGain);
    }
  }

  /**
   * Rebuild signal chain for a track with new effects configuration
   */
  static async rebuildSignalChain(trackId, trackState) {
    console.log('🔗 AudioContextService.rebuildSignalChain:', trackId, trackState);

    if (!this.audioEngine) {
      // Silently skip if audio engine not ready (normal during initialization)
      return;
    }

    // Special handling for master track
    if (trackId === 'master') {
      return this.rebuildMasterChain(trackState);
    }

    // Regular track handling
    if (!this.audioEngine.mixerChannels) {
      return;
    }

    const channel = this.audioEngine.mixerChannels.get(trackId);
    if (!channel) {
      console.warn('⚠️ No mixer channel found for trackId:', trackId);
      return;
    }

    try {
      // ✅ SAFETY: Fade out during chain rebuild to avoid pops/clicks
      const originalGain = channel.output ? channel.output.gain.value : 1;
      console.log('💾 Saving original gain:', originalGain);

      // ⚠️ TEMPORARILY DISABLED: Fade out causes issues with testing
      // We'll do instant rebuild instead
      // if (channel.output && channel.output.gain) {
      //   channel.output.gain.setTargetAtTime(0, this.audioEngine.audioContext.currentTime, 0.01);
      // }

      // Clear existing effects with better error handling
      if (channel.effects) {
        const effectsToDispose = Array.from(channel.effects.values());
        for (const effect of effectsToDispose) {
          try {
            if (effect.node) {
              effect.node.disconnect();
            }
            if (effect.dispose) {
              effect.dispose();
            }
          } catch (disposeError) {
            console.warn('⚠️ Error disposing effect:', effect.id, disposeError);
          }
        }
        channel.effects.clear();
      }

      // Rebuild signal chain: mixerNode -> effects -> analyzer -> output
      if (channel.mixerNode && channel.analyzer && channel.output) {
        // Disconnect all first
        try {
          channel.mixerNode.disconnect();
          channel.analyzer.disconnect();
        } catch (disconnectError) {
          console.warn('⚠️ Disconnect warning (expected):', disconnectError.message);
        }

        // ✅ FIX: Add new effects WITHOUT calling channel's rebuild (avoid double rebuild)
        if (trackState.insertEffects && trackState.insertEffects.length > 0) {
          // Manually build the chain to avoid channel._rebuildEffectChain()
          let currentNode = channel.mixerNode;
          console.log('🔗 Building effect chain for', trackId, 'with', trackState.insertEffects.length, 'effects');
          console.log('🔗 Starting node:', currentNode.constructor.name);

          for (const effectConfig of trackState.insertEffects) {
            try {
              // ✅ OPTIMIZATION: Create all effects (even bypassed ones) for instant toggle
              const node = await effectRegistry.createEffectNode(
                effectConfig.type,
                this.audioEngine.audioContext,
                effectConfig.settings
              );

              if (node) {
                // ✅ Create effect object with bypass state
                const effect = {
                  id: effectConfig.id,
                  type: effectConfig.type,
                  node: node,
                  settings: effectConfig.settings,
                  bypass: effectConfig.bypass || false,
                  parameters: new Map(),
                  updateParameter: function(paramName, value) {
                    const param = this.parameters.get(paramName);
                    if (param) {
                      const audioContext = this.node.context;
                      if (audioContext && audioContext.currentTime !== undefined) {
                        const now = audioContext.currentTime;
                        param.cancelScheduledValues(now);
                        param.setValueAtTime(param.value, now);
                        param.linearRampToValueAtTime(value, now + 0.015);
                      }
                    }
                    this.settings[paramName] = value;
                  },
                  dispose: function() {
                    if (this.node) {
                      try { this.node.disconnect(); } catch(e) {}
                    }
                  }
                };

                // Setup parameters
                if (node.parameters) {
                  for (const [name] of node.parameters) {
                    const param = node.parameters.get(name);
                    if (param) {
                      effect.parameters.set(name, param);
                    }
                  }
                }

                channel.effects.set(effectConfig.id, effect);

                // ✅ BYPASS OPTIMIZATION: Only connect to signal chain if NOT bypassed
                if (!effectConfig.bypass) {
                  console.log('🔗 Connecting:', currentNode.constructor.name, '→', effect.node.constructor.name);
                  currentNode.connect(effect.node);
                  currentNode = effect.node;
                  console.log('✅ Added effect to chain:', effectConfig.type, effectConfig.id);
                } else {
                  console.log('⏭️  Effect created but bypassed (disconnected):', effectConfig.type);
                }
              }
            } catch (error) {
              console.error('❌ Error adding effect:', effectConfig.type, error);
            }
          }

          // Connect last node to analyzer
          console.log('🔗 Final connection:', currentNode.constructor.name, '→ analyzer');
          currentNode.connect(channel.analyzer);
        } else {
          // No effects: direct connection
          console.log('🔗 No effects, direct connection: mixerNode → analyzer');
          channel.mixerNode.connect(channel.analyzer);
        }

        // Always connect analyzer to output
        console.log('🔗 analyzer → output');
        channel.analyzer.connect(channel.output);
      }

      // ✅ SAFETY: Restore gain immediately (no fade needed since we didn't fade out)
      if (channel.output && channel.output.gain && originalGain !== channel.output.gain.value) {
        console.log('🔊 Restoring gain to:', originalGain);
        channel.output.gain.setValueAtTime(originalGain, this.audioEngine.audioContext.currentTime);
      }

      console.log('✅ Signal chain rebuilt successfully for:', trackId);
    } catch (error) {
      console.error('❌ Error rebuilding signal chain:', error);
      // ✅ SAFETY: Always restore gain even on error
      if (channel.output && channel.output.gain) {
        channel.output.gain.setTargetAtTime(originalGain, this.audioEngine.audioContext.currentTime, 0.02);
      }
    }
  }

  /**
   * Build effect chain for a channel
   * ✅ DEPRECATED: Now handled inline in rebuildSignalChain to avoid double rebuild
   */

  /**
   * ✅ OPTIMIZATION: Toggle effect bypass without full chain rebuild
   * Disconnects worklet when bypassed to save CPU
   */
  static toggleEffectBypass(trackId, effectId, bypass) {
    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    // Get track state first
    const trackState = this.getTrackState(trackId);
    if (!trackState || !trackState.insertEffects) {
      console.warn('⚠️ Cannot get track state for bypass toggle');
      return;
    }

    // 🎚️ Special handling for master track
    if (trackId === 'master') {
      if (!this.audioEngine.masterEffects) {
        console.warn('⚠️ No master effects available');
        return;
      }

      const effect = this.audioEngine.masterEffects.get(effectId);
      if (!effect) {
        console.warn('⚠️ Master effect not found:', effectId);
        return;
      }

      // If already in desired bypass state, do nothing
      if (effect.bypass === bypass) {
        return;
      }

      console.log(`🔄 Toggling master bypass for ${effect.type} (${effectId}): ${effect.bypass} → ${bypass}`);

      // Update bypass state
      effect.bypass = bypass;

      // Update in store
      const effectConfig = trackState.insertEffects.find(e => e.id === effectId);
      if (effectConfig) {
        effectConfig.bypass = bypass;
      }

      // Rebuild master chain
      this.rebuildMasterChain(trackState);
      return;
    }

    // Regular track handling
    if (!this.audioEngine.mixerChannels) {
      console.warn('⚠️ No mixer channels available');
      return;
    }

    const channel = this.audioEngine.mixerChannels.get(trackId);
    if (!channel || !channel.effects) {
      console.warn('⚠️ No mixer channel or effects found for trackId:', trackId);
      return;
    }

    const effect = channel.effects.get(effectId);
    if (!effect) {
      console.warn('⚠️ Effect not found:', effectId);
      return;
    }

    // If already in desired bypass state, do nothing
    if (effect.bypass === bypass) {
      return;
    }

    console.log(`🔄 Toggling bypass for ${effect.type} (${effectId}): ${effect.bypass} → ${bypass}`);

    // Update bypass state
    effect.bypass = bypass;

    // Rebuild signal chain efficiently
    try {
      // Disconnect all effects first
      channel.mixerNode.disconnect();
      channel.effects.forEach(fx => {
        try { fx.node.disconnect(); } catch(e) {}
      });
      if (channel.analyzer) {
        try { channel.analyzer.disconnect(); } catch(e) {}
      }

      // Reconnect chain with updated bypass states
      let currentNode = channel.mixerNode;

      trackState.insertEffects.forEach(effectConfig => {
        const fx = channel.effects.get(effectConfig.id);
        if (fx && !fx.bypass) {
          currentNode.connect(fx.node);
          currentNode = fx.node;
        }
      });

      // Connect to analyzer and output
      currentNode.connect(channel.analyzer);
      channel.analyzer.connect(channel.output);

      console.log(`✅ Bypass toggled successfully - effect ${bypass ? 'DISCONNECTED' : 'CONNECTED'}`);
    } catch (error) {
      console.error('❌ Error toggling bypass:', error);
      // Fallback: full rebuild
      this.rebuildSignalChain(trackId, trackState);
    }
  }

  /**
   * Helper to get track state from mixer store
   */
  static getTrackState(trackId) {
    // Import dynamically to avoid circular dependency
    try {
      // Access via StoreManager if available
      if (typeof window !== 'undefined') {
        const { useMixerStore } = require('../store/useMixerStore.js');
        const state = useMixerStore.getState();
        return state.mixerTracks?.find(t => t.id === trackId);
      }
    } catch (error) {
      console.warn('⚠️ Could not access mixer store:', error);
    }
    return null;
  }

  /**
   * Update effect parameter
   */
  static updateEffectParam(trackId, effectId, param, value) {
    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    // 🎛️ DYNAMIC MIXER: Try dynamic mixer insert first
    if (this.audioEngine.mixerInserts) {
      const insert = this.audioEngine.mixerInserts.get(trackId);
      if (insert && insert.effects) {
        const effect = insert.effects.get(effectId);
        if (effect) {
          // Use dynamic mixer insert API
          this.updateInsertEffectParam(trackId, effectId, param, value);
          return;
        }
      }
    }

    // Master track or old system fallback
    let effect;
    if (trackId === 'master') {
      if (!this.audioEngine.masterEffects) {
        console.warn('⚠️ No master effects available');
        return;
      }
      effect = this.audioEngine.masterEffects.get(effectId);
      if (!effect) {
        console.warn('⚠️ Master effect not found:', effectId);
        return;
      }
    } else {
      // Old mixer channels (backward compatibility)
      if (!this.audioEngine.mixerChannels) {
        console.warn('⚠️ No mixer channels available');
        return;
      }

      const channel = this.audioEngine.mixerChannels.get(trackId);
      if (!channel || !channel.effects) {
        console.warn('⚠️ No mixer channel or effects found for trackId:', trackId);
        return;
      }

      effect = Array.from(channel.effects.values()).find(fx => fx.id === effectId);
      if (!effect) {
        console.warn('⚠️ Effect not found:', effectId);
        return;
      }
    }

    // ⚡ SPECIAL CASE: Bypass parameter
    if (param === 'bypass') {
      this.toggleEffectBypass(trackId, effectId, value);
      return;
    }

    // ⚡ MultiBandEQ V2: Send bands array via message port
    if (effect.type === 'MultiBandEQ' && param === 'bands') {
      if (effect.node && effect.node.port) {
        const now = performance.now();
        if (!effect._lastBandUpdate || (now - effect._lastBandUpdate) >= 16) {
          effect._lastBandUpdate = now;
          effect.node.port.postMessage({
            type: 'updateBands',
            bands: value
          });
        }
      } else {
        console.warn('[MultiBandEQV2] No port found on effect node:', effect);
      }
    }
    // Standard AudioParam updates
    else if (effect.updateParameter) {
      effect.updateParameter(param, value);
    } else {
      console.warn('[AudioContextService] No updateParameter method for:', effect.type, param);
    }
  }

  /**
   * Get effect node for visualization
   */
  static getEffectNode(trackId, effectId) {
    if (!this.audioEngine) {
      return null;
    }

    // 🎚️ Master track - use master effects
    if (trackId === 'master') {
      if (!this.audioEngine.masterEffects) {
        return null;
      }
      const effect = this.audioEngine.masterEffects.get(effectId);
      return effect && effect.node ? effect.node : null;
    }

    // 🎛️ DYNAMIC MIXER: Check mixer inserts first
    if (this.audioEngine.mixerInserts) {
      const insert = this.audioEngine.mixerInserts.get(trackId);
      if (insert && insert.effects) {
        const effect = insert.effects.get(effectId);
        if (effect && effect.node) {
          return effect.node;
        } else {
          console.warn(`⚠️ Effect '${effectId}' not found in insert ${trackId}`);
          console.log('Available effects in insert:', Array.from(insert.effects.keys()));
        }
      }
    }

    // Fallback to old mixer channels (backward compatibility)
    if (this.audioEngine.mixerChannels) {
      const channel = this.audioEngine.mixerChannels.get(trackId);
      if (channel && channel.effects) {
        const effect = Array.from(channel.effects.values()).find(fx => fx.id === effectId);
        if (effect && effect.node) {
          return effect.node;
        }
      }
    }

    console.warn('⚠️ Effect not found:', effectId);
    return null;
  }

  // =================== SAMPLE EDITOR INTEGRATION ===================

  /**
   * Preview sample with effects applied
   */
  static previewSample(instrumentId, trackId, velocity = 0.8) {
    console.log('🔊 AudioContextService.previewSample:', instrumentId, trackId);

    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    // Use audition system for preview
    if (this.audioEngine.auditionNoteOn) {
      this.audioEngine.auditionNoteOn(instrumentId, 'C4', velocity);
    }
  }

  /**
   * Stop sample preview
   */
  static stopSamplePreview(instrumentId) {
    console.log('🔇 AudioContextService.stopSamplePreview:', instrumentId);

    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    if (this.audioEngine.auditionNoteOff) {
      this.audioEngine.auditionNoteOff(instrumentId, 'C4');
    }
  }

  /**
   * Apply real-time processing to instrument
   */
  static updateInstrumentParams(instrumentId, params) {
    console.log('🎚️ AudioContextService.updateInstrumentParams:', instrumentId, params);

    if (!this.audioEngine || !this.audioEngine.instruments) {
      console.warn('⚠️ No audio engine or instruments available');
      return;
    }

    const instrument = this.audioEngine.instruments.get(instrumentId);
    if (instrument && instrument.updateParameters) {
      instrument.updateParameters(params);
      console.log('✅ Updated instrument parameters:', instrumentId);
    } else {
      console.warn('⚠️ Instrument not found or no updateParameters method:', instrumentId);
    }
  }

  /**
   * Request instrument buffer for sample editor
   */
  static async requestInstrumentBuffer(instrumentId) {
    console.log('🎵 AudioContextService.requestInstrumentBuffer:', instrumentId);

    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return null;
    }

    // Check if instrument exists
    const instrument = this.audioEngine.instruments.get(instrumentId);
    if (!instrument) {
      console.warn('⚠️ Instrument not found:', instrumentId);
      return null;
    }

    // For sample instruments, return the buffer
    if (instrument.buffer) {
      console.log('✅ Returning instrument buffer:', instrumentId);
      return instrument.buffer;
    }

    // Check in sample buffers cache
    if (this.audioEngine.sampleBuffers && this.audioEngine.sampleBuffers.has(instrumentId)) {
      const buffer = this.audioEngine.sampleBuffers.get(instrumentId);
      console.log('✅ Returning cached sample buffer:', instrumentId);
      return buffer;
    }

    console.warn('⚠️ No buffer found for instrument:', instrumentId);
    return null;
  }


  /**
   * Convert dB to linear value
   */
  static dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  // ========================================
  // === INSTRUMENT MANAGEMENT ===
  // ========================================

  /**
   * Create a new instrument in the audio engine
   * @param {Object} instrument - Instrument data
   */
  static createInstrument(instrument) {
    if (!this.audioEngine) {
      console.warn('⚠️ AudioContextService: Cannot create instrument - audio engine not ready');
      return;
    }

    try {
      // For now, just log the instrument creation
      // TODO: Implement actual audio engine instrument creation
      console.log('🎵 AudioContextService: Creating instrument:', instrument.name, instrument.type);

      // If the audio engine has an instrument creation method, call it here
      if (this.audioEngine.createInstrument) {
        return this.audioEngine.createInstrument(instrument);
      }
    } catch (error) {
      console.error('❌ AudioContextService: Failed to create instrument:', error);
    }
  }

  /**
   * Update instrument parameters
   * @param {string} instrumentId - Instrument ID
   * @param {Object} params - Updated parameters
   */
  static updateInstrumentParameters(instrumentId, params) {
    if (!this.audioEngine) {
      console.warn('⚠️ AudioContextService: Cannot update instrument - audio engine not ready');
      return;
    }

    try {
      console.log('🎚️ AudioContextService: Updating instrument parameters:', instrumentId);

      // If the audio engine has parameter update method, call it here
      if (this.audioEngine.updateInstrumentParameters) {
        return this.audioEngine.updateInstrumentParameters(instrumentId, params);
      }
    } catch (error) {
      console.error('❌ AudioContextService: Failed to update instrument parameters:', error);
    }
  }

  /**
   * Set instrument mute state
   * @param {string} instrumentId - Instrument ID
   * @param {boolean} isMuted - Mute state
   */
  static setInstrumentMute(instrumentId, isMuted) {
    if (!this.audioEngine) {
      console.warn('⚠️ AudioContextService: Cannot set mute - audio engine not ready');
      return;
    }

    try {
      console.log('🔇 AudioContextService: Setting instrument mute:', instrumentId, isMuted);

      // If the audio engine has mute method, call it here
      if (this.audioEngine.setInstrumentMute) {
        return this.audioEngine.setInstrumentMute(instrumentId, isMuted);
      }
    } catch (error) {
      console.error('❌ AudioContextService: Failed to set instrument mute:', error);
    }
  }

  /**
   * Reconcile instrument (rebuild buffer with effects)
   * @param {string} instrumentId - Instrument ID
   * @param {Object} instrumentData - Updated instrument data
   */
  static async reconcileInstrument(instrumentId, instrumentData) {
    if (!this.audioEngine) {
      console.warn('⚠️ AudioContextService: Cannot reconcile instrument - audio engine not ready');
      return null;
    }

    try {
      console.log('🔄 AudioContextService: Reconciling instrument:', instrumentId);

      // If the audio engine has reconcile method, call it here
      if (this.audioEngine.reconcileInstrument) {
        return await this.audioEngine.reconcileInstrument(instrumentId, instrumentData);
      }

      // Return a mock buffer for now
      return null;
    } catch (error) {
      console.error('❌ AudioContextService: Failed to reconcile instrument:', error);
      return null;
    }
  }

  /**
   * Cleanup and disposal
   */
  static dispose() {
    console.log('🗑️ Disposing AudioContextService...');

    // Dispose interface APIs
    this.timelineAPI?.dispose?.();
    this.parameterSync?.dispose?.();
    this.loopManager?.dispose?.();

    // Clear references
    this.audioEngine = null;
    this.timelineAPI = null;
    this.parameterSync = null;
    this.loopManager = null;
    this.eventBus = null;
    this.interfaceManager = null;

    console.log('✅ AudioContextService disposed');
  }

  // =================== VISUALIZATION SUPPORT ===================

  /**
   * Get effect audio node for visualization
   * @param {string} trackId - Track ID
   * @param {string} effectId - Effect ID
   * @returns {AudioNode|null} The effect's audio node or null
   */
  static getEffectAudioNode(trackId, effectId) {
    if (!this.audioEngine || !this.audioEngine.mixerChannels) {
      console.warn('⚠️ No audio engine available');
      return null;
    }

    const channel = this.audioEngine.mixerChannels.get(trackId);
    if (!channel || !channel.effects) {
      console.warn('⚠️ No mixer channel found for trackId:', trackId);
      return null;
    }

    const effect = channel.effects.get(effectId);
    if (!effect || !effect.node) {
      console.warn('⚠️ Effect not found:', effectId);
      return null;
    }

    return effect.node;
  }

  /**
   * Get channel audio node for visualization
   * @param {string} trackId - Track ID
   * @returns {AudioNode|null} The channel's output node or null
   */
  static getChannelAudioNode(trackId) {
    if (!this.audioEngine || !this.audioEngine.mixerChannels) {
      console.warn('⚠️ No audio engine available');
      return null;
    }

    const channel = this.audioEngine.mixerChannels.get(trackId);
    if (!channel) {
      console.warn('⚠️ No mixer channel found for trackId:', trackId);
      return null;
    }

    return channel.output;
  }

  // =================== 🎛️ DİNAMİK MİXER INSERT API ===================

  /**
   * Create mixer insert (when track is added)
   * @param {string} trackId - Track ID
   * @param {string} label - Display label
   */
  static createMixerInsert(trackId, label = '') {
    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return null;
    }

    if (!this.audioEngine.createMixerInsert) {
      console.warn('⚠️ Audio engine does not support dynamic mixer inserts');
      return null;
    }

    try {
      const insert = this.audioEngine.createMixerInsert(trackId, label);
      console.log(`✅ AudioContextService: Created mixer insert ${trackId} (${label})`);
      return insert;
    } catch (error) {
      console.error(`❌ AudioContextService: Failed to create mixer insert ${trackId}:`, error);
      return null;
    }
  }

  /**
   * Remove mixer insert (when track is deleted)
   * @param {string} trackId - Track ID
   */
  static removeMixerInsert(trackId) {
    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    if (!this.audioEngine.removeMixerInsert) {
      console.warn('⚠️ Audio engine does not support dynamic mixer inserts');
      return;
    }

    try {
      this.audioEngine.removeMixerInsert(trackId);
      console.log(`✅ AudioContextService: Removed mixer insert ${trackId}`);
    } catch (error) {
      console.error(`❌ AudioContextService: Failed to remove mixer insert ${trackId}:`, error);
    }
  }

  /**
   * Route instrument to mixer insert
   * @param {string} instrumentId - Instrument ID
   * @param {string} trackId - Track ID (insert ID)
   */
  static routeInstrumentToInsert(instrumentId, trackId) {
    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    if (!this.audioEngine.routeInstrumentToInsert) {
      console.warn('⚠️ Audio engine does not support dynamic routing');
      return;
    }

    try {
      this.audioEngine.routeInstrumentToInsert(instrumentId, trackId);
      console.log(`✅ AudioContextService: Routed ${instrumentId} → ${trackId}`);
    } catch (error) {
      console.error(`❌ AudioContextService: Failed to route instrument:`, error);
    }
  }

  /**
   * Add effect to mixer insert
   * @param {string} trackId - Track ID (insert ID)
   * @param {string} effectType - Effect type
   * @param {object} settings - Effect settings
   * @returns {string|null} Effect ID
   */
  static async addEffectToInsert(trackId, effectType, settings = {}) {
    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return null;
    }

    if (!this.audioEngine.addEffectToInsert) {
      console.warn('⚠️ Audio engine does not support insert effects');
      return null;
    }

    try {
      const effectId = await this.audioEngine.addEffectToInsert(trackId, effectType, settings);
      console.log(`✅ AudioContextService: Added ${effectType} to ${trackId}`);
      return effectId;
    } catch (error) {
      console.error(`❌ AudioContextService: Failed to add effect:`, error);
      return null;
    }
  }

  /**
   * Remove effect from mixer insert
   * @param {string} trackId - Track ID (insert ID)
   * @param {string} effectId - Effect ID
   */
  static removeEffectFromInsert(trackId, effectId) {
    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return;
    }

    if (!this.audioEngine.removeEffectFromInsert) {
      console.warn('⚠️ Audio engine does not support insert effects');
      return;
    }

    try {
      this.audioEngine.removeEffectFromInsert(trackId, effectId);
      console.log(`✅ AudioContextService: Removed effect ${effectId} from ${trackId}`);
    } catch (error) {
      console.error(`❌ AudioContextService: Failed to remove effect:`, error);
    }
  }

  /**
   * Update effect parameter in mixer insert
   * @param {string} trackId - Track ID (insert ID)
   * @param {string} effectId - Effect ID
   * @param {string} paramName - Parameter name
   * @param {*} value - Parameter value
   */
  static updateInsertEffectParam(trackId, effectId, paramName, value) {
    if (!this.audioEngine || !this.audioEngine.mixerInserts) {
      console.warn(`⚠️ AudioEngine or mixerInserts not available`);
      return;
    }

    const insert = this.audioEngine.mixerInserts.get(trackId);
    if (!insert) {
      console.warn(`⚠️ Insert ${trackId} not found`);
      console.log('Available inserts:', Array.from(this.audioEngine.mixerInserts.keys()));
      return;
    }

    const effect = insert.effects.get(effectId);
    if (!effect) {
      console.warn(`⚠️ Effect ${effectId} not found in insert ${trackId}`);
      console.log('Available effects in insert:', Array.from(insert.effects.keys()));
      return;
    }

    // Handle bypass separately
    if (paramName === 'bypass') {
      insert.setEffectBypass(effectId, value);
      return;
    }

    // Update effect node parameters
    const node = effect.node;
    if (!node) {
      console.warn(`⚠️ Effect node not found for ${effectId}`);
      return;
    }

    // Try to update AudioParam if exists
    if (node.parameters && node.parameters.has(paramName)) {
      const param = node.parameters.get(paramName);
      if (param && param.setValueAtTime) {
        const now = this.audioEngine.audioContext.currentTime;
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(value, now + 0.015);
        return;
      }
    }

    // Try direct property update
    if (paramName in node) {
      node[paramName] = value;
      return;
    }

    // Try updateParameter method (custom effects)
    if (node.updateParameter && typeof node.updateParameter === 'function') {
      node.updateParameter(paramName, value);
      return;
    }

    // Update settings for tracking
    if (effect.settings) {
      effect.settings[paramName] = value;
    }
  }

  /**
   * Set mixer insert gain (volume)
   * @param {string} trackId - Track ID
   * @param {number} gain - Gain value (0-1)
   */
  static setInsertGain(trackId, gain) {
    if (!this.audioEngine) {
      return;
    }

    if (!this.audioEngine.setInsertGain) {
      return;
    }

    try {
      this.audioEngine.setInsertGain(trackId, gain);
    } catch (error) {
      console.error(`❌ AudioContextService: Failed to set insert gain:`, error);
    }
  }

  /**
   * Set mixer insert pan
   * @param {string} trackId - Track ID
   * @param {number} pan - Pan value (-1 to 1)
   */
  static setInsertPan(trackId, pan) {
    if (!this.audioEngine) {
      return;
    }

    if (!this.audioEngine.setInsertPan) {
      return;
    }

    try {
      this.audioEngine.setInsertPan(trackId, pan);
    } catch (error) {
      console.error(`❌ AudioContextService: Failed to set insert pan:`, error);
    }
  }

  /**
   * Get mixer insert analyzer for metering
   * @param {string} trackId - Track ID
   * @returns {AnalyserNode|null}
   */
  static getInsertAnalyzer(trackId) {
    if (!this.audioEngine || !this.audioEngine.mixerInserts) {
      return null;
    }

    const insert = this.audioEngine.mixerInserts.get(trackId);
    if (!insert) {
      return null;
    }

    return insert.analyzer || null;
  }

  /**
   * Get mixer insert for direct manipulation
   * @param {string} trackId - Track ID
   * @returns {MixerInsert|null}
   */
  static getMixerInsert(trackId) {
    if (!this.audioEngine || !this.audioEngine.mixerInserts) {
      return null;
    }

    return this.audioEngine.mixerInserts.get(trackId) || null;
  }
};