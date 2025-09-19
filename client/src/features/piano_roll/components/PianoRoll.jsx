// src/features/piano-roll/components/PianoRoll.jsx

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { AudioContextService } from '../../../lib/services/AudioContextService';
import { useViewport } from '../hooks/useViewport';
import { useHybridInteractions } from '../hooks/useHybridInteractions';
import { PlaybackAnimatorService } from '../../../lib/core/PlaybackAnimatorService';

// Bileşenler
import TimelineRuler from './TimelineRuler';
import PianoKeyboard from './PianoKeyboard';
import PianoRollGrid from './PianoRollGrid';
import { PianoRollToolbar } from './PianoRollToolbar';
import { EnhancedVelocityLane } from './EnhancedVelocityLane';
import ResizableHandle from '../../../ui/ResizableHandle';
import { Music } from 'lucide-react';

// Sabitler
const KEYBOARD_WIDTH = 80;
const RULER_HEIGHT = 32;

function PianoRoll({ instrument }) {
  const scrollContainerRef = useRef(null);
  const playheadRef = useRef(null);

  // Store'lar
  const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();
  const { loopLength, playbackState } = usePlaybackStore();
  const { zoomX, zoomY, velocityLaneHeight, setVelocityLaneHeight, scale, toggleVelocityLane } = usePianoRollStore();
  
  const [selectedNotes, setSelectedNotes] = useState(new Set());

  // Veri Çekme
  const activePattern = patterns[activePatternId];
  const notes = activePattern?.data[instrument?.id] || [];
  
  // Hook'lar
  const viewport = useViewport(scrollContainerRef, { zoomX, zoomY, loopLength: (activePattern?.length || loopLength) });
  
  const handleNotesChange = useCallback((newNotes) => {
    if (instrument?.id && activePatternId) {
      updatePatternNotes(activePatternId, instrument.id, newNotes);
      if (usePlaybackStore.getState().playbackState === 'playing') {
        AudioContextService?.reschedule();
      }
    }
  }, [instrument?.id, activePatternId, updatePatternNotes]);

  const handleVelocityChange = useCallback((noteId, newVelocity) => {
    const newNotes = notes.map(n => n.id === noteId ? { ...n, velocity: newVelocity } : n);
    handleNotesChange(newNotes);
  }, [notes, handleNotesChange]);

  const { eventHandlers, currentInteraction, audioContext, handleResizeStart } = useHybridInteractions({
    notes, handleNotesChange, instrumentId: instrument?.id, viewport,
    containerRef: scrollContainerRef, selectedNotes, setSelectedNotes,
  });

  const handleNotePreview = useCallback((pitch, velocity = 0) => {
    audioContext.auditionNote(pitch, velocity > 0 ? velocity : 0);
  }, [audioContext]);
  
  useEffect(() => {
    const updatePlayhead = (progress) => {
      if (playheadRef.current && playbackState === 'playing') {
        const patternLengthInSteps = (activePattern?.length || loopLength) * 16;
        const position = progress * patternLengthInSteps * viewport.stepWidth;
        playheadRef.current.style.transform = `translateX(${position}px)`;
      }
    };
    PlaybackAnimatorService.subscribe(updatePlayhead);
    return () => PlaybackAnimatorService.unsubscribe(updatePlayhead);
  }, [playbackState, activePattern?.length, loopLength, viewport.stepWidth]);

  // Eğer enstrüman seçilmemişse gösterilecek ekran
  if (!instrument || !activePattern) {
    return (
      <div className="piano-roll-placeholder">
        <Music size={48} className="piano-roll-placeholder__icon" />
        <h3 className="piano-roll-placeholder__title">Piano Roll</h3>
        <p className="piano-roll-placeholder__text">Select an instrument to begin editing.</p>
      </div>
    );
  }

  const totalContentHeight = viewport.gridHeight + (velocityLaneHeight > 0 ? velocityLaneHeight + 8 : 0);

  return (
    <div className="piano-roll">
      <PianoRollToolbar />
      {/* ANA SCROLL KONTEYNERİ */}
      <div 
        ref={scrollContainerRef} 
        className="piano-roll__main-content"
        {...eventHandlers}
      >
        {/* İÇERİK SARICI: Tüm grid bu div'in içinde ve bu div'in boyutu scroll'u belirliyor */}
        <div 
          className="piano-roll__content-wrapper" 
          style={{ 
            width: viewport.gridWidth + KEYBOARD_WIDTH, 
            height: totalContentHeight 
          }}
        >
          {/* Köşe, Klavye, Cetvel ve Grid artık bu sarmalayıcının doğrudan çocukları */}
          <div className="piano-roll__corner" />
          
          <div className="timeline-ruler-wrapper" style={{ left: KEYBOARD_WIDTH }}>
            <TimelineRuler viewport={viewport} loopLength={loopLength} />
          </div>
          
          <div className="piano-keyboard-wrapper" style={{ top: RULER_HEIGHT }}>
            <PianoKeyboard viewport={viewport} scale={scale} onNotePreview={handleNotePreview} />
          </div>
          
          <div className="piano-roll__grid-container" style={{ top: RULER_HEIGHT, left: KEYBOARD_WIDTH }}>
            <PianoRollGrid
              notes={notes}
              selectedNotes={selectedNotes}
              viewport={viewport}
              interaction={currentInteraction}
              onResizeStart={handleResizeStart}
            />
            {playbackState === 'playing' && (
              <div ref={playheadRef} className="piano-roll__playhead" style={{ height: viewport.gridHeight }} />
            )}
          </div>
          
          {velocityLaneHeight > 0 && (
            <div className="velocity-lane-container" style={{ top: RULER_HEIGHT + viewport.gridHeight, width: '100%' }}>
              <ResizableHandle
                onDrag={(deltaY) => setVelocityLaneHeight(prev => Math.max(20, Math.min(300, prev - deltaY)))}
                onDoubleClick={toggleVelocityLane}
              />
              <EnhancedVelocityLane
                notes={notes}
                selectedNotes={selectedNotes}
                viewport={viewport}
                height={velocityLaneHeight}
                onVelocityChange={handleVelocityChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(PianoRoll);