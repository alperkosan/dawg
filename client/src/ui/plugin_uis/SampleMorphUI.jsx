import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { useMixerStore } from '../../store/useMixerStore';
import { SignalVisualizer } from '../SignalVisualizer';


const MorphVisualization = ({ mode, randomness, retrigger, grainSize, overlap }) => {
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
      
      // Laboratory background
      ctx.fillStyle = 'rgba(0, 20, 40, 0.1)';
      ctx.fillRect(0, 0, width, height);
      
      // Grid lines
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * width;
        const y = (i / 10) * height;
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      // Draw sample segments based on mode
      const segmentWidth = width / 16;
      
      for (let i = 0; i < 16; i++) {
        const x = i * segmentWidth;
        let segmentHeight = height * 0.6;
        let color = [0, 255, 255]; // Cyan base
        
        // Mode-specific visualization
        switch (mode) {
          case 'reverse':
            color = [255, 100, 100]; // Red
            if ((15 - i) % 4 === 0) segmentHeight *= 1.5;
            break;
          case 'stutter':
            color = [255, 255, 100]; // Yellow
            if (Math.sin(time * 0.01 + i) > 0.5) segmentHeight *= (1 + retrigger);
            break;
          case 'halftime':
            color = [100, 255, 100]; // Green
            if (i % 2 === 0) segmentHeight *= 0.5;
            break;
          default:
            // Normal mode - slight variation
            segmentHeight *= (1 + (Math.sin(time * 0.005 + i) * 0.1));
        }
        
        // Add randomness
        if (randomness > 0.1) {
          segmentHeight *= (1 + (Math.random() - 0.5) * randomness);
          const randomHue = Math.random() * 60 - 30;
          color[0] = Math.max(0, Math.min(255, color[0] + randomHue));
        }
        
        // Grain size effect
        const grainEffect = grainSize * 10;
        const segments = Math.max(1, Math.floor(grainEffect));
        const subWidth = segmentWidth / segments;
        
        for (let j = 0; j < segments; j++) {
          const subX = x + j * subWidth;
          const alpha = 0.6 + overlap * 0.4;
          
          ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
          ctx.fillRect(subX, height - segmentHeight, subWidth - 1, segmentHeight);
        }
      }
      
      time += 16;
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mode, randomness, retrigger, grainSize, overlap]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export const SampleMorphUI = ({ trackId, effect, onChange, definition }) => {
  const { mode, randomness, retrigger, grainSize, overlap, sliceLength, wet } = effect.settings;
  
  const modes = [
    { id: 'normal', name: 'Normal', icon: '▶️', color: 'cyan' },
    { id: 'reverse', name: 'Reverse', icon: '◀️', color: 'red' },
    { id: 'stutter', name: 'Stutter', icon: '⚡', color: 'yellow' },
    { id: 'halftime', name: 'Half-Time', icon: '🐌', color: 'green' }
  ];
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-cyan-200">Sample Morph</h2>
          <p className="text-xs text-cyan-400">Time Manipulation Laboratory</p>
        </div>
        
        {/* DNA Helix Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-cyan-300">DNA</span>
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 border-2 border-cyan-400 rounded-full animate-spin" />
            <div className="absolute inset-1 border border-cyan-600 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
      
      {/* Mode Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-cyan-200 mb-3">Morphing Mode</label>
        <div className="grid grid-cols-4 gap-3">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => onChange('mode', m.id)}
              className={`p-4 rounded-lg border transition-all ${
                mode === m.id
                  ? `border-${m.color}-400 bg-${m.color}-500/20 text-${m.color}-200`
                  : 'border-cyan-600/50 text-cyan-400 hover:border-cyan-400/70'
              }`}
            >
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="text-xs font-bold">{m.name}</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Sample Visualization */}
      <div className="bg-black/40 rounded-xl p-4 mb-6 h-32 border border-cyan-600/20">
        <MorphVisualization 
          mode={mode} 
          randomness={randomness} 
          retrigger={retrigger}
          grainSize={grainSize}
          overlap={overlap}
        />
      </div>
      
      {/* XY Pad and Controls */}
      <div className="grid grid-cols-2 gap-6">
        {/* XY Morph Pad */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-cyan-200">Chaos Matrix</label>
          <div 
            className="relative w-full h-48 bg-black/30 rounded-lg border border-cyan-600/30 cursor-crosshair"
            onMouseDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const updatePosition = (clientX, clientY) => {
                const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
                onChange('randomness', x);
                onChange('retrigger', y);
              };
              
              updatePosition(e.clientX, e.clientY);
              
              const handleMouseMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
              const handleMouseUp = () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              };
              
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }}
          >
            {/* Grid */}
            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,255,255,0.2)" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
            
            {/* Crosshair */}
            <div 
              className="absolute w-4 h-4 border-2 border-cyan-400 rounded-full bg-cyan-400/20 transform -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-cyan-400/50"
              style={{
                left: `${randomness * 100}%`,
                top: `${(1 - retrigger) * 100}%`
              }}
            />
            
            {/* Axis Labels */}
            <div className="absolute bottom-2 right-2 text-xs text-cyan-400">Chaos →</div>
            <div className="absolute top-2 left-2 text-xs text-cyan-400 transform -rotate-90 origin-left">Retrigger →</div>
          </div>
        </div>
        
        {/* Grain Controls */}
        <div className="space-y-6">
          <ProfessionalKnob 
            label="Grain Size" 
            value={grainSize} 
            onChange={(v) => onChange('grainSize', v)} 
            min={0.01} max={1} defaultValue={0.2} 
            unit="s" precision={3} size={80}
          />
          
          <ProfessionalKnob 
            label="Overlap" 
            value={overlap * 100} 
            onChange={(v) => onChange('overlap', v / 100)} 
            min={0} max={100} defaultValue={10} 
            unit="%" precision={0} size={80}
          />
          
          <ProfessionalKnob 
            label="Slice Length" 
            value={sliceLength * 100} 
            onChange={(v) => onChange('sliceLength', v / 100)} 
            min={5} max={100} defaultValue={100} 
            unit="%" precision={0} size={80}
          />
        </div>
      </div>
      
      {/* Laboratory Status */}
      <div className="mt-6 bg-black/20 rounded-lg p-3 border border-cyan-600/20">
        <div className="grid grid-cols-4 gap-4 text-xs text-cyan-300">
          <div>Mode: <span className="text-cyan-200">{mode.toUpperCase()}</span></div>
          <div>Chaos: <span className="text-cyan-200">{(randomness * 100).toFixed(0)}%</span></div>
          <div>Retrig: <span className="text-cyan-200">{(retrigger * 100).toFixed(0)}%</span></div>
          <div>Status: <span className="text-green-400">STABLE</span></div>
        </div>
      </div>
    </div>
  );
};
