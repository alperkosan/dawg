import { useCallback, useEffect, useRef } from 'react';

// Bu hook, fare imlecinin o anki duruma (seçili araç, klavye tuşu, notanın üzeri vb.)
// göre akıllı bir şekilde değişmesini sağlar.
export const usePianoRollCursor = (gridRef, activeTool, isNoteHovered, modifierKeys) => {
  const currentCursor = useRef('cell');

  const updateCursor = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let newCursor = 'cell'; // Varsayılan kalem imleci
    
    // Öncelik sırasına göre imleci belirle
    if (modifierKeys.alt) {
      newCursor = modifierKeys.isMouseDown ? 'grabbing' : 'grab';
    } else if (modifierKeys.shift && isNoteHovered) {
      newCursor = 'copy';
    } else {
      switch (activeTool) {
        case 'pencil':
          newCursor = isNoteHovered ? 'move' : 'cell';
          break;
        case 'eraser':
           // Silgi imleci için özel bir stil kullanabiliriz, şimdilik 'not-allowed'
          newCursor = isNoteHovered ? 'not-allowed' : 'crosshair';
          break;
        case 'selection':
          newCursor = isNoteHovered ? 'move' : 'default';
          break;
        default:
          newCursor = 'default';
      }
    }
    
    if (currentCursor.current !== newCursor) {
      grid.style.cursor = newCursor;
      currentCursor.current = newCursor;
    }
  }, [activeTool, isNoteHovered, modifierKeys, gridRef]);

  useEffect(() => {
    updateCursor();
  }, [updateCursor]);

  return updateCursor;
};
