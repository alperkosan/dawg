/**
 * Randomizer Tool - Randomize note properties for creative variation
 * Useful for humanization and experimental patterns
 */

import { generateNoteId } from '@/utils/noteUtils';

export class RandomizerTool {
  constructor() {
    this.settings = {
      randomizeTiming: true,     // Randomize note start time
      timingAmount: 0.1,          // Max timing offset in beats (0-1)
      randomizeVelocity: true,    // Randomize note velocity
      velocityAmount: 0.2,        // Max velocity variation (0-1)
      randomizePitch: false,      // Randomize pitch
      pitchRange: 2,              // Max pitch shift in semitones (0-12)
      randomizeDuration: false,   // Randomize note duration
      durationAmount: 0.2,        // Max duration variation (0-1)
      seed: Date.now()            // Random seed for reproducible results
    };
  }

  /**
   * Seeded random number generator for reproducible randomization
   */
  seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Apply randomization to selected notes
   * @param {Array} selectedNotes - Notes to randomize
   * @returns {Object} - { action: 'replace', notes: [...] }
   */
  randomizeNotes(selectedNotes) {
    if (!selectedNotes || selectedNotes.length === 0) {
      return { action: 'none', notes: [] };
    }

    const {
      randomizeTiming, timingAmount,
      randomizeVelocity, velocityAmount,
      randomizePitch, pitchRange,
      randomizeDuration, durationAmount,
      seed
    } = this.settings;

    let currentSeed = seed;
    const randomizedNotes = [];

    selectedNotes.forEach(note => {
      const newNote = {
        ...note,
        id: generateNoteId()
      };

      // Randomize timing
      if (randomizeTiming) {
        const timingOffset = (this.seededRandom(currentSeed++) - 0.5) * 2 * timingAmount;
        newNote.time = Math.max(0, note.time + timingOffset);
      }

      // Randomize velocity
      if (randomizeVelocity) {
        const velocityOffset = (this.seededRandom(currentSeed++) - 0.5) * 2 * velocityAmount;
        newNote.velocity = Math.max(0.1, Math.min(1.0, note.velocity + velocityOffset));
      }

      // Randomize pitch
      if (randomizePitch) {
        const pitchOffset = Math.round((this.seededRandom(currentSeed++) - 0.5) * 2 * pitchRange);
        newNote.pitch = Math.max(0, Math.min(127, note.pitch + pitchOffset));
      }

      // Randomize duration
      if (randomizeDuration) {
        const durationMultiplier = 1 + (this.seededRandom(currentSeed++) - 0.5) * 2 * durationAmount;
        newNote.duration = Math.max(0.1, note.duration * durationMultiplier);
      }

      randomizedNotes.push(newNote);
    });

    return {
      action: 'replace',
      notes: randomizedNotes
    };
  }

  /**
   * Update tool settings
   * @param {Object} newSettings - New settings to merge
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };

    // Generate new seed if not provided
    if (!newSettings.seed) {
      this.settings.seed = Date.now();
    }
  }

  /**
   * Get tool settings
   * @returns {Object} - Current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Regenerate random seed
   */
  regenerateSeed() {
    this.settings.seed = Date.now();
  }

  /**
   * Get tool info
   * @returns {Object} - Tool information
   */
  static getInfo() {
    return {
      name: 'Randomizer',
      description: 'Randomize note timing, velocity, pitch, and duration for variation',
      requiresSelection: true,
      settings: {
        randomizeTiming: { type: 'boolean', default: true },
        timingAmount: { type: 'range', min: 0, max: 1, default: 0.1 },
        randomizeVelocity: { type: 'boolean', default: true },
        velocityAmount: { type: 'range', min: 0, max: 1, default: 0.2 },
        randomizePitch: { type: 'boolean', default: false },
        pitchRange: { type: 'range', min: 0, max: 12, default: 2 },
        randomizeDuration: { type: 'boolean', default: false },
        durationAmount: { type: 'range', min: 0, max: 1, default: 0.2 }
      }
    };
  }
}
