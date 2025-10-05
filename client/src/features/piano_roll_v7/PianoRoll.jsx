import React, { useRef, useEffect, useState } from 'react';
import { usePianoRollEngine } from './usePianoRollEngine';
import { useNoteInteractionsV2 } from './hooks/useNoteInteractionsV2';
import { drawPianoRoll } from './renderer';
import Toolbar from './components/Toolbar';
import VelocityLane from './components/VelocityLane';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { usePlaybackStore } from '@/store/usePlaybackStoreV2';
import './PianoRoll_v5.css';

function PianoRoll() {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const { snapValue, setSnapValue, ...engine } = usePianoRollEngine(containerRef);

    // Toolbar state
    const [activeTool, setActiveTool] = useState('select');
    const [zoom, setZoom] = useState(1.0);

    // ✅ UNIFIED TRANSPORT SYSTEM - Single source of truth
    const togglePlayPause = usePlaybackStore(state => state.togglePlayPause);
    const playbackMode = usePlaybackStore(state => state.playbackMode);
    const position = usePlaybackStore(state => playbackMode === 'pattern' ? state.currentStep : 0);
    const isPlaying = usePlaybackStore(state => state.isPlaying);
    const playbackState = usePlaybackStore(state => state.playbackState);

    // Get data from persistent stores
    const pianoRollInstrumentId = usePanelsStore(state => state.pianoRollInstrumentId);
    const instruments = useInstrumentsStore(state => state.instruments);

    const currentInstrument = pianoRollInstrumentId
        ? instruments.find(inst => inst.id === pianoRollInstrumentId)
        : null;

    // V2 Hook - Sade ve basit, ArrangementStore merkezli
    const noteInteractions = useNoteInteractionsV2(
        engine,
        activeTool,
        snapValue,
        currentInstrument
    );


    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !engine.viewport.width) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        }

        // V2 Hook - Basit data yapısı + Playhead
        const engineWithData = {
            ...engine,
            snapValue,
            notes: noteInteractions.notes, // V2 Hook'dan direkt array
            selectedNoteIds: noteInteractions.selectedNoteIds,
            hoveredNoteId: noteInteractions.hoveredNoteId,
            selectionArea: noteInteractions.selectionArea,
            isSelectingArea: noteInteractions.isSelectingArea,
            previewNote: noteInteractions.previewNote,
            slicePreview: noteInteractions.slicePreview, // ✅ SLICE PREVIEW
            sliceRange: noteInteractions.sliceRange, // ✅ SLICE RANGE
            // ✅ PLAYHEAD DATA
            playhead: {
                position,
                isPlaying,
                playbackState
            }
        };
        drawPianoRoll(ctx, engineWithData);

    }, [engine, snapValue, noteInteractions, position, isPlaying, playbackState, playbackMode]);

    // Toolbar handlers
    const handleToolChange = (tool) => {
        setActiveTool(tool);
    };

    const handleZoomChange = (newZoom) => {
        setZoom(newZoom);
    };

    // ✅ VELOCITY LANE HANDLER
    const handleNoteVelocityChange = (noteId, newVelocity) => {
        // Update note velocity via note interactions
        noteInteractions.updateNoteVelocity?.(noteId, newVelocity);
    };

    // ✅ REMOVED: Global keyboard shortcuts now handled by TransportManager
    // No need for component-level spacebar handling

    return (
        <div className="prv5-container">
            <Toolbar
                snapValue={snapValue}
                onSnapChange={setSnapValue}
                activeTool={activeTool}
                onToolChange={handleToolChange}
                zoom={zoom}
                onZoomChange={handleZoomChange}
                selectedCount={noteInteractions.selectedNoteIds.size} // V2 Hook'dan
            />
            <div
                ref={containerRef}
                className="prv5-canvas-container"
                onWheel={engine.eventHandlers.onWheel}
                onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const isInRuler = y <= 30;
                    const isInGrid = x > 80 && y > 30;

                    if (isInRuler) {
                        engine.eventHandlers.onMouseDown?.(e);
                    } else if (isInGrid) {
                        noteInteractions.handleMouseDown(e);
                    }
                }}
                onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const isInRuler = y <= 30;
                    const isInGrid = x > 80 && y > 30;

                    if (isInRuler) {
                        engine.eventHandlers.onMouseMove?.(e);
                    } else if (isInGrid) {
                        noteInteractions.handleMouseMove(e);
                    }
                    // engine.eventHandlers.onMouseMove?.(e); // Bu satır viewport kaymasına neden oluyor
                }}
                onMouseUp={(e) => {
                    noteInteractions.handleMouseUp(e);
                    engine.eventHandlers.onMouseUp?.(e);
                }}
                onMouseLeave={(e) => {
                    noteInteractions.handleMouseUp(e);
                    engine.eventHandlers.onMouseLeave?.(e);
                }}
                onKeyDown={noteInteractions.handleKeyDown}
                onContextMenu={(e) => e.preventDefault()}
                tabIndex={0}
            >
                <canvas ref={canvasRef} className="prv5-canvas" />
                <div className="prv5-debug-overlay">
                    <div>Scroll: {Math.round(engine.viewport.scrollX)}, {Math.round(engine.viewport.scrollY)}</div>
                    <div>Zoom: {engine.viewport.zoomX.toFixed(2)}x, {engine.viewport.zoomY.toFixed(2)}y</div>
                    <div>LOD: {engine.lod}</div>
                    <div>Instrument: {currentInstrument ? `${currentInstrument.name} (${currentInstrument.type})` : 'None'}</div>
                    <div>Pattern: V2 ({noteInteractions.notes.length} notes)</div>
                    <div>Tool: {activeTool}</div>
                </div>
            </div>

            {/* ✅ VELOCITY LANE */}
            <VelocityLane
                notes={noteInteractions.notes}
                selectedNoteIds={Array.from(noteInteractions.selectedNoteIds)}
                onNoteVelocityChange={handleNoteVelocityChange}
                dimensions={engine.dimensions}
                viewport={engine.viewport}
                activeTool={activeTool}
            />
        </div>
    );
}

export default PianoRoll;
