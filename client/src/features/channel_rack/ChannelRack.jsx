import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useTransportPosition, useTransportTimeline, useTransportPlayhead } from '../../hooks/useTransportManager.js';
import commandManager from '../../lib/commands/CommandManager';
import { AddNoteCommand } from '../../lib/commands/AddNoteCommand';
import { DeleteNoteCommand } from '../../lib/commands/DeleteNoteCommand';
import InstrumentRow from './InstrumentRow';
import StepGrid from './StepGrid';
import PianoRollMiniView from './PianoRollMiniView';
import InteractiveTimeline from './InteractiveTimeline';
import { PlusCircle } from 'lucide-react';

const STEP_WIDTH = 16;

// Precise step calculation to avoid floating point errors
const calculateStep = (clickX, stepWidth, maxStep) => {
  const exactStep = clickX / stepWidth;
  const roundedStep = Math.round(exactStep * 100) / 100; // Round to 2 decimal places first
  const finalStep = Math.round(roundedStep); // Then round to integer
  return Math.max(0, Math.min(maxStep, finalStep));
};

export default function ChannelRack() {
  const instruments = useInstrumentsStore(state => state.instruments);
  const { patterns, activePatternId } = useArrangementStore();
  const { openPianoRollForInstrument, handleEditInstrument, togglePanel } = usePanelsStore();

  // ✅ UNIFIED TRANSPORT SYSTEM
  const { position, displayPosition, playbackState, isPlaying } = useTransportPosition();
  const { jumpToPosition, setGhostPosition, clearGhostPosition } = useTransportTimeline(STEP_WIDTH, 64);
  const { ghostPosition, registerPlayheadElement } = useTransportPlayhead(STEP_WIDTH);

  // ✅ Position tracking with actual position (not ghost)

  // Refs for UI element registration
  const timelineRef = useRef(null);
  const playheadRef = useRef(null);

  // Audio loop length hesaplama
  const audioLoopLength = 64; // TODO: Get from arrangement/pattern

  // State for smooth compact playhead animation
  const [isJumping, setIsJumping] = useState(false);

  // Scroll container ref (for timeline scrolling)
  const scrollContainerRef = useRef(null);



  const instrumentListRef = useRef(null);
  const timelineContainerRef = useRef(null);

  const activePattern = patterns[activePatternId];

  // High-performance playhead artık useOptimizedPlayhead hook'u tarafından yönetiliyor
  // GPU acceleration ve direct DOM manipulation ile smooth hareket

  // Custom scroll synchronization for Channel Rack
  useEffect(() => {
    const mainGrid = scrollContainerRef.current;
    const instrumentsList = instrumentListRef.current;
    const timeline = timelineContainerRef.current;

    if (!mainGrid || !instrumentsList || !timeline) return;

    let isInstrumentsScrolling = false;
    let isMainScrolling = false;

    // Main grid scroll -> sync instruments vertically and timeline horizontally
    const handleMainScroll = () => {
      if (isInstrumentsScrolling) return;
      isMainScrolling = true;

      instrumentsList.scrollTop = mainGrid.scrollTop;
      timeline.scrollLeft = mainGrid.scrollLeft;

      requestAnimationFrame(() => {
        isMainScrolling = false;
      });
    };

    // Instruments scroll -> sync main grid vertically
    const handleInstrumentsScroll = () => {
      if (isMainScrolling) return;
      isInstrumentsScrolling = true;

      mainGrid.scrollTop = instrumentsList.scrollTop;

      requestAnimationFrame(() => {
        isInstrumentsScrolling = false;
      });
    };

    mainGrid.addEventListener('scroll', handleMainScroll, { passive: true });
    instrumentsList.addEventListener('scroll', handleInstrumentsScroll, { passive: true });

    return () => {
      mainGrid.removeEventListener('scroll', handleMainScroll);
      instrumentsList.removeEventListener('scroll', handleInstrumentsScroll);
    };
  }, []);

  const handleNoteToggle = useCallback((instrumentId, step) => {
    try {
      if (!activePattern) return;
      const currentNotes = activePattern.data[instrumentId] || [];
      const existingNote = currentNotes.find(note => note.time === step);

      if (existingNote) {
        commandManager.execute(new DeleteNoteCommand(instrumentId, existingNote));
      } else {
        commandManager.execute(new AddNoteCommand(instrumentId, step));
      }
    } catch (error) {
      console.error('Error toggling note:', error);
    }
  }, [activePatternId, activePattern]);

  const totalContentHeight = Math.max(64, (instruments.length + 1) * 64);


  // ✅ UNIFIED: Timeline interaction via TransportManager
  const handleTimelineClickInternal = useCallback((e) => {
    // ✅ OPTIMIZED - Allow position changes in all states (fire-and-forget)

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const exactStep = clickX / STEP_WIDTH;
    const targetStep = calculateStep(clickX, STEP_WIDTH, audioLoopLength - 1);

    console.log(`🎯 Timeline click precision:`, {
      clickX,
      exactStep,
      targetStep,
      stepWidth: STEP_WIDTH,
      roundingDiff: exactStep - targetStep,
      preciseCalculation: true
    });

    // ✅ OPTIMIZED - Fire-and-forget for 0ms UI latency
    jumpToPosition(targetStep); // No await needed
  }, [jumpToPosition, audioLoopLength, playbackState]);



  return (
    <div className="channel-rack-layout no-select">
      <div className="channel-rack-layout__corner">
        Pattern: {activePattern?.name || '...'}
      </div>
      <div ref={instrumentListRef} className="channel-rack-layout__instruments">
        <div style={{ height: totalContentHeight }}>
          {instruments.map(inst => (
            <InstrumentRow
              key={inst.id}
              instrument={inst}
              onPianoRollClick={() => openPianoRollForInstrument(inst)}
              onEditClick={() => handleEditInstrument(inst)}
            />
          ))}
          <div className="instrument-row instrument-row--add" onClick={() => togglePanel('file-browser')}>
            <PlusCircle size={20} />
            <span>Add...</span>
          </div>
        </div>
      </div>
      <div ref={timelineContainerRef} className="channel-rack-layout__timeline">
        <div style={{ width: audioLoopLength * STEP_WIDTH, height: '100%' }}>
          <InteractiveTimeline
            loopLength={audioLoopLength}
            currentPosition={displayPosition}
            onJumpToPosition={jumpToPosition}
          />
          {/* FL Studio style compact playhead with click interaction */}
          <div
            className={`channel-rack-layout__compact-playhead ${
              isPlaying ? 'channel-rack-layout__compact-playhead--playing' : ''
            } ${
              isJumping ? 'channel-rack-layout__compact-playhead--jumping' : ''
            } ${
              playbackState === 'stopped' ? 'channel-rack-layout__compact-playhead--stopped' : ''
            }`}
            style={{
              transform: `translateX(${position * STEP_WIDTH}px)`,
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: '#00ff88',
              zIndex: 100,
              pointerEvents: 'none',
              boxShadow: '0 0 8px rgba(0, 255, 136, 0.6)',
              transition: 'transform 50ms linear',
              willChange: 'transform'
            }}
          >
            {/* Compact playhead indicator arrow */}
            <div
              style={{
                position: 'absolute',
                top: '-2px',
                left: '-3px',
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '6px solid #00ff88',
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
              }}
            />
          </div>
          {/* Interactive timeline area - FL Studio style */}
          <div
            className="channel-rack-layout__timeline-click-area"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${audioLoopLength * STEP_WIDTH}px`,
              bottom: 0,
              zIndex: 99,
              cursor: 'crosshair' // Always allow timeline interaction
            }}
            onClick={handleTimelineClickInternal}
            onMouseMove={(e) => {
              // ✅ OPTIMIZED - Always show ghost position for better UX
              const rect = e.currentTarget.getBoundingClientRect();
              const hoverX = e.clientX - rect.left;
              const hoverStep = calculateStep(hoverX, STEP_WIDTH, audioLoopLength - 1);
              setGhostPosition(hoverStep);
            }}
            onMouseLeave={() => {
              clearGhostPosition();
            }}
          />

          {/* Ghost playhead on hover - Always visible for better UX */}
          {ghostPosition !== null && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${ghostPosition * STEP_WIDTH}px`,
                width: '1px',
                backgroundColor: 'rgba(0, 255, 136, 0.4)',
                zIndex: 97,
                pointerEvents: 'none',
                transition: 'left 0.1s ease'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-2px',
                  left: '-3px',
                  width: 0,
                  height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '6px solid rgba(0, 255, 136, 0.4)',
                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
                }}
              />
            </div>
          )}


        </div>
      </div>
      <div ref={scrollContainerRef} className="channel-rack-layout__grid-scroll-area" onClick={handleTimelineClickInternal}>
        <div style={{ width: audioLoopLength * STEP_WIDTH, height: totalContentHeight }} className="channel-rack-layout__grid-content">
          {instruments.map(inst => (
            <div key={inst.id} className="channel-rack-layout__grid-row">
              {inst.pianoRoll ? (
                <PianoRollMiniView
                  notes={activePattern?.data[inst.id] || []}
                  patternLength={audioLoopLength}
                  onNoteClick={() => openPianoRollForInstrument(inst)}
                />
              ) : (
                <StepGrid
                  instrumentId={inst.id}
                  notes={activePattern?.data[inst.id] || []}
                  totalSteps={audioLoopLength}
                  onNoteToggle={handleNoteToggle}
                />
              )}
            </div>
          ))}
          <div className="channel-rack-layout__grid-row" />
        </div>
      </div>
    </div>
  );
}