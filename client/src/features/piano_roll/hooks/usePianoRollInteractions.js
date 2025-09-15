import { useState, useCallback, useRef, useEffect } from 'react';
import { useGridSnapping } from './useGridSnapping';
import { usePianoRollStore } from '../store/usePianoRollStore';
import * as Tone from 'tone';

// ✅ NOTA ID GENERATOR
const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;

export const usePianoRollInteractions = ({
  notes,
  handleNotesChange,
  instrumentId,
  audioEngineRef,
  // Koordinat çevirim fonksiyonları
  noteToY,
  stepToX,
  xToStep,
  yToNote,
  // Grid boyutları
  stepWidth,
  keyHeight,
  gridWidth,
  gridHeight,
  totalKeys,
  // Container referansları
  gridContainerRef,
  keyboardWidth,
  velocityLaneHeight,
  viewport
}) => {
  console.log("audioRef");
  console.log(audioEngineRef);
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [interaction, setInteraction] = useState(null);
  const panState = useRef({ isPanning: false });
  
  // ✅ PIANO ROLL STORE'DAN SNAP AYARLARI AL
  const { activeTool, gridSnapValue, snapMode } = usePianoRollStore();
  
  // ✅ SNAPPING HOOK'U
  const snapping = useGridSnapping({ 
    enabled: true, 
    value: gridSnapValue, 
    mode: snapMode 
  });

  const { auditionNote } = audioEngineRef.current || {};
  // Store güncellemelerini ekle
  const handleNoteAdd = (note) => {
    onNotesChange([...notes, note]);
  };

  // ✅ MOUSE DOWN HANDLER
  const handleMouseDown = useCallback((e) => {
    if (e.altKey || e.button === 1) {
      // Pan mode
      panState.current = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        startScrollX: viewport.scrollLeft || 0,
        startScrollY: viewport.scrollTop || 0
      };
      return;
    }
    
    if (e.button === 2) return; // Sağ click için ayrı handler

    // ✅ GRID POZİSYONU HESAPLA
    const rect = gridContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left - keyboardWidth;
    const y = e.clientY - rect.top;
    const time = xToStep(x);
    const pitch = yToNote(y);
    
    // ✅ MEVCUT NOTA VAR MI KONTROL ET
    const clickedNote = notes.find(note => {
      const noteX = stepToX(note.time);
      const noteY = noteToY(note.pitch);
      const noteWidth = stepWidth * 2; // Min width
      const noteHeight = keyHeight;
      
      return (x >= noteX && x <= noteX + noteWidth && 
              y >= noteY && y <= noteY + noteHeight);
    });

    // ✅ ARAÇ TIPINE GÖRE İŞLEM
    switch (activeTool) {
      case 'selection':
        handleSelectionTool(e, { x, y, time, pitch }, clickedNote);
        break;
      case 'pencil':
        handlePencilTool(e, { x, y, time, pitch }, clickedNote);
        break;
      case 'eraser':
        if (clickedNote) {
          handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
        }
        break;
    }
  }, [activeTool, notes, viewport, gridContainerRef, keyboardWidth, handleNotesChange, 
      stepToX, stepWidth, keyHeight, noteToY, xToStep, yToNote]);

  // ✅ SELECTION TOOL HANDLER
  const handleSelectionTool = useCallback((e, gridPos, clickedNote) => {
    if (clickedNote) {
      // Nota seçimi
      if (e.shiftKey) {
        // Multi-select
        setSelectedNotes(prev => {
          const newSelection = new Set(prev);
          if (newSelection.has(clickedNote.id)) {
            newSelection.delete(clickedNote.id);
          } else {
            newSelection.add(clickedNote.id);
          }
          return newSelection;
        });
      } else if (!selectedNotes.has(clickedNote.id)) {
        setSelectedNotes(new Set([clickedNote.id]));
      }
      
      // Drag başlat
      setInteraction({
        type: 'drag',
        startPos: gridPos,
        selectedNoteIds: Array.from(selectedNotes.has(clickedNote.id) ? selectedNotes : new Set([clickedNote.id])),
        originalNotes: new Map()
      });
    } else {
      // Seçim rectanglesi başlat
      setSelectedNotes(new Set());
      setInteraction({
        type: 'marquee',
        startPos: gridPos,
        currentPos: gridPos
      });
    }
  }, [selectedNotes, setSelectedNotes]);

  // ✅ PENCIL TOOL HANDLER  
  const handlePencilTool = useCallback((e, gridPos, clickedNote) => {
    if (clickedNote) {
      // Mevcut notayı düzenle
      setSelectedNotes(new Set([clickedNote.id]));
      setInteraction({
        type: 'drag',
        startPos: gridPos,
        selectedNoteIds: [clickedNote.id],
        originalNotes: new Map([[clickedNote.id, { ...clickedNote }]])
      });
    } else {
      // Yeni nota oluştur
      const snappedTime = snapping.snapTime(gridPos.time);
      const pitch = gridPos.pitch;
      
      // ✅ AUDIO PREVIEW
      if (audioEngineRef.current && instrumentId) {
        audioEngineRef.current.auditionNoteOn(instrumentId, pitch, 0.8);
      }
      
      setInteraction({
        type: 'create',
        startPos: { ...gridPos, time: snappedTime },
        currentPos: { ...gridPos, time: snappedTime },
        pitch
      });
    }
  }, [snapping, audioEngineRef, instrumentId, setSelectedNotes]);

  // ✅ MOUSE MOVE HANDLER
  const handleMouseMove = useCallback((e) => {
    if (panState.current.isPanning) {
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      
      if (gridContainerRef.current) {
        gridContainerRef.current.scrollLeft = panState.current.startScrollX - dx;
        gridContainerRef.current.scrollTop = panState.current.startScrollY - dy;
      }
      return;
    }
    
    if (!interaction) return;
    
    const rect = gridContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left - keyboardWidth;
    const y = e.clientY - rect.top;
    const time = xToStep(x);
    const pitch = yToNote(y);
    const gridPos = { x, y, time, pitch };
    
    switch (interaction.type) {
      case 'create':
        handleCreateMove(gridPos);
        break;
      case 'drag':
        handleDragMove(gridPos);
        break;
      case 'marquee':
        handleMarqueeMove(gridPos);
        break;
    }
  }, [interaction, gridContainerRef, keyboardWidth, xToStep, yToNote]);

  // ✅ CREATE MOVE HANDLER
  const handleCreateMove = useCallback((gridPos) => {
    const duration = Math.max(1, gridPos.time - interaction.startPos.time);
    
    setInteraction(prev => ({ 
      ...prev, 
      currentPos: gridPos,
      duration: duration
    }));
  }, [interaction?.startPos]);

  // ✅ DRAG MOVE HANDLER
  const handleDragMove = useCallback((gridPos) => {
    const deltaTime = snapping.snapTime(gridPos.time - interaction.startPos.time);
    const deltaPitch = Math.round((gridPos.y - interaction.startPos.y) / keyHeight);
    
    const previewNotes = interaction.selectedNoteIds.map(noteId => {
      const originalNote = notes.find(n => n.id === noteId);
      if (!originalNote) return null;
      
      const newTime = Math.max(0, originalNote.time + deltaTime);
      const currentPitchIndex = parseInt(originalNote.pitch.slice(-1)) * 12 + 
                              ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                              .indexOf(originalNote.pitch.slice(0, -1));
      const newPitchIndex = Math.max(0, Math.min(127, currentPitchIndex + deltaPitch));
      const newPitch = `${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][newPitchIndex % 12]}${Math.floor(newPitchIndex / 12)}`;
      
      return {
        ...originalNote,
        time: newTime,
        pitch: newPitch
      };
    }).filter(Boolean);
    
    setInteraction(prev => ({ ...prev, previewNotes }));
  }, [interaction, snapping, keyHeight, notes]);

  // ✅ MARQUEE MOVE HANDLER
  const handleMarqueeMove = useCallback((gridPos) => {
    setInteraction(prev => ({ ...prev, currentPos: gridPos }));
    
    // Seçim alanındaki notaları bul
    const minX = Math.min(interaction.startPos.x, gridPos.x);
    const maxX = Math.max(interaction.startPos.x, gridPos.x);
    const minY = Math.min(interaction.startPos.y, gridPos.y);
    const maxY = Math.max(interaction.startPos.y, gridPos.y);
    
    const newSelection = new Set();
    notes.forEach(note => {
      const noteX = stepToX(note.time);
      const noteY = noteToY(note.pitch);
      
      if (noteX >= minX && noteX <= maxX && noteY >= minY && noteY <= maxY) {
        newSelection.add(note.id);
      }
    });
    
    setSelectedNotes(newSelection);
  }, [interaction?.startPos, notes, stepToX, noteToY]);

  // ✅ MOUSE UP HANDLER
  const handleMouseUp = useCallback((e) => {
    if (panState.current.isPanning) {
      panState.current.isPanning = false;
      return;
    }
    
    if (!interaction) return;
    
    switch (interaction.type) {
      case 'create':
        finishCreateNote();
        break;
      case 'drag':
        finishDragNotes();
        break;
      case 'marquee':
        // Marquee zaten move'da güncellendi
        break;
    }
    
    setInteraction(null);
  }, [interaction]);

  // ✅ CREATE NOTE FINISH
  const finishCreateNote = useCallback(() => {
    if (!interaction || !interaction.duration || interaction.duration <= 0) {
      // Audio preview'i durdur
      if (audioEngineRef.current && instrumentId && interaction?.pitch) {
        audioEngineRef.current.auditionNoteOff(instrumentId, interaction.pitch);
      }
      return;
    }
    
    const newNote = {
      id: generateNoteId(),
      time: interaction.startPos.time,
      pitch: interaction.pitch,
      duration: `${Math.max(1, Math.round(interaction.duration))}*16n`,
      velocity: 0.8
    };
    
    handleNotesChange([...notes, newNote]);
    setSelectedNotes(new Set([newNote.id]));
    
    // Audio preview'i durdur
    if (audioEngineRef.current && instrumentId) {
      audioEngineRef.current.auditionNoteOff(instrumentId, interaction.pitch);
    }
  }, [interaction, handleNotesChange, notes, audioEngineRef, instrumentId]);

  // ✅ DRAG NOTES FINISH
  const finishDragNotes = useCallback(() => {
    if (!interaction.previewNotes) return;
    
    const updatedNotes = notes.map(note => {
      const previewNote = interaction.previewNotes.find(p => p.id === note.id);
      return previewNote || note;
    });
    
    handleNotesChange(updatedNotes);
  }, [interaction?.previewNotes, notes, handleNotesChange]);

  // ✅ RESIZE START HANDLER
  const handleResizeStart = useCallback((note, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.clientX;
    const originalDuration = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
    
    const handleResizeMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSteps = deltaX / stepWidth;
      const newDuration = Math.max(1, originalDuration + deltaSteps);
      
      // Preview olarak göster
      setInteraction({
        type: 'resize',
        noteId: note.id,
        previewDuration: newDuration
      });
    };
    
    const handleResizeUp = () => {
      if (interaction?.type === 'resize') {
        const newDurationNotation = `${Math.round(interaction.previewDuration)}*16n`;
        const updatedNotes = notes.map(n => 
          n.id === note.id ? { ...n, duration: newDurationNotation } : n
        );
        handleNotesChange(updatedNotes);
      }
      
      setInteraction(null);
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };
    
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [stepWidth, notes, handleNotesChange, interaction]);

  // ✅ VELOCITY HANDLERS (Placeholder)
  const handleVelocityBarMouseDown = useCallback((note, e) => {
    // Velocity düzenleme implementasyonu
    console.log('Velocity editing:', note.id);
  }, []);

  const handleVelocityWheel = useCallback((e) => {
    // Velocity wheel implementasyonu  
    e.preventDefault();
    console.log('Velocity wheel');
  }, []);

  // ✅ GLOBAL MOUSE UP LISTENER
  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      if (panState.current.isPanning || interaction) {
        handleMouseUp(e);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleMouseUp, interaction]);

  // ✅ INTERACTION PROPS
  const interactionProps = {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onContextMenu: (e) => e.preventDefault()
  };

  return {
    interactionProps,
    selectedNotes,
    interaction,
    handleVelocityBarMouseDown,
    handleVelocityWheel,
    handleResizeStart
  };
};