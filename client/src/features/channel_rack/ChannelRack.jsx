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
// CSS import'u artık gerekli değil, main.css üzerinden yönetiliyor.

const STEP_WIDTH = 16;

export default function ChannelRack() {
  const instruments = useInstrumentsStore(state => state.instruments);
  const { patterns, activePatternId } = useArrangementStore();
  const { loopLength, audioLoopLength } = usePlaybackStore();
  const { openPianoRollForInstrument, handleEditInstrument, togglePanel } = usePanelsStore();
  
  const playheadRef = useRef(null);
  const activePattern = patterns[activePatternId];

  // Playhead animasyonu
  useEffect(() => {
    const updatePlayhead = (progress) => {
      if (playheadRef.current) {
        // audioLoopLength, notaların gerçek uzunluğudur.
        const position = progress * audioLoopLength * STEP_WIDTH;
        playheadRef.current.style.transform = `translateX(${position}px)`;
      }
    };
    PlaybackAnimatorService.subscribe(updatePlayhead);
    return () => PlaybackAnimatorService.unsubscribe(updatePlayhead);
  }, [audioLoopLength]);

  // Nota ekleme/silme işlemi (Komut Yöneticisi ile)
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
  const contentHeight = 48 + (instruments.length + 1) * 64;

  return (
    <div className="channel-rack">
      <div className="channel-rack__scroll-container">
        <div className="channel-rack__content" style={{ height: `${contentHeight}px` }}>
          
          {/* Sol Taraf: Enstrüman Listesi (Sticky) */}
          <div className="channel-rack__instruments">
            <div className="channel-rack__header">
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
              className="channel-rack__add-row"
              onClick={() => togglePanel('file-browser')}
            >
              <PlusCircle size={20} className="channel-rack__add-row-icon" />
              <span className="channel-rack__add-row-text">Add instrument...</span>
            </div>
          </div>
          
          {/* Sağ Taraf: Grid Alanı (Scrollable) */}
          <div className="channel-rack__grid-area">
            <div className="channel-rack__rows" style={{ width: `${totalGridWidth}px`}}>
              {/* Timeline (Sticky) */}
              <div className="channel-rack__timeline" style={{ width: `${totalGridWidth}px` }}>
                <InteractiveTimeline
                  loopLength={loopLength}
                  // Diğer proplar...
                />
              </div>

              {/* Playhead */}
              <div ref={playheadRef} className="channel-rack__playhead" style={{ height: `${contentHeight}px` }} />

              {/* Grid Satırları */}
              {instruments.map((inst) => (
                <div key={inst.id} className="channel-rack__grid-row">
                   {inst.pianoRoll ? (
                    <PianoRollMiniView instrument={inst} notes={activePattern?.data[inst.id] || []} patternLength={loopLength} />
                  ) : (
                    <StepGrid instrumentId={inst.id} notes={activePattern?.data[inst.id] || []} totalSteps={loopLength} onNoteToggle={handleNoteToggle} />
                  )}
                </div>
              ))}
              {/* "Add" satırı için boş bir grid satırı */}
              <div className="channel-rack__grid-row" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
