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
 * Limiter Visualizer - Professional canvas visualization
 * Similar to Compressor: Transfer curve + Waveform + Real-time signal flow
 */
const LimiterVisualizer = ({ trackId, effectId, ceiling, knee, truePeak }) => {
  const { isPlaying, getTimeDomainData, metricsDb, plugin } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.2
  });

  const [meteringData, setMeteringData] = useState({
    grPeak: 0,
    grAverage: 0,
    inputDb: -144,
    outputDb: -144,
    truePeakInDb: -144,
    truePeakOutDb: -144
  });

  // 🎵 STREAMING SIGNAL BUFFER: Store last N frames for flowing visualization
  const signalBufferRef = useRef([]);
  const maxBufferSize = 300; // ~5 seconds at 60fps

  const drawVisualization = useCallback((ctx, width, height) => {
    // 🎨 DIVIDE CANVAS: Transfer curve area (top 60%) + Waveform area (bottom 40%)
    const curveHeight = height * 0.6;
    const waveformHeight = height * 0.4;
    const waveformTop = curveHeight;

    // Clear entire canvas
    ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Grid (only in curve area)
    ctx.strokeStyle = 'rgba(0, 168, 232, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = (i / 4) * width;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, curveHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i / 4) * curveHeight);
      ctx.lineTo(width, (i / 4) * curveHeight);
      ctx.stroke();
    }

    // Waveform area background
    ctx.fillStyle = 'rgba(5, 5, 10, 0.8)';
    ctx.fillRect(0, waveformTop, width, waveformHeight);

    // Diagonal reference line (1:1) - only in curve area
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, curveHeight);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // 🎨 LIMITING TRANSFER CURVE: Shows input-output relationship
    const dbToPixel = (db) => width - ((db + 60) / 60) * width;
    const outputDbToPixel = (db) => curveHeight - ((db + 60) / 60) * curveHeight;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let inputDb = -60; inputDb <= 0; inputDb += 0.5) {
      let outputDb = inputDb;

      // Apply limiting: Hard limit at ceiling
      if (inputDb > ceiling) {
        // Soft knee if enabled
        if (knee > 0 && inputDb < ceiling + knee) {
          const kneeRange = inputDb - ceiling;
          const kneeAmount = (kneeRange / knee) * (1 - knee); // Smooth transition
          outputDb = ceiling + kneeAmount;
        } else {
          outputDb = ceiling; // Brick wall
        }
      }

      const x = dbToPixel(inputDb);
      const y = outputDbToPixel(outputDb);
      if (inputDb === -60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Curve glow
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 🎛️ CEILING LINE (Red horizontal line)
    const ceilingY = outputDbToPixel(ceiling);
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.9)'; // Red
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, ceilingY);
    ctx.lineTo(width, ceilingY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ceiling label
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(231, 76, 60, 1)';
    ctx.textAlign = 'left';
    ctx.fillText(`CEILING: ${ceiling.toFixed(1)}dB`, 8, ceilingY - 5);

    // 🎵 STREAMING SIGNAL VISUALIZATION: Show flowing signal over time
    if (isPlaying) {
      const timeData = getTimeDomainData();
      if (timeData && timeData.length > 0) {
        // Calculate RMS level in dB
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSq += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        const inputDb = rms > 0 ? 20 * Math.log10(rms) : -60;
        const clampedInputDb = Math.max(-60, Math.min(0, inputDb));

        // Calculate output based on limiting curve
        let outputDb = clampedInputDb;
        if (clampedInputDb > ceiling) {
          if (knee > 0 && clampedInputDb < ceiling + knee) {
            const kneeRange = clampedInputDb - ceiling;
            const kneeAmount = (kneeRange / knee) * (1 - knee);
            outputDb = ceiling + kneeAmount;
          } else {
            outputDb = ceiling; // Hard limit
          }
        }

        // Add new point to buffer
        signalBufferRef.current.push({
          inputDb: clampedInputDb,
          outputDb,
          timestamp: performance.now()
        });

        // Trim buffer to max size
        if (signalBufferRef.current.length > maxBufferSize) {
          signalBufferRef.current.shift();
        }

        const buffer = signalBufferRef.current;

        // 🎨 WAVEFORM AREA: Draw input and output signal areas
        if (buffer.length > 10) {
          const pointsPerPixel = Math.max(1, Math.floor(buffer.length / width));

          // Draw input signal filled area
          ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
          ctx.beginPath();
          
          for (let x = 0; x < width; x++) {
            const bufferIdx = Math.min(buffer.length - 1, Math.floor(x * pointsPerPixel));
            const point = buffer[bufferIdx];
            const inputDbNorm = (point.inputDb + 60) / 60;
            const y = waveformTop + waveformHeight - (inputDbNorm * waveformHeight * 0.7);
            
            if (x === 0) {
              ctx.moveTo(x, waveformTop + waveformHeight);
              ctx.lineTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.lineTo(width, waveformTop + waveformHeight);
          ctx.closePath();
          ctx.fill();

          // Draw output/limited area (red tint when limiting)
          const isLimiting = meteringData.grPeak < -0.1;
          ctx.fillStyle = isLimiting ? 'rgba(231, 76, 60, 0.5)' : 'rgba(135, 206, 250, 0.5)';
          ctx.beginPath();
          
          for (let x = 0; x < width; x++) {
            const bufferIdx = Math.min(buffer.length - 1, Math.floor(x * pointsPerPixel));
            const point = buffer[bufferIdx];
            const outputDbNorm = (point.outputDb + 60) / 60;
            const y = waveformTop + waveformHeight - (outputDbNorm * waveformHeight * 0.7);
            
            if (x === 0) {
              ctx.moveTo(x, waveformTop + waveformHeight);
              ctx.lineTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.lineTo(width, waveformTop + waveformHeight);
          ctx.closePath();
          ctx.fill();

          // Draw gain reduction overlay when limiting
          if (isLimiting && buffer.length > 10) {
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            for (let x = 0; x < width; x++) {
              const bufferIdx = Math.min(buffer.length - 1, Math.floor(x * pointsPerPixel));
              const point = buffer[bufferIdx];
              const inputDbNorm = (point.inputDb + 60) / 60;
              const outputDbNorm = (point.outputDb + 60) / 60;
              
              const inputY = waveformTop + waveformHeight - (inputDbNorm * waveformHeight * 0.7);
              const outputY = waveformTop + waveformHeight - (outputDbNorm * waveformHeight * 0.7);
              
              if (point.inputDb > ceiling) {
                if (x === 0 || (buffer[Math.max(0, bufferIdx - 1)]?.inputDb || -60) <= ceiling) {
                  ctx.moveTo(x, inputY);
                }
                ctx.lineTo(x, outputY);
              }
            }
            ctx.stroke();
          }
        }

        // Draw current point indicators
        const currentPoint = buffer[buffer.length - 1];
        if (currentPoint) {
          const inputX = dbToPixel(currentPoint.inputDb);
          const inputY = outputDbToPixel(currentPoint.inputDb);
          const outputY = outputDbToPixel(currentPoint.outputDb);

          // Input level indicator (vertical line in curve area)
          ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(inputX, 0);
          ctx.lineTo(inputX, curveHeight);
          ctx.stroke();
          ctx.setLineDash([]);

          // Current input point (bright)
          ctx.fillStyle = 'rgba(0, 255, 255, 1)';
          ctx.beginPath();
          ctx.arc(inputX, inputY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Current output point (red when limiting)
          const isLimitingNow = currentPoint.outputDb < currentPoint.inputDb - 0.5;
          ctx.fillStyle = isLimitingNow ? 'rgba(231, 76, 60, 1)' : 'rgba(135, 206, 250, 1)';
          ctx.beginPath();
          ctx.arc(inputX, outputY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Labels
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.textAlign = 'left';
          ctx.fillText(`IN: ${currentPoint.inputDb.toFixed(1)}dB`, inputX + 10, inputY - 10);
          ctx.fillText(`OUT: ${currentPoint.outputDb.toFixed(1)}dB`, inputX + 10, outputY + 15);
          
          const gr = currentPoint.inputDb - currentPoint.outputDb;
          if (gr > 0.1) {
            ctx.fillStyle = 'rgba(231, 76, 60, 1)';
            ctx.fillText(`GR: ${gr.toFixed(1)}dB`, inputX + 10, outputY + 30);
          }
        }
      }
    } else {
      // Clear buffer when stopped
      if (signalBufferRef.current.length > 0) {
        signalBufferRef.current = [];
      }
      
      // Show "Audio Stopped" message
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.textAlign = 'center';
      ctx.fillText('Audio Stopped', width / 2, height / 2);
    }

    // Status indicators
    const isLimiting = meteringData.grPeak < -0.1;
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = isLimiting ? 'rgba(231, 76, 60, 1)' : 'rgba(0, 217, 255, 1)';
    ctx.textAlign = 'left';
    ctx.fillText(isLimiting ? '🔴 LIMITING' : '⚪ READY', 8, 18);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'right';
    ctx.fillText(`GR: ${Math.abs(meteringData.grPeak).toFixed(1)}dB`, width - 8, 18);

    // True-peak indicator (if enabled)
    if (truePeak && meteringData.truePeakOutDb > ceiling) {
      ctx.fillStyle = 'rgba(255, 200, 0, 1)';
      ctx.textAlign = 'center';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`⚠️ TP: ${meteringData.truePeakOutDb.toFixed(1)}dB`, width / 2, 18);
    }

    // Axis labels
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'left';
    ctx.fillText('INPUT dB', 8, curveHeight - 8);
    ctx.fillText('OUTPUT dB', 8, curveHeight + 4);
  }, [isPlaying, getTimeDomainData, metricsDb, ceiling, knee, truePeak, meteringData]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawVisualization,
    [ceiling, knee, truePeak, isPlaying, meteringData]
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
        knee={knee}
        truePeak={truePeak}
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
