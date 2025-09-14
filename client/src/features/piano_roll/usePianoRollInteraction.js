import { useState,useMemo ,useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { usePianoRollStore } from '../../store/usePianoRollStore';
import { getNoteAt, deleteNotes, createNote } from './pianoRollInteractions';

/**
 * @file usePianoRollInteraction.js - YENİDEN YAPILANDIRILDI
 * @description Piano Roll üzerindeki tüm kullanıcı etkileşimlerini (nota çizme, taşıma, silme, seçme,
 * velocity ayarlama, kaydırma vb.) yöneten merkezi React Hook'u. Bu hook, bir state machine
 * (durum makinesi) gibi çalışarak, o anki eylemi `interaction` state'i içinde tutar.
 * Tüm hesaplamalar, yeni BBT (Bar:Beat:Tick) ve "snap" sistemleriyle tam entegredir.
 */

// Bir değeri verilen min/max aralığında sınırlayan yardımcı fonksiyon.
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const usePianoRollInteraction = ({
    notes, handleNotesChange, instrumentId, audioEngineRef,
    noteToY, stepToX, keyHeight, stepWidth, pitchToIndex, indexToPitch, totalKeys,
    xToStep, yToNote,
    gridContainerRef, keyboardWidth,
    velocityLaneHeight
}) => {
    // STATE: Hook'un iç durumunu yöneten state'ler.
    const [interaction, setInteraction] = useState(null);
    const [selectedNotes, setSelectedNotes] = useState(new Set());
    const panState = useRef({ isPanning: false }); // Kaydırma (panning) durumu
    
    // STORE: Zustand store'larından gelen global state'ler ve eylemler.
    const { activeTool, lastUsedDuration, setLastUsedDuration, gridSnapValue, snapMode } = usePianoRollStore();
    // '16n', '8n' gibi değerleri, 16'lık nota adımına göre bir çarpana dönüştürürüz (örn: 8n -> 2 adım)
    const snapSteps = useMemo(() => Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds(), [gridSnapValue]);
    
    // YARDIMCILAR: Kod tekrarını önleyen ve her zaman en güncel veriyi sağlayan fonksiyon.
    const getNotes = useCallback(() => notes, [notes]);
    const commonInteractionProps = { getNotes, noteToY, stepToX, keyHeight, stepWidth, xToStep, yToNote, handleNotesChange, lastUsedDuration, instrumentId, notes };

    // Bir notanın seçilmesi durumunda, bir sonraki çizilecek notanın uzunluğunu günceller.
    useEffect(() => {
        if (selectedNotes.size === 1) {
            const lastSelectedId = selectedNotes.values().next().value;
            const selectedNote = getNotes().find(n => n.id === lastSelectedId);
            if (selectedNote) {
                setLastUsedDuration(selectedNote.duration);
            }
        }
    }, [selectedNotes, setLastUsedDuration, getNotes]);

    /**
     * Izgara veya Velocity Lane üzerinde fareye basıldığında tetiklenir.
     * Hangi eylemin başlayacağını belirler ve `interaction` state'ini kurar.
     */
    const handleMouseDown = useCallback((e) => {
        const grid = gridContainerRef.current;
        if (!grid) return;

        // Eylem 1: Orta tuş veya Alt tuşu ile kaydırma (Panning)
        if (e.altKey || e.button === 1) {
            panState.current = { isPanning: true, lastX: e.clientX, lastY: e.clientY };
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

        // Eylem 2: Sağ tık (Silme) - Sağ tık her zaman silgi gibi çalışır
        if (e.button === 2) {
            e.preventDefault();
            if (clickedNote) deleteNotes([clickedNote.id], commonInteractionProps);
            return;
        }
        
        // Eylem 3: Sol tık (Seçili araca göre değişir)
        switch (activeTool) {
            case 'pencil':
                if (clickedNote) {
                    interactionType = 'dragging';
                    // Tıklanan nota zaten seçili değilse, sadece onu seç.
                    if (!selectedNotes.has(clickedNote.id)) newSelection = new Set([clickedNote.id]);
                } else {
                    interactionType = 'creating';
                    // İşitsel geri bildirim: nota oluşturmaya başlarken sesi çal.
                    const pitch = yToNote(y);
                    audioEngineRef.current?.auditionNoteOn(instrumentId, pitch);
                }
                break;
            case 'eraser':
                if (clickedNote) deleteNotes([clickedNote.id], commonInteractionProps);
                break;
            case 'selection':
                if (clickedNote) {
                    const noteId = clickedNote.id;
                    if (e.shiftKey) { // Shift tuşu ile çoklu seçim
                        newSelection.has(noteId) ? newSelection.delete(noteId) : newSelection.add(noteId);
                    } else if (!newSelection.has(noteId)) {
                        newSelection = new Set([noteId]);
                    }
                    interactionType = 'dragging';
                } else { // Boş alana tıklandıysa seçim kutusu (marquee) çiz
                    newSelection = new Set();
                    interactionType = 'marquee';
                }
                break;
        }
        
        setSelectedNotes(newSelection);

        if (interactionType) {
            // Sürükleme işlemi için taşınacak notaların başlangıç pozisyonlarını kaydet
            const notesToDrag = (interactionType === 'dragging' && newSelection.size > 0)
                ? getNotes().filter(n => newSelection.has(n.id)).map(n => ({...n, originalTime: n.time, originalPitchIndex: pitchToIndex(n.pitch)}))
                : [];

            setInteraction({
                type: interactionType,
                startX: e.clientX, startY: e.clientY, startTime: Date.now(),
                gridStartX: x, gridStartY: y,
                notesToDrag,
                createdNotePitch: (interactionType === 'creating') ? yToNote(y) : null
            });
        }
    }, [activeTool, commonInteractionProps, selectedNotes, gridContainerRef, snapSteps, instrumentId, audioEngineRef, pitchToIndex, yToNote, getNotes, keyboardWidth]);
    
    /**
     * Fare hareket ettiğinde tetiklenir.
     * Başlatılmış olan eyleme (`interaction.type`) göre işlem yapar.
     */
    const handleMouseMove = useCallback((e) => {
        const grid = gridContainerRef.current;
        if (!grid) return;

        if (panState.current.isPanning) {
            const dx = e.clientX - panState.current.lastX;
            const dy = e.clientY - panState.current.lastY;
            grid.scrollLeft -= dx;
            grid.scrollTop -= dy;
            panState.current.lastX = e.clientX;
            panState.current.lastY = e.clientY;
            return;
        }
        
        if (!interaction) return;
        
        const rect = grid.getBoundingClientRect();
        const currentX = e.clientX - rect.left + grid.scrollLeft - keyboardWidth;
        const currentY = e.clientY - rect.top + grid.scrollTop;
        let updatedInteraction = { ...interaction, currentX, currentY };

        switch (interaction.type) {
            case 'dragging':
                const dxSteps = Math.round(((currentX - interaction.gridStartX) / stepWidth) / snapSteps) * snapSteps;
                const dySteps = Math.round((currentY - interaction.gridStartY) / keyHeight);
                
                updatedInteraction.previewNotes = interaction.notesToDrag
                    .map(note => ({ 
                        ...note, 
                        time: Math.max(0, note.originalTime + dxSteps), 
                        pitch: indexToPitch(clamp(note.originalPitchIndex - dySteps, 0, totalKeys - 1)) 
                    }));
                break;
            case 'creating':
                 const duration = xToStep(currentX - interaction.gridStartX);
                 const snappedDuration = Math.max(snapSteps, Math.round(duration / snapSteps) * snapSteps);
                 
                 updatedInteraction.previewNote = {
                    time: Math.round(xToStep(interaction.gridStartX) / snapSteps) * snapSteps,
                    pitch: yToNote(interaction.gridStartY),
                    duration: Tone.Time(snappedDuration * Tone.Time('16n').toSeconds()).toNotation(),
                    velocity: 1.0, id: 'preview'
                 };
                 break;
            case 'marquee':
                const selectedIds = new Set();
                const [x1, x2] = [Math.min(interaction.gridStartX, currentX), Math.max(interaction.gridStartX, currentX)];
                const [y1, y2] = [Math.min(interaction.gridStartY, currentY), Math.max(interaction.gridStartY, currentY)];
                getNotes().forEach(note => {
                    const noteY = noteToY(note.pitch);
                    const noteX = stepToX(note.time);
                    if (noteX < x2 && noteX + stepWidth > x1 && noteY < y2 && noteY + keyHeight > y1) selectedIds.add(note.id);
                });
                setSelectedNotes(selectedIds);
                break;
        }
        setInteraction(updatedInteraction);
    }, [interaction, stepWidth, keyHeight, snapSteps, indexToPitch, noteToY, stepToX, getNotes, keyboardWidth, totalKeys, yToNote, xToStep]);
    
    /**
     * Fare bırakıldığında tetiklenir ve eylemi sonlandırır.
     */
    const handleMouseUp = useCallback((e) => {
        if (panState.current.isPanning) {
            panState.current.isPanning = false;
            if (gridContainerRef.current) gridContainerRef.current.style.cursor = 'default';
        }

        if (!interaction) return;
        
        // İşitsel geri bildirim: nota oluşturma bittiğinde sesi sustur.
        if (interaction.type === 'creating' && interaction.createdNotePitch) {
            audioEngineRef.current?.auditionNoteOff(instrumentId, interaction.createdNotePitch);
        }

        switch (interaction.type) {
            case 'dragging':
                if (interaction.previewNotes) {
                    const movedNotesMap = new Map(interaction.previewNotes.map(n => [n.id, { time: n.time, pitch: n.pitch }]));
                    handleNotesChange(prevNotes => prevNotes.map(n => movedNotesMap.has(n.id) ? { ...n, ...movedNotesMap.get(n.id) } : n));
                }
                break;
            case 'creating':
                const DRAG_THRESHOLD_PIXELS = 5;
                const TAP_THRESHOLD_MS = 150;
                const timeElapsed = Date.now() - interaction.startTime;
                const distanceDragged = Math.hypot(e.clientX - interaction.startX, e.clientY - interaction.startY);
                const isQuickTap = distanceDragged < DRAG_THRESHOLD_PIXELS && timeElapsed < TAP_THRESHOLD_MS;

                if (isQuickTap) { // Hızlı tıklama ise
                    const time = xToStep(interaction.gridStartX);
                    const pitch = yToNote(interaction.gridStartY);
                    const newNote = createNote({ time: Math.round(time / snapSteps) * snapSteps, pitch, duration: lastUsedDuration }, commonInteractionProps);
                    setSelectedNotes(new Set([newNote.id]));
                } 
                else if (interaction.previewNote && Tone.Time(interaction.previewNote.duration).toSeconds() > 0) { // Sürükleme ise
                    const { time, pitch, duration } = interaction.previewNote;
                    const newNote = createNote({ time, pitch, duration }, commonInteractionProps);
                    setLastUsedDuration(duration);
                    setSelectedNotes(new Set([newNote.id]));
                }
                break;
        }
        setInteraction(null);
    }, [interaction, handleNotesChange, setLastUsedDuration, xToStep, yToNote, snapSteps, lastUsedDuration, instrumentId, audioEngineRef]);

    /**
     * Bir notanın kenarından tutulup yeniden boyutlandırılması eylemini yönetir.
     */
    const handleResizeStart = useCallback((note, e) => {
        e.preventDefault(); e.stopPropagation();
        const startDurationSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
        audioEngineRef.current?.auditionNoteOn(instrumentId, note.pitch);

        const handleResizeMove = (moveEvent) => {
            const dx = moveEvent.clientX - e.clientX;
            const newDurationSteps = Math.max(snapSteps, startDurationSteps + (dx / stepWidth));
            const newDuration = Tone.Time(newDurationSteps * Tone.Time('16n').toSeconds()).toNotation();
            setInteraction({ type: 'resizing', note, previewNote: { ...note, duration: newDuration } });
        };

        const handleResizeUp = (upEvent) => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeUp);
            audioEngineRef.current?.auditionNoteOff(instrumentId, note.pitch);
            
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
    }, [stepWidth, snapSteps, handleNotesChange, setLastUsedDuration, instrumentId, audioEngineRef]);
    
    // --- Velocity Lane Etkileşimleri (Değişiklik yok, zaten sağlam çalışıyor) ---
    const initiateVelocityDrag = useCallback((note, e) => {
        e.preventDefault(); e.stopPropagation();
        const startY = e.clientY;
        const isNoteSelected = selectedNotes.has(note.id);
        const startVelocities = new Map();
        (isNoteSelected ? getNotes().filter(n => selectedNotes.has(n.id)) : [note]).forEach(n => {
            startVelocities.set(n.id, n.velocity);
        });
        
        const handleVelocityMove = (moveEvent) => {
            const dy = startY - moveEvent.clientY;
            const velocityChange = dy * (moveEvent.shiftKey ? 0.002 : 0.008);
            handleNotesChange(prevNotes => prevNotes.map(n => {
                if (startVelocities.has(n.id)) {
                    return { ...n, velocity: clamp(startVelocities.get(n.id) + velocityChange, 0.01, 1) };
                }
                return n;
            }));
        };

        const handleVelocityUp = () => {
            window.removeEventListener('mousemove', handleVelocityMove);
            window.removeEventListener('mouseup', handleVelocityUp);
        };
        window.addEventListener('mousemove', handleVelocityMove);
        window.addEventListener('mouseup', handleVelocityUp);
    }, [handleNotesChange, selectedNotes, getNotes]);
    
    const handleVelocityBarMouseDown = useCallback((note, e) => {
        if (e.shiftKey) {
            setSelectedNotes(prev => {
                const newSelection = new Set(prev);
                newSelection.has(note.id) ? newSelection.delete(note.id) : newSelection.add(note.id);
                return newSelection;
            });
        } else if (!selectedNotes.has(note.id)) {
            setSelectedNotes(new Set([note.id]));
        }
        initiateVelocityDrag(note, e);
    }, [setSelectedNotes, initiateVelocityDrag]);

    const handleVelocityWheel = useCallback((note, e) => {
        e.preventDefault(); e.stopPropagation();
        const changeAmount = -e.deltaY * 0.0015;
        const notesToUpdate = (e.altKey && selectedNotes.has(note.id)) ? selectedNotes : new Set([note.id]);
        handleNotesChange(prev => prev.map(n => notesToUpdate.has(n.id) ? { ...n, velocity: clamp(n.velocity + changeAmount, 0.01, 1) } : n));
    }, [handleNotesChange, selectedNotes]);

    // Global 'mouseup' dinleyicisi, herhangi bir eylemi sonlandırmak için.
    useEffect(() => {
        const upHandler = (e) => {
            if (panState.current.isPanning || interaction) handleMouseUp(e);
        };
        window.addEventListener('mouseup', upHandler);
        return () => window.removeEventListener('mouseup', upHandler);
    }, [handleMouseUp, interaction]);

    // Hook'un dış dünyaya açtığı arayüz.
    return { 
        interactionProps: { onMouseDown: handleMouseDown, onMouseMove: handleMouseMove },
        selectedNotes,
        interaction,
        handleVelocityBarMouseDown,
        handleVelocityWheel,
        handleResizeStart,
        setSelectedNotes,
    };
};