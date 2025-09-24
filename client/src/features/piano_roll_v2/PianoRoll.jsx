// src/features/piano_roll_v2/PianoRoll.jsx
import React, { useRef, useEffect } from 'react';
import { Music } from 'lucide-react';
import { usePianoRollEngineV2 } from './hooks/usePianoRollEngineV2';
import { useNoteInteractionsV2 } from './hooks/useNoteInteractionsV2';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { PianoRollGrid } from './components/PianoRollGrid';
import { PrecisionGrid, GridDebugInfo } from './components/PrecisionGrid';
import { EnhancedTimelineRuler } from './components/EnhancedTimelineRuler';
import { PianoKeyboard } from './components/PianoKeyboard';
import { VirtualNotesRenderer } from './components/VirtualNotesRenderer';
import { useMotorPrecisionNotes } from './hooks/useMotorPrecisionNotes';
import { Toolbar } from './components/Toolbar';
import { VelocityLane } from './components/VelocityLane';
import { usePianoRollStoreV2 } from './store/usePianoRollStoreV2';
import './styles/precision-grid.css';
import './styles/enhanced-timeline.css';

function PianoRoll({ instrument }) {
  const scrollContainerRef = useRef(null);
  const rulerContentRef = useRef(null);
  const keyboardContentRef = useRef(null);
  const velocityLaneContentRef = useRef(null);
  const { loopLength } = usePlaybackStore();
  const { showVelocityLane, velocityLaneHeight } = usePianoRollStoreV2();

  const engine = usePianoRollEngineV2(scrollContainerRef, loopLength);
  const interactions = useNoteInteractionsV2(instrument?.id, engine);

  // Motor precision note system
  const motorNotes = useMotorPrecisionNotes(instrument?.id, engine, instrument?.notes || []);

  // Optimized scroll sync without re-renders
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let animationId = null;
    let lastScrollLeft = 0;
    let lastScrollTop = 0;

    const syncScrollPosition = () => {
      const { scrollLeft, scrollTop } = scrollContainer;

      if (scrollLeft !== lastScrollLeft || scrollTop !== lastScrollTop) {
        if (rulerContentRef.current) {
          rulerContentRef.current.style.transform = `translate3d(${-scrollLeft}px, 0, 0)`;
        }
        if (keyboardContentRef.current) {
          keyboardContentRef.current.style.transform = `translate3d(0, ${-scrollTop}px, 0)`;
        }
        if (velocityLaneContentRef.current) {
          velocityLaneContentRef.current.style.transform = `translate3d(${-scrollLeft}px, 0, 0)`;
        }

        lastScrollLeft = scrollLeft;
        lastScrollTop = scrollTop;
      }
    };

    const handleScroll = () => {
      if (!animationId) {
        animationId = requestAnimationFrame(() => {
          syncScrollPosition();
          animationId = null;
        });
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    syncScrollPosition(); // Initial sync

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);
  
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
          <div ref={rulerContentRef}>
            <EnhancedTimelineRuler engine={engine} />
          </div>
        </div>
        <div className="prv2-keyboard-container">
          <div ref={keyboardContentRef}><PianoKeyboard engine={engine} /></div>
        </div>
        <div
          ref={scrollContainerRef}
          className="prv2-grid-area-container"
          onMouseDown={interactions.onMouseDown}
          onMouseMove={interactions.onMouseMove}
          onMouseUp={interactions.onMouseUp}
        >
          {/* Legacy grid with proper props */}
          <PianoRollGrid
            engine={engine}
            scroll={engine.scroll}
            size={engine.size}
          />

          {/* Motor precision grid overlay */}
          <PrecisionGrid
            engine={engine}
            width={engine.gridWidth || 1600}
            height={engine.gridHeight || 1920}
            showMotorPrecision={motorNotes.selectedNotes.length > 0}
          />

          {/* Enhanced notes renderer with motor precision */}
          <VirtualNotesRenderer
            notes={interactions.notes}
            selectedNotes={interactions.selectedNotes || new Set()}
            engine={engine}
            interaction={interactions.interaction}
            motorPrecision={motorNotes}
            onResizeStart={interactions.onResizeStart}
          />

          {/* Debug info for motor precision */}
          {process.env.NODE_ENV === 'development' && motorNotes.selectedNotes.length > 0 && (
            <GridDebugInfo
              precisionGrid={motorNotes.precisionGrid}
              engine={engine}
            />
          )}
        </div>

        {/* Velocity Lane */}
        {showVelocityLane && (
          <>
            <div className="prv2-velocity-label-area">
              <span>Velocity</span>
            </div>
            <div className="prv2-velocity-lane" style={{ height: velocityLaneHeight }}>
              <div className="prv2-velocity-lane__content-wrapper">
                <div ref={velocityLaneContentRef}>
                  <VelocityLane
                    notes={interactions.notes}
                    selectedNotes={interactions.selectedNotes || new Set()}
                    engine={engine}
                    height={velocityLaneHeight}
                    onVelocityChange={interactions.handleVelocityChange}
                    onNoteSelect={interactions.handleNoteSelectFromLane}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(PianoRoll);