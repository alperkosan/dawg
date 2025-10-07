/**
 * CHOPPER TOOL
 *
 * Slice selected notes into smaller equal divisions
 * Perfect for creating rhythmic variations
 */

import { generateNoteId } from '../../../utils/noteUtils';

export class ChopperTool {
  constructor(settings) {
    this.settings = settings;
  }

  /**
   * Chop selected notes into divisions
   */
  chopNotes(selectedNotes) {
    const { divisions, preserveVelocity } = this.settings;
    const choppedNotes = [];

    selectedNotes.forEach(note => {
      const segmentDuration = note.duration / divisions;

      for (let i = 0; i < divisions; i++) {
        const newNote = {
          id: generateNoteId(),
          pitch: note.pitch,
          time: note.time + (i * segmentDuration),
          duration: segmentDuration,
          velocity: preserveVelocity ? note.velocity : (note.velocity * (1 - i * 0.05)) // Slight decay
        };
        choppedNotes.push(newNote);
      }
    });

    return {
      action: 'replace',
      remove: selectedNotes,
      add: choppedNotes
    };
  }

  /**
   * Chop with custom pattern (e.g., triplets, swing)
   */
  chopWithPattern(selectedNotes, pattern = 'equal') {
    const choppedNotes = [];

    const patterns = {
      equal: [1, 1, 1, 1], // 4 equal divisions
      triplet: [1, 1, 1], // 3 equal divisions
      swing: [1.5, 0.5, 1.5, 0.5], // Swing pattern
      dotted: [1.5, 0.5, 1, 1] // Dotted rhythm
    };

    const ratios = patterns[pattern] || patterns.equal;
    const totalRatio = ratios.reduce((sum, r) => sum + r, 0);

    selectedNotes.forEach(note => {
      let currentTime = note.time;

      ratios.forEach((ratio, i) => {
        const segmentDuration = (note.duration / totalRatio) * ratio;

        const newNote = {
          id: generateNoteId(),
          pitch: note.pitch,
          time: currentTime,
          duration: segmentDuration,
          velocity: note.velocity
        };

        choppedNotes.push(newNote);
        currentTime += segmentDuration;
      });
    });

    return {
      action: 'replace',
      remove: selectedNotes,
      add: choppedNotes
    };
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
}

export default ChopperTool;
