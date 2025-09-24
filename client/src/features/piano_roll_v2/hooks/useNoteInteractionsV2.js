import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { usePianoRollStoreV2 } from '../store/usePianoRollStoreV2';
import { AudioContextService } from '../../../lib/services/AudioContextService';
import { useSmartSnap } from './useSmartSnap';
import { createPianoRollKeydownHandler } from '../utils/keyboardShortcuts';
import { NativeTimeUtils } from '../../../lib/utils/NativeTimeUtils';
import { usePlaybackStore } from '../../../store/usePlaybackStore';

const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// Saniye değerini notation'a çeviren yardımcı fonksiyon
const secondsToNotation = (seconds, bpmValue) => {
  const sixteenthNoteSeconds = NativeTimeUtils.parseTime('16n', bpmValue);
  const steps = seconds / sixteenthNoteSeconds;

  // Steps'i notation'a çevir
  if (steps >= 64) {
    const bars = Math.floor(steps / 16);
    return `${bars}m`;
  } else if (steps >= 16) {
    const wholeNotes = Math.floor(steps / 16);
    return `${wholeNotes}n`;
  } else {
    const noteValue = Math.max(1, Math.round(16 / steps));
    if (noteValue > 128) {
      return '128n';
    } else {
      return `${noteValue}n`;
    }
  }
};

export const useNoteInteractionsV2 = (instrumentId, engine) => {
  const [interaction, setInteraction] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  
  const { patterns, updatePatternNotes } = useArrangementStore();
  const { activePatternId } = useArrangementStore.getState();
  // Optimize state selector - only listen to activeTool changes
  const activeTool = usePianoRollStoreV2(state => state.activeTool);

  // Son seçilen/resize edilen notanın uzunluğunu takip et
  const [defaultNoteDuration, setDefaultNoteDuration] = useState('4n'); // İlk nota bir beat
  const { bpm } = usePlaybackStore.getState();

  const notes = patterns[activePatternId]?.data[instrumentId] || [];
  const { snapTime, snapMode } = useSmartSnap(engine);
  
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const playingNotesRef = useRef(new Set());
  
  const handleNotesChange = useCallback((newNotes) => {
    if (instrumentId && activePatternId) {
      notesRef.current = newNotes;
      updatePatternNotes(activePatternId, instrumentId, newNotes);
    }
  }, [instrumentId, activePatternId, updatePatternNotes]);

  const audio = useMemo(() => {
    const stopPreview = (pitch) => { AudioContextService.auditionNoteOff(instrumentId, pitch); playingNotesRef.current.delete(pitch); };
    const preview = (pitch, velocity = 0.8) => { AudioContextService.auditionNoteOn(instrumentId, pitch, velocity); playingNotesRef.current.add(pitch); };
    const stopAllPreviews = () => { playingNotesRef.current.forEach(pitch => stopPreview(pitch)); };
    return { preview, stopPreview, stopAllPreviews };
  }, [instrumentId]);

  const handleVelocityChange = useCallback((noteId, newVelocity) => {
    const newNotes = notes.map(note => 
      note.id === noteId ? { ...note, velocity: newVelocity } : note
    );
    handleNotesChange(newNotes);
  }, [notes, handleNotesChange]);

  const handleNoteSelectFromLane = useCallback((noteId, isShiftKey) => {
    setSelectedNotes(currentSelection => {
        const newSelection = new Set(currentSelection);
        if (isShiftKey) {
            newSelection.has(noteId) ? newSelection.delete(noteId) : newSelection.add(noteId);
        } else {
            // Seçilen notanın uzunluğunu default olarak ayarla
            const selectedNote = notes.find(n => n.id === noteId);
            if (selectedNote) {
                setDefaultNoteDuration(selectedNote.duration);
            }
            return new Set([noteId]);
        }
        return newSelection;
    });
  }, [notes]);

  useEffect(() => {
    const handlerDependencies = {
      notes, selectedNotes, setSelectedNotes, handleNotesChange, engine,
    };
    const handleKeyDown = createPianoRollKeydownHandler(handlerDependencies);

    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && interaction) {
        audio.stopAllPreviews();
        setInteraction(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleEscapeKey);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [notes, selectedNotes, engine, handleNotesChange, setSelectedNotes, interaction, audio]);

  const findNoteAtPosition = useCallback((x, y, noteSource) => {
      return noteSource.find(note => {
          const rect = engine.getNoteRect(note);
          return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
      });
  }, [engine]);

  const onMouseDown = useCallback((e) => {
    // Güvenlik kontrolleri - interaction'ları engellemeyi önle
    if (!e || !engine || !engine.mouseToGrid) {
      return;
    }

    // Prevent dragging on text elements
    if (e.target.classList.contains('prv2-note__label')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const gridPos = engine.mouseToGrid(e);
    if (!gridPos || !isFinite(gridPos.x) || !isFinite(gridPos.y) || !isFinite(gridPos.time)) {
      return;
    }

    const clickedNote = findNoteAtPosition(gridPos.x, gridPos.y, notes);

    // Prevent context menu and handle right-click delete
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      let initialDeleted = new Set();
      if (clickedNote) {
        handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
        initialDeleted.add(clickedNote.id);
      }
      setInteraction({ type: 'erase', deleted: initialDeleted });
      return;
    }

    // Prevent middle-click and other buttons
    if (e.button !== 0) {
      e.preventDefault();
      return;
    }

    switch (activeTool) {
      case 'pencil':
        if (clickedNote) {
          audio.preview(clickedNote.pitch, clickedNote.velocity);
          const notesToDrag = [clickedNote.id];
          setSelectedNotes(new Set(notesToDrag));
          // Seçilen notanın uzunluğunu yeni nota yazımı için kaydet
          setDefaultNoteDuration(clickedNote.duration);
          setInteraction({ type: 'drag', startPos: gridPos, noteIds: notesToDrag, originalNotes: new Map([[clickedNote.id, { ...clickedNote }]]) });
        } else {
          // Mouse down ile direkt nota oluştur - mouse move ile resize yok
          const snappedTime = snapTime(gridPos.time);
          const newNote = { id: generateNoteId(), time: snappedTime, pitch: gridPos.pitch, duration: defaultNoteDuration, velocity: 0.8 };
          handleNotesChange([...notes, newNote]);
          setSelectedNotes(new Set([newNote.id]));
          audio.preview(newNote.pitch, newNote.velocity);
          // Create interaction kaldırıldı - direkt nota oluştur ve bitir
        }
        break;
      case 'selection':
        if (clickedNote) {
          audio.preview(clickedNote.pitch, clickedNote.velocity);
          const isSelected = selectedNotes.has(clickedNote.id);
          if (e.shiftKey) {
            const newSelection = new Set(selectedNotes);
            isSelected ? newSelection.delete(clickedNote.id) : newSelection.add(clickedNote.id);
            setSelectedNotes(newSelection);
          } else if (!isSelected) {
            setSelectedNotes(new Set([clickedNote.id]));
            // Seçilen notanın uzunluğunu yeni nota yazımı için kaydet
            setDefaultNoteDuration(clickedNote.duration);
          }
          const notesToDrag = selectedNotes.has(clickedNote.id) ? Array.from(selectedNotes) : [clickedNote.id];
          setInteraction({ type: 'drag', startPos: gridPos, noteIds: notesToDrag, originalNotes: new Map(notes.filter(n => notesToDrag.includes(n.id)).map(n => [n.id, { ...n }])) });
        } else {
          if (!e.shiftKey) setSelectedNotes(new Set());
          setInteraction({ type: 'marquee', startPos: gridPos, currentPos: gridPos });
        }
        break;
      case 'eraser':
        let initialDeleted = new Set();
        if (clickedNote) {
          handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
          initialDeleted.add(clickedNote.id);
        }
        setInteraction({ type: 'erase', deleted: initialDeleted });
        break;
    }
  }, [engine, notes, activeTool, selectedNotes, handleNotesChange, audio, snapTime, findNoteAtPosition]);

  const onMouseMove = useCallback((e) => {
    if (!interaction || !e || !engine) return;

    const gridPos = engine.mouseToGrid(e);
    if (!gridPos || !isFinite(gridPos.x) || !isFinite(gridPos.y) || !isFinite(gridPos.time)) {
      return; // Geçersiz pozisyon, hareketi yok say
    }
    switch (interaction.type) {
      case 'erase':
        const noteToDelete = findNoteAtPosition(gridPos.x, gridPos.y, notesRef.current);
        if (noteToDelete && !interaction.deleted.has(noteToDelete.id)) {
          const newNotes = notesRef.current.filter(n => n.id !== noteToDelete.id);
          handleNotesChange(newNotes);
          interaction.deleted.add(noteToDelete.id);
        }
        break;
      // 'create' case kaldırıldı - artık mouse move ile resize yok
      case 'drag':
        const deltaTime = gridPos.time - interaction.startPos.time;
        const snappedDeltaTime = snapTime(deltaTime);
        const previewNotes = interaction.noteIds.map(id => {
          const original = interaction.originalNotes.get(id);
          if (!original) return null;
          const originalNoteY = engine.pitchToY(original.pitch);
          const newNoteY = originalNoteY + (gridPos.y - interaction.startPos.y);
          const newPitch = engine.yToPitch(newNoteY);
          return { ...original, time: Math.max(0, original.time + snappedDeltaTime), pitch: newPitch };
        }).filter(Boolean);
        setInteraction(prev => ({ ...prev, previewNotes }));
        break;
      case 'marquee':
        setInteraction(prev => ({ ...prev, currentPos: gridPos }));
        break;
    }
  }, [interaction, engine, notes, handleNotesChange, snapTime]);

  const cleanupInteraction = useCallback(() => {
    audio.stopAllPreviews();
    if (interaction?.type === 'drag' && interaction.previewNotes) {
      const updatedNotesMap = new Map(notes.map(n => [n.id, n]));
      interaction.previewNotes.forEach(p => updatedNotesMap.set(p.id, p));
      handleNotesChange(Array.from(updatedNotesMap.values()));
    } else if (interaction?.type === 'marquee') {
      const rect = {
        x: Math.min(interaction.startPos.x, interaction.currentPos.x),
        y: Math.min(interaction.startPos.y, interaction.currentPos.y),
        width: Math.abs(interaction.currentPos.x - interaction.startPos.x),
        height: Math.abs(interaction.currentPos.y - interaction.startPos.y)
      };
      const notesInRect = notes.filter(n => {
        const noteRect = engine.getNoteRect(n);
        return noteRect.x < rect.x + rect.width && noteRect.x + noteRect.width > rect.x &&
               noteRect.y < rect.y + rect.height && noteRect.y + noteRect.height > rect.y;
      });
      const newSelection = new Set(selectedNotes);
      notesInRect.forEach(n => newSelection.add(n.id));
      setSelectedNotes(newSelection);
    }
    setInteraction(null);
  }, [interaction, notes, handleNotesChange, selectedNotes, engine, audio]);

  const onMouseUp = useCallback(() => {
    cleanupInteraction();
  }, [cleanupInteraction]);

  // Global mouse event listeners for handling mouse outside canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (interaction) {

        // Force cleanup for all interaction types
        audio.stopAllPreviews();

        if (interaction.type === 'drag' && interaction.previewNotes) {
          const updatedNotesMap = new Map(notes.map(n => [n.id, n]));
          interaction.previewNotes.forEach(p => updatedNotesMap.set(p.id, p));
          handleNotesChange(Array.from(updatedNotesMap.values()));
        } else if (interaction.type === 'marquee' && interaction.currentPos) {
          const rect = {
            x: Math.min(interaction.startPos.x, interaction.currentPos.x),
            y: Math.min(interaction.startPos.y, interaction.currentPos.y),
            width: Math.abs(interaction.currentPos.x - interaction.startPos.x),
            height: Math.abs(interaction.currentPos.y - interaction.startPos.y)
          };
          const notesInRect = notes.filter(n => {
            const noteRect = engine.getNoteRect(n);
            return noteRect.x < rect.x + rect.width && noteRect.x + noteRect.width > rect.x &&
                   noteRect.y < rect.y + rect.height && noteRect.y + noteRect.height > rect.y;
          });
          const newSelection = new Set(selectedNotes);
          notesInRect.forEach(n => newSelection.add(n.id));
          setSelectedNotes(newSelection);
        }

        setInteraction(null);
      }
    };

    const handleGlobalMouseMove = (e) => {
      // Only handle marquee selection outside canvas - drag is too complex for coordinates
      if (interaction && interaction.type === 'marquee' && engine) {
        const gridPos = engine.mouseToGrid(e);
        if (gridPos) {
          setInteraction(prev => ({ ...prev, currentPos: gridPos }));
        }
      }
    };

    // Add global listeners when there's an active interaction
    if (interaction) {
      document.addEventListener('mouseup', handleGlobalMouseUp, { passive: false });
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false }); // Non-passive for faster response
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [interaction, audio, notes, handleNotesChange, selectedNotes, engine]);

  // Optimized note resize with throttling and better performance
  const onResizeStart = useCallback((e, noteToResize) => {
    e.stopPropagation();
    e.preventDefault();

    // Resize edilen nota seçili değilse, onu seçili yap
    if (!selectedNotes.has(noteToResize.id)) {
      setSelectedNotes(new Set([noteToResize.id]));
    }

    // Başlangıç durumunu kaydet - mutlak fark hesaplaması için
    const initialDurationSeconds = NativeTimeUtils.parseTime(noteToResize.duration, bpm);

    // Seçili notaların başlangıç durumlarını kaydet
    const currentState = useArrangementStore.getState();
    const currentNotes = currentState.patterns[currentState.activePatternId]?.data[instrumentId] || [];
    const initialSelectedNoteDurations = new Map();

    currentNotes.forEach(note => {
      if (selectedNotes.has(note.id) && note.id !== noteToResize.id) {
        initialSelectedNoteDurations.set(note.id, NativeTimeUtils.parseTime(note.duration, bpm));
      }
    });

    let animationId = null;
    let lastUpdateTime = 0;
    let previousSnappedSteps = null; // Track previous snapped value for hysteresis
    const throttleMs = 8; // 120fps - Faster resize response

    const handleMouseMove = (moveEvent) => {
      // Güvenlik kontrolleri
      if (!moveEvent || !engine || !noteToResize) {
        return;
      }

      const now = Date.now();
      if (now - lastUpdateTime < throttleMs) return;

      if (animationId) {
        cancelAnimationFrame(animationId);
      }

      animationId = requestAnimationFrame(() => {
        // FIXED: Use engine.mouseToGrid for consistent coordinate system
        const mouseGridPos = engine.mouseToGrid(moveEvent);
        if (!mouseGridPos) return;

        const noteRect = engine.getNoteRect(noteToResize);
        const noteStartX = noteRect.x;
        const currentMouseGridX = mouseGridPos.x;


        // Hedef width hesapla - artık aynı koordinat sisteminde
        const targetWidth = currentMouseGridX - noteStartX;
        const rawTargetDurationSteps = targetWidth / (engine?.stepWidth || 40);

        // IMPROVED: Smart magnetic snap during resize with Alt bypass
        const isFreeMode = moveEvent.altKey; // Alt key disables snap temporarily

        let snappedSteps;
        if (isFreeMode) {
          // Alt pressed: No snap, direct mouse tracking
          snappedSteps = Math.abs(rawTargetDurationSteps);
        } else {
          // Normal snap behavior with improvements
          snappedSteps = snapTime(Math.abs(rawTargetDurationSteps), {
            isResizing: true,
            previousValue: previousSnappedSteps
          });
        }

        // Update previous value for hysteresis
        previousSnappedSteps = snappedSteps;
        const finalSteps = snappedSteps;

        // Debug improved snap behavior
        const snapDifference = snappedSteps - Math.abs(rawTargetDurationSteps);

        // Güvenli notasyon hesabı - sınırlar ve validasyon
        let newDurationNotation;

        // Sadece NaN ve Infinity'yi engelle - sıfır ve negatif değerlere izin ver
        if (!isFinite(finalSteps)) {
          return; // Güncellemeyi iptal et
        }

        // Çok küçük veya sıfır değer için minimum ayarla
        if (finalSteps < 0.01) {
          newDurationNotation = '128n'; // En küçük nota
        } else {
          // Normal notasyon hesaplama - sınırsız
          const safeFinalSteps = finalSteps;

          // Daha basit ve hassas çözüm: Step'i saniyeye çevir ve direkt kullan
        const sixteenthNoteSeconds = NativeTimeUtils.parseTime('16n', bpm);
        const targetDurationSeconds = safeFinalSteps * sixteenthNoteSeconds;

        // Saniye tabanlı notasyon - en hassas yöntem
        if (targetDurationSeconds >= 4) {
          // 4 saniye = yaklaşık 1 bar (120 BPM'de)
          const bars = Math.floor(targetDurationSeconds / (4 * 60/bpm));
          newDurationNotation = `${Math.max(1, bars)}m`;
        } else {
          // Küçük duration'lar için direkt saniye kullan
          newDurationNotation = `${targetDurationSeconds.toFixed(3)}`;
        }

        // Son kontrol - geçerli notasyon mu?
        if (!newDurationNotation || newDurationNotation === 'NaNn' || newDurationNotation === 'Infinityn') {
          newDurationNotation = noteToResize.duration || '4n';
          return;
        }
        } // else bloğunun kapanışı

        const currentState = useArrangementStore.getState();
        const currentNotes = currentState.patterns[currentState.activePatternId]?.data[instrumentId] || [];

        // Multi-note resize: Mutlak fark tabanlı resize sistemi
        const newDurationSeconds = NativeTimeUtils.parseTime(newDurationNotation, bpm);
        const durationDifference = newDurationSeconds - initialDurationSeconds; // Fark hesaplama


        // Minimum duration (1/128 note)
        const minDurationSeconds = NativeTimeUtils.parseTime('128n', bpm);

        const updatedNotes = currentNotes.map(note => {
          if (note.id === noteToResize.id) {
            // Ana nota
            return { ...note, duration: newDurationNotation };
          } else if (selectedNotes.has(note.id) && initialSelectedNoteDurations.has(note.id)) {
            // Seçili diğer notalar - mutlak fark ekleme/çıkarma
            const originalSeconds = initialSelectedNoteDurations.get(note.id);
            const newSeconds = originalSeconds + durationDifference;


            // Minimum duration kontrolü - kısaltmada sınır
            const clampedSeconds = Math.max(minDurationSeconds, newSeconds);

            // Seconds'ı notation'a çevir
            const resizedNotation = secondsToNotation(clampedSeconds, bpm);

            return { ...note, duration: resizedNotation };
          }

          return note; // Seçilmemiş notalar değişmez
        });

        updatePatternNotes(
          currentState.activePatternId,
          instrumentId,
          updatedNotes
        );

        // Resize edilen notanın uzunluğunu default olarak ayarla
        setDefaultNoteDuration(newDurationNotation);

        lastUpdateTime = now;
      });
    };

    const handleMouseUp = () => {
      // Cleanup işlemleri
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false }); // Non-passive for faster resize
    window.addEventListener('mouseup', handleMouseUp);
  }, [instrumentId, engine?.stepWidth, updatePatternNotes, snapTime, selectedNotes, bpm]);

  // ⚡ Enhanced mouse leave handling
  const onMouseLeave = useCallback(() => {
    // Stop all preview notes when mouse leaves the piano roll area
    audio.stopAllPreviews();

    // Don't cancel interaction immediately - let global handlers manage it
    // This allows for drag/marquee to continue outside canvas
  }, [audio]);

  return {
    notes,
    selectedNotes,
    interaction,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onResizeStart,
    handleVelocityChange,
    handleNoteSelectFromLane
  };
};