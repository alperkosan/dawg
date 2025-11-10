/**
 * 🎹 PATTERN CLIP RENDERER - ARRANGEMENT V2
 *
 * Renders pattern/MIDI clips with mini piano roll preview
 * - MIDI note preview (simplified blocks)
 * - Note range indicator
 * - Pattern name and loop count
 * - Zenith theme styling
 */

// ✅ THEME-AWARE: Pattern clip renderer uses fixed colors for now
// TODO: Make pattern clip renderer theme-aware in the future

// ============================================================================
// CONSTANTS
// ============================================================================

const PIXELS_PER_BEAT = 48;

/**
 * ✅ PHASE 2: Design Consistency - Generate pattern clip colors using Zenith theme
 * Pattern clips use a fixed warm accent color (purple) from Zenith theme
 */
function getPatternClipColors() {
  // Use Zenith purple color (purple: #8b5cf6 / rgba(139, 92, 246, ...))
  const r = 139;
  const g = 92;
  const b = 246;

  // Calculate slightly lighter/darker variants
  const lighten = (val) => Math.min(255, val + 30);
  const darken = (val) => Math.max(0, val - 30);

  return {
    background: `rgba(${r}, ${g}, ${b}, 0.15)`,
    border: `rgba(${r}, ${g}, ${b}, 0.6)`,
    borderSelected: `rgba(${r}, ${g}, ${b}, 1)`,
    text: 'rgba(255, 255, 255, 0.9)',
    notes: `rgba(${r}, ${g}, ${b}, 0.8)`,
    notesBorder: `rgba(${lighten(r)}, ${lighten(g)}, ${lighten(b)}, 0.4)`,
    header: `rgba(${darken(r)}, ${darken(g)}, ${darken(b)}, 0.3)`,
    loopIndicator: `rgba(${r}, ${g}, ${b}, 0.7)`,
    glowSelected: `0 0 20px rgba(${r}, ${g}, ${b}, 0.6)`,
    // For gradients
    gradientTop: `rgba(${r}, ${g}, ${b}, 0.15)`,
    gradientBottom: `rgba(${r}, ${g}, ${b}, 0.05)`,
    // For density heatmap
    densityBase: `rgba(${r}, ${g}, ${b}, 0.3)`
  };
}

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
 * @param {Object} track - Track data (for color inheritance)
 */
export function renderPatternClip(ctx, pattern, clip, x, y, width, height, isSelected, lod = 2, track = null) {
  // Save context state
  ctx.save();

  // ✅ PHASE 2: Design Consistency - Use fixed Zenith theme colors (no track color dependency)
  const colors = getPatternClipColors();

  // Draw clip background
  drawClipBackground(ctx, x, y, width, height, isSelected, colors);

  // Draw header with pattern name and loop count
  const headerHeight = 18;
  drawClipHeader(ctx, clip, x, y, width, headerHeight, colors);

  // Draw MIDI preview (if pattern has notes and clip is large enough)
  if (pattern && pattern.notes && pattern.notes.length > 0 && height > 30) {
    const previewY = y + headerHeight;
    const previewHeight = height - headerHeight - 4;
    drawMIDIPreview(ctx, pattern, clip, x, previewY, width, previewHeight, lod, colors);
  } else {
    // Show placeholder for empty pattern
    drawEmptyPatternPlaceholder(ctx, x, y + headerHeight, width, height - headerHeight - 4, colors);
  }

  // Draw clip border
  drawClipBorder(ctx, x, y, width, height, isSelected, colors);

  // Restore context state
  ctx.restore();
}

/**
 * Draw clip background with gradient
 */
function drawClipBackground(ctx, x, y, width, height, isSelected, colors) {
  // Background fill
  ctx.fillStyle = colors.background;
  ctx.fillRect(x, y, width, height);

  // Subtle gradient overlay
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, colors.gradientTop);
  gradient.addColorStop(1, colors.gradientBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

/**
 * Draw clip header with pattern name and loop count
 */
function drawClipHeader(ctx, clip, x, y, width, height, colors) {
  // Header background
  ctx.fillStyle = colors.header;
  ctx.fillRect(x, y, width, height);

  // Draw pattern name
  if (width > 40) {
    ctx.save();

    // Clip text region
    ctx.beginPath();
    ctx.rect(x + 6, y + 2, width - 40, height - 4);
    ctx.clip();

    // Pattern name
    ctx.fillStyle = colors.text;
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

    ctx.fillStyle = colors.loopIndicator;
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
function drawMIDIPreview(ctx, pattern, clip, x, y, width, height, lod, colors) {
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
    drawNoteBlocks(ctx, notes, clip, minNote, maxNote, noteSpan, timeScale, patternDuration, x, y, width, height, colors);
  } else {
    // Draw note density heatmap for very zoomed out view
    drawNoteDensity(ctx, notes, clip, timeScale, x, y, width, height, colors);
  }

  // Draw note range indicator (only if clip is wide enough)
  if (width > 80) {
    drawNoteRangeIndicator(ctx, noteRange, x, y, width, height);
  }
}

/**
 * Draw individual note blocks
 */
function drawNoteBlocks(ctx, notes, clip, minNote, maxNote, noteSpan, timeScale, patternDuration, x, y, width, height, colors) {
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
      ctx.fillStyle = colors.notes;
      ctx.fillRect(noteX, noteY, noteWidth, noteHeight);

      // Draw note border (only if large enough)
      if (noteWidth > 4 && noteHeight > 4) {
        ctx.strokeStyle = colors.notesBorder;
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
function drawNoteDensity(ctx, notes, clip, timeScale, x, y, width, height, colors) {
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

  // Extract RGB from colors.densityBase
  const rgbaMatch = colors.densityBase.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const r = rgbaMatch ? rgbaMatch[1] : 255;
  const g = rgbaMatch ? rgbaMatch[2] : 182;
  const b = rgbaMatch ? rgbaMatch[3] : 39;

  ctx.save();
  buckets.forEach((density, i) => {
    const intensity = density / maxDensity;
    const barHeight = intensity * height * 0.8;
    const barX = x + (i * bucketWidth);
    const barY = y + height - barHeight;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.5})`;
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
function drawEmptyPatternPlaceholder(ctx, x, y, width, height, colors) {
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
function drawClipBorder(ctx, x, y, width, height, isSelected, colors) {
  if (isSelected) {
    // Selected border with glow
    ctx.strokeStyle = colors.borderSelected;
    ctx.lineWidth = 2;
    ctx.shadowColor = colors.borderSelected;
    ctx.shadowBlur = 8;
    ctx.strokeRect(x, y, width, height);
    ctx.shadowBlur = 0; // Reset shadow
  } else {
    // Normal border
    ctx.strokeStyle = colors.border;
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
