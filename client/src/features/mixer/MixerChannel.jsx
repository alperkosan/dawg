// src/features/mixer/MixerChannel.jsx - DÜZELTİLMİŞ

import React, { useState, useCallback, useMemo, Suspense } from 'react';
import { useMixerStore } from '../../store/useMixerStore';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalFader } from '../../ui/plugin_system/PluginControls';
import VolumeKnob from '../../ui/VolumeKnob';
import { Play, Volume2, VolumeX, Eye, EyeOff, Plus, Settings, X } from 'lucide-react';
import { pluginRegistry } from '../../config/pluginConfig'; // pluginRegistry import'u eklendi
import PluginContainer from '../../ui/plugin_system/PluginContainer'; // PluginContainer import'u eklendi

// EffectSlot Component
const EffectSlot = React.memo(({ trackId, effect, onToggleExpanded, audioEngineRef, isExpanded }) => {
    // DÜZELTME: Store eylemlerini getState() ile alıyoruz.
    const { handleMixerEffectChange, handleMixerEffectRemove } = useMixerStore.getState();
    
    const PluginUIComponent = useMemo(() => {
        const pluginDef = pluginRegistry[effect.type];
        return pluginDef ? pluginDef.uiComponent : () => <div>Plugin UI not found</div>;
    }, [effect.type]);

    const handleParamChange = useCallback((param, value) => {
        handleMixerEffectChange(trackId, effect.id, param, value, audioEngineRef.current);
    }, [trackId, effect.id, handleMixerEffectChange, audioEngineRef]);

    const handleBypassToggle = useCallback((e) => {
        e.stopPropagation();
        handleMixerEffectChange(trackId, effect.id, 'bypass', !effect.bypass, audioEngineRef.current);
    }, [trackId, effect.id, effect.bypass, handleMixerEffectChange, audioEngineRef]);

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg mb-2 overflow-hidden transition-all duration-200">
            <div
                className={`flex items-center justify-between p-2 cursor-pointer ${effect.bypass ? 'bg-gray-800/50' : 'bg-gray-700/80'}`}
                onClick={onToggleExpanded}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full transition-all ${effect.bypass ? 'bg-gray-500' : 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.7)]'}`} />
                    <span className={`text-xs font-semibold ${effect.bypass ? 'text-gray-500' : 'text-white'}`}>{effect.type}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleMixerEffectRemove(trackId, effect.id); }} className="text-gray-500 hover:text-red-500"><X size={14} /></button>
                    <Eye size={12} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>
            {isExpanded && PluginUIComponent && (
                <div className="p-2 bg-gray-900/50 h-64">
                    <PluginContainer
                        key={effect.id}
                        trackId={trackId}
                        effect={effect}
                        definition={pluginRegistry[effect.type]}
                        onChange={handleParamChange}
                    >
                        <PluginUIComponent
                            trackId={trackId}
                            effect={effect}
                            onChange={handleParamChange}
                            definition={pluginRegistry[effect.type]}
                        />
                    </PluginContainer>
                </div>
            )}
        </div>
    );
});


// LevelMeter Component
const LevelMeter = React.memo(({ trackId, type = 'output' }) => {
  const [level, setLevel] = useState(-60);

  React.useEffect(() => {
    const meterId = `${trackId}-${type}`;
    const handleLevel = (value) => {
      const dbValue = typeof value === 'number' ? 
        (value > 0 ? 20 * Math.log10(value) : -60) : -60;
      setLevel(Math.max(-60, Math.min(6, dbValue)));
    };
    MeteringService.subscribe(meterId, handleLevel);
    return () => MeteringService.unsubscribe(meterId, handleLevel);
  }, [trackId, type]);

  const levelPercent = ((level + 60) / 66) * 100;

  return (
    <div className="level-meter w-4 h-20 bg-gray-900 rounded-sm relative overflow-hidden border border-black/50">
      <div className={`absolute bottom-0 left-0 right-0 transition-all duration-75 ${level > -0.5 ? 'bg-red-500' : level > -12 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ height: `${Math.max(0, levelPercent)}%` }} />
      {[-6, -12, -24, -48].map(db => (<div key={db} className="absolute left-0 right-0 h-px bg-gray-700" style={{ bottom: `${((db + 60) / 66) * 100}%` }} />))}
    </div>
  );
});


// Ana MixerChannel
const MixerChannel = React.memo(({ trackId, audioEngineRef }) => {
  // DÜZELTME: State'leri reaktif olarak alıyoruz.
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === trackId));
  const soloedChannels = useMixerStore(state => state.soloedChannels);
  const mutedChannels = useMixerStore(state => state.mutedChannels);
  
  // DÜZELTME: Eylemleri (fonksiyonları) getState() ile alıyoruz.
  const { handleMixerParamChange, toggleSolo, toggleMute, handleMixerEffectAdd } = useMixerStore.getState();

  const [expandedEffects, setExpandedEffects] = useState(new Set());

  const isSolo = soloedChannels.has(trackId);
  const isMuted = mutedChannels.has(trackId);
  const isMaster = track?.type === 'master';
  const hasSolo = soloedChannels.size > 0;
  const isDimmed = hasSolo && !isSolo;

  // DÜZELTME: useCallback içindeki 'updateTrackParam' yerine 'handleMixerParamChange' kullanıyoruz.
  const handleParamChange = useCallback((param, value) => {
    handleMixerParamChange(trackId, param, value, audioEngineRef.current);
  }, [trackId, handleMixerParamChange, audioEngineRef]);

  const handleSoloToggle = useCallback(() => {
    toggleSolo(trackId, audioEngineRef.current);
  }, [trackId, toggleSolo, audioEngineRef]);

  const handleMuteToggle = useCallback(() => {
    toggleMute(trackId, audioEngineRef.current);
  }, [trackId, toggleMute, audioEngineRef]);
  
  const handleEffectAdd = useCallback(() => {
    // Örnek olarak Compressor ekliyoruz, ileride bir menü açılabilir.
    handleMixerEffectAdd(trackId, 'Compressor');
  }, [trackId, handleMixerEffectAdd]);

  const toggleEffectExpanded = useCallback((effectId) => {
    setExpandedEffects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(effectId)) newSet.delete(effectId);
      else newSet.add(effectId);
      return newSet;
    });
  }, []);

  if (!track) return null;

  return (
    <div className={`mixer-channel flex flex-col w-40 h-full p-2 transition-all duration-200 ${isDimmed ? 'opacity-40' : 'opacity-100'} ${isMaster ? 'border-l-2 border-cyan-500' : ''}`}>
      <div className="channel-header mb-3">
        <div className={`text-center p-2 rounded text-xs font-bold truncate ${isMaster ? 'bg-cyan-900 text-cyan-200' : 'bg-gray-800 text-gray-200'}`}>{track.name}</div>
      </div>
      <div className="meters-section flex justify-center gap-2 mb-3">
        <LevelMeter trackId={trackId} type="input" />
        <LevelMeter trackId={trackId} type="output" />
      </div>
      <div className="inserts-section flex-grow mb-3 min-h-0">
        <div className="bg-gray-900 rounded p-1 h-full overflow-y-auto">
          <div className="flex justify-between items-center p-1">
            <span className="text-xs font-semibold text-gray-400">INSERTS</span>
            <button onClick={handleEffectAdd} className="text-cyan-400 hover:text-cyan-300" title="Add Effect"><Plus size={14} /></button>
          </div>
          <div className="effects-list">
            {track.insertEffects?.map(effect => (
              <EffectSlot key={effect.id} trackId={trackId} effect={effect} isExpanded={expandedEffects.has(effect.id)} onToggleExpanded={() => toggleEffectExpanded(effect.id)} audioEngineRef={audioEngineRef} />
            ))}
          </div>
        </div>
      </div>
      {!isMaster && (
        <div className="pan-section flex justify-center mb-3">
          <VolumeKnob label="Pan" size={28} value={track.pan || 0} onChange={(val) => handleParamChange('pan', val)} min={-1} max={1} defaultValue={0} />
        </div>
      )}
      <div className="fader-section flex-grow flex items-center justify-center">
        <ProfessionalFader label={isMaster ? 'MASTER' : ''} value={track.volume} onChange={(val) => handleParamChange('volume', val)} min={-60} max={6} height={150} />
      </div>
      {!isMaster && (
        <div className="control-buttons flex gap-1 mt-2">
          <button onClick={handleSoloToggle} className={`flex-1 py-1 px-2 text-xs font-bold rounded transition-colors ${isSolo ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>S</button>
          <button onClick={handleMuteToggle} className={`flex-1 py-1 px-2 text-xs font-bold rounded transition-colors ${isMuted ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>M</button>
        </div>
      )}
    </div>
  );
});

export default MixerChannel;