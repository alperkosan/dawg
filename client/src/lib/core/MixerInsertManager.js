/**
 * MixerInsertManager - Global management for all MixerInserts
 * 
 * ✅ OPTIMIZATION: Batched auto-sleep monitoring
 * Instead of 28 separate timers (one per track), uses a single global timer
 * to check all inserts. This reduces timer overhead and context switches.
 * 
 * Estimated savings: ~1.3% CPU with 28 tracks
 */

export class MixerInsertManager {
  constructor() {
    this.audioEngine = null;
    this._monitorHandle = null;
    this._pollInterval = 250; // ms
    this._isRunning = false;
  }

  /**
   * Set the audio engine reference
   * @param {NativeAudioEngine} engine 
   */
  setAudioEngine(engine) {
    this.audioEngine = engine;
  }

  /**
   * Start the global auto-sleep monitor
   * Replaces individual per-insert monitors
   */
  startGlobalMonitor() {
    if (this._monitorHandle || this._isRunning) {
      return; // Already running
    }

    this._isRunning = true;
    this._monitorHandle = setInterval(() => {
      this._evaluateAllInserts();
    }, this._pollInterval);

    if (import.meta.env.DEV) {
      console.log('✅ MixerInsertManager: Global auto-sleep monitor started');
    }
  }

  /**
   * Stop the global auto-sleep monitor
   */
  stopGlobalMonitor() {
    if (this._monitorHandle) {
      clearInterval(this._monitorHandle);
      this._monitorHandle = null;
    }
    this._isRunning = false;

    if (import.meta.env.DEV) {
      console.log('🛑 MixerInsertManager: Global auto-sleep monitor stopped');
    }
  }

  /**
   * Evaluate auto-sleep for all inserts
   * @private
   */
  _evaluateAllInserts() {
    if (!this.audioEngine?.mixerInserts) {
      return;
    }

    const inserts = this.audioEngine.mixerInserts;
    
    for (const [insertId, insert] of inserts) {
      // Skip if auto-sleep not enabled or insert is disposed
      if (!insert.autoSleepConfig?.enabled) {
        continue;
      }

      // Skip master (never sleeps)
      if (insertId === 'master') {
        continue;
      }

      try {
        insert._evaluateAutoSleep();
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn(`⚠️ Auto-sleep error for ${insertId}:`, error);
        }
      }
    }
  }

  /**
   * Get statistics about the manager
   */
  getStats() {
    const insertCount = this.audioEngine?.mixerInserts?.size || 0;
    const sleepingCount = this._countSleepingInserts();
    
    return {
      isRunning: this._isRunning,
      pollInterval: this._pollInterval,
      totalInserts: insertCount,
      sleepingInserts: sleepingCount,
      activeInserts: insertCount - sleepingCount,
      timersSaved: insertCount - 1 // We use 1 timer instead of N
    };
  }

  /**
   * Count sleeping inserts
   * @private
   */
  _countSleepingInserts() {
    if (!this.audioEngine?.mixerInserts) return 0;
    
    let count = 0;
    for (const [, insert] of this.audioEngine.mixerInserts) {
      if (insert._autoSleepState?.isSleeping) {
        count++;
      }
    }
    return count;
  }

  /**
   * Update poll interval
   * @param {number} intervalMs - New interval in milliseconds
   */
  setPollInterval(intervalMs) {
    this._pollInterval = Math.max(100, intervalMs); // Minimum 100ms
    
    // Restart monitor if running
    if (this._isRunning) {
      this.stopGlobalMonitor();
      this.startGlobalMonitor();
    }
  }

  /**
   * Dispose the manager
   */
  dispose() {
    this.stopGlobalMonitor();
    this.audioEngine = null;
  }
}

// Singleton instance
export const mixerInsertManager = new MixerInsertManager();

