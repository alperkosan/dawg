// 1. STARDUST CHORUS UI - Geliştirilmiş Galaksi Teması
// =======================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { MeteringService } from '../../lib/core/MeteringService';
import { SignalVisualizer } from '../SignalVisualizer';

// Galaksi Parçacık Sistemi
const GalaxyParticleSystem = ({ rate, depth, delayTime, inputLevel }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    class ChorusParticle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.originalX = x;
        this.originalY = y;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 0.5 + Math.random() * 1;
        this.size = 1 + Math.random() * 3;
        this.life = 1;
        this.color = `hsl(${200 + Math.random() * 100}, 80%, 60%)`;
      }
      
      update(time) {
        // LFO modülasyonu ile parçacık pozisyonu
        const lfoOffset = Math.sin(time * rate * 0.1) * depth * 20;
        this.x = this.originalX + Math.cos(this.angle + time * 0.01) * lfoOffset;
        this.y = this.originalY + Math.sin(this.angle + time * 0.01) * lfoOffset;
        
        this.life -= 0.005;
        this.angle += 0.02;
      }
      
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life * inputLevel;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.size * 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    
    const animate = (time) => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Arka plan gradyanı
      const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
      gradient.addColorStop(0, 'rgba(15, 15, 40, 0.9)');
      gradient.addColorStop(1, 'rgba(5, 5, 20, 0.9)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Yeni parçacıklar ekle
      if (inputLevel > 0.1 && particlesRef.current.length < 100) {
        for (let i = 0; i < 3; i++) {
          particlesRef.current.push(new ChorusParticle(
            width/2 + (Math.random() - 0.5) * 100,
            height/2 + (Math.random() - 0.5) * 100
          ));
        }
      }
      
      // Parçacıkları güncelle ve çiz
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.update(time);
        particle.draw(ctx);
        return particle.life > 0;
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate(0);
    return () => cancelAnimationFrame(animationFrameId);
  }, [rate, depth, delayTime, inputLevel]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export const StardustChorusUI = ({ trackId, effect, onChange }) => {
  const { frequency, delayTime, depth, wet } = effect.settings;
  const [inputLevel, setInputLevel] = useState(0);
  
  useEffect(() => {
    const meterId = `${trackId}-input`;
    const handleLevel = (data) => setInputLevel((data.peak + 60) / 60);
    const unsubscribe = MeteringService.subscribe(meterId, handleLevel);
    return unsubscribe;
  }, [trackId]);
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-purple-200">Stardust Chorus</h2>
          <p className="text-xs text-purple-400">Galactic Modulation Engine</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Constellation Pattern Selector */}
          <div className="grid grid-cols-3 gap-1">
            {['◦', '◉', '●'].map((pattern, i) => (
              <button
                key={i}
                onClick={() => onChange('depth', (i + 1) * 0.3)}
                className={`w-8 h-8 rounded-full border transition-all ${
                  Math.abs(depth - (i + 1) * 0.3) < 0.1
                    ? 'border-purple-400 bg-purple-500/30'
                    : 'border-purple-600/50 hover:border-purple-400/70'
                }`}
              >
                <span className="text-purple-300">{pattern}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main Galaxy Visualization */}
      <div className="bg-black/30 rounded-xl p-4 mb-6 h-48 border border-purple-600/20">
        <GalaxyParticleSystem 
          rate={frequency} 
          depth={depth} 
          delayTime={delayTime}
          inputLevel={inputLevel}
        />
      </div>
      
      {/* Controls */}
      <div className="grid grid-cols-4 gap-6">
        <ProfessionalKnob 
          label="Rate" 
          value={frequency} 
          onChange={(v) => onChange('frequency', v)} 
          min={0.1} max={10} defaultValue={1.5} 
          unit="Hz" precision={2} size={75}
        />
        
        <ProfessionalKnob 
          label="Delay Time" 
          value={delayTime} 
          onChange={(v) => onChange('delayTime', v)} 
          min={1} max={20} defaultValue={3.5} 
          unit="ms" precision={1} size={75}
        />
        
        <ProfessionalKnob 
          label="Depth" 
          value={depth * 100} 
          onChange={(v) => onChange('depth', v / 100)} 
          min={0} max={100} defaultValue={70} 
          unit="%" precision={0} size={75}
        />
        
        <ProfessionalKnob 
          label="Mix" 
          value={wet * 100} 
          onChange={(v) => onChange('wet', v / 100)} 
          min={0} max={100} defaultValue={50} 
          unit="%" precision={0} size={75}
        />
      </div>
      
      {/* Bottom Info Panel */}
      <div className="mt-4 bg-black/20 rounded-lg p-3 border border-purple-600/20">
        <div className="flex justify-between items-center text-xs text-purple-300">
          <span>Modulation: {(frequency * depth * 100).toFixed(1)}%</span>
          <span>Shimmer: {(inputLevel * wet * 100).toFixed(0)}%</span>
          <span>Width: Stereo</span>
        </div>
      </div>
    </div>
  );
};