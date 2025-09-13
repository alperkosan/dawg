import React, { useRef, useState, useCallback, useMemo, useLayoutEffect, useEffect } from 'react';
import * as Tone from 'tone';

// Bileşenler
import PianoKeyboard from './PianoKeyboard';
import Note from './Note';
import { PianoRollToolbar } from './PianoRollToolbar';
import VelocityLane from './VelocityLane';
import ResizableHandle from '../../ui/ResizableHandle';
import GhostNote from './GhostNote';
import PianoRollTooltip from './PianoRollTooltip';
import CustomScrollbar from './CustomScrollbar';

// Hook'lar ve Store'lar
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { usePianoRollStore, NOTES, SCALES } from '../../store/usePianoRollStore';
import { usePianoRollInteraction } from './usePianoRollInteraction';
import { usePlaybackAnimator } from '../../hooks/usePlaybackAnimator';
import { usePianoRollCursor } from './usePianoRollCursor';
import { usePianoRollShortcuts } from './usePianoRollShortcuts';

const totalOctaves = 8;
const totalKeys = totalOctaves * 12;

function PianoRoll({ instrument, audioEngineRef }) {
    // Referanslar ve State'ler
    const gridContainerRef = useRef(null);
    const playheadRef = useRef(null);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [gridScroll, setGridScroll] = useState({ left: 0, top: 0 });
    const [hoveredElement, setHoveredElement] = useState(null);
    const [modifierKeys, setModifierKeys] = useState({ alt: false, shift: false, ctrl: false, isMouseDown: false });
    const [visualFeedback, setVisualFeedback] = useState({ ghostNote: null, tooltip: { visible: false, content: null, x: 0, y: 0 } });

    // Sabitler ve Hesaplamalar
    const KEYBOARD_WIDTH = 96;
    const { 
        activeTool, setActiveTool, gridSnapValue, scale, showScaleHighlighting, 
        zoomX, zoomY, velocityLaneHeight, setVelocityLaneHeight, toggleVelocityLane,
        targetScroll, handleZoom
    } = usePianoRollStore();
    
    const { handleNotesChange: storeHandleNotesChange } = useInstrumentsStore.getState();
    const currentInstrument = useInstrumentsStore(state => state.instruments.find(i => i.id === instrument?.id));
    const loopLength = useInstrumentsStore(state => state.loopLength);

    const stepWidth = 40 * zoomX;
    const keyHeight = 20 * zoomY;
    const gridWidth = loopLength * stepWidth;
    const gridHeight = totalKeys * keyHeight;
    const snapSteps = useMemo(() => Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds(), [gridSnapValue]);

    // Yardımcı Fonksiyonlar
    const pitchToIndex = useCallback((pitch) => (parseInt(pitch.slice(-1), 10) * 12 + NOTES.indexOf(pitch.slice(0, -1))), []);
    const indexToPitch = useCallback((index) => `${NOTES[index % 12]}${Math.floor(index / 12)}`, []);
    const noteToY = useCallback((pitch) => (totalKeys - 1 - pitchToIndex(pitch)) * keyHeight, [keyHeight, pitchToIndex]);
    const stepToX = useCallback((step) => step * stepWidth, [stepWidth]);
    const xToStep = useCallback((x) => Math.max(0, x / stepWidth), [stepWidth]);
    const yToNote = useCallback((y) => indexToPitch(Math.max(0, Math.min(totalKeys - 1, totalKeys - 1 - Math.floor(y / keyHeight)))), [keyHeight, indexToPitch, totalKeys]);
    
    const getNotes = useCallback(() => currentInstrument?.notes || [], [currentInstrument]);
    const handleNotesChange = useCallback((newNotes) => {
        if (currentInstrument) {
            if (typeof newNotes === 'function') storeHandleNotesChange(currentInstrument.id, newNotes(currentInstrument.notes));
            else storeHandleNotesChange(currentInstrument.id, newNotes);
        }
    }, [currentInstrument, storeHandleNotesChange]);

    // Merkezi Hook'ların Kurulumu
    const { interactionProps, selectedNotes, interaction, handleVelocityChange, handleResizeStart, setSelectedNotes } = usePianoRollInteraction({
        notes: currentInstrument?.notes || [],
        handleNotesChange, instrumentId: instrument?.id, audioEngineRef,
        noteToY, stepToX, keyHeight, stepWidth, pitchToIndex, indexToPitch, totalKeys,
        xToStep: useCallback((x) => Math.max(0, x / stepWidth), [stepWidth]),
        yToNote: useCallback((y) => indexToPitch(Math.max(0, Math.min(totalKeys - 1, totalKeys - 1 - Math.floor(y / keyHeight)))), [keyHeight, indexToPitch]),
        gridContainerRef, keyboardWidth: KEYBOARD_WIDTH, setHoveredElement, velocityLaneHeight 
    });
    
    usePianoRollCursor(gridContainerRef, activeTool, hoveredElement, { ...modifierKeys, alt: modifierKeys.alt && modifierKeys.isMouseDown });
    usePlaybackAnimator(playheadRef, { fullWidth: gridWidth, offset: 0 });
    usePianoRollShortcuts({ setActiveTool, audioEngineRef, selectedNotes, handleNotesChange, getNotes, setSelectedNotes, instrument, viewport });

    // Gezinme (Navigation) Mantığı
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const grid = gridContainerRef.current;
        if (!grid || (interaction && interaction.type !== 'panning')) return;

        const isCtrlOrMeta = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        if (isCtrlOrMeta) {
            const rect = grid.getBoundingClientRect();
            const mouseX = e.clientX - rect.left - KEYBOARD_WIDTH + grid.scrollLeft;
            const scrollPercentX = mouseX / gridWidth;
            const delta = -e.deltaY * 0.001;
            const newZoomX = zoomX + delta;
            handleZoom(delta, 0);
            grid.scrollLeft = (scrollPercentX * (loopLength * (40 * newZoomX))) - (e.clientX - rect.left - KEYBOARD_WIDTH);
        } else if (isShift) {
            grid.scrollLeft += e.deltaY;
        } else {
            grid.scrollTop += e.deltaY;
        }
    }, [zoomX, loopLength, gridWidth, handleZoom, interaction]);

    // Görsel Geri Bildirim Mantığı
    const handleMouseMoveForFeedback = useCallback((e) => {
        const grid = gridContainerRef.current;
        if (!grid) return;

        let ghostNoteData = null;
        let tooltipData = { visible: false, content: null, x: e.clientX, y: e.clientY };

        if (!interaction) {
            const rect = grid.getBoundingClientRect();
            const x = e.clientX - rect.left + grid.scrollLeft - KEYBOARD_WIDTH;
            const y = e.clientY - rect.top + grid.scrollTop;

            if (activeTool === 'pencil' && !hoveredElement) {
                const snappedTime = Math.round(xToStep(x) / snapSteps) * snapSteps;
                const pitch = yToNote(y);
                ghostNoteData = {
                    position: { x: stepToX(snappedTime), y: noteToY(pitch) },
                    dimensions: { width: Tone.Time(usePianoRollStore.getState().lastUsedDuration).toSeconds() / Tone.Time('16n').toSeconds() * stepWidth, height: keyHeight },
                    isValid: true
                };
            }

            if (hoveredElement?.type === 'note') {
                const note = hoveredElement.data;
                tooltipData.content = (
                    <div>
                        <div className="font-bold">{note.pitch}</div>
                        <div>Velocity: {(note.velocity * 127).toFixed(0)}</div>
                        <div>Süre: {note.duration}</div>
                    </div>
                );
                tooltipData.visible = true;
            }
        }
        setVisualFeedback({ ghostNote: ghostNoteData, tooltip: tooltipData });
    }, [interaction, activeTool, hoveredElement, snapSteps, stepWidth, keyHeight, stepToX, noteToY, xToStep, yToNote]);
    
    // Olay Dinleyicileri, Scroll ve Viewport Yönetimi
    useEffect(() => {
        const gridEl = gridContainerRef.current;
        const handleScroll = () => { if (gridEl) setGridScroll({ left: gridEl.scrollLeft, top: gridEl.scrollTop }); };
        const handleMouseLeave = () => setVisualFeedback({ ghostNote: null, tooltip: { visible: false, content: null, x: 0, y: 0 } });
        
        if (gridEl) {
            gridEl.addEventListener('scroll', handleScroll, { passive: true });
            gridEl.addEventListener('wheel', handleWheel, { passive: false });
            gridEl.addEventListener('mousemove', handleMouseMoveForFeedback);
            gridEl.addEventListener('mouseleave', handleMouseLeave);
        }
        return () => {
            if (gridEl) {
                gridEl.removeEventListener('scroll', handleScroll);
                gridEl.removeEventListener('wheel', handleWheel);
                gridEl.removeEventListener('mousemove', handleMouseMoveForFeedback);
                gridEl.removeEventListener('mouseleave', handleMouseLeave);
            }
        };
    }, [handleWheel, handleMouseMoveForFeedback]);

    useEffect(() => {
        if (targetScroll && gridContainerRef.current) {
            gridContainerRef.current.scrollTo({ left: targetScroll.left, top: targetScroll.top, behavior: 'smooth' });
        }
    }, [targetScroll]);

    useLayoutEffect(() => {
        const gridEl = gridContainerRef.current;
        if (!gridEl) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        resizeObserver.observe(gridEl);
        return () => resizeObserver.disconnect();
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

    return (
    <div className="w-full h-full flex flex-col bg-[var(--color-background)] text-white select-none">
        <PianoRollToolbar />
        <div className="flex-grow min-h-0 flex flex-col overflow-hidden">
            <div className="flex-grow min-h-0 relative">
                <div 
                    ref={gridContainerRef}
                    className="w-full h-full overflow-hidden" // Özel scrollbar kullandığımız için ana scrollbar'ı gizle
                    style={{ cursor: 'grab' }}
                    {...interactionProps}
                >
                    <div className="relative" style={{ width: gridWidth + KEYBOARD_WIDTH, height: gridHeight }}>
                        <div className="sticky left-0 top-0 h-full w-24 bg-gray-900 z-20" style={{ transform: `translateY(${gridScroll.top}px)`}}>
                             <PianoKeyboard 
                                keyHeight={keyHeight} 
                                scaleNotes={useMemo(() => showScaleHighlighting ? new Set(SCALES[scale.type].map(i => (NOTES.indexOf(scale.root) + i) % 12)) : null, [showScaleHighlighting, scale])}
                                onKeyInteraction={(pitch, type) => type === 'on' ? audioEngineRef.current?.auditionNoteOn(instrument.id, pitch) : audioEngineRef.current?.auditionNoteOff(instrument.id, pitch)}
                             />
                        </div>
                        <div className="absolute top-0" style={{ left: KEYBOARD_WIDTH, width: gridWidth, height: gridHeight }}>
                            {/* Grid, Notlar ve diğer elemanlar */}
                            <div className="absolute inset-0" style={{ backgroundImage: `url('data:image/svg+xml,...')` }} />
                            {currentInstrument.notes.map((note) => (
                                <Note 
                                    key={note.id} 
                                    note={note} 
                                    noteToY={noteToY} 
                                    stepToX={stepToX} 
                                    keyHeight={keyHeight} 
                                    stepWidth={stepWidth} 
                                    onResizeStart={handleResizeStart} 
                                    isSelected={selectedNotes.has(note.id)} 
                                    isBeingEdited={interaction?.type === 'dragging' && selectedNotes.has(note.id)} 
                                />
                            ))}
                            {interaction?.previewNotes?.map(note => <Note key={`preview-${note.id}`} note={note} isPreview={true} {...{noteToY, stepToX, keyHeight, stepWidth}}/>)}
                            {interaction?.previewNote && <Note key="preview-creating" note={interaction.previewNote} isPreview={true} {...{noteToY, stepToX, keyHeight, stepWidth}}/>}
                            <GhostNote 
                                position={visualFeedback.ghostNote?.position}
                                dimensions={visualFeedback.ghostNote?.dimensions}
                                isValid={visualFeedback.ghostNote?.isValid}
                            />
                            {interaction?.type === 'marquee' && <div className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/20 pointer-events-none z-10" style={{ left: Math.min(interaction.gridStartX, interaction.currentX), top: Math.min(interaction.gridStartY, interaction.currentY), width: Math.abs(interaction.currentX - interaction.gridStartX), height: Math.abs(interaction.currentY - interaction.gridStartY)}} />}
                            <div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 z-30 pointer-events-none bg-cyan-400" />
                        </div>
                    </div>
                </div>
                
                {/* Özel Scrollbar'lar */}
                <CustomScrollbar orientation="horizontal" contentSize={gridWidth + KEYBOARD_WIDTH} viewportSize={viewport.width} scrollPosition={gridScroll.left} onScroll={(pos) => gridContainerRef.current.scrollLeft = pos} />
                <CustomScrollbar orientation="vertical" contentSize={gridHeight} viewportSize={viewport.height} scrollPosition={gridScroll.top} onScroll={(pos) => gridContainerRef.current.scrollTop = pos} />
            </div>
            
            {/* Velocity Lane */}
            {velocityLaneHeight > 0 && (
                <>
                    <ResizableHandle onDrag={(delta) => setVelocityLaneHeight(-delta)} onDoubleClick={() => toggleVelocityLane(false)}/>
                    <div className="w-full relative flex overflow-hidden" style={{ height: velocityLaneHeight, flexShrink: 0 }}>
                        <div className="h-full w-24 bg-gray-900 z-10 shrink-0" />
                        <div className="h-full absolute top-0" style={{ left: KEYBOARD_WIDTH, transform: `translateX(-${gridScroll.left}px)`}}>
                            <VelocityLane notes={currentInstrument?.notes || []} stepToX={stepToX} stepWidth={stepWidth} height={velocityLaneHeight} onVelocityChange={handleVelocityChange} selectedNotes={selectedNotes} gridWidth={gridWidth} />
                        </div>
                    </div>
                </>
            )}
        </div>
        
        {/* Akıllı İpucu */}
        <PianoRollTooltip 
            x={visualFeedback.tooltip?.x || 0}
            y={visualFeedback.tooltip?.y || 0}
            content={visualFeedback.tooltip?.content}
            visible={visualFeedback.tooltip?.visible || false}
        />
    </div>
  );
}

export default React.memo(PianoRoll);