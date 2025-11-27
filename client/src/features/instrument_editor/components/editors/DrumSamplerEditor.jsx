/**
 * Drum Sampler Editor
 * Editor for single-shot sample instruments (Kick, Snare, etc.)
 * Features: Waveform visualization, playback controls, preview
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { getPreviewManager } from '@/lib/audio/preview';
import { AudioContextService } from '@/lib/services/AudioContextService';
import useInstrumentEditorStore from '../../../../store/useInstrumentEditorStore';
import { Slider } from '@/components/controls/base/Slider';
import { WaveformWorkbench } from '@/features/sample_editor_v3/components/WaveformWorkbench';
import '@/features/sample_editor_v3/SampleEditorV3.css';
import './DrumSamplerEditor.css';
import { ADSRCanvas } from '../../../../components/controls/canvas/ADSRCanvas';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const ENVELOPE_PRESETS = [
  {
    id: 'short-pluck',
    name: 'Short Pluck',
    attack: 5,
    decay: 160,
    sustain: 20,
    release: 60
  },
  {
    id: 'medium-hit',
    name: 'Medium Hit',
    attack: 10,
    decay: 400,
    sustain: 40,
    release: 120
  },
  {
    id: 'long-tail',
    name: 'Long Tail',
    attack: 40,
    decay: 800,
    sustain: 70,
    release: 600
  },
  {
    id: '808-stab',
    name: '808 Stab',
    attack: 0,
    decay: 0,
    sustain: 100,
    release: 0
  }
];

const LFO_SHAPES = [
  { id: 'sine', label: 'Sine' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'square', label: 'Square' }
];
const DrumSamplerEditor = ({ instrumentData }) => {
  const sampleUrl = instrumentData.url || '';
  const sampleName = sampleUrl.split('/').pop();
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const waveformData = useMemo(() => {
    if (!audioBuffer) return null;
    const channelData = audioBuffer.getChannelData(0);
    const bucketCount = 512;
    const samplesPerBucket = Math.max(1, Math.floor(channelData.length / bucketCount));
    const buckets = [];
    for (let i = 0; i < bucketCount; i += 1) {
      const start = i * samplesPerBucket;
      if (start >= channelData.length) break;
      let min = 1;
      let max = -1;
      for (let j = 0; j < samplesPerBucket && start + j < channelData.length; j += 1) {
        const sample = channelData[start + j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      buckets.push({ min, max });
    }
    return {
      duration: audioBuffer.duration,
      buckets,
    };
  }, [audioBuffer]);

  // Load audio buffer for waveform
  useEffect(() => {
    if (!sampleUrl) return;

    const loadAudio = async () => {
      try {
        const audioEngine = AudioContextService.getAudioEngine();
        if (!audioEngine?.audioContext) return;

        const response = await fetch(sampleUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioEngine.audioContext.decodeAudioData(arrayBuffer);

        setAudioBuffer(buffer);
        console.log('✅ Audio buffer loaded for waveform:', buffer.duration, 'seconds');
      } catch (error) {
        console.error('❌ Failed to load audio for waveform:', error);
      }
    };

    loadAudio();
  }, [sampleUrl]);

  // Setup PreviewManager with current instrument
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.audioContext && instrumentData) {
      // ✅ FX CHAIN: Pass audioEngine to PreviewManager for mixer routing
      const previewManager = getPreviewManager(audioEngine.audioContext, audioEngine);
      previewManager.setInstrument(instrumentData);
    }
  }, [instrumentData]);

  // Play sample preview
  const handlePreview = useCallback(() => {
    const previewManager = getPreviewManager();
    if (previewManager) {
      setIsPlaying(true);
      setCurrentTime(0);
      previewManager.previewNote(60, 100, 2.0); // Middle C, 2 second preview

      // Update playback position
      const startTime = Date.now();
      const updatePosition = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (audioBuffer && elapsed < audioBuffer.duration) {
          setCurrentTime(elapsed);
          requestAnimationFrame(updatePosition);
        } else {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      };
      requestAnimationFrame(updatePosition);
    }
  }, [audioBuffer]);

  // Handle parameter change with real-time audio engine update
  const handleParameterChange = useCallback((paramName, value) => {
    // Update store
    useInstrumentEditorStore.getState().updateParameter(paramName, value);

    const payload = { [paramName]: value };

    // Update audio engine in real-time
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && instrumentData.id) {
      const instrument = audioEngine.instruments.get(instrumentData.id);
      if (instrument && typeof instrument.updateParameters === 'function') {
        instrument.updateParameters(payload);
        console.log(`✅ ${paramName} updated in audio engine:`, value);
      }
    }

    // Keep preview instrument in sync so Preview button matches editor params
    const previewManager = getPreviewManager();
    if (previewManager?.previewInstrument && typeof previewManager.previewInstrument.updateParameters === 'function') {
      try {
        previewManager.previewInstrument.updateParameters(payload);
      } catch (err) {
        console.warn('Preview instrument parameter sync failed', err);
      }
    }
  }, [instrumentData.id]);

  // Convert instrument data (ms/0-100) to ADSRCanvas format (s/0-1)
  const adsrValues = useMemo(() => ({
    attack: (instrumentData.attack ?? 0) / 1000,
    decay: (instrumentData.decay ?? 0) / 1000,
    sustain: (instrumentData.sustain ?? 100) / 100,
    release: (instrumentData.release ?? 50) / 1000
  }), [instrumentData.attack, instrumentData.decay, instrumentData.sustain, instrumentData.release]);

  const envelopeEnabled = instrumentData.envelopeEnabled ?? true;
  const envelopeTempoSync = instrumentData.envelopeTempoSync ?? false;
  const volumeLfo = instrumentData.volumeLfo || {
    shape: 'sine',
    delay: 0,
    attack: 0,
    amount: 50,
    speed: 2,
    global: false,
    tempoSync: false
  };

  const handleADSRChange = useCallback((newValues) => {
    // Convert ADSRCanvas format (s/0-1) back to instrument data (ms/0-100)
    if (newValues.attack !== undefined) handleParameterChange('attack', newValues.attack * 1000);
    if (newValues.decay !== undefined) handleParameterChange('decay', newValues.decay * 1000);
    if (newValues.sustain !== undefined) handleParameterChange('sustain', newValues.sustain * 100);
    if (newValues.release !== undefined) handleParameterChange('release', newValues.release * 1000);
  }, [handleParameterChange]);

  const handleEnvelopePreset = (presetId) => {
    const preset = ENVELOPE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    handleParameterChange('attack', preset.attack);
    handleParameterChange('decay', preset.decay);
    handleParameterChange('sustain', preset.sustain);
    handleParameterChange('release', preset.release);
  };

  const handleLfoChange = (key, value) => {
    const next = { ...volumeLfo, [key]: value };
    handleParameterChange('volumeLfo', next);
  };

  const handleInstrumentRegionUpdate = useCallback(
    (updates) => {
      if (!updates) return;
      Object.entries(updates).forEach(([param, value]) => {
        handleParameterChange(param, value);
      });
    },
    [handleParameterChange]
  );

  return (
    <div className="drumsampler-editor">
      {/* Sample Info */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Sample</div>
        <div className="drumsampler-editor__sample-card">
          <div className="drumsampler-editor__sample-icon">🥁</div>
          <div className="drumsampler-editor__sample-info">
            <div className="drumsampler-editor__sample-name">{sampleName}</div>
            <div className="drumsampler-editor__sample-path">{sampleUrl}</div>
          </div>
          <button className="drumsampler-editor__preview-btn" onClick={handlePreview}>
            ▶ Preview
          </button>
        </div>
      </div>

      {/* Advanced Sample Editor */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Sample Editor</div>
        <WaveformWorkbench
          instrument={instrumentData}
          buffer={audioBuffer}
          onInstrumentChange={handleInstrumentRegionUpdate}
        />
      </div>

      {/* Playback Controls */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Playback</div>
        <div className="drumsampler-editor__controls">
          <Slider
            label="Pitch"
            value={instrumentData.pitch || 0}
            min={-12}
            max={12}
            step={0.1}
            color="#D4A259"
            formatValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} st`}
            onChange={(value) => handleParameterChange('pitch', value)}
          />
          <Slider
            label="Volume"
            value={instrumentData.gain !== undefined ? (instrumentData.gain - 1) * 24 : 0}
            min={-24}
            max={12}
            step={0.1}
            color="#D4A259"
            formatValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
            onChange={(value) => {
              const gain = Math.pow(10, value / 20);
              handleParameterChange('gain', gain);
            }}
          />
          <Slider
            label="Pan"
            value={instrumentData.pan || 0}
            min={-1}
            max={1}
            step={0.01}
            color="#D4A259"
            formatValue={(v) => {
              if (v === 0) return 'Center';
              if (v < 0) return `${Math.abs(v * 100).toFixed(0)}% L`;
              return `${(v * 100).toFixed(0)}% R`;
            }}
            onChange={(value) => handleParameterChange('pan', value)}
          />
        </div>
        <div className="drumsampler-editor__toggle-row">
          <button
            className={`drumsampler-editor__toggle ${instrumentData.reverse ? 'drumsampler-editor__toggle--active' : ''}`}
            onClick={() => handleParameterChange('reverse', !instrumentData.reverse)}
          >
            {instrumentData.reverse ? '⏪ Reverse' : '⏩ Reverse'}
          </button>
        </div>
      </div>

      {/* Envelope */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Envelope (ADSR)</div>
        <div className="drumsampler-editor__envelope-toolbar">
          <button
            type="button"
            className={`drumsampler-editor__toggle ${envelopeEnabled ? 'drumsampler-editor__toggle--active' : ''}`}
            onClick={() => handleParameterChange('envelopeEnabled', !envelopeEnabled)}
          >
            {envelopeEnabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            type="button"
            className={`drumsampler-editor__toggle ${envelopeTempoSync ? 'drumsampler-editor__toggle--active' : ''}`}
            onClick={() => handleParameterChange('envelopeTempoSync', !envelopeTempoSync)}
          >
            Tempo Sync
          </button>
          <select
            className="drumsampler-editor__preset-select"
            defaultValue=""
            onChange={(e) => e.target.value && handleEnvelopePreset(e.target.value)}
          >
            <option value="" disabled>Apply Preset...</option>
            {ENVELOPE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </div>
        <ADSRCanvas
          {...adsrValues}
          onChange={handleADSRChange}
          width={360}
          height={100}
        />
        <div className="drumsampler-editor__controls">
          <Slider
            label="Attack"
            value={instrumentData.attack !== undefined ? instrumentData.attack : 0}
            min={0}
            max={1000}
            step={1}
            color="#FF6B9D"
            formatValue={(v) => `${v.toFixed(0)} ms`}
            onChange={(value) => handleParameterChange('attack', value)}
          />
          <Slider
            label="Decay"
            value={instrumentData.decay !== undefined ? instrumentData.decay : 0}
            min={0}
            max={2000}
            step={1}
            color="#FF6B9D"
            formatValue={(v) => `${v.toFixed(0)} ms`}
            onChange={(value) => handleParameterChange('decay', value)}
          />
          <Slider
            label="Sustain"
            value={instrumentData.sustain !== undefined ? instrumentData.sustain : 100}
            min={0}
            max={100}
            step={1}
            color="#FF6B9D"
            formatValue={(v) => `${v.toFixed(0)}%`}
            onChange={(value) => handleParameterChange('sustain', value)}
          />
          <Slider
            label="Release"
            value={instrumentData.release !== undefined ? instrumentData.release : 50}
            min={0}
            max={2000}
            step={1}
            color="#FF6B9D"
            formatValue={(v) => `${v.toFixed(0)} ms`}
            onChange={(value) => handleParameterChange('release', value)}
          />
        </div>
        <div className="drumsampler-editor__lfo-card">
          <div className="drumsampler-editor__lfo-header">
            <h4>Volume LFO</h4>
            <div className="drumsampler-editor__lfo-actions">
              <button
                type="button"
                className={`drumsampler-editor__toggle ${volumeLfo.tempoSync ? 'drumsampler-editor__toggle--active' : ''}`}
                onClick={() => handleLfoChange('tempoSync', !volumeLfo.tempoSync)}
              >
                Tempo
              </button>
              <button
                type="button"
                className={`drumsampler-editor__toggle ${volumeLfo.global ? 'drumsampler-editor__toggle--active' : ''}`}
                onClick={() => handleLfoChange('global', !volumeLfo.global)}
              >
                Global
              </button>
            </div>
          </div>
          <div className="drumsampler-editor__lfo-shapes">
            {LFO_SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                className={`drumsampler-editor__shape-btn ${volumeLfo.shape === shape.id ? 'active' : ''}`}
                onClick={() => handleLfoChange('shape', shape.id)}
              >
                {shape.label}
              </button>
            ))}
          </div>
          <div className="drumsampler-editor__controls">
            <Slider
              label="Delay"
              value={volumeLfo.delay ?? 0}
              min={0}
              max={2000}
              step={1}
              color="#9C27B0"
              formatValue={(v) => `${v.toFixed(0)} ms`}
              onChange={(value) => handleLfoChange('delay', value)}
            />
            <Slider
              label="Attack"
              value={volumeLfo.attack ?? 0}
              min={0}
              max={2000}
              step={1}
              color="#9C27B0"
              formatValue={(v) => `${v.toFixed(0)} ms`}
              onChange={(value) => handleLfoChange('attack', value)}
            />
            <Slider
              label="Amount"
              value={volumeLfo.amount ?? 50}
              min={-100}
              max={100}
              step={1}
              color="#9C27B0"
              formatValue={(v) => `${v.toFixed(0)}%`}
              onChange={(value) => handleLfoChange('amount', value)}
            />
            <Slider
              label="Speed"
              value={volumeLfo.speed ?? 2}
              min={0.1}
              max={20}
              step={0.1}
              color="#9C27B0"
              formatValue={(v) => `${v.toFixed(1)} Hz`}
              onChange={(value) => handleLfoChange('speed', value)}
            />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Filter</div>
        <div className="drumsampler-editor__controls">
          <Slider
            label="Cutoff"
            value={instrumentData.filterCutoff || 20000}
            min={20}
            max={20000}
            step={1}
            color="#9C27B0"
            formatValue={(v) => {
              if (v >= 1000) return `${(v / 1000).toFixed(1)} kHz`;
              return `${v.toFixed(0)} Hz`;
            }}
            onChange={(value) => handleParameterChange('filterCutoff', value)}
          />
          <Slider
            label="Resonance"
            value={instrumentData.filterResonance || 0}
            min={0}
            max={30}
            step={0.1}
            color="#9C27B0"
            formatValue={(v) => `${v.toFixed(1)} Q`}
            onChange={(value) => handleParameterChange('filterResonance', value)}
          />
          <Slider
            label="Filter Env"
            value={instrumentData.filterEnvAmount || 0}
            min={-12000}
            max={12000}
            step={10}
            color="#9C27B0"
            formatValue={(v) => {
              const abs = Math.abs(v);
              const sign = v >= 0 ? '+' : '-';
              if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)} kHz`;
              return `${sign}${abs.toFixed(0)} Hz`;
            }}
            onChange={(value) => handleParameterChange('filterEnvAmount', value)}
          />
        </div>

        {/* Filter Type Toggle */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            className={`drumsampler-editor__toggle ${(!instrumentData.filterType || instrumentData.filterType === 'lowpass') ? 'drumsampler-editor__toggle--active' : ''}`}
            onClick={() => handleParameterChange('filterType', 'lowpass')}
          >
            Lowpass
          </button>
          <button
            className={`drumsampler-editor__toggle ${instrumentData.filterType === 'highpass' ? 'drumsampler-editor__toggle--active' : ''}`}
            onClick={() => handleParameterChange('filterType', 'highpass')}
          >
            Highpass
          </button>
          <button
            className={`drumsampler-editor__toggle ${instrumentData.filterType === 'bandpass' ? 'drumsampler-editor__toggle--active' : ''}`}
            onClick={() => handleParameterChange('filterType', 'bandpass')}
          >
            Bandpass
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Tips</div>
        <div className="drumsampler-editor__info">
          <p>💡 Use <strong>Start/End</strong> to trim the sample</p>
          <p>🔁 Enable <strong>Loop</strong> for sustained sounds</p>
          <p>🎚️ Adjust <strong>ADSR</strong> envelope for dynamics</p>
          <p>🎵 Use <strong>Pitch</strong> to create melodic variations</p>
        </div>
      </div>
    </div>
  );
};

export default DrumSamplerEditor;
