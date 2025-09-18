import React, { useRef, useEffect, useCallback } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useThemeStore } from '../../store/useThemeStore';
import { usePanelsStore } from '../../store/usePanelsStore';
// ONARIM: PlaybackAnimatorService'i import ediyoruz.
import { PlaybackAnimatorService } from '../../lib/core/PlaybackAnimatorService';

// Bileşenleri import ediyoruz
import InstrumentRow from './InstrumentRow';
import StepGrid from './StepGrid';
import PianoRollMiniView from './PianoRollMiniView';
import InteractiveTimeline from './InteractiveTimeline';
import { PlusCircle } from 'lucide-react';

import './ChannelRack.css';

const RULER_HEIGHT = 48; // Zaman cetveli için yükseklik
const ROW_HEIGHT = 64;
const INSTRUMENT_COLUMN_WIDTH = 320;
const STEP_WIDTH = 16;

export default function ChannelRack({ audioEngineRef }) {
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
  
  // ONARIM: PlaybackAnimatorService'e abone olup playhead'i güncelliyoruz
  useEffect(() => {
    const updatePlayhead = (progress) => {
      if (playheadRef.current) {
        const position = progress * audioLoopLength * STEP_WIDTH;
        playheadRef.current.style.transform = `translateX(${position}px)`;
      }
    };
    PlaybackAnimatorService.subscribe(updatePlayhead);
    return () => PlaybackAnimatorService.unsubscribe(updatePlayhead);
  }, [audioLoopLength]); // Sadece audioLoopLength değiştiğinde yeniden abone ol

  const handleNoteToggle = useCallback((instrumentId, step) => {
    const currentNotes = activePattern?.data[instrumentId] || [];
    const noteExists = currentNotes.some(note => note.time === step);
    let newNotes;
    if (noteExists) {
      newNotes = currentNotes.filter(note => note.time !== step);
    } else {
      newNotes = [...currentNotes, { id: `note_${step}_${Date.now()}`, time: step, pitch: 'C4', velocity: 1, duration: '16n' }];
    }
    useInstrumentsStore.getState().updatePatternNotes(instrumentId, newNotes);
    usePlaybackStore.getState().updateLoopLength();
    audioEngineRef.current?.reschedule();
  }, [activePattern, activePatternId, audioEngineRef]);

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
          {/* Sol Sütun: Enstrüman Listesi */}
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
                onEditClick={() => handleEditInstrument(inst, audioEngineRef.current)}
                audioEngineRef={audioEngineRef}
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
          
          {/* Sağ Taraf: Grid Alanı */}
          <div 
            className="grid-area-v3" 
            style={{ width: `${loopLength * STEP_WIDTH}px`, marginLeft: `${INSTRUMENT_COLUMN_WIDTH}px` }}
          >
            {/* Üst Satır: Zaman Cetveli */}
            <div
              className="timeline-sticky-v3"
              style={{ height: `${RULER_HEIGHT}px`, backgroundColor: activeTheme.colors.surface, borderBottom: `1px solid ${activeTheme.colors.border}` }}
            >
              <InteractiveTimeline
                  loopLength={loopLength}
                  currentPosition={transportStep}
                  onJumpToBar={(bar) => jumpToBar(bar, audioEngineRef.current)}
                  onJumpToPosition={(step) => jumpToStep(step, audioEngineRef.current)}
                  theme={activeTheme}
              />
            </div>
            {/* Playhead artık burada, animasyon servisinden gelen veriyle güncellenecek */}
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


