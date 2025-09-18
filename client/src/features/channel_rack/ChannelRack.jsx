import React, { useRef, useEffect, useCallback } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useThemeStore } from '../../store/useThemeStore';
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

import './ChannelRack.css';

const RULER_HEIGHT = 48;
const ROW_HEIGHT = 64;
const INSTRUMENT_COLUMN_WIDTH = 320;
const STEP_WIDTH = 16;

// DÜZELTME: Bileşen artık 'audioEngineRef' prop'unu almıyor.
export default function ChannelRack() {
  const activeTheme = useThemeStore(state => state.getActiveTheme());
  const instruments = useInstrumentsStore(state => state.instruments);
  const { patterns, activePatternId } = useArrangementStore();
  const { loopLength, transportStep } = usePlaybackStore();
  const { jumpToBar, jumpToStep } = usePlaybackStore.getState();
  const { openPianoRollForInstrument, handleEditInstrument, togglePanel } = usePanelsStore();
  const audioLoopLength = usePlaybackStore(state => state.audioLoopLength);

  const scrollContainerRef = useRef(null);
  const playheadRef = useRef(null);
  
  const activePattern = patterns[activePatternId];

  useEffect(() => {
    const updatePlayhead = (progress) => {
      if (playheadRef.current) {
        const position = progress * audioLoopLength * STEP_WIDTH;
        playheadRef.current.style.transform = `translateX(${position}px)`;
      }
    };
    PlaybackAnimatorService.subscribe(updatePlayhead);
    return () => PlaybackAnimatorService.unsubscribe(updatePlayhead);
  }, [audioLoopLength]);

  const handleNoteToggle = useCallback((instrumentId, step) => {
    const activePattern = patterns[activePatternId];
    if (!activePattern) return;
    const currentNotes = activePattern.data[instrumentId] || [];
    const existingNote = currentNotes.find(note => note.time === step);
    
    if (existingNote) {
      commandManager.execute(new DeleteNoteCommand(instrumentId, existingNote));
    } else {
      commandManager.execute(new AddNoteCommand(instrumentId, step));
    }
  }, [activePatternId, patterns]);

  const totalContentHeight = RULER_HEIGHT + (instruments.length + 1) * ROW_HEIGHT;

  return (
    <div className="rack-container-v3" style={{ backgroundColor: activeTheme.colors.background }}>
      <div 
        ref={scrollContainerRef} 
        className="rack-scroll-container-v3"
      >
        <div 
          className="rack-content-wrapper-v3" 
          style={{ height: `${totalContentHeight}px` }}
        >
          <div
            className="instrument-column-sticky-v3"
            style={{
              width: `${INSTRUMENT_COLUMN_WIDTH}px`,
              backgroundColor: activeTheme.colors.surface,
              height: `${totalContentHeight}px`
            }}
          >
            <div className="rack-header-v3" style={{ height: `${RULER_HEIGHT}px`, borderBottom: `1px solid ${activeTheme.colors.border}` }}>
               Pattern: {activePattern?.name || 'Pattern 1'}
            </div>
            {instruments.map(inst => (
              <InstrumentRow
                key={inst.id}
                instrument={inst}
                onPianoRollClick={() => openPianoRollForInstrument(inst)}
                onEditClick={() => handleEditInstrument(inst)}
              />
            ))}
             <div
              className="add-instrument-row"
              style={{ height: `${ROW_HEIGHT}px`, borderTop: `1px solid ${activeTheme.colors.border}`}}
              onClick={() => togglePanel('file-browser')}
            >
              <PlusCircle size={20} className="add-instrument-icon" />
              <span className="add-instrument-text">Add instrument...</span>
            </div>
          </div>
          
          <div 
            className="grid-area-v3" 
            style={{ width: `${loopLength * STEP_WIDTH}px`, marginLeft: `${INSTRUMENT_COLUMN_WIDTH}px` }}
          >
            <div
              className="timeline-sticky-v3"
              style={{ height: `${RULER_HEIGHT}px`, backgroundColor: activeTheme.colors.surface, borderBottom: `1px solid ${activeTheme.colors.border}` }}
            >
              <InteractiveTimeline
                  loopLength={loopLength}
                  currentPosition={transportStep}
                  onJumpToBar={(bar) => jumpToBar(bar)}
                  onJumpToPosition={(step) => jumpToStep(step)}
                  theme={activeTheme}
              />
            </div>
            <div 
              ref={playheadRef} 
              className="playhead-v3" 
              style={{ 
                backgroundColor: activeTheme.colors.accent, 
                height: `${totalContentHeight}px`,
              }} 
            />

            <div className="grid-rows-container-v3">
              {instruments.map((inst) => (
                <div key={inst.id} className="grid-row-v3" style={{ height: `${ROW_HEIGHT}px` }}>
                   {inst.pianoRoll ? (
                    <PianoRollMiniView instrument={inst} notes={activePattern?.data[inst.id] || []} patternLength={loopLength} theme={activeTheme} onNoteClick={() => openPianoRollForInstrument(inst)} />
                  ) : (
                    <StepGrid instrumentId={inst.id} notes={activePattern?.data[inst.id] || []} totalSteps={loopLength} onNoteToggle={handleNoteToggle} theme={activeTheme} />
                  )}
                </div>
              ))}
              <div style={{ height: `${ROW_HEIGHT}px` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
