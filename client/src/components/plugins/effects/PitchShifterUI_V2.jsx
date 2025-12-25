/**
 * PITCH SHIFTER UI V3.0 - Professional Grade
 *
 * Professional pitch-shifting with harmonic visualization
 *
 * v3.0 New Features:
 * ✅ Formant Shift (-24 to +24 semitones)
 * ✅ Fine Tune (-100 to +100 cents)
 * ✅ Extended Pitch Range (-24 to +24 semitones)
 * ✅ Quality Mode (Fast/Normal/High)
 * ✅ Input/Output Gain Control
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (texture-lab)
 *
 * Features:
 * - Real-time pitch spectrum visualization
 * - Formant shifting for natural vocal pitch changes
 * - Professional factory presets (12 presets)
 * - Multiple pitch intervals
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, Select, ModeSelector } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// PITCH SPECTRUM VISUALIZER
// ============================================================================

class PitchSpectrumRenderer {
  constructor() {
    this.freqData = [];
    this.maxPoints = 100;
  }

  addFrequencyData(data, pitch) {
    this.freqData.push({
      data: [...data],
      pitch: pitch,
      timestamp: performance.now()
    });

    if (this.freqData.length > this.maxPoints) {
      this.freqData.shift();
    }
  }

  draw(ctx, width, height, pitch, wet, inputLevel, categoryColors) {
    const now = performance.now();
    
    // Clear with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(20, 15, 10, 0.95)');
    gradient.addColorStop(1, 'rgba(10, 5, 5, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Calculate pitch shift ratio
    const pitchRatio = Math.pow(2, pitch / 12);
    const fundamentalFreq = 100; // Reference frequency

    // Color based on pitch direction (using categoryColors)
    const baseHue = pitch > 0 ? 30 : 0; // Orange for up, red for down
    const hue = baseHue;
    const saturation = 70 + Math.abs(pitch) * 2;
    const lightness = 50;

    // Draw original spectrum (faded)
    if (this.freqData.length > 0) {
      const latest = this.freqData[this.freqData.length - 1];
      const data = latest.data;
      
      // Original frequency bars
      for (let i = 0; i < Math.min(data.length, width / 2); i++) {
        const x = (i / (width / 2)) * width * 0.4;
        const amplitude = data[i] || 0;
        const barHeight = amplitude * height * 0.3 * (1 - wet);
        
        if (barHeight > 1) {
          ctx.fillStyle = `${categoryColors.primary}4D`;
          ctx.fillRect(x, height / 2 - barHeight / 2, 2, barHeight);
        }
      }

      // Pitch-shifted frequency bars
      const shiftedFreq = fundamentalFreq * pitchRatio;
      for (let i = 0; i < Math.min(data.length, width / 2); i++) {
        const freq = (i / data.length) * 20000;
        const shiftedIndex = Math.floor((freq * pitchRatio) / (20000 / data.length));
        const x = width * 0.6 + (i / (width / 2)) * width * 0.4;
        const amplitude = data[shiftedIndex] || 0;
        const barHeight = amplitude * height * 0.4 * wet * inputLevel;
        
        if (barHeight > 1) {
          ctx.fillStyle = `${categoryColors.secondary}CC`;
          ctx.fillRect(x, height / 2 - barHeight / 2, 2, barHeight);
        }
      }
    }

    // Pitch shift indicator
    const pitchText = pitch > 0 ? `+${pitch.toFixed(1)}st` : `${pitch.toFixed(1)}st`;
    const pitchDisplayY = pitch > 0 ? height * 0.2 : height * 0.8;
    
    ctx.fillStyle = `${categoryColors.primary}CC`;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pitchText, width / 2, pitchDisplayY);

    // Animated pitch shift wave
    ctx.strokeStyle = `${categoryColors.accent}66`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const time = now * 0.001;
    for (let x = 0; x < width; x += 2) {
      const t = (x / width) * Math.PI * 4 + time;
      const offset = Math.sin(t) * pitch * 2;
      const y = height / 2 + offset;
      
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

const PitchSpectrumVisualizer = ({ pitch, wet, inputLevel, trackId, effectId, categoryColors }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(new PitchSpectrumRenderer());

  const { isPlaying, getFrequencyData } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true
  });

  const drawSpectrum = useCallback((timestamp) => {
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
      const freqData = getFrequencyData();
      if (freqData && freqData.length > 0) {
        // Normalize frequency data
        const normalized = freqData.map(val => Math.max(0, Math.min(1, (val + 100) / 100)));
        rendererRef.current.addFrequencyData(normalized, pitch);
      }
    }

    rendererRef.current.draw(ctx, displayWidth, displayHeight, pitch, wet, inputLevel, categoryColors);

    ctx.restore();
  }, [pitch, wet, inputLevel, isPlaying, getFrequencyData, categoryColors]);

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
  useRenderer(drawSpectrum, 5, 16, [pitch, wet, inputLevel, isPlaying]);

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

const PitchShifterUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    pitch = 0,
    fineTune = 0,
    formantShift = 0,
    quality = 1,
    // ✅ NEW: Pitch Algorithm and Formant Preservation
    pitchAlgorithm = 1,
    formantPreservation = 0,
    inputGain = 0,
    outputGain = 0,
    wet = 1.0
  } = effect.settings || {};

  // Local state
  const [localPitch, setLocalPitch] = useState(pitch);
  const [localFineTune, setLocalFineTune] = useState(fineTune);
  const [localFormantShift, setLocalFormantShift] = useState(formantShift);
  const [localQuality, setLocalQuality] = useState(quality);
  // ✅ NEW: Pitch Algorithm and Formant Preservation state
  const [localPitchAlgorithm, setLocalPitchAlgorithm] = useState(pitchAlgorithm);
  const [localFormantPreservation, setLocalFormantPreservation] = useState(formantPreservation);
  const [localInputGain, setLocalInputGain] = useState(inputGain);
  const [localOutputGain, setLocalOutputGain] = useState(outputGain);
  const [localWet, setLocalWet] = useState(wet);
  const [inputLevel, setInputLevel] = useState(0.5);
  const [cpuStats, setCpuStats] = useState(null);
  
  // Calculate auto-optimized window size (for display only)
  const totalPitchForWindow = localPitch + (localFineTune / 100);
  const pitchShiftAmount = Math.abs(totalPitchForWindow);
  const autoWindowSize = useMemo(() => {
    if (pitchShiftAmount > 12) return 0.06;
    if (pitchShiftAmount > 6) return 0.045;
    if (pitchShiftAmount > 2) return 0.035;
    return 0.025;
  }, [pitchShiftAmount]);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('texture-lab'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Mixer store for parameter changes
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Audio plugin for visualization
  const { metrics } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
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

  // ✅ CPU Stats listener
  useEffect(() => {
    if (!effectNode?.workletNode?.port) return;

    const handleMessage = (e) => {
      if (e.data?.type === 'cpuStats') {
        setCpuStats(e.data.stats);
      }
    };

    effectNode.workletNode.port.onmessage = handleMessage;

    return () => {
      if (effectNode?.workletNode?.port) {
        effectNode.workletNode.port.onmessage = null;
      }
    };
  }, [effectNode]);

  // Ghost values for smooth visual feedback
  const ghostPitch = useGhostValue(localPitch, 400);
  const ghostFormantShift = useGhostValue(localFormantShift, 400);
  const ghostWet = useGhostValue(localWet, 400);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.pitch !== undefined) {
      setLocalPitch(effect.settings.pitch);
      updates.pitch = effect.settings.pitch;
    }
    if (effect.settings.fineTune !== undefined) {
      setLocalFineTune(effect.settings.fineTune);
      updates.fineTune = effect.settings.fineTune;
    }
    if (effect.settings.formantShift !== undefined) {
      setLocalFormantShift(effect.settings.formantShift);
      updates.formantShift = effect.settings.formantShift;
    }
    if (effect.settings.quality !== undefined) {
      setLocalQuality(effect.settings.quality);
      updates.quality = effect.settings.quality;
    }
    // ✅ NEW: Pitch Algorithm and Formant Preservation
    if (effect.settings.pitchAlgorithm !== undefined) {
      setLocalPitchAlgorithm(effect.settings.pitchAlgorithm);
      updates.pitchAlgorithm = effect.settings.pitchAlgorithm;
    }
    if (effect.settings.formantPreservation !== undefined) {
      setLocalFormantPreservation(effect.settings.formantPreservation);
      updates.formantPreservation = effect.settings.formantPreservation;
    }
    if (effect.settings.inputGain !== undefined) {
      setLocalInputGain(effect.settings.inputGain);
      updates.inputGain = effect.settings.inputGain;
    }
    if (effect.settings.outputGain !== undefined) {
      setLocalOutputGain(effect.settings.outputGain);
      updates.outputGain = effect.settings.outputGain;
    }
    if (effect.settings.wet !== undefined) {
      setLocalWet(effect.settings.wet);
      updates.wet = effect.settings.wet;
    }

    // Send all parameter updates to worklet immediately
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
      case 'pitch':
        setLocalPitch(value);
        break;
      case 'fineTune':
        setLocalFineTune(value);
        break;
      case 'formantShift':
        setLocalFormantShift(value);
        break;
      case 'quality':
        setLocalQuality(value);
        break;
      // ✅ NEW: Pitch Algorithm and Formant Preservation
      case 'pitchAlgorithm':
        setLocalPitchAlgorithm(value);
        break;
      case 'formantPreservation':
        setLocalFormantPreservation(value);
        // When formant preservation is enabled, disable manual formant shift
        if (value > 0.5) {
          setLocalFormantShift(0);
          setParam('formantShift', 0);
        }
        break;
      case 'inputGain':
        setLocalInputGain(value);
        break;
      case 'outputGain':
        setLocalOutputGain(value);
        break;
      case 'wet':
        setLocalWet(value);
        break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  // Calculate frequency ratio for display (pitch + fine tune)
  const totalPitch = localPitch + (localFineTune / 100);
  const frequencyRatio = useMemo(() => Math.pow(2, totalPitch / 12), [totalPitch]);
  
  const qualityOptions = [
    { value: 0, label: 'Fast' },
    { value: 1, label: 'Normal' },
    { value: 2, label: 'High' }
  ];

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
            {/* Pitch Spectrum Visualizer */}
            <PitchSpectrumVisualizer
              pitch={localPitch}
              wet={localWet}
              inputLevel={inputLevel}
              trackId={trackId}
              effectId={effect.id}
              categoryColors={categoryColors}
            />

            {/* Main Controls */}
            <div className="grid grid-cols-4 gap-4 p-6">
              <Knob
                label="PITCH"
                value={localPitch}
                ghostValue={ghostPitch}
                onChange={(val) => handleParamChange('pitch', val)}
                min={-24}
                max={24}
                defaultValue={0}
                step={1}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => {
                  if (v > 0) return `+${v.toFixed(0)}st`;
                  if (v < 0) return `${v.toFixed(0)}st`;
                  return '0st';
                }}
              />

              <Knob
                label="FINE TUNE"
                value={localFineTune}
                onChange={(val) => handleParamChange('fineTune', val)}
                min={-100}
                max={100}
                defaultValue={0}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => {
                  if (v > 0) return `+${v.toFixed(0)}¢`;
                  if (v < 0) return `${v.toFixed(0)}¢`;
                  return '0¢';
                }}
              />

              <Knob
                label="FORMANT"
                value={localFormantShift}
                ghostValue={ghostFormantShift}
                onChange={(val) => handleParamChange('formantShift', val)}
                min={-24}
                max={24}
                defaultValue={0}
                sizeVariant="medium"
                category="texture-lab"
                disabled={localFormantPreservation > 0.5}
                valueFormatter={(v) => {
                  if (localFormantPreservation > 0.5) return 'AUTO';
                  if (v > 0) return `+${v.toFixed(0)}st`;
                  if (v < 0) return `${v.toFixed(0)}st`;
                  return '0st';
                }}
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

            {/* ✅ NEW: Algorithm & Formant Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#1e1b4b]/30 rounded-xl p-4 border border-[#64c8ff]/20">
              <div className="text-[9px] text-[#64c8ff]/70 font-bold uppercase tracking-wider mb-3">ALGORITHM & FORMANT</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold tracking-wider uppercase" style={{ color: categoryColors.secondary }}>
                    PITCH ALGORITHM
                  </label>
                  <ModeSelector
                    modes={[
                      { id: 0, name: 'PSOLA', description: 'Fast, low CPU, good for real-time' },
                      { id: 1, name: 'Phase Vocoder', description: 'High quality, FFT-based, zero artifacts' },
                      { id: 2, name: 'Elastique-like', description: 'Smooth time-stretching, professional quality' }
                    ]}
                    activeMode={localPitchAlgorithm}
                    onChange={(mode) => handleParamChange('pitchAlgorithm', mode)}
                    category="texture-lab"
                    compact={true}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold tracking-wider uppercase flex items-center justify-between" style={{ color: categoryColors.secondary }}>
                    <span>FORMANT PRESERVATION</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localFormantPreservation > 0.5}
                        onChange={(e) => handleParamChange('formantPreservation', e.target.checked ? 1 : 0)}
                        className="w-4 h-4 rounded border-[#64c8ff]/30 bg-black/50 checked:bg-[#64c8ff] checked:border-[#64c8ff] focus:ring-2 focus:ring-[#64c8ff]/50"
                      />
                      <span className="text-[8px] text-white/70">ENABLED</span>
                    </label>
                  </label>
                  <div className="text-[8px] text-white/50 mt-1">
                    {localFormantPreservation > 0.5 
                      ? 'Automatically preserves vocal character when pitch shifting'
                      : 'Manual formant control'}
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Controls */}
            <div className="grid grid-cols-3 gap-4 p-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold tracking-wider uppercase text-center" style={{ color: categoryColors.secondary }}>
                  QUALITY
                </label>
                <Select
                  value={localQuality.toString()}
                  onChange={(val) => handleParamChange('quality', parseInt(val))}
                  options={qualityOptions}
                  category="texture-lab"
                  className="w-full"
                />
              </div>

              <Knob
                label="INPUT GAIN"
                value={localInputGain}
                onChange={(val) => handleParamChange('inputGain', val)}
                min={-24}
                max={24}
                defaultValue={0}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => {
                  if (v > 0) return `+${v.toFixed(1)}dB`;
                  if (v < 0) return `${v.toFixed(1)}dB`;
                  return '0dB';
                }}
              />

              <Knob
                label="OUTPUT GAIN"
                value={localOutputGain}
                onChange={(val) => handleParamChange('outputGain', val)}
                min={-24}
                max={24}
                defaultValue={0}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => {
                  if (v > 0) return `+${v.toFixed(1)}dB`;
                  if (v < 0) return `${v.toFixed(1)}dB`;
                  return '0dB';
                }}
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
                Pitch Info
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Pitch Shift</span>
                  <span className="text-[10px] text-white font-mono">
                    {totalPitch > 0 ? '+' : ''}{totalPitch.toFixed(2)}st
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Fine Tune</span>
                  <span className="text-[10px] text-white font-mono">
                    {localFineTune > 0 ? '+' : ''}{localFineTune.toFixed(0)}¢
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Formant</span>
                  <span className="text-[10px] text-white font-mono">
                    {localFormantShift > 0 ? '+' : ''}{localFormantShift.toFixed(0)}st
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Frequency Ratio</span>
                  <span className="text-[10px] text-white font-mono">{frequencyRatio.toFixed(3)}x</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Quality</span>
                  <span className="text-[10px] text-white font-mono">{qualityOptions[localQuality]?.label || 'Normal'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Window Size</span>
                  <span className="text-[10px] text-white/40 font-mono italic">{(autoWindowSize * 1000).toFixed(0)}ms (auto)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Input Gain</span>
                  <span className="text-[10px] text-white font-mono">
                    {localInputGain > 0 ? '+' : ''}{localInputGain.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Output Gain</span>
                  <span className="text-[10px] text-white font-mono">
                    {localOutputGain > 0 ? '+' : ''}{localOutputGain.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Mix</span>
                  <span className="text-[10px] text-white font-mono">{(localWet * 100).toFixed(0)}%</span>
                </div>
                {cpuStats && (
                  <>
                    <div className="border-t border-white/10 pt-2.5 mt-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: categoryColors.secondary }}>
                        CPU Usage
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-white/60">Algorithm</span>
                          <span className="text-[10px] text-white font-mono">
                            {localQuality === 2 ? 'Phase Vocoder' : 'PSOLA'}
                          </span>
                        </div>
                        {localQuality === 2 && cpuStats.avgVocoderTime && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-white/60">Avg Time</span>
                            <span className="text-[10px] text-white font-mono">
                              {cpuStats.avgVocoderTime.toFixed(2)}μs
                            </span>
                          </div>
                        )}
                        {localQuality < 2 && cpuStats.avgPsolaTime && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-white/60">Avg Time</span>
                            <span className="text-[10px] text-white font-mono">
                              {cpuStats.avgPsolaTime.toFixed(2)}μs
                            </span>
                          </div>
                        )}
                        {cpuStats.vocoderUsage !== undefined && localQuality === 2 && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-white/60">Block Usage</span>
                            <span className="text-[10px] text-white font-mono" style={{
                              color: cpuStats.vocoderUsage > 50 ? '#ff4444' : cpuStats.vocoderUsage > 25 ? '#ffaa00' : categoryColors.primary
                            }}>
                              {cpuStats.vocoderUsage.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {cpuStats.psolaUsage !== undefined && localQuality < 2 && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-white/60">Block Usage</span>
                            <span className="text-[10px] text-white font-mono" style={{
                              color: cpuStats.psolaUsage > 50 ? '#ff4444' : cpuStats.psolaUsage > 25 ? '#ffaa00' : categoryColors.primary
                            }}>
                              {cpuStats.psolaUsage.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default PitchShifterUI_V2;

