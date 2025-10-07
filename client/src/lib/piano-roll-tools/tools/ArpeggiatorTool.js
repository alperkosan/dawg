/**
 * ARPEGGIATOR TOOL
 *
 * Generate arpeggio patterns from selected notes
 * Supports multiple directions and octave spanning
 */

import { generateNoteId } from '../../../utils/noteUtils';

export class ArpeggiatorTool {
  constructor(settings) {
    this.settings = settings;
  }

  /**
   * Generate arpeggio from selected notes
   */
  arpeggiate(selectedNotes) {
    if (selectedNotes.length === 0) return { action: 'none' };

    const { pattern, octaves, speed, gate } = this.settings;

    // Sort notes by pitch
    const sortedNotes = [...selectedNotes].sort((a, b) => a.pitch - b.pitch);

    // Get base timing
    const baseTime = Math.min(...sortedNotes.map(n => n.time));
    const totalDuration = Math.max(...selectedNotes.map(n => n.time + n.duration)) - baseTime;

    // Generate note sequence based on pattern
    const sequence = this._generateSequence(sortedNotes, pattern, octaves);

    // Calculate how many times the sequence fits
    const notesPerBar = Math.floor(totalDuration / speed);
    const arpNotes = [];

    for (let i = 0; i < notesPerBar; i++) {
      const note = sequence[i % sequence.length];
      const noteDuration = speed * gate;

      arpNotes.push({
        id: generateNoteId(),
        pitch: note.pitch,
        time: baseTime + (i * speed),
        duration: noteDuration,
        velocity: note.velocity
      });
    }

    return {
      action: 'replace',
      remove: selectedNotes,
      add: arpNotes
    };
  }

  /**
   * Generate note sequence based on pattern
   */
  _generateSequence(notes, pattern, octaves) {
    const sequence = [];
    const baseNotes = [...notes];

    switch (pattern) {
      case 'up':
        for (let oct = 0; oct < octaves; oct++) {
          baseNotes.forEach(note => {
            sequence.push({
              ...note,
              pitch: note.pitch + (oct * 12)
            });
          });
        }
        break;

      case 'down':
        for (let oct = octaves - 1; oct >= 0; oct--) {
          [...baseNotes].reverse().forEach(note => {
            sequence.push({
              ...note,
              pitch: note.pitch + (oct * 12)
            });
          });
        }
        break;

      case 'updown':
        // Up
        for (let oct = 0; oct < octaves; oct++) {
          baseNotes.forEach(note => {
            sequence.push({
              ...note,
              pitch: note.pitch + (oct * 12)
            });
          });
        }
        // Down (skip last to avoid duplicate)
        for (let oct = octaves - 1; oct >= 0; oct--) {
          [...baseNotes].reverse().slice(oct === octaves - 1 ? 1 : 0).forEach(note => {
            sequence.push({
              ...note,
              pitch: note.pitch + (oct * 12)
            });
          });
        }
        break;

      case 'random':
        // Create pool of all possible notes
        const pool = [];
        for (let oct = 0; oct < octaves; oct++) {
          baseNotes.forEach(note => {
            pool.push({
              ...note,
              pitch: note.pitch + (oct * 12)
            });
          });
        }
        // Randomly shuffle
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        sequence.push(...pool);
        break;

      case 'chord':
        // Play all notes together, repeated
        sequence.push(...baseNotes);
        break;

      default:
        sequence.push(...baseNotes);
    }

    return sequence;
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
}

export default ArpeggiatorTool;
