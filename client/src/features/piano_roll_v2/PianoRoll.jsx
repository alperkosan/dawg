// src/features/piano_roll_v2/PianoRoll.jsx
import React, { useRef, useEffect } from 'react';
import { Music } from 'lucide-react';
import { usePianoRollEngineV2 } from './hooks/usePianoRollEngineV2';
import { useNoteInteractionsV2 } from './hooks/useNoteInteractionsV2';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { PianoRollGrid } from './components/PianoRollGrid';
import { PrecisionGrid } from './components/PrecisionGrid';
import { EnhancedTimelineRuler } from './components/EnhancedTimelineRuler';
import { PianoKeyboard } from './components/PianoKeyboard';
import { VirtualNotesRenderer } from './components/VirtualNotesRenderer';
import { PlayheadOptimized } from './components/PlayheadOptimized';
import { Toolbar } from './components/Toolbar';
import { VelocityLane } from './components/VelocityLane';
import { usePianoRollStoreV2 } from './store/usePianoRollStoreV2';
import { createWheelZoomHandler } from '../../lib/utils/zoomHandler';
import './styles/enhanced-timeline.css';

function PianoRoll({ instrument }) {
  const scrollContainerRef = useRef(null);
  const { loopLength } = usePlaybackStore();
  // Optimize state selectors to prevent unnecessary re-renders
  const showVelocityLane = usePianoRollStoreV2(state => state.showVelocityLane);
  const velocityLaneHeight = usePianoRollStoreV2(state => state.velocityLaneHeight);
  const zoomX = usePianoRollStoreV2(state => state.zoomX);
  const setZoomX = usePianoRollStoreV2(state => state.setZoomX);

  // Create standardized zoom handler
  const handleZoom = createWheelZoomHandler(setZoomX, 0.1, 5);

  const engine = usePianoRollEngineV2(scrollContainerRef, loopLength);
  const interactions = useNoteInteractionsV2(instrument?.id, engine);


  // Unified scroll system - sync all containers with playback optimization
  useEffect(() => {
    const gridContainer = scrollContainerRef.current;
    const rulerContainer = document.querySelector('.prv2-ruler-container');
    const keyboardContainer = document.querySelector('.prv2-keyboard-container');
    const velocityContainer = document.querySelector('.prv2-velocity-lane');

    if (!gridContainer) return;

    let lastScrollTime = 0;
    const throttleDelay = 16; // ~60fps max for scroll sync

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollTime < throttleDelay) return; // Throttle scroll sync
      lastScrollTime = now;

      const { scrollLeft, scrollTop } = gridContainer;

      // Sync horizontal scroll for ruler and velocity lane
      if (rulerContainer) rulerContainer.scrollLeft = scrollLeft;
      if (velocityContainer) velocityContainer.scrollLeft = scrollLeft;

      // Sync vertical scroll for keyboard
      if (keyboardContainer) keyboardContainer.scrollTop = scrollTop;
    };

    // Reverse sync: Timeline scroll affects Grid
    const handleRulerScroll = () => {
      const { scrollLeft } = rulerContainer;
      if (gridContainer && gridContainer.scrollLeft !== scrollLeft) {
        gridContainer.scrollLeft = scrollLeft;
      }
    };

    gridContainer.addEventListener('scroll', handleScroll, { passive: true });

    // Add timeline reverse sync
    if (rulerContainer) {
      rulerContainer.addEventListener('scroll', handleRulerScroll, { passive: true });
    }

    // Non-passive wheel event for zoom
    const handleWheel = (e) => {
      const newZoom = handleZoom(e, zoomX);

      if (newZoom !== zoomX) {
        // Scroll container'ın otomatik scroll yapmasını engelle
        gridContainer.style.overflow = 'hidden';
        setTimeout(() => {
          gridContainer.style.overflow = 'auto';
        }, 50);
      }
    };

    gridContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      gridContainer.removeEventListener('scroll', handleScroll);
      gridContainer.removeEventListener('wheel', handleWheel);
      if (rulerContainer) {
        rulerContainer.removeEventListener('scroll', handleRulerScroll);
      }
    };
  }, [zoomX, setZoomX]);
  
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
      <div className="prv2-layout-grid" style={{
        gridTemplateRows: showVelocityLane
          ? `32px 1fr ${velocityLaneHeight}px auto`
          : '32px 1fr auto'
      }}>
        <div className="prv2-corner" />

        {/* Fixed Timeline - no transform needed */}
        <div className="prv2-ruler-container">
          <EnhancedTimelineRuler engine={engine} instrument={instrument} />
        </div>

        {/* Fixed Keyboard - no transform needed */}
        <div className="prv2-keyboard-container">
          <PianoKeyboard engine={engine} />
        </div>

        <div
          ref={scrollContainerRef}
          className="prv2-grid-area-container"
          onMouseDown={interactions.onMouseDown}
          onMouseMove={interactions.onMouseMove}
          onMouseUp={interactions.onMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Infinite scroll wrapper with dynamic width */}
          <div
            style={{
              width: engine.gridWidth || 1600,
              height: engine.gridHeight || 1920,
              position: 'relative'
            }}
          >
            {/* Legacy grid with proper props */}
            <PianoRollGrid
              engine={engine}
              scroll={engine.scroll}
              size={engine.size}
            />

            {/* Standard grid overlay */}
            <PrecisionGrid
              engine={engine}
              width={engine.gridWidth || 1600}
              height={engine.gridHeight || 1920}
              showBeatPattern={true}
            />

            {/* Enhanced notes renderer */}
            <VirtualNotesRenderer
              notes={interactions.notes}
              selectedNotes={interactions.selectedNotes || new Set()}
              engine={engine}
              interaction={interactions.interaction}
              onResizeStart={interactions.onResizeStart}
            />

            {/* Playhead overlay - positioned absolutely in grid */}
            <PlayheadOptimized engine={engine} />
          </div>

        </div>

        {/* Velocity Lane */}
        {showVelocityLane && (
          <>
            <div className="prv2-velocity-label-area">
              <span>Velocity</span>
            </div>
            <div className="prv2-velocity-lane" style={{ height: velocityLaneHeight }}>
              <VelocityLane
                notes={interactions.notes}
                selectedNotes={interactions.selectedNotes || new Set()}
                engine={engine}
                height={velocityLaneHeight}
                onVelocityChange={interactions.handleVelocityChange}
                onNoteSelect={interactions.handleNoteSelectFromLane}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(PianoRoll);