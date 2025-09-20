import React, { useMemo } from 'react';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { useInstrumentsStore } from '../../../store/useInstrumentsStore';
import { useMixerStore } from '../../../store/useMixerStore';
import { usePianoRollStore } from '../store/usePianoRollStore';
import Note from './Note'; // Mevcut Note bileşenimizi kullanıyoruz

export function GhostNotes({ currentInstrumentId, viewport }) {
  const { showGhostNotes } = usePianoRollStore();
  const { patterns, activePatternId } = useArrangementStore();
  const instruments = useInstrumentsStore(state => state.instruments);
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  
  const ghostNotes = useMemo(() => {
    if (!showGhostNotes || !activePatternId) return [];
    
    const activePattern = patterns[activePatternId];
    if (!activePattern) return [];
    
    const result = [];
    
    Object.entries(activePattern.data).forEach(([instrumentId, notes]) => {
      if (instrumentId === currentInstrumentId || !notes || notes.length === 0) return;
      
      const instrument = instruments.find(i => i.id === instrumentId);
      const track = mixerTracks.find(t => t.id === instrument?.mixerTrackId);
      const color = track?.color || '#6b7280'; // Gri renk varsayılan
      
      notes.forEach(note => {
        // Sadece görünür alandaki hayalet notaları hesapla
        if (viewport.isNoteVisible(note)) {
          result.push({
            ...note,
            ghostId: `${instrumentId}-${note.id}`,
            color
          });
        }
      });
    });
    
    return result;
  }, [showGhostNotes, activePatternId, patterns, instruments, mixerTracks, currentInstrumentId, viewport]);
  
  if (!showGhostNotes) return null;
  
  return (
    <div className="piano-roll__ghost-notes-layer">
      {ghostNotes.map(note => (
        <Note
          key={note.ghostId}
          note={note}
          isGhost={true}
          ghostColor={note.color}
          viewport={viewport}
        />
      ))}
    </div>
  );
};
