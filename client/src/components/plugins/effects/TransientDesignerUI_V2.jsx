/**
 * TRANSIENT DESIGNER UI V2.0
 *
 * Professional transient shaping with envelope visualization
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (dynamics-forge)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - Real-time waveform and envelope visualization
 * - Bipolar attack/sustain controls (-12dB to +12dB)
 * - Professional factory presets (11 presets)
 * - Precise transient shaping
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { LinearSlider, ModeSelector, Knob } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// WAVEFORM VISUALIZER
// ============================================================================

class WaveformRenderer {
  constructor() {
    this.waveformBuffer = new Array(200).fill(0);
    this.envelopeBuffer = new Array(200).fill(0);
    this.lastUpdate = 0;
  }

  updateBuffers(timeData) {
    const now = performance.now();
    if (now - this.lastUpdate > 33) {
      const step = Math.floor(timeData.length / 200);
      for (let i = 0; i < 200; i++) {
        const idx = i * step;
        this.waveformBuffer[i] = timeData[idx] || 0;

        const absValue = Math.abs(this.waveformBuffer[i]);
        if (i === 0) {
          this.envelopeBuffer[i] = absValue;
        } else {
          const attack = 0.3;
          const release = 0.05;
          const coeff = absValue > this.envelopeBuffer[i - 1] ? attack : release;
          this.envelopeBuffer[i] = this.envelopeBuffer[i - 1] * (1 - coeff) + absValue * coeff;
        }
      }
      this.lastUpdate = now;
    }
  }

  draw(ctx, width, height, attackAmount, sustainAmount, isPlaying, categoryColors) {
    // Clear with fade
    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, width, height);

    const centerY = height / 2;
    const dataPoints = this.waveformBuffer;
    const stepX = width / dataPoints.length;

    if (!isPlaying) {
      ctx.strokeStyle = `${categoryColors.primary}4D`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      return;
    }

    // Draw waveform (original)
    ctx.strokeStyle = `${categoryColors.primary}66`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < dataPoints.length; i++) {
      const x = i * stepX;
      const y = centerY - (dataPoints[i] * centerY * 0.8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw envelope
    ctx.strokeStyle = `${categoryColors.secondary}CC`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.envelopeBuffer.length; i++) {
      const x = i * stepX;
      const y = centerY - (this.envelopeBuffer[i] * centerY * 0.8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw processed waveform preview
    const attackMultiplier = 1 + (attackAmount / 12);
    const sustainMultiplier = 1 + (sustainAmount / 12);
    
    ctx.strokeStyle = `${categoryColors.accent}FF`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < dataPoints.length; i++) {
      const x = i * stepX;
      const value = dataPoints[i];
      const isTransient = i < dataPoints.length * 0.1 || this.envelopeBuffer[i] > 0.5;
      const processedValue = value * (isTransient ? attackMultiplier : sustainMultiplier);
      const y = centerY - (processedValue * centerY * 0.8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

const WaveformVisualizer = ({ trackId, effectId, attackAmount, sustainAmount, categoryColors }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(new WaveformRenderer());

  const { isPlaying, getTimeDomainData } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: false
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
        rendererRef.current.updateBuffers(timeData);
      }
    }

    rendererRef.current.draw(ctx, displayWidth, displayHeight, attackAmount, sustainAmount, isPlaying, categoryColors);

    ctx.restore();
  }, [attackAmount, sustainAmount, isPlaying, getTimeDomainData, categoryColors]);

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
  useRenderer(drawWaveform, 5, 33, [attackAmount, sustainAmount, isPlaying]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[300px] rounded-xl overflow-hidden"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        borderColor: `${categoryColors.primary}33`,
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TransientDesignerUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    attack = 0,
    sustain = 0,
    mix = 1.0,
    // ✅ NEW: Frequency Targeting
    frequencyTargeting = 0,
    lowAttack = 0,
    lowSustain = 0,
    midAttack = 0,
    midSustain = 0,
    highAttack = 0,
    highSustain = 0,
    lowCrossover = 200,
    highCrossover = 5000
  } = effect.settings || {};

  // Local state
  const [localAttack, setLocalAttack] = useState(attack);
  const [localSustain, setLocalSustain] = useState(sustain);
  const [localMix, setLocalMix] = useState(mix);
  // ✅ NEW: Frequency Targeting state
  const [localFrequencyTargeting, setLocalFrequencyTargeting] = useState(frequencyTargeting);
  const [localLowAttack, setLocalLowAttack] = useState(lowAttack);
  const [localLowSustain, setLocalLowSustain] = useState(lowSustain);
  const [localMidAttack, setLocalMidAttack] = useState(midAttack);
  const [localMidSustain, setLocalMidSustain] = useState(midSustain);
  const [localHighAttack, setLocalHighAttack] = useState(highAttack);
  const [localHighSustain, setLocalHighSustain] = useState(highSustain);
  const [localLowCrossover, setLocalLowCrossover] = useState(lowCrossover);
  const [localHighCrossover, setLocalHighCrossover] = useState(highCrossover);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('dynamics-forge'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Mixer store for parameter changes
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ghost values for smooth visual feedback
  const ghostAttack = useGhostValue(localAttack, 400);
  const ghostSustain = useGhostValue(localSustain, 400);
  const ghostMix = useGhostValue(localMix * 100, 400);
  // ✅ NEW: Frequency Targeting ghost values
  const ghostLowAttack = useGhostValue(localLowAttack, 400);
  const ghostLowSustain = useGhostValue(localLowSustain, 400);
  const ghostMidAttack = useGhostValue(localMidAttack, 400);
  const ghostMidSustain = useGhostValue(localMidSustain, 400);
  const ghostHighAttack = useGhostValue(localHighAttack, 400);
  const ghostHighSustain = useGhostValue(localHighSustain, 400);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.attack !== undefined) {
      setLocalAttack(effect.settings.attack);
      updates.attack = effect.settings.attack;
    }
    if (effect.settings.sustain !== undefined) {
      setLocalSustain(effect.settings.sustain);
      updates.sustain = effect.settings.sustain;
    }
    if (effect.settings.mix !== undefined) {
      setLocalMix(effect.settings.mix);
      updates.mix = effect.settings.mix;
    }
    // ✅ NEW: Frequency Targeting
    if (effect.settings.frequencyTargeting !== undefined) {
      setLocalFrequencyTargeting(effect.settings.frequencyTargeting);
      updates.frequencyTargeting = effect.settings.frequencyTargeting;
    }
    if (effect.settings.lowAttack !== undefined) {
      setLocalLowAttack(effect.settings.lowAttack);
      updates.lowAttack = effect.settings.lowAttack;
    }
    if (effect.settings.lowSustain !== undefined) {
      setLocalLowSustain(effect.settings.lowSustain);
      updates.lowSustain = effect.settings.lowSustain;
    }
    if (effect.settings.midAttack !== undefined) {
      setLocalMidAttack(effect.settings.midAttack);
      updates.midAttack = effect.settings.midAttack;
    }
    if (effect.settings.midSustain !== undefined) {
      setLocalMidSustain(effect.settings.midSustain);
      updates.midSustain = effect.settings.midSustain;
    }
    if (effect.settings.highAttack !== undefined) {
      setLocalHighAttack(effect.settings.highAttack);
      updates.highAttack = effect.settings.highAttack;
    }
    if (effect.settings.highSustain !== undefined) {
      setLocalHighSustain(effect.settings.highSustain);
      updates.highSustain = effect.settings.highSustain;
    }
    if (effect.settings.lowCrossover !== undefined) {
      setLocalLowCrossover(effect.settings.lowCrossover);
      updates.lowCrossover = effect.settings.lowCrossover;
    }
    if (effect.settings.highCrossover !== undefined) {
      setLocalHighCrossover(effect.settings.highCrossover);
      updates.highCrossover = effect.settings.highCrossover;
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
      case 'attack':
        setLocalAttack(value);
        break;
      case 'sustain':
        setLocalSustain(value);
        break;
      case 'mix':
        setLocalMix(value);
        break;
      // ✅ NEW: Frequency Targeting
      case 'frequencyTargeting':
        setLocalFrequencyTargeting(value);
        break;
      case 'lowAttack':
        setLocalLowAttack(value);
        break;
      case 'lowSustain':
        setLocalLowSustain(value);
        break;
      case 'midAttack':
        setLocalMidAttack(value);
        break;
      case 'midSustain':
        setLocalMidSustain(value);
        break;
      case 'highAttack':
        setLocalHighAttack(value);
        break;
      case 'highSustain':
        setLocalHighSustain(value);
        break;
      case 'lowCrossover':
        setLocalLowCrossover(value);
        break;
      case 'highCrossover':
        setLocalHighCrossover(value);
        break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="dynamics-forge"
    >
      <TwoPanelLayout
        category="dynamics-forge"

        mainPanel={
          <>
            {/* Waveform Visualizer */}
            <WaveformVisualizer
              trackId={trackId}
              effectId={effect.id}
              attackAmount={localAttack}
              sustainAmount={localSustain}
              categoryColors={categoryColors}
            />

            {/* Main Controls */}
            <div className="space-y-6 p-6">
              {/* ✅ NEW: Frequency Targeting Mode Selector */}
              <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-4 border border-[#00A8E8]/20">
                <div className="text-[9px] text-[#00B8F8]/70 font-bold uppercase tracking-wider mb-3">
                  FREQUENCY TARGETING
                </div>
                <ModeSelector
                  modes={[
                    { id: 0, name: 'Full', description: 'Process full frequency spectrum' },
                    { id: 1, name: 'Low', description: 'Process low frequencies only' },
                    { id: 2, name: 'Mid', description: 'Process mid frequencies only' },
                    { id: 3, name: 'High', description: 'Process high frequencies only' }
                  ]}
                  activeMode={localFrequencyTargeting}
                  onChange={(mode) => handleParamChange('frequencyTargeting', mode)}
                  category="dynamics-forge"
                  compact={true}
                />
              </div>

              {/* Full Band Controls (when frequencyTargeting === 0) */}
              {localFrequencyTargeting === 0 && (
                <>
                  {/* Attack Slider (Bipolar) */}
                  <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label 
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: categoryColors.secondary }}
                  >
                    ATTACK
                  </label>
                  <span 
                    className="text-xs font-mono font-bold"
                    style={{ 
                      color: localAttack >= 0 ? categoryColors.accent : '#ef4444' 
                    }}
                  >
                    {localAttack > 0 ? '+' : ''}{localAttack.toFixed(1)}dB
                  </span>
                </div>
                <LinearSlider
                  value={localAttack}
                  ghostValue={ghostAttack}
                  onChange={(val) => handleParamChange('attack', val)}
                  min={-12}
                  max={12}
                  defaultValue={0}
                  category="dynamics-forge"
                  bipolar={true}
                />
              </div>

              {/* Sustain Slider (Bipolar) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label 
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: categoryColors.secondary }}
                  >
                    SUSTAIN
                  </label>
                  <span 
                    className="text-xs font-mono font-bold"
                    style={{ 
                      color: localSustain >= 0 ? '#f59e0b' : '#ef4444' 
                    }}
                  >
                    {localSustain > 0 ? '+' : ''}{localSustain.toFixed(1)}dB
                  </span>
                </div>
                <LinearSlider
                  value={localSustain}
                  ghostValue={ghostSustain}
                  onChange={(val) => handleParamChange('sustain', val)}
                  min={-12}
                  max={12}
                  defaultValue={0}
                  category="dynamics-forge"
                  bipolar={true}
                />
              </div>

              {/* Mix Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label 
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: categoryColors.secondary }}
                  >
                    MIX
                  </label>
                  <span 
                    className="text-xs font-mono font-bold"
                    style={{ color: categoryColors.primary }}
                  >
                    {(localMix * 100).toFixed(0)}%
                  </span>
                </div>
                <LinearSlider
                  value={localMix * 100}
                  ghostValue={ghostMix}
                  onChange={(val) => handleParamChange('mix', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={100}
                  category="dynamics-forge"
                />
              </div>
                </>
              )}

              {/* ✅ NEW: Frequency Band Controls */}
              {localFrequencyTargeting > 0 && (
                <div className="space-y-4">
                  {/* Crossover Controls */}
                  <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-4 border border-[#00A8E8]/20">
                    <div className="text-[9px] text-[#00B8F8]/70 font-bold uppercase tracking-wider mb-3">
                      CROSSOVER FREQUENCIES
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Knob
                        label="LOW"
                        value={localLowCrossover}
                        onChange={(val) => handleParamChange('lowCrossover', val)}
                        min={50}
                        max={1000}
                        defaultValue={200}
                        logarithmic
                        category="dynamics-forge"
                        valueFormatter={(v) => `${v < 1000 ? v.toFixed(0) : (v / 1000).toFixed(1) + 'k'}Hz`}
                      />
                      <Knob
                        label="HIGH"
                        value={localHighCrossover}
                        onChange={(val) => handleParamChange('highCrossover', val)}
                        min={2000}
                        max={15000}
                        defaultValue={5000}
                        logarithmic
                        category="dynamics-forge"
                        valueFormatter={(v) => `${(v / 1000).toFixed(1)}kHz`}
                      />
                    </div>
                  </div>

                  {/* Band-specific Controls */}
                  {(localFrequencyTargeting === 1 || localFrequencyTargeting === 0) && (
                    <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-4 border border-[#00A8E8]/20">
                      <div className="text-[9px] text-[#00B8F8]/70 font-bold uppercase tracking-wider mb-3">
                        LOW BAND
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: categoryColors.secondary }}>
                              ATTACK
                            </label>
                            <span className="text-xs font-mono font-bold" style={{ color: localLowAttack >= 0 ? categoryColors.accent : '#ef4444' }}>
                              {localLowAttack > 0 ? '+' : ''}{localLowAttack.toFixed(1)}dB
                            </span>
                          </div>
                          <LinearSlider
                            value={localLowAttack}
                            ghostValue={ghostLowAttack}
                            onChange={(val) => handleParamChange('lowAttack', val)}
                            min={-12}
                            max={12}
                            defaultValue={0}
                            category="dynamics-forge"
                            bipolar={true}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: categoryColors.secondary }}>
                              SUSTAIN
                            </label>
                            <span className="text-xs font-mono font-bold" style={{ color: localLowSustain >= 0 ? '#f59e0b' : '#ef4444' }}>
                              {localLowSustain > 0 ? '+' : ''}{localLowSustain.toFixed(1)}dB
                            </span>
                          </div>
                          <LinearSlider
                            value={localLowSustain}
                            ghostValue={ghostLowSustain}
                            onChange={(val) => handleParamChange('lowSustain', val)}
                            min={-12}
                            max={12}
                            defaultValue={0}
                            category="dynamics-forge"
                            bipolar={true}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {(localFrequencyTargeting === 2 || localFrequencyTargeting === 0) && (
                    <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-4 border border-[#00A8E8]/20">
                      <div className="text-[9px] text-[#00B8F8]/70 font-bold uppercase tracking-wider mb-3">
                        MID BAND
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: categoryColors.secondary }}>
                              ATTACK
                            </label>
                            <span className="text-xs font-mono font-bold" style={{ color: localMidAttack >= 0 ? categoryColors.accent : '#ef4444' }}>
                              {localMidAttack > 0 ? '+' : ''}{localMidAttack.toFixed(1)}dB
                            </span>
                          </div>
                          <LinearSlider
                            value={localMidAttack}
                            ghostValue={ghostMidAttack}
                            onChange={(val) => handleParamChange('midAttack', val)}
                            min={-12}
                            max={12}
                            defaultValue={0}
                            category="dynamics-forge"
                            bipolar={true}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: categoryColors.secondary }}>
                              SUSTAIN
                            </label>
                            <span className="text-xs font-mono font-bold" style={{ color: localMidSustain >= 0 ? '#f59e0b' : '#ef4444' }}>
                              {localMidSustain > 0 ? '+' : ''}{localMidSustain.toFixed(1)}dB
                            </span>
                          </div>
                          <LinearSlider
                            value={localMidSustain}
                            ghostValue={ghostMidSustain}
                            onChange={(val) => handleParamChange('midSustain', val)}
                            min={-12}
                            max={12}
                            defaultValue={0}
                            category="dynamics-forge"
                            bipolar={true}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {(localFrequencyTargeting === 3 || localFrequencyTargeting === 0) && (
                    <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-4 border border-[#00A8E8]/20">
                      <div className="text-[9px] text-[#00B8F8]/70 font-bold uppercase tracking-wider mb-3">
                        HIGH BAND
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: categoryColors.secondary }}>
                              ATTACK
                            </label>
                            <span className="text-xs font-mono font-bold" style={{ color: localHighAttack >= 0 ? categoryColors.accent : '#ef4444' }}>
                              {localHighAttack > 0 ? '+' : ''}{localHighAttack.toFixed(1)}dB
                            </span>
                          </div>
                          <LinearSlider
                            value={localHighAttack}
                            ghostValue={ghostHighAttack}
                            onChange={(val) => handleParamChange('highAttack', val)}
                            min={-12}
                            max={12}
                            defaultValue={0}
                            category="dynamics-forge"
                            bipolar={true}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: categoryColors.secondary }}>
                              SUSTAIN
                            </label>
                            <span className="text-xs font-mono font-bold" style={{ color: localHighSustain >= 0 ? '#f59e0b' : '#ef4444' }}>
                              {localHighSustain > 0 ? '+' : ''}{localHighSustain.toFixed(1)}dB
                            </span>
                          </div>
                          <LinearSlider
                            value={localHighSustain}
                            ghostValue={ghostHighSustain}
                            onChange={(val) => handleParamChange('highSustain', val)}
                            min={-12}
                            max={12}
                            defaultValue={0}
                            category="dynamics-forge"
                            bipolar={true}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mix Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label 
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: categoryColors.secondary }}
                      >
                        MIX
                      </label>
                      <span 
                        className="text-xs font-mono font-bold"
                        style={{ color: categoryColors.primary }}
                      >
                        {(localMix * 100).toFixed(0)}%
                      </span>
                    </div>
                    <LinearSlider
                      value={localMix * 100}
                      ghostValue={ghostMix}
                      onChange={(val) => handleParamChange('mix', val / 100)}
                      min={0}
                      max={100}
                      defaultValue={100}
                      category="dynamics-forge"
                    />
                  </div>
                </div>
              )}
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
                  <span className="text-[10px] text-white/60">Attack</span>
                  <span 
                    className="text-[10px] font-mono"
                    style={{ 
                      color: localAttack >= 0 ? categoryColors.accent : '#ef4444' 
                    }}
                  >
                    {localAttack > 0 ? '+' : ''}{localAttack.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Sustain</span>
                  <span 
                    className="text-[10px] font-mono"
                    style={{ 
                      color: localSustain >= 0 ? '#f59e0b' : '#ef4444' 
                    }}
                  >
                    {localSustain > 0 ? '+' : ''}{localSustain.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Mix</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {(localMix * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Info Panel */}
            <div 
              className="rounded-xl p-4 mt-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                How It Works
              </div>
              <div className="space-y-2 text-[10px] text-white/70 leading-relaxed">
                <div>
                  <span style={{ color: categoryColors.accent }} className="font-bold">Attack:</span> Shape initial transient hit
                </div>
                <div>
                  <span style={{ color: '#f59e0b' }} className="font-bold">Sustain:</span> Control body and tail
                </div>
                <div>
                  <span style={{ color: categoryColors.primary }} className="font-bold">Mix:</span> Blend dry/wet signal
                </div>
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default TransientDesignerUI_V2;

