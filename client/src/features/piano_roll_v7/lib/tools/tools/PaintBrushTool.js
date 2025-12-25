/**
 * PAINT BRUSH TOOL
 *
 * Draw notes by clicking or dragging on the piano roll grid
 */

import { generateNoteId } from '@/utils/noteUtils';

export class PaintBrushTool {
  constructor(settings) {
    this.settings = settings;
  }

  /**
   * Handle click to create a single note
   */
  handleClick(pitch, startTime, snapToGrid) {
    const snappedTime = snapToGrid ? this.snapTime(startTime) : startTime;
    const duration = this.settings.duration;

    const note = {
      id: generateNoteId(),
      pitch,
      time: snappedTime,
      duration,
      velocity: this.settings.velocity
    };

    return { action: 'add', notes: [note] };
  }

  /**
   * Handle drag to create multiple notes
   */
  handleDrag(startPitch, endPitch, startTime, endTime, snapToGrid) {
    const notes = [];

    // Determine pitch range
    const minPitch = Math.min(startPitch, endPitch);
    const maxPitch = Math.max(startPitch, endPitch);

    // Determine time range
    const minTime = Math.min(startTime, endTime);
    const maxTime = Math.max(startTime, endTime);

    const snappedStart = snapToGrid ? this.snapTime(minTime) : minTime;
    const snappedEnd = snapToGrid ? this.snapTime(maxTime) : maxTime;

    const duration = this.settings.duration;
    const timeSpan = snappedEnd - snappedStart || duration;

    // Create notes across pitch range
    for (let pitch = minPitch; pitch <= maxPitch; pitch++) {
      const note = {
        id: generateNoteId(),
        pitch,
        time: snappedStart,
        duration: Math.max(duration, timeSpan),
        velocity: this.settings.velocity
      };
      notes.push(note);
    }

    return { action: 'add', notes };
  }

  /**
   * Handle paint stroke (continuous drawing while dragging)
   */
  handlePaintStroke(points, snapToGrid) {
    const notes = [];
    const seenPositions = new Set();

    points.forEach(({ pitch, time }) => {
      const snappedTime = snapToGrid ? this.snapTime(time) : time;
      const posKey = `${pitch}_${snappedTime}`;

      // Avoid duplicate notes at same position
      if (seenPositions.has(posKey)) return;
      seenPositions.add(posKey);

      const note = {
        id: generateNoteId(),
        pitch,
        time: snappedTime,
        duration: this.settings.duration,
        velocity: this.settings.velocity
      };
      notes.push(note);
    });

    return { action: 'add', notes };
  }

  /**
   * Snap time to grid
   */
  snapTime(time) {
    const snapValue = 0.25; // Snap to 16th notes (quarter of a beat)
    return Math.round(time / snapValue) * snapValue;
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
}

export default PaintBrushTool;
