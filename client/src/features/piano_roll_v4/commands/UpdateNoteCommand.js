import { Command } from '../../../lib/commands/Command';
import { usePianoRollStore } from '../store/usePianoRollStore';

export class UpdateNoteCommand extends Command {
  constructor(noteId, newValues, oldValues) {
    super();

    this.name = 'UpdateNoteCommand'; // <-- BU SATIRI EKLE
    this.noteId = noteId;
    this.newValues = newValues; // Değişikliğin BİTMİŞ hali
    this.oldValues = oldValues; // Değişikliğin BAŞLAMADAN önceki hali
  }

  execute() {
    const { updateNote } = usePianoRollStore.getState();
    updateNote(this.noteId, this.newValues);
  }

  undo() {
    const { updateNote } = usePianoRollStore.getState();
    updateNote(this.noteId, this.oldValues);
  }
}