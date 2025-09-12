import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import PianoKeyboard from './PianoKeyboard';
import Note from './Note';
import { PianoRollToolbar } from './PianoRollToolbar';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { usePianoRollStore, NOTES, SCALES } from '../../store/usePianoRollStore';
import * as Tone from 'tone';

const totalOctaves = 8;
const totalKeys = totalOctaves * 12;

function PianoRoll({ instrument, audioEngineRef }) {
  const containerRef = useRef(null);

  const [interaction, setInteraction] = useState(null);

  const { handleNotesChange } = useInstrumentsStore.getState();
  const currentInstrument = useInstrumentsStore(state => state.instruments.find(i => i.id === instrument?.id));
  const loopLength = useInstrumentsStore(state => state.loopLength);
  
  const { scale, showScaleHighlighting, activeTool, handleZoom, zoomX, zoomY } = usePianoRollStore();
  
  const stepWidth = 40 * zoomX;
  const keyHeight = 20 * zoomY;

  // Wheel (fare tekerleği) olaylarını yöneten ana fonksiyon
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWheel = (e) => {
        // Ctrl/Cmd tuşu basılıyken zoom yap
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoom(e.deltaX, e.deltaY);
        } else {
            // Normal tekerlek dikey, Shift+tekerlek yatay kaydırır
            // Not: e.preventDefault() demediğimiz için doğal kaydırma davranışı çalışır.
            // Bu, önceki koddaki manuel scrollTop atamasından daha sağlıklıdır.
            if (e.shiftKey) {
                 e.preventDefault(); // Yatay kaydırmada sayfanın kaymasını engelle
                 container.scrollLeft += e.deltaY;
            }
        }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleZoom]);

  const yToNote = useCallback((y) => {
    const indexFromTop = Math.floor(y / keyHeight);
    const noteIndexAbs = totalKeys - 1 - indexFromTop;
    const octave = Math.floor(noteIndexAbs / 12);
    const noteName = NOTES[noteIndexAbs % 12];
    return `${noteName}${octave}`;
  }, [keyHeight]);

  const noteToY = useCallback((pitch) => {
    const octave = parseInt(pitch.slice(-1), 10);
    const noteName = pitch.slice(0, -1);
    const noteIndex = NOTES.indexOf(noteName);
    const indexFromTop = totalKeys - 1 - (octave * 12 + noteIndex);
    return indexFromTop * keyHeight;
  }, [keyHeight]);
  
  const xToStep = useCallback((x) => Math.floor(x/stepWidth), [stepWidth]);
  const stepToX = useCallback((step) => step * stepWidth, [stepWidth]);

  const handleMouseDown = useCallback((e) => {
    if (!e.currentTarget || !currentInstrument) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const time = xToStep(x);
    const pitch = yToNote(y);
    const clickedNote = currentInstrument.notes.find(n => {
        const durationInSteps = Tone.Time(n.duration).toSeconds() / Tone.Time('16n').toSeconds();
        return n.pitch === pitch && time >= n.time && time < n.time + durationInSteps;
    });

    if (activeTool === 'pencil') {
        if (clickedNote) {
            const newNotes = currentInstrument.notes.filter(n => n !== clickedNote);
            handleNotesChange(currentInstrument.id, newNotes, audioEngineRef.current);
        } else {
            const newNote = { time, pitch, velocity: 1.0, duration: '16n' };
            const newNotes = [...currentInstrument.notes, newNote];
            handleNotesChange(currentInstrument.id, newNotes, audioEngineRef.current);
            setInteraction({ type: 'drawing', pitch });
        }
    } else if (activeTool === 'eraser') {
        if(clickedNote) {
            const newNotes = currentInstrument.notes.filter(n => n !== clickedNote);
            handleNotesChange(currentInstrument.id, newNotes, audioEngineRef.current);
        }
        setInteraction({ type: 'erasing'});
    }
  }, [activeTool, currentInstrument, xToStep, yToNote, handleNotesChange, audioEngineRef]);

  const handleMouseMove = useCallback((e) => {
    if (!interaction || !e.currentTarget || !currentInstrument) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = xToStep(x);
    const pitch = yToNote(y);

    if (interaction.type === 'erasing') {
         const noteToDelete = currentInstrument.notes.find(n => {
            const durationInSteps = Tone.Time(n.duration).toSeconds() / Tone.Time('16n').toSeconds();
            return n.pitch === pitch && time >= n.time && time < n.time + durationInSteps;
         });
        if(noteToDelete) {
             const newNotes = currentInstrument.notes.filter(n => n !== noteToDelete);
             handleNotesChange(currentInstrument.id, newNotes, audioEngineRef.current);
        }
    }
  }, [interaction, currentInstrument, xToStep, yToNote, handleNotesChange, audioEngineRef]);

  const handleMouseUp = useCallback(() => {
    setInteraction(null);
  }, []);

  if (!currentInstrument) {
    return (
      <div className="w-full h-full flex flex-col">
        <PianoRollToolbar />
        <div className="flex-grow flex items-center justify-center bg-gray-800 text-gray-500">
          Düzenlemek için bir enstrüman seçin.
        </div>
      </div>
    );
  }

  const scaleNotes = showScaleHighlighting ? new Set(SCALES[scale.type].map(i => (NOTES.indexOf(scale.root) + i) % 12)) : null;
  const gridWidth = loopLength * stepWidth;
  const gridHeight = totalKeys * keyHeight;

  // Izgara desenini SVG olarak oluşturma (performans için useMemo içinde)
  const gridSVG = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= loopLength; i++) {
        const color = i % 16 === 0 ? "rgba(150, 150, 150, 0.4)" : i % 4 === 0 ? "rgba(100, 100, 100, 0.3)" : "rgba(80, 80, 80, 0.3)";
        lines.push(`<line x1="${i*stepWidth}" y1="0" x2="${i*stepWidth}" y2="${gridHeight}" stroke="${color}" stroke-width="1"/>`);
    }
     for (let i = 0; i <= totalKeys; i++) {
        const noteIndex = (totalKeys - 1 - i) % 12;
        const isBlackKey = [1,3,6,8,10].includes(noteIndex);
        if(!isBlackKey)
            lines.push(`<line x1="0" y1="${i*keyHeight}" x2="${gridWidth}" y2="${i*keyHeight}" stroke="rgba(80, 80, 80, 0.3)" stroke-width="1"/>`);
    }
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${gridWidth}" height="${gridHeight}">${lines.join('')}</svg>`)}`;
  }, [stepWidth, keyHeight, loopLength, gridWidth, gridHeight]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-white">
      <PianoRollToolbar />
      {/* ANA KAYDIRILABİLİR ALAN: Artık tek bir tane var ve her şeyi kapsıyor */}
      <div ref={containerRef} className="flex-grow min-h-0 overflow-auto relative flex">
          {/* İçerik wrapper'ı: Piyano ve grid'i yan yana tutar */}
          <div className="flex relative" style={{ width: gridWidth + 96, height: gridHeight }}>
              {/* PİYANO: Artık "sticky" pozisyonlu. Yani kaydırma alanına yapışık kalacak */}
              <PianoKeyboard keyHeight={keyHeight} scaleNotes={scaleNotes} />
              
              {/* NOTA GRID'İ: Mouse olayları artık doğrudan bu alanda dinleniyor */}
              <div 
                  className="relative cursor-text"
                  style={{ width: gridWidth, height: gridHeight }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
              >
                  <div 
                      className="absolute inset-0" 
                      style={{ 
                          backgroundColor: '#1e293b', 
                          backgroundImage: `url('${gridSVG}')` 
                      }}
                  />
                  {currentInstrument.notes.map((note, index) => (
                    <Note key={`${note.time}-${note.pitch}-${index}`} note={note} noteToY={noteToY} stepToX={stepToX} keyHeight={keyHeight} stepWidth={stepWidth} />
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
}

export default PianoRoll;