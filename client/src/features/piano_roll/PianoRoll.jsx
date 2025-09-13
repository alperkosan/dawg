import React, { useRef, useState, useCallback, useMemo, useLayoutEffect, useEffect } from 'react';
import * as Tone from 'tone';
import PianoKeyboard from './PianoKeyboard';
import Note from './Note';
import { PianoRollToolbar } from './PianoRollToolbar';
import VelocityLane from './VelocityLane';
import ResizableHandle from '../../ui/ResizableHandle';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { usePianoRollStore, NOTES, SCALES } from '../../store/usePianoRollStore';
import { usePianoRollInteraction } from './usePianoRollInteraction';
import { usePlaybackAnimator } from '../../hooks/usePlaybackAnimator';

const totalOctaves = 8;
const totalKeys = totalOctaves * 12;

function PianoRoll({ instrument, audioEngineRef }) {
  const gridContainerRef = useRef(null);
  const playheadRef = useRef(null);
  const [gridScroll, setGridScroll] = useState({ left: 0, top: 0 });
  const KEYBOARD_WIDTH = 96;

  const lastMousePos = useRef({ x: 0, y: 0 });
  const prevZoom = useRef({ zoomX: 1, zoomY: 1 });

  const { handleNotesChange: storeHandleNotesChange } = useInstrumentsStore.getState();
  const currentInstrument = useInstrumentsStore(state => state.instruments.find(i => i.id === instrument?.id));
  const loopLength = useInstrumentsStore(state => state.loopLength);
  const { 
      gridSnapValue, scale, showScaleHighlighting, zoomX, zoomY,
      velocityLaneHeight, setVelocityLaneHeight, toggleVelocityLane,
      handleZoom,
  } = usePianoRollStore();
  
  const stepWidth = 40 * zoomX;
  const keyHeight = 20 * zoomY;
  const gridWidth = loopLength * stepWidth;
  const gridHeight = totalKeys * keyHeight;
  const snapSteps = useMemo(() => Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds(), [gridSnapValue]);
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  const pitchToIndex = useCallback((pitch) => (parseInt(pitch.slice(-1), 10) * 12 + NOTES.indexOf(pitch.slice(0, -1))), []);
  const indexToPitch = useCallback((index) => `${NOTES[index % 12]}${Math.floor(index / 12)}`, []);
  const noteToY = useCallback((pitch) => (totalKeys - 1 - pitchToIndex(pitch)) * keyHeight, [keyHeight, pitchToIndex]);
  const stepToX = useCallback((step) => step * stepWidth, [stepWidth]);
  
  const handleNotesChange = useCallback((newNotes) => {
    if (currentInstrument) {
        if (typeof newNotes === 'function') {
            storeHandleNotesChange(currentInstrument.id, newNotes(currentInstrument.notes));
        } else {
            storeHandleNotesChange(currentInstrument.id, newNotes);
        }
    }
  }, [currentInstrument, storeHandleNotesChange]);

  const { interactionProps, selectedNotes, interaction, handleVelocityChange, handleResizeStart } = usePianoRollInteraction({
      notes: currentInstrument?.notes || [],
      handleNotesChange, instrumentId: instrument?.id, audioEngineRef,
      noteToY, stepToX, keyHeight, stepWidth, pitchToIndex, indexToPitch, totalKeys,
      xToStep: useCallback((x) => Math.max(0, Math.round(x / stepWidth / snapSteps) * snapSteps), [stepWidth, snapSteps]),
      yToNote: useCallback((y) => indexToPitch(clamp(totalKeys - 1 - Math.floor(y / keyHeight), 0, totalKeys - 1)), [keyHeight, indexToPitch, totalKeys]),
      gridContainerRef,
      keyboardWidth: KEYBOARD_WIDTH
  });

  usePlaybackAnimator(playheadRef, { fullWidth: gridWidth, offset: 0 });

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const grid = gridContainerRef.current;
    if (!grid) return;

    const rect = grid.getBoundingClientRect();
    lastMousePos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (e.ctrlKey || e.metaKey) {
        handleZoom(e.deltaX, e.deltaY);
    } 
    else if (e.shiftKey) {
        grid.scrollLeft += e.deltaY;
    } 
    else {
        grid.scrollTop += e.deltaY;
    }
  }, [handleZoom]);
  
  // DÜZELTME: Olay dinleyicisini manuel olarak ve "passive: false" seçeneğiyle ekliyoruz.
  useEffect(() => {
    const gridElement = gridContainerRef.current;
    if (gridElement) {
      gridElement.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (gridElement) {
        gridElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  useLayoutEffect(() => {
    const grid = gridContainerRef.current;
    if (!grid || (prevZoom.current.zoomX === zoomX && prevZoom.current.zoomY === zoomY)) return;

    const oldZoomX = prevZoom.current.zoomX;
    const oldZoomY = prevZoom.current.zoomY;

    const zoomRatioX = zoomX / oldZoomX;
    const zoomRatioY = zoomY / oldZoomY;

    const mouseX = lastMousePos.current.x + grid.scrollLeft;
    const mouseY = lastMousePos.current.y + grid.scrollTop;

    const newScrollLeft = mouseX * zoomRatioX - lastMousePos.current.x;
    const newScrollTop = mouseY * zoomRatioY - lastMousePos.current.y;

    grid.scrollLeft = newScrollLeft;
    grid.scrollTop = newScrollTop;

    prevZoom.current = { zoomX, zoomY };
  }, [zoomX, zoomY]);

  const gridSVG = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= totalKeys; i++) {
        const noteIndex = (totalKeys - 1 - i) % 12;
        const isBlackKey = [1, 3, 6, 8, 10].includes(noteIndex);
        lines.push(`<line x1="0" y1="${i * keyHeight}" x2="${gridWidth}" y2="${i * keyHeight}" stroke="${isBlackKey ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)'}" stroke-width="1"/>`);
    }
    for (let i = 0; i <= loopLength; i++) {
        const x = i * stepWidth;
        const isBarStart = i % 16 === 0;
        const isBeat = i % 4 === 0;
        if (isBarStart || isBeat) {
            lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${gridHeight}" stroke="rgba(0,0,0,${isBarStart ? 0.4 : 0.2})" stroke-width="${isBarStart ? 1.5 : 1}"/>`);
        }
    }
    const snapValueInSteps = Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds();
    if (snapValueInSteps < 4 && zoomX > 0.5) {
        for (let i = 0; i <= loopLength; i += snapValueInSteps) {
            if (i % 4 !== 0) {
                 const x = i * stepWidth;
                 lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${gridHeight}" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>`);
            }
        }
    }
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${gridWidth}" height="${gridHeight}">${lines.join('')}</svg>`)}`;
  }, [stepWidth, keyHeight, loopLength, gridWidth, gridHeight, totalKeys, gridSnapValue, zoomX]);

  const scaleNotesSet = useMemo(() => {
    if (!showScaleHighlighting || !SCALES[scale.type]) return null;
    return new Set(SCALES[scale.type].map(i => (NOTES.indexOf(scale.root) + i) % 12));
  }, [showScaleHighlighting, scale]);
  
  const handleScroll = (e) => setGridScroll({ left: e.target.scrollLeft, top: e.target.scrollTop });
  
  if (!currentInstrument) {
      return (
        <div className="w-full h-full flex flex-col"> <PianoRollToolbar />
            <div className="flex-grow flex items-center justify-center bg-gray-800 text-gray-500"> Düzenlemek için bir enstrüman seçin. </div>
        </div>
      );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-background)] text-white select-none">
      <PianoRollToolbar />
      <div className="flex-grow min-h-0 flex flex-col overflow-hidden">
        <div className="flex-grow min-h-0 flex relative">
          <div className="w-24 bg-gray-900 shrink-0 h-full z-20 absolute" style={{ transform: `translateY(-${gridScroll.top}px)`}}>
            <PianoKeyboard 
                keyHeight={keyHeight} scaleNotes={scaleNotesSet}
                onKeyInteraction={(pitch, type) => {
                    if (type === 'on') audioEngineRef.current?.auditionNoteOn(instrument.id, pitch);
                    else audioEngineRef.current?.auditionNoteOff(instrument.id, pitch);
                }}
            />
          </div>
          <div 
            ref={gridContainerRef} 
            onScroll={handleScroll} 
            // onWheel prop'unu buradan kaldırıyoruz çünkü useEffect ile yöneteceğiz.
            className="w-full h-full overflow-auto"
            onContextMenu={(e) => e.preventDefault()}
            {...interactionProps} 
          >
            <div className="relative" style={{ 
                width: gridWidth, 
                height: gridHeight, 
                marginLeft: KEYBOARD_WIDTH,
                transition: 'width 0.05s linear, height 0.05s linear'
            }}>
              <div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 bg-cyan-400/80 z-30 pointer-events-none" />
              <div className="absolute inset-0" style={{ backgroundImage: `url('${gridSVG}')`, cursor: 'cell' }} />
              
              {(currentInstrument.notes || []).map((note) => {
                  return <Note key={note.id} note={note} isSelected={selectedNotes.has(note.id)} isBeingEdited={interaction?.type === 'dragging' && selectedNotes.has(note.id)} onResizeStart={handleResizeStart} {...{noteToY, stepToX, keyHeight, stepWidth}}/>
              })}
              
              {interaction?.previewNotes?.map((note, i) => <Note key={`preview-drag-${i}`} note={note} isPreview={true} {...{noteToY, stepToX, keyHeight, stepWidth}}/>)}
              {interaction?.previewNote && <Note key="preview-resize" note={interaction.previewNote} isPreview={true} {...{noteToY, stepToX, keyHeight, stepWidth}}/>}
              {interaction?.type === 'marquee' && 
                <div 
                    className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/20 pointer-events-none z-10" 
                    style={{
                        left: Math.min(interaction.gridStartX, interaction.endX), 
                        top: Math.min(interaction.gridStartY, interaction.endY), 
                        width: Math.abs(interaction.endX - interaction.gridStartX), 
                        height: Math.abs(interaction.endY - interaction.gridStartY)
                    }} 
                />}
            </div>
          </div>
        </div>
        
        {velocityLaneHeight > 0 && (
            <>
                <ResizableHandle onDrag={(delta) => setVelocityLaneHeight(-delta)} onDoubleClick={() => toggleVelocityLane()}/>
                <div className="w-full relative flex overflow-hidden" style={{ height: velocityLaneHeight, flexShrink: 0 }}>
                    <div className="h-full w-24 bg-gray-900 z-10 shrink-0" />
                    <div className="h-full absolute top-0" style={{ left: KEYBOARD_WIDTH, transform: `translateX(-${gridScroll.left}px)`}}>
                        <VelocityLane
                            notes={currentInstrument.notes || []} selectedNotes={selectedNotes} gridWidth={gridWidth}
                            height={velocityLaneHeight} onVelocityChange={handleVelocityChange}
                            {...{stepToX, stepWidth}}
                        />
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
}

export default React.memo(PianoRoll);