/**
 * Flip Tool - Mirror notes horizontally (time) or vertically (pitch)
 * Creative tool for generating variations and inversions
 */

import { generateNoteId } from '@/utils/noteUtils';

export class FlipTool {
  constructor() {
    this.settings = {
      direction: 'vertical', // 'horizontal', 'vertical', 'both'
      pivotMode: 'auto'      // 'auto' (center), 'first', 'last', 'custom'
    };
  }

  /**
   * Flip notes horizontally (mirror in time)
   * @param {Array} selectedNotes - Notes to flip
   * @returns {Array} - Flipped notes
   */
  flipHorizontal(selectedNotes) {
    if (selectedNotes.length === 0) return [];

    // Find time boundaries
    const times = selectedNotes.map(n => n.time);
    const durations = selectedNotes.map(n => n.duration);
    const endTimes = selectedNotes.map((n, i) => times[i] + durations[i]);

    const minTime = Math.min(...times);
    const maxTime = Math.max(...endTimes);
    const centerTime = (minTime + maxTime) / 2;

    // Flip around center
    return selectedNotes.map(note => {
      const noteEnd = note.time + note.duration;
      const distanceFromCenter = note.time - centerTime;
      const flippedTime = centerTime - distanceFromCenter - note.duration;

      return {
        ...note,
        id: generateNoteId(),
        time: flippedTime
      };
    });
  }

  /**
   * Flip notes vertically (mirror in pitch)
   * @param {Array} selectedNotes - Notes to flip
   * @returns {Array} - Flipped notes
   */
  flipVertical(selectedNotes) {
    if (selectedNotes.length === 0) return [];

    // Find pitch boundaries
    const pitches = selectedNotes.map(n => n.pitch);
    const minPitch = Math.min(...pitches);
    const maxPitch = Math.max(...pitches);
    const centerPitch = (minPitch + maxPitch) / 2;

    // Flip around center
    return selectedNotes.map(note => {
      const distanceFromCenter = note.pitch - centerPitch;
      const flippedPitch = Math.round(centerPitch - distanceFromCenter);

      return {
        ...note,
        id: generateNoteId(),
        pitch: Math.max(0, Math.min(127, flippedPitch))
      };
    });
  }

  /**
   * Flip notes both horizontally and vertically
   * @param {Array} selectedNotes - Notes to flip
   * @returns {Array} - Flipped notes
   */
  flipBoth(selectedNotes) {
    const horizontalFlipped = this.flipHorizontal(selectedNotes);
    return this.flipVertical(horizontalFlipped);
  }

  /**
   * Apply flip effect to selected notes
   * @param {Array} selectedNotes - Notes to flip
   * @returns {Object} - { action: 'replace', notes: [...] }
   */
  flipNotes(selectedNotes) {
    if (!selectedNotes || selectedNotes.length === 0) {
      return { action: 'none', notes: [] };
    }

    const { direction } = this.settings;
    let flippedNotes = [];

    switch (direction) {
      case 'horizontal':
        flippedNotes = this.flipHorizontal(selectedNotes);
        break;
      case 'vertical':
        flippedNotes = this.flipVertical(selectedNotes);
        break;
      case 'both':
        flippedNotes = this.flipBoth(selectedNotes);
        break;
      default:
        flippedNotes = this.flipVertical(selectedNotes); // Default to vertical
    }

    return {
      action: 'replace',
      notes: flippedNotes
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
      name: 'Flip',
      description: 'Mirror notes horizontally (time) or vertically (pitch)',
      requiresSelection: true,
      settings: {
        direction: {
          type: 'select',
          options: ['horizontal', 'vertical', 'both'],
          default: 'vertical'
        },
        pivotMode: {
          type: 'select',
          options: ['auto', 'first', 'last'],
          default: 'auto'
        }
      }
    };
  }
}
