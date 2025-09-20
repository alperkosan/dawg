// src/features/piano_roll_v2/components/VirtualNotesRenderer.jsx
import React, { useMemo } from 'react';
import { Note } from './Note';

const RENDER_BUFFER = 200; // Görünür alanın dışına render edilecek ekstra piksel

export const VirtualNotesRenderer = ({ notes, selectedNotes, engine, interaction, onResizeStart }) => {
  const visibleNotes = useMemo(() => {
    // === PERFORMANS İÇİN KRİTİK BAĞIMLILIK GÜNCELLEMESİ ===
    // Artık sadece scroll pozisyonu ve boyutlar değiştiğinde bu pahalı filtreleme işlemi çalışacak.
    // 'engine' nesnesinin tamamına bağımlı değiliz.
    const viewBounds = {
      left: engine.scroll.x - RENDER_BUFFER,
      right: engine.scroll.x + engine.size.width + RENDER_BUFFER,
      top: engine.scroll.y - RENDER_BUFFER,
      bottom: engine.scroll.y + engine.size.height + RENDER_BUFFER,
    };
    
    return notes.filter(note => {
      const rect = engine.getNoteRect(note);
      return (
        rect.x < viewBounds.right && rect.x + rect.width > viewBounds.left &&
        rect.y < viewBounds.bottom && rect.y + rect.height > viewBounds.top
      );
    });
  }, [notes, engine.scroll.x, engine.scroll.y, engine.size.width, engine.size.height, engine.getNoteRect]);

  return (
    <div className="prv2-notes-container">
      {visibleNotes.map(note => (
        <Note
          key={note.id}
          note={note}
          isSelected={selectedNotes.has(note.id)}
          isPreview={interaction?.previewNotes?.some(p => p.id === note.id)}
          engine={engine}
          onResizeStart={onResizeStart}
        />
      ))}
      {interaction?.previewNotes?.map(note => (
          <Note key={`preview-${note.id}`} note={note} isPreview={true} engine={engine} />
      ))}
    </div>
  );
};