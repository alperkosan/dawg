import React, { useRef, useEffect, useCallback } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useGlobalPlayhead } from '../../hooks/useGlobalPlayhead';
import { useOptimizedPlayhead } from '../../hooks/useOptimizedPlayhead';
import commandManager from '../../lib/commands/CommandManager';
import { AddNoteCommand } from '../../lib/commands/AddNoteCommand';
import { DeleteNoteCommand } from '../../lib/commands/DeleteNoteCommand';
import InstrumentRow from './InstrumentRow';
import StepGrid from './StepGrid';
import PianoRollMiniView from './PianoRollMiniView';
import InteractiveTimeline from './InteractiveTimeline';
import { PlusCircle } from 'lucide-react';

const STEP_WIDTH = 16;

export default function ChannelRack() {
  const instruments = useInstrumentsStore(state => state.instruments);
  const { patterns, activePatternId } = useArrangementStore();
  const { audioLoopLength } = usePlaybackStore();
  const { openPianoRollForInstrument, handleEditInstrument, togglePanel } = usePanelsStore();

  // Motor durumu ve playhead takibi için optimize edilmiş hook
  const { currentStep } = useGlobalPlayhead();

  // High-performance playhead için optimize edilmiş hook
  const {
    playheadRef,
    scrollContainerRef: optimizedScrollRef,
    jumpToPosition
  } = useOptimizedPlayhead(STEP_WIDTH);

  const instrumentListRef = useRef(null);
  const timelineContainerRef = useRef(null);

  const activePattern = patterns[activePatternId];

  // High-performance playhead artık useOptimizedPlayhead hook'u tarafından yönetiliyor
  // GPU acceleration ve direct DOM manipulation ile smooth hareket

  // Custom scroll synchronization for Channel Rack
  useEffect(() => {
    const mainGrid = optimizedScrollRef.current;
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
            currentPosition={currentStep}
            onJumpToPosition={jumpToPosition}
          />
        </div>
      </div>
      <div ref={optimizedScrollRef} className="channel-rack-layout__grid-scroll-area">
        <div style={{ width: audioLoopLength * STEP_WIDTH, height: totalContentHeight }} className="channel-rack-layout__grid-content">
          <div
            ref={playheadRef}
            className="channel-rack-layout__playhead playhead playhead--performance-optimized"
            style={{
              height: totalContentHeight,
              pointerEvents: 'none'
            }}
          />
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