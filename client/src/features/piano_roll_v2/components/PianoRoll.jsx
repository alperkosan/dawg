import React, { useRef, useEffect, useCallback } from 'react';
import { Music } from 'lucide-react';

// Core Hooks & Stores
import { usePianoRollEngineV2 } from '../hooks/usePianoRollEngineV2';
import { useNoteInteractionsV2 } from '../hooks/useNoteInteractionsV2';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { usePianoRollStoreV2 } from '../store/usePianoRollStoreV2';
import { useTouchGestures } from '../hooks/useTouchGestures';

// Components
import { Toolbar } from './Toolbar';
import { PianoRollGrid } from './PianoRollGrid';
import { TimelineRuler } from './TimelineRuler';
import { PianoKeyboard } from './PianoKeyboard';
import { VirtualNotesRenderer } from './VirtualNotesRenderer';
import { Minimap } from './Minimap';
import { Playhead } from './Playhead';
import ResizableHandle from './ResizableHandle';
import { VelocityLane } from './VelocityLane';

// Styles
import '../styles/PianoRoll.css';

function PianoRoll({ instrument }) {
  // === REFS ===
  const scrollContainerRef = useRef(null);
  const rulerContentRef = useRef(null);
  const keyboardContentRef = useRef(null);
  
  // === STORES ===
  const { loopLength } = usePlaybackStore();
  const { 
      zoomX, setZoomX, 
      velocityLaneHeight, setVelocityLaneHeight, 
      showVelocityLane, toggleVelocityLane 
  } = usePianoRollStoreV2();
  
  // === CORE ENGINE & INTERACTIONS ===
  const engine = usePianoRollEngineV2(scrollContainerRef, loopLength);
  const interactions = useNoteInteractionsV2(instrument?.id, engine);

  // === INTERACTIONS & EFFECTS ===

  // İmleç Odaklı Zoom Mantığı
  const doCursorZoom = useCallback((zoomFactor, cursorPositionX) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollX = container.scrollLeft;
    const timeAtCursor = (scrollX + cursorPositionX) / (40 * zoomX);
    
    const newZoomX = zoomX * zoomFactor;
    setZoomX(newZoomX);

    requestAnimationFrame(() => {
        if (!scrollContainerRef.current) return;
        const newPixelX = timeAtCursor * (40 * newZoomX);
        const newScrollLeft = newPixelX - cursorPositionX;
        scrollContainerRef.current.scrollLeft = newScrollLeft;
    });
  }, [zoomX, setZoomX]);

  // Fare Tekerleği Olay Yöneticisi
  const handleWheel = useCallback((e) => {
    if (e.altKey) {
      e.preventDefault();
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const zoomFactor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      doCursorZoom(zoomFactor, mouseX);
    }
  }, [doCursorZoom]);
  
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Dokunmatik Hareket Entegrasyonu
  useTouchGestures({
    containerRef: scrollContainerRef,
    onZoom: (scale, center) => {
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const mouseX = center.x - rect.left;
      doCursorZoom(scale, mouseX);
    },
  });

  // Scroll Senkronizasyonu
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
        if (rulerContentRef.current) rulerContentRef.current.style.transform = `translateX(${-container.scrollLeft}px)`;
        if (keyboardContentRef.current) keyboardContentRef.current.style.transform = `translateY(${-container.scrollTop}px)`;
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [engine.gridWidth, engine.gridHeight]);

  // Minimap Navigasyonu
  const handleMinimapNavigate = useCallback((x, y) => {
    scrollContainerRef.current?.scrollTo({ left: x, top: y, behavior: 'auto' });
  }, []);

  // === RENDER ===

  if (!instrument) {
    return (
      <div className="prv2-placeholder">
        <Music size={48} className="prv2-placeholder__icon" />
        <h3 className="prv2-placeholder__title">Piano Roll</h3>
        <p className="prv2-placeholder__text">Düzenlemek için bir enstrüman seçin.</p>
      </div>
    );
  }

  return (
    <div className="prv2-container">
      <Toolbar />
      <div className="prv2-layout-grid">
        <div className="prv2-corner" />

        <div className="prv2-keyboard-area">
          <div ref={keyboardContentRef} className="prv2-keyboard-content">
            <PianoKeyboard engine={engine} instrumentId={instrument?.id} />
          </div>
        </div>
        
        {showVelocityLane && <div className="prv2-velocity-label-area">Velocity</div>}

        <div className="prv2-timeline-area">
           <div ref={rulerContentRef} className="prv2-ruler-content-wrapper">
              <TimelineRuler engine={engine} />
           </div>
        </div>

        <div 
          ref={scrollContainerRef}
          className="prv2-main-scroll-area"
          onMouseDown={interactions.onMouseDown}
          onMouseMove={interactions.onMouseMove}
          onMouseUp={interactions.onMouseUp}
          onMouseLeave={interactions.onMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          role="application"
          autoComplete="off"
        >
          <div className="prv2-scroll-content" style={{ width: engine.gridWidth, height: engine.gridHeight + (showVelocityLane ? velocityLaneHeight : 0) }}>
            <div className="prv2-notes-grid-area" style={{ width: engine.gridWidth, height: engine.gridHeight }}>
              <PianoRollGrid 
                engine={engine}
                scroll={engine.scroll}
                size={engine.size}
              />
              <VirtualNotesRenderer 
                notes={interactions.notes}
                selectedNotes={interactions.selectedNotes}
                engine={engine}
                interaction={interactions.interaction}
                onResizeStart={interactions.onResizeStart}
              />
              <Playhead engine={engine} />
              {interactions.interaction?.type === 'marquee' && (
                <div
                  className="prv2-marquee"
                  style={{
                    left: Math.min(interactions.interaction.startPos.x, interactions.interaction.currentPos.x),
                    top: Math.min(interactions.interaction.startPos.y, interactions.interaction.currentPos.y),
                    width: Math.abs(interactions.interaction.currentPos.x - interactions.interaction.startPos.x),
                    height: Math.abs(interactions.interaction.currentPos.y - interactions.interaction.startPos.y),
                  }}
                />
              )}
            </div>
            {showVelocityLane && (
              <VelocityLane
                notes={interactions.notes}
                selectedNotes={interactions.selectedNotes}
                engine={engine}
                height={velocityLaneHeight}
                onVelocityChange={interactions.handleVelocityChange}
                onNoteSelect={interactions.handleNoteSelectFromLane}
              />
            )}
          </div>
        </div>
        
        {showVelocityLane && (
            <ResizableHandle
                onDrag={(deltaY) => setVelocityLaneHeight(velocityLaneHeight - deltaY)}
                onDoubleClick={toggleVelocityLane}
                className="prv2-resizable-handle-vertical"
            />
        )}

        <div className="prv2-minimap-wrapper">
          <Minimap 
            notes={interactions.notes}
            selectedNotes={interactions.selectedNotes}
            engine={engine}
            onNavigate={handleMinimapNavigate}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(PianoRoll);