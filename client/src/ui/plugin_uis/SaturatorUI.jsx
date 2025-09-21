import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

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
      
      const tubeWidth = width * 0.6;
      const tubeHeight = height * 0.8;
      
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(centerX - tubeWidth/2, centerY - tubeHeight/2, tubeWidth, tubeHeight, 20);
      ctx.stroke();
      
      const glowIntensity = 0.3 + intensity * 0.7;
      const glowRadius = tubeHeight * 0.3 * glowIntensity;
      
      for (let i = 0; i < 5; i++) {
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius * (1 + i * 0.3));
        const alpha = (0.4 - i * 0.06) * intensity;
        const hue = 20 + intensity * 30;
        gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${hue}, 60%, 40%, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
      
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
    
    const harmonics = [ { freq: 1, amplitude: 1 }, { freq: 2, amplitude: distortion * 0.6 }, { freq: 3, amplitude: distortion * 0.4 }, { freq: 4, amplitude: distortion * 0.25 }, { freq: 5, amplitude: distortion * 0.15 }, { freq: 6, amplitude: distortion * 0.1 } ];
    const barWidth = width / harmonics.length;
    
    harmonics.forEach((harmonic, index) => {
      const barHeight = harmonic.amplitude * height * 0.8;
      const x = index * barWidth;
      const y = height - barHeight;
      const hue = index === 0 ? 200 : 30 + index * 10;
      ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
    });
    
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
          let color = '#22c55e';
          if (segmentValue > 60) color = '#f59e0b';
          if (segmentValue > 80) color = '#ef4444';
          return ( <div key={i} className="h-2 w-full rounded-sm transition-all duration-100" style={{ backgroundColor: isActive ? color : 'rgba(255,255,255,0.1)', boxShadow: isActive ? `0 0 8px ${color}` : 'none' }} /> );
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
  const types = [ { id: 'warm', name: 'Warm Tube' }, { id: 'aggressive', name: 'Hot Tube' }, { id: 'tape', name: 'Tape Sat' }, { id: 'transistor', name: 'Solid State' } ];
  return (
    <div className="flex flex-col h-full justify-center">
      <div className="text-xs font-bold text-amber-300 text-center mb-2">SATURATION TYPE</div>
      <div className="grid grid-cols-2 gap-2">
        {types.map(type => (
          <button
            key={type.id}
            onClick={() => onTypeChange(type.id)}
            className={`p-2 text-[10px] rounded border transition-all h-12 ${
              currentType === type.id ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-white/20 text-white/60 hover:border-white/40'
            }`}
          >
            {type.name}
          </button>
        ))}
      </div>
    </div>
  );
};

// === YENİ VE KOMPAKT ANA ARAYÜZ BİLEŞENİ ===
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
    <div className="w-full h-full bg-gradient-to-br from-amber-950 via-orange-950 to-red-950 p-4 grid grid-cols-[2fr_1fr] gap-4">
      
      {/* --- SOL SÜTUN: BAŞLIK VE ANA GÖRSELLEŞTİRME --- */}
      <div className="flex flex-col gap-4 h-full">
        {/* Ana Görselleştirme (Kalan alanı doldurur) */}
        <div className="bg-black/30 rounded-xl p-2 border border-amber-600/20 flex-grow min-h-0">
          <TubeGlowVisualizer 
            distortion={distortion} 
            inputLevel={inputLevel} 
            wet={wet}
          />
        </div>
      </div>
      
      {/* --- SAĞ SÜTUN: TÜM KONTROLLER --- */}
      <div className="flex flex-col gap-4">
        {/* Ana Potanslar */}
        <div className="grid grid-cols-2 gap-2 bg-black/20 p-3 rounded-lg border border-white/10">
            <ProfessionalKnob 
                label="Drive" value={distortion} onChange={(val) => onChange('distortion', val)} 
                min={0} max={1.5} defaultValue={0.4} precision={2} size={80}
            />
            <ProfessionalKnob 
                label="Mix" value={wet * 100} onChange={(val) => onChange('wet', val / 100)} 
                min={0} max={100} defaultValue={100} unit="%" precision={0} size={80}
            />
        </div>

        {/* Metre ve Tip Seçici */}
        <div className="grid grid-cols-2 gap-4 flex-grow">
            <div className="flex justify-center items-center bg-black/20 p-3 rounded-lg border border-white/10">
                 <DriveMeter distortion={distortion} />
            </div>
            <div className="bg-black/20 p-3 rounded-lg border border-white/10">
                <SaturationType 
                    currentType={saturationType}
                    onTypeChange={setSaturationType}
                />
            </div>
        </div>

        {/* Harmonik Analiz */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
            <div className="text-xs text-amber-300 mb-1">Harmonic Content</div>
            <div className="h-16">
                 <HarmonicAnalyzer distortion={distortion} />
            </div>
        </div>
      </div>
    </div>
  );
};