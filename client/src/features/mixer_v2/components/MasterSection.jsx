import React from 'react';
import { useMixerStore } from '../../../store/useMixerStore';
import { FaderV2 } from './FaderV2';
import { LevelMeterV2 } from './LevelMeterV2';
import { SlidersHorizontal } from 'lucide-react';

export const MasterSection = ({ trackId }) => {
    // Sadece master track'in kendisine abone oluyoruz
    const track = useMixerStore(state => state.mixerTracks.find(t => t.id === trackId));
    const { handleMixerParamChange, setActiveChannelId } = useMixerStore.getState();

    if (!track) return null;

    return (
        <div className="master-section" onClick={() => setActiveChannelId(trackId)}>
            <div className="channel-header">
                <SlidersHorizontal size={14} />
                <div className="channel-name">Master</div>
            </div>
            <div className="channel-body">
                <div className="main-controls">
                    <LevelMeterV2 trackId={trackId} />
                    <FaderV2
                        value={track.volume}
                        onChange={(val) => handleMixerParamChange(trackId, 'volume', val)}
                    />
                </div>
            </div>
            <div className="channel-footer"></div>
        </div>
    );
};