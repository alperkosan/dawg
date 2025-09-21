import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { useMixerStore } from '../../store/useMixerStore';
import { SignalVisualizer } from '../SignalVisualizer';


const OrbitVisualizer = ({ frequency, depth, inputLevel }) => {
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
      
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Arka plan
      ctx.fillStyle = 'rgba(5, 5, 20, 0.2)';
      ctx.fillRect(0, 0, width, height);
      
      // Orbit yolu
      const orbitRadius = Math.min(width, height) * 0.3 * depth;
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbitRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // L/R etiketleri
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('L', 20, centerY);
      ctx.fillText('R', width - 30, centerY);
      
      // Orbital nesne
      const angle = time * frequency * 0.002;
      const objX = centerX + Math.cos(angle) * orbitRadius;
      const objY = centerY + Math.sin(angle) * orbitRadius;
      
      // Nesnenin izi
      const trailLength = 50;
      for (let i = 0; i < trailLength; i++) {
        const trailAngle = angle - (i * 0.05);
        const trailX = centerX + Math.cos(trailAngle) * orbitRadius;
        const trailY = centerY + Math.sin(trailAngle) * orbitRadius;
        const alpha = (1 - i / trailLength) * inputLevel * 0.5;
        
        ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(trailX, trailY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Ana nesne
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15 + inputLevel * 20;
      ctx.beginPath();
      ctx.arc(objX, objY, 8 + inputLevel * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      time += 16;
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [frequency, depth, inputLevel]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export const OrbitPannerUI = ({ trackId, effect, onChange }) => {
  const { frequency, depth, wet } = effect.settings;
  const [inputLevel, setInputLevel] = useState(0);
  
  useEffect(() => {
    const meterId = `${trackId}-input`;
    const handleLevel = (data) => setInputLevel((data.peak + 60) / 60);
    const unsubscribe = MeteringService.subscribe(meterId, handleLevel);
    return unsubscribe;
  }, [trackId]);
  
  const timeOptions = [
    { value: '1n', label: '1/1' },
    { value: '2n', label: '1/2' },
    { value: '4n', label: '1/4' },
    { value: '8n', label: '1/8' },
    { value: '16n', label: '1/16' }
  ];
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-blue-950 to-teal-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-cyan-200">Orbit Panner</h2>
          <p className="text-xs text-cyan-400">Spatial Audio Movement</p>
        </div>
        
        {/* Sync Mode Toggle */}
        <button
          className={`px-4 py-2 rounded-lg border transition-all ${
            typeof frequency === 'string'
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
              : 'border-cyan-600/50 text-cyan-400 hover:border-cyan-400/70'
          }`}
          onClick={() => onChange('frequency', typeof frequency === 'string' ? 2 : '4n')}
        >
          {typeof frequency === 'string' ? 'SYNC' : 'FREE'}
        </button>
      </div>
      
      {/* Main Orbit Visualization */}
      <div className="bg-black/30 rounded-xl p-4 mb-6 h-56 border border-cyan-600/20">
        <OrbitVisualizer 
          frequency={typeof frequency === 'string' ? 2 : frequency} 
          depth={depth} 
          inputLevel={inputLevel}
        />
      </div>
      
      {/* Controls */}
      <div className="grid grid-cols-3 gap-6">
        {/* Rate Control */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-cyan-200">Rate</label>
          {typeof frequency === 'string' ? (
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
          ) : (
            <ProfessionalKnob 
              value={frequency} 
              onChange={(v) => onChange('frequency', v)} 
              min={0.1} max={10} defaultValue={2} 
              unit="Hz" precision={2} size={70}
            />
          )}
        </div>
        
        <ProfessionalKnob 
          label="Orbit Size" 
          value={depth * 100} 
          onChange={(v) => onChange('depth', v / 100)} 
          min={0} max={100} defaultValue={100} 
          unit="%" precision={0} size={75}
        />
        
        <ProfessionalKnob 
          label="Mix" 
          value={wet * 100} 
          onChange={(v) => onChange('wet', v / 100)} 
          min={0} max={100} defaultValue={100} 
          unit="%" precision={0} size={75}
        />
      </div>
      
      {/* Position Indicator */}
      <div className="mt-4 bg-black/20 rounded-lg p-3 border border-cyan-600/20">
        <div className="flex justify-between items-center text-xs text-cyan-300">
          <span>L</span>
          <div className="flex-1 mx-4 h-2 bg-cyan-900 rounded-full relative">
            <div 
              className="absolute top-0 w-4 h-2 bg-cyan-400 rounded-full transform -translate-x-1/2"
              style={{ left: `${50 + Math.sin(Date.now() * 0.001 * (typeof frequency === 'string' ? 2 : frequency)) * 50 * depth}%` }}
            />
          </div>
          <span>R</span>
        </div>
      </div>
    </div>
  );
};
