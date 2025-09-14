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

// Hook'lar ve Store'lar
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { usePianoRollStore, NOTES, SCALES } from '../../store/usePianoRollStore';
import { usePianoRollInteraction } from './usePianoRollInteraction';
import { usePlaybackAnimator } from '../../hooks/usePlaybackAnimator';
import { usePianoRollCursor } from './usePianoRollCursor';
import { usePianoRollShortcuts } from './usePianoRollShortcuts';
import { usePianoRollWorker } from './usePianoRollWorker';

// Sabitler
const totalOctaves = 8;
const totalKeys = totalOctaves * 12;
const KEYBOARD_WIDTH = 96;

function PianoRoll({ instrument, audioEngineRef }) {
    // Referanslar ve State'ler
    const gridContainerRef = useRef(null);
    const gridCanvasRef = useRef(null);
    const playheadRef = useRef(null);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [gridScroll, setGridScroll] = useState({ left: 0, top: 0 });
    const [hoveredElement, setHoveredElement] = useState(null);
    const [modifierKeys, setModifierKeys] = useState({ alt: false, shift: false, ctrl: false });

    // Store'dan gelen veriler
    const { activeTool, setActiveTool, zoomX, zoomY, velocityLaneHeight, setVelocityLaneHeight, toggleVelocityLane, showScaleHighlighting, scale, handleZoom } = usePianoRollStore();
    const currentInstrument = useInstrumentsStore(state => state.instruments.find(i => i.id === instrument?.id));
    const loopLength = useInstrumentsStore(state => state.loopLength);
    const { handleNotesChange: storeHandleNotesChange } = useInstrumentsStore.getState();

    // Hesaplamalar
    const stepWidth = 40 * zoomX;
    const keyHeight = 20 * zoomY;
    const gridWidth = loopLength * stepWidth;
    const gridHeight = totalKeys * keyHeight;
    
    // YENİ MİMARİ: Hook artık ID'leri döndürüyor.
    const { postTask, gridLines, visibleNoteIDs } = usePianoRollWorker();

    // `useMemo` ile render edilecek notaları verimli bir şekilde filtreliyoruz.
    const notesToRender = useMemo(() => {
        if (!currentInstrument || !visibleNoteIDs) return [];
        // Worker'dan gelen ID set'ini kullanarak ana listeden notaları alıyoruz.
        return currentInstrument.notes.filter(note => visibleNoteIDs.has(note.id));
    }, [currentInstrument, visibleNoteIDs]);

    // Yardımcı Fonksiyonlar (Aynı)
    const pitchToIndex = useCallback((pitch) => (parseInt(pitch.slice(-1), 10) * 12 + NOTES.indexOf(pitch.slice(0, -1))), []);
    const indexToPitch = useCallback((index) => `${NOTES[index % 12]}${Math.floor(index / 12)}`, []);
    const noteToY = useCallback((pitch) => (totalKeys - 1 - pitchToIndex(pitch)) * keyHeight, [keyHeight, pitchToIndex]);
    const stepToX = useCallback((step) => step * stepWidth, [stepWidth]);
    const xToStep = useCallback((x) => Math.max(0, x / stepWidth), [stepWidth]);
    const yToNote = useCallback((y) => indexToPitch(Math.max(0, Math.min(totalKeys - 1, totalKeys - 1 - Math.floor(y / keyHeight)))), [keyHeight, indexToPitch, totalKeys]);
    
    const handleNotesChange = useCallback((newNotes) => {
        if (currentInstrument) {
            if (typeof newNotes === 'function') storeHandleNotesChange(currentInstrument.id, newNotes(currentInstrument.notes));
            else storeHandleNotesChange(currentInstrument.id, newNotes);
        }
    }, [currentInstrument, storeHandleNotesChange]);

    const {
        interactionProps, selectedNotes, interaction, 
        handleVelocityBarMouseDown, handleVelocityWheel, handleResizeStart, setSelectedNotes 
    } = usePianoRollInteraction({
        notes: currentInstrument?.notes || [],
        handleNotesChange, instrumentId: instrument?.id, audioEngineRef,
        noteToY, stepToX, keyHeight, stepWidth, pitchToIndex, indexToPitch, totalKeys,
        xToStep, yToNote, gridContainerRef, 
        keyboardWidth: KEYBOARD_WIDTH, 
        setHoveredElement, velocityLaneHeight 
    });

    useEffect(() => {
        const handleKeyChange = (e) => setModifierKeys({ alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
        const handleBlur = () => setModifierKeys({ alt: false, shift: false, ctrl: false });
        window.addEventListener('keydown', handleKeyChange);
        window.addEventListener('keyup', handleKeyChange);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyChange);
            window.removeEventListener('keyup', handleKeyChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // === YENİ: Gelişmiş Scroll ve Zoom Mantığı ===
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const grid = gridContainerRef.current;
        if (!grid) return;

        const isCtrlOrMeta = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        if (isCtrlOrMeta) { // Zoom
            const rect = grid.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const scrollPercentX = (grid.scrollLeft + mouseX) / gridWidth;
            
            const delta = -e.deltaY * 0.001;
            const newZoomX = zoomX + delta;
            handleZoom(delta, 0); // Store'daki zoom değerini güncelle

            // Yeni scroll pozisyonunu, imlecin olduğu noktayı sabit tutacak şekilde ayarla
            requestAnimationFrame(() => {
                const newGridWidth = loopLength * (40 * newZoomX);
                grid.scrollLeft = (scrollPercentX * newGridWidth) - mouseX;
            });

        } else if (isShift) { // Yatay Kaydırma
            grid.scrollLeft += e.deltaY;
        } else { // Dikey Kaydırma
            grid.scrollTop += e.deltaY;
        }
    }, [zoomX, loopLength, gridWidth, handleZoom, gridContainerRef]);

    usePianoRollCursor(gridContainerRef, activeTool, hoveredElement, { ...modifierKeys, isMouseDown: !!interaction });
    usePlaybackAnimator(playheadRef, { fullWidth: gridWidth, offset: KEYBOARD_WIDTH });
    usePianoRollShortcuts({ setActiveTool, getNotes: () => currentInstrument?.notes || [], handleNotesChange, selectedNotes, setSelectedNotes, instrument, viewport });

    // WORKER İLE İLETİŞİM EFFECT'İ (STABİL HALE GETİRİLDİ)
    useEffect(() => {
        if (viewport.width > 0 && currentInstrument) {
            const currentViewport = { left: gridScroll.left, top: gridScroll.top, width: viewport.width, height: viewport.height };
            
            postTask('calculateGrid', { width: gridWidth, height: gridHeight, stepWidth, keyHeight, zoomX, zoomY });

            const notesForWorker = currentInstrument.notes.map(note => ({
                id: note.id,
                time: note.time,
                duration: note.duration,
                pitchIndex: pitchToIndex(note.pitch)
            }));
            postTask('calculateVisible', { notes: notesForWorker, viewport: currentViewport, stepWidth, keyHeight });
        }
    }, [gridWidth, gridHeight, stepWidth, keyHeight, viewport, gridScroll, currentInstrument, postTask, pitchToIndex]);

    // Canvas Çizim Effect'i (Aynı)
    useEffect(() => {
        const canvas = gridCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !gridLines || viewport.width === 0) return;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        ctx.scale(dpr, dpr);
       
        ctx.clearRect(0, 0, viewport.width, viewport.height);
        ctx.save();
        ctx.translate(-gridScroll.left, -gridScroll.top);

        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-background') || '#111827';
        ctx.fillRect(gridScroll.left, gridScroll.top, viewport.width, viewport.height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        gridLines.vertical.forEach(line => {
             if (line.x >= gridScroll.left - stepWidth && line.x <= gridScroll.left + viewport.width + stepWidth) {
                ctx.globalAlpha = line.opacity;
                ctx.lineWidth = line.strokeWidth;
                ctx.beginPath(); ctx.moveTo(line.x, 0); ctx.lineTo(line.x, gridHeight); ctx.stroke();
            }
        });
        gridLines.horizontal.forEach(line => {
            if (line.y >= gridScroll.top - keyHeight && line.y <= gridScroll.top + viewport.height + keyHeight) {
                ctx.globalAlpha = line.opacity;
                ctx.lineWidth = line.strokeWidth;
                ctx.beginPath(); ctx.moveTo(0, line.y); ctx.lineTo(gridWidth, line.y); ctx.stroke();
            }
        });
        
        ctx.restore();
    }, [gridLines, gridWidth, gridHeight, viewport, gridScroll, stepWidth, keyHeight]);
    
    const handleScroll = useCallback(() => {
        if (gridContainerRef.current) {
            setGridScroll({ left: gridContainerRef.current.scrollLeft, top: gridContainerRef.current.scrollTop });
        }
    }, []);

    useLayoutEffect(() => {
        const gridEl = gridContainerRef.current;
        if (!gridEl) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setViewport({ width, height });
            }
        });
        resizeObserver.observe(gridEl);
        gridEl.addEventListener('scroll', handleScroll, { passive: true });
        gridEl.addEventListener('wheel', handleWheel, { passive: false }); // Wheel'i ekle

        return () => {
            resizeObserver.disconnect();
            gridEl.removeEventListener('scroll', handleScroll);
            gridEl.removeEventListener('wheel', handleWheel); // Wheel'i kaldır
        };
    }, [handleScroll, handleWheel]);

    if (!currentInstrument) {
        return (
            <div className="w-full h-full flex flex-col">
                <PianoRollToolbar onZoom={handleZoom} />
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
                <div className="flex-grow min-h-0 flex">
                    <div className="sticky left-0 top-0 h-full z-20" style={{ transform: `translateY(-${gridScroll.top}px)`}}>
                        <PianoKeyboard keyHeight={keyHeight} scaleNotes={useMemo(() => showScaleHighlighting ? new Set(SCALES[scale.type].map(i => (NOTES.indexOf(scale.root) + i) % 12)) : null, [showScaleHighlighting, scale])} onKeyInteraction={(pitch, type) => type === 'on' ? audioEngineRef.current?.auditionNoteOn(instrument.id, pitch) : audioEngineRef.current?.auditionNoteOff(instrument.id, pitch)} />
                    </div>
                    <div ref={gridContainerRef} className="flex-grow h-full overflow-auto" {...interactionProps}>
                        <div className="relative" style={{ width: gridWidth, height: gridHeight }}>
                            <canvas ref={gridCanvasRef} className="absolute top-0 left-0 pointer-events-none" style={{width: viewport.width, height: viewport.height}} />
                            
                            {/* ANA DEĞİŞİKLİK: 'notesToRender' KULLANILIYOR */}
                            {notesToRender.map((note) => (
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
                            <GhostNote note={interaction?.ghostNote} />
                            
                            {interaction?.type === 'marquee' && <div className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/20 pointer-events-none z-10" style={{ left: Math.min(interaction.gridStartX, interaction.currentX), top: Math.min(interaction.gridStartY, interaction.currentY), width: Math.abs(interaction.currentX - interaction.gridStartX), height: Math.abs(interaction.currentY - interaction.gridStartY)}} />}
                            
                            {/*<div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 z-30 pointer-events-none bg-cyan-400" />*/}
                        </div>
                    </div>
                </div>
                
                {velocityLaneHeight > 0 && (
                    <>
                        <ResizableHandle onDrag={(delta) => setVelocityLaneHeight(-delta)} onDoubleClick={() => toggleVelocityLane()} />
                        <div 
                            className="w-full relative flex overflow-hidden" 
                            style={{ height: velocityLaneHeight, flexShrink: 0 }}
                            onMouseDown={interactionProps.onMouseDown}
                        >
                            <div className="h-full w-24 bg-gray-900 z-10 shrink-0" />
                            <div data-role="velocity-lane-bg" className="h-full" style={{ width: gridWidth, transform: `translateX(-${gridScroll.left}px)`}}>
                                <VelocityLane 
                                    notes={notesToRender} 
                                    selectedNotes={selectedNotes} 
                                    gridWidth={gridWidth}
                                    stepToX={stepToX} 
                                    stepWidth={stepWidth} 
                                    height={velocityLaneHeight} 
                                    onVelocityBarMouseDown={handleVelocityBarMouseDown} 
                                    onVelocityWheel={handleVelocityWheel}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
            <PianoRollTooltip 
                x={interaction?.tooltip?.x || 0}
                y={interaction?.tooltip?.y || 0}
                content={interaction?.tooltip?.content}
                visible={interaction?.tooltip?.visible || false}
            />
        </div>
    );
}

export default React.memo(PianoRoll);