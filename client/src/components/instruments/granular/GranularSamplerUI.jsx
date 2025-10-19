/**
 * GranularSamplerUI - Main UI for Granular Sampler Instrument
 *
 * Solstice-inspired granular synthesis interface
 *
 * Features:
 * - Interactive waveform visualizer
 * - Real-time parameter controls
 * - Preset management
 * - Sample drag & drop
 */

import React, { useState, useRef } from 'react';
import { useGranularInstrument } from '@/hooks/useGranularInstrument';
import { Knob } from '@/components/controls/base/Knob';
import { WaveformVisualizer } from './WaveformVisualizer';
import { GrainVisualizer } from './GrainVisualizer';
import { GRANULAR_PRESETS } from './GranularPresets';
import { AudioContextService } from '@/lib/services/AudioContextService';
import {
  PluginColorPalette,
  PluginSpacing,
  PluginTypography
} from '@/components/plugins/PluginDesignSystem';
import './GranularSampler.css';

export const GranularSamplerUI = ({ instrumentId }) => {
  const {
    params,
    updateParam,
    updateParams,
    sampleInfo,
    loadSample,
    stats,
    triggerTest,
    triggerNote,
    triggerGrain,
    loadPreset
  } = useGranularInstrument(instrumentId);

  const [activeTab, setActiveTab] = useState('grain'); // 'grain' or 'modulation'
  const [selectedPreset, setSelectedPreset] = useState('default');
  const [continuousMode, setContinuousMode] = useState(true); // Default: true for sustained patterns
  const fileInputRef = useRef(null);

  /**
   * Handle parameter change from knobs
   */
  const handleParamChange = (paramName) => (value) => {
    updateParam(paramName, value);
  };

  /**
   * Handle preset selection
   */
  const handlePresetChange = (e) => {
    const presetId = e.target.value;
    setSelectedPreset(presetId);

    const preset = GRANULAR_PRESETS.find(p => p.id === presetId);
    if (preset) {
      loadPreset(preset);
    }
  };

  /**
   * Handle envelope type change
   */
  const handleEnvelopeChange = (e) => {
    updateParam('grainEnvelope', e.target.value);
  };

  /**
   * Handle continuous mode toggle
   */
  const handleContinuousModeToggle = () => {
    const newMode = !continuousMode;
    setContinuousMode(newMode);

    // Send to audio engine
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const instrument = audioEngine.instruments?.get(instrumentId);
      if (instrument && typeof instrument.setContinuousMode === 'function') {
        instrument.setContinuousMode(newMode);
      }
    }
  };

  /**
   * Handle sample file drop
   */
  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      loadSample(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      loadSample(file);
    }
  };

  /**
   * Trigger file input click
   */
  const handleChooseFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="granular-sampler">
      {/* Header */}
      <div className="granular-sampler__header">
        <div className="granular-sampler__title">
          <h2>SOLSTICE GRAIN</h2>
          <span className="granular-sampler__subtitle">Granular Sampler</span>
        </div>

        {/* Preset Selector */}
        <div className="granular-sampler__preset">
          <label className="preset-label">Preset</label>
          <select
            className="preset-select"
            value={selectedPreset}
            onChange={handlePresetChange}
          >
            {GRANULAR_PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        <div className="granular-sampler__stats">
          <div className="stat">
            <span className="stat__label">Grains</span>
            <span className="stat__value">{stats.activeGrains}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Pool</span>
            <span className="stat__value">{stats.poolUtilization.toFixed(0)}%</span>
          </div>
          <div className="stat">
            <span className="stat__label">Total</span>
            <span className="stat__value">{stats.grainsScheduled}</span>
          </div>
        </div>
      </div>

      {/* Grain Visualizer - Interactive Canvas */}
      <GrainVisualizer
        sampleBuffer={sampleInfo.buffer}
        grainSize={params.grainSize}
        grainDensity={params.grainDensity}
        onGrainClick={triggerGrain}
      />

      {/* Sample Info / Drop Zone */}
      <div
        className="granular-sampler__sample-zone"
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileInputChange}
          className="sample-dropzone__file-input"
        />
        {sampleInfo.loaded ? (
          <div className="sample-info">
            <div className="sample-info__details">
              <span className="sample-info__name">{sampleInfo.name}</span>
              <span className="sample-info__duration">
                {sampleInfo.duration > 0 ? `${sampleInfo.duration.toFixed(2)}s` : 'Loading...'}
              </span>
            </div>
            <button className="sample-info__change-btn" onClick={handleChooseFileClick}>
              Change
            </button>
          </div>
        ) : (
          <div className="sample-dropzone">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2" strokeLinecap="round"/>
              <polyline points="17 8 12 3 7 8" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="3" x2="12" y2="15" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p>Drop audio sample here</p>
            <span className="sample-dropzone__hint">or</span>
            <button className="sample-dropzone__button" onClick={handleChooseFileClick}>
              Choose File
            </button>
          </div>
        )}
      </div>

      {/* Waveform Visualizer */}
      <div className="granular-sampler__waveform">
        <WaveformVisualizer
          sampleBuffer={sampleInfo.buffer}
          samplePosition={params.samplePosition}
          grainSize={params.grainSize}
          onPositionChange={(pos) => updateParam('samplePosition', pos)}
          width={600}
          height={120}
        />
      </div>

      {/* Tabs */}
      <div className="granular-sampler__tabs">
        <button
          className={`tab ${activeTab === 'grain' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('grain')}
        >
          Grain Controls
        </button>
        <button
          className={`tab ${activeTab === 'modulation' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('modulation')}
        >
          Modulation
        </button>
      </div>

      {/* Control Panels */}
      <div className="granular-sampler__controls">
        {activeTab === 'grain' && (
          <div className="control-grid">
            {/* Row 1: Core Grain Parameters */}
            <div className="control-group">
              <label className="control-label">SIZE</label>
              <Knob
                value={params.grainSize}
                min={10}
                max={500}
                onChange={handleParamChange('grainSize')}
                size={56}
                showValue={true}
                unit="ms"
                variant="plugin"
              />
            </div>

            <div className="control-group">
              <label className="control-label">DENSITY</label>
              <Knob
                value={params.grainDensity}
                min={1}
                max={100}
                onChange={handleParamChange('grainDensity')}
                size={56}
                showValue={true}
                unit="/s"
                variant="plugin"
              />
            </div>

            <div className="control-group">
              <label className="control-label">POSITION</label>
              <Knob
                value={params.samplePosition * 100}
                min={0}
                max={100}
                onChange={(v) => handleParamChange('samplePosition')(v / 100)}
                size={56}
                showValue={true}
                unit="%"
                variant="plugin"
              />
            </div>

            <div className="control-group">
              <label className="control-label">POS RND</label>
              <Knob
                value={params.positionRandom * 100}
                min={0}
                max={100}
                onChange={(v) => handleParamChange('positionRandom')(v / 100)}
                size={56}
                showValue={true}
                unit="%"
                variant="plugin"
              />
            </div>

            {/* Row 2: Pitch & Spread */}
            <div className="control-group">
              <label className="control-label">PITCH</label>
              <Knob
                value={params.pitch}
                min={-24}
                max={24}
                onChange={handleParamChange('pitch')}
                size={56}
                showValue={true}
                unit="st"
                variant="plugin"
                defaultValue={0}
              />
            </div>

            <div className="control-group">
              <label className="control-label">PITCH RND</label>
              <Knob
                value={params.pitchRandom}
                min={0}
                max={12}
                onChange={handleParamChange('pitchRandom')}
                size={56}
                showValue={true}
                unit="st"
                variant="plugin"
              />
            </div>

            <div className="control-group">
              <label className="control-label">SPREAD</label>
              <Knob
                value={params.spread * 100}
                min={0}
                max={100}
                onChange={(v) => handleParamChange('spread')(v / 100)}
                size={56}
                showValue={true}
                unit="%"
                variant="plugin"
              />
            </div>

            <div className="control-group">
              <label className="control-label">GAIN</label>
              <Knob
                value={params.gain * 100}
                min={0}
                max={100}
                onChange={(v) => handleParamChange('gain')(v / 100)}
                size={56}
                showValue={true}
                unit="%"
                variant="plugin"
              />
            </div>
          </div>
        )}

        {activeTab === 'modulation' && (
          <div className="control-grid">
            {/* Envelope Type Selector */}
            <div className="control-group control-group--wide">
              <label className="control-label">ENVELOPE</label>
              <select
                className="envelope-select"
                value={params.grainEnvelope}
                onChange={handleEnvelopeChange}
              >
                <option value="hann">Hann Window (Smooth)</option>
                <option value="triangle">Triangle (Sharp)</option>
                <option value="gaussian">Gaussian (Natural)</option>
              </select>
            </div>

            {/* Reverse Probability */}
            <div className="control-group">
              <label className="control-label">REVERSE</label>
              <Knob
                value={params.reverse * 100}
                min={0}
                max={100}
                onChange={(v) => handleParamChange('reverse')(v / 100)}
                size={56}
                showValue={true}
                unit="%"
                variant="plugin"
              />
            </div>

            {/* Mix (for future wet/dry) */}
            <div className="control-group">
              <label className="control-label">MIX</label>
              <Knob
                value={params.mix * 100}
                min={0}
                max={100}
                onChange={(v) => handleParamChange('mix')(v / 100)}
                size={56}
                showValue={true}
                unit="%"
                variant="plugin"
              />
            </div>

            {/* Continuous Mode Toggle */}
            <div className="control-group control-group--wide">
              <label className="control-label">PLAYBACK MODE</label>
              <button
                className={`mode-toggle ${continuousMode ? 'mode-toggle--active' : ''}`}
                onClick={handleContinuousModeToggle}
              >
                <span className="mode-toggle__icon">
                  {continuousMode ? '∞' : '1'}
                </span>
                <span className="mode-toggle__label">
                  {continuousMode ? 'Continuous' : 'One-Shot'}
                </span>
              </button>
              <p className="mode-toggle__hint">
                {continuousMode
                  ? 'Grains emit continuously on noteOn'
                  : 'Single burst of grains per note'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="granular-sampler__footer">
        <span className="footer-hint">
          💡 Tip: Lower grain size + high density = smooth textures
        </span>
      </div>
    </div>
  );
};

export default GranularSamplerUI;
