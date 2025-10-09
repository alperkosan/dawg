/**
 * TypeScript definitions for BaseAudioPlugin
 *
 * Provides type safety and IDE autocomplete for the standardized plugin system
 *
 * @version 2.0.0
 * @date 2025-10-09
 */

/**
 * Options for BaseAudioPlugin constructor
 */
export interface BaseAudioPluginOptions {
  /**
   * FFT size for frequency analysis
   * Must be power of 2 between 32 and 32768
   * @default 2048
   */
  fftSize?: number;

  /**
   * Enable automatic metrics calculation
   * Set to false if you don't need RMS/Peak/Clipping detection
   * @default true
   */
  updateMetrics?: boolean;

  /**
   * Smoothing factor for RMS calculation
   * Range: 0.0 (no smoothing) to 1.0 (maximum smoothing)
   * @default 0.8
   */
  rmsSmoothing?: number;

  /**
   * Smoothing factor for peak calculation
   * Range: 0.0 (no smoothing) to 1.0 (maximum smoothing)
   * @default 0.95
   */
  peakSmoothing?: number;

  /**
   * Peak hold time in milliseconds
   * How long to display peak values before decay
   * @default 1000
   */
  peakHoldTime?: number;

  /**
   * Clipping threshold in linear amplitude
   * Values above this are considered clipping
   * @default 0.99
   */
  clippingThreshold?: number;
}

/**
 * Audio metrics calculated by BaseAudioPlugin
 */
export interface AudioMetrics {
  /**
   * RMS (Root Mean Square) level in linear amplitude (0.0 to 1.0)
   */
  rms: number;

  /**
   * Peak level in linear amplitude (0.0 to 1.0)
   */
  peak: number;

  /**
   * Peak hold value that decays over time
   */
  peakHold: number;

  /**
   * Whether clipping is currently detected
   */
  clipping: boolean;
}

/**
 * Audio metrics in decibels (dB FS - Full Scale)
 */
export interface AudioMetricsDb {
  /**
   * RMS level in dB FS
   * Range: -Infinity to 0.0 dB
   */
  rmsDb: number;

  /**
   * Peak level in dB FS
   * Range: -Infinity to 0.0 dB
   */
  peakDb: number;

  /**
   * Peak hold in dB FS
   * Range: -Infinity to 0.0 dB
   */
  peakHoldDb: number;

  /**
   * Whether clipping is currently detected
   */
  clipping: boolean;
}

/**
 * Audio node connection result
 */
export interface AudioNodeConnection {
  /**
   * The AudioWorkletNode for this effect
   */
  workletNode: AudioWorkletNode;

  /**
   * The AudioContext instance
   */
  context: AudioContext;
}

/**
 * Options for metric calculation
 */
export interface MetricCalculationOptions {
  /**
   * Enable RMS calculation
   * @default true
   */
  calculateRms?: boolean;

  /**
   * Enable peak calculation
   * @default true
   */
  calculatePeak?: boolean;

  /**
   * Enable peak hold calculation
   * @default true
   */
  calculatePeakHold?: boolean;

  /**
   * Enable clipping detection
   * @default true
   */
  detectClipping?: boolean;
}

/**
 * BaseAudioPlugin - Core audio plugin infrastructure
 *
 * Provides standardized audio connection, analysis, and metrics tracking
 * for all DAWG plugins.
 *
 * @example
 * ```typescript
 * const plugin = new BaseAudioPlugin('track-1', 'effect-1', {
 *   fftSize: 2048,
 *   updateMetrics: true,
 *   rmsSmoothing: 0.8
 * });
 *
 * // Get audio data
 * const timeData = plugin.getTimeDomainData();
 * const freqData = plugin.getFrequencyData();
 *
 * // Get metrics
 * const metrics = plugin.getMetrics();
 * console.log('RMS:', metrics.rmsDb.toFixed(1), 'dB');
 *
 * // Cleanup
 * plugin.destroy();
 * ```
 */
export declare class BaseAudioPlugin {
  /**
   * Track ID this plugin belongs to
   */
  readonly trackId: string;

  /**
   * Effect ID of this plugin instance
   */
  readonly effectId: string;

  /**
   * Configuration options
   */
  readonly options: Required<BaseAudioPluginOptions>;

  /**
   * Audio node connection (workletNode + context)
   * Null if not connected
   */
  audioNode: AudioNodeConnection | null;

  /**
   * AnalyserNode for audio visualization
   * Null if not initialized
   */
  analyser: AnalyserNode | null;

  /**
   * Pre-allocated buffer for audio data
   * Size determined by fftSize
   */
  dataArray: Float32Array | null;

  /**
   * Current audio metrics
   */
  metrics: AudioMetrics;

  /**
   * Last peak hold timestamp
   */
  private lastPeakHoldTime: number;

  /**
   * Animation frame ID for metrics updates
   */
  private metricsAnimationFrame: number | null;

  /**
   * Create a new BaseAudioPlugin instance
   *
   * @param trackId - ID of the track this plugin belongs to
   * @param effectId - ID of this effect instance
   * @param options - Configuration options
   */
  constructor(trackId: string, effectId: string, options?: BaseAudioPluginOptions);

  /**
   * Connect to the audio node for this effect
   *
   * @returns Audio node connection with workletNode and context
   * @throws Error if audio node cannot be found
   */
  connectAudioNode(): AudioNodeConnection;

  /**
   * Setup audio analyser for visualization
   *
   * Creates an AnalyserNode and connects it to the audio graph.
   * The analyser taps the audio signal without affecting it.
   */
  setupAnalyser(): void;

  /**
   * Get time-domain audio data for waveform visualization
   *
   * @returns Float32Array containing time-domain samples, or null if not available
   *
   * @example
   * ```typescript
   * const data = plugin.getTimeDomainData();
   * if (data) {
   *   // Draw waveform
   *   for (let i = 0; i < data.length; i++) {
   *     const amplitude = data[i]; // -1.0 to 1.0
   *     // ... draw
   *   }
   * }
   * ```
   */
  getTimeDomainData(): Float32Array | null;

  /**
   * Get frequency-domain audio data for spectrum visualization
   *
   * @returns Float32Array containing frequency magnitudes, or null if not available
   *
   * @example
   * ```typescript
   * const data = plugin.getFrequencyData();
   * if (data) {
   *   // Draw spectrum
   *   for (let i = 0; i < data.length; i++) {
   *     const magnitude = data[i]; // -1.0 to 1.0 (normalized)
   *     // ... draw
   *   }
   * }
   * ```
   */
  getFrequencyData(): Float32Array | null;

  /**
   * Get the analyser node instance
   *
   * @returns AnalyserNode or null if not initialized
   */
  getAnalyser(): AnalyserNode | null;

  /**
   * Calculate audio metrics (RMS, Peak, Clipping)
   *
   * Should be called regularly (e.g., in animation frame) if updateMetrics is enabled.
   *
   * @param options - Which metrics to calculate
   * @returns Current audio metrics
   *
   * @example
   * ```typescript
   * const metrics = plugin.calculateMetrics({
   *   calculateRms: true,
   *   calculatePeak: true,
   *   detectClipping: true
   * });
   *
   * console.log('RMS:', metrics.rms);
   * console.log('Peak:', metrics.peak);
   * console.log('Clipping:', metrics.clipping);
   * ```
   */
  calculateMetrics(options?: MetricCalculationOptions): AudioMetrics;

  /**
   * Get current metrics
   *
   * @returns Current audio metrics
   */
  getMetrics(): AudioMetrics;

  /**
   * Get current metrics in decibels
   *
   * @returns Audio metrics in dB FS
   *
   * @example
   * ```typescript
   * const metricsDb = plugin.getMetricsDb();
   * console.log(`RMS: ${metricsDb.rmsDb.toFixed(1)} dB`);
   * console.log(`Peak: ${metricsDb.peakDb.toFixed(1)} dB`);
   * if (metricsDb.clipping) {
   *   console.warn('CLIPPING DETECTED!');
   * }
   * ```
   */
  getMetricsDb(): AudioMetricsDb;

  /**
   * Convert linear amplitude to decibels (dB FS)
   *
   * @param amplitude - Linear amplitude (0.0 to 1.0)
   * @returns Level in dB FS (-Infinity to 0.0)
   *
   * @example
   * ```typescript
   * const linearLevel = 0.5;
   * const dbLevel = plugin.amplitudeToDb(linearLevel);
   * console.log(`${linearLevel} = ${dbLevel.toFixed(1)} dB`);
   * // Output: "0.5 = -6.0 dB"
   * ```
   */
  amplitudeToDb(amplitude: number): number;

  /**
   * Reconnect to audio node
   *
   * Useful when audio context state changes or effect is reloaded
   */
  reconnect(): void;

  /**
   * Cleanup and destroy this plugin instance
   *
   * Cancels animation frames, disconnects audio nodes, and clears references.
   * Should be called when the plugin is unmounted.
   */
  destroy(): void;
}

/**
 * Create a new BaseAudioPlugin instance (factory function)
 *
 * @param trackId - ID of the track
 * @param effectId - ID of the effect
 * @param options - Configuration options
 * @returns New BaseAudioPlugin instance
 */
export declare function createAudioPlugin(
  trackId: string,
  effectId: string,
  options?: BaseAudioPluginOptions
): BaseAudioPlugin;
