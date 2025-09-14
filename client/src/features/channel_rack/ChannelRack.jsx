import React, { useState, useEffect, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { Music, PlusSquare, Plus, ChevronLeft, ChevronRight, Edit, Volume2 } from 'lucide-react';

import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { PlaybackAnimatorService } from '../../lib/core/PlaybackAnimatorService';
import { useArrangementStore } from '../../store/useArrangementStore';
import VolumeKnob from '../../ui/VolumeKnob';
import { usePlaybackStore } from '../../store/usePlaybackStore';

const ItemTypes = { SOUND_SOURCE: 'soundSource' };

// ModernStepButton bileşeninde değişiklik yok
const ModernStepButton = React.memo(({ note, isMuted, isBeat, onStepClick, isCurrentlyPlaying }) => {
    const isActive = !!note;
    const velocityHeight = isActive ? `${Math.max(10, note.velocity * 100)}%` : '0%';
    const playingStyle = {
        boxShadow: `inset 0 0 10px 3px rgba(14, 165, 233, 0.4)`,
        borderColor: 'var(--color-primary)'
    };
    const style = {
        backgroundColor: isBeat ? 'var(--color-surface)' : 'var(--color-background)',
        border: `1px solid ${isCurrentlyPlaying ? 'var(--color-primary)' : 'var(--color-border)'}`,
        opacity: isMuted ? 0.4 : 1,
        transition: 'all 150ms ease',
        ...(isCurrentlyPlaying && playingStyle)
    };
    return (
        <div onClick={onStepClick} className="w-9 h-12 rounded-md cursor-pointer relative overflow-hidden" style={style}>
            {isActive && <div className="absolute bottom-0 left-0 right-0 rounded-t-sm" style={{ height: velocityHeight, backgroundColor: 'var(--color-primary)', opacity: 0.75 }} />}
        </div>
    );
});

// ModernInstrumentChannel bileşeninde değişiklik yok
const ModernInstrumentChannel = React.memo(({ instrument, audioEngineRef, notes, activeStep, playbackMode }) => {
    const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));
    const { updatePatternNotes } = useArrangementStore.getState();
    const { handleToggleInstrumentMute } = useInstrumentsStore.getState();
    const { handleMixerParamChange } = useMixerStore.getState();
    const { handleEditInstrument, handleTogglePianoRoll } = usePanelsStore.getState();

    const handlePatternChange = (stepIndex) => {
        const currentNotes = notes || [];
        const noteIndex = currentNotes.findIndex(note => note.time === stepIndex);
        let newNotes;
        if (noteIndex > -1) {
            newNotes = currentNotes.filter((_, i) => i !== noteIndex);
        } else {
            const newNote = { id: `note_${stepIndex}_${Math.random()}`, time: stepIndex, pitch: 'C4', velocity: 0.75, duration: '16n' };
            newNotes = [...currentNotes, newNote].sort((a,b) => a.time - b.time);
        }
        updatePatternNotes(instrument.id, newNotes);
    };
    
    if (!instrument || !track) return null;

    return (
        <div className="flex items-center" style={{ gap: 'var(--gap-controls)' }}>
            <div className="sticky left-0 w-[300px] h-14 p-2 flex items-center gap-3 z-20 shrink-0 bg-[var(--color-surface)] rounded-lg border border-transparent hover:border-[var(--color-border)] transition-colors">
                 <div className="w-1 h-full rounded-full" style={{backgroundColor: 'var(--color-primary)'}} />
                 <div className="flex-grow flex items-center gap-2 min-w-0 cursor-pointer group" onClick={() => handleEditInstrument(instrument, audioEngineRef.current)} title={`${instrument.name} (Edit Sample)`}>
                    <button onClick={(e) => { e.stopPropagation(); handleTogglePianoRoll(instrument); }} className="p-1 group-hover:bg-[var(--color-background)] rounded transition-colors shrink-0" title="Toggle Piano Roll">
                        <Music size={16} style={{ color: instrument.pianoRoll ? 'var(--color-accent)' : 'var(--color-primary)' }} />
                    </button>
                    <span className="truncate font-bold text-sm group-hover:text-[var(--color-primary)]">{instrument.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => handleToggleInstrumentMute(instrument.id)} className={`w-6 h-6 rounded text-xs font-bold transition-colors ${!instrument.isMuted ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`} title="Mute">M</button>
                    <VolumeKnob size={24} label="Pan" value={track.pan} onChange={(val) => handleMixerParamChange(track.id, 'pan', val, audioEngineRef.current)} min={-1} max={1} defaultValue={0} />
                    <VolumeKnob size={24} label="Vol" value={track.volume} onChange={(val) => handleMixerParamChange(track.id, 'volume', val, audioEngineRef.current)} min={-60} max={6} defaultValue={0} />
                </div>
            </div>
            <div className="flex h-full items-center" style={{ gap: 'var(--gap-container)' }}>
                {Array.from({ length: Math.ceil(useInstrumentsStore.getState().loopLength / 4) }).map((_, barIndex) => (
                    <div key={barIndex} className="flex items-center" style={{ gap: '4px' }}>
                        {Array.from({ length: 4 }).map((_, stepInBar) => {
                            const stepIndex = barIndex * 4 + stepInBar;
                            const note = notes?.find(n => n.time === stepIndex);
                            return (
                                <ModernStepButton
                                    key={stepIndex}
                                    note={note}
                                    onStepClick={() => handlePatternChange(stepIndex)}
                                    isMuted={instrument.isMuted}
                                    isBeat={stepInBar === 0}
                                    isCurrentlyPlaying={playbackMode === 'pattern' && stepIndex === activeStep}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
});

function ChannelRack({ audioEngineRef }) {
    // NİHAİ DÜZELTME: Hem görsel hem de ses uzunluğunu alıyoruz
    const instruments = useInstrumentsStore(state => state.instruments);
    const loopLength = useInstrumentsStore(state => state.loopLength);
    const audioLoopLength = useInstrumentsStore(state => state.audioLoopLength);
    
    const { handleAddNewInstrument } = useInstrumentsStore.getState();
    const { patterns, activePatternId, addPattern, renameActivePattern, nextPattern, previousPattern } = useArrangementStore();
    const activePatternData = patterns[activePatternId]?.data || {};
    const activePatternName = patterns[activePatternId]?.name || '...';
    const playbackMode = usePlaybackStore(state => state.playbackMode);
    
    const [activeStep, setActiveStep] = useState(-1);

    useEffect(() => {
        const handleProgressUpdate = (progress) => {
            // NİHAİ DÜZELTME: Adım hesaplaması artık GERÇEK ses uzunluğuna göre yapılıyor.
            const currentStep = Math.floor(progress * audioLoopLength);
            setActiveStep(prevStep => currentStep !== prevStep ? currentStep : prevStep);
        };
        PlaybackAnimatorService.subscribe(handleProgressUpdate);
        return () => { PlaybackAnimatorService.unsubscribe(handleProgressUpdate); };
    }, [audioLoopLength]); // Bağımlılığı audioLoopLength olarak değiştiriyoruz.

    const handleRename = () => {
        const newName = prompt("Yeni pattern adı:", activePatternName);
        if (newName) { renameActivePattern(newName); }
    };
    
    const [{ isOver }, drop] = useDrop(() => ({ accept: ItemTypes.SOUND_SOURCE, drop: (item) => handleAddNewInstrument(item), collect: (m) => ({ isOver: !!m.isOver() }) }), []);

    return (
        <div className="w-full h-full flex flex-col" style={{ backgroundColor: 'var(--color-surface)', gap: 'var(--gap-container)' }}>
            <div className="flex items-center gap-2 p-2 shrink-0" style={{backgroundColor: 'var(--color-background)'}}>
                <button onClick={() => addPattern(audioEngineRef.current)} className="p-2 hover:bg-[var(--color-surface)] rounded transition-colors" title="Yeni Pattern Ekle"><Plus size={18} /></button>
                <div className="flex items-center border rounded-md" style={{borderColor: 'var(--color-border)'}}>
                    <button onClick={() => previousPattern(audioEngineRef.current)} className="p-2 hover:bg-[var(--color-surface)] rounded-l-md transition-colors" title="Önceki Pattern"><ChevronLeft size={16} /></button>
                    <div className="flex-grow text-center px-4 py-1.5 bg-[var(--color-surface2)] text-sm font-bold"><span>{activePatternName}</span></div>
                    <button onClick={() => nextPattern(audioEngineRef.current)} className="p-2 hover:bg-[var(--color-surface)] rounded-r-md transition-colors" title="Sonraki Pattern"><ChevronRight size={16} /></button>
                </div>
                <button onClick={handleRename} className="p-2 hover:bg-[var(--color-surface)] rounded transition-colors" title="Pattern'i Yeniden Adlandır"><Edit size={16} /></button>
            </div>
            <div className="flex-grow min-h-0 overflow-auto relative" style={{ padding: '0 var(--padding-container) var(--padding-container)' }}>
                <div style={{ width: 300 + (loopLength * 40), height: '100%' }} className="relative">
                    <div className="flex flex-col" style={{ gap: 'var(--gap-controls)' }}>
                        {instruments.map((inst) => (
                             <ModernInstrumentChannel 
                                key={inst.id} 
                                instrument={inst}
                                audioEngineRef={audioEngineRef}
                                notes={activePatternData[inst.id]}
                                activeStep={activeStep}
                                playbackMode={playbackMode}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div ref={drop} className="shrink-0 h-16 border-2 border-dashed rounded-lg flex items-center justify-center m-4 mt-0 transition-colors" style={{ borderColor: isOver ? 'var(--color-primary)' : 'var(--color-border)' }}>
                <div className="flex items-center gap-2" style={{color: 'var(--color-muted)'}}><PlusSquare size={20} /><span className="font-bold">Yeni Enstrüman Eklemek İçin Sürükleyin</span></div>
            </div>
        </div>
    );
}

export default ChannelRack;