// src/features/piano_roll_v2/PianoRoll.jsx
import React, { useRef, useEffect } from 'react';
import { Music } from 'lucide-react';
import { usePianoRollEngineV2 } from './hooks/usePianoRollEngineV2';
import { useNoteInteractionsV2 } from './hooks/useNoteInteractionsV2';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { PianoRollGrid } from './components/PianoRollGrid';
import { TimelineRuler } from './components/TimelineRuler';
import { PianoKeyboard } from './components/PianoKeyboard';
import { VirtualNotesRenderer } from './components/VirtualNotesRenderer';
import './styles/PianoRoll.css';

function PianoRoll({ instrument }) {
  const scrollContainerRef = useRef(null);
  const rulerContentRef = useRef(null);
  const keyboardContentRef = useRef(null);
  const { loopLength } = usePlaybackStore();

  const engine = usePianoRollEngineV2(scrollContainerRef, loopLength);
  const interactions = useNoteInteractionsV2(instrument?.id, engine);

  useEffect(() => {
    const { x, y } = engine.scroll;
    if (rulerContentRef.current) rulerContentRef.current.style.transform = `translateX(${-x}px)`;
    if (keyboardContentRef.current) keyboardContentRef.current.style.transform = `translateY(${-y}px)`;
  }, [engine.scroll]);
  
  if (!instrument) {
    return (
      <div className="prv2-placeholder">
        <Music size={48} className="prv2-placeholder__icon" />
        <h3 className="prv2-placeholder__title">Piano Roll</h3>
        <p className="prv2-placeholder__text">Düzenlemek için bir enstrüman seçin.</p>
      </div>
    );
  }

  return (
    <div className="prv2-container">
      <div className="prv2-main-grid">
        <div className="prv2-corner" />
        <div className="prv2-ruler-container">
          <div ref={rulerContentRef}><TimelineRuler engine={engine} /></div>
        </div>
        <div className="prv2-keyboard-container">
          <div ref={keyboardContentRef}><PianoKeyboard engine={engine} /></div>
        </div>
        <div 
          ref={scrollContainerRef} 
          className="prv2-grid-area-container"
          onMouseDown={interactions.onMouseDown}
          onMouseMove={interactions.onMouseMove}
          onMouseUp={interactions.onMouseUp}
        >
          <PianoRollGrid engine={engine} />
          <VirtualNotesRenderer 
            notes={interactions.notes}
            selectedNotes={interactions.selectedNotes}
            engine={engine}
            interaction={interactions.interaction}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(PianoRoll);