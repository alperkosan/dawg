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
import { addPerformanceOverlay } from '../../lib/utils/performanceMonitor';
import './styles/enhanced-timeline.css';
import './styles/composite-optimizations.css';

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

  // Add performance monitoring overlay in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && scrollContainerRef.current) {
      const cleanup = addPerformanceOverlay(document.body);
      return cleanup;
    }
  }, []);


  // Zoom handling for wheel events (scroll sync moved to engine)
  useEffect(() => {
    const gridContainer = scrollContainerRef.current;
    if (!gridContainer) return;

    let zoomThrottle = 0;

    // Non-passive wheel event for zoom
    const handleWheel = (e) => {
      // PERFORMANCE: Skip zoom during heavy interactions to avoid audio disruption
      if (!e.ctrlKey && !e.metaKey) {
        return; // Only zoom with Ctrl/Cmd held
      }

      // THROTTLE: Prevent rapid zoom events that could disrupt audio
      const now = Date.now();
      if (now - zoomThrottle < 50) { // 50ms throttle for zoom during playback
        return;
      }
      zoomThrottle = now;

      e.preventDefault();
      e.stopPropagation();

      const newZoom = handleZoom(e, zoomX);

      // FIXED: No DOM manipulation during playback - just update state
      // This prevents audio engine interruption
    };

    gridContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      gridContainer.removeEventListener('wheel', handleWheel);
    };
  }, [handleZoom, zoomX]);
  
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