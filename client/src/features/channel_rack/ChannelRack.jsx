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
  const { audioLoopLength, transportStep, jumpToStep } = usePlaybackStore(); // loopLength kaldırıldı, sadece audioLoopLength kullanılıyor.
  const { openPianoRollForInstrument, handleEditInstrument, togglePanel } = usePanelsStore();
  
  const playheadRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const timelineContainerRef = useRef(null);
  const instrumentListRef = useRef(null);

  const activePattern = patterns[activePatternId];

  // Playhead animasyonu ve scroll senkronizasyonu
  useEffect(() => {
    const container = scrollContainerRef.current;
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
  }, [audioLoopLength]);

  // =====================================================================
  // === YENİ EKLENEN KOD BLOĞU BURASI ===
  // Bu useEffect, sol paneldeki tekerlek hareketini sağ panele yönlendirir.
  // =====================================================================
  useEffect(() => {
    const instrumentContainer = instrumentListRef.current;
    const mainScrollContainer = scrollContainerRef.current;

    if (!instrumentContainer || !mainScrollContainer) return;

    const handleWheelOnInstrumentList = (e) => {
      // Varsayılan davranışı engelle (bazen sayfanın kaymasına neden olabilir)
      e.preventDefault();
      // Ana scroll alanının dikey kaydırma pozisyonunu tekerlek hareketi kadar değiştir
      mainScrollContainer.scrollTop += e.deltaY;
    };

    // Olay dinleyicisini ekle
    instrumentContainer.addEventListener('wheel', handleWheelOnInstrumentList);

    // Bileşen kaldırıldığında olay dinleyicisini temizle
    return () => {
      instrumentContainer.removeEventListener('wheel', handleWheelOnInstrumentList);
    };
  }, []); // Bu effect'in sadece bir kez çalışması yeterlidir

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

  const totalGridWidth = audioLoopLength * STEP_WIDTH; // DÜZELTME: audioLoopLength kullanılıyor.
  const totalContentHeight = (instruments.length + 1) * 64;

  return (
    // ... JSX yapısında herhangi bir değişiklik yok ...
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
            currentPosition={transportStep}
            onJumpToPosition={jumpToStep}
          />
        </div>
      </div>
      
      <div ref={scrollContainerRef} className="channel-rack-layout__grid-scroll-area">
        <div style={{ width: totalGridWidth, height: totalContentHeight }} className="channel-rack-layout__grid-content">
          <div ref={playheadRef} className="channel-rack-layout__playhead" style={{ height: totalContentHeight }} />
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