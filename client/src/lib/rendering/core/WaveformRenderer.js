/**
 * WAVEFORM RENDERER (Base Class)
 *
 * Production-grade waveform rendering with:
 * - Error handling & graceful degradation
 * - 3-Tier LOD system
 * - Performance monitoring integration
 * - Render queue integration
 */

import { createLogger, NAMESPACES } from '@/lib/utils/DebugLogger';

const log = createLogger(NAMESPACES.RENDER);

export class WaveformRenderer {
  constructor(options = {}) {
    // LOD thresholds (pixels)
    this.lodThresholds = {
      minimal: 50,    // Below this: solid color bar
      simple: 300,    // Below this: RMS downsampled
      full: Infinity  // Above 300: full detail min/max peaks
    };

    // Performance monitor (injected)
    this.performanceMonitor = options.performanceMonitor || null;

    // Render queue (injected)
    this.renderQueue = options.renderQueue || null;

    log.info('WaveformRenderer initialized', { lodThresholds: this.lodThresholds });
  }

  /**
   * Main render entry point with error handling
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {AudioBuffer} audioBuffer - Web Audio API buffer
   * @param {Object} clip - Clip data
   * @param {Object} dimensions - {x, y, width, height}
   * @param {Object} viewport - Viewport state
   * @returns {boolean} - Success/failure
   */
  render(ctx, audioBuffer, clip, dimensions, viewport) {
    const startTime = performance.now();

    try {
      // Validate inputs
      this.validateInputs(ctx, audioBuffer, clip, dimensions);

      // Calculate LOD level
      const lod = this.calculateLOD(dimensions.width);

      // Render based on LOD
      let success = false;
      switch (lod) {
        case 'minimal':
          success = this.renderMinimal(ctx, clip, dimensions);
          break;
        case 'simple':
          success = this.renderSimple(ctx, audioBuffer, clip, dimensions, viewport);
          break;
        case 'full':
          success = this.renderFull(ctx, audioBuffer, clip, dimensions, viewport);
          break;
        default:
          throw new Error(`Unknown LOD level: ${lod}`);
      }

      // Record performance
      const renderTime = performance.now() - startTime;
      if (this.performanceMonitor) {
        this.performanceMonitor.recordClipRender(clip.id, renderTime);
      }

      log.debug(`Rendered clip ${clip.id}`, {
        lod,
        renderTime: renderTime.toFixed(2) + 'ms',
        width: dimensions.width
      });

      return success;

    } catch (error) {
      // Graceful degradation: Show error placeholder
      log.error('Render failed, showing placeholder', error);
      return this.renderPlaceholder(ctx, clip, dimensions, {
        error: true,
        message: error.message
      });
    }
  }

  /**
   * Validate render inputs
   */
  validateInputs(ctx, audioBuffer, clip, dimensions) {
    if (!ctx) {
      throw new Error('Canvas context is required');
    }

    if (!clip || !clip.id) {
      throw new Error('Valid clip with id is required');
    }

    if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
      throw new Error('Valid dimensions are required');
    }

    // audioBuffer can be null for minimal LOD
  }

  /**
   * Calculate LOD level based on clip width
   */
  calculateLOD(clipWidth) {
    if (clipWidth < this.lodThresholds.minimal) {
      return 'minimal';
    }

    if (clipWidth < this.lodThresholds.simple) {
      return 'simple';
    }

    return 'full';
  }

  /**
   * Render minimal LOD (solid gradient bar, no waveform calculation)
   * Used for extreme zoom out (<50px width)
   */
  renderMinimal(ctx, clip, dimensions) {
    const { x, y, width, height } = dimensions;

    // Create gradient simulating waveform presence
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);

    // Center line for reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + height / 2);
    ctx.lineTo(x + width, y + height / 2);
    ctx.stroke();

    return true;
  }

  /**
   * Render simple LOD (RMS downsampled)
   * Used for medium zoom (50-300px width)
   * Implementation in Phase 1
   */
  renderSimple(ctx, audioBuffer, clip, dimensions, viewport) {
    // TODO: Phase 1 - Implement RMS-based rendering
    log.warn('Simple LOD not yet implemented, falling back to minimal');
    return this.renderMinimal(ctx, clip, dimensions);
  }

  /**
   * Render full LOD (min/max peaks)
   * Used for close zoom (>300px width)
   * Implementation in Phase 1
   */
  renderFull(ctx, audioBuffer, clip, dimensions, viewport) {
    // TODO: Phase 1 - Implement full peak rendering
    log.warn('Full LOD not yet implemented, falling back to minimal');
    return this.renderMinimal(ctx, clip, dimensions);
  }

  /**
   * Render placeholder (loading or error state)
   */
  renderPlaceholder(ctx, clip, dimensions, options = {}) {
    const { x, y, width, height } = dimensions;

    // Always succeed - show SOMETHING
    try {
      if (options.error) {
        // Error state - red warning
        ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
        ctx.fillRect(x, y, width, height);

        ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);

        // Error icon and message
        if (width > 80 && height > 30) {
          ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
          ctx.font = '12px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚠️ Render Error', x + width / 2, y + height / 2);

          if (options.message && height > 50) {
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = 'rgba(255, 100, 100, 0.7)';
            ctx.fillText(options.message, x + width / 2, y + height / 2 + 15);
          }
        }
      } else {
        // Loading state - subtle gray
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        // Loading text
        if (width > 60 && height > 20) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.font = '11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Loading...', x + width / 2, y + height / 2);
        }
      }

      return true;
    } catch (error) {
      // Even placeholder failed - just draw a red box
      log.error('Placeholder render failed', error);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fillRect(x, y, width, height);
      return false;
    }
  }

  /**
   * Dispose renderer
   */
  dispose() {
    this.performanceMonitor = null;
    this.renderQueue = null;
    log.info('WaveformRenderer disposed');
  }
}
