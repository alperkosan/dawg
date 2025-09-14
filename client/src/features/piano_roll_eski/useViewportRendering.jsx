import { useState, useEffect, useMemo, useCallback } from 'react';
import * as Tone from 'tone';

// Bu hook, sadece görünür alandaki notaları hesaplayarak performansı optimize eder.
export const useViewportRendering = ({
  notes,
  gridScroll,
  viewport,
  noteToY,
  stepToX,
  keyHeight,
  stepWidth,
}) => {
  // Görünür notaları hesapla ve sonucu hafızada tut (memoize).
  const visibleNotes = useMemo(() => {
    if (!notes || notes.length === 0 || viewport.width === 0) {
      return [];
    }

    // Ekran dışında küçük bir tampon bölge bırakarak, kaydırma sırasında notaların aniden belirmesini önle.
    const verticalMargin = keyHeight * 2;
    const horizontalMargin = stepWidth * 16;

    // Viewport'un (görüş alanının) sınırlarını hesapla.
    const viewTop = gridScroll.top - verticalMargin;
    const viewBottom = gridScroll.top + viewport.height + verticalMargin;
    const viewLeft = gridScroll.left - horizontalMargin;
    const viewRight = gridScroll.left + viewport.width + horizontalMargin;

    // Sadece bu sınırlar içindeki notaları filtrele.
    return notes.filter(note => {
      const y = noteToY(note.pitch);
      const x = stepToX(note.time);
      const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
      const width = durationInSteps * stepWidth;

      // Notanın, hesaplanan görüş alanı içinde olup olmadığını kontrol et.
      const isVerticallyVisible = y + keyHeight >= viewTop && y <= viewBottom;
      const isHorizontallyVisible = x + width >= viewLeft && x <= viewRight;

      return isVerticallyVisible && isHorizontallyVisible;
    });
  }, [
    notes, 
    gridScroll, 
    viewport, 
    noteToY, 
    stepToX, 
    keyHeight, 
    stepWidth
  ]);

  return { visibleNotes };
};
