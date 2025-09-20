// src/features/piano_roll/components/PianoRoll.jsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { AudioContextService } from '../../../lib/services/AudioContextService';
import { useViewport } from '../hooks/useViewport';
import { useHybridInteractions } from '../hooks/useHybridInteractions';
import { PlaybackAnimatorService } from '../../../lib/core/PlaybackAnimatorService';
import { VirtualNotesRenderer } from './VirtualNotesRenderer';
import { GhostNotes } from './GhostNote';
import ContextMenu from './ContextMenu';
import Minimap from './Minimap';
import TimelineRuler from './TimelineRuler';
import PianoKeyboard from './PianoKeyboard';
import { PianoRollToolbar } from './PianoRollToolbar';
import { EnhancedVelocityLane } from './EnhancedVelocityLane';
import ResizableHandle from '../../../ui/ResizableHandle';
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel';
import { Music } from 'lucide-react';

function PianoRoll({ instrument }) {
    const scrollContainerRef = useRef(null);
    const playheadRef = useRef(null);
    const rulerContentRef = useRef(null);
    const keyboardContentRef = useRef(null);
    
    const [contextMenu, setContextMenu] = useState(null);
    const [clipboard, setClipboard] = useState(null);
    const [selectedNotes, setSelectedNotes] = useState(new Set());
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

    const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();
    const { loopLength } = usePlaybackStore();
    const { zoomX, zoomY, velocityLaneHeight, setVelocityLaneHeight, scale, gridSnapValue, snapMode, toggleVelocityLane } = usePianoRollStore();
    
    const activePattern = patterns[activePatternId];
    const notes = activePattern?.data[instrument?.id] || [];

    const viewport = useViewport(scrollContainerRef, { zoomX, zoomY, loopLength, snapSettings: { value: gridSnapValue, enabled: snapMode === 'hard' } });

    const handleNotesChange = useCallback((newNotes) => {
        if (instrument?.id && activePatternId) {
            updatePatternNotes(activePatternId, instrument.id, newNotes);
            if (usePlaybackStore.getState().playbackState === 'playing') AudioContextService?.reschedule();
        }
    }, [instrument?.id, activePatternId, updatePatternNotes]);
    
    const { eventHandlers, currentInteraction, audioContext, handleResizeStart } = useHybridInteractions({ notes, handleNotesChange, instrumentId: instrument?.id, viewport, containerRef: scrollContainerRef, selectedNotes, setSelectedNotes });
    
    // Basit ve etkili kaydırma senkronizasyonu
    const handleGridScroll = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollLeft } = scrollContainerRef.current;
        if (rulerContentRef.current) rulerContentRef.current.style.transform = `translateX(${-scrollLeft}px)`;
        if (keyboardContentRef.current) keyboardContentRef.current.style.transform = `translateY(${-scrollTop}px)`;
    }, []);

    useEffect(() => {
        const updatePlayhead = (progress) => {
            if (playheadRef.current) {
                const position = progress * loopLength * viewport.stepWidth;
                playheadRef.current.style.transform = `translateX(${position}px)`;
            }
        };
        PlaybackAnimatorService.subscribe(updatePlayhead);
        return () => PlaybackAnimatorService.unsubscribe(updatePlayhead);
    }, [loopLength, viewport.stepWidth]);

    const handleContextAction = useCallback((action, data) => {
        const selectedNotesArray = notes.filter(n => selectedNotes.has(n.id));
        switch (action) {
            case 'cut': setClipboard(selectedNotesArray); handleNotesChange(notes.filter(n => !selectedNotes.has(n.id))); setSelectedNotes(new Set()); break;
            case 'copy': setClipboard(selectedNotesArray); break;
            case 'paste': 
                if (clipboard && data.gridPosition) {
                    const pasteTime = data.gridPosition.time;
                    const firstNoteTime = Math.min(...clipboard.map(n => n.time));
                    const timeOffset = pasteTime - firstNoteTime;
                    const pastedNotes = clipboard.map(note => ({...note, id: `note_${Date.now()}_${Math.random()}`, time: note.time + timeOffset}));
                    handleNotesChange([...notes, ...pastedNotes]);
                    setSelectedNotes(new Set(pastedNotes.map(n => n.id)));
                }
                break;
            case 'delete': handleNotesChange(notes.filter(n => !selectedNotes.has(n.id))); setSelectedNotes(new Set()); break;
            case 'selectAll': setSelectedNotes(new Set(notes.map(n => n.id))); break;
            case 'invertSelection':
                const inverted = new Set(notes.filter(n => !selectedNotes.has(n.id)).map(n => n.id));
                setSelectedNotes(inverted);
                break;
        }
    }, [notes, selectedNotes, clipboard, handleNotesChange]);

    if (!instrument || !activePattern) {
        return (
          <div className="piano-roll-placeholder">
            <Music size={48} className="piano-roll-placeholder__icon" />
            <h3 className="piano-roll-placeholder__title">Piano Roll</h3>
            <p className="piano-roll-placeholder__text">Düzenlemek için bir enstrüman seçin.</p>
          </div>
        );
    }

    return (
        <div className="piano-roll" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, data: { selectedNotes, hasClipboard: !!clipboard, gridPosition: viewport.mouseToGrid(e) } }); }}>
            <PianoRollToolbar />
            <div className="piano-roll__main-grid-layout">
                <div className="piano-roll__corner">
                    <button onClick={() => setShowKeyboardShortcuts(true)} className="help-button" title="Kısayollar (F1)">?</button>
                </div>
                <div className="piano-roll__ruler-container">
                    <div ref={rulerContentRef} style={{ width: viewport.gridWidth }}>
                        <TimelineRuler viewport={viewport} />
                    </div>
                </div>
                <div className="piano-roll__keyboard-container">
                    <div ref={keyboardContentRef} style={{ height: viewport.gridHeight }}>
                        <PianoKeyboard viewport={viewport} scale={scale} onNotePreview={(p,v) => audioContext.auditionNote(p,v)} />
                    </div>
                </div>
                <div ref={scrollContainerRef} className="piano-roll__scroll-container" onScroll={handleGridScroll} {...eventHandlers}>
                    <div className="piano-roll__scroll-content-wrapper" style={{ width: viewport.gridWidth, height: viewport.gridHeight }}>
                        <GhostNotes currentInstrumentId={instrument?.id} viewport={viewport} />
                        <VirtualNotesRenderer notes={notes} selectedNotes={selectedNotes} viewport={viewport} interaction={currentInteraction} onResizeStart={handleResizeStart} />
                        <div ref={playheadRef} className="piano-roll__playhead" style={{ height: viewport.gridHeight }} />
                    </div>
                </div>
            </div>
            {velocityLaneHeight > 0 && (
                <>
                    <ResizableHandle onDrag={(deltaY) => setVelocityLaneHeight(prev => Math.max(30, Math.min(300, prev - deltaY)))} onDoubleClick={toggleVelocityLane} />
                    <EnhancedVelocityLane notes={notes} selectedNotes={selectedNotes} viewport={viewport} height={velocityLaneHeight} onVelocityChange={(id, vel) => handleNotesChange(notes.map(n => n.id === id ? {...n, velocity: vel} : n))} />
                </>
            )}
            <Minimap notes={notes} selectedNotes={selectedNotes} viewport={viewport} onNavigate={(x,y) => scrollContainerRef.current.scrollTo({left:x, top:y, behavior: 'auto'})} />
            <ContextMenu contextMenu={contextMenu} setContextMenu={setContextMenu} onAction={handleContextAction} />
            <KeyboardShortcutsPanel isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} />
        </div>
    );
}

export default React.memo(PianoRoll);