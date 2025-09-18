// client/src/features/piano_roll/components/PianoRoll.jsx - Enhanced with Touch & Keyboard
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import * as Tone from 'tone';

// Components
import TimelineRuler from './TimelineRuler';
import PianoRollGrid from './PianoRollGrid';
import PianoKeyboard from './PianoKeyboard';
import { PianoRollToolbar } from './PianoRollToolbar';
import { EnhancedVelocityLane } from './EnhancedVelocityLane';
import ContextMenu from './ContextMenu'; // Yeni oluşturduğumuz component'i import edin

import ResizableHandle from '../../../ui/ResizableHandle';
import Minimap from './Minimap';
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel'; // YENİ
import { AudioContextService } from '../../../lib/services/AudioContextService';

// Enhanced Hooks
import { useViewport } from '../hooks/useViewport';
import { useHybridInteractions } from '../hooks/useHybridInteractions'; // YENİ - Touch + Mouse
import { usePianoRollState } from '../hooks/usePianoRollState';
import { usePlaybackAnimator } from '../../../hooks/usePlaybackAnimator';

// Stores
import { usePianoRollStore } from '../store/usePianoRollStore';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { usePlaybackStore } from '../../../store/usePlaybackStore';

// Styles
import '../PianoRoll.css';

// Constants
const TOTAL_OCTAVES = 8;
const TOTAL_KEYS = TOTAL_OCTAVES * 12;
const KEYBOARD_WIDTH = 96;
const RULER_HEIGHT = 32;

function PianoRoll({ instrument, pattern, onPatternChange, playbackState }) {
  const engine = AudioContextService.getAudioEngine();
  const scrollContainerRef = useRef(null);
  const playheadRef = useRef(null);
  
  // ✅ KEYBOARD SHORTCUTS PANEL STATE
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  // ✅ STORE HOOKS
  const { updatePatternNotes } = useArrangementStore();
  const { playbackMode, loopLength } = usePlaybackStore();
  
  const { 
    activeTool, zoomX, zoomY, velocityLaneHeight, 
    setVelocityLaneHeight, toggleVelocityLane,
    targetScroll, showVelocityLane
  } = usePianoRollStore();

  // ✅ PIANO ROLL STATE
  const pianoRollState = usePianoRollState(pattern, onPatternChange);
  const { notes, selectedNotes, setSelectedNotes, scale, snapSettings } = pianoRollState;

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

  // ✅ GRID DIMENSIONS
  const gridDimensions = useMemo(() => ({
    stepWidth: 40 * zoomX,
    keyHeight: 20 * zoomY,
    gridWidth: (loopLength || 64) * 40 * zoomX,
    gridHeight: TOTAL_KEYS * 20 * zoomY
  }), [zoomX, zoomY, loopLength]);

  // ✅ COORDINATE CONVERTERS
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

  // ✅ ENHANCED INTERACTIONS HOOK - Now with Touch + Keyboard support
  const interactions = useHybridInteractions({
    notes: notes || [],
    handleNotesChange,
    instrumentId: instrument?.id,
    viewport,
    gridDimensions,
    coordinateConverters,
    containerRef: scrollContainerRef,
    selectedNotes,
    setSelectedNotes
  });

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
    if (!engine || !instrument?.id) return;
    
    if (velocity > 0) {
      engine.auditionNoteOn(instrument.id, pitch, velocity);
    } else {
      engine.auditionNoteOff(instrument.id, pitch);
    }
  }, [instrument?.id]);

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

  // ✅ GLOBAL KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // F1 or ? to show shortcuts
      if (e.key === 'F1' || (e.key === '?' && !e.shiftKey)) {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
      
      // Escape to close shortcuts
      if (e.key === 'Escape' && showKeyboardShortcuts) {
        e.preventDefault();
        setShowKeyboardShortcuts(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showKeyboardShortcuts]);

  // ✅ NO INSTRUMENT FALLBACK
  if (!instrument) {
    return (
      <div className="w-full h-full flex flex-col bg-gray-900">
        <PianoRollToolbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">🎹</div>
            <h3 className="text-xl font-semibold mb-2">Piano Roll</h3>
            <p>Select an instrument to edit</p>
            <div className="mt-4 text-sm text-gray-500">
              Press <kbd className="px-2 py-1 bg-gray-700 rounded">F1</kbd> for shortcuts
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalContentHeight = gridDimensions.gridHeight + RULER_HEIGHT + 
    (showVelocityLane && velocityLaneHeight > 0 ? velocityLaneHeight + 8 : 0);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-white select-none relative">
      {/* ENHANCED TOOLBAR with Input Mode Indicator */}
      <div className="relative">
        <PianoRollToolbar />
        
        {/* Input Mode & Shortcuts Indicator */}
        <div className="absolute top-2 right-4 flex items-center gap-2">
          {/* Input Mode Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
            interactions.inputMode === 'touch' ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/30' :
            interactions.inputMode === 'hybrid' ? 'bg-purple-900/30 text-purple-300 border border-purple-700/30' :
            'bg-blue-900/30 text-blue-300 border border-blue-700/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              interactions.inputMode === 'touch' ? 'bg-emerald-400' :
              interactions.inputMode === 'hybrid' ? 'bg-purple-400' :
              'bg-blue-400'
            }`} />
            {interactions.inputMode === 'touch' ? '👆 Touch' :
             interactions.inputMode === 'hybrid' ? '🖱️👆 Hybrid' :
             '🖱️ Mouse'}
          </div>
          
          {/* Shortcuts Button */}
          <button
            onClick={() => setShowKeyboardShortcuts(true)}
            className="px-2 py-1 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600 rounded text-xs text-gray-300 hover:text-white transition-colors"
            title="Keyboard Shortcuts (F1)"
          >
            F1
          </button>
        </div>
      </div>
      
      {/* MAIN CONTENT */}
      <div className="flex-grow min-h-0 relative">
        {/* MINIMAP - Floating */}
        <div className="absolute top-4 right-4 z-50">
          <Minimap
            notes={notes || []}
            viewport={viewport}
            selectedNotes={interactions.selectedNotes}
            onNavigate={handleMinimapNavigate}
          />
        </div>
        
        {/* SCROLL CONTAINER with Enhanced Event Handlers */}
        <div
          ref={scrollContainerRef}
          className="w-full h-full overflow-auto piano-roll-scroll"
          style={{ 
            contain: 'layout style paint',
            willChange: 'scroll-position',
            touchAction: 'none' // Prevent browser touch handling
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
            {/* TOP-LEFT CORNER SPACER with Debug Info */}
            <div
              className="absolute top-0 left-0 bg-gray-800 border-r border-b border-gray-700 z-30 flex flex-col items-center justify-center"
              style={{ 
                width: KEYBOARD_WIDTH, 
                height: RULER_HEIGHT
              }}
            >
              <span className="text-xs text-gray-400 font-mono">
                {Math.round(zoomX * 100)}%
              </span>
              {process.env.NODE_ENV === 'development' && (
                <span className="text-xs text-cyan-400 font-mono">
                  {interactions.debugInfo.currentTool}
                </span>
              )}
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
                        <EnhancedVelocityLane
                        notes={notes || []}
                        selectedNotes={interactions.selectedNotes}
                        viewport={viewport}
                        store={usePianoRollStore.getState()}
                        onVelocityChange={interactions.handleVelocityChange}
                        />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* ENHANCED STATUS BAR with Touch Info */}
      <div className="h-6 bg-gray-800 border-t border-gray-700 flex items-center justify-between px-4 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Notes: {notes?.length || 0}</span>
          <span>Selected: {interactions.selectedNotes.size}</span>
          <span>Tool: {activeTool}</span>
          {interactions.touchState.isActive && (
            <span className="text-emerald-400">
              Touch: {interactions.touchState.gestureType || 'active'}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <span>Scale: {scale.root} {scale.type}</span>
          <span>Snap: {snapSettings?.value || '16n'}</span>
          <span>Zoom: {Math.round(zoomX * 100)}%</span>
          <span className="text-cyan-400 cursor-pointer" onClick={() => setShowKeyboardShortcuts(true)}>
            Press F1 for shortcuts
          </span>
        </div>
      </div>

      {/* CONTEXT MENU */}
      <ContextMenu 
        contextMenu={interactions.contextMenu}
        setContextMenu={interactions.setContextMenu}
      />      

      {/* KEYBOARD SHORTCUTS PANEL */}
      <KeyboardShortcutsPanel 
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
      
      {/* TOUCH GESTURE HINTS (only on touch devices) */}
      {interactions.inputMode === 'touch' && (
        <div className="absolute bottom-16 left-4 bg-emerald-900/80 backdrop-blur-sm border border-emerald-700 rounded-lg p-3 max-w-xs">
          <div className="text-emerald-300 text-sm font-medium mb-2">Touch Gestures</div>
          <div className="text-emerald-200 text-xs space-y-1">
            <div>• Tap: Select/Create note</div>
            <div>• Double tap: Delete note</div>
            <div>• Pinch: Zoom</div>
            <div>• Long press: Context menu</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(PianoRoll);