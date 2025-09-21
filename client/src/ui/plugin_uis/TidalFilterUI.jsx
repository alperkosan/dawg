import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { useMixerStore } from '../../store/useMixerStore';
import { SignalVisualizer } from '../SignalVisualizer';


import * as Tone from 'tone';

// Animated Filter Sweep Visualizer
const FilterSweepVisualizer = ({ frequency, baseFrequency, octaves, wet }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;
    
    const animate = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Clear with gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, 'rgba(15, 15, 25, 0.9)');
      bgGradient.addColorStop(1, 'rgba(5, 5, 15, 0.9)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
      
      // Calculate LFO position
      const lfoRate = typeof frequency === 'string' 
        ? Tone.Time(frequency).toFrequency() 
        : frequency;
      const lfoPhase = Math.sin(time * 0.001 * lfoRate * 2 * Math.PI);
      
      // Current filter frequency
      const currentFreq = baseFrequency * Math.pow(2, lfoPhase * octaves);
      const freqPosition = Math.log(currentFreq / 20) / Math.log(20000 / 20);
      
      // Draw frequency spectrum background
      ctx.strokeStyle = 'rgba(100, 150, 200, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const x = (i / 9) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      // Draw filter response curve
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 10;
      
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const freq = 20 * Math.pow(20000 / 20, x / width);
        let response = 1;
        
        // Simple low-pass filter response simulation
        if (freq > currentFreq) {
          const ratio = freq / currentFreq;
          response = 1 / Math.sqrt(1 + Math.pow(ratio, 4)); // 24dB/oct slope
        }
        
        const y = height - (response * height * 0.8 * wet);
        
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Draw current frequency indicator
      const cutoffX = freqPosition * width;
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cutoffX, 0);
      ctx.lineTo(cutoffX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Frequency label
      ctx.fillStyle = '#ff4444';
      ctx.font = '12px monospace';
      ctx.fillText(`${currentFreq.toFixed(0)}Hz`, cutoffX + 5, 20);
      
      // Draw LFO wave
      const lfoHeight = 40;
      const lfoY = height - lfoHeight - 10;
      
      ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const phase = (x / width) * 4 * Math.PI + time * 0.001 * lfoRate * 2 * Math.PI;
        const lfoValue = Math.sin(phase);
        const y = lfoY + lfoValue * (lfoHeight / 2 - 5);
        
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      time += 16;
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [frequency, baseFrequency, octaves, wet]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Filter Type Selector
const FilterTypeSelector = ({ currentType, onTypeChange }) => {
  const types = [
    { id: 'lowpass', name: 'LP', icon: '↘', color: '#ef4444' },
    { id: 'highpass', name: 'HP', icon: '↗', color: '#3b82f6' },
    { id: 'bandpass', name: 'BP', icon: '⧫', color: '#10b981' },
    { id: 'notch', name: 'NT', icon: '⌄', color: '#f59e0b' }
  ];
  
  return (
    <div className="grid grid-cols-2 gap-2">
      {types.map(type => (
        <button
          key={type.id}
          onClick={() => onTypeChange(type.id)}
          className={`p-3 rounded-lg border transition-all ${
            currentType === type.id
              ? 'border-white bg-white/10 text-white'
              : 'border-white/20 text-white/60 hover:border-white/40'
          }`}
          style={{
            backgroundColor: currentType === type.id ? type.color + '20' : 'transparent',
            borderColor: currentType === type.id ? type.color : undefined
          }}
        >
          <div className="text-2xl mb-1">{type.icon}</div>
          <div className="text-xs font-bold">{type.name}</div>
        </button>
      ))}
    </div>
  );
};

// LFO Rate Visualizer
const LFORateVisualizer = ({ frequency }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;
    
    const animate = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.clearRect(0, 0, width, height);
      
      const lfoRate = typeof frequency === 'string' 
        ? Tone.Time(frequency).toFrequency() 
        : frequency;
      
      // Draw LFO waveform
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 5;
      
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const phase = (x / width) * 4 * Math.PI * lfoRate + time * 0.001 * lfoRate * 2 * Math.PI;
        const y = height / 2 + Math.sin(phase) * (height / 2 - 10);
        
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      time += 16;
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [frequency]);
  
  return <canvas ref={canvasRef} className="w-full h-8" />;
};

export const TidalFilterUI = ({ trackId, effect, onChange }) => {
  const { frequency, baseFrequency, octaves, wet } = effect.settings;
  const [filterType, setFilterType] = useState('lowpass');
  
  const timeOptions = [
    { value: '4n', label: '1/4' },
    { value: '8n', label: '1/8' },
    { value: '16n', label: '1/16' },
    { value: '32n', label: '1/32' },
    { value: '2t', label: '1/2T' },
    { value: '4t', label: '1/4T' },
    { value: '8t', label: '1/8T' }
  ];
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-teal-950 to-green-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-cyan-200">Spectral Gate</h2>
          <p className="text-xs text-cyan-400">Auto-Filter with LFO Modulation</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Filter Type */}
          <div className="text-center">
            <div className="text-xs text-cyan-300 mb-2">TYPE</div>
            <FilterTypeSelector 
              currentType={filterType}
              onTypeChange={setFilterType}
            />
          </div>
        </div>
      </div>
      
      {/* Main Filter Visualization */}
      <div className="bg-black/30 rounded-xl p-4 mb-6 h-64 border border-cyan-600/20">
        <FilterSweepVisualizer 
          frequency={frequency} 
          baseFrequency={baseFrequency} 
          octaves={octaves}
          wet={wet}
        />
      </div>
      
      {/* Controls Grid */}
      <div className="grid grid-cols-4 gap-6 mb-4">
        {/* LFO Rate */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-cyan-200">LFO Rate</label>
          <select 
            value={frequency} 
            onChange={(e) => onChange('frequency', e.target.value)}
            className="w-full bg-black/50 border border-cyan-400 rounded-lg p-2 text-white text-center"
          >
            {timeOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-gray-800">
                {opt.label}
              </option>
            ))}
          </select>
          
          {/* LFO Visualizer */}
          <div className="bg-black/20 rounded border border-cyan-600/20 p-2">
            <LFORateVisualizer frequency={frequency} />
          </div>
        </div>
        
        {/* Base Frequency */}
        <div className="flex justify-center">
          <ProfessionalKnob 
            label="Cutoff" 
            value={baseFrequency} 
            onChange={(val) => onChange('baseFrequency', val)} 
            min={20} max={10000} defaultValue={400} 
            unit="Hz" precision={0} size={80} logarithmic
          />
        </div>
        
        {/* Modulation Depth */}
        <div className="flex justify-center">
          <ProfessionalKnob 
            label="Depth" 
            value={octaves} 
            onChange={(val) => onChange('octaves', val)} 
            min={0} max={8} defaultValue={2} 
            unit=" oct" precision={1} size={80}
          />
        </div>
        
        {/* Mix */}
        <div className="flex justify-center">
          <ProfessionalKnob 
            label="Mix" 
            value={wet * 100} 
            onChange={(val) => onChange('wet', val / 100)} 
            min={0} max={100} defaultValue={100} 
            unit="%" precision={0} size={80}
          />
        </div>
      </div>
      
      {/* Analysis Section */}
      <div className="grid grid-cols-2 gap-4">
        {/* Input Spectrum */}
        <div className="bg-black/20 rounded-lg p-3 border border-cyan-600/20">
          <div className="text-xs text-cyan-300 mb-2">Input Spectrum</div>
          <SignalVisualizer 
            meterId={`${trackId}-fft`}
            type="spectrum"
            color="#06b6d4"
            config={{ showGrid: false, smooth: true }}
          />
        </div>
        
        {/* Output Waveform */}
        <div className="bg-black/20 rounded-lg p-3 border border-cyan-600/20">
          <div className="text-xs text-cyan-300 mb-2">Output Signal</div>
          <SignalVisualizer 
            meterId={`${trackId}-waveform`}
            type="scope"
            color="#10b981"
            config={{ showPeak: false, smooth: true }}
          />
        </div>
      </div>
      
      {/* Info Footer */}
      <div className="mt-4 text-center text-xs text-cyan-200/60">
        Filter: {filterType.toUpperCase()} • 
        Rate: {frequency} • 
        Range: {baseFrequency}Hz ± {octaves} oct
      </div>
    </div>
  );
};