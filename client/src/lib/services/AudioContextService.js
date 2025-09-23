// lib/services/AudioContextService.js - Enhanced with Interface Layer
// DAWG - AudioContextService v3.0 with Native Interface APIs

import { TimelineSelectionAPI } from '../interfaces/TimelineSelectionAPI';
import { RealtimeParameterSync } from '../interfaces/RealtimeParameterSync';
import { DynamicLoopManager } from '../interfaces/DynamicLoopManager';
import { EventBus } from '../core/EventBus';

export class AudioContextService {
  static instance = null;
  static audioEngine = null;
  static isSubscriptionsSetup = false;
  
  // =================== NEW: INTERFACE LAYER ===================
  static interfaceManager = null;
  static eventBus = new EventBus();
  
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
  }
  
  static async setAudioEngine(engine) {
    this.audioEngine = engine;
    
    // Initialize interface layer
    await this.initializeInterfaceLayer();
    
    // Setup store subscriptions for reactive updates
    if (!this.isSubscriptionsSetup) {
      this._setupStoreSubscriptions();
      this.isSubscriptionsSetup = true;
    }
    
    console.log("✅ AudioContextService v3.0: Native Engine + Interface Layer ready");
    return engine;
  }
  
  static getAudioEngine() {
    if (!this.audioEngine) {
      console.warn("⚠️ AudioContextService: Audio engine not ready!");
    }
    return this.audioEngine;
  }

  // =================== INTERFACE LAYER INITIALIZATION ===================

  static async initializeInterfaceLayer() {
    if (!this.audioEngine) {
      throw new Error('Audio engine must be set before initializing interface layer');
    }

    console.log('🔌 Initializing Interface Layer...');

    // Initialize Event Bus
    this.eventBus = new EventBus();

    // Initialize Timeline Selection API
    this.timelineAPI = new TimelineSelectionAPI(this.audioEngine, this.eventBus);

    // Initialize Real-time Parameter Sync
    this.parameterSync = new RealtimeParameterSync(this.audioEngine, this.eventBus);

    // Initialize Dynamic Loop Manager
    this.loopManager = new DynamicLoopManager(this.audioEngine, this.eventBus);

    // Setup interface event forwarding
    this.setupInterfaceEventForwarding();

    console.log('✅ Interface Layer initialized with Timeline, Parameters, and Loop APIs');
  }

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
  }

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

    // Status
    getCurrent: () => {
      return this.loopManager?.getCurrentLoop();
    },

    getStatus: () => {
      return this.