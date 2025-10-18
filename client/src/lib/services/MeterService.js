/**
 * METER SERVICE
 *
 * Centralized, high-performance metering system
 *
 * INNOVATION:
 * - Single requestAnimationFrame loop for ALL meters (not per-component)
 * - Batch processing: Read all analyzers once per frame
 * - Shared state: Subscribers get cached values (no redundant calculations)
 * - Lazy evaluation: Only process meters that have subscribers
 * - Memory pooling: Reuse TypedArrays to avoid GC pressure
 *
 * PERFORMANCE:
 * - 1 RAF loop vs N RAF loops (N = number of channels)
 * - O(1) analyzer reads per frame vs O(N)
 * - Zero React setState in loop (callbacks only when needed)
 */

import { AudioContextService } from './AudioContextService';

class MeterService {
  constructor() {
    this.subscribers = new Map(); // trackId -> Set of callback functions
    this.meterCache = new Map();  // trackId -> { peak, rms, timestamp }
    this.isRunning = false;
    this.rafId = null;
    this.lastUpdate = 0;

    // Performance settings
    this.UPDATE_INTERVAL = 16; // 60fps
    this.FALLOFF_RATE = 30;    // dB per second

    // Memory pooling: Reuse TypedArrays to avoid GC
    this.bufferPool = new Map(); // trackId -> Uint8Array (reused)
  }

  /**
   * Subscribe a component to meter updates
   * @param {string} trackId - Channel ID
   * @param {Function} callback - Called with { peak, rms } when values change
   * @returns {Function} Unsubscribe function
   */
  subscribe(trackId, callback) {
    if (!this.subscribers.has(trackId)) {
      this.subscribers.set(trackId, new Set());
    }

    this.subscribers.get(trackId).add(callback);

    // Start the loop if this is the first subscriber
    if (!this.isRunning) {
      this.start();
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(trackId);
      if (subs) {
        subs.delete(callback);

        // Clean up if no more subscribers for this track
        if (subs.size === 0) {
          this.subscribers.delete(trackId);
          this.meterCache.delete(trackId);
          this.bufferPool.delete(trackId);
        }

        // Stop the loop if no more subscribers
        if (this.subscribers.size === 0) {
          this.stop();
        }
      }
    };
  }

  /**
   * Start the centralized meter loop
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastUpdate = performance.now();
    this.rafId = requestAnimationFrame(this.update.bind(this));

    console.log('🎚️ MeterService started');
  }

  /**
   * Stop the meter loop
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    console.log('🎚️ MeterService stopped');
  }

  /**
   * Main update loop - processes ALL meters in a single pass
   */
  update(timestamp) {
    if (!this.isRunning) return;

    // Throttle to target FPS
    const elapsed = timestamp - this.lastUpdate;
    if (elapsed < this.UPDATE_INTERVAL) {
      this.rafId = requestAnimationFrame(this.update.bind(this));
      return;
    }

    const deltaTime = elapsed / 1000; // seconds
    this.lastUpdate = timestamp;

    // Get audio engine once (not in loop)
    const audioEngine = AudioContextService.getAudioEngine();
    if (!audioEngine || !audioEngine.mixerChannels) {
      this.rafId = requestAnimationFrame(this.update.bind(this));
      return;
    }

    // ✅ BATCH PROCESSING: Process all subscribed channels in one pass
    for (const [trackId, callbacks] of this.subscribers.entries()) {
      if (callbacks.size === 0) continue; // Skip if no active subscribers

      const channel = audioEngine.mixerChannels.get(trackId);
      if (!channel || !channel.analyzer) continue;

      // Get or create pooled buffer (avoid GC)
      let dataArray = this.bufferPool.get(trackId);
      if (!dataArray) {
        dataArray = new Uint8Array(channel.analyzer.frequencyBinCount);
        this.bufferPool.set(trackId, dataArray);
      }

      // Read analyzer data once
      channel.analyzer.getByteTimeDomainData(dataArray);

      // Calculate peak and RMS in one pass
      const { peak, rms } = this.calculateLevels(dataArray);

      // Get cached values for smooth falloff
      const cached = this.meterCache.get(trackId) || { peak: -60, rms: -60 };

      // Apply smooth falloff
      const smoothPeak = peak < cached.peak
        ? Math.max(peak, cached.peak - (this.FALLOFF_RATE * deltaTime))
        : peak;

      const smoothRms = rms < cached.rms
        ? Math.max(rms, cached.rms - (this.FALLOFF_RATE * deltaTime))
        : rms;

      // Update cache
      this.meterCache.set(trackId, {
        peak: smoothPeak,
        rms: smoothRms,
        timestamp
      });

      // Notify subscribers (only if values changed significantly)
      if (Math.abs(smoothPeak - cached.peak) > 0.1 || Math.abs(smoothRms - cached.rms) > 0.1) {
        for (const callback of callbacks) {
          callback({ peak: smoothPeak, rms: smoothRms });
        }
      }
    }

    // Schedule next frame
    this.rafId = requestAnimationFrame(this.update.bind(this));
  }

  /**
   * Calculate peak and RMS from analyzer data
   * @param {Uint8Array} dataArray - Time domain data (0-255)
   * @returns {{ peak: number, rms: number }} dB values
   */
  calculateLevels(dataArray) {
    let peak = 0;
    let sumSquares = 0;
    const length = dataArray.length;

    // Single pass: calculate both peak and RMS
    for (let i = 0; i < length; i++) {
      const normalized = (dataArray[i] - 128) / 128; // -1 to +1
      const abs = Math.abs(normalized);

      if (abs > peak) peak = abs;
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / length);

    // Convert to dB (with floor at -60dB)
    const peakDb = peak > 0.00001 ? 20 * Math.log10(peak) : -60;
    const rmsDb = rms > 0.00001 ? 20 * Math.log10(rms) : -60;

    return {
      peak: Math.max(-60, Math.min(12, peakDb)),
      rms: Math.max(-60, Math.min(12, rmsDb))
    };
  }

  /**
   * Get current meter value (synchronous, from cache)
   * @param {string} trackId
   * @returns {{ peak: number, rms: number }}
   */
  getCurrentValue(trackId) {
    return this.meterCache.get(trackId) || { peak: -60, rms: -60 };
  }

  /**
   * Clear all subscribers and stop (cleanup)
   */
  destroy() {
    this.stop();
    this.subscribers.clear();
    this.meterCache.clear();
    this.bufferPool.clear();
  }
}

// Singleton instance
export const meterService = new MeterService();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    meterService.destroy();
  });
}
