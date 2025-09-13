import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { Music, PlusSquare, Trash2, Copy, Edit, Scissors } from 'lucide-react';

import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { usePlaybackAnimator } from '../../hooks/usePlaybackAnimator';
import VolumeKnob from '../../ui/VolumeKnob';
import EffectSwitch from '../../ui/EffectSwitch';
import ChannelContextMenu from '../../components/ChannelContextMenu';

const ItemTypes = { SOUND_SOURCE: 'soundSource' };

// StepButton artık tıklanabilir ve temadan besleniyor
const StepButton = React.memo(function StepButton({ instrumentId, stepIndex, isActive, isMuted, isBeat, isBarStart, onStepClick }) {
    const handleClick = () => {
        onStepClick(instrumentId, stepIndex);
    };

    const style = {
        height: '100%',
        width: '36px',
        borderRadius: 'var(--border-radius)',
        transition: 'background-color 150ms, opacity 150ms',
        backgroundColor: isActive 
            ? 'var(--color-primary)' 
            : isBarStart 
            ? 'var(--color-surface2)' 
            : isBeat 
            ? 'var(--color-surface)' 
            : 'var(--color-background)',
        border: `1px solid var(--color-border)`,
        opacity: isMuted ? 0.5 : 1,
    };

    return <button onClick={handleClick} style={style} aria-label={`Step ${stepIndex + 1}`} />;
});

// InstrumentChannel artık tüm orijinal fonksiyonelliği ve dinamik stilleri içeriyor
const InstrumentChannel = React.memo(function InstrumentChannel({ instrumentId, onContextMenu, audioEngineRef }) {
    const instrument = useInstrumentsStore(state => state.instruments.find(i => i.id === instrumentId));
    const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));
    
    const { handleToggleInstrumentMute, handlePatternChange, handleSetPianoRollMode } = useInstrumentsStore.getState();
    const { handleMixerParamChange } = useMixerStore.getState();
    const { handleEditInstrument, handleTogglePianoRoll } = usePanelsStore.getState();

    const loopLength = useInstrumentsStore(state => state.loopLength);
    
    if (!instrument || !track) return null;

    const onEdit = () => handleEditInstrument(instrument, audioEngineRef.current);
    const onTogglePianoRoll = () => {
        const isOpening = usePanelsStore.getState().pianoRollInstrumentId !== instrument.id;
        handleSetPianoRollMode(instrument.id, isOpening);
        handleTogglePianoRoll(instrument);
    };

    return (
        <div className="flex items-center h-14" style={{ gap: 'var(--gap-controls)' }}>
            <div 
                className="sticky left-0 w-[300px] h-full p-2 flex items-center z-20 shrink-0" 
                style={{ 
                    backgroundColor: 'var(--color-background)',
                    borderRadius: 'var(--border-radius)',
                    gap: 'var(--gap-controls)',
                    fontSize: 'var(--font-size-body)'
                }}
                onContextMenu={(e) => onContextMenu(e, instrument)}
            >
                <EffectSwitch isActive={!instrument.isMuted} onClick={() => handleToggleInstrumentMute(instrument.id)} />
                <div className="flex-grow flex items-center gap-2 min-w-0 cursor-pointer group" onClick={onEdit} title={`${instrument.name} (Düzenle)`}>
                    <button onClick={(e) => { e.stopPropagation(); onTogglePianoRoll(); }} className="p-1 group-hover:bg-[var(--color-surface)] rounded transition-colors shrink-0" title="Piano Roll'ü Aç/Kapat">
                        <Music size={16} style={{ color: instrument.pianoRoll ? 'var(--color-accent)' : 'var(--color-primary)' }} />
                    </button>
                    <span className="truncate font-bold group-hover:text-[var(--color-primary)]">{instrument.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <VolumeKnob label="Pan" value={track.pan} onChange={(val) => handleMixerParamChange(track.id, 'pan', val, audioEngineRef.current)} min={-1} max={1} defaultValue={0} />
                    <VolumeKnob label="Vol" value={track.volume} onChange={(val) => handleMixerParamChange(track.id, 'volume', val, audioEngineRef.current)} min={-60} max={6} defaultValue={0} />
                </div>
            </div>
            <div className="flex h-full" style={{ gap: '4px' }}> {/* Step'ler arası boşluk daha az olmalı */}
                {Array.from({ length: loopLength }).map((_, stepIndex) => (
                    <StepButton 
                        key={stepIndex} 
                        instrumentId={instrument.id}
                        stepIndex={stepIndex}
                        onStepClick={handlePatternChange}
                        isActive={instrument.notes?.some(note => note.time === stepIndex)} 
                        isMuted={instrument.isMuted}
                        isBeat={stepIndex % 4 === 0} 
                        isBarStart={stepIndex % 16 === 0}
                    />
                ))}
            </div>
        </div>
    );
});

// Ana ChannelRack bileşeni, tüm orijinal fonksiyonelliği ve dinamik stilleri içeriyor
function ChannelRack({ audioEngineRef }) {
    const instruments = useInstrumentsStore(state => state.instruments);
    const instrumentIds = useMemo(() => instruments.map(i => i.id), [instruments]);
    const loopLength = useInstrumentsStore(state => state.loopLength);
    const { handleAddNewInstrument, handleRenameInstrument, handleCloneInstrument, handleDeleteInstrument, handleToggleInstrumentCutItself } = useInstrumentsStore.getState();
    const [contextMenu, setContextMenu] = useState(null);
    const handleDropAction = (item) => handleAddNewInstrument(item);
    const [{ isOver, canDrop }, drop] = useDrop(() => ({ accept: ItemTypes.SOUND_SOURCE, drop: handleDropAction, collect: (monitor) => ({ isOver: !!monitor.isOver(), canDrop: !!monitor.canDrop() }), }), [handleAddNewInstrument]);
    const handleContextMenu = useCallback((event, instrument) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ x: event.clientX, y: event.clientY, instrument }); }, []);
    const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);
    const getContextMenuOptions = useCallback(() => {
        if (!contextMenu) return [];
        const { instrument } = contextMenu;
        const currentInstrumentState = instruments.find(i => i.id === instrument.id);
        return [
            { label: 'Yeniden Adlandır', icon: Edit, action: () => { const newName = prompt("Yeni ad:", instrument.name); if (newName) handleRenameInstrument(instrument.id, newName); } },
            { label: 'Klonla', icon: Copy, action: () => handleCloneInstrument(instrument.id) },
            { label: 'Sil', icon: Trash2, action: () => handleDeleteInstrument(instrument.id) },
            { label: 'Cut Itself', icon: Scissors, action: () => handleToggleInstrumentCutItself(instrument.id), isActive: currentInstrumentState?.cutItself },
        ];
    }, [contextMenu, instruments, handleRenameInstrument, handleCloneInstrument, handleDeleteInstrument, handleToggleInstrumentCutItself]);
    
    const playheadRef = useRef(null);
    const totalStepWidth = 36;
    const gapWidth = 4;
    const totalGridWidth = loopLength * (totalStepWidth + gapWidth);
    const leftPanelWidth = 300;
    usePlaybackAnimator(playheadRef, { fullWidth: totalGridWidth, offset: leftPanelWidth + 8 }); // 8px padding telafisi

    return (
        <div 
            className="w-full h-full flex flex-col"
            style={{ 
                backgroundColor: 'var(--color-surface)',
                padding: 'var(--padding-container)',
                gap: 'var(--gap-container)'
            }}
        >
            <div className="flex-grow min-h-0 overflow-auto relative">
                <div style={{ width: leftPanelWidth + totalGridWidth, height: '100%' }} className="relative">
                    <div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 z-30 pointer-events-none" style={{ backgroundColor: 'var(--color-accent)'}} />
                    <div className="flex flex-col" style={{ gap: 'var(--gap-controls)' }}>
                        {instrumentIds.map((id) => (
                            <InstrumentChannel key={id} instrumentId={id} onContextMenu={handleContextMenu} audioEngineRef={audioEngineRef} />
                        ))}
                    </div>
                </div>
            </div>
            <div 
                ref={drop} 
                className="shrink-0 h-16 border-2 border-dashed rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                    borderColor: isOver && canDrop ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: isOver && canDrop ? 'rgba(var(--color-primary-rgb), 0.1)' : 'transparent',
                    color: isOver && canDrop ? 'var(--color-primary)' : 'var(--color-muted)',
                    borderRadius: 'var(--border-radius)',
                }}
            >
                <div className="flex items-center gap-2">
                    <PlusSquare size={20} />
                    <span className="font-bold">Yeni Enstrüman Eklemek İçin Sürükleyin</span>
                </div>
            </div>
            {contextMenu && (<ChannelContextMenu x={contextMenu.x} y={contextMenu.y} options={getContextMenuOptions()} onClose={handleCloseContextMenu} />)}
        </div>
    );
}

export default ChannelRack;

