import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Knob } from '@/components/controls';
import { useCanvasVisualization, useGhostValue, useAudioPlugin } from '@/hooks/useAudioPlugin';

// Galaksi Parçacık Sistemi
const GalaxyParticleSystem = ({ rate, depth, delayTime, inputLevel }) => {
  const particlesRef = useRef([]);
  const timeRef = useRef(0);

  const drawGalaxy = useCallback((ctx, width, height) => {
    const time = timeRef.current;

    // Particle class definition
    class ChorusParticle {
      constructor(x, y) {
        this.x = x; this.y = y;
        this.originalX = x; this.originalY = y;
        this.angle = Math.random() * Math.PI * 2;
        this.size = 1 + Math.random() * 3;
        this.life = 1;
        this.color = `hsl(${200 + Math.random() * 100}, 80%, 60%)`;
      }

      update(currentTime) {
        const lfoOffset = Math.sin(currentTime * rate * 0.1) * depth * 20;
        this.x = this.originalX + Math.cos(this.angle + currentTime * 0.01) * lfoOffset;
        this.y = this.originalY + Math.sin(this.angle + currentTime * 0.01) * lfoOffset;
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

    // Background gradient
    const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    gradient.addColorStop(0, 'rgba(15, 15, 40, 0.9)');
    gradient.addColorStop(1, 'rgba(5, 5, 20, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Spawn new particles
    if (inputLevel > 0.1 && particlesRef.current.length < 100) {
      for (let i = 0; i < 3; i++) {
        particlesRef.current.push(
          new ChorusParticle(
            width/2 + (Math.random() - 0.5) * 100,
            height/2 + (Math.random() - 0.5) * 100
          )
        );
      }
    }

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.update(time);
      particle.draw(ctx);
      return particle.life > 0;
    });

    // Update time for next frame
    timeRef.current += 0.5;
  }, [rate, depth, delayTime, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawGalaxy,
    [rate, depth, delayTime, inputLevel]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// Ana StardustChorusUI bileşeni
export const StardustChorusUI = ({ trackId, effect, onChange }) => {
  const { frequency, delayTime, depth, wet } = effect.settings;
  const [inputLevel, setInputLevel] = useState(0);

  // Use audio plugin hook
  const { plugin, metrics } = useAudioPlugin(trackId, effect.id, {
    fftSize: 1024,
    updateMetrics: true
  });

  // Update input level from metrics
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel((metrics.inputPeak + 60) / 60);
    }
  }, [metrics]);

  // Ghost values for parameter feedback
  const ghostFrequency = useGhostValue(frequency, 400);
  const ghostDelayTime = useGhostValue(delayTime, 400);
  const ghostDepth = useGhostValue(depth, 400);
  const ghostWet = useGhostValue(wet, 400);

  return (
    <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider">The Modulation Machine</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-3 gap-1">
            {['◦', '◉', '●'].map((pattern, i) => (
              <button key={i} onClick={() => onChange('depth', (i + 1) * 0.3)}
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

      <div className="bg-black/30 rounded-xl p-4 mb-6 h-48 border border-purple-600/20">
        <GalaxyParticleSystem
          rate={frequency}
          depth={depth}
          delayTime={delayTime}
          inputLevel={inputLevel}
        />
      </div>

      <div className="grid grid-cols-4 gap-6">
        <Knob
          label="Rate"
          value={frequency}
          onChange={(v) => onChange('frequency', v)}
          min={0.1}
          max={10}
          defaultValue={1.5}
          unit="Hz"
          precision={2}
          size={75}
          category="modulation-machines"
          ghostValue={ghostFrequency}
          showGhostValue={true}
        />
        <Knob
          label="Delay"
          value={delayTime}
          onChange={(v) => onChange('delayTime', v)}
          min={1}
          max={20}
          defaultValue={3.5}
          unit="ms"
          precision={1}
          size={75}
          category="modulation-machines"
          ghostValue={ghostDelayTime}
          showGhostValue={true}
        />
        <Knob
          label="Depth"
          value={depth * 100}
          onChange={(v) => onChange('depth', v / 100)}
          min={0}
          max={100}
          defaultValue={70}
          unit="%"
          precision={0}
          size={75}
          category="modulation-machines"
          ghostValue={ghostDepth * 100}
          showGhostValue={true}
        />
        <Knob
          label="Mix"
          value={wet * 100}
          onChange={(v) => onChange('wet', v / 100)}
          min={0}
          max={100}
          defaultValue={50}
          unit="%"
          precision={0}
          size={75}
          category="modulation-machines"
          ghostValue={ghostWet * 100}
          showGhostValue={true}
        />
      </div>

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
