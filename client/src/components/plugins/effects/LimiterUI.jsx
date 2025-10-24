/**
 * LimiterUI - Professional Mastering-Grade Limiter
 * Inspired by FabFilter Pro-L 2, Waves L2, iZotope Ozone Maximizer
 *
 * Features:
 * - True Peak limiting with inter-sample detection
 * - Lookahead buffer for artifact-free limiting
 * - Multiple mode profiles (Transparent, Punchy, Aggressive, Modern, Vintage)
 * - Brick wall / Soft knee options
 * - Stereo linking control
 * - Real-time gain reduction metering
 * - Waveform visualization with ceiling display
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';
import { Knob, Button, Toggle, ModeSelector } from '@/components/controls';
import { createPresetManager } from '@/lib/audio/PresetManager';

// Limiter mode profiles
const LIMITER_MODES = {
  TRANSPARENT: { id: 0, name: 'TRANSPARENT', description: 'Pristine mastering' },
  PUNCHY: { id: 1, name: 'PUNCHY', description: 'Drum-friendly' },
  AGGRESSIVE: { id: 2, name: 'AGGRESSIVE', description: 'Maximum loudness' },
  MODERN: { id: 3, name: 'MODERN', description: 'Streaming optimized' },
  VINTAGE: { id: 4, name: 'VINTAGE', description: 'Analog-style' }
};

// Factory presets
const FACTORY_PRESETS = [
  {
    id: 'transparent-master',
    name: 'Transparent Master',
    category: 'Mastering',
    parameters: {
      ceiling: -0.1,
      release: 500,
      attack: 0.1,
      lookahead: 10,
      knee: 0.3,
      stereoLink: 100,
      autoGain: 0,
      mode: 0,
      truePeak: 1,
      oversample: 4
    },
    description: 'Pristine transparent limiting for mastering'
  },
  {
    id: 'punchy-drums',
    name: 'Punchy Drums',
    category: 'Mixing',
    parameters: {
      ceiling: -0.5,
      release: 100,
      attack: 1.0,
      lookahead: 5,
      knee: 0,
      stereoLink: 100,
      autoGain: 0,
      mode: 1,
      truePeak: 1,
      oversample: 2
    },
    description: 'Fast limiting that preserves punch'
  },
  {
    id: 'aggressive-loud',
    name: 'Aggressive Loud',
    category: 'Creative',
    parameters: {
      ceiling: -0.1,
      release: 50,
      attack: 0.01,
      lookahead: 2,
      knee: 0,
      stereoLink: 100,
      autoGain: 1,
      mode: 2,
      truePeak: 1,
      oversample: 4
    },
    description: 'Maximum loudness with fast recovery'
  },
  {
    id: 'streaming-ready',
    name: 'Streaming Ready',
    category: 'Mastering',
    parameters: {
      ceiling: -1.0,
      release: 200,
      attack: 0.5,
      lookahead: 8,
      knee: 0.3,
      stereoLink: 100,
      autoGain: 0,
      mode: 3,
      truePeak: 1,
      oversample: 4
    },
    description: 'Optimized for Spotify/Apple Music (-1dB TP)'
  },
  {
    id: 'vintage-soft',
    name: 'Vintage Soft',
    category: 'Creative',
    parameters: {
      ceiling: -0.5,
      release: 300,
      attack: 5.0,
      lookahead: 0,
      knee: 0.5,
      stereoLink: 100,
      autoGain: 0,
      mode: 4,
      truePeak: 0,
      oversample: 1
    },
    description: 'Analog-style soft limiting'
  }
];

const presetManager = createPresetManager('limiter', FACTORY_PRESETS);

/**
 * Limiter Visualizer - Shows waveform with ceiling and gain reduction
 */
const LimiterVisualizer = ({ trackId, effectId, ceiling, mode }) => {
  const { isPlaying, getTimeDomainData, metricsDb, plugin } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.2
  });

  const [meteringData, setMeteringData] = useState({
    grPeak: 0,
    grAverage: 0,
    envelopeLeft: 0,
    envelopeRight: 0
  });

  const drawVisualization = useCallback((ctx, width, height) => {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!isPlaying) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '14px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LIMITER - Ready', width / 2, height / 2);
      return;
    }

    // Get waveform data
    const timeData = getTimeDomainData();
    if (!timeData) return;

    // Draw ceiling line
    const ceilingLinear = Math.pow(10, ceiling / 20);
    const ceilingY = height / 2 - (ceilingLinear * height / 2);
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, ceilingY);
    ctx.lineTo(width, ceilingY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw waveform
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i];
      const y = (v + 1) * height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    // Status text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px "Geist Mono", monospace';
    ctx.textAlign = 'left';

    const isLimiting = meteringData.grPeak < -0.1;
    const statusColor = isLimiting ? '#E74C3C' : '#00D9FF';
    ctx.fillStyle = statusColor;
    ctx.fillText(isLimiting ? '🔴 LIMITING' : '⚪ READY', 10, 20);

    // Gain reduction display
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(`GR: ${meteringData.grPeak.toFixed(1)}dB peak`, width - 10, 20);

    // Ceiling label
    ctx.fillStyle = '#E74C3C';
    ctx.textAlign = 'center';
    ctx.fillText(`Ceiling: ${ceiling.toFixed(1)}dB`, width / 2, ceilingY - 5);

  }, [isPlaying, getTimeDomainData, ceiling, meteringData]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawVisualization,
    [ceiling, mode, isPlaying, meteringData]
  );

  // Listen for metering data from worklet
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (e) => {
      if (e.data.type === 'metering') {
        setMeteringData(e.data.data);
      }
    };

    audioNode.port.onmessage = handleMessage;
    return () => {
      if (audioNode?.port) {
        audioNode.port.onmessage = null;
      }
    };
  }, [plugin]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '180px', marginBottom: '20px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

/**
 * Main Limiter UI Component
 */
export function LimiterUI({ trackId, effect, onChange }) {
  const {
    ceiling = -0.1,
    release = 100,
    attack = 0.1,
    lookahead = 5,
    knee = 0,
    stereoLink = 100,
    autoGain = 0,
    mode = 0,
    truePeak = 1,
    oversample = 4
  } = effect.settings;

  // Ghost values for visual feedback
  const ghostCeiling = useGhostValue(ceiling, 400);
  const ghostRelease = useGhostValue(release, 400);
  const ghostLookahead = useGhostValue(lookahead, 400);

  // Preset management
  const [selectedPresetId, setSelectedPresetId] = useState('transparent-master');
  const presetsByCategory = useMemo(() => presetManager.getPresetsByCategory(), []);

  // Preset handlers
  const handlePresetChange = useCallback((presetId) => {
    presetManager.applyPreset(presetId, (presetParams) => {
      Object.entries(presetParams).forEach(([key, value]) => {
        onChange(key, value);
      });
      setSelectedPresetId(presetId);
    });
  }, [onChange]);

  return (
    <div style={{
      width: '100%',
      padding: '20px',
      backgroundColor: '#0f1419',
      borderRadius: '8px',
      fontFamily: '"Geist Mono", monospace'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#4A90E2', margin: 0, fontSize: '18px', fontWeight: 600 }}>
          LIMITER - The Ceiling Guardian
        </h3>

        {/* Preset Selector */}
        <select
          value={selectedPresetId}
          onChange={(e) => handlePresetChange(e.target.value)}
          style={{
            padding: '6px 12px',
            backgroundColor: '#1a1e2e',
            color: '#E8E9ED',
            border: '1px solid #4A90E2',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {Object.entries(presetsByCategory).map(([category, presets]) => (
            <optgroup key={category} label={category}>
              {Array.isArray(presets) ? presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              )) : null}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Visualization */}
      <LimiterVisualizer
        trackId={trackId}
        effectId={effect.id}
        ceiling={ceiling}
        mode={mode}
      />

      {/* Mode Selector */}
      <div style={{ marginBottom: '20px' }}>
        <ModeSelector
          modes={Object.values(LIMITER_MODES).map(m => ({
            id: m.id,
            label: m.name,
            tooltip: m.description
          }))}
          value={mode}
          onChange={(value) => onChange('mode', value)}
          variant="minimal"
        />
      </div>

      {/* Main Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Ceiling */}
        <div>
          <Knob
            label="CEILING"
            value={ceiling}
            onChange={(value) => onChange('ceiling', value)}
            min={-10}
            max={0}
            step={0.1}
            unit="dB"
            size={70}
            sensitivity={0.5}
            color="#E74C3C"
          />
        </div>

        {/* Release */}
        <div>
          <Knob
            label="RELEASE"
            value={release}
            onChange={(value) => onChange('release', value)}
            min={10}
            max={1000}
            step={1}
            unit="ms"
            size={70}
            sensitivity={1}
            color="#4A90E2"
          />
        </div>

        {/* Lookahead */}
        <div>
          <Knob
            label="LOOKAHEAD"
            value={lookahead}
            onChange={(value) => onChange('lookahead', value)}
            min={0}
            max={10}
            step={0.1}
            unit="ms"
            size={70}
            sensitivity={0.2}
            color="#00D9FF"
          />
        </div>
      </div>

      {/* Advanced Controls */}
      <div style={{
        padding: '15px',
        backgroundColor: '#1a1e2e',
        borderRadius: '6px',
        marginBottom: '15px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '15px'
        }}>
          {/* Attack */}
          <div>
            <label style={{ color: '#9CA3B5', fontSize: '11px', display: 'block', marginBottom: '8px' }}>
              ATTACK: {attack.toFixed(2)}ms
            </label>
            <input
              type="range"
              min="0.01"
              max="10"
              step="0.01"
              value={attack}
              onChange={(e) => onChange('attack', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Knee */}
          <div>
            <label style={{ color: '#9CA3B5', fontSize: '11px', display: 'block', marginBottom: '8px' }}>
              KNEE: {knee > 0.5 ? 'Soft' : 'Brick'}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={knee}
              onChange={(e) => onChange('knee', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Stereo Link */}
          <div>
            <label style={{ color: '#9CA3B5', fontSize: '11px', display: 'block', marginBottom: '8px' }}>
              STEREO LINK: {stereoLink.toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={stereoLink}
              onChange={(e) => onChange('stereoLink', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Oversample */}
          <div>
            <label style={{ color: '#9CA3B5', fontSize: '11px', display: 'block', marginBottom: '8px' }}>
              OVERSAMPLE: {oversample}x
            </label>
            <select
              value={oversample}
              onChange={(e) => onChange('oversample', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '6px',
                backgroundColor: '#0f1419',
                color: '#E8E9ED',
                border: '1px solid #4A90E2',
                borderRadius: '4px'
              }}
            >
              <option value="1">1x (Off)</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
              <option value="8">8x</option>
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#E8E9ED', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={truePeak >= 0.5}
              onChange={(e) => onChange('truePeak', e.target.checked ? 1 : 0)}
            />
            TRUE PEAK
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#E8E9ED', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={autoGain >= 0.5}
              onChange={(e) => onChange('autoGain', e.target.checked ? 1 : 0)}
            />
            AUTO GAIN
          </label>
        </div>
      </div>

      {/* Info */}
      <div style={{
        fontSize: '10px',
        color: '#6B7280',
        textAlign: 'center',
        marginTop: '10px'
      }}>
        Professional mastering-grade limiter with true peak detection
      </div>
    </div>
  );
}

export default LimiterUI;
