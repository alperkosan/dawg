// lib/interfaces/RealtimeParameterSync.js
// DAWG - Real-time Parameter Synchronization System

export class RealtimeParameterSync {
  constructor(audioEngine, eventBus) {
    this.engine = audioEngine;
    this.eventBus = eventBus;
    
    // Parameter management
    this.parameterQueue = new Map(); // Batch parameter changes
    this.automationRecorders = new Map(); // Active automation recording
    this.parameterSubscriptions = new Map(); // UI subscriptions
    
    // Performance optimization
    this.batchTimeout = null;
    this.batchInterval = 16; // ~60fps update rate
    this.maxBatchSize = 50; // Max parameters per batch
    
    // Value smoothing for audio parameters
    this.smoothingTime = 0.02; // 20ms smoothing
    
    console.log('Real-time Parameter Sync initialized');
    this.startParameterProcessor();
  }

  // =================== PARAMETER CHANGE MANAGEMENT ===================

  /**
   * Schedule a parameter change (batched for performance)
   * @param {string} targetId - Target (mixer channel, instrument, effect)
   * @param {string} parameter - Parameter name
   * @param {number} value - New value
   * @param {number} time - Optional schedule time (default: immediate)
   * @param {boolean} smooth - Whether to smooth the change
   */
  setParameter(targetId, parameter, value, time = null, smooth = true) {
    const changeId = `${targetId}.${parameter}`;
    const scheduleTime = time || (this.engine.audioContext?.currentTime || 0);
    
    // Add to batch queue
    this.parameterQueue.set(changeId, {
      targetId,
      parameter,
      value,
      time: scheduleTime,
      smooth,
      timestamp: performance.now()
    });
    
    // Immediate processing for critical parameters
    if (this.isCriticalParameter(targetId, parameter)) {
      this.processParameterChange(changeId);
    }
    
    // Emit UI update event
    this.eventBus.emit('parameterChanged', {
      targetId,
      parameter,
      value,
      time: scheduleTime
    });
    
    return true;
  }

  /**
   * Set multiple parameters at once
   * @param {string} targetId - Target identifier
   * @param {Object} parameters - Parameter object {param: value}
   * @param {number} time - Schedule time
   */
  setParameters(targetId, parameters, time = null) {
    const scheduleTime = time || (this.engine.audioContext?.currentTime || 0);
    
    Object.entries(parameters).forEach(([param, value]) => {
      this.setParameter(targetId, param, value, scheduleTime);
    });
    
    console.log(`Batch parameter update: ${targetId}`, parameters);
  }

  // =================== PARAMETER PROCESSING ===================

  /**
   * Process a single parameter change
   * @param {string} changeId - Parameter change identifier
   */
  processParameterChange(changeId) {
    const change = this.parameterQueue.get(changeId);
    if (!change) return false;
    
    const { targetId, parameter, value, time, smooth } = change;
    
    try {
      // Route to appropriate handler
      const [type, id] = targetId.split('-', 2);
      
      switch (type) {
        case 'mixer':
        case 'track':
          this.processMixerParameter(id, parameter, value, time, smooth);
          break;
          
        case 'instrument':
        case 'inst':
          this.processInstrumentParameter(id, parameter, value, time, smooth);
          break;
          
        case 'effect':
        case 'fx':
          this.processEffectParameter(id, parameter, value, time, smooth);
          break;
          
        case 'master':
          this.processMasterParameter(parameter, value, time, smooth);
          break;
          
        default:
          console.warn(`Unknown parameter target type: ${type}`);
          return false;
      }
      
      // Remove from queue after processing
      this.parameterQueue.delete(changeId);
      
      // Record automation if active
      this.recordAutomation(targetId, parameter, value, time);
      
      return true;
      
    } catch (error) {
      console.error(`Parameter processing error: ${changeId}`, error);
      this.parameterQueue.delete(changeId);
      return false;
    }
  }

  /**
   * Process mixer channel parameter
   */
  processMixerParameter(channelId, parameter, value, time, smooth) {
    const channel = this.engine.mixerChannels?.get(channelId);
    if (!channel) {
      console.warn(`Mixer channel not found: ${channelId}`);
      return false;
    }
    
    const audioParam = this.getMixerAudioParam(channel, parameter);
    if (audioParam) {
      // Direct AudioParam control for audio-rate parameters
      if (smooth) {
        audioParam.setTargetAtTime(value, time, this.smoothingTime);
      } else {
        audioParam.setValueAtTime(value, time);
      }
    } else {
      // Control-rate parameters (mute, solo, etc.)
      switch (parameter) {
        case 'volume':
        case 'gain':
          channel.setVolume(value);
          break;
        case 'pan':
          channel.setPan(value);
          break;
        case 'mute':
          channel.setMute(value);
          break;
        default:
          console.warn(`Unknown mixer parameter: ${parameter}`);
      }
    }
    
    console.log(`Mixer parameter updated: ${channelId}.${parameter} = ${value}`);
    return true;
  }

  /**
   * Process instrument parameter
   */
  processInstrumentParameter(instrumentId, parameter, value, time, smooth) {
    const instrument = this.engine.instruments?.get(instrumentId);
    if (!instrument) {
      console.warn(`Instrument not found: ${instrumentId}`);
      return false;
    }
    
    // Handle different instrument types
    if (instrument.type === 'synth' && instrument.parameters) {
      const audioParam = instrument.parameters.get(parameter);
      if (audioParam) {
        if (smooth) {
          audioParam.setTargetAtTime(value, time, this.smoothingTime);
        } else {
          audioParam.setValueAtTime(value, time);
        }
        
        console.log(`Synth parameter updated: ${instrumentId}.${parameter} = ${value}`);
        return true;
      }
    }
    
    // Sample instrument parameters (envelope, etc.)
    if (instrument.updateParameter) {
      instrument.updateParameter(parameter, value, time);
      console.log(`Instrument parameter updated: ${instrumentId}.${parameter} = ${value}`);
      return true;
    }
    
    console.warn(`Parameter not found: ${instrumentId}.${parameter}`);
    return false;
  }

  /**
   * Process effect parameter
   */
  processEffectParameter(effectId, parameter, value, time, smooth) {
    // Find effect across all mixer channels
    let targetEffect = null;
    let targetChannel = null;
    
    this.engine.mixerChannels?.forEach((channel, channelId) => {
      const effect = channel.effects?.get(effectId);
      if (effect) {
        targetEffect = effect;
        targetChannel = channelId;
      }
    });
    
    if (!targetEffect) {
      console.warn(`Effect not found: ${effectId}`);
      return false;
    }
    
    const audioParam = targetEffect.parameters?.get(parameter);
    if (audioParam) {
      if (smooth) {
        audioParam.setTargetAtTime(value, time, this.smoothingTime);
      } else {
        audioParam.setValueAtTime(value, time);
      }
    } else {
      // Control-rate effect parameter
      targetEffect.updateParameter(parameter, value);
    }
    
    console.log(`Effect parameter updated: ${effectId}.${parameter} = ${value}`);
    return true;
  }

  /**
   * Process master bus parameter
   */
  processMasterParameter(parameter, value, time, smooth) {
    switch (parameter) {
      case 'volume':
      case 'gain':
        if (this.engine.masterLimiter) {
          const param = this.engine.masterLimiter.gain;
          if (smooth) {
            param.setTargetAtTime(value, time, this.smoothingTime);
          } else {
            param.setValueAtTime(value, time);
          }
        }
        break;
        
      case 'lowGain':
      case 'midGain':  
      case 'highGain':
        if (this.engine.masterMixer?.parameters) {
          const param = this.engine.masterMixer.parameters.get(parameter);
          if (param) {
            if (smooth) {
              param.setTargetAtTime(value, time, this.smoothingTime);
            } else {
              param.setValueAtTime(value, time);
            }
          }
        }
        break;
        
      default:
        console.warn(`Unknown master parameter: ${parameter}`);
        return false;
    }
    
    console.log(`Master parameter updated: ${parameter} = ${value}`);
    return true;
  }

  // =================== BATCH PROCESSING ===================

  /**
   * Start the parameter processing loop
   */
  startParameterProcessor() {
    const processBatch = () => {
      if (this.parameterQueue.size > 0) {
        const startTime = performance.now();
        let processed = 0;
        
        // Process parameters in priority order
        const sortedChanges = Array.from(this.parameterQueue.keys()).sort((a, b) => {
          const changeA = this.parameterQueue.get(a);
          const changeB = this.parameterQueue.get(b);
          
          // Critical parameters first
          const criticalA = this.isCriticalParameter(changeA.targetId, changeA.parameter);
          const criticalB = this.isCriticalParameter(changeB.targetId, changeB.parameter);
          
          if (criticalA && !criticalB) return -1;
          if (!criticalA && criticalB) return 1;
          
          // Then by timestamp
          return changeA.timestamp - changeB.timestamp;
        });
        
        // Process up to maxBatchSize parameters
        for (const changeId of sortedChanges) {
          if (processed >= this.maxBatchSize) break;
          
          this.processParameterChange(changeId);
          processed++;
        }
        
        const processingTime = performance.now() - startTime;
        if (processingTime > 5) { // Log if processing takes > 5ms
          console.log(`Parameter batch processed: ${processed} changes in ${processingTime.toFixed(2)}ms`);
        }
      }
      
      this.batchTimeout = setTimeout(processBatch, this.batchInterval);
    };
    
    processBatch();
  }

  /**
   * Stop the parameter processing loop
   */
  stopParameterProcessor() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  // =================== AUTOMATION RECORDING ===================

  /**
   * Start recording automation for a parameter
   * @param {string} targetId - Target identifier
   * @param {string} parameter - Parameter name
   */
  startAutomationRecording(targetId, parameter) {
    const recordingId = `${targetId}.${parameter}`;
    
    this.automationRecorders.set(recordingId, {
      targetId,
      parameter,
      startTime: this.engine.audioContext?.currentTime || 0,
      events: [],
      isRecording: true
    });
    
    this.eventBus.emit('automationRecordingStart', {
      targetId,
      parameter
    });
    
    console.log(`Automation recording started: ${recordingId}`);
  }

  /**
   * Stop recording automation
   * @param {string} targetId - Target identifier  
   * @param {string} parameter - Parameter name
   */
  stopAutomationRecording(targetId, parameter) {
    const recordingId = `${targetId}.${parameter}`;
    const recording = this.automationRecorders.get(recordingId);
    
    if (recording) {
      recording.isRecording = false;
      recording.endTime = this.engine.audioContext?.currentTime || 0;
      
      this.eventBus.emit('automationRecordingEnd', {
        targetId,
        parameter,
        events: recording.events,
        duration: recording.endTime - recording.startTime
      });
      
      console.log(`Automation recording stopped: ${recordingId} (${recording.events.length} events)`);
      
      // Keep recording for potential save/export
      return recording;
    }
    
    return null;
  }

  /**
   * Record an automation event if recording is active
   */
  recordAutomation(targetId, parameter, value, time) {
    const recordingId = `${targetId}.${parameter}`;
    const recording = this.automationRecorders.get(recordingId);
    
    if (recording && recording.isRecording) {
      recording.events.push({
        time: time - recording.startTime,
        value,
        timestamp: performance.now()
      });
    }
  }

  // =================== UTILITY METHODS ===================

  /**
   * Check if a parameter is critical (needs immediate processing)
   */
  isCriticalParameter(targetId, parameter) {
    // Audio-rate parameters that need immediate processing
    const criticalParams = ['volume', 'gain', 'pan', 'pitch', 'frequency'];
    return criticalParams.includes(parameter.toLowerCase());
  }

  /**
   * Get AudioParam for mixer channel parameter
   */
  getMixerAudioParam(channel, parameter) {
    if (!channel.parameters) return null;
    
    const paramMap = {
      'volume': 'gain',
      'gain': 'gain',
      'pan': 'pan',
      'lowGain': 'lowGain',
      'midGain': 'midGain',
      'highGain': 'highGain'
    };
    
    const paramName = paramMap[parameter] || parameter;
    return channel.parameters.get(paramName);
  }

  /**
   * Get current parameter value
   * @param {string} targetId - Target identifier
   * @param {string} parameter - Parameter name
   */
  getParameterValue(targetId, parameter) {
    const [type, id] = targetId.split('-', 2);
    
    try {
      switch (type) {
        case 'mixer':
        case 'track':
          const channel = this.engine.mixerChannels?.get(id);
          const audioParam = this.getMixerAudioParam(channel, parameter);
          return audioParam ? audioParam.value : null;
          
        case 'instrument':
        case 'inst':
          const instrument = this.engine.instruments?.get(id);
          const instParam = instrument?.parameters?.get(parameter);
          return instParam ? instParam.value : null;
          
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error getting parameter value: ${targetId}.${parameter}`, error);
      return null;
    }
  }

  /**
   * Subscribe to parameter changes for UI updates
   * @param {string} targetId - Target to monitor
   * @param {function} callback - Callback for updates
   */
  subscribeToParameters(targetId, callback) {
    if (!this.parameterSubscriptions.has(targetId)) {
      this.parameterSubscriptions.set(targetId, new Set());
    }
    
    this.parameterSubscriptions.get(targetId).add(callback);
    
    // Send current values immediately
    this.sendCurrentParameterValues(targetId, callback);
  }

  /**
   * Unsubscribe from parameter changes
   */
  unsubscribeFromParameters(targetId, callback) {
    const subscribers = this.parameterSubscriptions.get(targetId);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this.parameterSubscriptions.delete(targetId);
      }
    }
  }

  /**
   * Send current parameter values to subscriber
   */
  sendCurrentParameterValues(targetId, callback) {
    // Implementation depends on target type
    // For now, just call callback with empty object
    callback(targetId, {});
  }

  // =================== PERFORMANCE MONITORING ===================

  /**
   * Get performance stats for parameter system
   */
  getPerformanceStats() {
    return {
      queueSize: this.parameterQueue.size,
      activeRecordings: this.automationRecorders.size,
      subscribers: this.parameterSubscriptions.size,
      batchInterval: this.batchInterval,
      maxBatchSize: this.maxBatchSize
    };
  }

  /**
   * Adjust performance settings
   */
  setPerformanceSettings(settings) {
    if (settings.batchInterval) {
      this.batchInterval = Math.max(8, settings.batchInterval); // Min 8ms (120fps)
    }
    
    if (settings.maxBatchSize) {
      this.maxBatchSize = Math.max(10, settings.maxBatchSize);
    }
    
    if (settings.smoothingTime) {
      this.smoothingTime = Math.max(0.001, settings.smoothingTime);
    }
    
    console.log('Parameter sync performance updated:', settings);
  }

  // =================== CLEANUP ===================

  /**
   * Dispose parameter sync system
   */
  dispose() {
    this.stopParameterProcessor();
    
    // Clear all queues and subscriptions
    this.parameterQueue.clear();
    this.automationRecorders.clear();
    this.parameterSubscriptions.clear();
    
    console.log('Real-time Parameter Sync disposed');
  }
}

export default RealtimeParameterSync;