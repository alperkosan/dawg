/**
 * Drum Sampler Editor
 * Editor for single-shot sample instruments (Kick, Snare, etc.)
 */

import { useEffect, useCallback } from 'react';
import { getPreviewManager } from '@/lib/audio/preview';
import { AudioContextService } from '@/lib/services/AudioContextService';
import Slider from '../controls/Slider';
import './DrumSamplerEditor.css';

const DrumSamplerEditor = ({ instrumentData }) => {
  const sampleUrl = instrumentData.url || '';
  const sampleName = sampleUrl.split('/').pop();

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
      previewManager.previewNote(60, 100, 2.0); // Middle C, 2 second preview
    }
  }, []);

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
        <div className="drumsampler-editor__waveform">
          <div className="drumsampler-editor__waveform-placeholder">
            Waveform visualization coming soon...
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Playback</div>
        <div className="drumsampler-editor__controls">
          <Slider
            label="Pitch"
            value={0}
            min={-12}
            max={12}
            step={0.1}
            color="#D4A259"
            formatValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} st`}
            onChange={(value) => console.log('Pitch:', value)}
          />
          <Slider
            label="Volume"
            value={0}
            min={-24}
            max={12}
            step={0.1}
            color="#D4A259"
            formatValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
            onChange={(value) => console.log('Volume:', value)}
          />
          <Slider
            label="Pan"
            value={0}
            min={-1}
            max={1}
            step={0.01}
            color="#D4A259"
            formatValue={(v) => {
              if (v === 0) return 'Center';
              if (v < 0) return `${Math.abs(v * 100).toFixed(0)}% L`;
              return `${(v * 100).toFixed(0)}% R`;
            }}
            onChange={(value) => console.log('Pan:', value)}
          />
        </div>
      </div>

      {/* Info */}
      <div className="drumsampler-editor__section">
        <div className="drumsampler-editor__section-title">Info</div>
        <div className="drumsampler-editor__info">
          <p>This is a one-shot drum sample instrument.</p>
          <p>Full editor with ADSR envelope and effects coming soon!</p>
        </div>
      </div>
    </div>
  );
};

export default DrumSamplerEditor;
