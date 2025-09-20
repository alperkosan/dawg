// client/src/features/piano_roll/hooks/useAdvancedKeyboardShortcuts.js
import { useEffect, useCallback, useRef } from 'react';
import { usePianoRollStore } from '../store/usePianoRollStore';

/**
 * Piano Roll için gelişmiş klavye kısayolları
 * Pro DAW workflow'larından esinlenilmiş
 */
export const useAdvancedKeyboardShortcuts = ({ 
  pianoRollState, 
  interactions, 
  viewport,
  audioContext 
}) => {
  const keysPressed = useRef(new Set());
  const { activeTool, setActiveTool, zoomIn, zoomOut } = usePianoRollStore();

  // Tuş kombinasyonlarını kontrol et
  const isKeyComboPressed = useCallback((combo) => {
    return combo.every(key => keysPressed.current.has(key.toLowerCase()));
  }, []);

  // Seçili notaları al
  const getSelectedNotes = useCallback(() => {
    return pianoRollState.notes.filter(note => 
      pianoRollState.selectedNotes.has(note.id)
    );
  }, [pianoRollState.notes, pianoRollState.selectedNotes]);

  // Ana klavye handler'ı
  const handleKeyDown = useCallback((e) => {
    // Input elementlerinde kısayolları devre dışı bırak
    if (['input', 'textarea', 'select'].includes(e.target.tagName.toLowerCase())) {
      return;
    }

    const key = e.key.toLowerCase();
    const { ctrlKey, metaKey, shiftKey, altKey } = e;
    const modKey = ctrlKey || metaKey;
    
    keysPressed.current.add(key);

    // =============================================================================
    // ARAÇ SEÇİMİ (Tool Selection)
    // =============================================================================
    
    if (!modKey && !shiftKey && !altKey) {
      switch (key) {
        case '1':
        case 'q':
          e.preventDefault();
          setActiveTool('selection');
          break;
        case '2':
        case 'w':
          e.preventDefault();
          setActiveTool('pencil');
          break;
        case '3':
        case 'e':
          e.preventDefault();
          setActiveTool('eraser');
          break;
        case '4':
        case 'r':
          e.preventDefault();
          setActiveTool('split');
          break;
      }
    }

    // =============================================================================
    // SEÇME İŞLEMLERİ (Selection Operations)
    // =============================================================================
    
    if (modKey && key === 'a') {
      e.preventDefault();
      const allNoteIds = new Set(pianoRollState.notes.map(n => n.id));
      pianoRollState.setSelectedNotes(allNoteIds);
    }
    
    if (modKey && key === 'd') {
      e.preventDefault();
      pianoRollState.setSelectedNotes(new Set());
    }

    // Seçimi ters çevir
    if (modKey && shiftKey && key === 'i') {
      e.preventDefault();
      const allIds = new Set(pianoRollState.notes.map(n => n.id));
      const selectedIds = pianoRollState.selectedNotes;
      const invertedSelection = new Set(
        [...allIds].filter(id => !selectedIds.has(id))
      );
      pianoRollState.setSelectedNotes(invertedSelection);
    }

    // =============================================================================
    // KOPYALA/YAPIŞTIR/KES (Copy/Paste/Cut)
    // =============================================================================
    
    if (modKey && key === 'c') {
      e.preventDefault();
      const selectedNotes = getSelectedNotes();
      if (selectedNotes.length > 0) {
        // Clipboard'a kopyala (localStorage kullan)
        const clipboardData = {
          notes: selectedNotes,
          timestamp: Date.now()
        };
        localStorage.setItem('pianoRollClipboard', JSON.stringify(clipboardData));
        console.log(`Copied ${selectedNotes.length} notes`);
      }
    }
    
    if (modKey && key === 'x') {
      e.preventDefault();
      const selectedNotes = getSelectedNotes();
      if (selectedNotes.length > 0) {
        // Kopyala ve sil
        const clipboardData = { notes: selectedNotes, timestamp: Date.now() };
        localStorage.setItem('pianoRollClipboard', JSON.stringify(clipboardData));
        pianoRollState.removeNotes(Array.from(pianoRollState.selectedNotes));
        console.log(`Cut ${selectedNotes.length} notes`);
      }
    }
    
    if (modKey && key === 'v') {
      e.preventDefault();
      try {
        const clipboardData = JSON.parse(localStorage.getItem('pianoRollClipboard') || '{}');
        if (clipboardData.notes && clipboardData.notes.length > 0) {
          // Notaları playhead pozisyonuna yapıştır
          const pastePosition = viewport.getCurrentTime?.() || 0;
          const firstNoteTime = Math.min(...clipboardData.notes.map(n => n.time));
          const timeOffset = pastePosition - firstNoteTime;
          
          const pastedNotes = clipboardData.notes.map(note => ({
            ...note,
            id: `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            time: note.time + timeOffset
          }));
          
          const newNotes = [...pianoRollState.notes, ...pastedNotes];
          pianoRollState.handleNotesChange?.(newNotes);
          
          // Yapıştırılan notaları seç
          const pastedIds = new Set(pastedNotes.map(n => n.id));
          pianoRollState.setSelectedNotes(pastedIds);
          
          console.log(`Pasted ${pastedNotes.length} notes`);
        }
      } catch (error) {
        console.warn('Paste failed:', error);
      }
    }

    // =============================================================================
    // NOT İŞLEMLERİ (Note Operations)
    // =============================================================================
    
    // Notaları sil
    if ((key === 'delete' || key === 'backspace') && !modKey) {
      e.preventDefault();
      if (pianoRollState.selectedNotes.size > 0) {
        pianoRollState.removeNotes(Array.from(pianoRollState.selectedNotes));
      }
    }
    
    // Notaları dublicate et
    if (modKey && key === 'd') {
      e.preventDefault();
      const selectedNotes = getSelectedNotes();
      if (selectedNotes.length > 0) {
        const duplicatedNotes = selectedNotes.map(note => ({
          ...note,
          id: `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          time: note.time + 4 // 1 bar sonrasına kopyala
        }));
        
        const newNotes = [...pianoRollState.notes, ...duplicatedNotes];
        pianoRollState.handleNotesChange?.(newNotes);
        
        // Dublicate edilen notaları seç
        const duplicatedIds = new Set(duplicatedNotes.map(n => n.id));
        pianoRollState.setSelectedNotes(duplicatedIds);
      }
    }

    // =============================================================================
    // ZOOM VE GÖRÜNÜM (Zoom and View)
    // =============================================================================
    
    // Zoom In/Out
    if (modKey && (key === '=' || key === '+')) {
      e.preventDefault();
      zoomIn();
    }
    
    if (modKey && key === '-') {
      e.preventDefault();
      zoomOut();
    }
    
    // Fit to selection
    if (key === 'f' && !modKey) {
      e.preventDefault();
      const selectedNotes = getSelectedNotes();
      if (selectedNotes.length > 0) {
        viewport.zoomToFit?.(selectedNotes);
      }
    }
    
    // Zoom to full pattern
    if (shiftKey && key === 'f') {
      e.preventDefault();
      viewport.zoomToFit?.(pianoRollState.notes);
    }

    // =============================================================================
    // TRANSPORT KONTROLLERI (Transport Controls)
    // =============================================================================
    
    // Play/Pause
    if (key === ' ' || (key === 'enter' && !modKey)) {
      e.preventDefault();
      if (interactions.audioContext?.isPlaying) {
        interactions.audioContext.stop?.();
      } else {
        interactions.audioContext.play?.();
      }
    }
    
    // Stop
    if (key === '.' && !modKey) {
      e.preventDefault();
      interactions.audioContext?.stop?.();
    }

    // =============================================================================
    // VELOCİTY İŞLEMLERİ (Velocity Operations)
    // =============================================================================
    
    // Velocity artır/azalt
    if (key === 'arrowup' && shiftKey) {
      e.preventDefault();
      const selectedNotes = getSelectedNotes();
      selectedNotes.forEach(note => {
        const newVelocity = Math.min(1, note.velocity + 0.1);
        pianoRollState.updateNoteVelocity?.(note.id, newVelocity);
      });
    }
    
    if (key === 'arrowdown' && shiftKey) {
      e.preventDefault();
      const selectedNotes = getSelectedNotes();
      selectedNotes.forEach(note => {
        const newVelocity = Math.max(0.1, note.velocity - 0.1);
        pianoRollState.updateNoteVelocity?.(note.id, newVelocity);
      });
    }

    // =============================================================================
    // QUANTIZE İŞLEMLERİ (Quantization)
    // =============================================================================
    
    // Quick quantize
    if (key === 'q' && modKey) {
      e.preventDefault();
      pianoRollState.quantizeSelected?.();
    }
    
    // Humanize
    if (key === 'h' && modKey) {
      e.preventDefault();
      pianoRollState.humanizeSelected?.();
    }

    // =============================================================================
    // PAN VE NAVİGASYON (Pan and Navigation)
    // =============================================================================
    
    // Arrow key navigation
    if (!modKey && !shiftKey) {
      switch (key) {
        case 'arrowleft':
          e.preventDefault();
          viewport.scrollTo?.(viewport.scrollX - 50, viewport.scrollY);
          break;
        case 'arrowright':
          e.preventDefault();
          viewport.scrollTo?.(viewport.scrollX + 50, viewport.scrollY);
          break;
        case 'arrowup':
          e.preventDefault();
          viewport.scrollTo?.(viewport.scrollX, viewport.scrollY - 30);
          break;
        case 'arrowdown':
          e.preventDefault();
          viewport.scrollTo?.(viewport.scrollX, viewport.scrollY + 30);
          break;
      }
    }

    // Page up/down navigation
    if (key === 'pageup') {
      e.preventDefault();
      viewport.scrollTo?.(viewport.scrollX, viewport.scrollY - viewport.containerHeight * 0.8);
    }
    
    if (key === 'pagedown') {
      e.preventDefault();
      viewport.scrollTo?.(viewport.scrollX, viewport.scrollY + viewport.containerHeight * 0.8);
    }
    
    // Home/End
    if (key === 'home') {
      e.preventDefault();
      if (modKey) {
        // Go to start of pattern
        viewport.scrollTo?.(0, viewport.scrollY);
      } else {
        // Go to top
        viewport.scrollTo?.(viewport.scrollX, 0);
      }
    }
    
    if (key === 'end') {
      e.preventDefault();
      if (modKey) {
        // Go to end of pattern
        viewport.scrollTo?.(viewport.gridWidth, viewport.scrollY);
      } else {
        // Go to bottom
        viewport.scrollTo?.(viewport.scrollX, viewport.gridHeight);
      }
    }

    // =============================================================================
    // ÖZEL WORKFLOW KISAYOLLARı (Special Workflow Shortcuts)
    // =============================================================================
    
    // Escape - Seçimi temizle ve etkileşimi iptal et
    if (key === 'escape') {
      e.preventDefault();
      pianoRollState.setSelectedNotes(new Set());
      interactions.cancelInteraction?.();
      audioContext?.stopAllAudition?.();
    }
    
    // Tab - Sonraki/önceki nota seç
    if (key === 'tab' && !modKey) {
      e.preventDefault();
      const notes = [...pianoRollState.notes].sort((a, b) => a.time - b.time);
      const selectedIds = Array.from(pianoRollState.selectedNotes);
      
      if (selectedIds.length === 1) {
        const currentIndex = notes.findIndex(n => n.id === selectedIds[0]);
        const nextIndex = shiftKey 
          ? Math.max(0, currentIndex - 1)
          : Math.min(notes.length - 1, currentIndex + 1);
        
        pianoRollState.setSelectedNotes(new Set([notes[nextIndex].id]));
        viewport.scrollToNote?.(notes[nextIndex]);
      }
    }

  }, [pianoRollState, interactions, viewport, audioContext, activeTool, setActiveTool, zoomIn, zoomOut, getSelectedNotes, isKeyComboPressed]);

  // Tuş bırakma
  const handleKeyUp = useCallback((e) => {
    const key = e.key.toLowerCase();
    keysPressed.current.delete(key);
  }, []);

  // Event listener'ları kaydet
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Sayfa değiştiğinde tuş state'ini temizle
    const handleFocus = () => keysPressed.current.clear();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleFocus);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleFocus);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Kısayol bilgileri
  const shortcuts = {
    tools: {
      'Q/1': 'Selection Tool',
      'W/2': 'Pencil Tool', 
      'E/3': 'Eraser Tool',
      'R/4': 'Split Tool'
    },
    selection: {
      'Ctrl+A': 'Select All',
      'Ctrl+D': 'Deselect All',
      'Ctrl+Shift+I': 'Invert Selection',
      'Tab': 'Next Note',
      'Shift+Tab': 'Previous Note'
    },
    editing: {
      'Ctrl+C': 'Copy',
      'Ctrl+X': 'Cut',
      'Ctrl+V': 'Paste',
      'Ctrl+D': 'Duplicate',
      'Delete': 'Delete Selected'
    },
    transport: {
      'Space': 'Play/Pause',
      '.': 'Stop'
    },
    view: {
      'Ctrl++': 'Zoom In',
      'Ctrl+-': 'Zoom Out', 
      'F': 'Fit Selection',
      'Shift+F': 'Fit All'
    },
    navigation: {
      'Arrows': 'Pan View',
      'Page Up/Down': 'Scroll Vertical',
      'Home': 'Go to Start/Top',
      'End': 'Go to End/Bottom'
    },
    velocity: {
      'Shift+↑': 'Increase Velocity',
      'Shift+↓': 'Decrease Velocity'
    },
    misc: {
      'Escape': 'Cancel/Clear',
      'Ctrl+Q': 'Quantize',
      'Ctrl+H': 'Humanize'
    }
  };

  return {
    shortcuts,
    keysPressed: Array.from(keysPressed.current)
  };
};