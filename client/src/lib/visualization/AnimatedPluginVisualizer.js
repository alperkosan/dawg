/**
 * ANIMATED PLUGIN VISUALIZER
 *
 * Base class for animated visualizers that require continuous rendering.
 * Managed by VisualizationEngine's RAF loop with priority-based frame skipping.
 *
 * Features:
 * - Automatic animation timing
 * - Frame interpolation
 * - Time-based effects
 */

import { CanvasPluginVisualizer } from './CanvasPluginVisualizer';

export class AnimatedPluginVisualizer extends CanvasPluginVisualizer {
  constructor(config) {
    super(config);

    // Animation state
    this.time = 0;
    this.deltaTime = 0;
    this.lastTimestamp = 0;
    this.targetFPS = config.targetFPS || 60;
    this.frameInterval = 1000 / this.targetFPS;

    // Always needs render (animated)
    this.needsRender = true;
  }

  /**
   * Override render to handle animation timing
   */
  render(timestamp, params = {}) {
    if (!this.initialized || !this.canvas) return;

    // Calculate delta time
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }
    this.deltaTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Update animation time
    this.time += this.deltaTime;

    // Performance tracking
    const renderStart = performance.now();

    // Check if parameters changed
    const paramsChanged = this.detectParameterChange(params);
    this.lastParams = { ...params };

    // Resize canvas if needed
    this.handleCanvasResize();

    // Call animation render
    this.onRenderAnimated(this.ctx, timestamp, this.deltaTime, params);

    // Performance tracking
    const renderTime = performance.now() - renderStart;
    this.totalRenderTime += renderTime;
    this.lastRenderTime = renderTime;
    this.renderCount++;

    // Always needs render for animation
    this.needsRender = true;
  }

  /**
   * Override: Animated canvas rendering
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} timestamp - Current timestamp (ms)
   * @param {number} deltaTime - Time since last frame (ms)
   * @param {object} params - Plugin parameters
   */
  onRenderAnimated(ctx, timestamp, deltaTime, params) {
    // Override in child class
    console.warn(`[${this.id}] onRenderAnimated not implemented`);
  }

  /**
   * Get normalized time for periodic animations (0-1)
   * @param {number} period - Period in milliseconds
   * @param {number} offset - Phase offset (0-1)
   */
  getNormalizedTime(period = 1000, offset = 0) {
    return ((this.time / period) + offset) % 1;
  }

  /**
   * Get sine wave value
   * @param {number} frequency - Frequency in Hz
   * @param {number} phase - Phase offset in radians
   */
  getSineWave(frequency = 1, phase = 0) {
    return Math.sin(2 * Math.PI * frequency * (this.time / 1000) + phase);
  }

  /**
   * Get cosine wave value
   * @param {number} frequency - Frequency in Hz
   * @param {number} phase - Phase offset in radians
   */
  getCosineWave(frequency = 1, phase = 0) {
    return Math.cos(2 * Math.PI * frequency * (this.time / 1000) + phase);
  }

  /**
   * Get pulse value (0-1 sawtooth)
   * @param {number} period - Period in milliseconds
   */
  getPulse(period = 1000) {
    return (this.time % period) / period;
  }

  /**
   * Get triangle wave value (-1 to 1)
   * @param {number} period - Period in milliseconds
   */
  getTriangleWave(period = 1000) {
    const t = (this.time % period) / period;
    return t < 0.5 ? (4 * t - 1) : (3 - 4 * t);
  }

  /**
   * Smooth step interpolation (ease in/out)
   */
  smoothstep(edge0, edge1, x) {
    const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /**
   * Ease in quad
   */
  easeInQuad(t) {
    return t * t;
  }

  /**
   * Ease out quad
   */
  easeOutQuad(t) {
    return t * (2 - t);
  }

  /**
   * Ease in out quad
   */
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Reset animation state
   */
  resetAnimation() {
    this.time = 0;
    this.lastTimestamp = 0;
    this.deltaTime = 0;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.resetAnimation();
    super.destroy();
  }
}
