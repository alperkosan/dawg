import { Command } from '../../../lib/commands/Command';
import { usePianoRollStore } from '../store/usePianoRollStore';

export class DeleteNoteCommand extends Command {
  constructor(note) {
    super();

    this.name = 'DeleteNoteCommand'; // <-- BU SATIRI EKLE
    this.note = note; // Silinecek notanın tam verisi
  }

  execute() {
    const { deleteNote } = usePianoRollStore.getState();
    deleteNote(this.note.id, false);
  }

  undo() {
    const { addNote } = usePianoRollStore.getState();
    // addNote, var olan bir notayı ID'si ile ekleyebilecek şekilde güncellenecek
    addNote(this.note, true);
  }
}