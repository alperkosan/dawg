// lib/services/AudioContextService.js - Enhanced with Interface Layer
// DAWG - AudioContextService v3.0 with Native Interface APIs

import { TimelineSelectionAPI } from '../interfaces/TimelineSelectionAPI';
import { RealtimeParameterSync } from '../interfaces/RealtimeParameterSync';
import { DynamicLoopManager } from '../interfaces/DynamicLoopManager';
import EventBus from '../core/EventBus';
import { audioAssetManager } from '../audio/AudioAssetManager';
import { effectRegistry } from '../audio/EffectRegistry';
import { idleDetector } from '../utils/IdleDetector.js';

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
      await this._setupStoreSubscriptions();
      this.isSubscriptionsSetup = true;
    }

    // ⚡ IDLE OPTIMIZATION: Setup AudioContext suspend/resume
    this._setupAudioContextIdleOptimization();

    console.log("✅ AudioContextService v3.0: Native Engine + Interface Layer + Idle Optimization ready");
    return engine;
  };

  /**
   * ⚡ IDLE OPTIMIZATION: Suspend AudioContext when idle and not playing
   * This can save 10-15% CPU when idle!
   */
  static _setupAudioContextIdleOptimization() {
    const audioContext = this.audioEngine?.audioContext;
    if (!audioContext) return;

    // Suspend on idle (if not playing)
    idleDetector.onIdle(async () => {
      const isPlaying = this.audioEngine?.transport?.state === 'started';

      if (!isPlaying && audioContext.state === 'running') {
        try {
          await audioContext.suspend();
          console.log('😴 AudioContext suspended (idle, not playing)');
        } catch (error) {
          console.warn('⚠️ Failed to suspend AudioContext:', error);
        }
      }
    });

    // Resume on active
    idleDetector.onActive(async () => {
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
          console.log('👁️ AudioContext resumed (active)');
        } catch (error) {
          console.warn('⚠️ Failed to resume AudioContext:', error);
        }
      }
    });
  }

  static getAudioEngine() {
    if (!this.audioEngine) {
      console.warn("⚠️ AudioContextService: Audio engine not ready!");
    }
    return this.audioEngine;
  };

  static getAudioContext() {
    return this.audioEngine?.audioContext || null;
  };

  // =================== MIXER CONTROLS ===================

  /**
   * Set mute state for a track
   * @param {string} trackId - Track ID
   * @param {boolean} muted - Mute state
   */
  static setMuteState(trackId, muted) {
    if (!this.audioEngine) return;
    this.audioEngine.setInsertMute(trackId, muted);
  }

  /**
   * Set solo state (affects all tracks)
   * @param {Set} soloedTracks - Set of soloed track IDs
   * @param {Set} mutedTracks - Set of originally muted track IDs
   */
  static setSoloState(soloedTracks, mutedTracks) {
    if (!this.audioEngine) return;
    this.audioEngine.setSoloMode(soloedTracks, mutedTracks);
  }

  /**
   * Set mono state for a track
   * @param {string} trackId - Track ID
   * @param {boolean} mono - Mono state
   */
  static setMonoState(trackId, mono) {
    if (!this.audioEngine) return;
    this.audioEngine.setInsertMono(trackId, mono);
  }

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
  static async _setupStoreSubscriptions() {
    // This would typically be called from setAudioEngine
    // Implementation depends on specific store structure
    console.log('📡 Setting up store subscriptions...');
    
    // ✅ FIX: Sync existing mixer tracks to audio engine
    await this._syncMixerTracksToAudioEngine();
    
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

  /**
   * ✅ FIX: Sync mixer tracks from store to audio engine
   * Creates mixer inserts for all existing tracks
   */
  static async _syncMixerTracksToAudioEngine() {
    if (!this.audioEngine) {
      console.warn('⚠️ Cannot sync mixer tracks: audio engine not ready');
      return;
    }

    try {
      // Get mixer tracks from store (direct import to avoid circular deps)
      let mixerTracks = [];
      try {
        // Try direct import first (preferred)
        const { useMixerStore } = await import('@/store/useMixerStore');
        const state = useMixerStore.getState();
        mixerTracks = state.mixerTracks || [];
      } catch (importError) {
        // Fallback to window object if import fails
        if (typeof window !== 'undefined' && window.__DAWG_STORES__?.useMixerStore) {
          const state = window.__DAWG_STORES__.useMixerStore.getState();
          mixerTracks = state.mixerTracks || [];
        } else {
          console.warn('⚠️ Cannot access mixer store - mixer tracks may not be synced');
          return;
        }
      }

      console.log(`🎛️ Syncing ${mixerTracks.length} mixer tracks to audio engine...`);

      for (const track of mixerTracks) {
        // Check if insert already exists
        const insertExists = this.audioEngine.mixerInserts?.has(track.id);

        if (!insertExists) {
          // Create mixer insert for this track
          try {
            const insert = this.createMixerInsert(track.id, track.name || track.id);
            if (insert) {
              // Set initial gain and pan from store
              if (track.volume !== undefined) {
                const linearGain = Math.pow(10, track.volume / 20);
                insert.setGain(linearGain);
              }
              if (track.pan !== undefined) {
                insert.setPan(track.pan);
              }
              console.log(`✅ Created mixer insert for track "${track.name || track.id}"`);
            }
          } catch (error) {
            console.error(`❌ Failed to create mixer insert for track ${track.id}:`, error);
            continue; // Skip to next track if insert creation failed
          }
        }

        // ✅ CRITICAL FIX: Sync insert effects to AudioEngine
        // This ensures effects from deserialized projects are properly created in AudioEngine
        if (track.insertEffects && Array.isArray(track.insertEffects) && track.insertEffects.length > 0) {
          const insert = this.audioEngine.mixerInserts.get(track.id);
          if (insert) {
            for (const effect of track.insertEffects) {
              try {
                // Check if effect already exists in AudioEngine
                const effectExists = insert.effects?.has(effect.id);
                if (!effectExists) {
                  console.log(`🎛️ Adding effect ${effect.type} (${effect.id}) to insert ${track.id}...`);

                  // Add effect to insert with original ID and settings
                  await this.audioEngine.addEffectToInsert(
                    track.id,
                    effect.type,
                    effect.settings || {},
                    effect.id  // Pass original effect ID to preserve it
                  );

                  // Apply bypass state if needed
                  if (effect.bypass && insert.effects?.has(effect.id)) {
                    const effectNode = insert.effects.get(effect.id);
                    if (effectNode && effectNode.bypass !== undefined) {
                      effectNode.bypass = effect.bypass;
                    }
                  }

                  console.log(`✅ Added effect ${effect.type} (${effect.id}) to insert ${track.id}`);
                }
              } catch (error) {
                console.error(`❌ Failed to add effect ${effect.type} to insert ${track.id}:`, error);
              }
            }
          }
        }
      }

      console.log(`✅ Synced ${mixerTracks.length} mixer tracks to audio engine`);
      
      // ✅ CRITICAL FIX: Sync existing instruments to mixer inserts
      await this._syncInstrumentsToMixerInserts();
    } catch (error) {
      console.error('❌ Failed to sync mixer tracks:', error);
    }
  }

  /**
   * ✅ CRITICAL FIX: Sync existing instruments to mixer inserts
   * This ensures instruments created before audio engine initialization are properly routed
   */
  static async _syncInstrumentsToMixerInserts() {
    if (!this.audioEngine) {
      console.warn('⚠️ Cannot sync instruments: audio engine not ready');
      return;
    }

    try {
      // Get instruments from store (direct import to avoid circular deps)
      let instruments = [];
      try {
        // Try direct import first (preferred)
        const { useInstrumentsStore } = await import('@/store/useInstrumentsStore');
        const state = useInstrumentsStore.getState();
        instruments = state.instruments || [];
      } catch (importError) {
        // Fallback to window object if import fails
        if (typeof window !== 'undefined' && window.__DAWG_STORES__?.useInstrumentsStore) {
          const state = window.__DAWG_STORES__.useInstrumentsStore.getState();
          instruments = state.instruments || [];
        } else {
          console.warn('⚠️ Cannot access instruments store - instruments may not be synced');
          return;
        }
      }

      console.log(`🎵 Syncing ${instruments.length} instruments to mixer inserts...`);
      console.log('🎵 Available instruments in store:', instruments.map(i => ({ id: i.id, name: i.name })));
      console.log('🎵 Available instruments in audio engine:', Array.from(this.audioEngine.instruments?.keys() || []));

      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let createdCount = 0;

      for (const instrument of instruments) {
        // Skip if instrument doesn't have mixerTrackId
        if (!instrument.mixerTrackId) {
          skippedCount++;
          continue;
        }

        // Check if instrument already exists in audio engine
        let audioEngineInstrument = this.audioEngine.instruments?.get(instrument.id);
        
        // ✅ CRITICAL FIX: If instrument doesn't exist, create it
        if (!audioEngineInstrument) {
          console.log(`🎵 Instrument ${instrument.id} not found in audio engine, creating...`);
          try {
            // ✅ CRITICAL: Preload sample if it's a sample instrument
            if (instrument.type === 'sample' && instrument.url && !instrument.audioBuffer) {
              console.log(`🎵 Preloading sample for instrument ${instrument.id}: ${instrument.url}`);
              try {
                // preloadSamples expects an array, so wrap in array
                await this.audioEngine.preloadSamples([instrument]);
                console.log(`✅ Sample preloaded for instrument ${instrument.id}`);
              } catch (preloadError) {
                console.error(`❌ Failed to preload sample for instrument ${instrument.id}:`, preloadError);
                // Continue anyway - createInstrument might handle it
              }
            }

            // Create instrument in audio engine
            await this.audioEngine.createInstrument(instrument);
            audioEngineInstrument = this.audioEngine.instruments?.get(instrument.id);
            if (audioEngineInstrument) {
              createdCount++;
              console.log(`✅ Created instrument ${instrument.id} (${instrument.name}) in audio engine`);
            } else {
              console.error(`❌ Failed to create instrument ${instrument.id} - still not found after creation`);
              errorCount++;
              continue;
            }
          } catch (createError) {
            console.error(`❌ Failed to create instrument ${instrument.id}:`, createError);
            errorCount++;
            continue;
          }
        }

        // ✅ FIX: Check if mixer insert exists, create if missing
        let mixerInsert = this.audioEngine.mixerInserts?.get(instrument.mixerTrackId);
        if (!mixerInsert) {
          console.warn(`⚠️ Mixer insert ${instrument.mixerTrackId} not found for instrument ${instrument.id}, creating...`);
          // Try to create the mixer insert
          try {
            mixerInsert = this.createMixerInsert(instrument.mixerTrackId, instrument.mixerTrackId);
            if (!mixerInsert) {
              console.error(`❌ Failed to create mixer insert ${instrument.mixerTrackId}`);
              errorCount++;
              continue;
            }
            console.log(`✅ Created mixer insert ${instrument.mixerTrackId} for instrument ${instrument.id}`);
          } catch (createError) {
            console.error(`❌ Failed to create mixer insert ${instrument.mixerTrackId}:`, createError);
            errorCount++;
            continue;
          }
        }

        // Check if already routed
        const currentRoute = this.audioEngine.instrumentToInsert?.get(instrument.id);
        if (currentRoute === instrument.mixerTrackId) {
          // Already routed correctly
          skippedCount++;
          continue;
        }

        // Route instrument to mixer insert
        try {
          this.routeInstrumentToInsert(instrument.id, instrument.mixerTrackId);
          syncedCount++;
          console.log(`✅ Routed instrument ${instrument.id} (${instrument.name}) to ${instrument.mixerTrackId}`);
        } catch (error) {
          console.error(`❌ Failed to route instrument ${instrument.id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Instrument sync complete: ${createdCount} created, ${syncedCount} synced, ${skippedCount} skipped, ${errorCount} errors`);
    } catch (error) {
      console.error('❌ Failed to sync instruments:', error);
    }
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

    // Use MixerInsert system
    if (this.audioEngine.mixerInserts) {
      const isAnySoloed = soloedChannels.size > 0;

      this.audioEngine.mixerInserts.forEach((insert, insertId) => {
        // NEVER mute master channel
        if (insertId === 'master') {
          console.log(`  Insert ${insertId}: SKIP (master never mutes)`);
          return;
        }

        const isSoloed = soloedChannels.has(insertId);
        const isManuallyMuted = mutedChannels.has(insertId);

        if (isAnySoloed) {
          // Solo is active - mute non-soloed channels
          const shouldMute = !isSoloed;
          if (this.audioEngine.setChannelMute) {
            console.log(`  Insert ${insertId}: Mute=${shouldMute} (Solo active, isSoloed=${isSoloed})`);
            this.audioEngine.setChannelMute(insertId, shouldMute);
          }
        } else {
          // No solo - restore manual mute state
          if (this.audioEngine.setChannelMute) {
            console.log(`  Insert ${insertId}: Restore mute=${isManuallyMuted} (No solo active)`);
            this.audioEngine.setChannelMute(insertId, isManuallyMuted);
          }
        }
      });
    }
  }

  // =================== EFFECTS MANAGEMENT ===================

  /**
   * Rebuild master bus effect chain
   * ⚡ OPTIMIZED: Now uses MixerInsert system (no manual rebuild needed)
   */
  static async rebuildMasterChain(trackState) {
    console.log('🔗 Rebuilding master chain (using MixerInsert system):', trackState);

    if (!this.audioEngine || !this.audioEngine.mixerInserts) {
      console.warn('⚠️ Audio engine or mixer inserts not available');
      return;
    }

    // ✅ UNIFIED: Use MixerInsert system for master track
    const masterInsert = this.audioEngine.mixerInserts.get('master');
    if (!masterInsert) {
      console.error('❌ Master MixerInsert not found - this should not happen!');
      return;
    }

    try {
      // Clear existing effects from master insert
      const existingEffectIds = Array.from(masterInsert.effects.keys());
      for (const effectId of existingEffectIds) {
        masterInsert.removeEffect(effectId);
      }

      // Add effects from track state
      const insertEffects = trackState?.insertEffects || [];
      for (const effectConfig of insertEffects) {
        try {
          const effectNode = await effectRegistry.createEffectNode(
            effectConfig.type,
            this.audioEngine.audioContext,
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
            // ✅ Ensure newly added master effects start enabled unless explicitly bypassed
            if (!effectConfig.bypass) {
              masterInsert.setEffectBypass(effectConfig.id, false);
            }
            console.log(`✅ Master effect added: ${effectConfig.type} (${effectConfig.id})`);
          }
        } catch (err) {
          console.error('❌ Failed to create master effect:', effectConfig.type, err);
        }
      }

      console.log(`✅ Master chain rebuilt with ${insertEffects.length} effects (MixerInsert system)`);

    } catch (error) {
      console.error('❌ Error rebuilding master chain:', error);
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

    // 🎛️ DYNAMIC MIXER: Use MixerInsert (no need to rebuild - effects are managed by MixerInsert)
    // MixerInsert automatically rebuilds chain when effects are added/removed/bypassed
    console.log('ℹ️ rebuildSignalChain called for track, but MixerInsert handles this automatically');
    return;
  }

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

    // ⚡ UNIFIED: Use MixerInsert system for ALL tracks (including master)
    if (this.audioEngine.mixerInserts) {
      const insert = this.audioEngine.mixerInserts.get(trackId);
      if (insert) {
        insert.setEffectBypass(effectId, bypass);
        console.log(`✅ Toggled bypass for effect ${effectId} on ${trackId}: ${bypass}`);
        return;
      } else {
        console.warn(`⚠️ MixerInsert not found for trackId: ${trackId}`);
        return;
      }
    }

    // ❌ FALLBACK: Old mixer channels system (should not be used)
    if (!this.audioEngine.mixerChannels) {
      console.warn('⚠️ No mixer channels or inserts available');
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
    // Access via window global to avoid circular dependency
    try {
      // useMixerStore is exposed globally via window.__DAWG_STORES__
      if (typeof window !== 'undefined' && window.__DAWG_STORES__?.useMixerStore) {
        const state = window.__DAWG_STORES__.useMixerStore.getState();
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
        // ⚡ PERFORMANCE: Optimized rate limiting with requestAnimationFrame
        if (effect._rafPending) {
          // Already scheduled, just update the pending value
          effect._pendingBands = value;
        } else {
          effect._rafPending = true;
          effect._pendingBands = value;

          requestAnimationFrame(() => {
            effect.node.port.postMessage({
              type: 'updateBands',
              bands: effect._pendingBands
            });
            effect._rafPending = false;
            effect._pendingBands = null;
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

    // 🎛️ DYNAMIC MIXER: Check mixer inserts first (includes master track!)
    if (this.audioEngine.mixerInserts) {
      const insert = this.audioEngine.mixerInserts.get(trackId);

      console.log('🔍 [getEffectNode] Mixer insert lookup:', {
        trackId,
        effectId,
        hasInsert: !!insert,
        hasEffects: !!insert?.effects,
        effectsSize: insert?.effects?.size,
        availableKeys: insert?.effects ? Array.from(insert.effects.keys()) : []
      });

      if (insert && insert.effects) {
        // Try direct lookup first (audioEngineId)
        let effect = insert.effects.get(effectId);

        console.log('🔍 [getEffectNode] Direct lookup:', {
          effectId,
          found: !!effect,
          hasNode: !!effect?.node,
          effectKeys: effect ? Object.keys(effect) : []
        });

        // If not found, search by audioEngineId (Store ID → AudioEngine ID mapping)
        if (!effect) {
          console.log('🔍 [getEffectNode] Trying fallback search...');
          const allEffects = Array.from(insert.effects.entries());
          console.log('🔍 [getEffectNode] All effects:', allEffects.map(([key, fx]) => ({
            key,
            fxId: fx.id,
            fxType: fx.type,
            hasNode: !!fx.node
          })));

          effect = Array.from(insert.effects.values()).find(fx =>
            fx.id === effectId || fx.audioEngineId === effectId
          );

          console.log('🔍 [getEffectNode] Fallback result:', {
            found: !!effect,
            matchedById: effect?.id === effectId,
            matchedByAudioEngineId: effect?.audioEngineId === effectId
          });
        }

        if (effect && effect.node) {
          console.log('✅ [getEffectNode] Effect found!', {
            effectId,
            nodeType: effect.node.constructor.name,
            hasPort: !!effect.node.port
          });
          return effect.node;
        } else if (import.meta.env.DEV) {
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
          console.log('✅ [getEffectNode] Found in legacy mixerChannels');
          return effect.node;
        }
      }
    }

    // Fallback to old master effects (backward compatibility)
    if (trackId === 'master' && this.audioEngine.masterEffects) {
      let effect = this.audioEngine.masterEffects.get(effectId);
      if (!effect) {
        effect = Array.from(this.audioEngine.masterEffects.values()).find(fx =>
          fx.id === effectId || fx.type === effectId
        );
      }
      if (effect && effect.node) {
        console.log('✅ [getEffectNode] Found in legacy masterEffects');
        return effect.node;
      }
    }

    console.warn('⚠️ [getEffectNode] Effect not found anywhere:', {
      trackId,
      effectId,
      hasMixerInserts: !!this.audioEngine.mixerInserts,
      hasMixerChannels: !!this.audioEngine.mixerChannels,
      hasMasterEffects: !!this.audioEngine.masterEffects
    });
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
  static async createInstrument(instrument) {
    if (!this.audioEngine) {
      console.warn('⚠️ AudioContextService: Cannot create instrument - audio engine not ready');
      return;
    }

    try {
      // ✅ FIX: Ensure mixer insert exists before creating instrument
      if (instrument.mixerTrackId) {
        let mixerInsert = this.audioEngine.mixerInserts?.get(instrument.mixerTrackId);
        if (!mixerInsert) {
          console.log(`🎛️ Creating mixer insert ${instrument.mixerTrackId} for instrument ${instrument.id}`);
          mixerInsert = this.createMixerInsert(instrument.mixerTrackId, instrument.mixerTrackId);
          if (!mixerInsert) {
            console.error(`❌ Failed to create mixer insert ${instrument.mixerTrackId}`);
            // Continue anyway - instrument creation might still work
          }
        }
      }

      console.log('🎵 AudioContextService: Creating instrument:', instrument.name, instrument.type);

      // If the audio engine has an instrument creation method, call it here
      if (this.audioEngine.createInstrument) {
        return await this.audioEngine.createInstrument(instrument);
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
   * @param {string} effectId - Effect ID (Store ID or AudioEngine ID)
   * @returns {AudioNode|null} The effect's audio node or null
   */
  static getEffectAudioNode(trackId, effectId) {
    if (!this.audioEngine) {
      console.warn('⚠️ No audio engine available');
      return null;
    }

    // 🎛️ DYNAMIC MIXER: Check mixer inserts FIRST (includes master track!)
    // This is the primary system now, master uses MixerInsert too
    if (this.audioEngine.mixerInserts) {
      const insert = this.audioEngine.mixerInserts.get(trackId);
      if (insert && insert.effects) {
        // Try direct lookup first
        let effect = insert.effects.get(effectId);

        // If not found, search by id or audioEngineId (Store ID → AudioEngine ID mapping)
        if (!effect) {
          effect = Array.from(insert.effects.values()).find(fx =>
            fx.id === effectId || fx.audioEngineId === effectId
          );
        }

        if (effect && effect.node) {
          return effect.node;
        } else if (import.meta.env.DEV) {
          console.warn('⚠️ Effect not found in insert:', effectId);
          console.log('Available effects in insert:', Array.from(insert.effects.keys()));
        }
      }
    }

    // 🎚️ LEGACY: Fallback to old masterEffects (backward compatibility)
    if (trackId === 'master' && this.audioEngine.masterEffects) {
      // Try direct lookup first (effectId)
      let effect = this.audioEngine.masterEffects.get(effectId);

      // ⚡ FIX: If not found, search by Store ID (masterEffects uses Store ID as key)
      if (!effect) {
        effect = Array.from(this.audioEngine.masterEffects.values()).find(fx =>
          fx.id === effectId || fx.type === effectId
        );
      }

      if (effect && effect.node) {
        return effect.node;
      } else if (import.meta.env.DEV) {
        console.warn('⚠️ Master effect not found in legacy system:', effectId);
        console.log('Available master effects:', Array.from(this.audioEngine.masterEffects.keys()));
      }
    }

    // 🎚️ LEGACY: Fallback to old mixerChannels (for backwards compatibility)
    if (this.audioEngine.mixerChannels) {
      const channel = this.audioEngine.mixerChannels.get(trackId);
      if (channel && channel.effects) {
        // Try direct lookup first (audioEngineId)
        let effect = channel.effects.get(effectId);

        // ⚡ FIX: If not found, search by audioEngineId (Store ID → AudioEngine ID mapping)
        if (!effect) {
          effect = Array.from(channel.effects.values()).find(fx =>
            fx.id === effectId || fx.audioEngineId === effectId
          );
        }

        if (effect && effect.node) {
          return effect.node;
        }
      }
    }

    if (import.meta.env.DEV) {
      console.warn('⚠️ Effect not found in any mixer:', effectId);
    }
    return null;
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
      // Log removed - already logged in NativeAudioEngine
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
   * @param {string} storeEffectId - Optional Store effect ID for mapping
   * @returns {string|null} Effect ID (audioEngineId)
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
      if (import.meta.env.DEV) {
        console.log(`✅ AudioContextService: Added ${effectType} to ${trackId} (ID: ${effectId})`);
      }
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

    // 🎛️ SIDECHAIN: Handle sidechain source routing
    if (paramName === 'scSourceId') {
      const getSourceInsert = (sourceInsertId) => {
        return this.audioEngine.mixerInserts.get(sourceInsertId);
      };
      insert.updateSidechainSource(effectId, value, getSourceInsert);
      // Continue to update settings (for storage)
    }

    // Update effect node parameters
    const node = effect.node;
    if (!node) {
      console.warn(`⚠️ Effect node not found for ${effectId}`);
      return;
    }

    // ⚡ SPECIAL HANDLING: MultiBandEQ V2 uses message-based band updates
    // Effect type is stored in effect object or can be inferred from settings
    const effectType = effect.type || effect.settings?.type;
    if (effectType === 'MultiBandEQ' && paramName === 'bands') {
      if (node.port) {
        // ⚡ PERFORMANCE: Optimized rate limiting with requestAnimationFrame
        // Only send updates once per frame (16.6ms) using RAF
        if (effect._rafPending) {
          // Already scheduled, just update the pending value
          effect._pendingBands = value;
        } else {
          effect._rafPending = true;
          effect._pendingBands = value;

          requestAnimationFrame(() => {
            node.port.postMessage({
              type: 'updateBands',
              bands: effect._pendingBands
            });
            effect._rafPending = false;
            effect._pendingBands = null;
          });
        }

        // Update settings for tracking
        if (effect.settings) {
          effect.settings[paramName] = value;
        }
        return;
      } else {
        console.warn(`⚠️ MultiBandEQ node.port not available for ${effectId}`);
      }
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