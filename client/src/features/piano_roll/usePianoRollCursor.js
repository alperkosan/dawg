import { useCallback, useEffect, useRef } from 'react';

// Bu hook, fare imlecinin o anki duruma (seçili araç, klavye tuşu, notanın üzeri vb.)
// göre akıllı bir şekilde değişmesini sağlar.
export const usePianoRollCursor = (gridRef, activeTool, hoveredElement, modifierKeys) => {
  const currentCursor = useRef('cell');

  const updateCursor = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let newCursor = 'cell'; // Varsayılan imleç

    // --- DÜZELTME BURADA ---
    // İmlecin "grab" veya "grabbing" olması için artık sadece `modifierKeys.alt` durumuna bakıyoruz.
    // `modifierKeys.isMouseDown` koşulunu kaldırdık, çünkü sorun buydu. "Alt" tuşu bırakıldığında
    // bu koşul false dönecek ve imleç diğer durumlara göre güncellenecektir.
    if (modifierKeys.alt) {
      newCursor = modifierKeys.isMouseDown ? 'grabbing' : 'grab';
    } else if (hoveredElement?.type === 'note-resize-handle') {
      newCursor = 'ew-resize';
    } else {
      switch (activeTool) {
        case 'pencil':
          newCursor = hoveredElement?.type === 'note' ? 'move' : 'cell';
          break;
        case 'eraser':
          newCursor = hoveredElement?.type === 'note' ? 'not-allowed' : 'crosshair';
          break;
        case 'selection':
          newCursor = hoveredElement?.type === 'note' ? 'move' : 'default';
          break;
        default:
          newCursor = 'default';
      }
    }
    
    if (currentCursor.current !== newCursor) {
      grid.style.cursor = newCursor;
      currentCursor.current = newCursor;
    }
    // Bağımlılıklardan 'isNoteHovered' kaldırıldı, yerine daha genel 'hoveredElement' geldi.
  }, [activeTool, hoveredElement, modifierKeys, gridRef]);

  useEffect(() => {
    updateCursor();
  }, [updateCursor]);

  return updateCursor;
};