import React, { useMemo, useRef, useEffect } from 'react';
import Note from './Note';

const RENDER_BUFFER = 200; // Görünür alanın dışına ne kadar render edileceği (px)

export const VirtualNotesRenderer = ({
  notes,
  selectedNotes,
  viewport,
  onResizeStart,
  interaction
}) => {
  const renderStats = useRef({ rendered: 0, culled: 0 });

  // Sadece görünür alandaki notaları hesaplayan memoized fonksiyon
  const visibleNotes = useMemo(() => {
    const startTime = performance.now();
    const viewBounds = {
      left: viewport.scrollX - RENDER_BUFFER,
      right: viewport.scrollX + viewport.containerWidth + RENDER_BUFFER,
      top: viewport.scrollY - RENDER_BUFFER,
      bottom: viewport.scrollY + viewport.containerHeight + RENDER_BUFFER
    };
    
    const visible = [];
    let culled = 0;
    
    for (const note of notes) {
      const rect = viewport.getNoteRect(note);
      if (
        rect.x + rect.width >= viewBounds.left &&
        rect.x <= viewBounds.right &&
        rect.y + rect.height >= viewBounds.top &&
        rect.y <= viewBounds.bottom
      ) {
        // `precomputedRect` prop'unu Note bileşenine iletiyoruz
        visible.push({ note, rect });
      } else {
        culled++;
      }
    }
    
    renderStats.current = {
      rendered: visible.length,
      culled,
      renderTime: performance.now() - startTime
    };
    
    return visible;
  }, [notes, viewport.scrollX, viewport.scrollY, viewport.containerWidth, viewport.containerHeight, viewport]);

  // Geliştirme modunda performans istatistiklerini konsola yazdır
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const { rendered, culled, renderTime } = renderStats.current;
      console.log(`Virtual Render: ${rendered} nota render edildi, ${culled} nota atlandı. (${renderTime.toFixed(2)}ms)`);
    }
  }, [visibleNotes]);
  
  return (
    <div className="piano-roll__notes-container">
      {visibleNotes.map(({ note, rect }) => (
        <Note
          key={note.id}
          note={note}
          isSelected={selectedNotes.has(note.id)}
          isPreview={interaction?.previewNotes?.some(p => p.id === note.id)}
          viewport={viewport}
          onResizeStart={onResizeStart}
          precomputedRect={rect} // Optimize edilmiş `rect` verisini iletiyoruz
        />
      ))}
    </div>
  );
};
