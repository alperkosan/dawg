// src/features/piano_roll_v2/components/VirtualNotesRenderer.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Note } from './Note';

const RENDER_BUFFER = 400; // Increased buffer for smoother scrolling
const SCROLL_END_DELAY = 150; // ms to detect scroll end

export const VirtualNotesRenderer = ({ notes, selectedNotes = new Set(), engine, interaction, onResizeStart }) => {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const lastScrollRef = useRef({ x: 0, y: 0 });

  // Detect scroll end for smoother note transitions
  useEffect(() => {
    const currentScroll = { x: engine?.scroll?.x || 0, y: engine?.scroll?.y || 0 };

    if (currentScroll.x !== lastScrollRef.current.x || currentScroll.y !== lastScrollRef.current.y) {
      setIsScrolling(true);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, SCROLL_END_DELAY);

      lastScrollRef.current = currentScroll;
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [engine?.scroll?.x, engine?.scroll?.y]);

  const visibleNotes = useMemo(() => {
    // === ULTRA OPTIMIZED: Extreme throttling during scroll for performance ===
    if (!engine?.scroll || !engine?.size) {
      return notes || [];
    }

    const viewBounds = {
      left: (engine.scroll.x || 0) - RENDER_BUFFER,
      right: (engine.scroll.x || 0) + (engine.size.width || 0) + RENDER_BUFFER,
      top: (engine.scroll.y || 0) - RENDER_BUFFER,
      bottom: (engine.scroll.y || 0) + (engine.size.height || 0) + RENDER_BUFFER,
    };

    return (notes || []).filter(note => {
      if (!engine.getNoteRect) return true;
      const rect = engine.getNoteRect(note);
      if (!rect) return false;
      return (
        rect.x < viewBounds.right && rect.x + rect.width > viewBounds.left &&
        rect.y < viewBounds.bottom && rect.y + rect.height > viewBounds.top
      );
    });
  }, [
    notes,
    // ULTRA AGGRESSIVE: Throttle scroll position updates to 400px chunks for massive performance gain
    Math.floor((engine?.scroll?.x || 0) / 400),
    Math.floor((engine?.scroll?.y || 0) / 400),
    engine?.size?.width,
    engine?.size?.height,
    engine?.getNoteRect
  ]);

  return (
    <div
      className={`prv2-notes-container ${isScrolling ? 'prv2-notes-container--scrolling' : ''}`}
      style={{
        // OPTIMIZED: Disable transitions during scroll for smoother performance
        transition: isScrolling ? 'none' : undefined
      }}
    >
      {visibleNotes.map(note => (
        <Note
          key={note.id}
          note={note}
          isSelected={selectedNotes?.has?.(note.id) || false}
          isPreview={interaction?.previewNotes?.some(p => p.id === note.id)}
          engine={engine}
          onResizeStart={onResizeStart}
          disableTransitions={isScrolling} // Pass scroll state to individual notes
        />
      ))}
      {interaction?.previewNotes?.map(note => (
          <Note
            key={`preview-${note.id}`}
            note={note}
            isPreview={true}
            engine={engine}
            disableTransitions={isScrolling}
          />
      ))}

      {/* Marquee selection visualization */}
      {interaction?.type === 'marquee' && interaction.startPos && interaction.currentPos && (
        <div
          className="prv2-marquee-selection"
          style={{
            position: 'absolute',
            left: Math.min(interaction.startPos.x, interaction.currentPos.x),
            top: Math.min(interaction.startPos.y, interaction.currentPos.y),
            width: Math.abs(interaction.currentPos.x - interaction.startPos.x),
            height: Math.abs(interaction.currentPos.y - interaction.startPos.y),
            border: '1px dashed #4A9EFF',
            backgroundColor: 'rgba(74, 158, 255, 0.1)',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        />
      )}
    </div>
  );
};