/**
 * Multi-Sample Editor
 * Editor for multi-sampled instruments (Piano, etc.)
 * Features: Sample list, waveform preview, keyboard
 */

import { useEffect, useCallback, useState } from 'react';
import { getPreviewManager } from '@/lib/audio/preview';
import { AudioContextService } from '@/lib/services/AudioContextService';
import WaveformDisplay from '../WaveformDisplay';
import './MultiSampleEditor.css';

const MultiSampleEditor = ({ instrumentData }) => {
  const samples = instrumentData.multiSamples || [];
  const [activeNote, setActiveNote] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);

  // Setup PreviewManager with current instrument
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.audioContext && instrumentData) {
      const previewManager = getPreviewManager(audioEngine.audioContext);
      previewManager.setInstrument(instrumentData);
    }
  }, [instrumentData]);

  // Load audio buffer when sample is selected
  useEffect(() => {
    if (!selectedSample) {
      setAudioBuffer(null);
      return;
    }

    const loadAudio = async () => {
      try {
        const audioEngine = AudioContextService.getAudioEngine();
        if (!audioEngine?.audioContext) return;

        const response = await fetch(selectedSample.url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioEngine.audioContext.decodeAudioData(arrayBuffer);

        setAudioBuffer(buffer);
        console.log('✅ Sample buffer loaded:', selectedSample.note);
      } catch (error) {
        console.error('❌ Failed to load sample:', error);
      }
    };

    loadAudio();
  }, [selectedSample]);

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
            <div
              key={index}
              className={`multisample-editor__sample ${selectedSample === sample ? 'multisample-editor__sample--selected' : ''}`}
              onClick={() => setSelectedSample(sample)}
            >
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleSamplePreview(sample.midiNote);
                }}
              >
                ▶
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Waveform Display for Selected Sample */}
      {selectedSample && (
        <div className="multisample-editor__section">
          <div className="multisample-editor__section-title">
            Waveform - {selectedSample.note}
          </div>
          <WaveformDisplay
            audioBuffer={audioBuffer}
            currentTime={0}
            isPlaying={false}
            height={100}
          />
        </div>
      )}

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
