import { Command } from './Command';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import EventBus from '../core/EventBus.js';

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

    // Get current notes for this instrument
    const currentNotes = useArrangementStore.getState().patterns[activePatternId].data[this.instrumentId] || [];

    // Geri alma (undo) işlemi için notayı burada oluşturup sınıf içinde saklıyoruz.
    this.note = {
      id: `note_${this.step}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      time: this.step,
      pitch: 'C4',
      velocity: 1.0,
      duration: '16n'
    };

    const newNotes = [...currentNotes, this.note];
    useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
    usePlaybackStore.getState().updateLoopLength();

    // ✅ CRITICAL FIX: Notify PlaybackManager via EventBus
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
