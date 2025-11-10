/**
 * 🎨 GRID RENDERER - ZENITH THEME
 *
 * Draws the background grid for the arrangement panel
 * - Bar lines, beat lines, subdivision lines
 * - Track lanes with alternating colors
 * - Smooth, performant rendering
 * - ✅ THEME-AWARE: Dynamically reads colors from CSS variables
 */

import { StyleCache } from '@/lib/rendering/StyleCache';

// ============================================================================
// ZENITH COLORS - Dynamic theme support
// ============================================================================

// Fallback colors (used if StyleCache is not available or CSS variables are missing)
const FALLBACK_COLORS = {
  background: '#0A0E1A',
  trackLaneDark: 'rgba(21, 25, 34, 0.4)',
  trackLaneLight: 'rgba(30, 36, 47, 0.2)',
  gridLine: 'rgba(255, 255, 255, 0.05)',
  gridLineBeat: 'rgba(255, 255, 255, 0.1)',
  gridLineBar: 'rgba(255, 255, 255, 0.2)',
  trackBorder: 'rgba(255, 255, 255, 0.1)'
};

/**
 * ✅ THEME-AWARE: Get Zenith colors from CSS variables
 * @param {StyleCache} styleCache - StyleCache instance for reading CSS variables
 * @returns {Object} Zenith color object
 */
export function getZenithColors(styleCache) {
  if (!styleCache) {
    console.warn('⚠️ GridRenderer: StyleCache not available, using fallback colors');
    return FALLBACK_COLORS;
  }

  try {
    // Read CSS variables from theme
    const bgPrimary = styleCache.get('--zenith-bg-primary') || FALLBACK_COLORS.background;
    const borderSubtle = styleCache.get('--zenith-border-subtle') || FALLBACK_COLORS.gridLine;
    const borderMedium = styleCache.get('--zenith-border-medium') || FALLBACK_COLORS.gridLineBeat;
    const borderStrong = styleCache.get('--zenith-border-strong') || FALLBACK_COLORS.gridLineBar;

    // Parse background color to create track overlays
    // Convert hex to RGB for overlay calculation
    const parseHex = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    // Calculate track lane colors based on background
    let trackLaneDark = FALLBACK_COLORS.trackLaneDark;
    let trackLaneLight = FALLBACK_COLORS.trackLaneLight;

    if (bgPrimary.startsWith('#')) {
      const rgb = parseHex(bgPrimary);
      if (rgb) {
        // Dark overlay: slightly darker than background
        trackLaneDark = `rgba(${Math.max(0, rgb.r - 5)}, ${Math.max(0, rgb.g - 5)}, ${Math.max(0, rgb.b - 5)}, 0.4)`;
        // Light overlay: slightly lighter than background
        trackLaneLight = `rgba(${Math.min(255, rgb.r + 10)}, ${Math.min(255, rgb.g + 10)}, ${Math.min(255, rgb.b + 10)}, 0.2)`;
      }
    }

    return {
      background: bgPrimary,
      trackLaneDark,
      trackLaneLight,
      gridLine: borderSubtle,
      gridLineBeat: borderMedium,
      gridLineBar: borderStrong,
      trackBorder: borderMedium
    };
  } catch (error) {
    console.warn('⚠️ GridRenderer: Error reading theme colors, using fallbacks:', error);
    return FALLBACK_COLORS;
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PIXELS_PER_BEAT = 48; // Base pixels per beat at zoom = 1

// ============================================================================
// GRID RENDERER
// ============================================================================

/**
 * Draw the grid background
 * ✅ THEME-AWARE: Accepts StyleCache for dynamic theme color reading
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} viewport - Viewport state {offsetX, offsetY, zoomX, zoomY}
 * @param {Array} tracks - Array of track objects
 * @param {number} snapSize - Snap size in beats
 * @param {StyleCache} styleCache - StyleCache instance for theme colors (optional)
 */
export function drawGrid(ctx, width, height, viewport, tracks, snapSize = 0.25, styleCache = null) {
  const { offsetX, offsetY, zoomX, zoomY } = viewport;
  const pixelsPerBeat = PIXELS_PER_BEAT * zoomX;

  // ✅ THEME-AWARE: Get colors from CSS variables (dynamic theme support)
  const colors = getZenithColors(styleCache);

  // Clear canvas
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  // Draw track lanes
  drawTrackLanes(ctx, width, height, tracks, offsetY, zoomY, colors);

  // Draw vertical grid lines (time)
  drawVerticalGridLines(ctx, width, height, offsetX, pixelsPerBeat, snapSize, colors);

  // Draw horizontal track borders
  drawTrackBorders(ctx, width, tracks, offsetY, zoomY, colors);
}

/**
 * ✅ THEME-AWARE: Draw track lanes with alternating dark-light Zenith theme colors
 */
function drawTrackLanes(ctx, width, height, tracks, offsetY, zoomY, colors) {
  let y = -offsetY;

  tracks.forEach((track, index) => {
    const trackHeight = track.height * zoomY;

    // Skip if track is out of viewport
    if (y + trackHeight < 0) {
      y += trackHeight;
      return;
    }
    if (y > height) return;

    // ✅ THEME-AWARE: Use alternating dark-light backgrounds from theme
    // Even index = dark, odd index = light
    const isEven = index % 2 === 0;
    ctx.fillStyle = isEven ? colors.trackLaneDark : colors.trackLaneLight;
    ctx.fillRect(0, y, width, trackHeight);

    y += trackHeight;
  });
}

/**
 * ✅ THEME-AWARE: Draw vertical grid lines (bar/beat/subdivision)
 */
function drawVerticalGridLines(ctx, width, height, offsetX, pixelsPerBeat, snapSize, colors) {
  const beatsPerBar = 4; // 4/4 time signature
  const startBeat = Math.floor(offsetX / pixelsPerBeat);
  const endBeat = Math.ceil((offsetX + width) / pixelsPerBeat) + 1;

  for (let beat = startBeat; beat < endBeat; beat++) {
    const x = beat * pixelsPerBeat - offsetX;

    if (x < 0 || x > width) continue;

    // Determine line type
    const isBar = beat % beatsPerBar === 0;
    const isBeat = beat % 1 === 0;

    // Draw line
    if (isBar) {
      // Bar line (strongest)
      ctx.strokeStyle = colors.gridLineBar;
      ctx.lineWidth = 2;
    } else if (isBeat) {
      // Beat line (medium)
      ctx.strokeStyle = colors.gridLineBeat;
      ctx.lineWidth = 1;
    } else {
      // Subdivision line (subtle)
      ctx.strokeStyle = colors.gridLine;
      ctx.lineWidth = 1;
    }

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Draw subdivisions if zoomed in enough
    if (pixelsPerBeat > 60 && snapSize < 1) {
      drawSubdivisions(ctx, x, height, pixelsPerBeat, snapSize, colors);
    }
  }
}

/**
 * ✅ THEME-AWARE: Draw subdivision lines between beats
 */
function drawSubdivisions(ctx, beatX, height, pixelsPerBeat, snapSize, colors) {
  const subdivisions = Math.floor(1 / snapSize);

  for (let i = 1; i < subdivisions; i++) {
    const x = beatX + (i * snapSize * pixelsPerBeat);

    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.5;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}

/**
 * ✅ THEME-AWARE: Draw horizontal borders between tracks
 */
function drawTrackBorders(ctx, width, tracks, offsetY, zoomY, colors) {
  let y = -offsetY;

  tracks.forEach((track) => {
    const trackHeight = track.height * zoomY;
    y += trackHeight;

    if (y >= 0 && y <= ctx.canvas.height) {
      ctx.strokeStyle = colors.trackBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  });
}

/**
 * Convert beats to pixels
 */
export function beatsToPixels(beats, zoomX) {
  return beats * PIXELS_PER_BEAT * zoomX;
}

/**
 * Convert pixels to beats
 */
export function pixelsToBeats(pixels, zoomX) {
  return pixels / (PIXELS_PER_BEAT * zoomX);
}

/**
 * Snap value to grid
 */
export function snapToGrid(value, snapSize, enabled = true) {
  if (!enabled) return value;
  return Math.round(value / snapSize) * snapSize;
}
