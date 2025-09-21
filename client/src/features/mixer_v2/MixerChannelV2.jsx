import React from 'react';
import { useMixerStore } from '../../store/useMixerStore';
import { FaderV2 } from './components/FaderV2';
import { LevelMeterV2 } from './components/LevelMeterV2';
import { EQControlsV2 } from './components/EQControlsV2';
import { SendsPanelV2 } from './components/SendsPanelV2';
import { InsertPanelV2 } from './components/InsertPanelV2';
import { ChevronsUpDown, Waves, Power, CornerUpLeft } from 'lucide-react';

export const MixerChannelV2 = ({ trackId }) => {
    // === NIHAI VE DOĞRU YÖNTEM ===
    // 1. Sadece ilgili kanalın verisine abone oluyoruz.
    // Zustand, bu obje değişmediği sürece bileşeni yeniden render etmez.
    const track = useMixerStore(state => state.mixerTracks.find(t => t.id === trackId));

    // 2. Diğer tüm dinamik verileri ayrı ayrı seçiyoruz.
    // Her biri kendi bağımsız aboneliğini oluşturur.
    const isActive = useMixerStore(state => state.activeChannelId === trackId);
    const isExpanded = useMixerStore(state => state.mixerUIState.expandedChannels.has(trackId));
    const isEQVisible = useMixerStore(state => state.mixerUIState.visibleEQs.has(trackId));
    const areSendsVisible = useMixerStore(state => state.mixerUIState.visibleSends.has(trackId));

    // 3. Fonksiyonları `getState` ile alıyoruz çünkü bunlar değişmez ve render tetiklemez.
    const {
        setActiveChannelId,
        toggleChannelExpansion,
        toggleChannelEQ,
        toggleChannelSends,
        handleMixerParamChange,
    } = useMixerStore.getState();

    if (!track) return null;

    const channelClasses = `mixer-channelv2 ${isActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`;
    const channelStyle = { '--track-color': track.color || '#4b5563' };

    return (
        <div className={channelClasses} style={channelStyle} onClick={() => setActiveChannelId(trackId)}>
            <div className="channel-header">
                <button className="expand-button" onClick={(e) => { e.stopPropagation(); toggleChannelExpansion(trackId); }}>
                    <ChevronsUpDown size={14} />
                </button>
                <div className="channel-name">{track.name}</div>
            </div>
            
            <div className="channel-body">
                <div className="main-controls">
                    <LevelMeterV2 trackId={trackId} />
                    <FaderV2
                        value={track.volume}
                        onChange={(val) => handleMixerParamChange(trackId, 'volume', val)}
                    />
                </div>
                {isExpanded && (
                    <div className="expanded-controls">
                        {isEQVisible && <EQControlsV2 trackId={trackId} />}
                        {areSendsVisible && <SendsPanelV2 trackId={trackId} />}
                        <InsertPanelV2 trackId={trackId} />
                    </div>
                )}
            </div>

            <div className="channel-footer">
                <div className="utility-buttons">
                    <button onClick={(e) => { e.stopPropagation(); toggleChannelEQ(trackId); }} className={isEQVisible ? 'active' : ''}><Waves size={14}/></button>
                    <button onClick={(e) => { e.stopPropagation(); toggleChannelSends(trackId); }} className={areSendsVisible ? 'active' : ''}><CornerUpLeft size={14}/></button>
                    <button><Power size={14}/></button>
                </div>
            </div>
        </div>
    );
};