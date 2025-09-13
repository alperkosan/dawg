import { useState, useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { usePianoRollStore } from '../../store/usePianoRollStore';
import { getNoteAt, deleteNotes, createNote } from './pianoRollInteractions';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';

// Bir değeri belirli bir aralıkta sınırlar.
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

/**
 * Piano Roll için tüm karmaşık kullanıcı etkileşimlerini yöneten merkezi hook.
 * Bu hook, state'i ve olay dinleyicilerini yöneterek ana bileşeni temiz tutar.
 */
export const usePianoRollInteraction = ({
    notes, handleNotesChange, instrumentId, audioEngineRef,
    noteToY, stepToX, keyHeight, stepWidth, pitchToIndex, indexToPitch, totalKeys,
    xToStep, yToNote,
    gridContainerRef, keyboardWidth,
    setHoveredElement,
    velocityLaneHeight 
}) => {
    // Etkileşim state'i: O anda hangi işlemin yapıldığını tutar (sürükleme, silme vb.)
    const [interaction, setInteraction] = useState(null);
    // Seçili notaların ID'lerini tutan Set.
    const [selectedNotes, setSelectedNotes] = useState(new Set());
    
    // Ataletli kaydırma (inertial panning) için gerekli state'leri tutan ref.
    const panState = useRef({ velocityX: 0, velocityY: 0, lastX: 0, lastY: 0, isPanning: false, animationFrame: null });
    
    // Zustand store'larından gerekli state ve action'ları al.
    const { activeTool, lastUsedDuration, setLastUsedDuration, gridSnapValue } = usePianoRollStore();
    const snapSteps = Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds();
    
    // Her zaman en güncel nota listesini almak için bir fonksiyon.
    const getNotes = () => useInstrumentsStore.getState().instruments.find(i => i.id === instrumentId)?.notes || [];
    
    // Diğer fonksiyonlara kolayca geçmek için ortak prop'ları birleştir.
    const commonInteractionProps = { getNotes, noteToY, stepToX, keyHeight, stepWidth, xToStep, yToNote, handleNotesChange, lastUsedDuration, instrumentId, notes };

    // Fare tuşuna basıldığında tetiklenen ana fonksiyon.
    const handleMouseDown = useCallback((e) => {
        const grid = gridContainerRef.current;
        if (!grid) return;

        // Alt/Option tuşuna basılıysa, ataletli kaydırmayı başlat.
        if (e.altKey || e.metaKey) {
            panState.current.isPanning = true;
            panState.current.lastX = e.clientX;
            panState.current.lastY = e.clientY;
            panState.current.velocityX = 0;
            panState.current.velocityY = 0;
            cancelAnimationFrame(panState.current.animationFrame);
            grid.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        const rect = grid.getBoundingClientRect();
        const x = e.clientX - rect.left + grid.scrollLeft - keyboardWidth;
        const y = e.clientY - rect.top + grid.scrollTop;

        let interactionType = null;
        let newSelection = new Set(selectedNotes);
        const clickedNote = getNoteAt(x, y, commonInteractionProps);

        // Sağ tık her zaman silme modunu tetikler.
        if (e.button === 2) {
            e.preventDefault();
            interactionType = 'deleting';
            if (clickedNote) {
                deleteNotes([clickedNote.id], commonInteractionProps);
            }
        } else {
            // Seçili araca göre işlem yap.
            switch (activeTool) {
                case 'pencil':
                    if (clickedNote) {
                        interactionType = 'dragging';
                        newSelection = new Set([clickedNote.id]);
                    } else {
                        interactionType = 'creating';
                    }
                    break;
                case 'eraser':
                    interactionType = 'deleting';
                    if (clickedNote) deleteNotes([clickedNote.id], commonInteractionProps);
                    break;
                case 'selection':
                     if (clickedNote) {
                        const noteId = clickedNote.id;
                        if (e.shiftKey) {
                            newSelection.has(noteId) ? newSelection.delete(noteId) : newSelection.add(noteId);
                        } else if (!newSelection.has(noteId)) {
                            newSelection = new Set([noteId]);
                        }
                        interactionType = 'dragging';
                    } else {
                        newSelection = new Set();
                        interactionType = 'marquee';
                    }
                    break;
                default: break;
            }
        }
        
        setSelectedNotes(newSelection);

        if (interactionType) {
            const notesToDrag = (interactionType === 'dragging' && newSelection.size > 0)
                ? getNotes().filter(n => newSelection.has(n.id)).map(n => ({...n, originalTime: n.time, originalPitchIndex: pitchToIndex(n.pitch)}))
                : [];

            setInteraction({
                type: interactionType,
                startX: e.clientX,
                startY: e.clientY,
                gridStartX: x,
                gridStartY: y,
                notesToDrag,
                deletedNotes: new Set(),
            });
        }
    }, [activeTool, commonInteractionProps, selectedNotes, gridContainerRef, keyboardWidth]);

    // Fare hareket ettiğinde tetiklenen ana fonksiyon.
    const handleMouseMove = useCallback((e) => {
        const { isPanning, lastX, lastY } = panState.current;
        if (isPanning) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            gridContainerRef.current.scrollLeft -= dx;
            gridContainerRef.current.scrollTop -= dy;
            panState.current.velocityX = dx;
            panState.current.velocityY = dy;
            panState.current.lastX = e.clientX;
            panState.current.lastY = e.clientY;
            return;
        }

        if (!interaction) return;

        const grid = gridContainerRef.current;
        const rect = grid.getBoundingClientRect();
        const currentX = e.clientX - rect.left + grid.scrollLeft - keyboardWidth;
        const currentY = e.clientY - rect.top + grid.scrollTop;
        let updatedInteraction = { ...interaction };

        switch (interaction.type) {
            case 'dragging':
                const dx = currentX - interaction.gridStartX;
                const dy = currentY - interaction.gridStartY;
                const dxSteps = Math.round((dx / stepWidth) / snapSteps) * snapSteps;
                const dySteps = Math.round(dy / keyHeight);

                updatedInteraction.previewNotes = interaction.notesToDrag.map(note => {
                    const newTime = Math.max(0, note.originalTime + dxSteps);
                    const newPitchIndex = clamp(note.originalPitchIndex - dySteps, 0, totalKeys - 1);
                    return { ...note, time: newTime, pitch: indexToPitch(newPitchIndex) };
                });
                break;

            case 'deleting':
                const noteToDelete = getNoteAt(currentX, currentY, commonInteractionProps);
                if (noteToDelete && !updatedInteraction.deletedNotes.has(noteToDelete.id)) {
                    updatedInteraction.deletedNotes.add(noteToDelete.id);
                    deleteNotes([noteToDelete.id], commonInteractionProps);
                }
                break;
            
            case 'creating':
                const duration = xToStep(currentX - interaction.gridStartX);
                const snappedDuration = Math.max(snapSteps, Math.round(duration / snapSteps) * snapSteps);
                const endTime = interaction.gridStartX + (snappedDuration * stepWidth);

                updatedInteraction.previewNote = {
                    time: xToStep(interaction.gridStartX),
                    pitch: yToNote(interaction.gridStartY),
                    duration: Tone.Time(snappedDuration * Tone.Time('16n').toSeconds()).toNotation(),
                    velocity: 1.0,
                    id: 'preview'
                };
                break;

            case 'marquee':
                const x1 = Math.min(interaction.gridStartX, currentX);
                const y1 = Math.min(interaction.gridStartY, currentY);
                const x2 = Math.max(interaction.gridStartX, currentX);
                const y2 = Math.max(interaction.gridStartY, currentY);
                const selectedIds = new Set();
                getNotes().forEach(note => {
                    const noteY = noteToY(note.pitch);
                    const noteX = stepToX(note.time);
                    if (noteX < x2 && noteX + stepWidth > x1 && noteY < y2 && noteY + keyHeight > y1) {
                        selectedIds.add(note.id);
                    }
                });
                setSelectedNotes(selectedIds);
                break;
        }
        setInteraction(updatedInteraction);
    }, [interaction, stepWidth, keyHeight, snapSteps, indexToPitch, noteToY, stepToX, keyboardWidth, gridContainerRef, commonInteractionProps]);

    // Fare tuşu bırakıldığında tetiklenen ana fonksiyon.
    const handleMouseUp = useCallback((e) => {
        if (panState.current.isPanning) {
            panState.current.isPanning = false;
            gridContainerRef.current.style.cursor = 'grab';

            const inertiaLoop = () => {
                const { velocityX, velocityY } = panState.current;
                if (Math.abs(velocityX) < 0.5 && Math.abs(velocityY) < 0.5) {
                    cancelAnimationFrame(panState.current.animationFrame);
                    return;
                }
                gridContainerRef.current.scrollLeft -= velocityX;
                gridContainerRef.current.scrollTop -= velocityY;
                panState.current.velocityX *= 0.95;
                panState.current.velocityY *= 0.95;
                panState.current.animationFrame = requestAnimationFrame(inertiaLoop);
            };
            inertiaLoop();
        }

        if (!interaction) return;

        switch (interaction.type) {
            case 'dragging':
                if (interaction.previewNotes) {
                    const movedNotesMap = new Map(interaction.previewNotes.map(n => [n.id, { time: n.time, pitch: n.pitch }]));
                    handleNotesChange(prevNotes => 
                        prevNotes.map(n => movedNotesMap.has(n.id) ? { ...n, ...movedNotesMap.get(n.id) } : n)
                    );
                }
                break;
            case 'creating':
                if (interaction.previewNote) {
                    const { time, pitch, duration } = interaction.previewNote;
                    createNote({ time, pitch, duration }, commonInteractionProps);
                    setLastUsedDuration(duration);
                }
                break;
        }
        setInteraction(null);
    }, [interaction, handleNotesChange, setLastUsedDuration, gridContainerRef, commonInteractionProps]);

    // Yeniden boyutlandırma (resize) işlemini başlatan fonksiyon.
    const handleResizeStart = useCallback((note, e) => {
        e.preventDefault();
        e.stopPropagation();
        const startDurationSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
        
        const handleResizeMove = (moveEvent) => {
            const dx = moveEvent.clientX - e.clientX;
            const dSteps = dx / stepWidth;
            const newDurationSteps = Math.max(snapSteps, startDurationSteps + dSteps);
            const newDuration = Tone.Time(newDurationSteps * Tone.Time('16n').toSeconds()).toNotation();
            setInteraction({ type: 'resizing', note, previewNote: { ...note, duration: newDuration } });
        };

        const handleResizeUp = (upEvent) => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeUp);
            const dx = upEvent.clientX - e.clientX;
            const dSteps = dx / stepWidth;
            const finalDurationSteps = Math.max(snapSteps, Math.round((startDurationSteps + dSteps) / snapSteps) * snapSteps);
            const newDuration = Tone.Time(finalDurationSteps * Tone.Time('16n').toSeconds()).toNotation();
            if (newDuration !== note.duration) {
                handleNotesChange(prev => prev.map(n => n.id === note.id ? { ...n, duration: newDuration } : n));
                setLastUsedDuration(newDuration);
            }
            setInteraction(null);
        };

        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeUp);
    }, [stepWidth, snapSteps, handleNotesChange, setLastUsedDuration]);

    // Velocity (vuruş gücü) değiştirme işlemini başlatan fonksiyon.
    const handleVelocityChange = useCallback((note, e) => {
        e.preventDefault();
        e.stopPropagation();
        const startY = e.clientY;
        const startVelocity = note.velocity;
        
        const handleVelocityMove = (moveEvent) => {
            const dy = startY - moveEvent.clientY;
            const sensitivity = moveEvent.shiftKey ? 0.002 : 0.008; // Shift ile ince ayar
            const newVelocity = clamp(startVelocity + (dy * sensitivity), 0, 1);
            handleNotesChange(prev => prev.map(n => n.id === note.id ? { ...n, velocity: newVelocity } : n));
        };

        const handleVelocityUp = () => {
            window.removeEventListener('mousemove', handleVelocityMove);
            window.removeEventListener('mouseup', handleVelocityUp);
        };

        window.addEventListener('mousemove', handleVelocityMove);
        window.addEventListener('mouseup', handleVelocityUp);
    }, [handleNotesChange]);

    // Global mouseup olayını dinle.
    useEffect(() => {
        const upHandler = (e) => handleMouseUp(e);
        window.addEventListener('mouseup', upHandler);
        return () => window.removeEventListener('mouseup', upHandler);
    }, [handleMouseUp]);

    return { 
        interactionProps: { onMouseDown: handleMouseDown, onMouseMove: handleMouseMove }, 
        selectedNotes, 
        interaction, 
        handleVelocityChange, 
        handleResizeStart,
        setSelectedNotes
    };
};