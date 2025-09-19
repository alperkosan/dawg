import React, { useEffect, useState, memo } from 'react';
import { useMixerStore } from '../../store/useMixerStore';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalFader } from '../../ui/plugin_system/PluginControls';
import VolumeKnob from '../../ui/VolumeKnob';
import { VolumeX } from 'lucide-react';

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
    <div className="w-full h-20 bg-black/50 rounded-sm relative overflow-hidden border border-black/50">
      <div className="absolute bottom-0 left-0 right-0 transition-[height] duration-75" style={{ 
        height: `${levelPercent}%`, 
        background: `linear-gradient(to top, ${peak ? '#ef4444' : '#22c55e'}, ${peak ? '#f87171' : '#4ade80'})` 
      }} />
      <div className="absolute top-1 right-1 text-[9px] font-mono text-white/50">{level > -59 ? level.toFixed(0) : '-inf'}</div>
    </div>
  );
});

const MixerChannel = memo(({ trackId, onContextMenu }) => {
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === trackId));
  const { soloedChannels, mutedChannels, activeChannelId, handleMixerParamChange, toggleSolo, toggleMute, setActiveChannelId } = useMixerStore();

  if (!track) return null;

  const isSolo = soloedChannels.has(trackId);
  const isMuted = mutedChannels.has(trackId);
  const isMaster = track.type === 'master';
  const isBus = track.type === 'bus';
  const hasSolo = soloedChannels.size > 0;
  const isDimmed = hasSolo && !isSolo && !isBus && !isMaster;
  const isActive = activeChannelId === trackId;

  const channelClasses = `mixer-channel ${isActive ? 'mixer-channel--active' : ''} ${isDimmed ? 'mixer-channel--dimmed' : ''}`;
  const channelStyle = { '--track-color': track.color || (isMaster ? 'var(--color-primary)' : isBus ? '#22c55e' : 'var(--color-border)') };

  return (
    <div
      className={channelClasses}
      style={channelStyle}
      onClick={() => setActiveChannelId(trackId)}
      onContextMenu={(e) => onContextMenu(e, track)}
    >
      <div className="mixer-channel__color-strip" />
      <div className="mixer-channel__fader-area">
        {!isMaster && (
            <VolumeKnob 
              label="Pan" 
              value={track.pan} 
              onChange={(val) => handleMixerParamChange(trackId, 'pan', val)} 
              min={-1} max={1} 
              size={36}
              defaultValue={0} 
            />
        )}
        <LevelMeter trackId={trackId} />
        <ProfessionalFader 
            value={track.volume} 
            onChange={(val) => handleMixerParamChange(trackId, 'volume', val)} 
            min={-60} max={6} height={'100%'}
            isActive={isActive}
        />
      </div>
      
      {!isMaster && (
        <div className="mixer-channel__controls">
            <button 
                onClick={(e) => { e.stopPropagation(); toggleSolo(trackId); }} 
                className={`mixer-channel__control-button ${isSolo ? 'mixer-channel__control-button--solo-active' : ''}`}
            >S</button>
            <button 
                onClick={(e) => { e.stopPropagation(); toggleMute(trackId); }} 
                className={`mixer-channel__control-button ${isMuted ? 'mixer-channel__control-button--mute-active' : ''}`}
            >
                <VolumeX size={14} />
            </button>
        </div>
      )}
      <div className="mixer-channel__name">{track.name}</div>
    </div>
  );
});

export default MixerChannel;
