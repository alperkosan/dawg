/**
 * Flam Tool - Creates quick note repetitions at the beginning
 * Perfect for realistic drum programming and percussion
 */

import { generateNoteId } from '@/utils/noteUtils';

export class FlamTool {
  constructor() {
    this.settings = {
      repeats: 3,           // Number of flam notes (2-8)
      spacing: 0.05,        // Time between flams in beats (0.01-0.25)
      velocityDecay: 0.15,  // How much velocity decreases per flam (0-0.5)
      reverse: false        // Reverse direction (crescendo vs decrescendo)
    };
  }

  /**
   * Apply flam effect to selected notes
   * @param {Array} selectedNotes - Notes to apply flam to
   * @returns {Object} - { action: 'replace', notes: [...] }
   */
  flamNotes(selectedNotes) {
    if (!selectedNotes || selectedNotes.length === 0) {
      return { action: 'none', notes: [] };
    }

    const { repeats, spacing, velocityDecay, reverse } = this.settings;
    const flammedNotes = [];

    selectedNotes.forEach(note => {
      // Calculate total flam duration
      const totalFlamDuration = (repeats - 1) * spacing;

      // Create flam notes before the main note
      for (let i = 0; i < repeats; i++) {
        const flamOffset = i * spacing;
        const velocityMultiplier = reverse
          ? 1 - ((repeats - 1 - i) * velocityDecay)  // Crescendo
          : 1 - (i * velocityDecay);                  // Decrescendo

        const flamNote = {
          id: generateNoteId(),
          pitch: note.pitch,
          time: note.time - totalFlamDuration + flamOffset,
          duration: Math.min(spacing * 0.8, note.duration), // Short duration
          velocity: Math.max(0.2, Math.min(1.0, note.velocity * velocityMultiplier))
        };

        flammedNotes.push(flamNote);
      }

      // Keep original note at the end with full velocity
      flammedNotes.push({
        ...note,
        id: generateNoteId(),
        velocity: note.velocity
      });
    });

    return {
      action: 'replace',
      notes: flammedNotes
    };
  }

  /**
   * Update tool settings
   * @param {Object} newSettings - New settings to merge
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get tool settings
   * @returns {Object} - Current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Get tool info
   * @returns {Object} - Tool information
   */
  static getInfo() {
    return {
      name: 'Flam',
      description: 'Creates quick note repetitions at the beginning for realistic drums',
      requiresSelection: true,
      settings: {
        repeats: { type: 'range', min: 2, max: 8, default: 3 },
        spacing: { type: 'range', min: 0.01, max: 0.25, default: 0.05 },
        velocityDecay: { type: 'range', min: 0, max: 0.5, default: 0.15 },
        reverse: { type: 'boolean', default: false }
      }
    };
  }
}
