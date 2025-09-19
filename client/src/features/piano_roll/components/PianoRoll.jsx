import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import * as Tone from 'tone';

// Components
import TimelineRuler from './TimelineRuler';
import PianoRollGrid from './PianoRollGrid';
import PianoKeyboard from './PianoKeyboard';
import { PianoRollToolbar } from './PianoRollToolbar';
import { EnhancedVelocityLane } from './EnhancedVelocityLane';
import ContextMenu from './ContextMenu';
import ResizableHandle from '../../../ui/ResizableHandle';
import Minimap from './Minimap';
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel';

// Hooks
import { useViewport } from '../hooks/useViewport';
import { useHybridInteractions } from '../hooks/useHybridInteractions';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { useInstrumentsStore } from '../../../store/useInstrumentsStore';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { AudioContextService } from '../../../lib/services/AudioContextService';

// Styles
import '../PianoRoll.css';
import { Music } from 'lucide-react';

// Constants
const TOTAL_OCTAVES = 8;
const TOTAL_KEYS = TOTAL_OCTAVES * 12;
const KEYBOARD_WIDTH = 96;
const RULER_HEIGHT = 40;
const NOTES_CONST = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];


function PianoRoll({ instrument }) {
  const scrollContainerRef = useRef(null);
  
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  // === STORE HOOKS ===
  const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();
  const { loopLength, playbackState } = usePlaybackStore();
  const { instruments } = useInstrumentsStore();
  
  const { 
    zoomX, zoomY, velocityLaneHeight, setVelocityLaneHeight, 
    toggleVelocityLane, scale, showVelocityLane,
    collapseVelocityLane, expandVelocityLane
  } = usePianoRollStore();

  const activePattern = patterns[activePatternId];
  const notes = activePattern?.data[instrument?.id] || [];

  const [selectedNotes, setSelectedNotes] = useState(new Set());

  const ghostNotes = useMemo(() => {
    if (!activePattern || !instrument) return [];
    return Object.entries(activePattern.data)
      .filter(([instId]) => instId !== instrument.id)
      .flatMap(([instId, instNotes]) => 
        (instNotes || []).map(note => ({
          ...note,
          instrumentId: instId,
          color: instruments.find(i => i.id === instId)?.color || '#4b5563'
        }))
      );
  }, [activePattern, instrument, instruments]);
  
  const viewport = useViewport(scrollContainerRef, {
    zoomX, zoomY, loopLength: (activePattern?.length || loopLength), 
    totalKeys: TOTAL_KEYS, keyboardWidth: KEYBOARD_WIDTH, rulerHeight: RULER_HEIGHT
  });

  // YENİ: handleNotesChange artık ses motorunu tetikliyor.
  const handleNotesChange = useCallback((newNotes) => {
    if (instrument?.id) {
      // 1. Notaları merkezi state'te güncelle.
      updatePatternNotes(activePatternId, instrument.id, newNotes);
      
      // 2. Eğer müzik çalıyorsa, ses motoruna notaları yeniden zamanlaması için komut gönder.
      if (playbackState === 'playing') {
        AudioContextService?.reschedule();
      }
    }
  }, [instrument?.id, activePatternId, updatePatternNotes, playbackState]);
  
  const gridDimensions = useMemo(() => ({
    stepWidth: 40 * zoomX,
    keyHeight: 20 * zoomY,
    gridWidth: (activePattern?.length || loopLength) * 40 * zoomX,
    gridHeight: TOTAL_KEYS * 20 * zoomY
  }), [zoomX, zoomY, loopLength, activePattern?.length]);

  const coordinateConverters = useMemo(() => {
    const { keyHeight, stepWidth } = gridDimensions;
    const pitchToIndex = (pitch) => {
        const octave = parseInt(pitch.replace(/[^0-9-]/g, '')) || 0;
        const noteName = pitch.replace(/[0-9-]/g, '');
        const noteIndex = NOTES_CONST.indexOf(noteName);
        return octave * 12 + noteIndex;
    };
    return {
      pitchToIndex,
      indexToPitch: (index) => {
        const noteIndex = index % 12;
        const octave = Math.floor(index / 12);
        return `${NOTES_CONST[noteIndex]}${octave}`;
      },
      noteToY: (pitch) => (TOTAL_KEYS - 1 - pitchToIndex(pitch)) * keyHeight,
      yToNote: (y) => {
          const index = Math.max(0, Math.min(TOTAL_KEYS - 1, TOTAL_KEYS - 1 - Math.floor(y / keyHeight)));
          return `${NOTES_CONST[index % 12]}${Math.floor(index/12)}`;
      },
      // HATA DÜZELTMESİ: Eksik olan ve hataya sebep olan fonksiyonlar yeniden eklendi.
      xToStep: (x) => Math.max(0, x / stepWidth),
      stepToX: (step) => step * stepWidth,
    };
  }, [gridDimensions]);

  const {
    eventHandlers,
    currentInteraction,
    contextMenu,
    setContextMenu,
    audioContext
  } = useHybridInteractions({
    notes,
    handleNotesChange,
    instrumentId: instrument?.id,
    viewport,
    containerRef: scrollContainerRef,
    selectedNotes,
    setSelectedNotes,
    gridDimensions,
    coordinateConverters
  });

  const handleNotePreview = useCallback((pitch, velocity = 0) => {
    audioContext.auditionNote(pitch, velocity > 0 ? velocity : 0);
  }, [audioContext]);

  const handleMinimapNavigate = useCallback((x, y) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: x, top: y, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'F1' || (e.key === '?' && !e.shiftKey)) {
        e.preventDefault();
        setShowKeyboardShortcuts(s => !s);
      }
      if (e.key === 'Escape' && showKeyboardShortcuts) {
        e.preventDefault();
        setShowKeyboardShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showKeyboardShortcuts]);

  if (!instrument) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-800/50 text-gray-400">
            <div className="text-center">
                <Music size={48} className="mx-auto mb-4 opacity-50"/>
                <h3 className="text-lg font-bold">Piano Roll</h3>
                <p>Select an instrument from the Channel Rack to begin editing.</p>
            </div>
        </div>
    );
  }

  const totalContentHeight = viewport.gridHeight + RULER_HEIGHT + (showVelocityLane ? velocityLaneHeight + 8 : 0);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-white select-none">
      <PianoRollToolbar />
      <div className="flex-grow min-h-0 relative">
        <div className="absolute top-4 right-4 z-50">
          <Minimap
            notes={notes}
            viewport={viewport}
            selectedNotes={selectedNotes}
            onNavigate={handleMinimapNavigate}
          />
        </div>
        <div ref={scrollContainerRef} className="w-full h-full overflow-auto piano-roll-scroll" style={{ touchAction: 'none' }} {...eventHandlers}>
          <div className="relative" style={{ width: viewport.gridWidth + KEYBOARD_WIDTH, height: totalContentHeight }}>
            <div className="absolute top-0 left-0 bg-gray-800 border-r border-b border-gray-700 z-30" style={{ width: KEYBOARD_WIDTH, height: RULER_HEIGHT }} />
            <div className="sticky top-0 z-20" style={{ left: KEYBOARD_WIDTH, width: viewport.gridWidth, height: RULER_HEIGHT }}>
              <TimelineRuler viewport={viewport} loopLength={activePattern?.length || loopLength} />
            </div>
            <div className="sticky left-0 z-20" style={{ top: RULER_HEIGHT, width: KEYBOARD_WIDTH, height: viewport.gridHeight }}>
              <PianoKeyboard viewport={viewport} scale={scale} onNotePreview={handleNotePreview} />
            </div>
            <div className="absolute z-10" style={{ top: RULER_HEIGHT, left: KEYBOARD_WIDTH, width: viewport.gridWidth, height: viewport.gridHeight }}>
              <PianoRollGrid
                notes={notes}
                ghostNotes={ghostNotes}
                selectedNotes={selectedNotes}
                viewport={viewport}
                interaction={currentInteraction}
              />
            </div>
            {velocityLaneHeight > 0 && (
              <div className="absolute left-0 border-t border-gray-700" style={{ top: RULER_HEIGHT + viewport.gridHeight, width: '100%', height: velocityLaneHeight + 8 }}>
                <ResizableHandle onDrag={(delta) => setVelocityLaneHeight(velocityLaneHeight - delta)} onDoubleClick={toggleVelocityLane} />
                <div className="flex" style={{ height: velocityLaneHeight }}>
                  <div className="w-24 shrink-0 bg-gray-800 border-r border-gray-700" />
                  <div className="flex-grow relative">
                    <EnhancedVelocityLane 
                        notes={notes} 
                        selectedNotes={selectedNotes} 
                        viewport={viewport} 
                        onVelocityChange={(noteId, vel) => handleNotesChange(notes.map(n => n.id === noteId ? {...n, velocity: vel} : n))}
                        showVelocityLane={showVelocityLane}
                        velocityLaneHeight={velocityLaneHeight}
                        setVelocityLaneHeight={setVelocityLaneHeight}
                        collapseVelocityLane={collapseVelocityLane}
                        expandVelocityLane={expandVelocityLane}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ContextMenu contextMenu={contextMenu} setContextMenu={setContextMenu} />
      <KeyboardShortcutsPanel isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} />
    </div>
  );
}

export default React.memo(PianoRoll);

