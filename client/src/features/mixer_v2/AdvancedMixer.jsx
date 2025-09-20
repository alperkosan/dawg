import React, { useMemo } from 'react';
import { useMixerStore } from '../../store/useMixerStore';
import { MixerChannelV2 } from './MixerChannelV2';
import { MasterSection } from './components/MasterSection';
import './MixerV2.css';

// 'export' kelimesini buradan kaldırdık
const AdvancedMixerComponent = () => {
    const mixerTracks = useMixerStore(state => state.mixerTracks);

    const { trackChannels, busChannels, masterTrack } = useMemo(() => {
        const tracks = mixerTracks || [];
        return {
            trackChannels: tracks.filter(t => t.type === 'track'),
            busChannels: tracks.filter(t => t.type === 'bus'),
            masterTrack: tracks.find(t => t.type === 'master'),
        };
    }, [mixerTracks]);

    if (!masterTrack) {
        return <div className="advanced-mixer-error">Master track not found!</div>;
    }

    return (
        <div className="advanced-mixer">
            <div className="mixer-channels-container">
                {trackChannels.map(track => (
                    <MixerChannelV2 key={track.id} trackId={track.id} />
                ))}
                
                {busChannels.length > 0 && <div className="mixer-separator" />}

                {busChannels.map(track => (
                    <MixerChannelV2 key={track.id} trackId={track.id} />
                ))}

                <div className="mixer-separator" />

                <MasterSection trackId={masterTrack.id} />
            </div>
        </div>
    );
};

// Bileşeni burada varsayılan olarak export ediyoruz
export const AdvancedMixer = AdvancedMixerComponent;