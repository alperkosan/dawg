import React, { useEffect, useState, memo } from 'react';
import { useMixerStore } from '../../store/useMixerStore';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalFader, ProfessionalKnob } from '../../ui/plugin_system/PluginControls';
import { VolumeX } from 'lucide-react';

// Seviye Göstergesi Alt Bileşeni
const LevelMeter = memo(({ trackId }) => {
  const [level, setLevel] = useState(-Infinity);
  useEffect(() => {
    const meterId = `${trackId}-output`;
    const handleLevel = (dbValue) => {
      if (typeof dbValue === 'number' && isFinite(dbValue)) {
        setLevel(dbValue);
      }
    };
    MeteringService.subscribe(meterId, handleLevel);
    return () => MeteringService.unsubscribe(meterId, handleLevel);
  }, [trackId]);

  const levelPercent = level > -60 ? ((level + 60) / 66) * 100 : 0;
  const peak = level > -0.5;

  return (
    <div className="level-meter">
      <div className="level-meter__bar" style={{ height: `${levelPercent}%` }} />
      {peak && <div className="level-meter__peak level-meter__peak--active" />}
      <div className="level-meter__value">{level > -59 ? level.toFixed(0) : '-inf'}</div>
    </div>
  );
});
LevelMeter.displayName = 'LevelMeter';


// Ana Mikser Kanalı Bileşeni
const MixerChannel = memo(({ trackId, onContextMenu }) => {
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === trackId));
  const { 
    soloedChannels, 
    mutedChannels, 
    activeChannelId, 
    handleMixerParamChange, 
    toggleSolo, 
    toggleMute, 
    setActiveChannelId 
  } = useMixerStore();

  if (!track) return null;

  const isSolo = soloedChannels.has(trackId);
  const isMuted = mutedChannels.has(trackId);
  // DÜZELTME: Master kanalı kontrolü daha güvenli hale getirildi.
  const isMaster = track.type === 'master';
  const isBus = track.type === 'bus';
  const hasSolo = soloedChannels.size > 0;
  const isDimmed = hasSolo && !isSolo && !isBus && !isMaster;
  const isActive = activeChannelId === trackId;

  const channelClasses = [
    'mixer-channel',
    isActive && 'mixer-channel--active',
    isDimmed && 'mixer-channel--dimmed',
    isMuted && 'mixer-channel--muted',
    isSolo && 'mixer-channel--solo'
  ].filter(Boolean).join(' ');

  const channelStyle = { '--track-color': track.color || (isMaster ? 'var(--color-primary)' : isBus ? '#22c55e' : 'var(--color-border)') };

  return (
    <div
      className={channelClasses}
      style={channelStyle}
      onClick={() => setActiveChannelId(trackId)}
      onContextMenu={(e) => onContextMenu(e, track)}
    >
      <div className="mixer-channel__color-strip" />
      
      <div className="mixer-channel__header">
          {!isMaster && (
              <ProfessionalKnob 
                label="Pan" 
                value={track.pan} 
                onChange={(val) => handleMixerParamChange(trackId, 'pan', val)} 
                min={-1} max={1} 
                size={36}
                defaultValue={0}
                precision={2}
              />
          )}
      </div>

      <div className="mixer-channel__body">
          <LevelMeter trackId={trackId} />
          <ProfessionalFader 
              value={track.volume} 
              onChange={(val) => handleMixerParamChange(trackId, 'volume', val)} 
              min={-60} max={6}
              isActive={isActive}
          />
      </div>
      
      <div className="mixer-channel__footer">
        {!isMaster && (
          <div className="mixer-channel__controls">
              <button 
                  onClick={(e) => { e.stopPropagation(); toggleSolo(trackId); }} 
                  className={`mixer-channel__control-button ${isSolo ? 'mixer-channel__control-button--solo-active' : ''}`}
                  title="Solo"
              >S</button>
              <button 
                  onClick={(e) => { e.stopPropagation(); toggleMute(trackId); }} 
                  className={`mixer-channel__control-button ${isMuted ? 'mixer-channel__control-button--mute-active' : ''}`}
                  title="Mute"
              >
                  <VolumeX size={14} />
              </button>
          </div>
        )}
        <div className="mixer-channel__name" title={track.name}>{track.name}</div>
      </div>
    </div>
  );
});
MixerChannel.displayName = 'MixerChannel';

export default MixerChannel;

