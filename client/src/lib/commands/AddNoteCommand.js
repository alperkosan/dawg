import { Command } from './Command';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import EventBus from '../core/EventBus.js';
import { calculatePatternLoopLength } from '../utils/patternUtils.js';

/**
 * Bir enstrümana yeni bir nota ekleyen ve bu işlemi geri alabilen komut.
 */
export class AddNoteCommand extends Command {
  /**
   * @param {string} instrumentId - Notanın ekleneceği enstrümanın ID'si.
   * @param {number} step - Notanın ekleneceği adım (zaman).
   */
  constructor(instrumentId, step) {
    super();
    this.instrumentId = instrumentId;
    this.step = step;
    // Bu nota, execute() metodu çalıştığında oluşturulacak ve saklanacaktır.
    // Bu, undo işlemi için gereklidir.
    this.note = null; 
  }

  /**
   * Notayı oluşturur, state'i günceller ve ses motorunu yeniden zamanlar.
   */
  execute() {
    const activePatternId = useArrangementStore.getState().activePatternId;
    if (!activePatternId) return;

    const activePattern = useArrangementStore.getState().patterns[activePatternId];
    if (!activePattern) return;

    // Get current notes for this instrument
    const currentNotes = activePattern.data[this.instrumentId] || [];

    // ✅ FL STUDIO STYLE: Calculate pattern length and extend note to pattern length
    // Prefer explicit pattern length, otherwise fall back to calculated value
    const patternLengthInSteps =
      (typeof activePattern.length === 'number' && activePattern.length > 0)
        ? activePattern.length
        : (calculatePatternLoopLength(activePattern) || 64);
    
    // Convert step length to duration string
    // 1 step = 1/16 note, so patternLengthInSteps steps = patternLengthInSteps/16 bars
    // But duration is relative to the beat, so we need to calculate in beats
    // 16 steps = 1 bar = 4 beats (4/4 time) = 1 whole note
    // So: steps to beats = steps / 4, then beats to duration string
    const stepsToDuration = (steps) => {
      if (steps <= 0.25) return '32n';  // 1/32 note
      if (steps <= 0.5) return '32n';
      if (steps <= 1) return '16n';    // 1/16 note (1 step)
      if (steps <= 2) return '8n';     // 1/8 note (2 steps)
      if (steps <= 4) return '4n';     // 1/4 note (4 steps)
      if (steps <= 8) return '2n';     // 1/2 note (8 steps)
      if (steps <= 16) return '1n';    // Whole note (16 steps = 1 bar)
      // For longer durations, use multiples
      const bars = steps / 16;
      if (bars <= 2) return '2n';      // 2 bars = 2 whole notes
      if (bars <= 4) return '1n';      // 4 bars = 4 whole notes (but we'll use max '1n' and extend)
      // For very long patterns, use '1n' as base and note will extend to pattern length
      return '1n';
    };

    // ✅ SMART PITCH DETECTION: Use existing note's pitch if available
    // This ensures new notes match the instrument's configured pitch
    let defaultPitch = 'C4'; // Fallback
    let defaultVelocity = 100; // ✅ FIX: Use MIDI velocity range (0-127), default 100

    if (currentNotes.length > 0) {
      // Use pitch and velocity from the first existing note
      const firstNote = currentNotes[0];
      defaultPitch = firstNote.pitch || 'C4';
      
      // ✅ FIX: Normalize velocity to 0-127 range
      // Handle both 0-1 normalized and 0-127 MIDI formats
      if (firstNote.velocity !== undefined) {
        if (firstNote.velocity <= 1.0) {
          // 0-1 normalized format, convert to 0-127
          defaultVelocity = Math.round(firstNote.velocity * 127);
        } else {
          // Already in 0-127 format
          defaultVelocity = Math.round(firstNote.velocity);
        }
      } else {
        defaultVelocity = 100; // Default MIDI velocity
      }

      console.log(`📝 AddNoteCommand: Using template from existing notes:`, {
        pitch: defaultPitch,
        velocity: defaultVelocity
      });
    }
    
    const gateLengthInSteps = 1;
    const audioDuration = null;
    const noteStartStep = this.step;
    const ovalLengthInSteps = Math.max(
      gateLengthInSteps,
      patternLengthInSteps - noteStartStep
    );

    console.log(`📝 AddNoteCommand: New note for ${this.instrumentId} with 1-step gate`, {
      patternLengthInSteps,
      noteStartStep,
      gateLengthInSteps,
      ovalLengthInSteps
    });

    // Geri alma (undo) işlemi için notayı burada oluşturup sınıf içinde saklıyoruz.
    this.note = {
      id: `note_${this.step}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      time: this.step,
      pitch: defaultPitch,
      velocity: defaultVelocity,
      duration: audioDuration,
      length: ovalLengthInSteps,
      visualLength: gateLengthInSteps
    };

    const newNotes = [...currentNotes, this.note];
    useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
    usePlaybackStore.getState().updateLoopLength();

    // ✅ CRITICAL FIX: Notify PlaybackManager via EventBus
    console.log('📝 AddNoteCommand - Emitting NOTE_ADDED:', {
      patternId: activePatternId,
      instrumentId: this.instrumentId,
      note: this.note,
      totalNotes: newNotes.length
    });
    EventBus.emit('NOTE_ADDED', {
      patternId: activePatternId,
      instrumentId: this.instrumentId,
      note: this.note
    });
  }

  /**
   * Eklenen notayı state'ten kaldırır ve ses motorunu yeniden zamanlar.
   */
  undo() {
    const activePatternId = useArrangementStore.getState().activePatternId;
    if (!activePatternId || !this.note) return;

    const currentNotes = useArrangementStore.getState().patterns[activePatternId].data[this.instrumentId] || [];
    const newNotes = currentNotes.filter(note => note.id !== this.note.id);
    useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
    usePlaybackStore.getState().updateLoopLength();

    // ✅ FIX: Notify PlaybackManager via EventBus
    EventBus.emit('NOTE_REMOVED', {
      patternId: activePatternId,
      instrumentId: this.instrumentId,
      noteId: this.note.id
    });
  }

  /**
   * Komutun ne yaptığına dair kısa bir açıklama döndürür.
   * @returns {string}
   */
  getDescription() {
    return `Add note to instrument ${this.instrumentId} at step ${this.step}`;
  }
}
