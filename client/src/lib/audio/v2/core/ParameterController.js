/**
 * ParameterController.js
 *
 * Parameter update batching ve scheduling sistemi.
 * Performance optimizasyonu için kritik komponent.
 *
 * Özellikler:
 * - Batch parameter updates (16ms window)
 * - Dirty flagging (sadece değişen parametreler)
 * - Parameter scheduling (ramp, exponential)
 * - Automation recording
 */

import { ParameterRegistry } from './ParameterRegistry.js';
import { ParameterValidator } from './ParameterSchema.js';

/**
 * Parameter update batch window (ms)
 */
const BATCH_WINDOW = 16; // ~60fps

/**
 * Ramp types for parameter changes
 */
export const RampType = {
  NONE: 'none',           // Immediate value change
  LINEAR: 'linear',       // Linear ramp
  EXPONENTIAL: 'exponential', // Exponential ramp
};

/**
 * ParameterController - Manages parameter updates with batching
 */
export class ParameterController {
  constructor(audioContext, instrument) {
    this.audioContext = audioContext;
    this.instrument = instrument;

    // Pending updates (batched)
    this.pendingUpdates = new Map();

    // Batch timer
    this.batchTimer = null;

    // Dirty flags
    this.dirtyParameters = new Set();

    // Automation recording
    this.isRecording = false;
    this.automationData = [];

    // Performance metrics
    this.metrics = {
      totalUpdates: 0,
      batchedUpdates: 0,
      averageBatchSize: 0,
    };

    // Callbacks
    this.onParameterChange = null;
    this.onBatchFlush = null;
  }

  /**
   * Set a single parameter value
   */
  setParameter(parameterId, value, options = {}) {
    const {
      ramp = RampType.NONE,
      duration = 0,
      record = false,
      immediate = false,
    } = options;

    // Validate parameter
    const paramDef = ParameterRegistry.get(parameterId);
    if (!paramDef) {
      console.warn(`[ParameterController] Unknown parameter: ${parameterId}`);
      return false;
    }

    // Validate value
    const validatedValue = paramDef.clamp(value);

    // Create update object
    const update = {
      parameterId,
      value: validatedValue,
      ramp,
      duration,
      record,
      timestamp: this.audioContext.currentTime,
    };

    // Validate update
    const validation = ParameterValidator.validateParameterUpdate(update);
    if (!validation.success) {
      console.error('[ParameterController] Invalid parameter update:', validation.errors);
      return false;
    }

    // Mark as dirty
    this.dirtyParameters.add(parameterId);

    // Add to pending updates
    this.pendingUpdates.set(parameterId, update);

    // Metrics
    this.metrics.totalUpdates++;

    // Immediate mode: flush immediately
    if (immediate) {
      this.flush();
      return true;
    }

    // Schedule batch flush
    this._scheduleBatchFlush();

    // Trigger callback
    if (this.onParameterChange) {
      this.onParameterChange(parameterId, validatedValue);
    }

    // Record automation
    if (record && this.isRecording) {
      this.automationData.push({
        parameterId,
        value: validatedValue,
        timestamp: this.audioContext.currentTime,
      });
    }

    return true;
  }

  /**
   * Set multiple parameters at once
   */
  setParameters(updates, options = {}) {
    const { immediate = false } = options;

    for (const [parameterId, value] of Object.entries(updates)) {
      this.setParameter(parameterId, value, { ...options, immediate: false });
    }

    if (immediate) {
      this.flush();
    }
  }

  /**
   * Start batch mode (manual batching)
   */
  startBatch() {
    this._clearBatchTimer();
  }

  /**
   * Flush pending updates to audio engine
   */
  flush() {
    if (this.pendingUpdates.size === 0) {
      return;
    }

    // Clear batch timer
    this._clearBatchTimer();

    // Convert pending updates to array
    const updates = Array.from(this.pendingUpdates.values());

    // Apply updates to instrument
    this._applyUpdatesToInstrument(updates);

    // Metrics
    this.metrics.batchedUpdates++;
    this.metrics.averageBatchSize =
      (this.metrics.averageBatchSize * (this.metrics.batchedUpdates - 1) + updates.length) /
      this.metrics.batchedUpdates;

    // Clear pending updates
    this.pendingUpdates.clear();
    this.dirtyParameters.clear();

    // Trigger callback
    if (this.onBatchFlush) {
      this.onBatchFlush(updates);
    }
  }

  /**
   * Apply batched updates to instrument
   */
  _applyUpdatesToInstrument(updates) {
    const currentTime = this.audioContext.currentTime;

    for (const update of updates) {
      const { parameterId, value, ramp, duration } = update;

      // Get parameter definition
      const paramDef = ParameterRegistry.get(parameterId);
      if (!paramDef) continue;

      // Format value for audio engine
      const audioValue = paramDef.formatAudio(value);

      // Apply to instrument based on parameter type
      this._applyParameterToInstrument(parameterId, audioValue, ramp, duration, currentTime);
    }
  }

  /**
   * Apply single parameter to instrument
   */
  _applyParameterToInstrument(parameterId, value, ramp, duration, currentTime) {
    // This will be overridden by specific instrument implementations
    // For now, we'll provide a generic implementation

    if (!this.instrument || !this.instrument.updateParameter) {
      console.warn('[ParameterController] Instrument does not support updateParameter');
      return;
    }

    // Call instrument's update method
    this.instrument.updateParameter(parameterId, value, {
      ramp,
      duration,
      time: currentTime,
    });
  }

  /**
   * Schedule batch flush
   */
  _scheduleBatchFlush() {
    if (this.batchTimer !== null) {
      return; // Already scheduled
    }

    this.batchTimer = setTimeout(() => {
      this.flush();
    }, BATCH_WINDOW);
  }

  /**
   * Clear batch timer
   */
  _clearBatchTimer() {
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Get dirty parameters
   */
  getDirtyParameters() {
    return Array.from(this.dirtyParameters);
  }

  /**
   * Clear dirty flags
   */
  clearDirtyFlags() {
    this.dirtyParameters.clear();
  }

  /**
   * Check if parameter is dirty
   */
  isDirty(parameterId) {
    return this.dirtyParameters.has(parameterId);
  }

  /**
   * Start automation recording
   */
  startRecording() {
    this.isRecording = true;
    this.automationData = [];
  }

  /**
   * Stop automation recording
   */
  stopRecording() {
    this.isRecording = false;
    return this.automationData;
  }

  /**
   * Get automation data
   */
  getAutomationData() {
    return this.automationData;
  }

  /**
   * Clear automation data
   */
  clearAutomationData() {
    this.automationData = [];
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      pendingUpdates: this.pendingUpdates.size,
      dirtyParameters: this.dirtyParameters.size,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalUpdates: 0,
      batchedUpdates: 0,
      averageBatchSize: 0,
    };
  }

  /**
   * Dispose controller
   */
  dispose() {
    this._clearBatchTimer();
    this.pendingUpdates.clear();
    this.dirtyParameters.clear();
    this.automationData = [];
    this.onParameterChange = null;
    this.onBatchFlush = null;
  }
}

/**
 * ParameterScheduler - Advanced parameter scheduling
 */
export class ParameterScheduler {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.scheduledEvents = [];
  }

  /**
   * Schedule parameter change at specific time
   */
  scheduleParameterChange(audioParam, value, time, rampType = RampType.NONE, duration = 0) {
    if (!audioParam) return;

    const scheduleTime = time || this.audioContext.currentTime;

    // Cancel any pending automation
    audioParam.cancelScheduledValues(scheduleTime);

    switch (rampType) {
      case RampType.LINEAR:
        audioParam.linearRampToValueAtTime(value, scheduleTime + duration);
        break;

      case RampType.EXPONENTIAL:
        // Ensure value is not 0 or negative for exponential ramp
        const safeValue = Math.max(0.0001, value);
        audioParam.exponentialRampToValueAtTime(safeValue, scheduleTime + duration);
        break;

      case RampType.NONE:
      default:
        audioParam.setValueAtTime(value, scheduleTime);
        break;
    }

    // Track scheduled event
    this.scheduledEvents.push({
      audioParam,
      value,
      time: scheduleTime,
      rampType,
      duration,
    });
  }

  /**
   * Cancel all scheduled changes for a parameter
   */
  cancelScheduledChanges(audioParam, fromTime = null) {
    const time = fromTime || this.audioContext.currentTime;
    audioParam.cancelScheduledValues(time);

    // Remove from tracking
    this.scheduledEvents = this.scheduledEvents.filter(
      (event) => event.audioParam !== audioParam || event.time < time
    );
  }

  /**
   * Clear all scheduled events
   */
  clearAllScheduled() {
    this.scheduledEvents = [];
  }

  /**
   * Get scheduled events
   */
  getScheduledEvents() {
    return this.scheduledEvents;
  }
}

/**
 * Helper: Apply AudioParam scheduling
 */
export function applyAudioParamScheduling(
  audioParam,
  value,
  audioContext,
  rampType = RampType.NONE,
  duration = 0
) {
  if (!audioParam) return;

  const currentTime = audioContext.currentTime;

  // Cancel pending automation
  audioParam.cancelScheduledValues(currentTime);

  switch (rampType) {
    case RampType.LINEAR:
      audioParam.setValueAtTime(audioParam.value, currentTime);
      audioParam.linearRampToValueAtTime(value, currentTime + duration);
      break;

    case RampType.EXPONENTIAL:
      audioParam.setValueAtTime(audioParam.value, currentTime);
      const safeValue = Math.max(0.0001, value);
      audioParam.exponentialRampToValueAtTime(safeValue, currentTime + duration);
      break;

    case RampType.NONE:
    default:
      audioParam.setValueAtTime(value, currentTime);
      break;
  }
}

export default ParameterController;
