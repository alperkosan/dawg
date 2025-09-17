import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useThemeStore } from '../../store/useThemeStore';
import InstrumentRow from './InstrumentRow';
import StepGrid from './StepGrid';
import PianoRollMiniView from './PianoRollMiniView';
import { PlaybackAnimatorService } from '../../lib/core/PlaybackAnimatorService';
import './ChannelRack.css';

const MIN_VISIBLE_BARS = 4;
const BAR_WIDTH = 256;
const RULER_HEIGHT = 32; // Zaman cetveli yüksekliği için sabit

export default function ChannelRack({ audioEngineRef }) {
  const instruments = useInstrumentsStore(state => state.instruments);
  const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();
  const { loopLength } = usePlaybackStore();
  const { openPianoRollForInstrument, handleEditInstrument } = usePanelsStore();
  const activeTheme = useThemeStore(state => state.getActiveTheme());

  // DEĞİŞİKLİK: Ref'in adı daha anlaşılır hale getirildi. Bu artık ana kaydırma alanıdır.
  const scrollContainerRef = useRef(null);
  const playheadRef = useRef(null);
  const timelineRef = useRef(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [jumpToPosition, setJumpToPosition] = useState(null);

  const activePattern = patterns[activePatternId];

  const calculatePatternLength = useCallback(() => {
    if (!activePattern) return 64;
    let maxStep = 0;
    Object.values(activePattern.data).forEach(notes => {
      if (Array.isArray(notes)) {
        notes.forEach(note => {
          if (note.time > maxStep) maxStep = note.time;
        });
      }
    });
    const requiredBars = Math.ceil((maxStep + 1) / 16);
    const minBars = Math.max(MIN_VISIBLE_BARS, requiredBars + 1);
    return minBars * 16;
  }, [activePattern]);

  const patternLength = calculatePatternLength();

  const handleTimelineClick = (e) => {
    // DEĞİŞİKLİK: Fonksiyon artık mükemmel hizalama ile çalışıyor.
    if (!timelineRef.current || !audioEngineRef?.current || !scrollContainerRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const step = Math.floor(clickX / 16);
    const bar = Math.floor(step / 16) + 1;
    
    audioEngineRef.current.jumpToBar(bar);
    setJumpToPosition(step);
    
    setTimeout(() => setJumpToPosition(null), 300);
  };

  const handleTimelineHover = (e) => {
    if (!timelineRef.current || !scrollContainerRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const hoverX = e.clientX - rect.left + scrollLeft;
    const step = Math.floor(hoverX / 16);
    setSelectedPosition(step);
  };

  useEffect(() => {
    const updatePlayhead = (progress) => {
      if (playheadRef.current) {
        const position = progress * patternLength * 16;
        playheadRef.current.style.transform = `translateX(${position}px)`;
      }
    };

    PlaybackAnimatorService.subscribe(updatePlayhead);
    return () => PlaybackAnimatorService.unsubscribe(updatePlayhead);
  }, [patternLength]);

  const handleNoteToggle = useCallback((instrumentId, step) => {
    const instrument = instruments.find(i => i.id === instrumentId);
    if (!instrument || !activePattern) return;

    const currentNotes = activePattern.data[instrumentId] || [];
    const existingNoteIndex = currentNotes.findIndex(note => note.time === step);

    let newNotes;
    if (existingNoteIndex >= 0) {
      newNotes = currentNotes.filter((_, index) => index !== existingNoteIndex);
    } else {
      newNotes = [...currentNotes, { 
        id: `note_${step}_${Date.now()}`, 
        time: step, 
        pitch: 'C4', 
        velocity: 1, 
        duration: '16n' 
      }];
    }

    updatePatternNotes(activePatternId, instrumentId, newNotes);
    audioEngineRef?.current?.reschedule();
  }, [instruments, activePattern, activePatternId, updatePatternNotes, audioEngineRef]);

  return (
    <div className="channel-rack">
      {/* Header */}
      <div className="channel-rack-header" style={{
        backgroundColor: activeTheme.colors.surface,
        borderBottom: `1px solid ${activeTheme.colors.border}`
      }}>
        <div className="pattern-selector">
          <span style={{ color: activeTheme.colors.muted }}>Pattern:</span>
          <span style={{ color: activeTheme.colors.text }}>{activePattern?.name || 'Pattern 1'}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="channel-rack-content">
        {/* Enstrüman Sütunu (Sol Taraf) */}
        <div className="instruments-column" style={{
          backgroundColor: activeTheme.colors.surface,
          borderRight: `1px solid ${activeTheme.colors.border}`
        }}>
          {/* YENİ: Zaman cetveliyle hizalamak için boş bir başlık alanı */}
          <div className="instrument-header-spacer" style={{ height: `${RULER_HEIGHT}px` }} />
          {instruments.filter(Boolean).map((instrument) => (
            <InstrumentRow
              key={instrument.id}
              instrument={instrument}
              onPianoRollClick={() => openPianoRollForInstrument(instrument)}
              onEditClick={() => handleEditInstrument(instrument, audioEngineRef.current)}
              audioEngineRef={audioEngineRef}
            />
          ))}
        </div>

        {/* Kaydırılabilir Grid Alanı (Sağ Taraf) */}
        <div 
          ref={scrollContainerRef}
          className="grid-scroll-container"
        >
          {/* Zaman Cetveli ve Grid'i içeren sarmalayıcı */}
          <div className="grid-content-wrapper" style={{ width: `${patternLength * 16}px` }}>
            {/* YENİ: Zaman Cetveli artık kayan alanın içinde ve "sticky" */}
            <div 
              ref={timelineRef}
              className="timeline-ruler"
              onMouseMove={handleTimelineHover}
              onMouseLeave={() => setSelectedPosition(null)}
              onClick={handleTimelineClick}
            >
              {Array.from({ length: Math.ceil(patternLength / 16) }, (_, i) => (
                <div key={i} className="timeline-bar" style={{ left: `${i * BAR_WIDTH}px`, color: activeTheme.colors.muted }}>
                  <span>{i + 1}</span>
                  {[1, 2, 3].map(beat => (
                    <div key={beat} className="beat-marker" style={{ left: `${beat * 64}px`, backgroundColor: activeTheme.colors.border }} />
                  ))}
                </div>
              ))}
              {selectedPosition !== null && (
                <div className="timeline-hover-indicator" style={{ left: `${selectedPosition * 16}px`, backgroundColor: activeTheme.colors.primary + '40' }} />
              )}
              {jumpToPosition !== null && (
                <div className="timeline-jump-indicator" style={{ left: `${jumpToPosition * 16}px`, backgroundColor: activeTheme.colors.accent }} />
              )}
            </div>

            {/* Playhead */}
            <div 
              ref={playheadRef}
              className="playhead"
              style={{ 
                backgroundColor: activeTheme.colors.accent,
              }}
            />

            {/* Step Grids veya Piano Roll Mini Views */}
            {instruments.filter(Boolean).map((instrument) => {
              const notes = activePattern?.data[instrument.id] || [];
              if (instrument.pianoRoll) {
                return <PianoRollMiniView key={instrument.id} instrument={instrument} notes={notes} patternLength={patternLength} theme={activeTheme} onNoteClick={() => openPianoRollForInstrument(instrument)} />;
              } else {
                return <StepGrid key={instrument.id} instrumentId={instrument.id} notes={notes} totalSteps={patternLength} onNoteToggle={handleNoteToggle} theme={activeTheme} />;
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}