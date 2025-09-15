import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import * as Tone from 'tone';

import TimelineRuler from './TimelineRuler';
import PianoRollGrid from './PianoRollGrid';
import PianoKeyboard from './PianoKeyboard';
import { PianoRollToolbar } from './PianoRollToolbar';
import VelocityLane from './VelocityLane';
import ResizableHandle from '../../../ui/ResizableHandle';

// ✅ DOĞRU HOOK'LARI İMPORT ET
import { useViewportTracking } from '../hooks/useViewportTracking';
import { usePianoRollInteractions } from '../hooks/usePianoRollInteractions';
import { usePianoRollState } from '../hooks/usePianoRollState';
import { useViewport } from '../hooks/useViewport'; // [!code focus]

// ✅ STORE'LARI DOĞRU ŞEKILDE İMPORT ET
import { useInstrumentsStore } from '../../../store/useInstrumentsStore';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { usePlaybackAnimator } from '../../../hooks/usePlaybackAnimator';
import { usePlaybackStore } from '../../../store/usePlaybackStore';

import '../PianoRoll.css';

const totalOctaves = 8;
const totalKeys = totalOctaves * 12;

// ✅ ANA NOTES VERİSİNİ DOĞRUDAN PROPS'LARDAN AL
function PianoRoll({ instrument, audioEngineRef, pattern, onPatternChange, playbackState }) {
    console.log("instrument");
    console.log(instrument);

    const scrollContainerRef = useRef(null);
    const playheadRef = useRef(null);
    const { updatePatternNotes } = useArrangementStore();
    const handleNotesChange = (newNotes) => {
        updatePatternNotes(instrument?.id, newNotes);
    };

    const KEYBOARD_WIDTH = 96;
    const RULER_HEIGHT = 32;

    // ✅ VIEWPORT TRACKING
    const pianoRollState = usePianoRollState(pattern, onPatternChange);
    const { notes, setSelectedNotes, scale, tool, zoom, snapSettings,  } = pianoRollState;
    const viewport = useViewport(scrollContainerRef, pianoRollState); // [!code focus]

    // ✅ PIANO ROLL UI AYARLARI
    const { 
        activeTool, zoomX, zoomY, velocityLaneHeight, 
        setVelocityLaneHeight, toggleVelocityLane,
        targetScroll
    } = usePianoRollStore();
    
    // ✅ PLAYBACK DURUMU
    const { playbackMode } = usePlaybackStore();
    const loopLength = useInstrumentsStore(state => state.loopLength);

    // ✅ MEVCUT NOTES VERİSİ - Props'tan gelir
    const currentNotes = useMemo(() => 
        pattern?.notes || [], 
        [pattern?.notes]
    );

    // ✅ GRID BOYUTLARI
    const gridDimensions = useMemo(() => ({
        stepWidth: 40 * zoomX,
        keyHeight: 20 * zoomY,
        gridWidth: loopLength * 40 * zoomX,
        gridHeight: totalKeys * 20 * zoomY
    }), [zoomX, zoomY, loopLength]);

    // ✅ KOORDİNAT ÇEVİRİM FONKSİYONLARI
    const coordinateConverters = useMemo(() => {
        const { stepWidth, keyHeight } = gridDimensions;
        const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        return {
            pitchToIndex: (pitch) => (
                parseInt(pitch.slice(-1), 10) * 12 + 
                NOTES.indexOf(pitch.slice(0, -1))
            ),
            indexToPitch: (index) => `${NOTES[index % 12]}${Math.floor(index / 12)}`,
            noteToY: (pitch) => (totalKeys - 1 - (
                parseInt(pitch.slice(-1), 10) * 12 + 
                NOTES.indexOf(pitch.slice(0, -1))
            )) * keyHeight,
            stepToX: (step) => step * stepWidth,
            xToStep: (x) => Math.max(0, x / stepWidth),
            yToNote: (y) => {
                const index = Math.max(0, Math.min(totalKeys - 1, 
                    totalKeys - 1 - Math.floor(y / keyHeight)
                ));
                return `${NOTES[index % 12]}${Math.floor(index / 12)}`;
            }
        };
    }, [gridDimensions]);

    // ✅ ETKILEŞIM HOOK'U
    const { 
        interactionProps, selectedNotes, interaction, 
        handleVelocityBarMouseDown, handleVelocityWheel, handleResizeStart 
    } = usePianoRollInteractions({
        notes: currentNotes, 
        handleNotesChange, 
        instrumentId: instrument?.id, 
        audioEngineRef,
        ...coordinateConverters,
        ...gridDimensions,
        totalKeys,
        gridContainerRef: scrollContainerRef,
        keyboardWidth: KEYBOARD_WIDTH, 
        velocityLaneHeight,
        viewport
    });

    // ✅ PLAYBACK ANIMATOR
    usePlaybackAnimator(playheadRef, { 
        fullWidth: gridDimensions.gridWidth, 
        offset: KEYBOARD_WIDTH,
        smoothing: false,
        compensation: 'auto'
    });

    // ✅ TARGET SCROLL EFFECT
    useEffect(() => {
        if (targetScroll && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                left: targetScroll.left,
                top: targetScroll.top,
                behavior: 'smooth'
            });
        }
    }, [targetScroll]);

    // ✅ INSTRUMENT KONTROL
    if (!instrument) {
        return (
            <div className="w-full h-full flex flex-col">
                <PianoRollToolbar />
                <div className="flex-grow flex items-center justify-center bg-gray-800 text-gray-500">
                    Düzenlemek için bir enstrüman seçin.
                </div>
            </div>
        );
    }

    const totalContentHeight = gridDimensions.gridHeight + RULER_HEIGHT + 
        (velocityLaneHeight > 0 ? velocityLaneHeight + 8 : 0);

    return (
        <div className="w-full h-full flex flex-col bg-[var(--color-background)] text-white select-none">
            <PianoRollToolbar />
            <div className="flex-grow min-h-0 relative">
                <div
                    ref={scrollContainerRef}
                    className="w-full h-full overflow-auto piano-roll-scroll"
                    style={{ 
                        contain: 'layout style paint',
                        willChange: 'scroll-position'
                    }}
                    {...interactionProps}
                >
                    <div
                        className="relative piano-roll-container"
                        style={{
                            width: gridDimensions.gridWidth + KEYBOARD_WIDTH,
                            height: totalContentHeight,
                            contain: 'layout style paint'
                        }}
                    >
                        {/* SOL ÜST KÖŞE BOŞLUĞU */}
                        <div
                            className="absolute top-0 left-0 bg-gray-800 border-r border-b border-black z-30"
                            style={{ 
                                width: KEYBOARD_WIDTH, 
                                height: RULER_HEIGHT,
                                contain: 'strict'
                            }}
                        />

                        {/* ZAMAN CETVELİ */}
                        <div
                            className="sticky top-0 z-20"
                            style={{ 
                                left: KEYBOARD_WIDTH, 
                                width: gridDimensions.gridWidth, 
                                height: RULER_HEIGHT,
                                contain: 'layout style paint'
                            }}
                        >
                            <TimelineRuler 
                                viewport={viewport}
                                playbackState={playbackState}
                            />
                        </div>

                        {/* PİYANO KLAVYESİ */}
                        <div
                            className="sticky left-0 z-20"
                            style={{ 
                                top: RULER_HEIGHT,
                                width: KEYBOARD_WIDTH,
                                height: gridDimensions.gridHeight,
                                contain: 'layout style paint'
                            }}
                        >
                            <PianoKeyboard
                                viewport={viewport} 
                                scale={scale}

                                keyHeight={gridDimensions.keyHeight}
                                onKeyInteraction={(pitch, type) => 
                                    type === 'on' ? 
                                        audioEngineRef.current?.auditionNoteOn(instrument.id, pitch) : 
                                        audioEngineRef.current?.auditionNoteOff(instrument.id, pitch)
                                }
                            />
                        </div>

                        {/* ANA IZGARA ALANI */}
                        <div
                            className="absolute z-10"
                            style={{ 
                                top: RULER_HEIGHT, 
                                left: KEYBOARD_WIDTH, 
                                width: gridDimensions.gridWidth, 
                                height: gridDimensions.gridHeight,
                                contain: 'layout style paint'
                            }}
                        >
                            <PianoRollGrid
                                notes={currentNotes} 
                                gridWidth={gridDimensions.gridWidth} 
                                gridHeight={gridDimensions.gridHeight}
                                noteToY={coordinateConverters.noteToY} 
                                stepToX={coordinateConverters.stepToX} 
                                keyHeight={gridDimensions.keyHeight} 
                                stepWidth={gridDimensions.stepWidth}
                                onResizeStart={handleResizeStart} 
                                selectedNotes={selectedNotes}
                                interaction={interaction} 
                                playbackMode={playbackMode} 
                                playheadRef={playheadRef}
                                viewport={viewport}
                            />
                        </div>
                        
                        {/* VELOCITY LANE */}
                        {velocityLaneHeight > 0 && (
                            <div 
                                className="absolute left-0"
                                style={{ 
                                    top: RULER_HEIGHT + gridDimensions.gridHeight, 
                                    width: '100%', 
                                    height: velocityLaneHeight + 8,
                                    contain: 'layout style paint'
                                }}
                            >
                                <ResizableHandle 
                                    onDrag={(delta) => setVelocityLaneHeight(-delta)} 
                                    onDoubleClick={toggleVelocityLane} 
                                />
                                <div className="flex" style={{height: velocityLaneHeight}}>
                                     <div className="w-24 shrink-0 bg-gray-800 border-r border-black"></div>
                                     <div className="flex-grow relative">
                                        <VelocityLane 
                                            notes={currentNotes}
                                            selectedNotes={selectedNotes} 
                                            viewport={viewport}
                                            gridWidth={gridDimensions.gridWidth}
                                            stepToX={coordinateConverters.stepToX} 
                                            stepWidth={gridDimensions.stepWidth} 
                                            height={velocityLaneHeight} 
                                            onVelocityBarMouseDown={handleVelocityBarMouseDown} 
                                            onVelocityWheel={handleVelocityWheel}
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