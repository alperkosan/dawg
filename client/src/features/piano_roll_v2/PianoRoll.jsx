// src/features/piano_roll_v2/PianoRoll.jsx
import React, { useRef, useEffect, useMemo } from 'react';
import { Music, ZoomIn } from 'lucide-react';
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
import { usePianoRollStoreV2, LOD_LEVELS } from './store/usePianoRollStoreV2';
import { createWheelZoomHandler } from '../../lib/utils/zoomHandler';
import { addPerformanceOverlay } from '../../lib/utils/performanceMonitor';
import './styles/PianoRoll.css';
import './styles/enhanced-timeline.css';
import './styles/composite-optimizations.css';

function PianoRoll({ instrument }) {
  const scrollContainerRef = useRef(null);
  const { loopLength } = usePlaybackStore();

  const showVelocityLane = usePianoRollStoreV2(state => state.showVelocityLane);
  const velocityLaneHeight = usePianoRollStoreV2(state => state.velocityLaneHeight);
  const zoomX = usePianoRollStoreV2(state => state.zoomX);
  const setZoomX = usePianoRollStoreV2(state => state.setZoomX);
  const lod = usePianoRollStoreV2(state => state.getLODLevel());

  const handleZoom = createWheelZoomHandler(setZoomX, 0.005, 20); // min zoom güncellendi
  const engine = usePianoRollEngineV2(scrollContainerRef, loopLength);
  const interactions = useNoteInteractionsV2(instrument?.id, engine);
  
  // --- DEĞİŞİKLİK BURADA ---
  // LOD_LEVELS.OVERVIEW kontrolünü ve ilgili overlay div'ini siliyoruz.
  // Artık cetvelimiz bu işi kendisi hallediyor.

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && scrollContainerRef.current) {
      const cleanup = addPerformanceOverlay(document.body);
      return cleanup;
    }
  }, []);

  useEffect(() => {
    const gridContainer = scrollContainerRef.current;
    if (!gridContainer) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e, zoomX);
      }
    };

    gridContainer.addEventListener('wheel', handleWheel, { passive: false });
    return () => gridContainer.removeEventListener('wheel', handleWheel);
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
        <div className="prv2-ruler-container">
          <EnhancedTimelineRuler engine={engine} instrument={instrument} />
        </div>
        <div className="prv2-keyboard-container">
          <PianoKeyboard engine={engine} instrumentId={instrument.id} />
        </div>
        <div
          ref={scrollContainerRef}
          className="prv2-grid-area-container"
          onMouseDown={interactions.onMouseDown}
          onMouseMove={interactions.onMouseMove}
          onMouseUp={interactions.onMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          onMouseLeave={interactions.onMouseLeave}
        >
          <div
            style={{
              width: engine.gridWidth,
              height: engine.gridHeight,
              position: 'relative',
              contain: 'layout style paint'
            }}
          >
            <PianoRollGrid
              engine={engine}
              scroll={engine.scroll}
              size={engine.size}
            />

            <PrecisionGrid
              engine={engine}
              width={engine.gridWidth}
              height={engine.gridHeight}
              showBeatPattern={true}
            />

            <VirtualNotesRenderer
              notes={interactions.notes}
              selectedNotes={interactions.selectedNotes}
              engine={engine}
              interaction={interactions.interaction}
              onResizeStart={interactions.onResizeStart}
              lod={lod}
            />

            <PlayheadOptimized engine={engine} />

            {/* OVERLAY ARTIK YOK */}
            
          </div>
        </div>
        {showVelocityLane && (
          <>
            <div className="prv2-velocity-label-area"><span>Velocity</span></div>
            <div className="prv2-velocity-lane" style={{ height: velocityLaneHeight }}>
              <VelocityLane
                notes={interactions.notes}
                selectedNotes={interactions.selectedNotes}
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