import { useEffect, useCallback } from 'react';

export const useKeyboardShortcuts = (pianoRollState, interactions) => {
  const handleKeyDown = useCallback((e) => {
    // Don't handle shortcuts when typing in inputs
    if (['input', 'textarea', 'select'].includes(e.target.tagName.toLowerCase())) {
      return;
    }
    
    const { ctrlKey, metaKey, shiftKey, altKey, key } = e;
    const modKey = ctrlKey || metaKey;
    
    // Tool shortcuts
    if (!modKey && !shiftKey && !altKey) {
      switch (key) {
        case '1':
          e.preventDefault();
          pianoRollState.setTool('select');
          break;
        case '2':
          e.preventDefault();
          pianoRollState.setTool('pencil');
          break;
        case '3':
          e.preventDefault();
          pianoRollState.setTool('eraser');
          break;
        case '4':
          e.preventDefault();
          pianoRollState.setTool('split');
          break;
      }
    }
    
    // Selection shortcuts
    if (modKey && key === 'a') {
      e.preventDefault();
      const allNoteIds = new Set(pianoRollState.notes.map(n => n.id));
      pianoRollState.setSelectedNotes(allNoteIds);
    }
    
    if (modKey && key === 'd') {
      e.preventDefault();
      pianoRollState.setSelectedNotes(new Set());
    }
    
    // Delete selected notes
    if ((key === 'Delete' || key === 'Backspace') && !modKey) {
      e.preventDefault();
      if (pianoRollState.selectedNotes.size > 0) {
        pianoRollState.removeNotes(Array.from(pianoRollState.selectedNotes));
      }
    }
    
    // Copy/Paste
    if (modKey && key === 'c') {
      e.preventDefault();
      // Copy selected notes to clipboard (implementation needed)
    }
    
    if (modKey && key === 'v') {
      e.preventDefault();
      // Paste notes from clipboard (implementation needed)
    }
    
    // Duplicate
    if (modKey && key === 'd') {
      e.preventDefault();
      // Duplicate selected notes (implementation needed)
    }
    
    // Zoom shortcuts
    if (modKey && key === '=') {
      e.preventDefault();
      const { x, y } = pianoRollState.zoom;
      pianoRollState.setZoom(Math.min(5, x * 1.2), y);
    }
    
    if (modKey && key === '-') {
      e.preventDefault();
      const { x, y } = pianoRollState.zoom;
      pianoRollState.setZoom(Math.max(0.25, x / 1.2), y);
    }
    
    // Fit to selection
    if (key === 'f' && !modKey) {
      e.preventDefault();
      if (pianoRollState.selectedNotes.size > 0) {
        const selectedNotes = pianoRollState.notes.filter(n => 
          pianoRollState.selectedNotes.has(n.id)
        );
        // viewport.zoomToFit(selectedNotes); // Implement this
      }
    }
    
  }, [pianoRollState, interactions]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
