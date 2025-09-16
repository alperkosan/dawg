// client/src/features/mixer/EnhancedMixerChannel.jsx - YENİ DOSYA

import React, { useState, useCallback, useMemo, Suspense } from 'react';
import { useMixerStore } from '../../store/useMixerStore';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalFader } from '../../ui/plugin_system/PluginControls';
import VolumeKnob from '../../ui/VolumeKnob';
import { Play, Volume2, VolumeX, Eye, EyeOff, Plus, Settings } from 'lucide-react';

/**
 * ÇOK ÖNEMLİ İYİLEŞTİRMELER:
 * 1. Real-time metering display
 * 2. Collapsible effect slots
 * 3. Solo/Mute visual feedback
 * 4. Send controls integration
 * 5. A/B comparison UI
 */

// Effect Slot Component - Gelişmiş versiyon
const EffectSlot = React.memo(({ trackId, effect, isExpanded, onToggleExpanded, audioEngineRef }) => {
  const { updateEffectParam, toggleEffectBypass, toggleEffectAB, copyAToB } = useMixerStore();
  const [meteringValue, setMeteringValue] = useState(0);

  // Dynamic UI component loading
  const PluginUI = React.useMemo(() => {
    return React.lazy(() => 
      import(`../../ui/plugin_uis/${effect.type}UI.jsx`)
        .then(module => ({ default: module[`${effect.type}UI`] }))
        .catch(() => ({ default: () => <div className="text-xs text-gray-400">Plugin UI not found</div> }))
    );
  }, [effect.type]);

  // Metering subscription
  React.useEffect(() => {
    if (['Compressor', 'Limiter'].includes(effect.type)) {
      const meterId = `${trackId}-${effect.id}`;
      const handleMeteringData = (value) => setMeteringValue(value);
      
      MeteringService.subscribe(meterId, handleMeteringData);
      return () => MeteringService.unsubscribe(meterId, handleMeteringData);
    }
  }, [trackId, effect.id, effect.type]);

  const handleParamChange = useCallback((param, value) => {
    updateEffectParam(trackId, effect.id, param, value, audioEngineRef);
  }, [trackId, effect.id, updateEffectParam, audioEngineRef]);

  const handleBypassToggle = useCallback(() => {
    toggleEffectBypass(trackId, effect.id, audioEngineRef);
  }, [trackId, effect.id, toggleEffectBypass, audioEngineRef]);

  const handleABToggle = useCallback(() => {
    toggleEffectAB(trackId, effect.id, audioEngineRef);
  }, [trackId, effect.id, toggleEffectAB, audioEngineRef]);

  const handleCopyAToB = useCallback(() => {
    copyAToB(trackId, effect.id, audioEngineRef);
  }, [trackId, effect.id, copyAToB, audioEngineRef]);

  return (
    <div className="effect-slot border border-gray-700 rounded-lg mb-2 overflow-hidden">
      {/* Effect Header */}
      <div 
        className={`effect-header p-2 cursor-pointer transition-colors ${
          effect.bypass ? 'bg-gray-800' : 'bg-gray-700'
        } ${isExpanded ? 'bg-opacity-100' : 'bg-opacity-70'}`}
        onClick={onToggleExpanded}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Bypass LED */}
            <div className={`w-2 h-2 rounded-full ${
              effect.bypass ? 'bg-red-500' : 'bg-green-400'
            } ${!effect.bypass ? 'shadow-[0_0_8px_rgba(34,197,94,0.8)]' : ''}`} />
            
            <span className={`text-xs font-semibold ${
              effect.bypass ? 'text-gray-500' : 'text-white'
            }`}>
              {effect.type}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Metering Display */}
            {meteringValue !== 0 && (
              <div className="text-[10px] text-amber-400 font-mono">
                {meteringValue.toFixed(1)}dB
              </div>
            )}

            {/* A/B State Indicator */}
            {effect.abState && (
              <div className="flex items-center gap-1">
                <div className={`px-1 py-0.5 text-[10px] font-bold rounded ${
                  effect.abState.isB ? 'bg-gray-600 text-gray-400' : 'bg-amber-500 text-gray-900'
                }`}>A</div>
                <div className={`px-1 py-0.5 text-[10px] font-bold rounded ${
                  effect.abState.isB ? 'bg-amber-500 text-gray-900' : 'bg-gray-600 text-gray-400'
                }`}>B</div>
              </div>
            )}

            {/* Expand/Collapse Icon */}
            <div className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              <Eye size={12} className="text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Effect Controls */}
      {isExpanded && (
        <div className="effect-controls p-3 bg-gray-800">
          {/* Control Buttons */}
          <div className="flex justify-between mb-3 pb-2 border-b border-gray-700">
            <button
              onClick={handleBypassToggle}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                effect.bypass 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              {effect.bypass ? 'Bypassed' : 'Active'}
            </button>

            <div className="flex gap-1">
              <button
                onClick={handleABToggle}
                className="px-2 py-1 text-xs bg-gray-600 hover:bg-amber-600 text-white rounded transition-colors"
                title="Toggle A/B"
              >
                A↔B
              </button>
              <button
                onClick={handleCopyAToB}
                className="px-2 py-1 text-xs bg-gray-600 hover:bg-blue-600 text-white rounded transition-colors"
                title="Copy A to B"
              >
                A→B
              </button>
            </div>
          </div>

          {/* Plugin UI */}
          <div className="plugin-ui-container">
            <Suspense fallback={<div className="text-xs text-gray-400 p-4">Loading plugin UI...</div>}>
              <PluginUI
                trackId={trackId}
                effect={effect}
                onChange={handleParamChange}
                definition={{ type: effect.type }} // Plugin definition gelecek
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
});

// Send Control Component - Yeni
const SendControl = React.memo(({ trackId, send, audioEngineRef }) => {
  const { updateSendLevel } = useMixerStore();

  const handleSendChange = useCallback((value) => {
    const sendId = `${trackId}->${send.busId}`;
    updateSendLevel(sendId, value, audioEngineRef);
  }, [trackId, send.busId, updateSendLevel, audioEngineRef]);

  return (
    <div className="send-control flex items-center gap-2 p-2 bg-gray-800 rounded mb-1">
      <span className="text-xs text-gray-400 w-16 truncate">
        {send.busName || `Bus ${send.busId}`}
      </span>
      <VolumeKnob
        size={20}
        value={send.level}
        onChange={handleSendChange}
        min={-60}
        max={6}
        defaultValue={-20}
      />
    </div>
  );
});

// Level Meter Component - Yeni
const LevelMeter = React.memo(({ trackId, type = 'output' }) => {
  const [level, setLevel] = useState(-60);

  React.useEffect(() => {
    const meterId = `${trackId}-${type}`;
    const handleLevel = (value) => {
      // Convert to dB if needed
      const dbValue = typeof value === 'number' ? 
        (value > 0 ? 20 * Math.log10(value) : -60) : -60;
      setLevel(Math.max(-60, Math.min(6, dbValue)));
    };

    MeteringService.subscribe(meterId, handleLevel);
    return () => MeteringService.unsubscribe(meterId, handleLevel);
  }, [trackId, type]);

  const meterHeight = 80;
  const levelPercent = ((level + 60) / 66) * 100; // -60dB to +6dB range

  return (
    <div className="level-meter w-4 h-20 bg-gray-900 rounded-sm relative overflow-hidden">
      {/* Meter fill */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-75 ${
          level > -6 ? 'bg-red-500' : 
          level > -18 ? 'bg-yellow-500' : 
          'bg-green-500'
        }`}
        style={{ height: `${Math.max(0, levelPercent)}%` }}
      />
      
      {/* Scale marks */}
      <div className="absolute inset-0 pointer-events-none">
        {[-6, -12, -24, -48].map(db => (
          <div
            key={db}
            className="absolute left-0 right-0 h-px bg-gray-600"
            style={{ bottom: `${((db + 60) / 66) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
});

// Main Enhanced Mixer Channel
const EnhancedMixerChannel = React.memo(({ trackId, audioEngineRef }) => {
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === trackId));
  const soloedChannels = useMixerStore(state => state.soloedChannels);
  const mutedChannels = useMixerStore(state => state.mutedChannels);
  
  const { 
    updateTrackParam, 
    toggleSolo, 
    toggleMute,
    handleMixerEffectAdd 
  } = useMixerStore();

  // Local UI state
  const [expandedEffects, setExpandedEffects] = useState(new Set());
  const [showSends, setShowSends] = useState(false);

  // Computed states
  const isSolo = soloedChannels.has(trackId);
  const isMuted = mutedChannels.has(trackId);
  const isMaster = track?.type === 'master';
  const hasSolo = soloedChannels.size > 0;
  const isDimmed = hasSolo && !isSolo; // Other channels are solo'd

  // Callbacks
  const handleParamChange = useCallback((param, value) => {
    updateTrackParam(trackId, param, value, audioEngineRef);
  }, [trackId, updateTrackParam, audioEngineRef]);

  const handleSoloToggle = useCallback(() => {
    toggleSolo(trackId, audioEngineRef);
  }, [trackId, toggleSolo, audioEngineRef]);

  const handleMuteToggle = useCallback(() => {
    toggleMute(trackId, audioEngineRef);
  }, [trackId, toggleMute, audioEngineRef]);

  const handleEffectAdd = useCallback(() => {
    // Bu basit bir örnek - gerçekte AddEffectMenu açılacak
    handleMixerEffectAdd(trackId, 'Compressor');
  }, [trackId, handleMixerEffectAdd]);

  const toggleEffectExpanded = useCallback((effectId) => {
    setExpandedEffects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(effectId)) {
        newSet.delete(effectId);
      } else {
        newSet.add(effectId);
      }
      return newSet;
    });
  }, []);

  if (!track) return null;

  return (
    <div className={`mixer-channel flex flex-col w-32 h-full p-2 transition-all duration-200 ${
      isDimmed ? 'opacity-30' : 'opacity-100'
    } ${isMaster ? 'border-l-2 border-cyan-500' : ''}`}>
      
      {/* Channel Header */}
      <div className="channel-header mb-3">
        <div className={`text-center p-2 rounded text-xs font-bold ${
          isMaster ? 'bg-cyan-900 text-cyan-200' : 'bg-gray-800 text-gray-200'
        }`}>
          {track.name}
        </div>
      </div>

      {/* Level Meters */}
      <div className="meters-section flex justify-center gap-1 mb-3">
        <LevelMeter trackId={trackId} type="input" />
        <LevelMeter trackId={trackId} type="output" />
      </div>

      {/* Insert Effects Section */}
      <div className="inserts-section flex-grow mb-3">
        <div className="bg-gray-900 rounded p-2 h-32 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-gray-400">INSERTS</span>
            <button
              onClick={handleEffectAdd}
              className="text-xs text-cyan-400 hover:text-cyan-300"
              title="Add Effect"
            >
              <Plus size={12} />
            </button>
          </div>
          
          <div className="effects-list">
            {track.insertEffects?.map(effect => (
              <EffectSlot
                key={effect.id}
                trackId={trackId}
                effect={effect}
                isExpanded={expandedEffects.has(effect.id)}
                onToggleExpanded={() => toggleEffectExpanded(effect.id)}
                audioEngineRef={audioEngineRef}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Send Controls */}
      {track.sends?.length > 0 && (
        <div className="sends-section mb-3">
          <button
            onClick={() => setShowSends(!showSends)}
            className="w-full text-xs text-gray-400 hover:text-gray-200 flex items-center justify-center gap-1"
          >
            <Settings size={12} />
            SENDS
          </button>
          
          {showSends && (
            <div className="sends-list mt-2 max-h-24 overflow-y-auto">
              {track.sends.map(send => (
                <SendControl
                  key={send.busId}
                  trackId={trackId}
                  send={send}
                  audioEngineRef={audioEngineRef}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pan Control (non-master channels) */}
      {!isMaster && (
        <div className="pan-section flex justify-center mb-3">
          <VolumeKnob
            label="Pan"
            size={24}
            value={track.pan || 0}
            onChange={(val) => handleParamChange('pan', val)}
            min={-1}
            max={1}
            defaultValue={0}
          />
        </div>
      )}

      {/* Main Fader */}
      <div className="fader-section flex-grow flex items-center justify-center">
        <ProfessionalFader
          label={isMaster ? 'MASTER' : 'LEVEL'}
          value={track.volume}
          onChange={(val) => handleParamChange('volume', val)}
          min={-60}
          max={6}
          height={120}
        />
      </div>

      {/* Solo/Mute Buttons */}
      {!isMaster && (
        <div className="control-buttons flex gap-1 mt-2">
          <button
            onClick={handleSoloToggle}
            className={`flex-1 py-1 px-2 text-xs font-bold rounded transition-colors ${
              isSolo 
                ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.8)]' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            S
          </button>
          <button
            onClick={handleMuteToggle}
            className={`flex-1 py-1 px-2 text-xs font-bold rounded transition-colors ${
              isMuted 
                ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)]' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            M
          </button>
        </div>
      )}
    </div>
  );
});

export default EnhancedMixerChannel;