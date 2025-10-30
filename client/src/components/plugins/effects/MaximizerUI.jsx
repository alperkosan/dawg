/**
 * MaximizerUI - Loudness Maximizer Plugin
 *
 * Mode-Based Design Philosophy:
 * "Make it louder instantly" - One intensity knob, infinite loudness possibilities
 *
 * Features:
 * - 5 character modes (Gentle, Moderate, Aggressive, Warm, Transparent)
 * - Single intensity master control
 * - Visual loudness meter
 * - Progressive disclosure to advanced parameters
 * - Soft saturation + brick-wall limiting
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';
import { createPresetManager } from '@/lib/audio/PresetManager';
import './MaximizerUI.css';

// ============================================================================
// MODE DEFINITIONS
// ============================================================================

const MAXIMIZER_MODES = {
  gentle: {
    id: 'gentle',
    name: 'Gentle',
    description: 'Subtle loudness boost for mastering',
    icon: '🌙',
    color: '#60A5FA',
    baseParams: {
      inputGain: 2,
      saturation: 0.2,
      ceiling: -0.3,
      release: 0.2
    }
  },
  moderate: {
    id: 'moderate',
    name: 'Moderate',
    description: 'Balanced loudness for modern masters',
    icon: '☀️',
    color: '#34D399',
    baseParams: {
      inputGain: 3,
      saturation: 0.3,
      ceiling: -0.1,
      release: 0.1
    }
  },
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Maximum loudness for competitive releases',
    icon: '🔥',
    color: '#EF4444',
    baseParams: {
      inputGain: 6,
      saturation: 0.5,
      ceiling: -0.1,
      release: 0.05
    }
  },
  warm: {
    id: 'warm',
    name: 'Warm Glue',
    description: 'Analog-style saturation and compression',
    icon: '🎸',
    color: '#F59E0B',
    baseParams: {
      inputGain: 4,
      saturation: 0.6,
      ceiling: -0.2,
      release: 0.15
    }
  },
  transparent: {
    id: 'transparent',
    name: 'Transparent',
    description: 'Clean limiting, minimal coloration',
    icon: '💎',
    color: '#8B5CF6',
    baseParams: {
      inputGain: 2,
      saturation: 0.1,
      ceiling: -0.5,
      release: 0.2
    }
  }
};

// ============================================================================
// FACTORY PRESETS
// ============================================================================

const FACTORY_PRESETS = [
  {
    id: 'gentle',
    name: 'Gentle Loudness',
    category: 'Mastering',
    parameters: {
      mode: 'gentle',
      intensity: 0.5,
      inputGain: 2,
      saturation: 0.2,
      ceiling: -0.3,
      release: 0.2,
      wet: 1.0
    },
    description: 'Subtle loudness boost for mastering'
  },
  {
    id: 'moderate',
    name: 'Moderate Master',
    category: 'Mastering',
    parameters: {
      mode: 'moderate',
      intensity: 0.5,
      inputGain: 3,
      saturation: 0.3,
      ceiling: -0.1,
      release: 0.1,
      wet: 1.0
    },
    description: 'Balanced loudness for modern masters'
  },
  {
    id: 'aggressive',
    name: 'Aggressive Loud',
    category: 'Loudness',
    parameters: {
      mode: 'aggressive',
      intensity: 0.5,
      inputGain: 6,
      saturation: 0.5,
      ceiling: -0.1,
      release: 0.05,
      wet: 1.0
    },
    description: 'Maximum loudness for competitive releases'
  },
  {
    id: 'warm',
    name: 'Warm Glue',
    category: 'Color',
    parameters: {
      mode: 'warm',
      intensity: 0.5,
      inputGain: 4,
      saturation: 0.6,
      ceiling: -0.2,
      release: 0.15,
      wet: 1.0
    },
    description: 'Analog-style saturation and compression'
  },
  {
    id: 'transparent',
    name: 'Transparent',
    category: 'Mastering',
    parameters: {
      mode: 'transparent',
      intensity: 0.5,
      inputGain: 2,
      saturation: 0.1,
      ceiling: -0.5,
      release: 0.2,
      wet: 1.0
    },
    description: 'Clean limiting, minimal coloration'
  }
];

const presetManager = createPresetManager('maximizer', FACTORY_PRESETS);

// ============================================================================
// VISUALIZER COMPONENT
// ============================================================================

const MaximizerVisualizer = ({ trackId, effectId, mode, intensity }) => {
  const { isPlaying, getTimeDomainData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.15,
    peakSmoothing: 0.1
  });

  const currentMode = MAXIMIZER_MODES[mode];

  const drawVisualization = useCallback((ctx, width, height) => {
    // Clear
    ctx.fillStyle = 'rgba(10, 10, 12, 0.95)';
    ctx.fillRect(0, 0, width, height);

    if (!isPlaying) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.font = '12px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Audio Stopped', width / 2, height / 2);
      return;
    }

    const timeData = getTimeDomainData();
    if (!timeData) return;

    // Draw waveform
    ctx.strokeStyle = currentMode.color;
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

    // Draw ceiling line
    const ceilingY = height * 0.1;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, ceilingY);
    ctx.lineTo(width, ceilingY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw metrics
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '11px "Geist Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`IN: ${metricsDb.rmsDb.toFixed(1)} dB`, 10, 20);
    ctx.fillText(`PEAK: ${metricsDb.peakDb.toFixed(1)} dB`, 10, 35);

    if (metricsDb.clipping) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('🔴 CLIP', 10, 50);
    }

    // Draw mode indicator
    ctx.fillStyle = currentMode.color;
    ctx.textAlign = 'right';
    ctx.font = '14px "Geist", sans-serif';
    ctx.fillText(`${currentMode.icon} ${currentMode.name}`, width - 10, 25);
    ctx.font = '10px "Geist Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(`Intensity: ${(intensity * 100).toFixed(0)}%`, width - 10, 40);
  }, [isPlaying, getTimeDomainData, metricsDb, currentMode, intensity]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawVisualization,
    [mode, intensity, isPlaying]
  );

  return (
    <div ref={containerRef} className="maximizer-visualizer">
      <canvas ref={canvasRef} className="maximizer-visualizer__canvas" />
    </div>
  );
};

// ============================================================================
// MAIN UI COMPONENT
// ============================================================================

export function MaximizerUI({ trackId, effect, onUpdate = () => {} }) {
  // State
  const [mode, setMode] = useState(effect.parameters?.mode || 'moderate');
  const [intensity, setIntensity] = useState(effect.parameters?.intensity ?? 0.5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [grMeter, setGrMeter] = useState(0); // 0..1 (1 = 100% reduction)
  const [outPeak, setOutPeak] = useState(0); // linear peak 0..1

  const [manualParams, setManualParams] = useState({
    inputGain: effect.parameters?.inputGain ?? 0,
    saturation: effect.parameters?.saturation ?? 0.3,
    ceiling: effect.parameters?.ceiling ?? -0.1,
    release: effect.parameters?.release ?? 0.1,
    wet: effect.parameters?.wet ?? 1.0,
    lookahead: effect.parameters?.lookahead ?? 3,
    truePeak: effect.parameters?.truePeak ?? 1
  });

  // Ghost values
  const ghostIntensity = useGhostValue(intensity, 400);

  // Audio plugin connection
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Subscribe to meters from worklet port
  useEffect(() => {
    const port = plugin?.audioNode?.workletNode?.port;
    if (!port) return;

    const onMessage = (e) => {
      const data = e.data;
      if (!data) return;
      if (data.type === 'meters') {
        if (typeof data.gr === 'number') setGrMeter(Math.max(0, Math.min(1, data.gr)));
        if (typeof data.out === 'number') setOutPeak(Math.max(0, Math.min(1, data.out)));
      }
    };
    port.addEventListener('message', onMessage);
    return () => port.removeEventListener('message', onMessage);
  }, [plugin]);

  // Preset management
  const [selectedPresetId, setSelectedPresetId] = useState('moderate');
  const allPresets = useMemo(() => presetManager.getAllPresets(), []);
  const presetsByCategory = useMemo(() => {
    const grouped = {};
    allPresets.forEach(preset => {
      const category = preset.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(preset);
    });
    return grouped;
  }, [allPresets]);

  // Computed parameters
  const params = useMemo(() => {
    if (showAdvanced) {
      return manualParams;
    }

    const baseParams = MAXIMIZER_MODES[mode].baseParams;
    return {
      inputGain: baseParams.inputGain * intensity,
      saturation: baseParams.saturation * intensity,
      ceiling: baseParams.ceiling,
      release: baseParams.release,
      wet: 1.0,
      lookahead: manualParams.lookahead,
      truePeak: manualParams.truePeak
    };
  }, [mode, intensity, showAdvanced, manualParams]);

  // Send parameters to audio worklet
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    audioNode.port.postMessage({
      type: 'setParameters',
      data: params
    });
  }, [params, plugin]);

  // Update effect in parent
  useEffect(() => {
    if (typeof onUpdate === 'function') {
      onUpdate({
        ...effect,
        parameters: {
          mode,
          intensity,
          ...params
        }
      });
    }
  }, [mode, intensity, params, effect.id, effect.type, onUpdate]);

  // Handlers
  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    setIntensity(0.5);
  }, []);

  const handleIntensityChange = useCallback((value) => {
    setIntensity(value);
  }, []);

  const handleManualChange = useCallback((paramName, value) => {
    setManualParams(prev => ({ ...prev, [paramName]: value }));
  }, []);

  const handlePresetChange = useCallback((presetId) => {
    presetManager.applyPreset(presetId, (presetParams) => {
      setMode(presetParams.mode || 'moderate');
      setIntensity(presetParams.intensity ?? 0.5);
      setManualParams({
        inputGain: presetParams.inputGain,
        saturation: presetParams.saturation,
        ceiling: presetParams.ceiling,
        release: presetParams.release,
        wet: presetParams.wet
      });
      setSelectedPresetId(presetId);
    });
  }, []);

  const currentMode = MAXIMIZER_MODES[mode];

  return (
    <div className="maximizer-ui" style={{ '--mode-color': currentMode.color }}>
      {/* Header */}
      <div className="maximizer-ui__header">
        <div>
          <h3 className="maximizer-ui__title">🔊 Maximizer</h3>
          <p className="maximizer-ui__subtitle">Loudness Sculptor</p>
        </div>

        <div className="maximizer-ui__header-controls">
          <select
            value={selectedPresetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="maximizer-ui__preset-dropdown"
          >
            {Object.entries(presetsByCategory).map(([category, presets]) => (
              <optgroup key={category} label={category}>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <button
            className={`maximizer-ui__advanced-toggle ${showAdvanced ? 'active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼ Simple' : '▲ Advanced'}
          </button>
        </div>
      </div>

      {/* Visualizer */}
      <MaximizerVisualizer
        trackId={trackId}
        effectId={effect.id}
        mode={mode}
        intensity={intensity}
      />

      {/* Meters */}
      <div className="maximizer-ui__meters">
        <div className="maximizer-ui__meter">
          <div className="maximizer-ui__meter-label">GR</div>
          <div className="maximizer-ui__meter-bar">
            <div
              className="maximizer-ui__meter-fill"
              style={{ width: `${Math.round(grMeter * 100)}%`, background: currentMode.color }}
            />
          </div>
          <div className="maximizer-ui__meter-value">{(grMeter * 100).toFixed(0)}%</div>
        </div>
        <div className="maximizer-ui__meter">
          <div className="maximizer-ui__meter-label">OUT</div>
          <div className="maximizer-ui__meter-bar">
            <div
              className="maximizer-ui__meter-fill"
              style={{ width: `${Math.round(outPeak * 100)}%` }}
            />
          </div>
          <div className="maximizer-ui__meter-value">{(20*Math.log10(Math.max(outPeak, 1e-6))).toFixed(1)} dB</div>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="maximizer-modes">
        <div className="maximizer-modes__label">Loudness Character</div>
        <div className="maximizer-modes__buttons">
          {Object.values(MAXIMIZER_MODES).map(m => (
            <button
              key={m.id}
              className={`mode-btn ${mode === m.id ? 'active' : ''}`}
              onClick={() => handleModeChange(m.id)}
              style={{ '--btn-color': m.color }}
              title={m.description}
              disabled={showAdvanced}
            >
              <span className="mode-btn__icon">{m.icon}</span>
              <span className="mode-btn__name">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Control */}
      {!showAdvanced && (
        <div className="maximizer-main">
          <div className="intensity-control">
            <label className="intensity-control__label">Master Intensity</label>
            <div className="intensity-control__slider-container">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={intensity}
                onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
                className="intensity-control__slider"
                style={{
                  background: `linear-gradient(to right, ${currentMode.color} 0%, ${currentMode.color} ${intensity * 100}%, rgba(255,255,255,0.1) ${intensity * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              {/* Ghost indicator */}
              {Math.abs(ghostIntensity - intensity) > 0.01 && (
                <div
                  className="intensity-control__ghost"
                  style={{
                    left: `${ghostIntensity * 100}%`,
                    backgroundColor: currentMode.color
                  }}
                />
              )}
            </div>
            <div className="intensity-control__value" style={{ color: currentMode.color }}>
              {(intensity * 100).toFixed(0)}%
            </div>
            <p className="intensity-control__hint">{currentMode.description}</p>
          </div>

          {/* Parameter Preview */}
          <div className="param-preview">
            <div className="param-preview__item">
              <span className="param-preview__label">Input</span>
              <span className="param-preview__value">+{params.inputGain.toFixed(1)} dB</span>
            </div>
            <div className="param-preview__item">
              <span className="param-preview__label">Saturation</span>
              <span className="param-preview__value">{(params.saturation * 100).toFixed(0)}%</span>
            </div>
            <div className="param-preview__item">
              <span className="param-preview__label">Ceiling</span>
              <span className="param-preview__value">{params.ceiling.toFixed(1)} dB</span>
            </div>
            <div className="param-preview__item">
              <span className="param-preview__label">Release</span>
              <span className="param-preview__value">{(params.release * 1000).toFixed(0)} ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Panel */}
      {showAdvanced && (
        <div className="maximizer-advanced">
          <div className="maximizer-advanced__section">
            <h4>Input Stage</h4>
            <div className="param-control">
              <label>
                Input Gain: +{manualParams.inputGain.toFixed(1)} dB
              </label>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.1"
                value={manualParams.inputGain}
                onChange={(e) => handleManualChange('inputGain', parseFloat(e.target.value))}
                className="param-control__slider"
              />
            </div>

            <div className="param-control">
              <label>
                Saturation: {(manualParams.saturation * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={manualParams.saturation}
                onChange={(e) => handleManualChange('saturation', parseFloat(e.target.value))}
                className="param-control__slider"
              />
            </div>
          </div>

          <div className="maximizer-advanced__section">
            <h4>Limiter</h4>
            <div className="param-control">
              <label>
                Ceiling: {manualParams.ceiling.toFixed(1)} dB
              </label>
              <input
                type="range"
                min="-6"
                max="0"
                step="0.1"
                value={manualParams.ceiling}
                onChange={(e) => handleManualChange('ceiling', parseFloat(e.target.value))}
                className="param-control__slider"
              />
            </div>

            <div className="param-control">
              <label>
                Release: {(manualParams.release * 1000).toFixed(0)} ms
              </label>
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={manualParams.release}
                onChange={(e) => handleManualChange('release', parseFloat(e.target.value))}
                className="param-control__slider"
              />
            </div>

            <div className="param-control">
              <label>
                Look-ahead: {manualParams.lookahead.toFixed(1)} ms
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={manualParams.lookahead}
                onChange={(e) => handleManualChange('lookahead', parseFloat(e.target.value))}
                className="param-control__slider"
              />
            </div>

            <div className="param-control" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label>True Peak</label>
              <input
                type="checkbox"
                checked={!!manualParams.truePeak}
                onChange={(e) => handleManualChange('truePeak', e.target.checked ? 1 : 0)}
              />
            </div>
          </div>

          <div className="maximizer-advanced__section">
            <h4>Output</h4>
            <div className="param-control">
              <label>
                Mix: {(manualParams.wet * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={manualParams.wet}
                onChange={(e) => handleManualChange('wet', parseFloat(e.target.value))}
                className="param-control__slider"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaximizerUI;
