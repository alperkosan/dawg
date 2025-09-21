import React, { useRef, useEffect, useState } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { SignalVisualizer } from '../SignalVisualizer';

// Tube Glow Animation
const TubeGlowVisualizer = ({ distortion, inputLevel, wet }) => {
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
      
      const centerX = width / 2;
      const centerY = height / 2;
      const normalizedInput = (Math.max(-60, inputLevel) + 60) / 60;
      const intensity = normalizedInput * distortion * wet;
      
      // Tube outline
      const tubeWidth = width * 0.6;
      const tubeHeight = height * 0.8;
      
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(centerX - tubeWidth/2, centerY - tubeHeight/2, tubeWidth, tubeHeight, 20);
      ctx.stroke();
      
      // Inner glow effect
      const glowIntensity = 0.3 + intensity * 0.7;
      const glowRadius = tubeHeight * 0.3 * glowIntensity;
      
      // Create multiple glow layers
      for (let i = 0; i < 5; i++) {
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, glowRadius * (1 + i * 0.3)
        );
        
        const alpha = (0.4 - i * 0.06) * intensity;
        const hue = 20 + intensity * 30; // Orange to yellow
        
        gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, ${alpha})`);
        gradient.addColorStop(0.7, `hsla(${hue}, 80%, 50%, ${alpha * 0.5})`);
        gradient.addColorStop(1, `hsla(${hue}, 60%, 40%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
      
      // Filament simulation
      const filamentCount = 3;
      for (let i = 0; i < filamentCount; i++) {
        const x = centerX + (i - 1) * (tubeWidth * 0.15);
        const flickerOffset = Math.sin(time * 0.01 + i) * 2;
        
        ctx.strokeStyle = `hsla(${40 + intensity * 20}, 100%, 80%, ${0.8 + intensity * 0.2})`;
        ctx.lineWidth = 2 + intensity * 3;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 10 + intensity * 20;
        
        ctx.beginPath();
        ctx.moveTo(x, centerY - tubeHeight * 0.3);
        ctx.lineTo(x + flickerOffset, centerY + tubeHeight * 0.3);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      
      // Heat particles
      if (intensity > 0.3) {
        for (let i = 0; i < Math.floor(intensity * 10); i++) {
          const particleX = centerX + (Math.random() - 0.5) * tubeWidth * 0.8;
          const particleY = centerY + (Math.random() - 0.5) * tubeHeight * 0.6;
          const size = Math.random() * 3 + 1;
          
          ctx.fillStyle = `hsla(${Math.random() * 60}, 100%, 70%, ${Math.random() * 0.8})`;
          ctx.beginPath();
          ctx.arc(particleX, particleY, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      time += 16;
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [distortion, inputLevel, wet]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Harmonic Content Analyzer
const HarmonicAnalyzer = ({ distortion }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Simulate harmonic content based on distortion amount
    const harmonics = [
      { freq: 1, amplitude: 1 }, // Fundamental
      { freq: 2, amplitude: distortion * 0.6 }, // 2nd harmonic
      { freq: 3, amplitude: distortion * 0.4 }, // 3rd harmonic
      { freq: 4, amplitude: distortion * 0.25 }, // 4th harmonic
      { freq: 5, amplitude: distortion * 0.15 }, // 5th harmonic
      { freq: 6, amplitude: distortion * 0.1 }, // 6th harmonic
    ];
    
    const barWidth = width / harmonics.length;
    
    harmonics.forEach((harmonic, index) => {
      const barHeight = harmonic.amplitude * height * 0.8;
      const x = index * barWidth;
      const y = height - barHeight;
      
      // Color based on harmonic content
      const hue = index === 0 ? 200 : 30 + index * 10; // Blue for fundamental, warm for harmonics
      const saturation = 70 + harmonic.amplitude * 30;
      const lightness = 50 + harmonic.amplitude * 20;
      
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
      
      // Harmonic number label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${harmonic.freq}`, x + barWidth/2, height - 5);
    });
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
  }, [distortion]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Drive Meter Component
const DriveMeter = ({ distortion }) => {
  const percentage = Math.min(100, (distortion / 1.5) * 100);
  const segments = 12;
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs font-bold text-amber-300">DRIVE</div>
      <div className="flex flex-col-reverse gap-1 h-32 w-6 bg-black/50 rounded p-1 border border-amber-600/30">
        {Array.from({ length: segments }).map((_, i) => {
          const segmentValue = ((segments - 1 - i) / (segments - 1)) * 100;
          const isActive = percentage >= segmentValue;
          
          let color = '#22c55e'; // Green
          if (segmentValue > 60) color = '#f59e0b'; // Amber
          if (segmentValue > 80) color = '#ef4444'; // Red
          
          return (
            <div
              key={i}
              className="h-2 w-full rounded-sm transition-all duration-100"
              style={{
                backgroundColor: isActive ? color : 'rgba(255,255,255,0.1)',
                boxShadow: isActive ? `0 0 8px ${color}` : 'none'
              }}
            />
          );
        })}
      </div>
      <div className="text-[10px] text-amber-300 font-mono">
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
};

// Saturation Type Selector
const SaturationType = ({ currentType, onTypeChange }) => {
  const types = [
    { id: 'warm', name: 'Warm Tube', description: 'Smooth, warm saturation' },
    { id: 'aggressive', name: 'Hot Tube', description: 'Aggressive, colored tone' },
    { id: 'tape', name: 'Tape Sat', description: 'Vintage tape warmth' },
    { id: 'transistor', name: 'Solid State', description: 'Clean transistor saturation' }
  ];
  
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-amber-300 text-center">SATURATION TYPE</div>
      <div className="grid grid-cols-2 gap-2">
        {types.map(type => (
          <button
            key={type.id}
            onClick={() => onTypeChange(type.id)}
            className={`p-2 text-xs rounded border transition-all ${
              currentType === type.id
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-white/20 text-white/60 hover:border-white/40'
            }`}
          >
            <div className="font-medium">{type.name}</div>
            <div className="text-[10px] opacity-60">{type.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const SaturatorUI = ({ trackId, effect, onChange }) => {
  const { distortion, wet } = effect.settings;
  const [inputLevel, setInputLevel] = useState(-60);
  const [saturationType, setSaturationType] = useState('warm');
  
  useEffect(() => {
    const meterId = `${trackId}-input`;
    const handleLevel = (data) => setInputLevel(data.peak || -60);
    const unsubscribe = MeteringService.subscribe(meterId, handleLevel);
    return unsubscribe;
  }, [trackId]);
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-amber-950 via-orange-950 to-red-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-amber-200">Analog Heat</h2>
          <p className="text-xs text-amber-400">Vacuum Tube Saturation</p>
        </div>
        
        <div className="flex items-center gap-4">
          <DriveMeter distortion={distortion} />
        </div>
      </div>
      
      {/* Main Tube Visualization */}
      <div className="bg-black/30 rounded-xl p-6 mb-6 h-64 border border-amber-600/20">
        <TubeGlowVisualizer 
          distortion={distortion} 
          inputLevel={inputLevel} 
          wet={wet}
        />
      </div>
      
      {/* Controls Grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Drive Control */}
        <div className="flex justify-center">
          <ProfessionalKnob 
            label="Drive" 
            value={distortion} 
            onChange={(val) => onChange('distortion', val)} 
            min={0} max={1.5} defaultValue={0.4} 
            precision={2} size={100}
          />
        </div>
        
        {/* Saturation Type */}
        <SaturationType 
          currentType={saturationType}
          onTypeChange={setSaturationType}
        />
        
        {/* Mix Control */}
        <div className="flex justify-center">
          <ProfessionalKnob 
            label="Mix" 
            value={wet * 100} 
            onChange={(val) => onChange('wet', val / 100)} 
            min={0} max={100} defaultValue={100} 
            unit="%" precision={0} size={100}
          />
        </div>
      </div>
      
      {/* Analysis Section */}
      <div className="grid grid-cols-2 gap-4">
        {/* Harmonic Content */}
        <div className="bg-black/20 rounded-lg p-3 border border-amber-600/20">
          <div className="text-xs text-amber-300 mb-2">Harmonic Content</div>
          <HarmonicAnalyzer distortion={distortion} />
        </div>
        
        {/* Output Waveform */}
        <div className="bg-black/20 rounded-lg p-3 border border-amber-600/20">
          <div className="text-xs text-amber-300 mb-2">Output Waveform</div>
          <SignalVisualizer 
            meterId={`${trackId}-waveform`}
            type="scope"
            color="#f59e0b"
            config={{ showPeak: true, smooth: true }}
          />
        </div>
      </div>
      
      {/* Info Footer */}
      <div className="mt-4 text-center text-xs text-amber-200/60">
        THD: {(distortion * 15).toFixed(1)}% • 
        Warmth: {saturationType} • 
        Output: {((1 + distortion * 0.5) * wet * 100).toFixed(0)}%
      </div>
    </div>
  );
};