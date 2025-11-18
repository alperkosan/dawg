import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import useInstrumentEditorStore from '@/store/useInstrumentEditorStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import Knob from '../controls/Knob';
import Slider from '../controls/Slider';
import GranularPatternEditor from './GranularPatternEditor';
import './GranularModePanel.css';

const DEFAULT_SETTINGS = {
  macro: {
    density: 12,
    grainSize: 120,
    jitter: 0.15,
    stretch: 1,
    pitch: 0,
    mix: 1,
  },
  advanced: {
    random: {
      position: 0.15,
      pitch: 2,
      reverseProb: 0.1,
    },
    envelope: {
      window: 'hann',
      attack: 12,
      hold: 0,
      release: 80,
    },
    spatial: {
      spread: 0.7,
      panRandom: 0.1,
      doppler: 0,
    },
  },
  modulationTargets: [],
  snapshots: [],
};

const MACRO_CONTROLS = [
  {
    key: 'density',
    label: 'Density',
    min: 1,
    max: 48,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}/s`,
    color: '#4CAF50',
  },
  {
    key: 'grainSize',
    label: 'Grain Size',
    min: 20,
    max: 400,
    step: 5,
    format: (v) => `${v.toFixed(0)}ms`,
    color: '#F39C12',
  },
  {
    key: 'jitter',
    label: 'Jitter',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    color: '#9B59B6',
  },
  {
    key: 'stretch',
    label: 'Stretch',
    min: 0.25,
    max: 4,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}×`,
    color: '#1ABC9C',
  },
  {
    key: 'pitch',
    label: 'Pitch',
    min: -12,
    max: 12,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}st`,
    color: '#3498DB',
  },
  {
    key: 'mix',
    label: 'Mix',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    color: '#E74C3C',
  },
];

const ADVANCED_TABS = [
  { id: 'random', label: 'Random' },
  { id: 'envelope', label: 'Envelope' },
  { id: 'spatial', label: 'Spatial' },
  { id: 'modulation', label: 'Modulation' },
  { id: 'snapshots', label: 'Snapshots' },
];

const GranularModePanel = ({
  instrumentId,
  mode,
  settings,
  pattern,
  onModeChange,
  onPatternChange,
}) => {
  const { updateParameter } = useInstrumentEditorStore();
  const { updateInstrument } = useInstrumentsStore();
  const syncPatternDefault = useCallback((trackId, value) => {
    if (!pattern || !onPatternChange) return;
    if (!pattern.tracks || pattern.tracks.length === 0) return;
    const targetTrack = pattern.tracks.find((track) => track.id === trackId);
    if (!targetTrack) return;
    if (typeof targetTrack.defaultValue === 'number' && Math.abs(targetTrack.defaultValue - value) < 0.0001) {
      return;
    }
    const nextPattern = {
      ...pattern,
      tracks: pattern.tracks.map((track) =>
        track.id === trackId ? { ...track, defaultValue: value } : track
      ),
    };
    onPatternChange(nextPattern);
  }, [pattern, onPatternChange]);

  const granularSettings = useMemo(() => {
    if (!settings) {
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      macro: {
        ...DEFAULT_SETTINGS.macro,
        ...(settings.macro || {}),
      },
      advanced: {
        random: {
          ...DEFAULT_SETTINGS.advanced.random,
          ...(settings.advanced?.random || {}),
        },
        envelope: {
          ...DEFAULT_SETTINGS.advanced.envelope,
          ...(settings.advanced?.envelope || {}),
        },
        spatial: {
          ...DEFAULT_SETTINGS.advanced.spatial,
          ...(settings.advanced?.spatial || {}),
        },
      },
      modulationTargets: settings.modulationTargets || [],
      snapshots: settings.snapshots || [],
    };
  }, [settings]);

  const [isDrawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('random');
  const [isPlayheadLocked, setPlayheadLocked] = useState(false);
  const [frozenRandomState, setFrozenRandomState] = useState(null);
  const [activeView, setActiveView] = useState('controls'); // 'controls' | 'pattern'

  const handleUpdateSettings = useCallback(
    (updated) => {
      const merged = JSON.parse(JSON.stringify(updated));
      updateParameter('granularSettings', merged);
      if (instrumentId) {
        updateInstrument(instrumentId, { granularSettings: merged });
      }
    },
    [instrumentId, updateInstrument, updateParameter]
  );

  const handleMacroChange = useCallback(
    (key, value) => {
      const updated = {
        ...granularSettings,
        macro: {
          ...granularSettings.macro,
          [key]: value,
        },
      };
      handleUpdateSettings(updated);
      syncPatternDefault(`macro.${key}`, value);
    },
    [granularSettings, handleUpdateSettings, syncPatternDefault]
  );

  const handleAdvancedChange = useCallback(
    (path, value) => {
      const updated = JSON.parse(JSON.stringify(granularSettings));
      let target = updated;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        if (!target[key]) {
          target[key] = {};
        }
        target = target[key];
      }
      target[path[path.length - 1]] = value;
      handleUpdateSettings(updated);
    const trackId = getTrackIdFromPath(path);
    if (trackId) {
      syncPatternDefault(trackId, value);
    }
    },
    [granularSettings, handleUpdateSettings, syncPatternDefault]
  );

  const handleFreeze = useCallback(() => {
    if (!frozenRandomState) {
      setFrozenRandomState({
        position: granularSettings.advanced.random.position,
        pitch: granularSettings.advanced.random.pitch,
      });
      handleAdvancedChange(['advanced', 'random', 'position'], 0);
      handleAdvancedChange(['advanced', 'random', 'pitch'], 0);
    } else {
      handleAdvancedChange(['advanced', 'random', 'position'], frozenRandomState.position);
      handleAdvancedChange(['advanced', 'random', 'pitch'], frozenRandomState.pitch);
      setFrozenRandomState(null);
    }
  }, [frozenRandomState, granularSettings.advanced.random.pitch, granularSettings.advanced.random.position, handleAdvancedChange]);

  const handleRandomize = useCallback(() => {
    const randomized = {
      ...granularSettings,
      macro: {
        ...granularSettings.macro,
        density: Math.max(1, Math.min(48, granularSettings.macro.density * (0.75 + Math.random() * 0.5))),
        grainSize: Math.max(20, Math.min(400, granularSettings.macro.grainSize * (0.8 + Math.random() * 0.6))),
        jitter: Math.min(1, Math.max(0, granularSettings.macro.jitter + (Math.random() - 0.5) * 0.1)),
        stretch: Math.min(4, Math.max(0.25, granularSettings.macro.stretch * (0.8 + Math.random() * 0.4))),
        pitch: Math.max(-12, Math.min(12, granularSettings.macro.pitch + (Math.random() - 0.5) * 2)),
        mix: Math.min(1, Math.max(0, granularSettings.macro.mix + (Math.random() - 0.5) * 0.1)),
      },
      advanced: {
        ...granularSettings.advanced,
        random: {
          ...granularSettings.advanced.random,
          position: Math.min(1, Math.max(0, granularSettings.advanced.random.position + (Math.random() - 0.5) * 0.1)),
          pitch: Math.min(12, Math.max(0, granularSettings.advanced.random.pitch + (Math.random() - 0.5) * 0.5)),
          reverseProb: Math.min(1, Math.max(0, granularSettings.advanced.random.reverseProb + (Math.random() - 0.5) * 0.2)),
        },
      },
    };
    handleUpdateSettings(randomized);
  }, [granularSettings, handleUpdateSettings]);

  const handleModeChange = useCallback(
    (nextMode) => {
      if (onModeChange) {
        onModeChange(nextMode);
      }
    },
    [onModeChange]
  );

  const handlePatternChange = useCallback(
    (nextPattern) => {
      if (onPatternChange) {
        onPatternChange(nextPattern);
      }
    },
    [onPatternChange]
  );

  const macroSettings = granularSettings.macro;

  return (
    <div className="granular-panel">
      <div className="granular-panel__header">
        <div className="granular-panel__modes">
          <button
            type="button"
            className={`granular-panel__mode-btn ${mode === 'standard' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('standard')}
          >
            Standard
          </button>
          <button
            type="button"
            className={`granular-panel__mode-btn ${mode === 'granular' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('granular')}
          >
            Granular
          </button>
        </div>
        <div className="granular-panel__view-toggle">
          <button
            type="button"
            className={`granular-panel__view-btn ${activeView === 'controls' ? 'is-active' : ''}`}
            onClick={() => setActiveView('controls')}
          >
            Controls
          </button>
          <button
            type="button"
            className={`granular-panel__view-btn ${activeView === 'pattern' ? 'is-active' : ''}`}
            onClick={() => setActiveView('pattern')}
          >
            Pattern
          </button>
        </div>
        <div className="granular-panel__summary">
          <span>{macroSettings.density.toFixed(1)} grains/s</span>
          <span>{macroSettings.grainSize.toFixed(0)} ms grains</span>
          <span>{(macroSettings.jitter * 100).toFixed(0)}% jitter</span>
        </div>
      </div>

      <div className="granular-panel__content">
        {activeView === 'controls' ? (
          <>
            <div className="granular-panel__macro">
              {MACRO_CONTROLS.map((control) => (
                <Knob
                  key={control.key}
                  label={control.label}
                  value={macroSettings[control.key]}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  color={control.color}
                  onChange={(value) => handleMacroChange(control.key, value)}
                  formatValue={control.format}
                  size="medium"
                />
              ))}
            </div>

            <GranularVisualizer
              settings={granularSettings}
              locked={isPlayheadLocked || Boolean(frozenRandomState)}
            />

            <div className="granular-panel__overlay-controls">
              <button
                type="button"
                className={`granular-panel__control-btn ${isPlayheadLocked ? 'is-active' : ''}`}
                onClick={() => setPlayheadLocked((prev) => !prev)}
              >
                {isPlayheadLocked ? 'Unlock Playhead' : 'Lock Playhead'}
              </button>
              <button
                type="button"
                className={`granular-panel__control-btn ${frozenRandomState ? 'is-active' : ''}`}
                onClick={handleFreeze}
              >
                {frozenRandomState ? 'Unfreeze' : 'Freeze'}
              </button>
              <button
                type="button"
                className="granular-panel__control-btn"
                onClick={handleRandomize}
              >
                Randomize
              </button>
            </div>
          </>
        ) : (
          <GranularPatternEditor
            pattern={pattern}
            macroSettings={granularSettings.macro}
            onChange={handlePatternChange}
          />
        )}
      </div>

      <div className="granular-panel__advanced">
        <button
          type="button"
          className="granular-panel__advanced-toggle"
          onClick={() => setDrawerOpen((prev) => !prev)}
        >
          {isDrawerOpen ? 'Hide Advanced Controls' : 'Show Advanced Controls'}
        </button>

        {isDrawerOpen && (
          <div className="granular-panel__advanced-body">
            <div className="granular-panel__tabs">
              {ADVANCED_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`granular-panel__tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="granular-panel__tab-content">
              {activeTab === 'random' && (
                <div className="granular-panel__grid">
                  <Slider
                    label="Position Jitter"
                    value={granularSettings.advanced.random.position}
                    min={0}
                    max={1}
                    step={0.01}
                    color="#9B59B6"
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                    onChange={(value) => handleAdvancedChange(['advanced', 'random', 'position'], value)}
                  />
                  <Slider
                    label="Pitch Random"
                    value={granularSettings.advanced.random.pitch}
                    min={0}
                    max={12}
                    step={0.1}
                    color="#9B59B6"
                    formatValue={(v) => `${v.toFixed(1)}st`}
                    onChange={(value) => handleAdvancedChange(['advanced', 'random', 'pitch'], value)}
                  />
                  <Slider
                    label="Reverse Probability"
                    value={granularSettings.advanced.random.reverseProb}
                    min={0}
                    max={1}
                    step={0.01}
                    color="#9B59B6"
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                    onChange={(value) => handleAdvancedChange(['advanced', 'random', 'reverseProb'], value)}
                  />
                </div>
              )}

              {activeTab === 'envelope' && (
                <div className="granular-panel__grid">
                  <div className="granular-panel__select">
                    <label htmlFor="grain-window">Window</label>
                    <select
                      id="grain-window"
                      value={granularSettings.advanced.envelope.window}
                      onChange={(e) => handleAdvancedChange(['advanced', 'envelope', 'window'], e.target.value)}
                    >
                      <option value="hann">Hann</option>
                      <option value="triangle">Triangle</option>
                      <option value="gaussian">Gaussian</option>
                    </select>
                  </div>
                  <Slider
                    label="Attack"
                    value={granularSettings.advanced.envelope.attack}
                    min={0}
                    max={200}
                    step={1}
                    color="#1ABC9C"
                    formatValue={(v) => `${v.toFixed(0)}ms`}
                    onChange={(value) => handleAdvancedChange(['advanced', 'envelope', 'attack'], value)}
                  />
                  <Slider
                    label="Hold"
                    value={granularSettings.advanced.envelope.hold}
                    min={0}
                    max={200}
                    step={1}
                    color="#1ABC9C"
                    formatValue={(v) => `${v.toFixed(0)}ms`}
                    onChange={(value) => handleAdvancedChange(['advanced', 'envelope', 'hold'], value)}
                  />
                  <Slider
                    label="Release"
                    value={granularSettings.advanced.envelope.release}
                    min={10}
                    max={400}
                    step={5}
                    color="#1ABC9C"
                    formatValue={(v) => `${v.toFixed(0)}ms`}
                    onChange={(value) => handleAdvancedChange(['advanced', 'envelope', 'release'], value)}
                  />
                </div>
              )}

              {activeTab === 'spatial' && (
                <div className="granular-panel__grid">
                  <Slider
                    label="Stereo Spread"
                    value={granularSettings.advanced.spatial.spread}
                    min={0}
                    max={1}
                    step={0.01}
                    color="#3498DB"
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                    onChange={(value) => handleAdvancedChange(['advanced', 'spatial', 'spread'], value)}
                  />
                  <Slider
                    label="Pan Random"
                    value={granularSettings.advanced.spatial.panRandom}
                    min={0}
                    max={1}
                    step={0.01}
                    color="#3498DB"
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                    onChange={(value) => handleAdvancedChange(['advanced', 'spatial', 'panRandom'], value)}
                  />
                  <Slider
                    label="Doppler"
                    value={granularSettings.advanced.spatial.doppler}
                    min={0}
                    max={1}
                    step={0.01}
                    color="#3498DB"
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                    onChange={(value) => handleAdvancedChange(['advanced', 'spatial', 'doppler'], value)}
                  />
                </div>
              )}

              {activeTab === 'modulation' && (
                <div className="granular-panel__placeholder">
                  <p>
                    Granular parameters are exposed to the modulation matrix. Assign LFOs or envelopes to
                    density, pitch, or mix directly from the Modulation tab.
                  </p>
                </div>
              )}

              {activeTab === 'snapshots' && (
                <div className="granular-panel__placeholder">
                  <p>
                    Snapshot management coming soon. Capture multiple granular states and switch between them
                    instantly.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const GranularVisualizer = ({ settings, locked }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = window.devicePixelRatio || 1;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      ctx.fillStyle = 'rgba(5, 7, 12, 0.9)';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const density = settings.macro.density;
      const jitter = settings.macro.jitter;
      const grains = Math.min(220, Math.floor(density * 4));

      for (let i = 0; i < grains; i += 1) {
        const x = (i / grains) * rect.width + (Math.random() - 0.5) * rect.width * jitter * 0.4;
        const y = (Math.random()) * rect.height;
        const size = 2 + Math.random() * 4;
        const alpha = locked ? 0.35 : 0.2 + Math.random() * 0.6;
        ctx.fillStyle = `rgba(52, 152, 219, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      const gradient = ctx.createLinearGradient(0, rect.height - 20, rect.width, rect.height);
      gradient.addColorStop(0, 'rgba(26, 188, 156, 0)');
      gradient.addColorStop(1, 'rgba(26, 188, 156, 0.2)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, rect.height - 20, rect.width, 20);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [settings, locked]);

  return (
    <div className="granular-visualizer">
      <canvas ref={canvasRef} className="granular-visualizer__canvas" />
      <div className="granular-visualizer__overlay">
        <span>{locked ? 'Locked' : 'Live'}</span>
      </div>
    </div>
  );
};

const getTrackIdFromPath = (path) => {
  if (!Array.isArray(path) || path.length < 2) return null;
  if (path[0] !== 'advanced') return null;
  if (path[1] === 'random' && path[2]) return `random.${path[2]}`;
  if (path[1] === 'envelope' && path[2]) return `envelope.${path[2]}`;
  if (path[1] === 'spatial' && path[2]) return `spatial.${path[2]}`;
  return null;
};

export default GranularModePanel;

