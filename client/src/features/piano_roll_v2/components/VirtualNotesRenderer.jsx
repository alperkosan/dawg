import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Note } from './Note';
import { getViewport, releaseViewport } from '../../../lib/utils/objectPool';
import { trackScrollEvent, trackNoteUpdate } from '../../../lib/utils/performanceMonitor';
import { LOD_LEVELS } from '../store/usePianoRollStoreV2';

const RENDER_BUFFER = 400; // Kaydırma sırasında notaların aniden kaybolmaması için ekstra alan
const SCROLL_END_DELAY = 150; // Kaydırmanın bittiğini varsayacağımız süre (ms)

export const VirtualNotesRenderer = ({ notes, selectedNotes = new Set(), engine, interaction, onResizeStart, lod }) => {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const lastScrollRef = useRef({ x: 0, y: 0 });

  // Kaydırmanın başlayıp bittiğini tespit et
  useEffect(() => {
    const currentScroll = { x: engine?.scroll?.x || 0, y: engine?.scroll?.y || 0 };

    if (currentScroll.x !== lastScrollRef.current.x || currentScroll.y !== lastScrollRef.current.y) {
      setIsScrolling(true);
      trackScrollEvent();

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, SCROLL_END_DELAY);

      lastScrollRef.current = currentScroll;
    }

    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [engine?.scroll?.x, engine?.scroll?.y]);

  const visibleNotes = useMemo(() => {
    // CRITICAL: Early return if engine or notes are not ready
    if (!engine || !engine.scroll || !engine.size || !notes) return [];

    // SIMPLIFIED: Pre-filter notes by time range with pure scroll coordinates
    const stepWidth = engine.stepWidth || 40;
    const scrollX = engine.scroll.x || 0;
    const viewWidth = engine.size.width || 0;

    // Calculate time bounds with buffer (no virtual offset)
    const leftTimeBound = (scrollX - RENDER_BUFFER) / stepWidth;
    const rightTimeBound = (scrollX + viewWidth + RENDER_BUFFER) / stepWidth;

    // First pass: Fast time-based filtering
    const timeFilteredNotes = (notes || []).filter(note => {
      if (!note.time && note.time !== 0) return true;
      const noteEndTime = note.time + (parseFloat(note.duration) || 0.25);
      return note.time < rightTimeBound && noteEndTime > leftTimeBound;
    });

    // Second pass: Precise viewport culling only on time-filtered notes
    const viewBounds = getViewport(
      scrollX - RENDER_BUFFER,
      scrollX + viewWidth + RENDER_BUFFER,
      (engine.scroll.y || 0) - RENDER_BUFFER,
      (engine.scroll.y || 0) + (engine.size.height || 0) + RENDER_BUFFER
    );

    try {
      return timeFilteredNotes.filter(note => {
        if (!engine.getNoteRect) return true;
        const rect = engine.getNoteRect(note);
        if (!rect) return false; // Note outside visible window
        return (
          rect.x < viewBounds.right && rect.x + rect.width > viewBounds.left &&
          rect.y < viewBounds.bottom && rect.y + rect.height > viewBounds.top
        );
      });
    } finally {
      releaseViewport(viewBounds);
      trackNoteUpdate();
    }
  }, [
    notes,
    // SMART DEPENDENCY: Update based on viewport-relative scrolling
    Math.floor((engine?.scroll?.x || 0) / (engine?.stepWidth * 4 || 160)), // 4-step granularity
    Math.floor((engine?.scroll?.y || 0) / 80), // 4-key granularity
    engine?.size?.width,
    engine?.size?.height,
    engine?.virtualOffsetX,
    engine?.stepWidth,
    engine?.getNoteRect,
    lod // LOD değişikliklerinde güncelle
  ]);

  // LOD'a göre render ayarları
  const renderSettings = useMemo(() => {
    switch (lod) {
      case LOD_LEVELS.DETAILED:
        return { showAllNotes: true, showVelocity: true, showDetails: true };
      case LOD_LEVELS.NORMAL:
        return { showAllNotes: true, showVelocity: true, showDetails: false };
      case LOD_LEVELS.SIMPLIFIED:
        return { showAllNotes: true, showVelocity: false, showDetails: false };
      case LOD_LEVELS.OVERVIEW:
        return { showAllNotes: false, showVelocity: false, showDetails: false };
      default:
        return { showAllNotes: true, showVelocity: true, showDetails: true };
    }
  }, [lod]);

  return (
    <div className={`prv2-notes-container ${isScrolling ? 'prv2-notes-container--scrolling' : ''}`}>
      {/* LOD OVERVIEW'da hiç nota gösterme - sadece overlay */}
      {renderSettings.showAllNotes && visibleNotes.map(note => (
        <Note
          key={note.id}
          note={note}
          isSelected={selectedNotes?.has?.(note.id) || false}
          isPreview={interaction?.previewNotes?.some(p => p.id === note.id)}
          engine={engine}
          onResizeStart={onResizeStart}
          disableTransitions={isScrolling}
          lod={lod} // LOD ayarlarını Note bileşenine geçir
        />
      ))}

      {renderSettings.showAllNotes && interaction?.previewNotes?.map(note => (
        <Note
          key={`preview-${note.id}`}
          note={note}
          isPreview={true}
          engine={engine}
          disableTransitions={isScrolling}
          lod={lod}
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