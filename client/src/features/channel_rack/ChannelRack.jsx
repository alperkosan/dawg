import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useThemeStore } from '../../store/useThemeStore';
import { PlaybackAnimatorService } from '../../lib/core/PlaybackAnimatorService';

// Bileşenleri import ediyoruz
import InstrumentRow from './InstrumentRow';
import StepGrid from './StepGrid';
import PianoRollMiniView from './PianoRollMiniView';

// Stil dosyasını import ediyoruz
import './ChannelRack.css';

// Sabitler
const RULER_HEIGHT = 32;
const ROW_HEIGHT = 64;
const INSTRUMENT_COLUMN_WIDTH = 320;
const STEP_WIDTH = 16;
const BAR_WIDTH = STEP_WIDTH * 16;

export default function ChannelRack({ audioEngineRef }) {
  const activeTheme = useThemeStore(state => state.getActiveTheme());

  const instruments = useInstrumentsStore(state => state.instruments);
  const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();
  
  // === DEĞİŞİKLİK BURADA ===
  // Artık loopLength'i doğrudan merkezi store'dan okuyoruz.
  // Kendi hesaplamamızı (useMemo) tamamen kaldırıyoruz.
  const loopLength = usePlaybackStore(state => state.loopLength);
  const audioLoopLength = usePlaybackStore(state => state.audioLoopLength);
  
  const { openPianoRollForInstrument, handleEditInstrument } = usePanelsStore();
  
  const scrollContainerRef = useRef(null);
  const playheadRef = useRef(null);
  
  const activePattern = patterns[activePatternId];
  
  useEffect(() => {
    const updatePlayhead = (progress) => {
      if (playheadRef.current) {
        // Playhead pozisyonu artık audioLoopLength'e göre hesaplanıyor.
        const position = progress * audioLoopLength * STEP_WIDTH;
        playheadRef.current.style.transform = `translateX(${position}px)`;
      }
    };
    PlaybackAnimatorService.subscribe(updatePlayhead);
    return () => PlaybackAnimatorService.unsubscribe(updatePlayhead);
  }, [audioLoopLength]); // Bağımlılığı audioLoopLength olarak değiştiriyoruz.

  const handleNoteToggle = useCallback((instrumentId, step) => {
    const currentNotes = activePattern?.data[instrumentId] || [];
    const noteExists = currentNotes.some(note => note.time === step);
    let newNotes;
    if (noteExists) {
      newNotes = currentNotes.filter(note => note.time !== step);
    } else {
      newNotes = [...currentNotes, { id: `note_${step}_${Date.now()}`, time: step, pitch: 'C4', velocity: 1, duration: '16n' }];
    }
    updatePatternNotes(activePatternId, instrumentId, newNotes);
    usePlaybackStore.getState().updateLoopLength();
    audioEngineRef.current?.reschedule();
  }, [activePattern, activePatternId, updatePatternNotes, audioEngineRef]);

  const totalContentHeight = RULER_HEIGHT + instruments.length * ROW_HEIGHT;

  // === YENİ VE DÜZELTİLMİŞ ZAMAN CETVELİ OLUŞTURMA FONKSİYONU ===
  const renderTimelineMarkers = () => {
    const markers = [];
    const totalBars = Math.ceil(loopLength / 16); // uiPatternLength -> loopLength
    
    for (let i = 0; i < totalBars; i++) {
      const barX = i * BAR_WIDTH;
      // Ana ölçü çizgisi ve numarası
      markers.push(
        <div key={`bar-${i}`} className="timeline-marker bar-line" style={{ left: `${barX}px`, backgroundColor: activeTheme.colors.muted }}>
          <span className="timeline-label" style={{ color: activeTheme.colors.text }}>{i + 1}</span>
        </div>
      );
      // Vuruş (beat) çizgileri
      for (let j = 1; j < 4; j++) {
        const beatX = barX + (j * STEP_WIDTH * 4);
        markers.push(<div key={`beat-${i}-${j}`} className="timeline-marker beat-line" style={{ left: `${beatX}px`, backgroundColor: activeTheme.colors.border }} />);
      }
    }
    return markers;
  };

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
              {/* DÜZELTİLMİŞ ÇAĞRI: Artık yeni fonksiyonu kullanıyoruz */}
              {renderTimelineMarkers()}
            </div>

            <div ref={playheadRef} className="playhead-v3" style={{ backgroundColor: activeTheme.colors.accent, height: `${totalContentHeight}px` }} />

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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}