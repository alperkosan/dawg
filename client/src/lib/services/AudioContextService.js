// lib/services/AudioContextService.js - Enhanced with Interface Layer
// DAWG - AudioContextService v3.0 with Native Interface APIs

import { TimelineSelectionAPI } from '../interfaces/TimelineSelectionAPI';
import { RealtimeParameterSync } from '../interfaces/RealtimeParameterSync';
import { DynamicLoopManager } from '../interfaces/DynamicLoopManager';
import EventBus from '../core/EventBus';
import { audioAssetManager } from '../audio/AudioAssetManager';

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
      console.log('🔊 Setting channel volume via audio engine:', trackId, `${value}dB → ${linearValue.toFixed(3)} linear`);
      this.audioEngine.setChannelVolume(trackId, linearValue);
    } else if (param === 'pan' && this.audioEngine.setChannelPan) {
      // Pan is already in correct range (-1 to +1)
      console.log('🔄 Setting channel pan via audio engine:', trackId, value);
      this.audioEngine.setChannelPan(trackId, value);
    } else if (param.startsWith('eq.') && this.audioEngine.setChannelEQ) {
      // Handle EQ parameters like 'eq.highGain'
      const eqParam = param.split('.')[1];
      console.log('🎚️ Setting channel EQ via audio engine:', trackId, eqParam, value);
      this.audioEngine.setChannelEQ(trackId, eqParam, value);
    } else {
      console.warn('⚠️ Unknown mixer parameter or missing audio engine method:', param);
    }
  }

  // =================== EFFECTS MANAGEMENT ===================

  /**
   * Rebuild signal chain for a track with new effects configuration
   */
  static async rebuildSignalChain(trackId, trackState) {
    console.log('🔗 AudioContextService.rebuildSignalChain:', trackId, trackState);

    if (!this.audioEngine || !this.audioEngine.mixerChannels) {
      console.warn('⚠️ No audio engine or mixer channels available');
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
      if (channel.output && channel.output.gain) {
        channel.output.gain.setTargetAtTime(0, this.audioEngine.audioContext.currentTime, 0.01);
      }

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

        // Add new effects from trackState
        if (trackState.insertEffects && trackState.insertEffects.length > 0) {
          await this._buildEffectChain(channel, trackState.insertEffects);
        } else {
          // No effects: direct connection
          channel.mixerNode.connect(channel.analyzer);
        }

        // Always connect analyzer to output
        channel.analyzer.connect(channel.output);
      }

      // ✅ SAFETY: Fade back in after rebuild
      setTimeout(() => {
        if (channel.output && channel.output.gain) {
          channel.output.gain.setTargetAtTime(originalGain, this.audioEngine.audioContext.currentTime, 0.02);
        }
      }, 50);

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
   */
  static async _buildEffectChain(channel, effects) {
    for (const effectConfig of effects) {
      if (effectConfig.bypass) {
        continue; // Skip bypassed effects
      }

      try {
        // Pass the store's effect ID to maintain consistency
        const effectId = await channel.addEffect(effectConfig.type, effectConfig.settings, effectConfig.id);
        console.log('✅ Added effect to channel:', effectConfig.type, 'Store ID:', effectConfig.id, 'Engine ID:', effectId);
      } catch (error) {
        console.error('❌ Error adding effect:', effectConfig.type, error);
      }
    }
  }

  /**
   * Update effect parameter
   */
  static updateEffectParam(trackId, effectId, param, value) {
    console.log('🎛️ AudioContextService.updateEffectParam:', trackId, effectId, param, value);

    if (!this.audioEngine || !this.audioEngine.mixerChannels) {
      console.warn('⚠️ No audio engine or mixer channels available');
      return;
    }

    const channel = this.audioEngine.mixerChannels.get(trackId);
    if (!channel || !channel.effects) {
      console.warn('⚠️ No mixer channel or effects found for trackId:', trackId);
      return;
    }

    // Find the effect and update parameter
    const effect = Array.from(channel.effects.values()).find(fx => fx.id === effectId);
    if (effect && effect.updateParameter) {
      effect.updateParameter(param, value);
      console.log('✅ Updated effect parameter:', effectId, param, value);
    } else {
      console.warn('⚠️ Effect not found or no updateParameter method:', effectId);
    }
  }

  /**
   * Get effect node for visualization
   */
  static getEffectNode(trackId, effectId) {
    if (!this.audioEngine || !this.audioEngine.mixerChannels) {
      console.warn('⚠️ No audio engine or mixer channels available');
      return null;
    }

    const channel = this.audioEngine.mixerChannels.get(trackId);
    if (!channel || !channel.effects) {
      console.warn('⚠️ No mixer channel or effects found for trackId:', trackId);
      return null;
    }

    // Find the effect and return its audio node
    const effect = Array.from(channel.effects.values()).find(fx => fx.id === effectId);
    if (effect && effect.node) {
      return effect.node;
    }

    console.warn('⚠️ Effect node not found:', trackId, effectId);
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
};