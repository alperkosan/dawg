/**
 * 🎨 GRID RENDERER - ZENITH THEME
 *
 * Draws the background grid for the arrangement panel
 * - Bar lines, beat lines, subdivision lines
 * - Track lanes with alternating colors
 * - Smooth, performant rendering
 */

// ============================================================================
// ZENITH COLORS
// ============================================================================

export const ZENITH_COLORS = {
  background: '#0a0a0f',
  trackLane: 'rgba(20, 20, 30, 0.4)',
  trackLaneAlt: 'rgba(25, 25, 35, 0.5)',
  gridLine: 'rgba(255, 255, 255, 0.03)',
  gridLineBeat: 'rgba(255, 255, 255, 0.08)',
  gridLineBar: 'rgba(255, 255, 255, 0.15)',
  trackBorder: 'rgba(255, 255, 255, 0.05)'
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
 * Draw track lanes with alternating colors
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

    // Alternate track colors for visual separation
    ctx.fillStyle = index % 2 === 0 ? ZENITH_COLORS.trackLane : ZENITH_COLORS.trackLaneAlt;
    ctx.fillRect(0, y, width, trackHeight);

    y += trackHeight;
  });
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
