import { Command } from './Command';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { AudioContextService } from '../services/AudioContextService';

/**
 * Bir notayı silen ve bu işlemi geri alabilen komut.
 */
export class DeleteNoteCommand extends Command {
  constructor(instrumentId, noteToDelete) {
    super();
    this.instrumentId = instrumentId;
    this.note = noteToDelete; // Geri alabilmek için silinen notayı sakla
  }

  /**
   * Notayı state'ten kaldırır.
   */
  execute() {
    const activePatternId = useArrangementStore.getState().activePatternId;
    if (!activePatternId || !this.note) return;

    const currentNotes = useArrangementStore.getState().patterns[activePatternId].data[this.instrumentId] || [];
    const newNotes = currentNotes.filter(note => note.id !== this.note.id);

    useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
    usePlaybackStore.getState().updateLoopLength();
    AudioContextService.getAudioEngine()?.reschedule();
  }

  /**
   * Silinen notayı state'e geri ekler.
   */
  undo() {
    const activePatternId = useArrangementStore.getState().activePatternId;
    if (!activePatternId || !this.note) return;

    const currentNotes = useArrangementStore.getState().patterns[activePatternId].data[this.instrumentId] || [];
    const newNotes = [...currentNotes, this.note];

    useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
    usePlaybackStore.getState().updateLoopLength();
    AudioContextService.getAudioEngine()?.reschedule();
  }

  getDescription() {
    return `Delete note from instrument ${this.instrumentId}`;
  }
}