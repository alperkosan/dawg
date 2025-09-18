import React, { useEffect, useState } from 'react';
import { useMixerStore } from '../../store/useMixerStore';
import { MeteringService } from '../../lib/core/MeteringService';
import { AudioContextService } from '../../lib/services/AudioContextService';

import { ProfessionalFader, ProfessionalKnob } from '../../ui/plugin_system/PluginControls';
import { VolumeX, Send } from 'lucide-react';

// LevelMeter (Değişiklik yok)
const LevelMeter = React.memo(({ trackId, isActive }) => {
  const [level, setLevel] = useState(-Infinity);
  useEffect(() => {
    const meterId = `${trackId}-output`;
    const handleLevel = (value) => setLevel(Math.max(-60, Math.min(6, value > 0 ? 20 * Math.log10(value) : -Infinity)));
    MeteringService.subscribe(meterId, handleLevel);
    return () => MeteringService.unsubscribe(meterId, handleLevel);
  }, [trackId]);
  const levelPercent = level > -60 ? ((level + 60) / 66) * 100 : 0;
  return (
    <div className={`w-full h-28 bg-black/50 rounded-sm relative overflow-hidden border border-black/50 mb-2 transition-shadow duration-300 ${isActive ? 'shadow-lg shadow-black/50' : ''}`}>
      <div className="absolute top-0 left-0 right-0 bg-gray-700/30" style={{ height: '100%' }}/>
      <div className="absolute bottom-0 left-0 right-0 transition-[height] duration-75" style={{ height: `${levelPercent}%`, background: `linear-gradient(to top, ${level > -0.5 ? '#ef4444' : level > -12 ? '#f59e0b' : '#22c55e'}, ${level > -0.5 ? '#f87171' : level > -12 ? '#fbbf24' : '#4ade80'})` }} />
      <div className="absolute top-1 right-1 text-[9px] font-mono text-white/50">{level > -59 ? level.toFixed(0) : '-inf'}</div>
    </div>
  );
});

// Ana MixerChannel Bileşeni
const MixerChannel = React.memo(({ trackId, onContextMenu }) => {
  // YENİ: Ses motorunu doğrudan merkezi servisten alıyoruz
  const engine = AudioContextService.getAudioEngine();

  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === trackId));
  const { soloedChannels, mutedChannels, activeChannelId } = useMixerStore();
  const { handleMixerParamChange, toggleSolo, toggleMute, setActiveChannelId, updateSendLevel } = useMixerStore.getState();
  const mixerTracks = useMixerStore(state => state.mixerTracks);

  if (!track) return null;

  const isSolo = soloedChannels.has(trackId);
  const isMuted = mutedChannels.has(trackId);
  const isMaster = track.type === 'master';
  const isBus = track.type === 'bus';
  const hasSolo = soloedChannels.size > 0;
  const isDimmed = hasSolo && !isSolo && !isBus && !isMaster;
  const isActive = activeChannelId === trackId;

  const outputTarget = track.output ? mixerTracks.find(t => t.id === track.output)?.name : 'MASTER';

  // YENİ: Kanal rengini temadan ve özel ayardan al
  const trackColor = track.color || (isMaster ? 'var(--color-primary)' : isBus ? '#22c55e' : 'var(--color-muted)');
  
  return (
    <div 
        data-track-id={trackId}
        onClick={() => setActiveChannelId(trackId)}
        onContextMenu={(e) => onContextMenu(e, track)}
        className={`mixer-channel flex flex-col w-20 h-full bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg border-2 p-2 transition-all duration-200 relative z-10
            ${isDimmed ? 'opacity-40 filter grayscale-[50%]' : ''}
            ${isActive ? `shadow-2xl shadow-[${trackColor}]/30` : ''}
        `}
        style={{ borderColor: isActive ? trackColor : 'var(--color-surface)' }}
    >
      <LevelMeter trackId={trackId} isActive={isActive} />
      
      <div className="flex-grow relative">
          <ProfessionalFader 
              value={track.volume} 
              onChange={(val) => handleMixerParamChange(trackId, 'volume', val, engine.current)} 
              min={-60} max={6} height={'100%'}
              isActive={isActive}
              trackColor={trackColor} // Fader'a rengi iletiyoruz
          />
      </div>
      
      {!isMaster && (
          <ProfessionalKnob label="Pan" value={track.pan} onChange={(val) => handleMixerParamChange(trackId, 'pan', val, engine.current)} min={-1} max={1} size={32} className="mt-2" />
      )}
      
      <div className="channel-header text-center p-1.5 mt-2 rounded-md text-xs font-bold truncate select-none cursor-pointer" style={{ backgroundColor: 'var(--color-surface)' }}>
        {track.name}
      </div>

      {!isMaster && (
        <div className="text-center text-[10px] text-gray-500 mt-1 truncate" title={`Output: ${outputTarget}`}>
          → {outputTarget}
        </div>
      )}

      {!isMaster && 
        <div className="flex gap-1 mt-2">
            <button onClick={(e) => { e.stopPropagation(); toggleSolo(trackId, engine.current); }} className={`control-button ${isSolo ? 'solo' : ''}`}>S</button>
            <button onClick={(e) => { e.stopPropagation(); toggleMute(trackId, engine.current); }} className={`control-button ${isMuted ? 'mute' : ''}`}><VolumeX size={12} /></button>
        </div>
      }
    </div>
  );
});

export default MixerChannel;

