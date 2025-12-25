/**
 * BaseAudioPlugin - Unified Plugin Architecture
 *
 * Provides standardized functionality for all audio plugins:
 * - Audio node connection
 * - Analyser setup
 * - Metrics tracking
 * - Performance monitoring
 * - Error handling
 *
 * @version 1.0.0
 * @date 2025-10-09
 */

import { EffectService } from '@/lib/services/EffectService';
import { AudioContextService } from '@/lib/services/AudioContextService';

export class BaseAudioPlugin {
  constructor(trackId, effectId, options = {}) {
    this.trackId = trackId;
    this.effectId = effectId;
    this.options = {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      metricsUpdateInterval: 33, // ~30fps
      ...options
    };

    // Core references
    this.audioNode = null;
    this.analyser = null;
    this.dataArray = null;

    // Metrics state
    this.metrics = {
      rms: 0,
      peak: 0,
      peakHold: 0,
      peakHoldTime: 0,
      clipping: false
    };

    // Performance tracking
    this.performance = {
      lastUpdate: 0,
      frameCount: 0,
      avgFrameTime: 0
    };

    // Lifecycle
    this.isInitialized = false;
    this.isDestroyed = false;

    // Initialize
    this.initialize();
  }

  /**
   * Initialize audio connection and analyser
   */
  initialize() {
    if (this.isInitialized || this.isDestroyed) return;

    try {
      // Connect to audio node
      this.audioNode = this.connectAudioNode();

      if (!this.audioNode) {
        console.warn(`⚠️ BaseAudioPlugin: No audio node found for ${this.effectId}`);
        return;
      }

      // Create analyser
      this.analyser = this.createAnalyser();

      if (this.analyser) {
        this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
        this.isInitialized = true;
        console.log(`✅ BaseAudioPlugin: ${this.effectId} initialized`);
      }
    } catch (error) {
      console.error(`❌ BaseAudioPlugin: Initialization failed for ${this.effectId}`, error);
    }
  }

  /**
   * Connect to effect's audio node
   * @returns {AudioNode|null}
   */
  connectAudioNode() {
    if (!this.trackId || !this.effectId) {
      console.warn('⚠️ Missing trackId or effectId');
      return null;
    }

    try {
      const effectNode = EffectService.getEffectNode(this.trackId, this.effectId);

      if (!effectNode) {
        console.warn(`⚠️ No effect node found for track:${this.trackId}, effect:${this.effectId}`);
        return null;
      }

      // Handle WorkletEffect wrapper
      const workletNode = effectNode.workletNode || effectNode;

      return {
        workletNode,
        context: effectNode.context || AudioContextService.getAudioContext()
      };
    } catch (error) {
      console.error('❌ Failed to connect audio node:', error);
      return null;
    }
  }

  /**
   * Create and connect analyser node
   * @returns {AnalyserNode|null}
   */
  createAnalyser() {
    if (!this.audioNode || !this.audioNode.context) {
      console.warn('⚠️ No audio context available');
      return null;
    }

    try {
      const analyser = this.audioNode.context.createAnalyser();
      analyser.fftSize = this.options.fftSize;
      analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;

      // Connect: workletNode -> analyser
      this.audioNode.workletNode.connect(analyser);

      console.log(`🎤 Analyser connected:`, {
        fftSize: analyser.fftSize,
        bufferLength: analyser.frequencyBinCount,
        effectId: this.effectId
      });

      return analyser;
    } catch (error) {
      console.error('❌ Failed to create analyser:', error);
      return null;
    }
  }

  /**
   * Get current audio data (time domain)
   * @returns {Float32Array|null}
   */
  getTimeDomainData() {
    if (!this.analyser || !this.dataArray) return null;

    this.analyser.getFloatTimeDomainData(this.dataArray);
    return this.dataArray;
  }

  /**
   * Get current audio data (frequency domain)
   * @returns {Float32Array|null}
   */
  getFrequencyData() {
    if (!this.analyser || !this.dataArray) return null;

    this.analyser.getFloatFrequencyData(this.dataArray);
    return this.dataArray;
  }

  /**
   * Calculate and return current metrics
   * @param {Object} options - Calculation options
   * @returns {Object} Metrics object
   */
  calculateMetrics(options = {}) {
    const now = performance.now();

    // Throttle updates
    if (now - this.performance.lastUpdate < this.options.metricsUpdateInterval) {
      return this.metrics;
    }

    const data = this.getTimeDomainData();
    if (!data) return this.metrics;

    // Calculate RMS
    let sumSquares = 0;
    let peakValue = 0;

    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      sumSquares += data[i] * data[i];
      if (abs > peakValue) peakValue = abs;
    }

    const rms = Math.sqrt(sumSquares / data.length);

    // Smooth RMS
    const rmsSmoothing = options.rmsSmoothing || 0.3;
    this.metrics.rms = this.metrics.rms * (1 - rmsSmoothing) + rms * rmsSmoothing;

    // Smooth peak
    const peakSmoothing = options.peakSmoothing || 0.2;
    this.metrics.peak = this.metrics.peak * (1 - peakSmoothing) + peakValue * peakSmoothing;

    // Peak hold (decays after 1 second)
    if (peakValue > this.metrics.peakHold) {
      this.metrics.peakHold = peakValue;
      this.metrics.peakHoldTime = now;
    } else if (now - this.metrics.peakHoldTime > 1000) {
      this.metrics.peakHold *= 0.997; // Slow decay
    }

    // Clipping detection
    this.metrics.clipping = peakValue > 0.99;

    // Performance tracking
    this.performance.lastUpdate = now;
    this.performance.frameCount++;

    return this.metrics;
  }

  /**
   * Convert linear amplitude to dB FS
   * @param {number} amplitude - Linear amplitude (0-1)
   * @returns {number} dB FS value
   */
  amplitudeToDb(amplitude) {
    if (amplitude <= 0) return -Infinity;
    return 20 * Math.log10(amplitude);
  }

  /**
   * Get metrics in dB format
   * @returns {Object} Metrics in dB
   */
  getMetricsDb() {
    return {
      rmsDb: this.amplitudeToDb(this.metrics.rms),
      peakDb: this.amplitudeToDb(this.metrics.peak),
      peakHoldDb: this.amplitudeToDb(this.metrics.peakHold),
      clipping: this.metrics.clipping
    };
  }

  /**
   * Get performance stats
   * @returns {Object} Performance metrics
   */
  getPerformance() {
    return {
      isInitialized: this.isInitialized,
      frameCount: this.performance.frameCount,
      lastUpdate: this.performance.lastUpdate,
      updateRate: this.performance.frameCount > 0
        ? (this.performance.lastUpdate / this.performance.frameCount)
        : 0
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.isDestroyed) return;

    try {
      if (this.analyser) {
        this.analyser.disconnect();
        this.analyser = null;
      }

      this.audioNode = null;
      this.dataArray = null;
      this.isDestroyed = true;
      this.isInitialized = false;

      console.log(`🔌 BaseAudioPlugin: ${this.effectId} destroyed`);
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }

  /**
   * Reconnect audio node (useful after audio context changes)
   */
  reconnect() {
    this.destroy();
    this.isDestroyed = false;
    this.initialize();
  }
}
