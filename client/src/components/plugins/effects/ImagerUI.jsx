/**
 * ImagerUI - Stereo Field Sculptor Plugin
 *
 * Mode-Based Design Philosophy:
 * "Shape your stereo image instantly" - One width knob, infinite stereo possibilities
 *
 * Features:
 * - 7 character modes (Mono → Narrow → Normal → Wide → Ultra Wide → Enhance Sides → Vocal Focus)
 * - Single width intensity control
 * - Visual stereo field display
 * - Progressive disclosure to Mid/Side parameters
 * - Professional Mid/Side processing
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';
import { createPresetManager } from '@/lib/audio/PresetManager';
import './ImagerUI.css';

// ============================================================================
// MODE DEFINITIONS
// ============================================================================

const IMAGER_MODES = {
  mono: {
    id: 'mono',
    name: 'Mono',
    description: 'Bass-safe mono output',
    icon: '🎯',
    color: '#9CA3AF',
    baseParams: {
      width: 0,
      midGain: 1.0,
      sideGain: 0
    }
  },
  narrow: {
    id: 'narrow',
    name: 'Narrow',
    description: 'Focused stereo image',
    icon: '🎵',
    color: '#60A5FA',
    baseParams: {
      width: 0.5,
      midGain: 1.0,
      sideGain: 0.5
    }
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    description: 'Natural stereo width',
    icon: '🎼',
    color: '#34D399',
    baseParams: {
      width: 1.0,
      midGain: 1.0,
      sideGain: 1.0
    }
  },
  wide: {
    id: 'wide',
    name: 'Wide',
    description: 'Enhanced stereo spread',
    icon: '🌊',
    color: '#A78BFA',
    baseParams: {
      width: 1.4,
      midGain: 0.85,
      sideGain: 1.4
    }
  },
  ultraWide: {
    id: 'ultraWide',
    name: 'Ultra Wide',
    description: 'Maximum stereo expansion',
    icon: '🌌',
    color: '#8B5CF6',
    baseParams: {
      width: 1.8,
      midGain: 0.7,
      sideGain: 1.8
    }
  },
  enhanceSides: {
    id: 'enhanceSides',
    name: 'Enhance Sides',
    description: 'Boost stereo information',
    icon: '✨',
    color: '#F472B6',
    baseParams: {
      width: 1.5,
      midGain: 0.6,
      sideGain: 1.9
    }
  },
  vocalFocus: {
    id: 'vocalFocus',
    name: 'Vocal Focus',
    description: 'Enhance center channel',
    icon: '🎤',
    color: '#FBBF24',
    baseParams: {
      width: 0.7,
      midGain: 1.3,
      sideGain: 0.5
    }
  }
};

// ============================================================================
// FACTORY PRESETS
// ============================================================================

const FACTORY_PRESETS = [
  {
    id: 'mono',
    name: 'Mono (Bass Safe)',
    category: 'Utility',
    parameters: {
      mode: 'mono',
      intensity: 1.0,
      width: 0,
      midGain: 1.0,
      sideGain: 0,
      wet: 1.0
    },
    description: 'Bass-safe mono output'
  },
  {
    id: 'narrow',
    name: 'Narrow',
    category: 'Width Control',
    parameters: {
      mode: 'narrow',
      intensity: 1.0,
      width: 0.5,
      midGain: 1.0,
      sideGain: 0.5,
      wet: 1.0
    },
    description: 'Focused stereo image'
  },
  {
    id: 'normal',
    name: 'Normal',
    category: 'Width Control',
    parameters: {
      mode: 'normal',
      intensity: 1.0,
      width: 1.0,
      midGain: 1.0,
      sideGain: 1.0,
      wet: 1.0
    },
    description: 'Natural stereo width'
  },
  {
    id: 'wide',
    name: 'Wide',
    category: 'Width Control',
    parameters: {
      mode: 'wide',
      intensity: 1.0,
      width: 1.4,
      midGain: 0.85,
      sideGain: 1.4,
      wet: 1.0
    },
    description: 'Enhanced stereo spread'
  },
  {
    id: 'ultraWide',
    name: 'Ultra Wide',
    category: 'Wide Effects',
    parameters: {
      mode: 'ultraWide',
      intensity: 1.0,
      width: 1.8,
      midGain: 0.7,
      sideGain: 1.8,
      wet: 1.0
    },
    description: 'Maximum stereo expansion'
  },
  {
    id: 'enhanceSides',
    name: 'Enhance Sides',
    category: 'Creative',
    parameters: {
      mode: 'enhanceSides',
      intensity: 1.0,
      width: 1.5,
      midGain: 0.6,
      sideGain: 1.9,
      wet: 1.0
    },
    description: 'Boost stereo information'
  },
  {
    id: 'vocalFocus',
    name: 'Vocal Focus',
    category: 'Creative',
    parameters: {
      mode: 'vocalFocus',
      intensity: 1.0,
      width: 0.7,
      midGain: 1.3,
      sideGain: 0.5,
      wet: 1.0
    },
    description: 'Enhance center channel'
  }
];

const presetManager = createPresetManager('imager', FACTORY_PRESETS);

// ============================================================================
// VISUALIZER COMPONENT
// ============================================================================

const ImagerVisualizer = ({ trackId, effectId, mode, intensity }) => {
  const { isPlaying, getTimeDomainData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.2,
    peakSmoothing: 0.15
  });

  const currentMode = IMAGER_MODES[mode];

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

    // Draw stereo field visualization
    const centerX = width / 2;
    const maxRadius = Math.min(width, height) * 0.35;
    const currentRadius = maxRadius * (intensity * currentMode.baseParams.width);

    // Draw center indicator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();

    // Draw stereo field circle
    ctx.strokeStyle = currentMode.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(centerX, height / 2, currentRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Draw waveform in stereo field
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

    // Draw metrics
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '11px "Geist Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`L: ${metricsDb.rmsDb.toFixed(1)} dB`, 10, 20);
    ctx.fillText(`R: ${metricsDb.peakDb.toFixed(1)} dB`, 10, 35);

    // Draw mode indicator
    ctx.fillStyle = currentMode.color;
    ctx.textAlign = 'right';
    ctx.font = '14px "Geist", sans-serif';
    ctx.fillText(`${currentMode.icon} ${currentMode.name}`, width - 10, 25);
    ctx.font = '10px "Geist Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(`Width: ${(intensity * currentMode.baseParams.width * 100).toFixed(0)}%`, width - 10, 40);
  }, [isPlaying, getTimeDomainData, metricsDb, currentMode, intensity]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawVisualization,
    [mode, intensity, isPlaying]
  );

  return (
    <div ref={containerRef} className="imager-visualizer">
      <canvas ref={canvasRef} className="imager-visualizer__canvas" />
    </div>
  );
};

// ============================================================================
// MAIN UI COMPONENT
// ============================================================================

export function ImagerUI({ trackId, effect, onUpdate = () => {} }) {
  // State
  const [mode, setMode] = useState(effect.parameters?.mode || 'normal');
  const [intensity, setIntensity] = useState(effect.parameters?.intensity ?? 1.0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [manualParams, setManualParams] = useState({
    width: effect.parameters?.width ?? 1.0,
    midGain: effect.parameters?.midGain ?? 1.0,
    sideGain: effect.parameters?.sideGain ?? 1.0,
    wet: effect.parameters?.wet ?? 1.0
  });

  // Ghost values
  const ghostIntensity = useGhostValue(intensity, 400);

  // Audio plugin connection
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Preset management
  const [selectedPresetId, setSelectedPresetId] = useState('normal');
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

    const baseParams = IMAGER_MODES[mode].baseParams;
    const scaledWidth = baseParams.width * intensity;

    return {
      width: scaledWidth,
      midGain: baseParams.midGain,
      sideGain: baseParams.sideGain,
      wet: 1.0
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
    setIntensity(1.0);
  }, []);

  const handleIntensityChange = useCallback((value) => {
    setIntensity(value);
  }, []);

  const handleManualChange = useCallback((paramName, value) => {
    setManualParams(prev => ({ ...prev, [paramName]: value }));
  }, []);

  const handlePresetChange = useCallback((presetId) => {
    presetManager.applyPreset(presetId, (presetParams) => {
      setMode(presetParams.mode || 'normal');
      setIntensity(presetParams.intensity ?? 1.0);
      setManualParams({
        width: presetParams.width,
        midGain: presetParams.midGain,
        sideGain: presetParams.sideGain,
        wet: presetParams.wet
      });
      setSelectedPresetId(presetId);
    });
  }, []);

  const currentMode = IMAGER_MODES[mode];
  const stereoFieldWidth = Math.min(Math.max(params.width * 100, 0), 200);

  return (
    <div className="imager-ui" style={{ '--mode-color': currentMode.color }}>
      {/* Header */}
      <div className="imager-ui__header">
        <div>
          <h3 className="imager-ui__title">〰️ Imager</h3>
          <p className="imager-ui__subtitle">Stereo Field Sculptor</p>
        </div>

        <div className="imager-ui__header-controls">
          <select
            value={selectedPresetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="imager-ui__preset-dropdown"
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
            className={`imager-ui__advanced-toggle ${showAdvanced ? 'active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼ Simple' : '▲ Advanced'}
          </button>
        </div>
      </div>

      {/* Visualizer */}
      <ImagerVisualizer
        trackId={trackId}
        effectId={effect.id}
        mode={mode}
        intensity={intensity}
      />

      {/* Mode Selector */}
      <div className="imager-modes">
        <div className="imager-modes__label">Stereo Character</div>
        <div className="imager-modes__buttons">
          {Object.values(IMAGER_MODES).map(m => (
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
        <div className="imager-main">
          {/* Stereo Field Display */}
          <div className="stereo-field">
            <div className="stereo-field__label">Stereo Field</div>
            <div className="stereo-field__canvas">
              <div className="stereo-field__center"></div>
              <div
                className="stereo-field__width"
                style={{
                  width: `${stereoFieldWidth}%`,
                  background: `linear-gradient(to right, transparent, ${currentMode.color}, transparent)`
                }}
              ></div>
              <div className="stereo-field__markers">
                <span className="marker marker--left">L</span>
                <span className="marker marker--center">M</span>
                <span className="marker marker--right">R</span>
              </div>
            </div>
            <div className="stereo-field__value" style={{ color: currentMode.color }}>
              {stereoFieldWidth.toFixed(0)}%
            </div>
          </div>

          {/* Width Control */}
          <div className="width-control">
            <label className="width-control__label">Width Intensity</label>
            <div className="width-control__slider-container">
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={intensity}
                onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
                className="width-control__slider"
                style={{
                  background: `linear-gradient(to right, ${currentMode.color} 0%, ${currentMode.color} ${(intensity / 2) * 100}%, rgba(255,255,255,0.1) ${(intensity / 2) * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              {/* Ghost indicator */}
              {Math.abs(ghostIntensity - intensity) > 0.01 && (
                <div
                  className="width-control__ghost"
                  style={{
                    left: `${(ghostIntensity / 2) * 100}%`,
                    backgroundColor: currentMode.color
                  }}
                />
              )}
            </div>
            <div className="width-control__markers">
              <span>Mono</span>
              <span>Normal</span>
              <span>Ultra</span>
            </div>
            <p className="width-control__hint">{currentMode.description}</p>
          </div>

          {/* Parameter Preview */}
          <div className="param-preview">
            <div className="param-preview__item">
              <span className="param-preview__label">Width</span>
              <span className="param-preview__value">{params.width.toFixed(2)}</span>
            </div>
            <div className="param-preview__item">
              <span className="param-preview__label">Mid Gain</span>
              <span className="param-preview__value">{(params.midGain * 100).toFixed(0)}%</span>
            </div>
            <div className="param-preview__item">
              <span className="param-preview__label">Side Gain</span>
              <span className="param-preview__value">{(params.sideGain * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Panel */}
      {showAdvanced && (
        <div className="imager-advanced">
          <div className="imager-advanced__section">
            <h4>Stereo Width</h4>
            <div className="param-control">
              <label>
                Width: {manualParams.width.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={manualParams.width}
                onChange={(e) => handleManualChange('width', parseFloat(e.target.value))}
                className="param-control__slider"
              />
              <span className="param-hint">0 = Mono, 1 = Normal, 2 = Ultra Wide</span>
            </div>
          </div>

          <div className="imager-advanced__section">
            <h4>Mid/Side Balance</h4>
            <div className="param-control">
              <label>Mid Gain: {(manualParams.midGain * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={manualParams.midGain}
                onChange={(e) => handleManualChange('midGain', parseFloat(e.target.value))}
                className="param-control__slider"
              />
              <span className="param-hint">Center channel level</span>
            </div>

            <div className="param-control">
              <label>Side Gain: {(manualParams.sideGain * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={manualParams.sideGain}
                onChange={(e) => handleManualChange('sideGain', parseFloat(e.target.value))}
                className="param-control__slider"
              />
              <span className="param-hint">Stereo information level</span>
            </div>
          </div>

          <div className="imager-advanced__section">
            <h4>Output</h4>
            <div className="param-control">
              <label>Mix: {(manualParams.wet * 100).toFixed(0)}%</label>
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

export default ImagerUI;
