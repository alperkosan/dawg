/**
 * 🎵 AUDIO CLIP RENDERER - ARRANGEMENT V2
 *
 * Renders audio clips with waveforms in the arrangement panel
 * - LOD-based waveform rendering (3 levels)
 * - Waveform caching for performance
 * - Fade in/out visualization
 * - Gain visualization
 * - Zenith theme styling
 */

import { getWaveformCache } from '@/features/arrangement_workspace/renderers/WaveformCache';
import { ZENITH_COLORS } from './gridRenderer';

// ============================================================================
// CONSTANTS
// ============================================================================

const PIXELS_PER_BEAT = 48;

// Zenith audio clip colors
const AUDIO_CLIP_COLORS = {
  background: 'rgba(139, 92, 246, 0.2)',    // Purple
  border: 'rgba(139, 92, 246, 0.6)',
  borderSelected: 'rgba(139, 92, 246, 1)',
  text: 'rgba(255, 255, 255, 0.9)',
  waveform: 'rgba(167, 139, 250, 0.9)',
  fadeOverlay: 'rgba(139, 92, 246, 0.15)',
  glowSelected: '0 0 20px rgba(139, 92, 246, 0.6)'
};

// ============================================================================
// AUDIO CLIP RENDERER
// ============================================================================

/**
 * Render audio clip with waveform
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {AudioBuffer} audioBuffer - Web Audio API buffer (can be null if not loaded)
 * @param {Object} clip - Clip data
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Clip width
 * @param {number} height - Clip height
 * @param {boolean} isSelected - Is clip selected
 * @param {number} bpm - Current BPM
 * @param {number} lod - Level of detail (0-4 from useArrangementCanvas)
 */
export function renderAudioClip(ctx, audioBuffer, clip, x, y, width, height, isSelected, bpm = 140, lod = 2) {
  // Save context state
  ctx.save();

  // Draw clip background
  drawClipBackground(ctx, x, y, width, height, isSelected);

  // Draw waveform (if audio buffer is loaded)
  if (audioBuffer) {
    drawWaveform(ctx, audioBuffer, clip, x, y, width, height, bpm, lod);
  } else {
    // Show loading placeholder
    drawLoadingPlaceholder(ctx, x, y, width, height);
  }

  // Draw fade overlays
  drawFadeOverlays(ctx, clip, x, y, width, height, bpm);

  // Draw clip border
  drawClipBorder(ctx, x, y, width, height, isSelected);

  // Draw clip name
  if (width > 40) {
    drawClipName(ctx, clip, x, y, width, height);
  }

  // Restore context state
  ctx.restore();
}

/**
 * Draw clip background with gradient
 */
function drawClipBackground(ctx, x, y, width, height, isSelected) {
  // Background fill
  ctx.fillStyle = AUDIO_CLIP_COLORS.background;
  ctx.fillRect(x, y, width, height);

  // Subtle gradient overlay
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

/**
 * Draw waveform with LOD and caching
 */
function drawWaveform(ctx, audioBuffer, clip, x, y, width, height, bpm, lod) {
  // Get waveform cache
  const waveformCache = getWaveformCache();

  // Calculate LOD for waveform cache (map arrangement LOD to waveform LOD)
  // Arrangement LOD: 0 (zoomed in) -> 4 (zoomed out)
  // Waveform LOD: 0 (low detail) -> 2 (high detail)
  const waveformLOD = lod >= 3 ? 0 : lod >= 1 ? 1 : 2;

  // Try to get from cache
  const waveformHeight = height - 16; // Leave space for padding
  let waveformCanvas = waveformCache.get(clip.id, clip, width, waveformHeight, bpm, waveformLOD);

  // Render if not cached
  if (!waveformCanvas) {
    waveformCanvas = waveformCache.renderWaveform(
      audioBuffer,
      clip,
      width,
      waveformHeight,
      bpm,
      waveformLOD,
      {} // styles (not used in current implementation)
    );

    // Cache the result
    waveformCache.set(clip.id, clip, width, waveformHeight, bpm, waveformLOD, waveformCanvas);
  }

  // Draw cached waveform (with safety check)
  if (waveformCanvas && waveformCanvas.width > 0 && waveformCanvas.height > 0) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.drawImage(waveformCanvas, x, y + 8, width, waveformHeight);
    ctx.restore();
  }
}

/**
 * Draw loading placeholder when audio buffer not loaded
 */
function drawLoadingPlaceholder(ctx, x, y, width, height) {
  ctx.save();

  // Loading text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Loading...', x + width / 2, y + height / 2);

  // Loading spinner (simple pulsing dots)
  const time = Date.now() / 1000;
  for (let i = 0; i < 3; i++) {
    const alpha = 0.2 + 0.3 * Math.sin(time * 3 + i * Math.PI / 3);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x + width / 2 - 12 + i * 12, y + height / 2 + 16, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw fade in/out overlays
 */
function drawFadeOverlays(ctx, clip, x, y, width, height, bpm) {
  const { fadeIn = 0, fadeOut = 0 } = clip;

  if (fadeIn > 0) {
    const fadeInWidth = Math.min(fadeIn * PIXELS_PER_BEAT, width / 2);

    // Fade in gradient
    const fadeInGradient = ctx.createLinearGradient(x, y, x + fadeInWidth, y);
    fadeInGradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    fadeInGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = fadeInGradient;
    ctx.fillRect(x, y, fadeInWidth, height);

    // Fade in triangle indicator (subtle)
    ctx.save();
    ctx.fillStyle = AUDIO_CLIP_COLORS.fadeOverlay;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + fadeInWidth, y + height / 2);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (fadeOut > 0) {
    const fadeOutWidth = Math.min(fadeOut * PIXELS_PER_BEAT, width / 2);

    // Fade out gradient
    const fadeOutGradient = ctx.createLinearGradient(x + width - fadeOutWidth, y, x + width, y);
    fadeOutGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fadeOutGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

    ctx.fillStyle = fadeOutGradient;
    ctx.fillRect(x + width - fadeOutWidth, y, fadeOutWidth, height);

    // Fade out triangle indicator (subtle)
    ctx.save();
    ctx.fillStyle = AUDIO_CLIP_COLORS.fadeOverlay;
    ctx.beginPath();
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width - fadeOutWidth, y + height / 2);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Draw clip border with selection glow
 */
function drawClipBorder(ctx, x, y, width, height, isSelected) {
  if (isSelected) {
    // Selected border with glow
    ctx.strokeStyle = AUDIO_CLIP_COLORS.borderSelected;
    ctx.lineWidth = 2;
    ctx.shadowColor = AUDIO_CLIP_COLORS.borderSelected;
    ctx.shadowBlur = 8;
    ctx.strokeRect(x, y, width, height);
    ctx.shadowBlur = 0; // Reset shadow
  } else {
    // Normal border
    ctx.strokeStyle = AUDIO_CLIP_COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }
}

/**
 * Draw clip name with clipping
 */
function drawClipName(ctx, clip, x, y, width, height) {
  ctx.save();

  // Setup text clipping region
  ctx.beginPath();
  ctx.rect(x + 6, y + 4, width - 12, 16);
  ctx.clip();

  // Draw text
  ctx.fillStyle = AUDIO_CLIP_COLORS.text;
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Add small shadow for better readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 2;
  ctx.fillText(clip.name || 'Audio Clip', x + 8, y + 6);

  ctx.restore();
}

/**
 * Calculate if clip is in viewport (for culling)
 */
export function isClipInViewport(clip, visibleBeats) {
  const clipEndBeat = clip.startTime + clip.duration;
  return !(clipEndBeat < visibleBeats.start || clip.startTime > visibleBeats.end);
}

/**
 * Get clip bounds in pixels
 */
export function getClipBounds(clip, trackIndex, constants, viewport) {
  const x = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
  const y = trackIndex * 80 * viewport.zoomY + 4; // 80 is default track height
  const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
  const height = 80 * viewport.zoomY - 8; // Leave padding

  return { x, y, width, height };
}
