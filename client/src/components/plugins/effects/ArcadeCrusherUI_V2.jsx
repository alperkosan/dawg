/**
 * ARCADECRUSHER UI V2.0
 *
 * Professional bit-crushing with retro arcade aesthetics
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (texture-lab)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - Pixelated waveform visualization
 * - Real-time bit depth quantization display
 * - Professional factory presets (12 presets)
 * - Multiple crushing styles
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// PIXELATED WAVEFORM VISUALIZER
// ============================================================================

class PixelWaveformRenderer {
  constructor() {
    this.waveData = [];
    this.maxPoints = 200;
  }

  addSample(sample, bits, wet) {
    // Quantize sample to simulate bit depth
    const levels = Math.pow(2, Math.max(1, Math.min(bits, 16)));
    const step = 2 / levels;
    const quantized = Math.floor(sample / step) * step;
    
    this.waveData.push({
      sample: quantized,
      wet: wet,
      timestamp: performance.now()
    });

    // Trim old data
    if (this.waveData.length > this.maxPoints) {
      this.waveData.shift();
    }
  }

  draw(ctx, width, height, bits, wet, inputLevel, categoryColors) {
    const now = performance.now();
    const timeWindow = 2000; // 2 seconds

    // Clear with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(20, 15, 10, 0.95)');
    gradient.addColorStop(1, 'rgba(10, 5, 5, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Filter recent data
    const recentData = this.waveData.filter(
      point => now - point.timestamp < timeWindow
    );

    if (recentData.length === 0) return;

    // Draw waveform with pixelation effect
    const centerY = height / 2;
    const numSteps = Math.pow(2, Math.max(1, Math.min(bits, 16)));
    const stepHeight = height / numSteps;
    const pixelSize = Math.max(2, 20 - bits);

    ctx.strokeStyle = `${categoryColors.primary}${Math.round((0.6 + wet * 0.4) * 255).toString(16)}`;
    ctx.lineWidth = pixelSize;
    ctx.lineCap = 'square';

    ctx.beginPath();
    
    // ✅ PERFORMANCE: Optimize for high bit depths
    // For 16-bit, use fewer points to reduce computation
    const stepSize = bits >= 12 ? Math.max(1, Math.floor(recentData.length / 200)) : 1;
    
    for (let i = 0; i < recentData.length; i += stepSize) {
      const point = recentData[i];
      const x = (i / recentData.length) * width;
      
      // Quantize to pixel grid
      const quantizedY = Math.floor((point.sample + 1) / 2 * numSteps) * stepHeight;
      const y = centerY - (quantizedY - centerY);
      
      // Snap to pixel grid
      const pixelY = Math.floor(y / pixelSize) * pixelSize;
      
      if (i === 0) {
        ctx.moveTo(x, pixelY);
      } else {
        ctx.lineTo(x, pixelY);
      }
    }
    
    ctx.stroke();

    // Bit depth label
    ctx.fillStyle = `${categoryColors.primary}CC`;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${bits}-BIT`, width / 2, height / 2);

    // ✅ PERFORMANCE FIX: Skip quantization levels indicator for high bit depths
    // Drawing 65536 lines at 16-bit is extremely expensive
    // Only show levels for bit depths <= 8 (256 lines max)
    if (bits <= 8) {
      ctx.strokeStyle = `${categoryColors.primary}33`;
      ctx.lineWidth = 1;
      const maxLines = Math.min(numSteps, 256); // Cap at 256 lines for performance
      const lineStep = Math.max(1, Math.floor(numSteps / maxLines));
      
      for (let i = 0; i <= numSteps; i += lineStep) {
        const y = (i / numSteps) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (bits <= 12) {
      // For 9-12 bit, show fewer lines (every 16th step)
      ctx.strokeStyle = `${categoryColors.primary}22`;
      ctx.lineWidth = 1;
      const lineStep = 16;
      for (let i = 0; i <= numSteps; i += lineStep) {
        const y = (i / numSteps) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    // For 13-16 bit, skip quantization lines entirely (too expensive)
  }
}

const PixelWaveformVisualizer = ({ bitDepth, wet, inputLevel, trackId, effectId, categoryColors }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(new PixelWaveformRenderer());

  const { isPlaying, getTimeDomainData } = useAudioPlugin(trackId, effectId, {
    fftSize: 512,
    updateMetrics: true
  });

  const drawWaveform = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / dpr;
    const displayHeight = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    if (isPlaying) {
      const timeData = getTimeDomainData();
      if (timeData && timeData.length > 0) {
        // Add samples to renderer
        const sampleRate = timeData.length;
        for (let i = 0; i < sampleRate; i += 4) {
          const sample = timeData[i];
          rendererRef.current.addSample(sample, bitDepth, wet);
        }
      }
    }

    rendererRef.current.draw(ctx, displayWidth, displayHeight, bitDepth, wet, inputLevel, categoryColors);

    ctx.restore();
  }, [bitDepth, wet, inputLevel, isPlaying, getTimeDomainData, categoryColors]);

  // Canvas resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Use CanvasRenderManager
  useRenderer(drawWaveform, 5, 16, [bitDepth, wet, inputLevel, isPlaying]);

  // Container styling
  const containerStyle = {
    background: 'rgba(0, 0, 0, 0.5)',
    borderColor: `${categoryColors.primary}33`,
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[300px] rounded-xl overflow-hidden"
      style={containerStyle}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ArcadeCrusherUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    bitDepth = 8,
    sampleRateReduction = 2,
    crush = 0.5,
    wet = 1.0
  } = effect.settings || {};

  // Local state
  const [localBitDepth, setLocalBitDepth] = useState(bitDepth);
  const [localSampleRateReduction, setLocalSampleRateReduction] = useState(sampleRateReduction);
  const [localCrush, setLocalCrush] = useState(crush);
  const [localWet, setLocalWet] = useState(wet);
  const [inputLevel, setInputLevel] = useState(0.5);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('texture-lab'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Mixer store for parameter changes
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Audio plugin for visualization
  const { metrics } = useAudioPlugin(trackId, effect.id, {
    fftSize: 512,
    updateMetrics: true
  });

  // Update input level from metrics
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel(Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60)));
    } else {
      setInputLevel(0.5); // Fallback
    }
  }, [metrics]);

  // Ghost values for smooth visual feedback
  const ghostBitDepth = useGhostValue(localBitDepth, 400);
  const ghostSampleRateReduction = useGhostValue(localSampleRateReduction, 400);
  const ghostCrush = useGhostValue(localCrush, 400);
  const ghostWet = useGhostValue(localWet, 400);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.bitDepth !== undefined) {
      setLocalBitDepth(effect.settings.bitDepth);
      updates.bitDepth = effect.settings.bitDepth;
    }
    if (effect.settings.sampleRateReduction !== undefined) {
      setLocalSampleRateReduction(effect.settings.sampleRateReduction);
      updates.sampleRateReduction = effect.settings.sampleRateReduction;
    }
    if (effect.settings.crush !== undefined) {
      setLocalCrush(effect.settings.crush);
      updates.crush = effect.settings.crush;
    }
    if (effect.settings.wet !== undefined) {
      setLocalWet(effect.settings.wet);
      updates.wet = effect.settings.wet;
    }

    // Send all parameter updates to worklet immediately
    // Note: Don't call handleMixerEffectChange here - it's already called by PresetManager
    if (Object.keys(updates).length > 0) {
      setParams(updates, { immediate: true });
    }
  }, [effect.settings, effectNode, setParams]);

  // Handle parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });

    // Update local state
    switch (key) {
      case 'bitDepth':
        setLocalBitDepth(value);
        break;
      case 'sampleRateReduction':
        setLocalSampleRateReduction(value);
        break;
      case 'crush':
        setLocalCrush(value);
        break;
      case 'wet':
        setLocalWet(value);
        break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="texture-lab"
    >
      <TwoPanelLayout
        category="texture-lab"

        mainPanel={
          <>
            {/* Pixelated Waveform Visualizer */}
            <PixelWaveformVisualizer
              bitDepth={localBitDepth}
              wet={localWet}
              inputLevel={inputLevel}
              trackId={trackId}
              effectId={effect.id}
              categoryColors={categoryColors}
            />

            {/* Main Controls */}
            <div className="grid grid-cols-4 gap-6 p-6">
              <Knob
                label="BIT DEPTH"
                value={localBitDepth}
                ghostValue={ghostBitDepth}
                onChange={(val) => handleParamChange('bitDepth', Math.round(val))}
                min={1}
                max={16}
                defaultValue={8}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${Math.round(v)}-bit`}
              />

              <Knob
                label="SAMPLE RATE"
                value={localSampleRateReduction}
                ghostValue={ghostSampleRateReduction}
                onChange={(val) => handleParamChange('sampleRateReduction', Math.round(val))}
                min={1}
                max={50}
                defaultValue={2}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${Math.round(v)}x`}
              />

              <Knob
                label="CRUSH"
                value={localCrush}
                ghostValue={ghostCrush}
                onChange={(val) => handleParamChange('crush', val)}
                min={0}
                max={1}
                defaultValue={0.5}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />

              <Knob
                label="MIX"
                value={localWet}
                ghostValue={ghostWet}
                onChange={(val) => handleParamChange('wet', val)}
                min={0}
                max={1}
                defaultValue={1.0}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
            </div>
          </>
        }

        sidePanel={
          <>
            {/* Stats Display */}
            <div 
              className="rounded-xl p-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Processing Info
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Bit Depth</span>
                  <span className="text-[10px] text-white font-mono">{localBitDepth}-bit</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Levels</span>
                  <span className="text-[10px] text-white font-mono">{Math.pow(2, localBitDepth)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Sample Rate</span>
                  <span className="text-[10px] text-white font-mono">{localSampleRateReduction}x</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Mix</span>
                  <span className="text-[10px] text-white font-mono">{(localWet * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default ArcadeCrusherUI_V2;

