// src/features/piano_roll/components/ui/GhostNotes.jsx
import React, { useMemo } from 'react';
import { useArrangementStore } from '../../../../store/useArrangementStore';
import { useInstrumentsStore } from '../../../../store/useInstrumentsStore';
import { useMixerStore } from '../../../../store/useMixerStore';
import { usePianoRollStore } from '../../store';
import { Note } from './Note';

export const GhostNotes = React.memo(({ currentInstrumentId, viewport }) => {
  const { showGhostNotes } = usePianoRollStore();
  const { patterns, activePatternId } = useArrangementStore();
  const instruments = useInstrumentsStore(state => state.instruments);
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  
  const ghostNotes = useMemo(() => {
    if (!showGhostNotes || !activePatternId) return [];
    
    const activePattern = patterns[activePatternId];
    if (!activePattern) return [];
    
    const result = [];
    
    Object.entries(activePattern.data || {}).forEach(([instrumentId, notes]) => {
      if (instrumentId === currentInstrumentId || !notes || notes.length === 0) return;
      
      const instrument = instruments.find(i => i.id === instrumentId);
      const track = mixerTracks.find(t => t.id === instrument?.mixerTrackId);
      const color = track?.color || '#6b7280';
      
      notes.forEach(note => {
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
    <div className="ghost-notes-layer">
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
});
