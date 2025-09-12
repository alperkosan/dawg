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

const StepButton = React.memo(function StepButton({ instrumentId, stepIndex, isActive, isMuted, isPlaceholder, isBeat, isBarStart, onStepClick }) {
    const bgClass = isActive ? 'bg-cyan-500 hover:bg-cyan-400' : isPlaceholder ? 'bg-gray-700/20 hover:bg-gray-600/50' : isBarStart ? 'bg-gray-600 hover:bg-gray-500' : isBeat ? 'bg-gray-700/70 hover:bg-gray-600' : 'bg-gray-800/60 hover:bg-gray-700';
    return (<button onClick={() => onStepClick(instrumentId, stepIndex)} className={`h-full w-9 rounded transition-colors shrink-0 ${bgClass} ${isMuted ? 'opacity-50' : ''}`} aria-label={`Step ${stepIndex + 1}`} />);
});

const InstrumentChannel = React.memo(function InstrumentChannel({ instrumentId, onContextMenu, audioEngineRef }) {
    const instrument = useInstrumentsStore(state => state.instruments.find(i => i.id === instrumentId));
    const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));

    // --- GÜNCELLENDİ: Gerekli tüm eylemleri doğrudan ilgili store'lardan alıyoruz ---
    const { handleToggleInstrumentMute, handlePatternChange, handleSetPianoRollMode } = useInstrumentsStore.getState();
    const { handleMixerParamChange } = useMixerStore.getState();
    const { handleEditInstrument, handleTogglePianoRoll } = usePanelsStore.getState();

    const loopLength = useInstrumentsStore(state => state.loopLength);
    const audioLoopLength = useInstrumentsStore(state => state.audioLoopLength);
    
    if (!instrument || !track) return null;

    const onEdit = () => handleEditInstrument(instrument, audioEngineRef.current);

    /**
     * --- GÜNCELLENDİ: Burası artık bir "koordinatör" ---
     * Bu fonksiyon, hem enstrümanın modunu değiştirmek için useInstrumentsStore'u,
     * hem de paneli açmak/kapatmak için usePanelsStore'u çağırır.
     * Bu, veri akışını netleştirir ve store'ların birbirine olan bağımlılığını ortadan kaldırır.
     */
    const onTogglePianoRoll = () => {
        const isOpening = usePanelsStore.getState().pianoRollInstrumentId !== instrument.id;
        handleSetPianoRollMode(instrument.id, isOpening); // 1. Enstrüman state'ini güncelle
        handleTogglePianoRoll(instrument);              // 2. Panel state'ini güncelle
    };

    return (
        <div className="flex items-center h-14 gap-1">
            <div className="sticky left-0 w-[300px] h-full bg-gray-900 rounded p-2 flex items-center gap-2 text-sm text-gray-300 z-20 shrink-0" onContextMenu={(e) => onContextMenu(e, instrument)}>
                <EffectSwitch isActive={!instrument.isMuted} onClick={() => handleToggleInstrumentMute(instrument.id)} />
                <div className="flex-grow flex items-center gap-2 min-w-0 cursor-pointer group" onClick={onEdit} title={`${instrument.name} (Düzenle)`}>
                    <button onClick={(e) => { e.stopPropagation(); onTogglePianoRoll(); }} className="p-1 group-hover:bg-gray-700 rounded transition-colors shrink-0" title="Piano Roll'ü Aç/Kapat">
                        <Music size={16} className={instrument.pianoRoll ? "text-amber-400" : "text-cyan-400"} />
                    </button>
                    <span className="truncate font-bold group-hover:text-cyan-400">{instrument.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <VolumeKnob label="Pan" value={track.pan} onChange={(val) => handleMixerParamChange(track.id, 'pan', val, audioEngineRef.current)} min={-1} max={1} defaultValue={0} />
                    <VolumeKnob label="Vol" value={track.volume} onChange={(val) => handleMixerParamChange(track.id, 'volume', val, audioEngineRef.current)} min={-60} max={6} defaultValue={0} />
                </div>
            </div>
            <div className="flex gap-1 h-full">
                {Array.from({ length: loopLength }).map((_, stepIndex) => (
                    <StepButton key={stepIndex} instrumentId={instrument.id} stepIndex={stepIndex} isActive={instrument.notes?.some(note => note.time === stepIndex)} isMuted={instrument.isMuted} isPlaceholder={stepIndex >= audioLoopLength} isBeat={stepIndex % 4 === 0} isBarStart={stepIndex % 16 === 0} onStepClick={handlePatternChange} />
                ))}
            </div>
        </div>
    );
});

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
    usePlaybackAnimator(playheadRef, { fullWidth: totalGridWidth, offset: leftPanelWidth });
    return (
        <div className="w-full h-full flex flex-col bg-gray-800 text-white p-4 gap-4">
            <div className="flex-grow min-h-0 overflow-auto relative">
                <div style={{ width: leftPanelWidth + totalGridWidth, height: '100%' }} className="relative">
                    <div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-30 pointer-events-none" />
                    <div className="flex flex-col gap-y-1">
                        {instrumentIds.map((id) => (
                            <InstrumentChannel key={id} instrumentId={id} onContextMenu={handleContextMenu} audioEngineRef={audioEngineRef} />
                        ))}
                    </div>
                </div>
            </div>
            <div ref={drop} className={`shrink-0 h-16 border-2 border-dashed rounded-lg flex items-center justify-center transition-all duration-200 ${isOver && canDrop ? 'border-cyan-400 bg-cyan-900/50 text-cyan-300' : 'border-gray-600 text-gray-500'}`}>
                <div className="flex items-center gap-2"><PlusSquare size={20} /> <span className="font-bold">Yeni Enstrüman Eklemek İçin Sürükleyin</span></div>
            </div>
            {contextMenu && (<ChannelContextMenu x={contextMenu.x} y={contextMenu.y} options={getContextMenuOptions()} onClose={handleCloseContextMenu} />)}
        </div>
    );
}

export default ChannelRack;
