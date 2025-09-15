import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { CoordinateConverter } from '../utils/coordinateUtils'; //
import { usePianoRollStore } from '../store/usePianoRollStore';
import * as Tone from 'tone';

const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;

export const usePianoRollInteractions = ({
  notes,
  handleNotesChange,
  instrumentId,
  audioEngineRef,
  stepWidth,
  keyHeight,
  gridContainerRef,
  keyboardWidth
}) => {
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [interaction, setInteraction] = useState(null);
  const panState = useRef({ isPanning: false });
  
  const { activeTool, gridSnapValue, lastUsedDuration, setLastUsedDuration } = usePianoRollStore();
  
  // Koordinat converter'ını her render'da en güncel boyutlarla oluşturuyoruz.
  const converter = useMemo(() => new CoordinateConverter(stepWidth, keyHeight, keyboardWidth), [stepWidth, keyHeight, keyboardWidth]);

  //--- MOUSE DOWN (Tıklama) ---

  const handleMouseDown = useCallback((e) => {
    const container = gridContainerRef.current;
    if (!container) return;

    if (e.altKey || e.button === 1) {
      panState.current = { isPanning: true, startX: e.clientX, startY: e.clientY, startScrollX: container.scrollLeft, startScrollY: container.scrollTop };
      return;
    }
    if (e.button === 2) return;

    const rect = container.getBoundingClientRect();
    const { x, y } = converter.mouseToGrid(e.clientX, e.clientY, rect, container.scrollLeft, container.scrollTop);
    const time = converter.xToStep(x);
    const pitch = converter.yToPitch(y);
    const snapSteps = Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds();
    const snappedTime = converter.snapTime(time, snapSteps);

    const clickedNote = notes.find(note => {
      const noteX = converter.stepToX(note.time);
      const noteY = converter.pitchToY(note.pitch);
      const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
      const noteWidth = converter.stepToX(durationInSteps);
      return (x >= noteX && x < noteX + noteWidth && y >= noteY && y < noteY + keyHeight);
    });
    
    // DÜZELTME: Başlangıç anı ve koordinatlarını saklıyoruz
    const interactionData = {
      startPos: { x, y, time: snappedTime, pitch },
      startTime: Date.now(),
      startClientX: e.clientX,
      startClientY: e.clientY,
    };

    switch (activeTool) {
      case 'selection': handleSelectionTool(e, interactionData, clickedNote); break;
      case 'pencil': handlePencilTool(e, interactionData, clickedNote); break;
      case 'eraser': if (clickedNote) handleNotesChange(notes.filter(n => n.id !== clickedNote.id)); break;
    }
  }, [activeTool, notes, converter, gridContainerRef, handleNotesChange, keyHeight, gridSnapValue]);

  const handleSelectionTool = useCallback((e, interactionData, clickedNote) => {
    if (clickedNote) {
      const currentSelection = new Set(selectedNotes);
      if (e.shiftKey) {
        currentSelection.has(clickedNote.id) ? currentSelection.delete(clickedNote.id) : currentSelection.add(clickedNote.id);
      } else if (!currentSelection.has(clickedNote.id)) {
        currentSelection.clear();
        currentSelection.add(clickedNote.id);
      }
      setSelectedNotes(currentSelection);
      setInteraction({ ...interactionData, type: 'drag', notes: notes.filter(n => currentSelection.has(n.id)).map(n => ({...n, originalTime: n.time, originalPitch: n.pitch})) });
    } else {
      setSelectedNotes(new Set());
      setInteraction({ ...interactionData, type: 'marquee', currentPos: interactionData.startPos });
    }
  }, [selectedNotes, notes]);

  const handlePencilTool = useCallback((e, interactionData, clickedNote) => {
    if (clickedNote) {
      setSelectedNotes(new Set([clickedNote.id]));
      setInteraction({ ...interactionData, type: 'drag', notes: [{...clickedNote, originalTime: clickedNote.time, originalPitch: clickedNote.pitch}] });
    } else {
      audioEngineRef.current?.auditionNoteOn(instrumentId, interactionData.startPos.pitch, 0.8);
      setInteraction({ ...interactionData, type: 'create', pitch: interactionData.startPos.pitch });
    }
  }, [audioEngineRef, instrumentId]);
  
  //--- MOUSE MOVE (Sürükleme) ---
  const handleMouseMove = useCallback((e) => {
    const container = gridContainerRef.current;
    if (!container) return;

    if (panState.current.isPanning) {
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      container.scrollLeft = panState.current.startScrollX - dx;
      container.scrollTop = panState.current.startScrollY - dy;
      return;
    }
    if (!interaction) return;
    
    const rect = container.getBoundingClientRect();
    const { x, y } = converter.mouseToGrid(e.clientX, e.clientY, rect, container.scrollLeft, container.scrollTop); //
    const gridPos = { x, y, time: converter.xToStep(x), pitch: converter.yToPitch(y) }; //

    switch (interaction.type) {
      case 'create': handleCreateMove(gridPos); break;
      case 'drag': handleDragMove(gridPos); break;
      case 'marquee': handleMarqueeMove(gridPos); break;
    }
  }, [interaction, converter, gridContainerRef]);

  // --- TAMAMLANMIŞ FONKSİYONLAR ---
  const handleCreateMove = useCallback((gridPos) => {
    const snapSteps = Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds();
    const duration = Math.max(snapSteps, gridPos.time - interaction.startPos.time);
    const snappedDuration = converter.snapTime(duration, snapSteps); //
    const durationNotation = Tone.Time(snappedDuration * Tone.Time('16n').toSeconds()).toNotation();
    
    const previewNote = { id: 'preview', time: interaction.startPos.time, pitch: interaction.pitch, duration: durationNotation, velocity: 0.8 };
    setInteraction(prev => ({ ...prev, previewNote }));
  }, [interaction, converter, gridSnapValue]);

  const handleDragMove = useCallback((gridPos) => {
    const snapSteps = Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds();
    const timeDelta = gridPos.time - interaction.startPos.time;
    const snappedTimeDelta = converter.snapTime(timeDelta, snapSteps); //
    
    const yDelta = gridPos.y - interaction.startPos.y;
    const pitchDelta = Math.round(yDelta / keyHeight);
    
    const previewNotes = interaction.notes.map(note => {
      const originalPitchIndex = converter.pitchToY(note.originalPitch) / keyHeight;
      const newPitchY = (originalPitchIndex * keyHeight) + (pitchDelta * keyHeight);
      
      return { ...note, time: Math.max(0, note.originalTime + snappedTimeDelta), pitch: converter.yToPitch(newPitchY) }; //
    });
    setInteraction(prev => ({ ...prev, previewNotes }));
  }, [interaction, converter, keyHeight, gridSnapValue]);

  const handleMarqueeMove = useCallback((gridPos) => {
    const { x: startX, y: startY } = interaction.startPos;
    const minX = Math.min(startX, gridPos.x);
    const maxX = Math.max(startX, gridPos.x);
    const minY = Math.min(startY, gridPos.y);
    const maxY = Math.max(startY, gridPos.y);

    const newSelection = new Set();
    notes.forEach(note => {
      const noteX = converter.stepToX(note.time); //
      const noteY = converter.pitchToY(note.pitch); //
      if (noteX >= minX && noteX < maxX && noteY >= minY && noteY < maxY) {
        newSelection.add(note.id);
      }
    });
    setSelectedNotes(newSelection);
    setInteraction(prev => ({ ...prev, currentPos: gridPos }));
  }, [interaction, notes, converter]);

  //--- MOUSE UP (Bırakma) ---
  const handleMouseUp = useCallback((e) => {
    if (panState.current.isPanning) {
      panState.current.isPanning = false;
      return;
    }
    if (!interaction) return;
    
    if (interaction.type === 'create') {
      // Bırakma işlemini event bilgisiyle birlikte çağır
      finishCreateNote(e);
    } else if (interaction.type === 'drag') {
      finishDragNotes();
    }
    
    setInteraction(null);
  }, [interaction, notes, handleNotesChange, audioEngineRef, instrumentId, lastUsedDuration, setLastUsedDuration]);

  const finishCreateNote = useCallback((e) => {
    if (interaction.pitch) audioEngineRef.current?.auditionNoteOff(instrumentId, interaction.pitch);

    const TAP_THRESHOLD_MS = 200;
    const TAP_THRESHOLD_PIXELS = 5;
    
    const timeElapsed = Date.now() - interaction.startTime;
    const distanceDragged = Math.hypot(e.clientX - interaction.startClientX, e.clientY - interaction.startClientY);
    
    const isTap = timeElapsed < TAP_THRESHOLD_MS && distanceDragged < TAP_THRESHOLD_PIXELS;
    
    let newNote;
    if (isTap) {
        // Hızlı tıklama: Varsayılan uzunlukta bir nota oluştur
        newNote = { id: generateNoteId(), time: interaction.startPos.time, pitch: interaction.pitch, duration: lastUsedDuration, velocity: 0.8 };
    } else if (interaction.previewNote) {
        // Sürükleme: Önizlemedeki notayı oluştur
        newNote = { ...interaction.previewNote, id: generateNoteId() };
        setLastUsedDuration(newNote.duration);
    }
    
    if (newNote) {
        handleNotesChange([...notes, newNote]);
        setSelectedNotes(new Set([newNote.id]));
    }
  }, [interaction, notes, handleNotesChange, audioEngineRef, instrumentId, lastUsedDuration, setLastUsedDuration]);
  
  const finishDragNotes = useCallback(() => {
    if (!interaction.previewNotes) return;
    const updates = new Map(interaction.previewNotes.map(n => [n.id, { time: n.time, pitch: n.pitch }]));
    handleNotesChange(notes.map(n => updates.has(n.id) ? { ...n, ...updates.get(n.id) } : n));
  }, [interaction, notes, handleNotesChange]);

  useEffect(() => {
    const upHandler = (e) => { if (panState.current.isPanning || interaction) handleMouseUp(e); };
    window.addEventListener('mouseup', upHandler);
    return () => window.removeEventListener('mouseup', upHandler);
  }, [handleMouseUp, interaction]);

  /**
   * Bir notanın kenarından tutulup yeniden boyutlandırılması (resize) eylemini başlatır.
   */
  const handleResizeStart = useCallback((noteToResize, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const originalDurationSteps = Tone.Time(noteToResize.duration).toSeconds() / Tone.Time('16n').toSeconds();
    const snapSteps = Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds();

    const handleResizeMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // DİKKAT: Burada deltaX'i (piksel farkı) step'e çevirmek için converter'a değil, doğrudan stepWidth'e böleriz.
      const deltaSteps = deltaX / stepWidth;
      const newDurationSteps = Math.max(snapSteps, originalDurationSteps + deltaSteps);
      const snappedDurationSteps = Math.round(newDurationSteps / snapSteps) * snapSteps;
      const newDurationNotation = Tone.Time(snappedDurationSteps * Tone.Time('16n').toSeconds()).toNotation();

      // Etkileşimi 'resizing' olarak ayarla ve önizlemeyi göster
      setInteraction({
        type: 'resizing',
        previewNote: { ...noteToResize, duration: newDurationNotation }
      });
    };

    const handleResizeUp = (upEvent) => {
      const deltaX = upEvent.clientX - startX;
      const deltaSteps = deltaX / stepWidth;
      const finalDurationSteps = Math.max(snapSteps, Math.round((originalDurationSteps + deltaSteps) / snapSteps) * snapSteps);
      const finalDurationNotation = Tone.Time(finalDurationSteps * Tone.Time('16n').toSeconds()).toNotation();

      if (noteToResize.duration !== finalDurationNotation) {
        handleNotesChange(notes.map(n => n.id === noteToResize.id ? { ...n, duration: finalDurationNotation } : n));
        setLastUsedDuration(finalDurationNotation);
      }
      
      setInteraction(null); // Etkileşimi bitir
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [notes, handleNotesChange, stepWidth, gridSnapValue, setLastUsedDuration]);

  /**
   * Note bileşeninden gelen etkileşimleri (örn: resize) yönetir.
   */
  const onNoteInteraction = useCallback((action, note, e) => {
    if (action === 'resize') {
      handleResizeStart(note, e);
    }
    // Gelecekte başka aksiyonlar (örn: 'split') buraya eklenebilir.
  }, [handleResizeStart]);

  useEffect(() => {
    const upHandler = (e) => { if (panState.current.isPanning || interaction) handleMouseUp(e); };
    window.addEventListener('mouseup', upHandler);
    return () => window.removeEventListener('mouseup', upHandler);
  }, [handleMouseUp, interaction]);

  // Hook'un dışarıya sunduğu değerleri güncelliyoruz.
  return {
    selectedNotes,
    interaction,
    onNoteInteraction, // YENİ: Bu fonksiyonu dışarıya açıyoruz.
    interactionProps: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onContextMenu: (e) => e.preventDefault()
    }
  };
};