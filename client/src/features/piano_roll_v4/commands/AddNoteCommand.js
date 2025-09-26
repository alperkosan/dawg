import { Command } from '../../../lib/commands/Command';
import { usePianoRollStore } from '../store/usePianoRollStore';

export class AddNoteCommand extends Command {
  constructor(noteData) {
    super();
    this.name = 'AddNoteCommand'; // <-- BU SATIRI EKLE
    this.note = { ...noteData }; // Nota verisinin bir kopyasını al
    this.noteId = null; // Execute sırasında atanacak
  }

  execute() {
    const { addNote } = usePianoRollStore.getState();
    // addNote artık oluşturulan ID'yi geri döndürecek şekilde güncellenecek
    this.noteId = addNote(this.note); 
  }

  undo() {
    if (this.noteId) {
      const { deleteNote } = usePianoRollStore.getState();
      deleteNote(this.noteId, false); // Bu silme işleminin kendisi undo yığınına eklenmemeli
    }
  }
}