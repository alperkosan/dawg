import React, { useState } from 'react';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import { Music, Volume2, Mic, SlidersHorizontal } from 'lucide-react';
import { Knob } from '@/components/controls';
import EffectSwitch from '@/components/controls/base/EffectSwitch';

/**
 * Tek bir kanalın başlığını (header) render eden alt bileşen.
 * Gerekli tüm bilgileri farklı store'lardan toplayarak işlevsellik sağlar.
 */
const TrackHeader = ({ arrangementTrack, audioEngineRef }) => {
    // 1. Gerekli verileri ilgili store'lardan çekiyoruz
    const instrument = useInstrumentsStore(state => state.instruments.find(i => i.id === arrangementTrack.instrumentId));
    const mixerTrack = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));

    const { handleToggleInstrumentMute } = useInstrumentsStore.getState();
    const { handleMixerParamChange, setTrackName } = useMixerStore.getState();
    const openMixer = usePanelsStore(state => state.togglePanel);

    // 2. İsim düzenleme için lokal state
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(arrangementTrack.name);

    if (!instrument || !mixerTrack) {
        return <div className="h-full p-2 border-b border-gray-950/50 text-red-500">Kanal verisi eksik</div>;
    }
    
    const handleNameChange = (e) => {
        if (e.key === 'Enter') {
            setTrackName(mixerTrack.id, name);
            // Arrangement store'daki ismi de güncelleyebiliriz (opsiyonel)
            setIsEditing(false);
        }
    };

    return (
        <div 
            className="flex items-center p-2 border-b border-gray-950/50 bg-[var(--color-surface)] hover:bg-[var(--color-surface2)] transition-colors"
            style={{ height: arrangementTrack.height }}
        >
            <div className="flex flex-col items-center justify-center gap-2 w-16 shrink-0">
                <Music size={18} className="text-cyan-400" />
                <button 
                    onClick={() => { openMixer('mixer'); /* İleri seviye: İlgili kanalı focus'la */ }}
                    className="p-1 rounded-md hover:bg-[var(--color-background)]"
                    title="Mikserde Göster"
                >
                    <SlidersHorizontal size={14} />
                </button>
            </div>

            <div className="flex-grow flex flex-col justify-center min-w-0">
                {isEditing ? (
                    <input 
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleNameChange}
                        onBlur={() => setIsEditing(false)}
                        autoFocus
                        className="bg-black/50 text-white font-bold text-sm p-1 rounded-md w-full"
                    />
                ) : (
                    <span 
                        className="font-bold text-sm truncate cursor-pointer"
                        onDoubleClick={() => setIsEditing(true)}
                    >
                        {name}
                    </span>
                )}
                
                <div className="text-xs text-[var(--color-muted)]">
                    {`-> ${mixerTrack.id}`}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <EffectSwitch isActive={!instrument.isMuted} onClick={() => handleToggleInstrumentMute(instrument.id)} />
                <Knob size={24} label="Pan" value={mixerTrack.pan} onChange={(val) => handleMixerParamChange(mixerTrack.id, 'pan', val, audioEngineRef.current)} min={-1} max={1} defaultValue={0} />
                <Knob size={24} label="Vol" value={mixerTrack.volume} onChange={(val) => handleMixerParamChange(mixerTrack.id, 'volume', val, audioEngineRef.current)} min={-60} max={6} defaultValue={0} />
            </div>
        </div>
    );
};


/**
 * Tüm kanal başlıklarını listeleyen ana bileşen.
 */
export function TrackList({ audioEngineRef }) {
    const tracks = useArrangementStore(state => state.tracks);

    return (
        <div className="w-96 bg-[var(--color-background)] shrink-0 border-r border-gray-950/50 h-full overflow-y-auto">
            {tracks.map(track => (
                <TrackHeader 
                    key={track.id} 
                    arrangementTrack={track}
                    audioEngineRef={audioEngineRef}
                />
            ))}
        </div>
    );
}