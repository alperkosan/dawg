import React, { useState } from 'react';
import { Play, Pause, Volume2, Filter, Repeat, Zap, Plus, X } from 'lucide-react';
import { useRealtimeEffects } from '../hooks/useRealtimeEffects';
import { RealtimeEffectsEngine } from '../../../lib/audio/RealtimeEffects';

const RealtimeTab = ({ instrument, instrumentBuffer }) => {
  const { 
    engine, 
    isPlaying, 
    activeEffects, 
    addEffect, 
    removeEffect, 
    toggleEffect, 
    updateEffectParam, 
    togglePlayback 
  } = useRealtimeEffects(instrumentBuffer);

  const [effectParams, setEffectParams] = useState({
    reverb: { roomSize: 0.7, decay: 1.5, wet: 0.3 },
    delay: { delayTime: 0.25, feedback: 0.3, wet: 0.25 },
    filter: { frequency: 1000, Q: 1 },
    distortion: { distortion: 0.4, wet: 1 },
    chorus: { frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.3 }
  });

  const handleAddEffect = (effectType) => {
    if (!engine || activeEffects.has(effectType)) return;

    let effectNode;
    const params = effectParams[effectType];

    switch (effectType) {
      case 'reverb':
        effectNode = RealtimeEffectsEngine.createReverbEffect(
          params.roomSize, params.decay, params.wet
        );
        break;
      case 'delay':
        effectNode = RealtimeEffectsEngine.createDelayEffect(
          params.delayTime, params.feedback, params.wet
        );
        break;
      case 'filter':
        effectNode = RealtimeEffectsEngine.createFilterEffect(
          params.frequency, 'lowpass', params.Q
        );
        break;
      case 'distortion':
        effectNode = RealtimeEffectsEngine.createDistortionEffect(
          params.distortion, params.wet
        );
        break;
      case 'chorus':
        effectNode = RealtimeEffectsEngine.createChorusEffect(
          params.frequency, params.delayTime, params.depth, params.wet
        );
        break;
      default:
        return;
    }

    addEffect(effectType, effectNode);
  };

  const handleRemoveEffect = (effectType) => {
    removeEffect(effectType);
  };

  const handleParamChange = (effectType, param, value) => {
    setEffectParams(prev => ({
      ...prev,
      [effectType]: { ...prev[effectType], [param]: value }
    }));

    updateEffectParam(effectType, param, value);
  };

  const effectTypes = [
    { id: 'reverb', name: 'Reverb', icon: Volume2, color: 'bg-blue-500' },
    { id: 'delay', name: 'Delay', icon: Repeat, color: 'bg-green-500' },
    { id: 'filter', name: 'Filter', icon: Filter, color: 'bg-yellow-500' },
    { id: 'distortion', name: 'Distortion', icon: Zap, color: 'bg-red-500' },
    { id: 'chorus', name: 'Chorus', icon: Volume2, color: 'bg-purple-500' }
  ];

  const renderEffectControls = (effectType) => {
    if (!activeEffects.has(effectType)) return null;

    const params = effectParams[effectType];

    switch (effectType) {
      case 'reverb':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs block mb-1">Room Size</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={params.roomSize}
                onChange={(e) => handleParamChange(effectType, 'roomSize', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{params.roomSize.toFixed(2)}</span>
            </div>
            <div>
              <label className="text-xs block mb-1">Decay</label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={params.decay}
                onChange={(e) => handleParamChange(effectType, 'decay', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{params.decay.toFixed(1)}s</span>
            </div>
            <div>
              <label className="text-xs block mb-1">Wet</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={params.wet}
                onChange={(e) => handleParamChange(effectType, 'wet', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{(params.wet * 100).toFixed(0)}%</span>
            </div>
          </div>
        );

      case 'delay':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs block mb-1">Delay Time</label>
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={params.delayTime}
                onChange={(e) => handleParamChange(effectType, 'delayTime', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{params.delayTime.toFixed(2)}s</span>
            </div>
            <div>
              <label className="text-xs block mb-1">Feedback</label>
              <input
                type="range"
                min="0"
                max="0.95"
                step="0.01"
                value={params.feedback}
                onChange={(e) => handleParamChange(effectType, 'feedback', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{(params.feedback * 100).toFixed(0)}%</span>
            </div>
            <div>
              <label className="text-xs block mb-1">Wet</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={params.wet}
                onChange={(e) => handleParamChange(effectType, 'wet', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{(params.wet * 100).toFixed(0)}%</span>
            </div>
          </div>
        );

      case 'filter':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs block mb-1">Frequency</label>
              <input
                type="range"
                min="20"
                max="20000"
                value={params.frequency}
                onChange={(e) => handleParamChange(effectType, 'frequency', parseInt(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{params.frequency}Hz</span>
            </div>
            <div>
              <label className="text-xs block mb-1">Resonance (Q)</label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={params.Q}
                onChange={(e) => handleParamChange(effectType, 'Q', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{params.Q.toFixed(1)}</span>
            </div>
          </div>
        );

      case 'distortion':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs block mb-1">Distortion</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={params.distortion}
                onChange={(e) => handleParamChange(effectType, 'distortion', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{(params.distortion * 100).toFixed(0)}%</span>
            </div>
            <div>
              <label className="text-xs block mb-1">Wet</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={params.wet}
                onChange={(e) => handleParamChange(effectType, 'wet', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{(params.wet * 100).toFixed(0)}%</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex" style={{ padding: 'var(--padding-container)', gap: 'var(--padding-container)', backgroundColor: 'var(--color-surface)' }}>
      {/* Sol Panel - Effect Controls */}
      <div className="w-80 shrink-0 flex flex-col" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', padding: 'var(--padding-container)', gap: 'var(--gap-container)' }}>
        
        {/* Playback Control */}
        <div className="text-center pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={togglePlayback}
            disabled={!instrumentBuffer}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 rounded-lg font-bold disabled:opacity-50 transition-all"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            <span>{isPlaying ? 'Stop Preview' : 'Preview with FX'}</span>
          </button>
        </div>

        {/* Effect Chain */}
        <div className="flex-grow">
          <h4 className="font-bold text-sm mb-3">Effect Chain</h4>
          
          <div className="space-y-4">
            {effectTypes.map((effectType) => {
              const isActive = activeEffects.has(effectType.id);
              const Icon = effectType.icon;
              
              return (
                <div key={effectType.id} className={`border rounded-lg p-3 ${isActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${effectType.color}`}>
                        <Icon size={14} className="text-white" />
                      </div>
                      <span className="font-medium text-sm">{effectType.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {isActive ? (
                        <button
                          onClick={() => handleRemoveEffect(effectType.id)}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Remove Effect"
                        >
                          <X size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddEffect(effectType.id)}
                          className="p-1 text-green-400 hover:text-green-300"
                          title="Add Effect"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {isActive && (
                    <div className="mt-3">
                      {renderEffectControls(effectType.id)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sağ Panel - Visualization */}
      <div className="flex-grow rounded-lg p-4" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="h-full flex flex-col">
          <h3 className="text-lg font-bold mb-4">Real-time Effects</h3>
          
          <div className="flex-grow flex items-center justify-center">
            {instrumentBuffer ? (
              <div className="w-full">
                {/* Effect Chain Visualization */}
                <div className="mb-6">
                  <h4 className="font-bold mb-3">Signal Chain</h4>
                  <div className="flex items-center gap-2 p-4 bg-gray-800 rounded-lg">
                    <div className="px-3 py-2 bg-blue-600 rounded text-sm font-bold">
                      Input
                    </div>
                    
                    {Array.from(activeEffects).map((effectId, index) => (
                      <React.Fragment key={effectId}>
                        <div className="text-gray-400">→</div>
                        <div className="px-3 py-2 bg-green-600 rounded text-sm font-bold capitalize">
                          {effectId}
                        </div>
                      </React.Fragment>
                    ))}
                    
                    <div className="text-gray-400">→</div>
                    <div className="px-3 py-2 bg-red-600 rounded text-sm font-bold">
                      Output
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-800 rounded">
                    <div className="text-sm text-gray-400 mb-1">Active Effects</div>
                    <div className="text-2xl font-bold text-blue-400">
                      {activeEffects.size}
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-800 rounded">
                    <div className="text-sm text-gray-400 mb-1">Playing</div>
                    <div className="text-2xl font-bold text-green-400">
                      {isPlaying ? 'YES' : 'NO'}
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-800 rounded">
                    <div className="text-sm text-gray-400 mb-1">Duration</div>
                    <div className="text-2xl font-bold text-purple-400">
                      {instrumentBuffer.duration.toFixed(1)}s
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <Volume2 size={48} className="mx-auto mb-4 opacity-50" />
                <p>Load a sample to use real-time effects</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeTab;