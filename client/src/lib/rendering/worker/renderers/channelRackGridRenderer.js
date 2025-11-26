const STEP_WIDTH = 16;
const ROW_HEIGHT = 64;
const BUFFER_STEPS = 32;
const BUFFER_ROWS = 2;
const STEP_GROUP_SIZE = 4;
const NOTE_SLOT_Y = ROW_HEIGHT * 0.3;
const NOTE_SLOT_HEIGHT = ROW_HEIGHT * 0.4;
const MIN_PITCH = 36;
const MAX_PITCH = 96;
const DEFAULT_PALETTE = {
  bgPrimary: '#1a1d24',
  bgSecondary: '#202229',
  borderSubtle: 'rgba(180, 188, 208, 0.15)',
  borderMedium: 'rgba(180, 188, 208, 0.3)',
  borderStrong: 'rgba(180, 188, 208, 0.7)',
  accentCool: '#00d9ff'
};

export const channelRackGridRenderer = {
  create(initialState = {}, { markDirty }) {
    let state = {
      instruments: [],
      notesData: {},
      totalSteps: 256,
      patternLength: null,
      viewportWidth: 0,
      viewportHeight: 0,
      scrollX: 0,
      scrollY: 0,
      palette: { ...DEFAULT_PALETTE, ...(initialState.palette || {}) },
      hoveredCell: null,
      devicePixelRatio: initialState.devicePixelRatio || 1,
      ...initialState
    };

    const updateState = (nextState = {}) => {
      const { notesPatch, notesRemove, ...rest } = nextState;

      if (notesPatch && typeof notesPatch === 'object') {
        state.notesData = { ...(state.notesData || {}) };
        Object.entries(notesPatch).forEach(([instrumentId, notes]) => {
          state.notesData[instrumentId] = Array.isArray(notes) ? notes : [];
        });
      }

      if (Array.isArray(notesRemove) && notesRemove.length) {
        if (!state.notesData) {
          state.notesData = {};
        }
        notesRemove.forEach((instrumentId) => {
          delete state.notesData[instrumentId];
        });
      }

      const nextPalette = rest.palette
        ? { ...state.palette, ...rest.palette }
        : state.palette;
      state = { ...state, ...rest, palette: nextPalette };
      markDirty();
    };

    const render = (canvas, ctx) => {
      const bounds = calculateVisibleBounds(state);
      const styles = state.palette || DEFAULT_PALETTE;

      if (!state.viewportWidth || !state.viewportHeight) {
        return;
      }

      const dpr = state.devicePixelRatio || self.devicePixelRatio || 1;
      canvas.width = state.viewportWidth * dpr;
      canvas.height = state.viewportHeight * dpr;
      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = styles.bgPrimary;
      ctx.fillRect(0, 0, state.viewportWidth, state.viewportHeight);

      drawRowBackgrounds(ctx, bounds, styles, state.viewportWidth);
      drawGrid(ctx, bounds, styles, state.viewportWidth, state.viewportHeight);

      // ✅ FIX: Add missing mini-step dividers
      drawMiniStepDividers(ctx, state, bounds, styles);

      drawStepSequencerSlots(ctx, state, bounds, styles);
      drawPatternOverlay(ctx, state.patternLength, state.totalSteps, bounds.scrollX, state.viewportWidth, state.viewportHeight);
      drawNotesLayer(ctx, state, bounds, styles);
      if (state.hoveredCell) {
        drawHoveredCell(ctx, state.hoveredCell, bounds, styles, state);
      }

      ctx.restore();
    };

    return (canvas, ctx, nextState) => {
      updateState(nextState);
      render(canvas, ctx);
    };
  }
};

function calculateVisibleBounds(state) {
  const { scrollX, scrollY, instruments, totalSteps, viewportWidth, viewportHeight } = state;
  const startRow = Math.max(0, Math.floor(scrollY / ROW_HEIGHT) - BUFFER_ROWS);
  const endRow = Math.min(instruments.length, Math.ceil((scrollY + viewportHeight) / ROW_HEIGHT) + BUFFER_ROWS);
  const startStep = Math.max(0, Math.floor(scrollX / STEP_WIDTH) - BUFFER_STEPS);
  const endStep = Math.min(totalSteps, Math.ceil((scrollX + viewportWidth) / STEP_WIDTH) + BUFFER_STEPS);
  return { startRow, endRow, startStep, endStep, scrollX, scrollY, viewportWidth, viewportHeight };
}

function drawRowBackgrounds(ctx, bounds, styles, width) {
  const { startRow, endRow, scrollY } = bounds;
  for (let row = startRow; row < endRow; row++) {
    const y = row * ROW_HEIGHT - scrollY;
    ctx.fillStyle = row % 2 === 0 ? styles.bgSecondary : styles.bgPrimary;
    ctx.fillRect(0, y, width, ROW_HEIGHT);
  }
}

function drawGrid(ctx, bounds, styles, width, height) {
  const { startRow, endRow, startStep, endStep, scrollX, scrollY } = bounds;

  ctx.beginPath();
  ctx.strokeStyle = styles.borderSubtle;
  ctx.lineWidth = 1;
  for (let row = startRow; row <= endRow; row++) {
    const y = row * ROW_HEIGHT - scrollY;
    if (y >= -ROW_HEIGHT && y <= height) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
  }
  ctx.stroke();

  const startBar = Math.floor(startStep / 16);
  const endBar = Math.ceil(endStep / 16);

  for (let bar = startBar; bar <= endBar; bar++) {
    const barStep = bar * 16;
    const x = barStep * STEP_WIDTH - scrollX;
    if (x < -STEP_WIDTH || x > width) continue;
    ctx.beginPath();
    // ✅ FIX: Match UnifiedGridCanvas highlight style
    const isFirstBar = bar === 0;
    ctx.strokeStyle = isFirstBar ? withAlpha(styles.accentCool, 0.25) : styles.borderStrong;
    ctx.lineWidth = isFirstBar ? 2 : 3;

    if (!isFirstBar) {
      ctx.shadowBlur = 6;
      ctx.shadowColor = withAlpha(styles.accentCool, 0.35);
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.beginPath();
  ctx.strokeStyle = styles.borderMedium;
  ctx.lineWidth = 1;
  for (let bar = startBar; bar <= endBar; bar++) {
    const barStep = bar * 16;
    for (let beat = 1; beat < 4; beat++) {
      const beatStep = barStep + beat * 4;
      const beatX = beatStep * STEP_WIDTH - scrollX;
      if (beatX >= 0 && beatX <= width) {
        ctx.moveTo(beatX + 0.5, 0);
        ctx.lineTo(beatX + 0.5, height);
      }
    }
  }
  ctx.stroke();
}

// ✅ FIX: New function for mini-step dividers
function drawMiniStepDividers(ctx, state, bounds, styles) {
  const { instruments, notesData } = state;
  const { startRow, endRow, startStep, endStep, scrollX, scrollY, viewportWidth } = bounds;

  ctx.beginPath();
  ctx.strokeStyle = styles.borderSubtle;
  ctx.lineWidth = 1;

  for (let row = startRow; row < endRow; row++) {
    const instrument = instruments[row];
    if (!instrument) continue;

    const notes = notesData[instrument.id] || [];
    const isSequencer = isStepSequencerRow(notes);

    if (!isSequencer) continue;

    const y = row * ROW_HEIGHT - scrollY;

    for (let slot = Math.floor(startStep / 4); slot <= Math.ceil(endStep / 4); slot++) {
      const slotX = slot * 4 * STEP_WIDTH - scrollX;

      for (let miniStep = 1; miniStep < 4; miniStep++) {
        const x = slotX + miniStep * (STEP_WIDTH / 4);
        if (x >= 0 && x <= viewportWidth) {
          ctx.moveTo(x, y + ROW_HEIGHT * 0.25);
          ctx.lineTo(x, y + ROW_HEIGHT * 0.75);
        }
      }
    }
  }
  ctx.stroke();
}

function drawPatternOverlay(ctx, patternLength, totalSteps, scrollX, width, height) {
  if (patternLength === null || !Number.isFinite(patternLength)) return;
  const normalized = Math.max(0, Math.min(patternLength, totalSteps));
  if (normalized < totalSteps) {
    const dimStartWorld = normalized * STEP_WIDTH;
    const visibleStart = scrollX;
    const visibleEnd = scrollX + width;
    if (visibleEnd > dimStartWorld) {
      const startX = Math.max(0, dimStartWorld - visibleStart);
      const dimWidth = width - startX;
      if (dimWidth > 0) {
        ctx.fillStyle = 'rgba(5, 8, 15, 0.45)';
        ctx.fillRect(startX, 0, dimWidth, height);
      }
    }
  }
}

function drawStepSequencerSlots(ctx, state, bounds, styles) {
  const { instruments, notesData } = state;
  const { startRow, endRow, startStep, endStep, scrollX, scrollY, viewportWidth } = bounds;
  ctx.save();
  ctx.fillStyle = withAlpha(styles.borderSubtle, 0.25); // ✅ FIX: Match UnifiedGridCanvas opacity

  for (let row = startRow; row < endRow; row++) {
    const instrument = instruments[row];
    if (!instrument) continue;
    const notes = notesData[instrument.id] || [];
    if (!isStepSequencerRow(notes)) continue;

    const slotY = row * ROW_HEIGHT - scrollY + NOTE_SLOT_Y;
    // ✅ FIX: Correct slot loop range
    const startSlot = Math.floor(startStep / 4);
    const endSlot = Math.ceil(endStep / 4);

    for (let slot = startSlot; slot <= endSlot; slot++) {
      const slotX = slot * 4 * STEP_WIDTH - scrollX + 2;
      const slotWidth = 4 * STEP_WIDTH - 4;

      if (slotX + slotWidth >= 0 && slotX <= viewportWidth) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'; // ✅ FIX: Match UnifiedGridCanvas color
        ctx.fillRect(slotX, slotY, slotWidth, NOTE_SLOT_HEIGHT);
      }
    }
  }

  ctx.restore();
}

function drawNotesLayer(ctx, state, bounds, styles) {
  const { instruments, notesData } = state;
  const { startRow, endRow, startStep, endStep, scrollX, scrollY, viewportWidth } = bounds;

  for (let row = startRow; row < endRow; row++) {
    const instrument = instruments[row];
    if (!instrument) continue;
    const notes = notesData[instrument.id] || [];
    if (!notes.length) continue;
    const rowY = row * ROW_HEIGHT - scrollY;
    const isSequencer = isStepSequencerRow(notes);

    if (isSequencer) {
      drawSequencerNotes(ctx, notes, rowY, scrollX, startStep, endStep, styles);
    } else {
      drawMiniPreviewNotes(ctx, notes, rowY, scrollX, viewportWidth, startStep, endStep, styles);
    }
  }
}

function drawSequencerNotes(ctx, notes, rowY, scrollX, startStep, endStep, styles) {
  ctx.save();
  const noteY = rowY + NOTE_SLOT_Y;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const step = getNoteStart(note);
    if (step < startStep || step > endStep) continue;

    // ✅ FIX: Match UnifiedGridCanvas calculation
    const slot = Math.floor(step / 4);
    const slotX = slot * 4 * STEP_WIDTH - scrollX + 2;
    const positionInSlot = step % 4;
    const miniStepWidth = STEP_WIDTH;
    const noteX = slotX + positionInSlot * miniStepWidth + 1;
    const noteWidth = miniStepWidth - 2;

    // ✅ FIX: Match UnifiedGridCanvas gradient and glow
    const gradient = ctx.createLinearGradient(noteX, noteY, noteX, noteY + NOTE_SLOT_HEIGHT);
    gradient.addColorStop(0, styles.accentCool);
    gradient.addColorStop(1, styles.accentCool);

    // Glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = withAlpha(styles.accentCool, 0.6);
    ctx.fillStyle = gradient;
    ctx.fillRect(noteX, noteY + 1, noteWidth, NOTE_SLOT_HEIGHT - 2);

    // Highlight
    ctx.shadowBlur = 0;
    const highlight = ctx.createLinearGradient(noteX, noteY, noteX, noteY + NOTE_SLOT_HEIGHT * 0.3);
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlight;
    ctx.fillRect(noteX, noteY + 1, noteWidth, NOTE_SLOT_HEIGHT * 0.3);

    // Border
    ctx.strokeStyle = withAlpha(styles.accentCool, 0.8);
    ctx.lineWidth = 1;
    ctx.strokeRect(noteX + 0.5, noteY + 1.5, noteWidth - 1, NOTE_SLOT_HEIGHT - 3);
  }
  ctx.restore();
}

function drawMiniPreviewNotes(ctx, notes, rowY, scrollX, viewportWidth, startStep, endStep, styles) {
  // ✅ FIX: Implement dynamic pitch scaling (Mini Piano Roll)
  let minPitch = 127, maxPitch = 0;
  const C5_MIDI = 72;

  notes.forEach(note => {
    const midi = getNotePitch(note);
    if (midi < minPitch) minPitch = midi;
    if (midi > maxPitch) maxPitch = midi;
  });

  const pitchPadding = 4;
  minPitch = Math.max(0, minPitch - pitchPadding);
  maxPitch = Math.min(127, maxPitch + pitchPadding);
  const pitchRange = Math.max(1, maxPitch - minPitch);

  const previewY = rowY + 5;
  const previewHeight = ROW_HEIGHT - 10;

  ctx.save();
  ctx.shadowBlur = 0;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const step = getNoteStart(note);

    // ✅ FL STUDIO STYLE: Use visualLength for display, actual length for viewport calculation
    const visualDuration = getNoteLength(note, true);
    const actualDuration = getNoteLength(note, false);

    const noteEndStep = step + actualDuration;
    if (noteEndStep < startStep || step > endStep) continue;

    const midi = getNotePitch(note);
    const normalizedPitch = (midi - minPitch) / pitchRange;
    const noteY = previewY + previewHeight * (1 - normalizedPitch);
    const noteHeight = Math.max(2, previewHeight / pitchRange);

    const noteX = step * STEP_WIDTH - scrollX + 1;
    const noteWidth = visualDuration * STEP_WIDTH - 2;

    if (noteX + noteWidth < 0 || noteX > viewportWidth) continue;

    ctx.fillStyle = styles.accentCool;
    ctx.fillRect(noteX, noteY, noteWidth, noteHeight);
  }
  ctx.restore();
}

function drawHoveredCell(ctx, hoveredCell, bounds, styles, state) {
  const { row, step, instrumentId } = hoveredCell;
  if (row == null || step == null) return;
  const { startRow, endRow, startStep, endStep, scrollX, scrollY, viewportWidth, viewportHeight } = bounds;
  if (row < startRow || row >= endRow || step < startStep || step > endStep) return;

  const instrument = state.instruments[row];
  if (!instrument) return;

  const notes = state.notesData[instrumentId] || [];

  // Only show ghost note in step sequencer mode
  if (!isStepSequencerRow(notes)) return;

  // Check if note already exists at this position
  const noteExists = notes.some(n => getNoteStart(n) === step);
  if (noteExists) return;

  const rowY = row * ROW_HEIGHT - scrollY;
  const noteY = rowY + NOTE_SLOT_Y;

  const slot = Math.floor(step / 4);
  const slotX = slot * 4 * STEP_WIDTH - scrollX + 2;
  const positionInSlot = step % 4;
  const miniStepWidth = STEP_WIDTH;
  const noteX = slotX + positionInSlot * miniStepWidth + 1;
  const noteWidth = miniStepWidth - 2;

  if (noteX > viewportWidth || rowY > viewportHeight) return;

  ctx.save();

  // ✅ FIX: Match UnifiedGridCanvas ghost note style
  ctx.shadowBlur = 10;
  ctx.shadowColor = withAlpha(styles.accentCool, 0.6);

  // Brighter fill with gradient for depth
  const ghostGradient = ctx.createLinearGradient(noteX, noteY, noteX, noteY + NOTE_SLOT_HEIGHT);
  ghostGradient.addColorStop(0, withAlpha(styles.accentCool, 0.35));
  ghostGradient.addColorStop(0.5, withAlpha(styles.accentCool, 0.45));
  ghostGradient.addColorStop(1, withAlpha(styles.accentCool, 0.35));
  ctx.fillStyle = ghostGradient;
  ctx.fillRect(noteX, noteY + 1, noteWidth, NOTE_SLOT_HEIGHT - 2);

  // Stronger border with double glow effect
  ctx.shadowBlur = 8;
  ctx.shadowColor = withAlpha(styles.accentCool, 0.8);
  ctx.strokeStyle = withAlpha(styles.accentCool, 0.9);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]); // Dashed border
  ctx.strokeRect(noteX + 0.5, noteY + 1.5, noteWidth - 1, NOTE_SLOT_HEIGHT - 3);
  ctx.setLineDash([]); // Reset dash

  // Add inner highlight
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(noteX + 2, noteY + 3, noteWidth - 4, NOTE_SLOT_HEIGHT - 6);

  ctx.restore();
}

function isStepSequencerRow(notes) {
  if (!notes || !notes.length) return true;
  for (let i = 0; i < notes.length; i++) {
    const midi = getNotePitch(notes[i]);
    if (midi !== 60 && midi !== 72) {
      return false;
    }
  }
  return true;
}

function getNoteStart(note) {
  if (!note) return 0;
  if (typeof note.startTime === 'number') return note.startTime;
  if (typeof note.time === 'number') return note.time;
  return 0;
}

function getNoteLength(note, useVisual = false) {
  if (!note) return 1;

  // ✅ FL STUDIO STYLE: Support visualLength
  if (useVisual && typeof note.visualLength === 'number' && note.visualLength > 0) {
    return note.visualLength;
  }

  if (!useVisual && typeof note.length === 'number' && note.length > 0) {
    return note.length;
  }

  if (typeof note.length === 'number' && note.length > 0) return note.length;
  if (typeof note.visualLength === 'number' && note.visualLength > 0) return note.visualLength;

  if (note.duration) {
    const match = /(\d+)/.exec(String(note.duration));
    if (match) {
      const value = parseInt(match[1], 10);
      if (!Number.isNaN(value) && value > 0) {
        const beats = 4 / value;
        return Math.max(1, Math.round(beats * 4));
      }
    }
  }
  return 1;
}

function getNotePitch(note) {
  if (!note) return 72; // ✅ FIX: Default to C5 (72) to match UnifiedGridCanvas
  if (typeof note.pitch === 'number') return note.pitch;
  if (typeof note.pitch === 'string') return pitchToMidi(note.pitch);
  return 72;
}

const NOTE_MAP = {
  C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6,
  G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11
};

function pitchToMidi(pitch) {
  if (typeof pitch !== 'string') return 72;
  const noteName = pitch.replace(/[0-9-]/g, '').toUpperCase();
  const octave = parseInt(pitch.replace(/[^0-9-]/g, ''), 10);
  const base = NOTE_MAP[noteName];
  const octaveValue = Number.isNaN(octave) ? 5 : octave + 1;
  if (typeof base !== 'number') return 72;
  return octaveValue * 12 + base;
}

function withAlpha(color, alpha) {
  if (!color) return `rgba(255,255,255,${alpha})`;
  if (color.startsWith('#')) {
    const hex = color.length === 4
      ? color.slice(1).split('').map(ch => ch + ch).join('')
      : color.slice(1);
    const int = parseInt(hex, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb')) {
    return color.replace(/rgba?\((.+)\)/, (_, inner) => `rgba(${inner}, ${alpha})`);
  }
  return color;
}

