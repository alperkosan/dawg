import React, { useRef, useEffect, useCallback } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { usePlayheadTracking } from '../../hooks/useEngineState';
import { useSmoothPlayhead } from '../../hooks/useSmoothPlayhead';
import '../../styles/playhead-animations.css';
import { commandManager } from '../../lib/commands/CommandManager';
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
  const { currentStep, jumpToStep } = usePlayheadTracking();

  // Smooth playhead animasyonu için optimize edilmiş hook
  const {
    playheadRef,
    scrollContainerRef: smoothScrollRef
  } = useSmoothPlayhead(STEP_WIDTH);
  const timelineContainerRef = useRef(null);
  const instrumentListRef = useRef(null);

  const activePattern = patterns[activePatternId];

  // Smooth playhead artık useSmoothPlayhead hook'u tarafından yönetiliyor
  // Eski manual playhead yönetimi kaldırıldı - hook otomatik olarak hallediyor

  // Scroll senkronizasyonu - smooth scroll container kullan
  useEffect(() => {
    const container = smoothScrollRef.current;
    if (!container) return;

    const syncScroll = () => {
      if (timelineContainerRef.current) {
        timelineContainerRef.current.scrollLeft = container.scrollLeft;
      }
      if (instrumentListRef.current) {
        instrumentListRef.current.scrollTop = container.scrollTop;
      }
    };

    container.addEventListener('scroll', syncScroll);

    return () => {
      container.removeEventListener('scroll', syncScroll);
    };
  }, []);

  // Sol paneldeki tekerlek hareketini sağ panele yönlendirme
  useEffect(() => {
    const instrumentContainer = instrumentListRef.current;
    const mainScrollContainer = smoothScrollRef.current;
    if (!instrumentContainer || !mainScrollContainer) return;
    const handleWheelOnInstrumentList = (e) => {
      e.preventDefault();
      mainScrollContainer.scrollTop += e.deltaY;
    };
    instrumentContainer.addEventListener('wheel', handleWheelOnInstrumentList);
    return () => {
      instrumentContainer.removeEventListener('wheel', handleWheelOnInstrumentList);
    };
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
    <div className="channel-rack-layout">
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
            onJumpToPosition={jumpToStep}
          />
        </div>
      </div>
      <div ref={smoothScrollRef} className="channel-rack-layout__grid-scroll-area">
        <div style={{ width: totalGridWidth, height: totalContentHeight }} className="channel-rack-layout__grid-content">
          <div ref={playheadRef} className="channel-rack-layout__playhead playhead--smooth playhead--performance-optimized" style={{ height: totalContentHeight }} />
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