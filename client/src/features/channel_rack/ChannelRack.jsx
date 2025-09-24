import React, { useRef, useEffect, useCallback } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useGlobalPlayhead } from '../../hooks/useGlobalPlayhead';
import { useOptimizedPlayhead } from '../../hooks/useOptimizedPlayhead';
import { commandManager } from '../../lib/commands/CommandManager';
import { AddNoteCommand } from '../../lib/commands/AddNoteCommand';
import { DeleteNoteCommand } from '../../lib/commands/DeleteNoteCommand';
import InstrumentRow from './InstrumentRow';
import StepGrid from './StepGrid';
import PianoRollMiniView from './PianoRollMiniView';
import InteractiveTimeline from './InteractiveTimeline';
import { PlusCircle } from 'lucide-react';
import { createScrollSynchronizer, createWheelForwarder } from '../../lib/utils/scrollSync';

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
  const timelineContainerRef = useRef(null);
  const instrumentListRef = useRef(null);

  const activePattern = patterns[activePatternId];

  // High-performance playhead artık useOptimizedPlayhead hook'u tarafından yönetiliyor
  // GPU acceleration ve direct DOM manipulation ile smooth hareket

  // Scroll senkronizasyonu - Channel Rack içindeki paneller arası senkronizasyon gerekli
  useEffect(() => {
    const syncTargets = [
      { ref: timelineContainerRef, axis: 'x' },    // Timeline horizontal sync
      { ref: instrumentListRef, axis: 'y' }        // Instrument list vertical sync
    ];

    const cleanup = createScrollSynchronizer(optimizedScrollRef, syncTargets);
    return cleanup;
  }, []);

  // Instrument list'teki mouse wheel'i ana scroll'a yönlendirme (UX iyileştirmesi)
  useEffect(() => {
    const cleanup = createWheelForwarder(instrumentListRef, optimizedScrollRef, 'y');
    return cleanup;
  }, []);

  const handleNoteToggle = useCallback((instrumentId, step) => {
    if (!activePattern) return;
    const currentNotes = activePattern.data[instrumentId] || [];
    const existingNote = currentNotes.find(note => note.time === step);
    
    if (existingNote) {
      commandManager.execute(new DeleteNoteCommand(instrumentId, existingNote));
    } else {
      commandManager.execute(new AddNoteCommand(instrumentId, step));
    }
  }, [activePatternId, activePattern]);

  const totalGridWidth = audioLoopLength * STEP_WIDTH;
  const totalContentHeight = (instruments.length + 1) * 64;

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
        <div style={{ width: totalGridWidth, height: '100%' }}>
          <InteractiveTimeline
            loopLength={audioLoopLength}
            currentPosition={currentStep}
            onJumpToPosition={jumpToPosition}
          />
        </div>
      </div>
      <div ref={optimizedScrollRef} className="channel-rack-layout__grid-scroll-area">
        <div style={{ width: totalGridWidth, height: totalContentHeight }} className="channel-rack-layout__grid-content">
          <div ref={playheadRef} className="channel-rack-layout__playhead playhead playhead--performance-optimized" style={{ height: totalContentHeight }} />
          {instruments.map(inst => (
            <div key={inst.id} className="channel-rack-layout__grid-row">
              {inst.pianoRoll ? (
                <PianoRollMiniView notes={activePattern?.data[inst.id] || []} patternLength={audioLoopLength} onNoteClick={() => openPianoRollForInstrument(inst)} />
              ) : (
                <StepGrid instrumentId={inst.id} notes={activePattern?.data[inst.id] || []} totalSteps={audioLoopLength} onNoteToggle={handleNoteToggle} />
              )}
            </div>
          ))}
          <div className="channel-rack-layout__grid-row" />
        </div>
      </div>
    </div>
  );
}