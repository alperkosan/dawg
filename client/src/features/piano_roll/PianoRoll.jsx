import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import * as Tone from 'tone';

import TimelineRuler from './TimelineRuler';
import PianoRollGrid from './PianoRollGrid';
import PianoKeyboard from './PianoKeyboard';
import { PianoRollToolbar } from './PianoRollToolbar';
import VelocityLane from './VelocityLane';
import ResizableHandle from '../../ui/ResizableHandle';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { usePianoRollStore, NOTES, SCALES } from '../../store/usePianoRollStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePianoRollInteraction } from './usePianoRollInteraction';
import { usePlaybackAnimator } from '../../hooks/usePlaybackAnimator';
import { usePlaybackStore } from '../../store/usePlaybackStore';

const totalOctaves = 8;
const totalKeys = totalOctaves * 12;

function PianoRoll({ instrument, audioEngineRef }) {
    const scrollContainerRef = useRef(null);
    const playheadRef = useRef(null);

    const KEYBOARD_WIDTH = 96;
    const RULER_HEIGHT = 32;

    const { activeTool, zoomX, zoomY, velocityLaneHeight, setVelocityLaneHeight, toggleVelocityLane } = usePianoRollStore();
    const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();
    const loopLength = useInstrumentsStore(state => state.loopLength);
    const playbackMode = usePlaybackStore(state => state.playbackMode);

    const activePattern = patterns[activePatternId];
    const currentNotes = useMemo(() => activePattern?.data[instrument?.id] || [], [activePattern, instrument?.id]);

    const stepWidth = 40 * zoomX;
    const keyHeight = 20 * zoomY;
    const gridWidth = loopLength * stepWidth;
    const gridHeight = totalKeys * keyHeight;

    const pitchToIndex = useCallback((pitch) => (parseInt(pitch.slice(-1), 10) * 12 + NOTES.indexOf(pitch.slice(0, -1))), []);
    const indexToPitch = useCallback((index) => `${NOTES[index % 12]}${Math.floor(index / 12)}`, []);
    const noteToY = useCallback((pitch) => (totalKeys - 1 - pitchToIndex(pitch)) * keyHeight, [keyHeight, pitchToIndex]);
    const stepToX = useCallback((step) => step * stepWidth, [stepWidth]);
    const xToStep = useCallback((x) => Math.max(0, x / stepWidth), [stepWidth]);
    const yToNote = useCallback((y) => indexToPitch(Math.max(0, Math.min(totalKeys - 1, totalKeys - 1 - Math.floor(y / keyHeight)))), [keyHeight, indexToPitch, totalKeys]);

    const handleNotesChange = useCallback((newNotes) => {
        if (instrument) {
            updatePatternNotes(instrument.id, typeof newNotes === 'function' ? newNotes(currentNotes) : newNotes);
        }
    }, [instrument, currentNotes, updatePatternNotes]);

    const { interactionProps, selectedNotes, interaction, handleVelocityBarMouseDown, handleVelocityWheel, handleResizeStart } = usePianoRollInteraction({
        notes: currentNotes, handleNotesChange, instrumentId: instrument?.id, audioEngineRef,
        noteToY, stepToX, keyHeight, stepWidth, pitchToIndex, indexToPitch, totalKeys,
        xToStep, yToNote, gridContainerRef: scrollContainerRef,
        keyboardWidth: KEYBOARD_WIDTH, velocityLaneHeight
    });

    usePlaybackAnimator(playheadRef, { 
        fullWidth: gridWidth, 
        offset: KEYBOARD_WIDTH,
        smoothing: false, // Pattern modunda keskin takip
        compensation: 'auto' // Otomatik latency kompanzasyonu
    });

    if (!instrument) {
        return (
            <div className="w-full h-full flex flex-col"><PianoRollToolbar /><div className="flex-grow flex items-center justify-center bg-gray-800 text-gray-500">Düzenlemek için bir enstrüman seçin.</div></div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-[var(--color-background)] text-white select-none">
            <PianoRollToolbar />
            <div className="flex-grow min-h-0 relative">
                {/* ANA KAYDIRILABİLİR ALAN */}
                <div
                    ref={scrollContainerRef}
                    className="w-full h-full overflow-auto"
                    {...interactionProps}
                >
                    {/* TÜM İÇERİĞİ TUTAN VE BOYUTLANDIRAN KONTEYNER */}
                    <div
                        className="relative"
                        style={{
                            width: gridWidth + KEYBOARD_WIDTH,
                            height: gridHeight + RULER_HEIGHT + (velocityLaneHeight > 0 ? velocityLaneHeight + 8 : 0)
                        }}
                    >
                        {/* 1. SOL ÜST KÖŞE (BOŞLUK) */}
                        <div
                            className="absolute top-0 left-0 bg-gray-800 border-r border-b border-black z-30"
                            style={{ width: KEYBOARD_WIDTH, height: RULER_HEIGHT }}
                        />

                        {/* 2. ZAMAN CETVELİ (YATAYDA YAPIŞKAN) */}
                        <div
                            className="sticky top-0 z-20"
                            style={{ left: KEYBOARD_WIDTH, width: gridWidth, height: RULER_HEIGHT }}
                        >
                            <TimelineRuler loopLength={loopLength} zoomX={zoomX} stepWidth={stepWidth} />
                        </div>

                        {/* 3. PİYANO KLAVYESİ (DİKEYDE YAPIŞKAN) */}
                        <div
                            className="sticky left-0 z-20"
                            style={{ top: RULER_HEIGHT, width: KEYBOARD_WIDTH, height: gridHeight }}
                        >
                            <PianoKeyboard
                                keyHeight={keyHeight}
                                onKeyInteraction={(pitch, type) => type === 'on' ? audioEngineRef.current?.auditionNoteOn(instrument.id, pitch) : audioEngineRef.current?.auditionNoteOff(instrument.id, pitch)}
                            />
                        </div>

                        {/* 4. ANA IZGARA ALANI */}
                        <div
                            className="absolute z-10"
                            style={{ top: RULER_HEIGHT, left: KEYBOARD_WIDTH, width: gridWidth, height: gridHeight }}
                        >
                            <PianoRollGrid
                                notes={currentNotes} gridWidth={gridWidth} gridHeight={gridHeight}
                                noteToY={noteToY} stepToX={stepToX} keyHeight={keyHeight} stepWidth={stepWidth}
                                onResizeStart={handleResizeStart} selectedNotes={selectedNotes}
                                interaction={interaction} playbackMode={playbackMode} playheadRef={playheadRef}
                            />
                        </div>
                        
                        {/* 5. VELOCITY LANE (GEREKİRSE) */}
                        {velocityLaneHeight > 0 && (
                            <div className="absolute left-0" style={{ top: RULER_HEIGHT + gridHeight, width: '100%', height: velocityLaneHeight + 8}}>
                                <ResizableHandle onDrag={(delta) => setVelocityLaneHeight(-delta)} onDoubleClick={toggleVelocityLane} />
                                <div className="flex" style={{height: velocityLaneHeight}}>
                                     <div className="w-24 shrink-0 bg-gray-800 border-r border-black"></div>
                                     <div className="flex-grow relative">
                                        <VelocityLane 
                                            notes={currentNotes} selectedNotes={selectedNotes} gridWidth={gridWidth}
                                            stepToX={stepToX} stepWidth={stepWidth} height={velocityLaneHeight} 
                                            onVelocityBarMouseDown={handleVelocityBarMouseDown} onVelocityWheel={handleVelocityWheel}
                                        />
                                     </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default React.memo(PianoRoll);