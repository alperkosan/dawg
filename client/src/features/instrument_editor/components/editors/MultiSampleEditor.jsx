/**
 * Multi-Sample Editor
 * Editor for multi-sampled instruments (Piano, etc.)
 */

import { useEffect, useCallback, useState } from 'react';
import { getPreviewManager } from '@/lib/audio/preview';
import { AudioContextService } from '@/lib/services/AudioContextService';
import './MultiSampleEditor.css';

const MultiSampleEditor = ({ instrumentData }) => {
  const samples = instrumentData.multiSamples || [];
  const [activeNote, setActiveNote] = useState(null);

  // Setup PreviewManager with current instrument
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.audioContext && instrumentData) {
      const previewManager = getPreviewManager(audioEngine.audioContext);
      previewManager.setInstrument(instrumentData);
    }
  }, [instrumentData]);

  // Play sample preview
  const handleSamplePreview = useCallback((midiNote) => {
    const previewManager = getPreviewManager();
    if (previewManager) {
      previewManager.previewNote(midiNote, 100, 2.0); // 2 second preview
    }
  }, []);

  // Preview keyboard handlers
  const handleNoteOn = useCallback((note, octave) => {
    const previewManager = getPreviewManager();
    if (previewManager) {
      const pitch = note + octave;
      previewManager.previewNote(pitch, 100, null); // Sustain until released
      setActiveNote(pitch);
    }
  }, []);

  const handleNoteOff = useCallback(() => {
    const previewManager = getPreviewManager();
    if (previewManager) {
      previewManager.stopPreview();
      setActiveNote(null);
    }
  }, []);

  return (
    <div className="multisample-editor">
      {/* Sample List */}
      <div className="multisample-editor__section">
        <div className="multisample-editor__section-title">Samples ({samples.length})</div>
        <div className="multisample-editor__sample-list">
          {samples.map((sample, index) => (
            <div key={index} className="multisample-editor__sample">
              <div className="multisample-editor__sample-icon">🎵</div>
              <div className="multisample-editor__sample-info">
                <div className="multisample-editor__sample-name">
                  {sample.url.split('/').pop()}
                </div>
                <div className="multisample-editor__sample-meta">
                  {sample.note} (MIDI {sample.midiNote})
                </div>
              </div>
              <button
                className="multisample-editor__sample-action"
                onClick={() => handleSamplePreview(sample.midiNote)}
              >
                ▶
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Keyboard */}
      <div className="multisample-editor__section">
        <div className="multisample-editor__section-title">Preview</div>
        <div className="multisample-editor__keyboard">
          {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((note) => {
            const pitch = note + '4';
            const isActive = activeNote === pitch;
            return (
              <button
                key={note}
                className={`multisample-editor__key ${note.includes('#') ? 'multisample-editor__key--black' : 'multisample-editor__key--white'} ${isActive ? 'multisample-editor__key--active' : ''}`}
                onMouseDown={() => handleNoteOn(note, '4')}
                onMouseUp={handleNoteOff}
                onMouseLeave={handleNoteOff}
              >
                {!note.includes('#') && <span className="multisample-editor__key-label">{note}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="multisample-editor__section">
        <div className="multisample-editor__section-title">Info</div>
        <div className="multisample-editor__info">
          <p>This instrument uses <strong>{samples.length} samples</strong> across the keyboard range.</p>
          <p>Each MIDI note is mapped to the nearest sample with automatic pitch shifting.</p>
        </div>
      </div>
    </div>
  );
};

export default MultiSampleEditor;
