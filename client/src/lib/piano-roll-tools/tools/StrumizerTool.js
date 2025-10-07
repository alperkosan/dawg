/**
 * STRUMIZER TOOL
 *
 * Create guitar-style strumming from chord notes
 * Adds realistic timing variations between notes
 */

import { generateNoteId } from '../../../utils/noteUtils';

export class StrumizerTool {
  constructor(settings) {
    this.settings = settings;
  }

  /**
   * Apply strumming to selected notes (chord)
   */
  strumNotes(selectedNotes) {
    if (selectedNotes.length === 0) return { action: 'none' };

    const { strumSpeed, direction, humanize } = this.settings;

    // Sort notes by pitch
    const sortedNotes = [...selectedNotes].sort((a, b) => {
      return direction === 'down' ? b.pitch - a.pitch : a.pitch - b.pitch;
    });

    // Find common start time
    const baseTime = Math.min(...sortedNotes.map(n => n.time));
    const baseDuration = Math.max(...sortedNotes.map(n => n.duration));

    const strumedNotes = sortedNotes.map((note, index) => {
      // Calculate delay with humanization
      const baseDelay = index * strumSpeed;
      const randomDelay = humanize > 0 ? (Math.random() - 0.5) * humanize * strumSpeed : 0;
      const totalDelay = baseDelay + randomDelay;

      // Slight velocity variation for realism
      const velocityVariation = humanize > 0 ? (Math.random() - 0.5) * humanize * 0.2 : 0;

      return {
        id: generateNoteId(),
        pitch: note.pitch,
        time: baseTime + totalDelay,
        duration: baseDuration - totalDelay, // Compensate for delay
        velocity: Math.max(0.1, Math.min(1.0, note.velocity + velocityVariation))
      };
    });

    return {
      action: 'replace',
      remove: selectedNotes,
      add: strumedNotes
    };
  }

  /**
   * Apply advanced strumming patterns
   */
  applyPattern(selectedNotes, patternName = 'basic') {
    if (selectedNotes.length === 0) return { action: 'none' };

    const patterns = {
      basic: [0, 1, 2, 3], // Simple down strum
      updown: [0, 1, 2, 3, 2, 1], // Down-up strum
      fingerstyle: [0, 2, 1, 3], // Fingerpicking pattern
      flamenco: [0, 0.5, 1, 1.5, 2] // Fast flamenco strum
    };

    const pattern = patterns[patternName] || patterns.basic;
    const sortedNotes = [...selectedNotes].sort((a, b) => a.pitch - b.pitch);
    const baseTime = Math.min(...sortedNotes.map(n => n.time));

    const strumedNotes = [];

    pattern.forEach(beatOffset => {
      sortedNotes.forEach((note, index) => {
        const delay = index * this.settings.strumSpeed;

        strumedNotes.push({
          id: generateNoteId(),
          pitch: note.pitch,
          time: baseTime + beatOffset + delay,
          duration: 0.25,
          velocity: note.velocity
        });
      });
    });

    return {
      action: 'replace',
      remove: selectedNotes,
      add: strumedNotes
    };
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
}

export default StrumizerTool;
