import { useState, useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { usePianoRollStore } from '../../store/usePianoRollStore';
import { getNoteAt, deleteNotes, createNote } from './pianoRollInteractions';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const usePianoRollInteraction = ({
    notes, handleNotesChange, instrumentId, audioEngineRef,
    noteToY, stepToX, keyHeight, stepWidth, pitchToIndex, indexToPitch, totalKeys,
    xToStep, yToNote,
    gridContainerRef, keyboardWidth,
    setHoveredElement,
    velocityLaneHeight
}) => {
    const [interaction, setInteraction] = useState(null);
    const [selectedNotes, setSelectedNotes] = useState(new Set());
    const panState = useRef({ velocityX: 0, velocityY: 0, lastX: 0, lastY: 0, isPanning: false, animationFrame: null });
    
    const { activeTool, lastUsedDuration, setLastUsedDuration, gridSnapValue, snapMode } = usePianoRollStore();
    const snapSteps = Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds();
    
    const getNotes = () => useInstrumentsStore.getState().instruments.find(i => i.id === instrumentId)?.notes || [];
    const commonInteractionProps = { getNotes, noteToY, stepToX, keyHeight, stepWidth, xToStep, yToNote, handleNotesChange, lastUsedDuration, instrumentId, notes };

    /**
     * Bu hook, kullanıcı bir notayı seçtiğinde "son kullanılan nota uzunluğunu" günceller.
     * Bu sayede bir sonraki çizilecek nota, en son seçilen notanın uzunluğunda olur.
    */
    useEffect(() => {
        // Eğer seçili nota sayısı tam olarak 1 ise...
        if (selectedNotes.size === 1) {
            // Seçili olan tek notanın ID'sini al.
            const lastSelectedId = selectedNotes.values().next().value;
            const allNotes = getNotes();
            const selectedNote = allNotes.find(n => n.id === lastSelectedId);

            // Eğer notayı bulabildiysek...
            if (selectedNote) {
                // ...süresini merkezi state'e (store'a) kaydet.
                setLastUsedDuration(selectedNote.duration);
            }
        }
    }, [selectedNotes, setLastUsedDuration]); // Bu hook sadece 'selectedNotes' değiştiğinde çalışır.
    // ========================================================================

    const handleMouseDown = useCallback((e) => {
        const grid = gridContainerRef.current;
        if (!grid) return;

        // Fikir 3: Alt tuşu ile otomasyon çizme
        // Eğer tıklama Velocity Lane içinde ve Alt tuşu basılıysa...
        const isVelocityLaneClick = e.target.dataset.role === 'velocity-lane-bg';
        if (e.altKey && isVelocityLaneClick) {
            e.preventDefault();
            const rect = grid.getBoundingClientRect();
            const x = e.clientX - rect.left + grid.scrollLeft - keyboardWidth;
            const y = e.clientY - rect.top + grid.scrollTop;

            setInteraction({
                type: 'drawing-velocity',
                startX: x,
                startY: y,
                drawnNotes: new Set(), // Hangi notaların üzerine çizildiğini takip et
            });
            return;
        }

        if (e.altKey || e.button === 1) { // Orta tuşa basmayı da yakala
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
        const clickedResizeHandle = e.target.dataset.role === 'note-resize-handle';

        if (clickedResizeHandle && clickedNote) {
            return; // Yeniden boyutlandırma `Note` bileşeni tarafından başlatılıyor.
        }

        if (e.button === 2) {
             e.preventDefault();
             // Sağ tık silgi gibi çalışsın
             if (clickedNote) {
                deleteNotes([clickedNote.id], commonInteractionProps);
             }
        } else {
            switch (activeTool) {
                case 'pencil':
                    if (clickedNote) {
                        interactionType = 'dragging';
                        newSelection = new Set([clickedNote.id]);
                    } else {
                        // --- GÖRSEL-İŞİTSEL SENKRONİZASYON (BAŞLANGIÇ) ---
                        // Nota çizmeye başlarken sesi de başlatıyoruz.
                        const time = xToStep(x);
                        const snappedTime = Math.round(time / snapSteps) * snapSteps;
                        const pitch = yToNote(y);
                        
                        audioEngineRef.current?.auditionNoteOn(instrumentId, pitch);
                        
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
                // Oluşturulan notanın pitch'ini state'te tutuyoruz ki mouseUp'ta sesi durdurabilelim
                createdNotePitch: (interactionType === 'creating') ? yToNote(y) : null,
                deletedNotes: new Set(),
            });
        }
    }, [activeTool, commonInteractionProps, selectedNotes, gridContainerRef, keyboardWidth, snapSteps, instrumentId, audioEngineRef]);

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
                // --- IZGARA SİSTEMİ (DRAGGING) ---
                // Bu bölüm, sürükleme sırasında hem 'hard' hem de 'soft' snap modunu destekliyor.
                const dx = currentX - interaction.gridStartX;
                const dy = currentY - interaction.gridStartY;

                let dxSteps;
                const totalDxSteps = dx / stepWidth;
                
                if (snapMode === 'soft') {
                    const snapThreshold = snapSteps * 0.3;
                    const nearestSnapPoint = Math.round(totalDxSteps / snapSteps) * snapSteps;
                    const distanceFromSnap = Math.abs(totalDxSteps - nearestSnapPoint);
                    dxSteps = (distanceFromSnap <= snapThreshold) ? nearestSnapPoint : totalDxSteps;
                } else {
                    dxSteps = Math.round(totalDxSteps / snapSteps) * snapSteps;
                }
                
                const dySteps = Math.round(dy / keyHeight);

                updatedInteraction.previewNotes = interaction.notesToDrag
                    // 1. ADIM: Hesaplama yapmadan önce 'originalTime' değeri olmayan veya
                    // sayı olmayan notaları filtreleyerek işlemi güvenli hale getiriyoruz.
                    .filter(note => typeof note.originalTime === 'number' && !isNaN(note.originalTime))
                    .map(note => {
                        // 2. ADIM: Her ihtimale karşı 'originalTime' değerini kontrol ediyoruz.
                        const baseTime = note.originalTime || 0;
                        const newTime = Math.max(0, baseTime + dxSteps);
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
                // --- IZGARA SİSTEMİ (CREATING) ---
                // Nota oluştururken de hem pozisyonu hem de uzunluğu ızgaraya hizalıyoruz.
                const time = xToStep(interaction.gridStartX);
                const snappedTime = Math.round(time / snapSteps) * snapSteps;
                const pitch = yToNote(interaction.gridStartY);

                const duration = xToStep(currentX - stepToX(snappedTime));
                const snappedDuration = Math.max(snapSteps, Math.round(duration / snapSteps) * snapSteps);

                updatedInteraction.previewNote = {
                    time: snappedTime,
                    pitch: pitch,
                    duration: Tone.Time(snappedDuration * Tone.Time('16n').toSeconds()).toNotation(),
                    velocity: 1.0,
                    id: 'preview'
                };
                break;

            case 'marquee':
                // ... (Marquee mantığı aynı kalıyor)
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
                updatedInteraction.currentX = currentX;
                updatedInteraction.currentY = currentY;
                break;

            // Fikir 3: Otomasyon çizme mantığı
            case 'drawing-velocity':
                const velocityLaneRect = e.currentTarget.getBoundingClientRect();
                const relativeY = e.clientY - velocityLaneRect.top - (velocityLaneRect.height - velocityLaneHeight);
                const newVelocity = clamp(1 - (relativeY / velocityLaneHeight), 0.01, 1);
                
                const allNotes = getNotes();
                const startX = Math.min(interaction.startX, currentX);
                const endX = Math.max(interaction.startX, currentX);
                
                const notesToUpdate = allNotes.filter(note => {
                    const noteX = stepToX(note.time);
                    return noteX >= startX && noteX <= endX;
                });
                
                if (notesToUpdate.length > 0) {
                    const idsToUpdate = new Set(notesToUpdate.map(n => n.id));
                    handleNotesChange(prev => 
                        prev.map(n => idsToUpdate.has(n.id) ? { ...n, velocity: newVelocity } : n)
                    );
                }
                
                updatedInteraction.startX = currentX; // "Çizgiyi" devam ettirmek için başlangıç noktasını güncelle
                break;
        }
        setInteraction(updatedInteraction);
    }, [interaction, stepWidth, keyHeight, snapSteps, indexToPitch, noteToY, stepToX, keyboardWidth, gridContainerRef, commonInteractionProps, snapMode]);

    const handleMouseUp = useCallback((e) => {
        // ... (Pan mantığı aynı kalıyor)
        if (panState.current.isPanning) {
            panState.current.isPanning = false;
            gridContainerRef.current.style.cursor = 'grab';
            // ... (inertiaLoop)
        }

        if (!interaction) return;

        // --- GÖRSEL-İŞİTSEL SENKRONİZASYON (BİTİŞ) ---
        // Eğer bir nota oluşturuluyorduysa, fare bırakıldığında sesi durdur.
        if (interaction.type === 'creating' && interaction.createdNotePitch) {
            audioEngineRef.current?.auditionNoteOff(instrumentId, interaction.createdNotePitch);
        }

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
                    // Önizlemedeki nota geçerliyse, gerçek notayı oluştur.
                    if (Tone.Time(duration).toSeconds() > 0) {
                        createNote({ time, pitch, duration }, commonInteractionProps);
                        setLastUsedDuration(duration); // Bu uzunluğu bir sonraki nota için hatırla
                    }
                }
                break;
        }
        setInteraction(null);
    }, [interaction, handleNotesChange, setLastUsedDuration, gridContainerRef, commonInteractionProps, instrumentId, audioEngineRef]);

    const handleResizeStart = useCallback((note, e) => {
        e.preventDefault();
        e.stopPropagation();
        const startDurationSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
        
        // --- GÖRSEL-İŞİTSEL SENKRONİZASYON (RESIZE) ---
        // Boyutlandırma başladığında notayı çal.
        audioEngineRef.current?.auditionNoteOn(instrumentId, note.pitch);

        const handleResizeMove = (moveEvent) => {
            const dx = moveEvent.clientX - e.clientX;
            const dSteps = dx / stepWidth;
            const newDurationSteps = Math.max(snapSteps, startDurationSteps + dSteps);
            const newDuration = Tone.Time(newDurationSteps * Tone.Time('16n').toSeconds()).toNotation();
            
            // Sadece önizlemeyi güncelle, asıl state'i mouseUp'ta değiştir.
            setInteraction({ type: 'resizing', note, previewNote: { ...note, duration: newDuration } });
        };

        const handleResizeUp = (upEvent) => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeUp);
            
            // Sesi durdur.
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

    // ========================================================================
    // === YENİ VE GÜNCELLENMİŞ FONKSİYONLAR BÖLÜMÜ ===
    // ========================================================================

    /**
     * Fikir 2: Seçilen Notaları Toplu Düzenleme Mantığı
     * Velocity sürüklemesini başlatır. Eğer sürüklenen nota seçiliyse,
     * tüm seçili notaların velocity'sini oransal olarak değiştirir.
     */
    const initiateVelocityDrag = useCallback((note, e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const startY = e.clientY;
        const isNoteSelected = selectedNotes.has(note.id);
        
        // Sürükleme başlangıcındaki tüm seçili notaların orijinal velocity değerlerini sakla.
        const startVelocities = new Map();
        if (isNoteSelected) {
            const currentNotes = getNotes();
            currentNotes.forEach(n => {
                if (selectedNotes.has(n.id)) {
                    startVelocities.set(n.id, n.velocity);
                }
            });
        } else {
            // Eğer nota seçili değilse, sadece o notanınkini sakla.
            startVelocities.set(note.id, note.velocity);
        }
        
        const handleVelocityMove = (moveEvent) => {
            const dy = startY - moveEvent.clientY;
            const sensitivity = moveEvent.shiftKey ? 0.002 : 0.008;
            const velocityChange = dy * sensitivity;

            handleNotesChange(prevNotes => 
                prevNotes.map(n => {
                    if (startVelocities.has(n.id)) {
                        const startVelocity = startVelocities.get(n.id);
                        const newVelocity = clamp(startVelocity + velocityChange, 0.01, 1);
                        return { ...n, velocity: newVelocity };
                    }
                    return n;
                })
            );
        };

        const handleVelocityUp = () => {
            window.removeEventListener('mousemove', handleVelocityMove);
            window.removeEventListener('mouseup', handleVelocityUp);
        };

        window.addEventListener('mousemove', handleVelocityMove);
        window.addEventListener('mouseup', handleVelocityUp);
    }, [handleNotesChange, selectedNotes, getNotes]);
    
    // ========================================================================
    // === YENİ FONKSİYON: Seçim Mantığı ve Sürüklemeyi Birleştiriyor ===
    // ========================================================================

    /**
     * Velocity çubuğuna tıklandığında çalışır.
     * 1. Shift tuşu durumuna göre nota seçimini günceller.
     * 2. Velocity değerini değiştirmek için sürükleme işlemini başlatır.
     */
    const handleVelocityBarMouseDown = useCallback((note, e) => {
        // Eğer Shift tuşuna basılıyorsa, notayı mevcut seçime ekle/çıkar (çoklu seçim)
        if (e.shiftKey) {
            setSelectedNotes(prevSelected => {
                const newSelection = new Set(prevSelected);
                if (newSelection.has(note.id)) {
                    newSelection.delete(note.id);
                } else {
                    newSelection.add(note.id);
                }
                return newSelection;
            });
        } 
        // Eğer Shift tuşuna basılı değilse, sadece tıklanan notayı seç
        else if (!selectedNotes.has(note.id)) {
            setSelectedNotes(new Set([note.id]));
        }

        // Seçim güncellendikten sonra, sürükleme işlemini başlat.
        initiateVelocityDrag(note, e);

    }, [selectedNotes, setSelectedNotes, initiateVelocityDrag]);
    
    /**
     * Fikir 1: Scroll ile Değer Değiştirme
     * Bir velocity çubuğu üzerinde fare tekerleği döndürüldüğünde çalışır.
     */
    const handleVelocityWheel = useCallback((note, e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const changeAmount = -e.deltaY * 0.001; // hassasiyet ayarı
        handleNotesChange(prev =>
            prev.map(n => 
                n.id === note.id 
                ? { ...n, velocity: clamp(n.velocity + changeAmount, 0.01, 1) } 
                : n
            )
        );
    }, [handleNotesChange]);

    useEffect(() => {
        const upHandler = (e) => handleMouseUp(e);
        const gridEl = gridContainerRef.current;
        const handleMouseLeave = (e) => {
            if (interaction) {
                handleMouseUp(e);
            }
        }
        window.addEventListener('mouseup', upHandler);
        gridEl?.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            window.removeEventListener('mouseup', upHandler);
            gridEl?.removeEventListener('mouseleave', handleMouseLeave);
        }
    }, [handleMouseUp, interaction]);

    return { 
        interactionProps: { onMouseDown: handleMouseDown, onMouseMove: handleMouseMove }, 
        selectedNotes, 
        interaction,
        handleVelocityBarMouseDown, handleVelocityWheel,
        handleResizeStart,
        setSelectedNotes
    };
};