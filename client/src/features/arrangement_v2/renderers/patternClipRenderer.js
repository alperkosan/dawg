/**
 * 🎹 PATTERN CLIP RENDERER - ARRANGEMENT V2
 *
 * Renders pattern/MIDI clips with mini piano roll preview
 * - MIDI note preview (simplified blocks)
 * - Note range indicator
 * - Pattern name and loop count
 * - Zenith theme styling
 */

import { ZENITH_COLORS } from './gridRenderer';

// ============================================================================
// CONSTANTS
// ============================================================================

const PIXELS_PER_BEAT = 48;

// Zenith pattern clip colors
const PATTERN_CLIP_COLORS = {
  background: 'rgba(59, 130, 246, 0.2)',     // Blue
  border: 'rgba(59, 130, 246, 0.6)',
  borderSelected: 'rgba(59, 130, 246, 1)',
  text: 'rgba(255, 255, 255, 0.9)',
  notes: 'rgba(96, 165, 250, 0.9)',
  notesBorder: 'rgba(147, 197, 253, 0.4)',
  header: 'rgba(30, 64, 175, 0.3)',
  loopIndicator: 'rgba(96, 165, 250, 0.6)',
  glowSelected: '0 0 20px rgba(59, 130, 246, 0.6)'
};

// MIDI note range (C1 to C7)
const MIN_MIDI_NOTE = 24;  // C1
const MAX_MIDI_NOTE = 96;  // C7
const MIDI_NOTE_RANGE = MAX_MIDI_NOTE - MIN_MIDI_NOTE;

// ============================================================================
// PATTERN CLIP RENDERER
// ============================================================================

/**
 * Render pattern/MIDI clip with note preview
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} pattern - Pattern data with notes
 * @param {Object} clip - Clip data
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Clip width
 * @param {number} height - Clip height
 * @param {boolean} isSelected - Is clip selected
 * @param {number} lod - Level of detail (0-4)
 */
export function renderPatternClip(ctx, pattern, clip, x, y, width, height, isSelected, lod = 2) {
  // Save context state
  ctx.save();

  // Draw clip background
  drawClipBackground(ctx, x, y, width, height, isSelected);

  // Draw header with pattern name and loop count
  const headerHeight = 18;
  drawClipHeader(ctx, clip, x, y, width, headerHeight);

  // Draw MIDI preview (if pattern has notes and clip is large enough)
  if (pattern && pattern.notes && pattern.notes.length > 0 && height > 30) {
    const previewY = y + headerHeight;
    const previewHeight = height - headerHeight - 4;
    drawMIDIPreview(ctx, pattern, clip, x, previewY, width, previewHeight, lod);
  } else {
    // Show placeholder for empty pattern
    drawEmptyPatternPlaceholder(ctx, x, y + headerHeight, width, height - headerHeight - 4);
  }

  // Draw clip border
  drawClipBorder(ctx, x, y, width, height, isSelected);

  // Restore context state
  ctx.restore();
}

/**
 * Draw clip background with gradient
 */
function drawClipBackground(ctx, x, y, width, height, isSelected) {
  // Background fill
  ctx.fillStyle = PATTERN_CLIP_COLORS.background;
  ctx.fillRect(x, y, width, height);

  // Subtle gradient overlay
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

/**
 * Draw clip header with pattern name and loop count
 */
function drawClipHeader(ctx, clip, x, y, width, height) {
  // Header background
  ctx.fillStyle = PATTERN_CLIP_COLORS.header;
  ctx.fillRect(x, y, width, height);

  // Draw pattern name
  if (width > 40) {
    ctx.save();

    // Clip text region
    ctx.beginPath();
    ctx.rect(x + 6, y + 2, width - 40, height - 4);
    ctx.clip();

    // Pattern name
    ctx.fillStyle = PATTERN_CLIP_COLORS.text;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.fillText(clip.name || 'Pattern', x + 8, y + 4);

    ctx.restore();
  }

  // Draw loop count indicator (if looping)
  if (clip.loopCount && clip.loopCount > 1 && width > 60) {
    const loopText = `×${clip.loopCount}`;
    ctx.save();

    ctx.fillStyle = PATTERN_CLIP_COLORS.loopIndicator;
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(loopText, x + width - 6, y + 4);

    ctx.restore();
  }

  // Header border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + height - 0.5);
  ctx.lineTo(x + width, y + height - 0.5);
  ctx.stroke();
}

/**
 * Draw MIDI note preview (simplified piano roll)
 */
function drawMIDIPreview(ctx, pattern, clip, x, y, width, height, lod) {
  const notes = pattern.notes || [];
  if (notes.length === 0) return;

  // Calculate note range from pattern
  const noteRange = calculateNoteRange(notes);
  const minNote = noteRange.min;
  const maxNote = noteRange.max;
  const noteSpan = Math.max(1, maxNote - minNote);

  // Calculate time scale (beats to pixels)
  // clip.duration is already in beats (converted from steps in ArrangementPanelV2)
  const patternDuration = clip.duration / (clip.loopCount || 1); // Single pattern duration in beats
  const timeScale = width / clip.duration; // Pixels per beat

  // LOD-based rendering
  // LOD 0-1: Full detail (draw all notes)
  // LOD 2-3: Medium detail (downsample notes)
  // LOD 4: Minimal detail (just show note density)
  const shouldDrawIndividualNotes = lod <= 2;

  if (shouldDrawIndividualNotes) {
    // Draw individual note blocks
    drawNoteBlocks(ctx, notes, clip, minNote, maxNote, noteSpan, timeScale, patternDuration, x, y, width, height);
  } else {
    // Draw note density heatmap for very zoomed out view
    drawNoteDensity(ctx, notes, clip, timeScale, x, y, width, height);
  }

  // Draw note range indicator (only if clip is wide enough)
  if (width > 80) {
    drawNoteRangeIndicator(ctx, noteRange, x, y, width, height);
  }
}

/**
 * Draw individual note blocks
 */
function drawNoteBlocks(ctx, notes, clip, minNote, maxNote, noteSpan, timeScale, patternDuration, x, y, width, height) {
  ctx.save();

  // Setup clipping region
  ctx.beginPath();
  ctx.rect(x + 2, y, width - 4, height);
  ctx.clip();

  // Calculate how many times the pattern repeats
  const loopCount = clip.loopCount || 1;

  // Draw notes for each loop iteration
  for (let loop = 0; loop < loopCount; loop++) {
    const loopOffsetBeats = loop * patternDuration;

    notes.forEach(note => {
      // Note timing
      const noteStartBeats = note.time + loopOffsetBeats;
      const noteEndBeats = noteStartBeats + (note.duration || 0.25);

      // Convert to pixels
      const noteX = x + (noteStartBeats * timeScale);
      const noteWidth = Math.max(2, (note.duration || 0.25) * timeScale);

      // Skip if outside clip bounds
      if (noteX + noteWidth < x || noteX > x + width) return;

      // Calculate Y position (inverted - higher notes at top)
      const normalizedPitch = (note.note - minNote) / noteSpan;
      const noteY = y + height - (normalizedPitch * (height - 4)) - 4;
      const noteHeight = Math.max(2, height / Math.max(12, noteSpan)); // At least 2px

      // Draw note block
      ctx.fillStyle = PATTERN_CLIP_COLORS.notes;
      ctx.fillRect(noteX, noteY, noteWidth, noteHeight);

      // Draw note border (only if large enough)
      if (noteWidth > 4 && noteHeight > 4) {
        ctx.strokeStyle = PATTERN_CLIP_COLORS.notesBorder;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(noteX, noteY, noteWidth, noteHeight);
      }
    });
  }

  ctx.restore();
}

/**
 * Draw note density heatmap (for very zoomed out view)
 */
function drawNoteDensity(ctx, notes, clip, timeScale, x, y, width, height) {
  const bucketCount = Math.min(width, 50); // Max 50 buckets
  const buckets = new Array(bucketCount).fill(0);
  const patternDuration = clip.duration / (clip.loopCount || 1);
  const loopCount = clip.loopCount || 1;

  // Count notes per time bucket
  for (let loop = 0; loop < loopCount; loop++) {
    const loopOffsetBeats = loop * patternDuration;

    notes.forEach(note => {
      const noteStartBeats = note.time + loopOffsetBeats;
      const bucketIndex = Math.floor((noteStartBeats / clip.duration) * bucketCount);

      if (bucketIndex >= 0 && bucketIndex < bucketCount) {
        buckets[bucketIndex]++;
      }
    });
  }

  // Find max density for normalization
  const maxDensity = Math.max(...buckets, 1);

  // Draw density bars
  const bucketWidth = width / bucketCount;

  ctx.save();
  buckets.forEach((density, i) => {
    const intensity = density / maxDensity;
    const barHeight = intensity * height * 0.8;
    const barX = x + (i * bucketWidth);
    const barY = y + height - barHeight;

    ctx.fillStyle = `rgba(96, 165, 250, ${0.3 + intensity * 0.5})`;
    ctx.fillRect(barX, barY, Math.max(1, bucketWidth - 1), barHeight);
  });
  ctx.restore();
}

/**
 * Draw note range indicator (left side)
 */
function drawNoteRangeIndicator(ctx, noteRange, x, y, width, height) {
  ctx.save();

  // Note names
  const minNoteName = getMIDINoteName(noteRange.min);
  const maxNoteName = getMIDINoteName(noteRange.max);

  // Background for text
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x + 2, y + 2, 24, height - 4);

  // High note label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(maxNoteName, x + 4, y + 4);

  // Low note label
  ctx.textBaseline = 'bottom';
  ctx.fillText(minNoteName, x + 4, y + height - 4);

  ctx.restore();
}

/**
 * Draw placeholder for empty pattern
 */
function drawEmptyPatternPlaceholder(ctx, x, y, width, height) {
  ctx.save();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Empty Pattern', x + width / 2, y + height / 2);

  ctx.restore();
}

/**
 * Draw clip border with selection glow
 */
function drawClipBorder(ctx, x, y, width, height, isSelected) {
  if (isSelected) {
    // Selected border with glow
    ctx.strokeStyle = PATTERN_CLIP_COLORS.borderSelected;
    ctx.lineWidth = 2;
    ctx.shadowColor = PATTERN_CLIP_COLORS.borderSelected;
    ctx.shadowBlur = 8;
    ctx.strokeRect(x, y, width, height);
    ctx.shadowBlur = 0; // Reset shadow
  } else {
    // Normal border
    ctx.strokeStyle = PATTERN_CLIP_COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Calculate note range (min/max MIDI note numbers)
 */
function calculateNoteRange(notes) {
  if (!notes || notes.length === 0) {
    return { min: 60, max: 72 }; // Default C4-C5
  }

  let min = 127;
  let max = 0;

  notes.forEach(note => {
    if (note.note < min) min = note.note;
    if (note.note > max) max = note.note;
  });

  // Expand range slightly for better visualization
  min = Math.max(0, min - 2);
  max = Math.min(127, max + 2);

  return { min, max };
}

/**
 * Get MIDI note name (e.g., "C4", "F#5")
 */
function getMIDINoteName(midiNote) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
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
