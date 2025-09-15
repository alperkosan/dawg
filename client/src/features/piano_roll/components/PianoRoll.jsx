// Enhanced PianoRoll.jsx - Ana bileşen tüm tutarsızlıklar giderildi
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import * as Tone from 'tone';

// Components
import TimelineRuler from './TimelineRuler';
import PianoRollGrid from './PianoRollGrid';
import PianoKeyboard from './PianoKeyboard';
import { PianoRollToolbar } from './PianoRollToolbar';
import VelocityLane from './VelocityLane';
import ResizableHandle from '../../../ui/ResizableHandle';
import Minimap from './Minimap';

// Hooks
import { useViewport } from '../hooks/useViewport';
import { usePianoRollInteractions } from '../hooks/usePianoRollInteractions';
import { usePianoRollState } from '../hooks/usePianoRollState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// Stores
import { useInstrumentsStore } from '../../../store/useInstrumentsStore';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { usePlaybackAnimator } from '../../../hooks/usePlaybackAnimator';

// Styles
import '../PianoRoll.css';

// Constants
const TOTAL_OCTAVES = 8;
const TOTAL_KEYS = TOTAL_OCTAVES * 12;
const KEYBOARD_WIDTH = 96;
const RULER_HEIGHT = 32;

function PianoRoll({ instrument, audioEngineRef, pattern, onPatternChange, playbackState }) {
  const scrollContainerRef = useRef(null);
  const playheadRef = useRef(null);
  
  // ✅ STORE HOOKS
  const { updatePatternNotes } = useArrangementStore();
  const { playbackMode } = usePlaybackStore();
  const loopLength = useInstrumentsStore(state => state.loopLength);
  
  const { 
    activeTool, zoomX, zoomY, velocityLaneHeight, 
    setVelocityLaneHeight, toggleVelocityLane,
    targetScroll, showVelocityLane
  } = usePianoRollStore();

  // ✅ PIANO ROLL STATE
  const pianoRollState = usePianoRollState(pattern, onPatternChange);
  const { notes, selectedNotes, setSelectedNotes, scale, tool, zoom, snapSettings } = pianoRollState;

  // ✅ VIEWPORT MANAGEMENT
  const viewport = useViewport(scrollContainerRef, {
    zoomX, zoomY, loopLength, totalKeys: TOTAL_KEYS,
    keyboardWidth: KEYBOARD_WIDTH, rulerHeight: RULER_HEIGHT
  });

  // ✅ NOTES CHANGE HANDLER
  const handleNotesChange = useCallback((newNotes) => {
    if (instrument?.id) {
      updatePatternNotes(instrument.id, newNotes);
      onPatternChange?.({ ...pattern, notes: newNotes });
    }
  }, [instrument?.id, updatePatternNotes, onPatternChange, pattern]);

  // ✅ GRID DIMENSIONS - Memoized
  const gridDimensions = useMemo(() => ({
    stepWidth: 40 * zoomX,
    keyHeight: 20 * zoomY,
    gridWidth: (loopLength || 16) * 40 * zoomX,
    gridHeight: TOTAL_KEYS * 20 * zoomY
  }), [zoomX, zoomY, loopLength]);

  // ✅ COORDINATE CONVERTERS - Memoized and optimized
  const coordinateConverters = useMemo(() => {
    const { stepWidth, keyHeight } = gridDimensions;
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    return {
      pitchToIndex: (pitch) => {
        const octave = parseInt(pitch.slice(-1), 10);
        const noteIndex = NOTES.indexOf(pitch.slice(0, -1));
        return octave * 12 + noteIndex;
      },
      
      indexToPitch: (index) => {
        const noteIndex = index % 12;
        const octave = Math.floor(index / 12);
        return `${NOTES[noteIndex]}${octave}`;
      },
      
      noteToY: (pitch) => {
        const index = coordinateConverters.pitchToIndex(pitch);
        return (TOTAL_KEYS - 1 - index) * keyHeight;
      },
      
      stepToX: (step) => step * stepWidth,
      
      xToStep: (x) => Math.max(0, x / stepWidth),
      
      yToNote: (y) => {
        const index = Math.max(0, Math.min(TOTAL_KEYS - 1, 
          TOTAL_KEYS - 1 - Math.floor(y / keyHeight)
        ));
        return coordinateConverters.indexToPitch(index);
      }
    };
  }, [gridDimensions]);

  // ✅ INTERACTIONS HOOK
  const interactions = usePianoRollInteractions({
    notes: notes || [],
    handleNotesChange,
    instrumentId: instrument?.id,
    audioEngineRef,
    viewport,
    gridDimensions,
    coordinateConverters,
    containerRef: scrollContainerRef,
    activeTool,
    selectedNotes,
    setSelectedNotes
  });

  // ✅ KEYBOARD SHORTCUTS
  useKeyboardShortcuts(pianoRollState, interactions);

  // ✅ PLAYBACK ANIMATOR
  usePlaybackAnimator(playheadRef, { 
    fullWidth: gridDimensions.gridWidth, 
    offset: KEYBOARD_WIDTH,
    smoothing: playbackMode === 'pattern',
    compensation: 'auto'
  });

  // ✅ TARGET SCROLL EFFECT
  useEffect(() => {
    if (targetScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: targetScroll.left,
        top: targetScroll.top,
        behavior: 'smooth'
      });
    }
  }, [targetScroll]);

  // ✅ AUDIO PREVIEW HANDLER
  const handleNotePreview = useCallback((pitch, velocity = 0) => {
    if (!audioEngineRef.current || !instrument?.id) return;
    
    if (velocity > 0) {
      audioEngineRef.current.auditionNoteOn(instrument.id, pitch, velocity);
    } else {
      audioEngineRef.current.auditionNoteOff(instrument.id, pitch);
    }
  }, [audioEngineRef, instrument?.id]);

  // ✅ MINIMAP NAVIGATION
  const handleMinimapNavigate = useCallback((x, y) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: x,
        top: y,
        behavior: 'smooth'
      });
    }
  }, []);

  // ✅ NO INSTRUMENT FALLBACK
  if (!instrument) {
    return (
      <div className="w-full h-full flex flex-col bg-gray-900">
        <PianoRollToolbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">🎹</div>
            <h3 className="text-xl font-semibold mb-2">Piano Roll</h3>
            <p>Düzenlemek için bir enstrüman seçin</p>
          </div>
        </div>
      </div>
    );
  }

  const totalContentHeight = gridDimensions.gridHeight + RULER_HEIGHT + 
    (showVelocityLane && velocityLaneHeight > 0 ? velocityLaneHeight + 8 : 0);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-white select-none relative">
      {/* TOOLBAR */}
      <PianoRollToolbar />
      
      {/* MAIN CONTENT */}
      <div className="flex-grow min-h-0 relative">
        {/* MINIMAP - Floating */}
        <div className="absolute top-4 right-4 z-50">
          <Minimap
            notes={notes || []}
            viewport={viewport}
            onNavigate={handleMinimapNavigate}
          />
        </div>
        
        {/* SCROLL CONTAINER */}
        <div
          ref={scrollContainerRef}
          className="w-full h-full overflow-auto piano-roll-scroll"
          style={{ 
            contain: 'layout style paint',
            willChange: 'scroll-position'
          }}
          {...interactions.eventHandlers}
        >
          <div
            className="relative piano-roll-container"
            style={{
              width: gridDimensions.gridWidth + KEYBOARD_WIDTH,
              height: totalContentHeight,
              contain: 'layout style paint'
            }}
          >
            {/* TOP-LEFT CORNER SPACER */}
            <div
              className="absolute top-0 left-0 bg-gray-800 border-r border-b border-gray-700 z-30 flex items-center justify-center"
              style={{ 
                width: KEYBOARD_WIDTH, 
                height: RULER_HEIGHT
              }}
            >
              <span className="text-xs text-gray-400 font-mono">
                {Math.round(zoomX * 100)}%
              </span>
            </div>

            {/* TIME RULER */}
            <div
              className="sticky top-0 z-20"
              style={{ 
                left: KEYBOARD_WIDTH, 
                width: gridDimensions.gridWidth, 
                height: RULER_HEIGHT
              }}
            >
              <TimelineRuler 
                viewport={viewport}
                playbackState={playbackState}
                loopLength={loopLength}
              />
            </div>

            {/* PIANO KEYBOARD */}
            <div
              className="sticky left-0 z-20"
              style={{ 
                top: RULER_HEIGHT,
                width: KEYBOARD_WIDTH,
                height: gridDimensions.gridHeight
              }}
            >
              <PianoKeyboard
                viewport={viewport}
                scale={scale}
                onNotePreview={handleNotePreview}
                totalKeys={TOTAL_KEYS}
              />
            </div>

            {/* MAIN GRID AREA */}
            <div
              className="absolute z-10"
              style={{ 
                top: RULER_HEIGHT, 
                left: KEYBOARD_WIDTH, 
                width: gridDimensions.gridWidth, 
                height: gridDimensions.gridHeight
              }}
            >
              <PianoRollGrid
                notes={notes || []}
                selectedNotes={interactions.selectedNotes}
                viewport={viewport}
                gridDimensions={gridDimensions}
                coordinateConverters={coordinateConverters}
                interaction={interactions.currentInteraction}
                playbackState={playbackState}
                playheadRef={playheadRef}
                scale={scale}
                onResizeStart={interactions.handleResizeStart}
              />
            </div>
            
            {/* VELOCITY LANE */}
            {showVelocityLane && velocityLaneHeight > 0 && (
              <div 
                className="absolute left-0 border-t border-gray-700"
                style={{ 
                  top: RULER_HEIGHT + gridDimensions.gridHeight, 
                  width: '100%', 
                  height: velocityLaneHeight + 8
                }}
              >
                <ResizableHandle 
                  onDrag={(delta) => setVelocityLaneHeight(velocityLaneHeight - delta)}
                  onDoubleClick={toggleVelocityLane}
                  className="h-2 bg-gray-600 hover:bg-gray-500 transition-colors cursor-ns-resize"
                />
                
                <div className="flex" style={{ height: velocityLaneHeight }}>
                  <div className="w-24 shrink-0 bg-gray-800 border-r border-gray-700 flex items-center justify-center">
                    <span className="text-xs text-gray-400 rotate-90">Velocity</span>
                  </div>
                  
                  <div className="flex-grow relative">
                    <VelocityLane 
                      notes={notes || []}
                      selectedNotes={interactions.selectedNotes}
                      viewport={viewport}
                      height={velocityLaneHeight}
                      onVelocityChange={interactions.handleVelocityChange}
                      onVelocityBarMouseDown={interactions.handleVelocityBarMouseDown}
                      onVelocityWheel={interactions.handleVelocityWheel}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* STATUS BAR */}
      <div className="h-6 bg-gray-800 border-t border-gray-700 flex items-center justify-between px-4 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Notes: {notes?.length || 0}</span>
          <span>Selected: {interactions.selectedNotes.size}</span>
          <span>Tool: {activeTool}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <span>Scale: {scale.root} {scale.type}</span>
          <span>Snap: {snapSettings?.value || '16n'}</span>
          <span>Zoom: {Math.round(zoomX * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(PianoRoll);