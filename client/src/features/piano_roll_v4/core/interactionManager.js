/**
 * @file interactionManager.js
 * @description Canvas üzerindeki tüm kullanıcı etkileşimlerini yönetir.
 * (Nota seçme, taşıma, çizme, silme vb.)
 */
import { usePianoRollStore } from '../store/usePianoRollStore';

import commandManager from '../../../lib/commands/CommandManager'; 
import { AddNoteCommand } from '../commands/AddNoteCommand';
import { DeleteNoteCommand } from '../commands/DeleteNoteCommand';
import { UpdateNoteCommand } from '../commands/UpdateNoteCommand';

import { MUSIC_CONFIG } from '../config';

export class InteractionManager {
  constructor(viewport) {
    this.viewport = viewport;
    this.isDragging = false;
    this.dragType = 'none'; // 'none', 'select', 'move', 'resize-left', 'resize-right'

    this.activeNote = null; // Sürüklenen veya yeniden boyutlandırılan nota
    this.startPos = { x: 0, y: 0 };

    // Sürüklemenin başlangıç durumunu saklamak için yeni değişkenler
    this.dragOrigin = {
        noteInitial: null,      // Notanın sürükleme başındaki hali
        mouseInitialWorld: null // Farenin sürükleme başındaki dünya konumu
    };

    this.hoverState = { note: null, location: 'none' };
  }

  // === DURUM GÜNCELLEYİCİ ===
  
  /**
   * Farenin konumuna göre hover durumunu ve imleci günceller.
   */
  updateHoverState(event, canvas) {
    if (this.isDragging) return;

    const { setHoveredNote } = usePianoRollStore.getState(); // Store'dan action'ı al
    const worldPos = this.viewport.screenToWorld(event.offsetX, event.offsetY);
    const note = this.findNoteAt(worldPos.tick, worldPos.midiNote);

    // Grid üzerindeki pozisyonu store'a yaz
    setHoveredNote({ 
        tick: worldPos.tick, 
        midiNote: Math.floor(worldPos.midiNote) + 1 
    });
    
    let cursor = 'default';
    this.hoverState = { note: null, location: 'none' };

    if (note) {
      const noteStartPos = this.viewport.worldToScreen(note.tick, note.midiNote);
      const resizeHandleWidth = 8; // Piksel cinsinden tutmaç genişliği
      
      if (event.offsetX < noteStartPos.x + resizeHandleWidth) {
        cursor = 'ew-resize';
        this.hoverState = { note, location: 'left' };
      } else if (event.offsetX > noteStartPos.x + (note.duration * this.viewport.zoomX) - resizeHandleWidth) {
        cursor = 'ew-resize';
        this.hoverState = { note, location: 'right' };
      } else {
        cursor = 'pointer';
        this.hoverState = { note, location: 'body' };
      }
    }
    canvas.style.cursor = cursor;
  }

  // --- Olay Yöneticileri ---
  handleMouseDown(event) {
    const { currentTool, snapValue, addNote, deleteNote, selectNote, selectedNoteIds } = usePianoRollStore.getState();
    const worldPos = this.viewport.screenToWorld(event.offsetX, event.offsetY);
    const clickedNote = this.findNoteAt(worldPos.tick, worldPos.midiNote);

    this.isDragging = true;
    this.startPos = { x: event.offsetX, y: event.offsetY };

    // Hover state'e göre işlem yap
    const { note, location } = this.hoverState;

    switch (currentTool) {
      case 'pencil':
        if (!clickedNote) {
          const snappedTick = Math.floor(worldPos.tick / snapValue) * snapValue;
          const midiNote = Math.floor(worldPos.midiNote) + 1;
          const newNote = { tick: snappedTick, duration: snapValue, midiNote, velocity: 100 };
          commandManager.execute(new AddNoteCommand(newNote));
        }
        break;
      case 'eraser':
        if (note) {
          commandManager.execute(new DeleteNoteCommand(note));
        }        
        break;
      case 'select':
      default:
        if (note) {
            // BAŞLANGIÇ DURUMUNU KAYDET
            this.dragOrigin.noteInitial = { ...note };
            this.dragOrigin.mouseInitialWorld = worldPos;

            this.dragOrigin.isDraggingNote = true;

            if (location === 'left') {
              this.dragType = 'resize-left';
            } else if (location === 'right') {
              this.dragType = 'resize-right';
            } else {
              this.dragType = 'move';
            }

            this.activeNote = note;


            if (!selectedNoteIds.has(note.id)) {
              selectNote(note.id, event.ctrlKey || event.metaKey);
            }
        } else {
          this.dragType = 'select';
          if (!(event.ctrlKey || event.metaKey)) {
            usePianoRollStore.getState().clearSelection();
          }
        }
        break;
    }
  }

  handleMouseMove(event) {
    if (!this.isDragging) {
      this.updateHoverState(event, event.target);
      return;
    }

    const { currentTool, snapValue, updateNote } = usePianoRollStore.getState();
    const currentWorldPos = this.viewport.screenToWorld(event.offsetX, event.offsetY);

    if (currentTool === 'select' && this.dragOrigin.noteInitial) {
      const { noteInitial, mouseInitialWorld } = this.dragOrigin;

      // Toplam farkı her zaman ilk başlangıç noktasına göre hesapla
      const totalTickDelta = currentWorldPos.tick - mouseInitialWorld.tick;
      const totalMidiDelta = Math.round(currentWorldPos.midiNote) - Math.round(mouseInitialWorld.midiNote);

      switch (this.dragType) {
        case 'move': {
          const newTick = noteInitial.tick + totalTickDelta;
          const newMidi = noteInitial.midiNote + totalMidiDelta;

          // Yeni pozisyonu snap değerine hizala
          const snappedTick = Math.round(newTick / snapValue) * snapValue;
          updateNote(noteInitial.id, { tick: snappedTick, midiNote: newMidi });
          break;
        }
        case 'resize-right': {
          const newDuration = noteInitial.duration + totalTickDelta;
          
          // Yeni süreyi snap değerine hizala
          const snappedDuration = Math.round(newDuration / snapValue) * snapValue;
          updateNote(noteInitial.id, { duration: snappedDuration });
          break;
        }
        case 'resize-left': {
          const newTick = noteInitial.tick + totalTickDelta;
          
          // Yeni başlangıcı snap değerine hizala
          const snappedTick = Math.round(newTick / snapValue) * snapValue;
          const tickChange = snappedTick - noteInitial.tick;
          const newDuration = noteInitial.duration - tickChange;

          updateNote(noteInitial.id, { tick: snappedTick, duration: newDuration });
          break;
        }
      }
    }
  }

  handleMouseUp() {
    if (this.dragOrigin.isDraggingNote) {
        const { notes } = usePianoRollStore.getState();
        const finalNoteState = notes[this.dragOrigin.noteInitial.id];
        
        // Sadece notanın durumu değiştiyse komut yığınına ekle
        if (finalNoteState.tick !== this.dragOrigin.noteInitial.tick || 
            finalNoteState.duration !== this.dragOrigin.noteInitial.duration ||
            finalNoteState.midiNote !== this.dragOrigin.noteInitial.midiNote) {
            
            const oldValues = {
                tick: this.dragOrigin.noteInitial.tick,
                duration: this.dragOrigin.noteInitial.duration,
                midiNote: this.dragOrigin.noteInitial.midiNote,
            };
            const newValues = {
                tick: finalNoteState.tick,
                duration: finalNoteState.duration,
                midiNote: finalNoteState.midiNote,
            };

            commandManager.execute(new UpdateNoteCommand(finalNoteState.id, newValues, oldValues));
        }
    }
   this.isDragging = false;
    this.dragOrigin = { noteInitial: null, isDraggingNote: false };
  }

  // Fare canvas'tan ayrıldığında hover durumunu temizle
  handleMouseLeave() {
    usePianoRollStore.getState().setHoveredNote(null);
  }

  // --- Yardımcı Fonksiyonlar ---

  /**
   * Verilen dünya koordinatlarındaki notayı bulur.
   */
  findNoteAt(tick, midi) {
    const { notes } = usePianoRollStore.getState();
    const roundedMidi = Math.floor(midi) +1;

    // Notları tersten arayarak üsttekini önce buluruz
    const noteIds = Object.keys(notes).reverse();
    for (const id of noteIds) {
      const note = notes[id];
      if (
        roundedMidi === note.midiNote &&
        tick >= note.tick &&
        tick <= note.tick + note.duration
      ) {
        return note;
      }
    }
    return null;
  }
}