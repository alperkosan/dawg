import React, { useRef, useEffect, useCallback } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { PlaybackAnimatorService } from '../../lib/core/PlaybackAnimatorService';
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
  const { loopLength, audioLoopLength, transportStep, jumpToStep } = usePlaybackStore();
  const { openPianoRollForInstrument, handleEditInstrument, togglePanel } = usePanelsStore();
  
  const playheadRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const timelineRef = useRef(null);
  const instrumentListRef = useRef(null);

  const activePattern = patterns[activePatternId];

  // Playhead animasyonu ve scroll senkronizasyonu
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const syncScroll = () => {
      if (timelineRef.current) {
        timelineRef.current.scrollLeft = container.scrollLeft;
      }
      if (instrumentListRef.current) {
        instrumentListRef.current.scrollTop = container.scrollTop;
      }
    };

    const updatePlayhead = (progress) => {
      if (playheadRef.current) {
        const position = progress * audioLoopLength * STEP_WIDTH;
        playheadRef.current.style.transform = `translateX(${position}px)`;
      }
    };

    container.addEventListener('scroll', syncScroll);
    PlaybackAnimatorService.subscribe(updatePlayhead);

    return () => {
      container.removeEventListener('scroll', syncScroll);
      PlaybackAnimatorService.unsubscribe(updatePlayhead);
    };
  }, [audioLoopLength]);

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

  const totalGridWidth = loopLength * STEP_WIDTH;
  const totalContentHeight = (instruments.length + 1) * 64; // +1 for add row

  return (
    // Ana konteyner artık %100 yer kaplıyor
    <div className="channel-rack-layout">
      {/* KÖŞE */}
      <div className="channel-rack-layout__corner">
        Pattern: {activePattern?.name || '...'}
      </div>

      {/* ENSTRÜMAN LİSTESİ */}
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
          <div className="channel-rack__add-row" onClick={() => togglePanel('file-browser')}>
            <PlusCircle size={20} className="channel-rack__add-row-icon" />
            <span className="channel-rack__add-row-text">Add...</span>
          </div>
        </div>
      </div>

      {/* ZAMAN CETVELİ */}
      <div ref={timelineRef} className="channel-rack-layout__timeline">
        <div style={{ width: totalGridWidth }}>
          <InteractiveTimeline
            loopLength={loopLength}
            currentPosition={transportStep}
            onJumpToPosition={jumpToStep}
          />
        </div>
      </div>
      
      {/* ANA GRID ALANI (KAYDIRILABİLİR) */}
      <div ref={scrollContainerRef} className="channel-rack-layout__grid-scroll-area">
        <div style={{ width: totalGridWidth, height: totalContentHeight }} className="channel-rack-layout__grid-content">
          <div ref={playheadRef} className="channel-rack__playhead" style={{ height: totalContentHeight }} />
          {instruments.map(inst => (
            <div key={inst.id} className="channel-rack__grid-row">
              {inst.pianoRoll ? (
                <PianoRollMiniView notes={activePattern?.data[inst.id] || []} patternLength={loopLength} onNoteClick={() => openPianoRollForInstrument(inst)} />
              ) : (
                <StepGrid instrumentId={inst.id} notes={activePattern?.data[inst.id] || []} totalSteps={loopLength} onNoteToggle={handleNoteToggle} />
              )}
            </div>
          ))}
          <div className="channel-rack__grid-row" />
        </div>
      </div>
    </div>
  );
}