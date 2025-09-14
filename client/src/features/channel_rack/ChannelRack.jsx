import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { Music, PlusSquare, Plus, ChevronLeft, ChevronRight, Edit } from 'lucide-react';

import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { PlaybackAnimatorService } from '../../lib/core/PlaybackAnimatorService';

import VolumeKnob from '../../ui/VolumeKnob';
import EffectSwitch from '../../ui/EffectSwitch';

const ItemTypes = { SOUND_SOURCE: 'soundSource' };

const StepButton = React.memo(function StepButton({ instrumentId, stepIndex, isActive, isMuted, isBeat, isBarStart, onStepClick, isCurrentlyPlaying }) {
    const handleClick = () => { onStepClick(instrumentId, stepIndex); };

    const playingStyle = {
        boxShadow: `inset 0 0 15px 5px rgba(14, 165, 233, 0.3), 0 0 10px 2px rgba(14, 165, 233, 0.2)`,
        transform: 'scale(1.02)',
    };

    const style = {
        height: '100%', width: '36px', borderRadius: 'var(--border-radius)',
        transition: 'background-color 150ms, opacity 150ms, box-shadow 50ms ease-out, transform 50ms ease-out, border-color 50ms ease-out',
        backgroundColor: isActive 
            ? 'var(--color-primary)' 
            : isBarStart 
            ? 'var(--color-surface2)' 
            : isBeat 
            ? 'var(--color-surface)' 
            : 'var(--color-background)',
        opacity: isMuted ? 0.5 : 1,
        
        // Kısayol 'border' yerine uzun versiyonları kullanıyoruz
        borderWidth: '1px',
        borderStyle: 'solid',
        // borderColor'u duruma göre dinamik olarak değiştiriyoruz
        borderColor: isCurrentlyPlaying ? 'var(--color-primary)' : 'var(--color-border)',
        
        ...(isCurrentlyPlaying && playingStyle)
    };
    return <button onClick={handleClick} style={style} aria-label={`Step ${stepIndex + 1}`} />;
});

const InstrumentChannel = React.memo(function InstrumentChannel({ instrument, onContextMenu, audioEngineRef, notes, activeStep }) {
    const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));
    
    const { updatePatternNotes } = useArrangementStore.getState();
    const { handleToggleInstrumentMute, handleSetPianoRollMode } = useInstrumentsStore.getState();
    const { handleMixerParamChange } = useMixerStore.getState();
    const { handleEditInstrument, handleTogglePianoRoll } = usePanelsStore.getState();

    const loopLength = useInstrumentsStore(state => state.loopLength);
    
    const handlePatternChange = (instrumentId, stepIndex) => {
        const currentNotes = notes || [];
        const noteExists = currentNotes.some(note => note.time === stepIndex);
        let newNotes;
        if (noteExists) {
            newNotes = currentNotes.filter(note => note.time !== stepIndex);
        } else {
            const newNote = { id: `note_${stepIndex}_${Math.random()}`, time: stepIndex, pitch: 'C4', velocity: 1.0, duration: '16n' };
            newNotes = [...currentNotes, newNote];
        }
        updatePatternNotes(instrumentId, newNotes);
    };
    
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
                style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', gap: 'var(--gap-controls)', fontSize: 'var(--font-size-body)'}}
                onContextMenu={(e) => onContextMenu(e, instrument)}
            >
                <EffectSwitch isActive={!instrument.isMuted} onClick={() => handleToggleInstrumentMute(instrument.id)} />
                <div className="flex-grow flex items-center gap-2 min-w-0 cursor-pointer group" onClick={onEdit} title={`${instrument.name} (Edit Sample)`}>
                    <button onClick={(e) => { e.stopPropagation(); onTogglePianoRoll(); }} className="p-1 group-hover:bg-[var(--color-surface)] rounded transition-colors shrink-0" title="Toggle Piano Roll">
                        <Music size={16} style={{ color: instrument.pianoRoll ? 'var(--color-accent)' : 'var(--color-primary)' }} />
                    </button>
                    <span className="truncate font-bold group-hover:text-[var(--color-primary)]">{instrument.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <VolumeKnob label="Pan" value={track.pan} onChange={(val) => handleMixerParamChange(track.id, 'pan', val, audioEngineRef.current)} min={-1} max={1} defaultValue={0} />
                    <VolumeKnob label="Vol" value={track.volume} onChange={(val) => handleMixerParamChange(track.id, 'volume', val, audioEngineRef.current)} min={-60} max={6} defaultValue={0} />
                </div>
            </div>
            <div className="flex h-full" style={{ gap: '4px' }}>
                {Array.from({ length: loopLength }).map((_, stepIndex) => (
                    <StepButton 
                        key={stepIndex} 
                        instrumentId={instrument.id}
                        stepIndex={stepIndex}
                        onStepClick={handlePatternChange}
                        isActive={notes?.some(note => note.time === stepIndex)} 
                        isMuted={instrument.isMuted}
                        isBeat={stepIndex % 4 === 0} 
                        isBarStart={stepIndex % 16 === 0}
                        isCurrentlyPlaying={stepIndex === activeStep}
                    />
                ))}
            </div>
        </div>
    );
});

function ChannelRack({ audioEngineRef }) {
    const instruments = useInstrumentsStore(state => state.instruments);
    const loopLength = useInstrumentsStore(state => state.loopLength);
    // YENİ: Hangi adımın çaldığını tutan state
    const [activeStep, setActiveStep] = useState(-1);

    const { handleAddNewInstrument } = useInstrumentsStore.getState();
    const { patterns, activePatternId, addPattern, renameActivePattern, nextPattern, previousPattern } = useArrangementStore();
    const activePatternData = patterns[activePatternId]?.data || {};
    const activePatternName = patterns[activePatternId]?.name || '...';
    const [{ isOver }, drop] = useDrop(() => ({ accept: ItemTypes.SOUND_SOURCE, drop: (item) => handleAddNewInstrument(item), collect: (m) => ({ isOver: !!m.isOver() }) }), []);

    const handleRename = () => {
        const newName = prompt("Yeni pattern adı:", activePatternName);
        if (newName) { renameActivePattern(newName); }
    };

    useEffect(() => {
        const handleProgressUpdate = (progress) => {
            // Gelen 0-1 arası progress değerini, mevcut loop uzunluğuna göre step index'ine çevir
            const currentStep = Math.floor(progress * loopLength);
            // Sadece step değiştiğinde state'i güncelle (performans için)
            setActiveStep(prevStep => currentStep !== prevStep ? currentStep : prevStep);
        };

        // Servise abone ol
        PlaybackAnimatorService.subscribe(handleProgressUpdate);

        // Component kaldırıldığında abonelikten çık
        return () => {
            PlaybackAnimatorService.unsubscribe(handleProgressUpdate);
        };
    }, [loopLength]); // Sadece loopLength değiştiğinde bu effect yeniden çalışır

    return (
        <div className="w-full h-full flex flex-col" style={{ backgroundColor: 'var(--color-surface)', gap: 'var(--gap-container)' }}>

            <div className="flex items-center gap-2 p-2 shrink-0" style={{backgroundColor: 'var(--color-background)'}}>
                <button onClick={() => addPattern(audioEngineRef.current)} className="p-2 hover:bg-[var(--color-surface)] rounded transition-colors" title="Yeni Pattern Ekle">
                    <Plus size={18} />
                </button>
                <div className="flex items-center border rounded-md" style={{borderColor: 'var(--color-border)'}}>
                    <button onClick={() => previousPattern(audioEngineRef.current)} className="p-2 hover:bg-[var(--color-surface)] rounded-l-md transition-colors" title="Önceki Pattern">
                        <ChevronLeft size={16} />
                    </button>
                    <div className="flex-grow text-center px-4 py-1.5 bg-[var(--color-surface2)] text-sm font-bold">
                        <span>{activePatternName}</span>
                    </div>
                    <button onClick={() => nextPattern(audioEngineRef.current)} className="p-2 hover:bg-[var(--color-surface)] rounded-r-md transition-colors" title="Sonraki Pattern">
                        <ChevronRight size={16} />
                    </button>
                </div>
                <button onClick={handleRename} className="p-2 hover:bg-[var(--color-surface)] rounded transition-colors" title="Pattern'i Yeniden Adlandır">
                    <Edit size={16} />
                </button>
            </div>

            <div className="flex-grow min-h-0 overflow-auto relative" style={{ padding: '0 var(--padding-container) var(--padding-container)' }}>
                <div style={{ width: 300 + (loopLength * 40), height: '100%' }} className="relative">
                    <div className="flex flex-col" style={{ gap: 'var(--gap-controls)' }}>
                        {instruments.map((inst) => (
                            <InstrumentChannel 
                                key={inst.id} 
                                instrument={inst}
                                onContextMenu={() => {}}
                                audioEngineRef={audioEngineRef}
                                notes={activePatternData[inst.id]}
                                activeStep={activeStep}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div ref={drop} className="shrink-0 h-16 border-2 border-dashed rounded-lg flex items-center justify-center m-4 mt-0 transition-colors"
                style={{ borderColor: isOver ? 'var(--color-primary)' : 'var(--color-border)' }}>
                <div className="flex items-center gap-2" style={{color: 'var(--color-muted)'}}>
                    <PlusSquare size={20} />
                    <span className="font-bold">Yeni Enstrüman Eklemek İçin Sürükleyin</span>
                </div>
            </div>
        </div>
    );
}

export default ChannelRack;