/**
 * 🎨 GRID RENDERER - ZENITH THEME
 *
 * Draws the background grid for the arrangement panel
 * - Bar lines, beat lines, subdivision lines
 * - Track lanes with alternating colors
 * - Smooth, performant rendering
 */

// ============================================================================
// ZENITH COLORS - Matching Zenith Design System
// ============================================================================

export const ZENITH_COLORS = {
  // Darker background for better contrast with colored clips
  background: '#060810',  // Darker than zenith-bg-primary for more contrast

  // Track lanes now use track colors (not used directly anymore)
  trackLane: 'rgba(30, 36, 47, 0.3)',
  trackLaneAlt: 'rgba(21, 25, 34, 0.5)',

  // Grid lines - slightly more visible for better readability
  gridLine: 'rgba(255, 255, 255, 0.06)',   // zenith-border-subtle (slightly brighter)
  gridLineBeat: 'rgba(255, 255, 255, 0.12)', // zenith-border-medium (slightly brighter)
  gridLineBar: 'rgba(255, 255, 255, 0.25)',  // zenith-border-strong (more visible)

  // Track borders - more prominent
  trackBorder: 'rgba(255, 255, 255, 0.12)'
};

// ============================================================================
// CONSTANTS
// ============================================================================

const PIXELS_PER_BEAT = 48; // Base pixels per beat at zoom = 1

// ============================================================================
// GRID RENDERER
// ============================================================================

/**
 * Draw the grid background
 */
export function drawGrid(ctx, width, height, viewport, tracks, snapSize = 0.25) {
  const { offsetX, offsetY, zoomX, zoomY } = viewport;
  const pixelsPerBeat = PIXELS_PER_BEAT * zoomX;

  // Clear canvas
  ctx.fillStyle = ZENITH_COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Draw track lanes
  drawTrackLanes(ctx, width, height, tracks, offsetY, zoomY);

  // Draw vertical grid lines (time)
  drawVerticalGridLines(ctx, width, height, offsetX, pixelsPerBeat, snapSize);

  // Draw horizontal track borders
  drawTrackBorders(ctx, width, tracks, offsetY, zoomY);
}

/**
 * Draw track lanes with track-specific colors
 */
function drawTrackLanes(ctx, width, height, tracks, offsetY, zoomY) {
  let y = -offsetY;

  tracks.forEach((track, index) => {
    const trackHeight = track.height * zoomY;

    // Skip if track is out of viewport
    if (y + trackHeight < 0) {
      y += trackHeight;
      return;
    }
    if (y > height) return;

    // Use track color with subtle transparency
    // Convert hex to rgba with alternating opacity for visual separation
    const trackColor = track.color || '#8b5cf6';
    const opacity = index % 2 === 0 ? 0.08 : 0.12;
    const rgba = hexToRgba(trackColor, opacity);

    ctx.fillStyle = rgba;
    ctx.fillRect(0, y, width, trackHeight);

    y += trackHeight;
  });
}

/**
 * Convert hex color to rgba with opacity
 */
function hexToRgba(hex, opacity) {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Draw vertical grid lines (bar/beat/subdivision)
 */
function drawVerticalGridLines(ctx, width, height, offsetX, pixelsPerBeat, snapSize) {
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
      ctx.strokeStyle = ZENITH_COLORS.gridLineBar;
      ctx.lineWidth = 2;
    } else if (isBeat) {
      // Beat line (medium)
      ctx.strokeStyle = ZENITH_COLORS.gridLineBeat;
      ctx.lineWidth = 1;
    } else {
      // Subdivision line (subtle)
      ctx.strokeStyle = ZENITH_COLORS.gridLine;
      ctx.lineWidth = 1;
    }

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Draw subdivisions if zoomed in enough
    if (pixelsPerBeat > 60 && snapSize < 1) {
      drawSubdivisions(ctx, x, height, pixelsPerBeat, snapSize);
    }
  }
}

/**
 * Draw subdivision lines between beats
 */
function drawSubdivisions(ctx, beatX, height, pixelsPerBeat, snapSize) {
  const subdivisions = Math.floor(1 / snapSize);

  for (let i = 1; i < subdivisions; i++) {
    const x = beatX + (i * snapSize * pixelsPerBeat);

    ctx.strokeStyle = ZENITH_COLORS.gridLine;
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
 * Draw horizontal borders between tracks
 */
function drawTrackBorders(ctx, width, tracks, offsetY, zoomY) {
  let y = -offsetY;

  tracks.forEach((track) => {
    const trackHeight = track.height * zoomY;
    y += trackHeight;

    if (y >= 0 && y <= ctx.canvas.height) {
      ctx.strokeStyle = ZENITH_COLORS.trackBorder;
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
