/**
 * TimelineRenderer - Advanced Timeline Rendering
 *
 * Renders:
 * - Time signature markers
 * - Tempo markers
 * - Section markers & bookmarks
 * - Multiple loop regions
 * - Enhanced ruler with musical notation
 *
 * Architecture:
 * - Performance optimized (LOD-based)
 * - Integrates with TimelineStore
 * - Uses TimelineCoordinateSystem
 */

import { globalStyleCache } from '../../../lib/rendering/StyleCache.js';

const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;
const MARKER_HEIGHT = 20;
const TEMPO_MARKER_SIZE = 12;
const TIME_SIG_MARKER_SIZE = 14;

// ═══════════════════════════════════════════════════════════
// TIMELINE RENDERER CLASS
// ═══════════════════════════════════════════════════════════

export class TimelineRenderer {
  constructor(timelineStore, coordinateSystem) {
    this.timelineStore = timelineStore;
    this.coordinateSystem = coordinateSystem;
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER METHODS
  // ═══════════════════════════════════════════════════════════

  /**
   * Render all timeline elements
   */
  render(ctx, engine) {
    const settings = this.timelineStore.getState().displaySettings;

    // Render in layers (back to front)
    if (settings.showLoopRegions) {
      this.renderLoopRegions(ctx, engine);
    }

    if (settings.showTimeSignature) {
      this.renderTimeSignatures(ctx, engine);
    }

    if (settings.showTempo) {
      this.renderTempoMarkers(ctx, engine);
    }

    if (settings.showMarkers) {
      this.renderMarkers(ctx, engine);
    }

    // Enhanced ruler rendering
    this.renderEnhancedRuler(ctx, engine);
  }

  // ═══════════════════════════════════════════════════════════
  // TIME SIGNATURE RENDERING
  // ═══════════════════════════════════════════════════════════

  /**
   * Render time signature markers
   */
  renderTimeSignatures(ctx, engine) {
    const { viewport, dimensions } = engine;
    const { startStep, endStep } = viewport.visibleSteps;
    const timeSignatures = this.timelineStore.getState().timeSignatures;

    ctx.save();
    ctx.translate(KEYBOARD_WIDTH, 0);
    ctx.translate(-viewport.scrollX, 0);

    for (const ts of timeSignatures) {
      if (ts.position > endStep) break;
      if (ts.position < startStep) continue;

      const x = this.coordinateSystem.stepToPixel(
        ts.position,
        viewport.zoomX,
        dimensions.stepWidth / viewport.zoomX
      );

      // Draw vertical line
      ctx.strokeStyle = globalStyleCache.get('--zenith-accent-warm') || '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();

      // Draw time signature text (e.g., "4/4")
      ctx.fillStyle = globalStyleCache.get('--zenith-text-primary') || '#ffffff';
      ctx.font = `bold ${TIME_SIG_MARKER_SIZE}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${ts.numerator}/${ts.denominator}`, x + 4, 2);
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════
  // TEMPO MARKER RENDERING
  // ═══════════════════════════════════════════════════════════

  /**
   * Render tempo markers
   */
  renderTempoMarkers(ctx, engine) {
    const { viewport, dimensions } = engine;
    const { startStep, endStep } = viewport.visibleSteps;
    const tempoMarkers = this.timelineStore.getState().tempoMarkers;

    ctx.save();
    ctx.translate(KEYBOARD_WIDTH, 0);
    ctx.translate(-viewport.scrollX, 0);

    for (const tempo of tempoMarkers) {
      if (tempo.position > endStep) break;
      if (tempo.position < startStep) continue;

      const x = this.coordinateSystem.stepToPixel(
        tempo.position,
        viewport.zoomX,
        dimensions.stepWidth / viewport.zoomX
      );

      // Draw tempo marker icon (metronome)
      ctx.fillStyle = globalStyleCache.get('--zenith-accent-cool') || '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - TEMPO_MARKER_SIZE);
      ctx.lineTo(x - 4, RULER_HEIGHT);
      ctx.lineTo(x + 4, RULER_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Draw circle at top
      ctx.beginPath();
      ctx.arc(x, RULER_HEIGHT - TEMPO_MARKER_SIZE, 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw BPM text
      ctx.fillStyle = globalStyleCache.get('--zenith-text-primary') || '#ffffff';
      ctx.font = `${TEMPO_MARKER_SIZE}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${Math.round(tempo.bpm)} BPM`, x + 6, RULER_HEIGHT - 2);
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════
  // MARKER RENDERING
  // ═══════════════════════════════════════════════════════════

  /**
   * Render section markers & bookmarks
   */
  renderMarkers(ctx, engine) {
    const { viewport, dimensions } = engine;
    const { startStep, endStep } = viewport.visibleSteps;
    const markers = this.timelineStore.getState().markers;

    ctx.save();
    ctx.translate(KEYBOARD_WIDTH, 0);
    ctx.translate(-viewport.scrollX, 0);

    for (const marker of markers) {
      if (marker.position > endStep) break;
      if (marker.position < startStep) continue;

      const x = this.coordinateSystem.stepToPixel(
        marker.position,
        viewport.zoomX,
        dimensions.stepWidth / viewport.zoomX
      );

      // Draw vertical line
      ctx.strokeStyle = marker.color || '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT);
      ctx.lineTo(x, viewport.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw marker flag
      this.renderMarkerFlag(ctx, x, 0, marker);
    }

    ctx.restore();
  }

  /**
   * Render marker flag icon
   */
  renderMarkerFlag(ctx, x, y, marker) {
    const flagHeight = MARKER_HEIGHT;
    const flagWidth = 24;

    // Draw flag
    ctx.fillStyle = marker.color || '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + flagHeight);
    ctx.lineTo(x + flagWidth, y + flagHeight / 2);
    ctx.closePath();
    ctx.fill();

    // Draw marker name (if there's space)
    if (marker.name) {
      ctx.fillStyle = globalStyleCache.get('--zenith-text-primary') || '#ffffff';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(marker.name, x + flagWidth + 4, y + 2);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LOOP REGION RENDERING
  // ═══════════════════════════════════════════════════════════

  /**
   * Render multiple loop regions
   */
  renderLoopRegions(ctx, engine) {
    const { viewport, dimensions } = engine;
    const loopRegions = this.timelineStore.getState().loopRegions;

    ctx.save();
    ctx.translate(KEYBOARD_WIDTH, 0);

    for (const loop of loopRegions) {
      // Calculate pixel positions
      const startX = this.coordinateSystem.stepToPixel(
        loop.start,
        viewport.zoomX,
        dimensions.stepWidth / viewport.zoomX
      ) - viewport.scrollX;

      const endX = this.coordinateSystem.stepToPixel(
        loop.end,
        viewport.zoomX,
        dimensions.stepWidth / viewport.zoomX
      ) - viewport.scrollX;

      const width = endX - startX;

      // Skip if not visible
      if (endX < 0 || startX > viewport.width - KEYBOARD_WIDTH) continue;

      // Draw on timeline ruler
      this.renderLoopRegionOnTimeline(ctx, startX, width, loop, viewport);

      // Draw on grid (full height overlay)
      this.renderLoopRegionOnGrid(ctx, startX, width, loop, viewport);
    }

    ctx.restore();
  }

  /**
   * Render loop region on timeline ruler
   */
  renderLoopRegionOnTimeline(ctx, x, width, loop, viewport) {
    // Background
    ctx.fillStyle = loop.isActive
      ? `${loop.color || '#10b981'}33` // Active: 20% opacity
      : `${loop.color || '#10b981'}1a`; // Inactive: 10% opacity
    ctx.fillRect(x, 0, width, RULER_HEIGHT);

    // Border
    ctx.strokeStyle = loop.color || '#10b981';
    ctx.lineWidth = loop.isActive ? 2 : 1;
    ctx.strokeRect(x, 0, width, RULER_HEIGHT);

    // Top line highlight (for active loop)
    if (loop.isActive) {
      ctx.strokeStyle = loop.color || '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + width, 0);
      ctx.stroke();
    }

    // Loop name
    if (loop.name && width > 40) {
      ctx.fillStyle = globalStyleCache.get('--zenith-text-primary') || '#ffffff';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(loop.name, x + width / 2, RULER_HEIGHT / 2);
    }

    // Resize handles
    this.renderLoopRegionHandles(ctx, x, width, loop);
  }

  /**
   * Render loop region on grid (full height)
   */
  renderLoopRegionOnGrid(ctx, x, width, loop, viewport) {
    ctx.save();
    ctx.translate(0, RULER_HEIGHT);

    // Subtle overlay on grid
    if (loop.isActive) {
      ctx.fillStyle = `${loop.color || '#10b981'}0d`; // 5% opacity
      ctx.fillRect(x, 0, width, viewport.height - RULER_HEIGHT);

      // Border lines
      ctx.strokeStyle = `${loop.color || '#10b981'}40`; // 25% opacity
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height - RULER_HEIGHT);
      ctx.moveTo(x + width, 0);
      ctx.lineTo(x + width, viewport.height - RULER_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  /**
   * Render loop region resize handles
   */
  renderLoopRegionHandles(ctx, x, width, loop) {
    if (!loop.isActive) return;

    const handleWidth = 6;
    const handleHeight = RULER_HEIGHT;

    ctx.fillStyle = loop.color || '#10b981';

    // Left handle
    ctx.fillRect(x, 0, handleWidth, handleHeight);

    // Right handle
    ctx.fillRect(x + width - handleWidth, 0, handleWidth, handleHeight);

    // Handle grip lines
    ctx.strokeStyle = globalStyleCache.get('--zenith-bg-primary') || '#181A20';
    ctx.lineWidth = 1;

    for (let i = 0; i < 3; i++) {
      const y = RULER_HEIGHT / 2 - 4 + i * 3;
      // Left handle
      ctx.beginPath();
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + handleWidth - 2, y);
      ctx.stroke();
      // Right handle
      ctx.beginPath();
      ctx.moveTo(x + width - handleWidth + 2, y);
      ctx.lineTo(x + width - 2, y);
      ctx.stroke();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ENHANCED RULER RENDERING
  // ═══════════════════════════════════════════════════════════

  /**
   * Render enhanced ruler with bar/beat numbers
   */
  renderEnhancedRuler(ctx, engine) {
    const { viewport, dimensions, lod } = engine;
    const { startStep, endStep } = viewport.visibleSteps;

    ctx.save();
    ctx.translate(KEYBOARD_WIDTH, 0);
    ctx.translate(-viewport.scrollX, 0);

    // Get bar lines
    const barLines = this.coordinateSystem.getBarLinePositions(startStep, endStep);

    // Draw bar numbers
    for (const barLine of barLines) {
      const x = this.coordinateSystem.stepToPixel(
        barLine.position,
        viewport.zoomX,
        dimensions.stepWidth / viewport.zoomX
      );

      const { bar } = this.coordinateSystem.stepToBarBeat(barLine.position);

      // Draw bar number
      ctx.fillStyle = globalStyleCache.get('--zenith-text-secondary') || '#9ca3af';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(bar + 1, x, RULER_HEIGHT - 14);

      // Draw time signature (if changed at this bar)
      const ts = this.timelineStore.getState().getTimeSignatureAt(barLine.position);
      if (barLine.position === 0 || lod < 2) {
        ctx.fillStyle = globalStyleCache.get('--zenith-text-tertiary') || '#6b7280';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(`${ts.numerator}/${ts.denominator}`, x, RULER_HEIGHT - 2);
      }
    }

    // Draw beat ticks (if zoomed in enough)
    if (lod < 2) {
      const beatLines = this.coordinateSystem.getBeatLinePositions(startStep, endStep);

      for (const beatLine of beatLines) {
        const x = this.coordinateSystem.stepToPixel(
          beatLine.position,
          viewport.zoomX,
          dimensions.stepWidth / viewport.zoomX
        );

        const { beat } = this.coordinateSystem.stepToBarBeat(beatLine.position);

        // Draw beat tick
        ctx.strokeStyle = globalStyleCache.get('--zenith-border-primary') || '#2a2d37';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, RULER_HEIGHT - 8);
        ctx.lineTo(x, RULER_HEIGHT);
        ctx.stroke();

        // Draw beat number (if zoomed in enough)
        if (lod === 0 && viewport.zoomX > 0.5) {
          ctx.fillStyle = globalStyleCache.get('--zenith-text-tertiary') || '#6b7280';
          ctx.font = '9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(beat + 1, x, RULER_HEIGHT - 2);
        }
      }
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════

  /**
   * Check if position is over marker
   */
  isOverMarker(x, y, viewport, dimensions) {
    if (y > RULER_HEIGHT) return null;

    const step = this.coordinateSystem.pixelToStep(
      x - KEYBOARD_WIDTH + viewport.scrollX,
      viewport.zoomX,
      dimensions.stepWidth / viewport.zoomX
    );

    return this.timelineStore.getState().getNearestMarker(step, 2);
  }

  /**
   * Check if position is over loop region handle
   */
  isOverLoopRegionHandle(x, y, viewport, dimensions) {
    if (y > RULER_HEIGHT) return null;

    const step = this.coordinateSystem.pixelToStep(
      x - KEYBOARD_WIDTH + viewport.scrollX,
      viewport.zoomX,
      dimensions.stepWidth / viewport.zoomX
    );

    const loopRegions = this.timelineStore.getState().loopRegions;
    const threshold = 0.5; // steps

    for (const loop of loopRegions) {
      if (!loop.isActive) continue;

      const distanceToStart = Math.abs(step - loop.start);
      const distanceToEnd = Math.abs(step - loop.end);

      if (distanceToStart < threshold) {
        return { loop, handle: 'start' };
      } else if (distanceToEnd < threshold) {
        return { loop, handle: 'end' };
      }
    }

    return null;
  }

  /**
   * Check if position is over loop region body
   */
  isOverLoopRegion(x, y, viewport, dimensions) {
    if (y > RULER_HEIGHT) return null;

    const step = this.coordinateSystem.pixelToStep(
      x - KEYBOARD_WIDTH + viewport.scrollX,
      viewport.zoomX,
      dimensions.stepWidth / viewport.zoomX
    );

    const loopRegions = this.timelineStore.getState().loopRegions;

    for (const loop of loopRegions) {
      if (step >= loop.start && step <= loop.end) {
        return loop;
      }
    }

    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════

export default TimelineRenderer;
