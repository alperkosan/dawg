import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { useMixerStore } from '../../store/useMixerStore';
import { SignalVisualizer } from '../SignalVisualizer';


export const GhostLFOUI = ({ trackId, effect, onChange, definition }) => {
  const { rate, stretch, atmosphere, glitch, wet } = effect.settings;
  
  const timeOptions = [
    { value: '1n', label: '1/1', ghost: '👻' },
    { value: '2n', label: '1/2', ghost: '🌙' },
    { value: '4n', label: '1/4', ghost: '⚡' },
    { value: '8n', label: '1/8', ghost: '🔮' },
    { value: '16n', label: '1/16', ghost: '💀' },
    { value: '4t', label: '1/4T', ghost: '🌟' },
    { value: '8t', label: '1/8T', ghost: '✨' },
    { value: '16t', label: '1/16T', ghost: '🌀' }
  ];
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-purple-950 via-violet-950 to-indigo-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-purple-200">Ghost LFO</h2>
          <p className="text-xs text-purple-400">Paranormal Sample Manipulation</p>
        </div>
        
        {/* Paranormal Activity Meter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-300">Activity</span>
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-8 rounded transition-all ${
                  (atmosphere + glitch) * 2 > i 
                    ? 'bg-purple-400 shadow-lg shadow-purple-400/50 animate-pulse' 
                    : 'bg-purple-900'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Spectral Waveform */}
      <div className="bg-black/40 rounded-xl p-4 mb-6 h-48 border border-purple-600/30">
        <SpectralWaveform rate={rate} stretch={stretch} atmosphere={atmosphere} glitch={glitch} />
      </div>
      
      {/* Rate Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-purple-200 mb-3">Spectral Rate</label>
        <div className="grid grid-cols-4 gap-2">
          {timeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange('rate', opt.value)}
              className={`p-3 rounded-lg border transition-all ${
                rate === opt.value
                  ? 'border-purple-400 bg-purple-500/30 text-purple-200'
                  : 'border-purple-600/50 text-purple-400 hover:border-purple-400/70'
              }`}
            >
              <div className="text-lg mb-1">{opt.ghost}</div>
              <div className="text-xs font-bold">{opt.label}</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Paranormal Controls */}
      <div className="grid grid-cols-4 gap-6">
        <ProfessionalKnob 
          label="Stretch" 
          value={stretch} 
          onChange={(v) => onChange('stretch', v)} 
          min={0} max={1} defaultValue={0.5} 
          precision={2} size={75}
        />
        
        <ProfessionalKnob 
          label="Atmosphere" 
          value={atmosphere * 100} 
          onChange={(v) => onChange('atmosphere', v / 100)} 
          min={0} max={100} defaultValue={30} 
          unit="%" precision={0} size={75}
        />
        
        <ProfessionalKnob 
          label="Glitch" 
          value={glitch * 100} 
          onChange={(v) => onChange('glitch', v / 100)} 
          min={0} max={100} defaultValue={10} 
          unit="%" precision={0} size={75}
        />
        
        <ProfessionalKnob 
          label="Manifest" 
          value={wet * 100} 
          onChange={(v) => onChange('wet', v / 100)} 
          min={0} max={100} defaultValue={100} 
          unit="%" precision={0} size={75}
        />
      </div>
      
      {/* Spirit Board */}
      <div className="mt-6 bg-black/30 rounded-lg p-4 border border-purple-600/20">
        <div className="text-center text-xs text-purple-300 mb-2">SPIRIT COMMUNICATION</div>
        <div className="flex justify-between items-center text-xs text-purple-400">
          <span className={atmosphere > 0.7 ? 'text-purple-200 animate-pulse' : ''}>
            {atmosphere > 0.8 ? 'PRESENCE DETECTED' : atmosphere > 0.5 ? 'ENERGY BUILDING' : 'QUIET'}
          </span>
          <span>Rate: {rate}</span>
          <span className={glitch > 0.5 ? 'text-red-400 animate-pulse' : ''}>
            {glitch > 0.7 ? 'INTERFERENCE' : 'STABLE'}
          </span>
        </div>
      </div>
    </div>
  );
};
