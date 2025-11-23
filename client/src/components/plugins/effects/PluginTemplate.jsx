/**
 * Plugin Template
 *
 * This is a template for creating new audio effect plugins.
 * Replace all instances of "PluginTemplate" with your plugin name.
 *
 * @example
 * // 1. Copy this file and rename it to YourPluginUI.jsx
 * // 2. Copy template-processor.js to your-plugin-processor.js
 * // 3. Update pluginConfig.jsx to register your plugin
 * // 4. Implement your DSP logic in the worklet processor
 * // 5. Customize the UI and visualization
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';
import { createPresetManager } from '@/lib/audio/PresetManager';

/**
 * Factory Presets
 * Define your plugin's default presets here
 */
const FACTORY_PRESETS = [
  {
    id: 'default',
    name: 'Default',
    category: 'Init',
    parameters: {
      param1: 0.5,
      param2: 0.5,
      param3: 0.5,
      mix: 1.0
    },
    description: 'Default settings'
  },
  {
    id: 'subtle',
    name: 'Subtle',
    category: 'Utility',
    parameters: {
      param1: 0.3,
      param2: 0.4,
      param3: 0.3,
      mix: 0.5
    },
    description: 'Subtle effect'
  },
  {
    id: 'extreme',
    name: 'Extreme',
    category: 'Creative',
    parameters: {
      param1: 1.0,
      param2: 0.8,
      param3: 0.9,
      mix: 1.0
    },
    description: 'Extreme processing'
  }
];

/**
 * Preset Manager Instance
 * Singleton instance for this plugin
 */
const presetManager = createPresetManager('plugin-template', FACTORY_PRESETS);

/**
 * Visualization Component
 * Customize this to visualize your plugin's processing
 */
const PluginVisualizer = ({ trackId, effectId, param1, param2, param3 }) => {
  const { isPlaying, getTimeDomainData, getFrequencyData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.2
  });

  const drawVisualization = useCallback((ctx, width, height) => {
    // Clear canvas
    ctx.fillStyle = 'rgba(10, 10, 12, 0.95)';
    ctx.fillRect(0, 0, width, height);

    if (!isPlaying) {
      // Draw idle state
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.font = '12px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Audio Stopped', width / 2, height / 2);
      return;
    }

    // Get audio data
    const timeData = getTimeDomainData();
    const freqData = getFrequencyData();

    if (timeData) {
      // Example: Draw waveform
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
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
    }

    if (freqData) {
      // Example: Draw frequency bars
      ctx.fillStyle = 'rgba(168, 85, 247, 0.6)';
      const barCount = 64;
      const barWidth = width / barCount;

      for (let i = 0; i < barCount; i++) {
        const barHeight = (freqData[i] + 1) * height / 2;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }
    }

    // Display metrics
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '10px "Geist Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`RMS: ${metricsDb.rmsDb.toFixed(1)}dB`, 8, 16);
    ctx.fillText(`PEAK: ${metricsDb.peakDb.toFixed(1)}dB`, 8, 30);

    if (metricsDb.clipping) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.fillText('CLIP!', 8, 44);
    }

    // Display parameter values
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(`P1: ${(param1 * 100).toFixed(0)}%`, width - 8, 16);
    ctx.fillText(`P2: ${(param2 * 100).toFixed(0)}%`, width - 8, 30);
    ctx.fillText(`P3: ${(param3 * 100).toFixed(0)}%`, width - 8, 44);
  }, [isPlaying, getTimeDomainData, getFrequencyData, metricsDb, param1, param2, param3]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawVisualization,
    [param1, param2, param3, isPlaying]
  );

  return (
    <div ref={containerRef} className="plugin-visualizer">
      <canvas ref={canvasRef} className="plugin-visualizer__canvas" />
    </div>
  );
};

/**
 * Main Plugin UI Component
 */
export function PluginTemplateUI({ trackId, effect, onUpdate }) {
  // Plugin state
  const [params, setParams] = useState({
    param1: effect.parameters?.param1 ?? 0.5,
    param2: effect.parameters?.param2 ?? 0.5,
    param3: effect.parameters?.param3 ?? 0.5,
    mix: effect.parameters?.mix ?? 1.0
  });

  // Ghost values for visual feedback
  const ghostParam1 = useGhostValue(params.param1, 400);
  const ghostParam2 = useGhostValue(params.param2, 400);
  const ghostParam3 = useGhostValue(params.param3, 400);

  // Audio plugin connection
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Preset management
  const [selectedPresetId, setSelectedPresetId] = useState('default');
  const allPresets = useMemo(() => presetManager.getAllPresets(), []);
  const presetsByCategory = useMemo(() => presetManager.getPresetsByCategory(), []);

  // Send parameter changes to worklet
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    audioNode.port.postMessage({
      type: 'setParameters',
      data: params
    });
  }, [params, plugin]);

  // Parameter change handler
  const handleParamChange = useCallback((paramName, value) => {
    const newParams = { ...params, [paramName]: value };
    setParams(newParams);
    onUpdate({ ...effect, parameters: newParams });
  }, [params, effect, onUpdate]);

  // Preset handlers
  const handlePresetChange = useCallback((presetId) => {
    presetManager.applyPreset(presetId, (presetParams) => {
      setParams(presetParams);
      onUpdate({ ...effect, parameters: presetParams });
      setSelectedPresetId(presetId);
    });
  }, [effect, onUpdate]);

  const handleSavePreset = useCallback(async () => {
    const name = prompt('Enter preset name:');
    if (!name || !name.trim()) return;

    const presetId = presetManager.saveUserPreset(name.trim(), params, {
      category: 'User',
      description: 'User saved preset'
    });

    const { apiClient } = await import('../../../services/api.js');
    if (presetId) {
      setSelectedPresetId(presetId);
      apiClient.showToast('Preset saved successfully!', 'success', 3000);
    }
  }, [params]);

  const handleExportPreset = useCallback(() => {
    const json = presetManager.exportPreset(selectedPresetId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPresetId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedPresetId]);

  const handleImportPreset = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const presetId = presetManager.importPreset(event.target.result);
          const { apiClient } = await import('../../../services/api.js');
          if (presetId) {
            handlePresetChange(presetId);
            apiClient.showToast('Preset imported successfully!', 'success', 3000);
          }
        } catch (error) {
          const { apiClient } = await import('../../../services/api.js');
          apiClient.showToast(`Failed to import preset: ${error.message}`, 'error', 5000);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [handlePresetChange]);

  return (
    <div className="plugin-template-ui">
      {/* Header */}
      <div className="plugin-template-ui__header">
        <h3 className="plugin-template-ui__title">Plugin Template</h3>

        {/* Preset Selector */}
        <div className="plugin-template-ui__preset-selector">
          <select
            value={selectedPresetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="plugin-template-ui__preset-dropdown"
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
            onClick={handleSavePreset}
            className="plugin-template-ui__preset-btn"
            title="Save Preset"
          >
            💾
          </button>

          <button
            onClick={handleExportPreset}
            className="plugin-template-ui__preset-btn"
            title="Export Preset"
          >
            📤
          </button>

          <button
            onClick={handleImportPreset}
            className="plugin-template-ui__preset-btn"
            title="Import Preset"
          >
            📥
          </button>
        </div>
      </div>

      {/* Visualization */}
      <PluginVisualizer
        trackId={trackId}
        effectId={effect.id}
        param1={params.param1}
        param2={params.param2}
        param3={params.param3}
      />

      {/* Parameters */}
      <div className="plugin-template-ui__controls">
        {/* Parameter 1 */}
        <div className="plugin-template-ui__param">
          <label className="plugin-template-ui__label">
            Parameter 1
            <span className="plugin-template-ui__value">
              {(params.param1 * 100).toFixed(0)}%
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.param1}
            onChange={(e) => handleParamChange('param1', parseFloat(e.target.value))}
            className="plugin-template-ui__slider"
          />
          {/* Ghost indicator */}
          <div
            className="plugin-template-ui__ghost"
            style={{
              left: `${ghostParam1 * 100}%`,
              opacity: Math.abs(ghostParam1 - params.param1) > 0.01 ? 0.3 : 0
            }}
          />
        </div>

        {/* Parameter 2 */}
        <div className="plugin-template-ui__param">
          <label className="plugin-template-ui__label">
            Parameter 2
            <span className="plugin-template-ui__value">
              {(params.param2 * 100).toFixed(0)}%
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.param2}
            onChange={(e) => handleParamChange('param2', parseFloat(e.target.value))}
            className="plugin-template-ui__slider"
          />
          <div
            className="plugin-template-ui__ghost"
            style={{
              left: `${ghostParam2 * 100}%`,
              opacity: Math.abs(ghostParam2 - params.param2) > 0.01 ? 0.3 : 0
            }}
          />
        </div>

        {/* Parameter 3 */}
        <div className="plugin-template-ui__param">
          <label className="plugin-template-ui__label">
            Parameter 3
            <span className="plugin-template-ui__value">
              {(params.param3 * 100).toFixed(0)}%
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.param3}
            onChange={(e) => handleParamChange('param3', parseFloat(e.target.value))}
            className="plugin-template-ui__slider"
          />
          <div
            className="plugin-template-ui__ghost"
            style={{
              left: `${ghostParam3 * 100}%`,
              opacity: Math.abs(ghostParam3 - params.param3) > 0.01 ? 0.3 : 0
            }}
          />
        </div>

        {/* Mix */}
        <div className="plugin-template-ui__param">
          <label className="plugin-template-ui__label">
            Mix
            <span className="plugin-template-ui__value">
              {(params.mix * 100).toFixed(0)}%
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.mix}
            onChange={(e) => handleParamChange('mix', parseFloat(e.target.value))}
            className="plugin-template-ui__slider"
          />
        </div>
      </div>

      {/* Footer / Info */}
      <div className="plugin-template-ui__footer">
        <p className="plugin-template-ui__info">
          Replace this template with your plugin implementation
        </p>
      </div>
    </div>
  );
}

// Default export
export default PluginTemplateUI;
