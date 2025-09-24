// utils/precisionGrid.js
// Motor hassasiyetinde grid hesaplamaları ve 1/32 precision snap sistemi

/**
 * Piano Roll grid precision sistemi
 * - Motor tick-level accuracy (1/96'lık tick)
 * - 1/32'lik nota UI precision
 * - Shift+wheel micro-adjustment
 * - Layered grid visualization
 */

export class PrecisionGrid {
  constructor(bpm = 120, ppq = 96) {
    this.bpm = bpm;
    this.ppq = ppq; // Pulses per quarter (motor resolution)
    this.timeSignature = [4, 4];

    // Grid precision levels
    this.UI_PRECISION = 32; // 1/32 notes (finest UI interaction)
    this.MOTOR_PRECISION = 96; // Motor tick precision
    this.MICRO_PRECISION = 384; // Shift+wheel precision (4x motor)

    // Visual grid levels (layered)
    this.GRID_LEVELS = {
      bars: { division: 1, color: '#333333', width: 2, alpha: 1.0 },
      beats: { division: 4, color: '#444444', width: 1, alpha: 0.8 },
      eighths: { division: 8, color: '#555555', width: 1, alpha: 0.6 },
      sixteenths: { division: 16, color: '#666666', width: 1, alpha: 0.4 },
      thirtySeconds: { division: 32, color: '#777777', width: 1, alpha: 0.2 }
    };
  }

  // ========================= TIME CONVERSIONS =========================

  /**
   * Converts steps to motor ticks
   * @param {number} steps - Steps (16th note based)
   * @returns {number} Motor ticks
   */
  stepsToTicks(steps) {
    return steps * (this.ppq / 4); // 1 step = ppq/4 ticks
  }

  /**
   * Converts motor ticks to steps
   * @param {number} ticks
   * @returns {number} Steps (16th note based)
   */
  ticksToSteps(ticks) {
    return ticks / (this.ppq / 4);
  }

  /**
   * Converts time to motor ticks with maximum precision
   * @param {number} timeInSeconds
   * @returns {number} Motor ticks
   */
  timeToTicks(timeInSeconds) {
    const secondsPerBeat = 60 / this.bpm;
    const secondsPerTick = secondsPerBeat / this.ppq;
    return Math.round(timeInSeconds / secondsPerTick);
  }

  /**
   * Converts motor ticks to time
   * @param {number} ticks
   * @returns {number} Time in seconds
   */
  ticksToTime(ticks) {
    const secondsPerBeat = 60 / this.bpm;
    const secondsPerTick = secondsPerBeat / this.ppq;
    return ticks * secondsPerTick;
  }

  /**
   * Converts UI position (pixels) to motor ticks
   * @param {number} pixelX - X position in pixels
   * @param {number} stepWidth - Width of one step in pixels
   * @returns {number} Motor ticks
   */
  pixelsToTicks(pixelX, stepWidth) {
    const steps = pixelX / stepWidth;
    return this.stepsToTicks(steps);
  }

  /**
   * Converts motor ticks to UI position (pixels)
   * @param {number} ticks
   * @param {number} stepWidth - Width of one step in pixels
   * @returns {number} X position in pixels
   */
  ticksToPixels(ticks, stepWidth) {
    const steps = this.ticksToSteps(ticks);
    return steps * stepWidth;
  }

  // ========================= SNAP SYSTEM =========================

  /**
   * Snaps ticks to 1/32 note grid (UI precision)
   * @param {number} ticks - Raw motor ticks
   * @returns {number} Snapped ticks
   */
  snapToUIGrid(ticks) {
    const ticksPer32nd = this.ppq / 8; // 1/32 note = ppq/8 ticks
    return Math.round(ticks / ticksPer32nd) * ticksPer32nd;
  }

  /**
   * Snaps ticks to motor precision (finest possible)
   * @param {number} ticks
   * @returns {number} Snapped ticks (integer)
   */
  snapToMotorGrid(ticks) {
    return Math.round(ticks);
  }

  /**
   * Micro-adjustment snap for shift+wheel (4x motor precision)
   * @param {number} ticks
   * @returns {number} Micro-snapped ticks
   */
  snapToMicroGrid(ticks) {
    const microTicks = ticks * 4; // 4x precision
    return Math.round(microTicks) / 4;
  }

  /**
   * Smart snap based on current mode and modifiers
   * @param {number} ticks
   * @param {Object} options - { mode: 'ui'|'motor'|'micro', force: boolean }
   * @returns {number} Snapped ticks
   */
  smartSnap(ticks, options = {}) {
    const { mode = 'ui', force = false } = options;

    switch (mode) {
      case 'motor':
        return this.snapToMotorGrid(ticks);
      case 'micro':
        return this.snapToMicroGrid(ticks);
      case 'ui':
      default:
        return this.snapToUIGrid(ticks);
    }
  }

  // ========================= GRID VISUALIZATION =========================

  /**
   * Calculates visible grid lines for a given viewport
   * @param {number} startTick - Viewport start (motor ticks)
   * @param {number} endTick - Viewport end (motor ticks)
   * @param {number} stepWidth - Pixels per step
   * @param {number} minPixelSpacing - Minimum spacing between grid lines
   * @returns {Array} Grid lines with positions and styles
   */
  calculateVisibleGridLines(startTick, endTick, stepWidth, minPixelSpacing = 8) {
    const gridLines = [];
    const tickRange = endTick - startTick;

    // Determine which grid levels to show based on zoom
    const pixelRange = this.ticksToPixels(tickRange, stepWidth);
    const visibleLevels = this.determineVisibleGridLevels(pixelRange, minPixelSpacing);

    for (const [levelName, level] of Object.entries(this.GRID_LEVELS)) {
      if (!visibleLevels.includes(levelName)) continue;

      const ticksPerDivision = this.ppq / level.division;
      const startDivision = Math.floor(startTick / ticksPerDivision);
      const endDivision = Math.ceil(endTick / ticksPerDivision);

      for (let i = startDivision; i <= endDivision; i++) {
        const tick = i * ticksPerDivision;
        if (tick >= startTick && tick <= endTick) {
          gridLines.push({
            tick,
            x: this.ticksToPixels(tick - startTick, stepWidth),
            level: levelName,
            style: level,
            division: level.division,
            isBarLine: level.division === 1,
            isBeatLine: level.division === 4
          });
        }
      }
    }

    return gridLines.sort((a, b) => a.tick - b.tick);
  }

  /**
   * Determines which grid levels should be visible based on zoom
   * @param {number} pixelRange
   * @param {number} minSpacing
   * @returns {Array} Visible level names
   */
  determineVisibleGridLevels(pixelRange, minSpacing) {
    const visible = [];

    // Always show bars
    visible.push('bars');

    // Show beats if there's enough space
    const beatSpacing = pixelRange / (pixelRange / this.ppq * 4);
    if (beatSpacing >= minSpacing) visible.push('beats');

    // Show finer divisions based on zoom level
    const eighthSpacing = beatSpacing / 2;
    if (eighthSpacing >= minSpacing) visible.push('eighths');

    const sixteenthSpacing = eighthSpacing / 2;
    if (sixteenthSpacing >= minSpacing) visible.push('sixteenths');

    const thirtySecondSpacing = sixteenthSpacing / 2;
    if (thirtySecondSpacing >= minSpacing) visible.push('thirtySeconds');

    return visible;
  }

  // ========================= NOTE POSITIONING =========================

  /**
   * Converts a note's time property to precise tick position
   * @param {Object} note - Note object with time property
   * @returns {number} Precise tick position
   */
  noteToTicks(note) {
    // Note.time is in steps (16th note based)
    return this.stepsToTicks(note.time);
  }

  /**
   * Creates a note object with precise timing
   * @param {number} ticks - Motor tick position
   * @param {string} pitch - Note pitch (e.g., 'C4')
   * @param {number} velocity - Note velocity (0-1)
   * @param {number} durationTicks - Duration in ticks
   * @returns {Object} Note object
   */
  createPreciseNote(ticks, pitch, velocity = 1, durationTicks = null) {
    // Convert back to steps for compatibility with existing system
    const steps = this.ticksToSteps(ticks);
    const duration = durationTicks ? this.ticksToSteps(durationTicks) : 1;

    return {
      time: steps,
      pitch,
      velocity,
      duration,
      // Store motor precision data for advanced features
      _motorTicks: ticks,
      _durationTicks: durationTicks || this.stepsToTicks(1)
    };
  }

  /**
   * Updates note timing with motor precision
   * @param {Object} note - Existing note
   * @param {number} newTicks - New tick position
   * @returns {Object} Updated note
   */
  updateNoteTiming(note, newTicks) {
    return {
      ...note,
      time: this.ticksToSteps(newTicks),
      _motorTicks: newTicks
    };
  }

  // ========================= UTILITY METHODS =========================

  /**
   * Gets the snap resolution for current UI mode
   * @returns {number} Ticks per snap unit
   */
  getUISnapResolution() {
    return this.ppq / 8; // 1/32 note resolution
  }

  /**
   * Gets BPM-adjusted timing information
   * @param {number} bpm
   */
  updateBPM(bpm) {
    this.bpm = bpm;
  }

  /**
   * Formats tick position as musical notation
   * @param {number} ticks
   * @returns {string} Musical position (e.g., "1:2:3")
   */
  formatTicksAsMusicalTime(ticks) {
    const ticksPerBar = this.ppq * this.timeSignature[0];
    const ticksPerBeat = this.ppq;
    const ticksPerSixteenth = this.ppq / 4;

    const bar = Math.floor(ticks / ticksPerBar) + 1;
    const remainderAfterBars = ticks % ticksPerBar;
    const beat = Math.floor(remainderAfterBars / ticksPerBeat) + 1;
    const remainderAfterBeats = remainderAfterBars % ticksPerBeat;
    const sixteenth = Math.floor(remainderAfterBeats / ticksPerSixteenth) + 1;

    return `${bar}:${beat}:${sixteenth}`;
  }

  /**
   * Debug information about current precision setup
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    return {
      bpm: this.bpm,
      ppq: this.ppq,
      uiPrecision: `1/${this.UI_PRECISION}`,
      motorPrecision: `1/${this.MOTOR_PRECISION * 4}`, // Quarter note subdivision
      ticksPerStep: this.ppq / 4,
      ticksPer32nd: this.ppq / 8,
      secondsPerTick: (60 / this.bpm) / this.ppq
    };
  }
}