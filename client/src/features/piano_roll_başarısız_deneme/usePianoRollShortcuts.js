import { useEffect, useCallback } from 'react';
import { usePianoRollStore } from '../../store/usePianoRollStore';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import * as Tone from 'tone';

export const usePianoRollShortcuts = ({ 
    activeTool,
    setActiveTool, 
    audioEngineRef,
    selectedNotes,
    handleNotesChange,
    getNotes,
    setSelectedNotes,
    instrument,
    viewport,
}) => {
    const { setView } = usePianoRollStore.getState();

    const shortcuts = useCallback((e) => {
        if (['input', 'textarea'].includes(e.target.tagName.toLowerCase())) return;

        const key = e.key.toLowerCase();
        const isCtrlOrMeta = e.ctrlKey || e.metaKey;

        // YENİ: Zoom to Selection (Z tuşu)
        if (key === 'z' && !isCtrlOrMeta && selectedNotes.size > 0) {
            e.preventDefault();
            const notes = getNotes();
            const selected = notes.filter(n => selectedNotes.has(n.id));

            if (selected.length === 0) return;

            let minTime = Infinity, maxTime = -Infinity;
            let minPitch = Infinity, maxPitch = -Infinity;
            
            const pitchToIndex = (pitch) => (parseInt(pitch.slice(-1), 10) * 12 + ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(pitch.slice(0, -1)));

            selected.forEach(note => {
                const duration = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
                minTime = Math.min(minTime, note.time);
                maxTime = Math.max(maxTime, note.time + duration);
                const pitchIndex = pitchToIndex(note.pitch);
                minPitch = Math.min(minPitch, pitchIndex);
                maxPitch = Math.max(maxPitch, pitchIndex);
            });

            const timeRange = maxTime - minTime;
            const pitchRange = maxPitch - minPitch + 1;

            const PADDING = 1.1; // %10 boşluk
            const KEY_HEIGHT = 20;
            const STEP_WIDTH = 40;
            
            const newZoomX = (viewport.width / (timeRange * STEP_WIDTH * PADDING));
            const newZoomY = (viewport.height / (pitchRange * KEY_HEIGHT * PADDING));

            const totalKeys = 8 * 12;
            const newScrollTop = (totalKeys - maxPitch - 1) * KEY_HEIGHT * newZoomY - (viewport.height / 2) + ((pitchRange * KEY_HEIGHT * newZoomY) / 2);
            const newScrollLeft = minTime * STEP_WIDTH * newZoomX - (viewport.width / 2) + ((timeRange * STEP_WIDTH * newZoomX) / 2);
            
            setView({
                zoomX: newZoomX,
                zoomY: newZoomY,
                scrollTop: newScrollTop,
                scrollLeft: newScrollLeft
            });
        }

        if (isCtrlOrMeta) return;

        switch(key) {
            case '1': e.preventDefault(); setActiveTool('selection'); break;
            case '2': e.preventDefault(); setActiveTool('pencil'); break;
            case '3': e.preventDefault(); setActiveTool('eraser'); break;
            default: break;
        }

    }, [activeTool, setActiveTool, audioEngineRef, selectedNotes, handleNotesChange, getNotes, setSelectedNotes, instrument, viewport, setView]);

    useEffect(() => {
        window.addEventListener('keydown', shortcuts);
        return () => window.removeEventListener('keydown', shortcuts);
    }, [shortcuts]);
};