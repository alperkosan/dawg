/**
 * TypeScript definitions for Audio Plugin Hooks
 *
 * Provides type safety for useAudioPlugin, useGhostValue, and useCanvasVisualization
 *
 * @version 2.0.0
 * @date 2025-10-09
 */

import type { RefObject } from 'react';
import type {
  BaseAudioPlugin,
  BaseAudioPluginOptions,
  AudioMetrics,
  AudioMetricsDb
} from '../lib/audio/BaseAudioPlugin';

/**
 * Return type for useAudioPlugin hook
 */
export interface UseAudioPluginReturn {
  /**
   * BaseAudioPlugin instance
   * Null if not initialized yet
   */
  plugin: BaseAudioPlugin | null;

  /**
   * Whether audio is currently playing
   * From playback store
   */
  isPlaying: boolean;

  /**
   * Current audio metrics (linear)
   */
  metrics: AudioMetrics;

  /**
   * Current audio metrics (dB FS)
   */
  metricsDb: AudioMetricsDb;

  /**
   * Get time-domain audio data for waveform visualization
   *
   * @returns Float32Array of samples or null
   */
  getTimeDomainData: () => Float32Array | null;

  /**
   * Get frequency-domain audio data for spectrum visualization
   *
   * @returns Float32Array of magnitudes or null
   */
  getFrequencyData: () => Float32Array | null;

  /**
   * Get the AnalyserNode instance
   *
   * @returns AnalyserNode or null
   */
  getAnalyser: () => AnalyserNode | null;

  /**
   * Reconnect to audio node
   * Useful when audio context state changes
   */
  reconnect: () => void;
}

/**
 * Hook for audio plugin connection and analysis
 *
 * Automatically handles:
 * - Audio node connection
 * - Analyser setup
 * - Metrics calculation
 * - Playback state tracking
 * - Cleanup on unmount
 *
 * @param trackId - ID of the track
 * @param effectId - ID of the effect
 * @param options - BaseAudioPlugin options
 * @returns Audio plugin utilities
 *
 * @example
 * ```typescript
 * const MyPlugin = ({ trackId, effect }) => {
 *   const { isPlaying, getTimeDomainData, metricsDb } = useAudioPlugin(
 *     trackId,
 *     effect.id,
 *     {
 *       fftSize: 2048,
 *       updateMetrics: true,
 *       rmsSmoothing: 0.8
 *     }
 *   );
 *
 *   // Use in render
 *   if (isPlaying) {
 *     const audioData = getTimeDomainData();
 *     // ... visualize
 *   }
 *
 *   return (
 *     <div>
 *       RMS: {metricsDb.rmsDb.toFixed(1)} dB
 *     </div>
 *   );
 * };
 * ```
 */
export declare function useAudioPlugin(
  trackId: string,
  effectId: string,
  options?: BaseAudioPluginOptions
): UseAudioPluginReturn;

/**
 * Hook for ghost value tracking
 *
 * Creates a delayed copy of a value that follows the actual value after a delay.
 * Useful for parameter change feedback and visualization.
 *
 * @param value - The value to track
 * @param delay - Delay in milliseconds before ghost catches up
 * @returns Ghost value that follows the input with delay
 *
 * @example
 * ```typescript
 * const MyKnob = ({ value, onChange }) => {
 *   const ghostValue = useGhostValue(value, 400);
 *
 *   return (
 *     <div>
 *       <input
 *         type="range"
 *         value={value}
 *         onChange={(e) => onChange(parseFloat(e.target.value))}
 *       />
 *       {/* Show ghost indicator */}
 *       <div
 *         style={{
 *           left: `${ghostValue * 100}%`,
 *           opacity: Math.abs(ghostValue - value) > 0.01 ? 0.3 : 0
 *         }}
 *       />
 *     </div>
 *   );
 * };
 * ```
 */
export declare function useGhostValue(value: number, delay?: number): number;

/**
 * Options for useCanvasVisualization hook
 */
export interface UseCanvasVisualizationOptions {
  /**
   * Disable automatic animation loop
   * Set to true if you want to manually control when to redraw
   * @default false
   */
  noLoop?: boolean;

  /**
   * Device pixel ratio override
   * Leave undefined to use window.devicePixelRatio
   */
  dpr?: number;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Draw callback function signature
 *
 * @param ctx - 2D rendering context
 * @param width - Canvas width in CSS pixels
 * @param height - Canvas height in CSS pixels
 */
export type DrawCallback = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => void;

/**
 * Return type for useCanvasVisualization hook
 */
export interface UseCanvasVisualizationReturn {
  /**
   * Ref to attach to container div
   * Container determines canvas size
   */
  containerRef: RefObject<HTMLDivElement>;

  /**
   * Ref to attach to canvas element
   * Canvas will fill container and handle DPI
   */
  canvasRef: RefObject<HTMLCanvasElement>;

  /**
   * Manually trigger redraw
   * Only available if noLoop is true
   */
  redraw?: () => void;
}

/**
 * Hook for canvas-based visualization with automatic sizing and DPI handling
 *
 * Automatically handles:
 * - Canvas sizing (matches container)
 * - Device pixel ratio (retina displays)
 * - ResizeObserver (responsive)
 * - Animation loop (requestAnimationFrame)
 * - Cleanup on unmount
 *
 * @param drawCallback - Function called to draw on canvas
 * @param dependencies - Dependencies that trigger redraw
 * @param options - Configuration options
 * @returns Refs for container and canvas elements
 *
 * @example
 * ```typescript
 * const Visualizer = ({ audioData, color }) => {
 *   const drawWaveform = useCallback((ctx, width, height) => {
 *     // Clear
 *     ctx.fillStyle = 'black';
 *     ctx.fillRect(0, 0, width, height);
 *
 *     // Draw waveform
 *     ctx.strokeStyle = color;
 *     ctx.beginPath();
 *     for (let i = 0; i < audioData.length; i++) {
 *       const x = (i / audioData.length) * width;
 *       const y = ((audioData[i] + 1) / 2) * height;
 *       if (i === 0) ctx.moveTo(x, y);
 *       else ctx.lineTo(x, y);
 *     }
 *     ctx.stroke();
 *   }, [audioData, color]);
 *
 *   const { containerRef, canvasRef } = useCanvasVisualization(
 *     drawWaveform,
 *     [audioData, color]
 *   );
 *
 *   return (
 *     <div ref={containerRef} style={{ width: '100%', height: 200 }}>
 *       <canvas ref={canvasRef} />
 *     </div>
 *   );
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Manual redraw mode (for non-animated visualizations)
 * const StaticVisualizer = ({ data }) => {
 *   const draw = useCallback((ctx, width, height) => {
 *     // ... draw static content
 *   }, [data]);
 *
 *   const { containerRef, canvasRef, redraw } = useCanvasVisualization(
 *     draw,
 *     [data],
 *     { noLoop: true }
 *   );
 *
 *   // Manually trigger redraw when needed
 *   useEffect(() => {
 *     redraw?.();
 *   }, [data, redraw]);
 *
 *   return (
 *     <div ref={containerRef}>
 *       <canvas ref={canvasRef} />
 *     </div>
 *   );
 * };
 * ```
 */
export declare function useCanvasVisualization(
  drawCallback: DrawCallback,
  dependencies?: React.DependencyList,
  options?: UseCanvasVisualizationOptions
): UseCanvasVisualizationReturn;
