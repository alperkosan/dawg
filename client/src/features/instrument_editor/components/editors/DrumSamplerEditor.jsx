/**
 * Drum Sampler Editor
 * Editor for single-shot sample instruments (Kick, Snare, etc.)
 * Features: Waveform visualization, playback controls, preview
 */

import { useEffect, useCallback, useState } from 'react';
import { getPreviewManager } from '@/lib/audio/preview';
import { AudioContextService } from '@/lib/services/AudioContextService';
import useInstrumentEditorStore from '../../../../store/useInstrumentEditorStore';
import Slider from '../controls/Slider';
import WaveformDisplay from '../WaveformDisplay';
import './DrumSamplerEditor.css';

const DrumSamplerEditor = ({ instrumentData }) => {
  const sampleUrl = instrumentData.url || '';
  const sampleName = sampleUrl.split('/').pop();
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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
      const previewManager = getPreviewManager(audioEngine.audioContext);
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

  // Handle waveform seek
  const handleSeek = useCallback((time) => {
    console.log('🎯 Seek to:', time);
    // TODO: Implement actual seeking when preview supports it
  }, []);

  // Handle parameter change with real-time audio engine update
  const handleParameterChange = useCallback((paramName, value) => {
    // Update store
    useInstrumentEditorStore.getState().updateParameter(paramName, value);

    // Update audio engine in real-time
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && instrumentData.id) {
      const instrument = audioEngine.instruments.get(instrumentData.id);
      if (instrument && typeof instrument.updateParameters === 'function') {
        instrument.updateParameters({ [paramName]: value });
        console.log(`✅ ${paramName} updated in audio engine:`, value);
      }
    }
  }, [instrumentData.id]);

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

      {/* Waveform Display */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Waveform</div>
        <WaveformDisplay
          audioBuffer={audioBuffer}
          currentTime={currentTime}
          isPlaying={isPlaying}
          height={120}
          loopStart={instrumentData.loopStart || 0}
          loopEnd={instrumentData.loopEnd || 1}
          showRMS={false}
          onLoopChange={(start, end) => {
            useInstrumentEditorStore.getState().updateParameter('loopStart', start);
            useInstrumentEditorStore.getState().updateParameter('loopEnd', end);
          }}
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
      </div>

      {/* Sample Manipulation */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Sample</div>
        <div className="drumsampler-editor__controls">
          <Slider
            label="Start"
            value={instrumentData.sampleStart || 0}
            min={0}
            max={1}
            step={0.001}
            color="#6B8EBF"
            formatValue={(v) => `${(v * 100).toFixed(1)}%`}
            onChange={(value) => handleParameterChange('sampleStart', value)}
          />
          <Slider
            label="End"
            value={instrumentData.sampleEnd || 1}
            min={0}
            max={1}
            step={0.001}
            color="#6B8EBF"
            formatValue={(v) => `${(v * 100).toFixed(1)}%`}
            onChange={(value) => handleParameterChange('sampleEnd', value)}
          />
          <Slider
            label="Loop Start"
            value={instrumentData.loopStart || 0}
            min={0}
            max={1}
            step={0.001}
            color="#FFB74D"
            formatValue={(v) => `${(v * 100).toFixed(1)}%`}
            onChange={(value) => handleParameterChange('loopStart', value)}
          />
          <Slider
            label="Loop End"
            value={instrumentData.loopEnd || 1}
            min={0}
            max={1}
            step={0.001}
            color="#FFB74D"
            formatValue={(v) => `${(v * 100).toFixed(1)}%`}
            onChange={(value) => handleParameterChange('loopEnd', value)}
          />
        </div>

        {/* Toggle Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            className={`drumsampler-editor__toggle ${instrumentData.loop ? 'drumsampler-editor__toggle--active' : ''}`}
            onClick={() => handleParameterChange('loop', !instrumentData.loop)}
          >
            {instrumentData.loop ? '🔁' : '▶️'} Loop
          </button>
          <button
            className={`drumsampler-editor__toggle ${instrumentData.reverse ? 'drumsampler-editor__toggle--active' : ''}`}
            onClick={() => handleParameterChange('reverse', !instrumentData.reverse)}
          >
            {instrumentData.reverse ? '⏪' : '⏩'} Reverse
          </button>
        </div>
      </div>

      {/* Envelope */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Envelope (ADSR)</div>
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
