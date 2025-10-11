import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Knob } from '@/components/controls';
import { useCanvasVisualization, useGhostValue, useAudioPlugin } from '@/hooks/useAudioPlugin';

const VortexVisualizer = ({ frequency, octaves, baseFrequency, inputLevel }) => {
  const timeRef = useRef(0);

  const drawVortex = useCallback((ctx, width, height) => {
    const time = timeRef.current;
    const centerX = width / 2;
    const centerY = height / 2;

    // Arka plan
    ctx.fillStyle = 'rgba(10, 20, 40, 0.1)';
    ctx.fillRect(0, 0, width, height);

    // Girdap çizgileri
    const numRings = 8;
    for (let ring = 0; ring < numRings; ring++) {
      const radius = (ring + 1) * (Math.min(width, height) / 20);
      const rotation = time * frequency * 0.001 + ring * 0.5;

      ctx.strokeStyle = `hsl(${280 + ring * 10}, 70%, ${50 + inputLevel * 30}%)`;
      ctx.lineWidth = 2 + inputLevel * 3;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
        const modulation = Math.sin(angle * octaves + rotation) * radius * 0.3;
        const x = centerX + Math.cos(angle) * (radius + modulation);
        const y = centerY + Math.sin(angle) * (radius + modulation);

        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Update time for next frame
    timeRef.current += 16;
  }, [frequency, octaves, baseFrequency, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawVortex,
    [frequency, octaves, baseFrequency, inputLevel]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export const VortexPhaserUI = ({ trackId, effect, onChange }) => {
  const { frequency, octaves, baseFrequency, wet } = effect.settings;
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
  const ghostOctaves = useGhostValue(octaves, 400);
  const ghostBaseFrequency = useGhostValue(baseFrequency, 400);
  const ghostWet = useGhostValue(wet, 400);

  return (
    <div className="w-full h-full bg-gradient-to-br from-purple-950 via-indigo-950 to-blue-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-indigo-200">Vortex Phaser</h2>
          <p className="text-xs text-indigo-400">Psychedelic Phase Modulation</p>
        </div>

        {/* Intensity Meter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-indigo-300">Intensity</span>
          <div className="flex gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-6 rounded-full transition-all ${
                  inputLevel * 8 > i ? 'bg-indigo-400 shadow-lg shadow-indigo-400/50' : 'bg-indigo-900'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Vortex Visualization */}
      <div className="bg-black/30 rounded-xl p-4 mb-6 h-56 border border-indigo-600/20">
        <VortexVisualizer
          frequency={frequency}
          octaves={octaves}
          baseFrequency={baseFrequency}
          inputLevel={inputLevel}
        />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-4 gap-6">
        <Knob
          label="Rate"
          value={frequency}
          onChange={(v) => onChange('frequency', v)}
          min={0.1}
          max={10}
          defaultValue={0.5}
          unit="Hz"
          precision={2}
          size={75}
          category="modulation-machines"
          ghostValue={ghostFrequency}
          showGhostValue={true}
        />

        <Knob
          label="Stages"
          value={octaves}
          onChange={(v) => onChange('octaves', Math.round(v))}
          min={2}
          max={12}
          defaultValue={3}
          precision={0}
          size={75}
          category="modulation-machines"
          ghostValue={ghostOctaves}
          showGhostValue={true}
        />

        <Knob
          label="Center"
          value={baseFrequency}
          onChange={(v) => onChange('baseFrequency', v)}
          min={200}
          max={2000}
          defaultValue={350}
          unit="Hz"
          precision={0}
          size={75}
          logarithmic
          category="modulation-machines"
          ghostValue={ghostBaseFrequency}
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
    </div>
  );
};
