/**
 * VASynth Editor
 * Full editor for Virtual Analog Synth instruments
 */

import { useCallback, useEffect, useState } from 'react';
import useInstrumentEditorStore from '../../../../store/useInstrumentEditorStore';
import { getPreviewManager } from '@/lib/audio/preview';
import { AudioContextService } from '@/lib/services/AudioContextService';
import Knob from '../controls/Knob';
import Slider from '../controls/Slider';
import './VASynthEditor.css';

const VASynthEditor = ({ instrumentData }) => {
  const { updateParameter, getParameter } = useInstrumentEditorStore();
  const [activeNote, setActiveNote] = useState(null);

  // Get preset data
  const presetName = instrumentData.presetName || 'Piano';

  // Setup PreviewManager with current instrument
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.audioContext && instrumentData) {
      const previewManager = getPreviewManager(audioEngine.audioContext);
      previewManager.setInstrument(instrumentData);
    }
  }, [instrumentData]);

  // Handle parameter updates
  const handleParameterChange = useCallback((path, value) => {
    updateParameter(path, value);
  }, [updateParameter]);

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
    <div className="vasynth-editor">
      {/* Preset Info */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">Preset</div>
        </div>
        <div className="vasynth-editor__preset-name">{presetName}</div>
        <div className="vasynth-editor__preset-hint">
          This is a VASynth instrument using the <strong>{presetName}</strong> preset.
          <br />
          Full editor with oscillators, filters, and envelopes coming soon!
        </div>
      </div>

      {/* Oscillators Section */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">Oscillators</div>
        </div>
        <div className="vasynth-editor__oscillators">
          {[1, 2, 3].map((oscNum) => (
            <div key={oscNum} className="vasynth-editor__oscillator">
              <div className="vasynth-editor__oscillator-header">OSC {oscNum}</div>
              <div className="vasynth-editor__oscillator-controls">
                <Knob
                  label="Level"
                  value={0.5}
                  min={0}
                  max={1}
                  size="small"
                  color="#6B8EBF"
                  onChange={(value) => console.log(`OSC${oscNum} level:`, value)}
                />
                <Knob
                  label="Detune"
                  value={0}
                  min={-50}
                  max={50}
                  size="small"
                  color="#6B8EBF"
                  formatValue={(v) => `${v.toFixed(1)}¢`}
                  onChange={(value) => console.log(`OSC${oscNum} detune:`, value)}
                />
              </div>
              <div className="vasynth-editor__waveform-selector">
                <button className="vasynth-editor__waveform-btn vasynth-editor__waveform-btn--active">
                  Saw
                </button>
                <button className="vasynth-editor__waveform-btn">Sqr</button>
                <button className="vasynth-editor__waveform-btn">Tri</button>
                <button className="vasynth-editor__waveform-btn">Sin</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Section */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">Filter</div>
        </div>
        <div className="vasynth-editor__filter">
          <div className="vasynth-editor__filter-row">
            <Slider
              label="Cutoff"
              value={0.6}
              min={0}
              max={1}
              color="#6B8EBF"
              formatValue={(v) => `${Math.round(v * 20000)} Hz`}
              onChange={(value) => console.log('Filter cutoff:', value)}
            />
          </div>
          <div className="vasynth-editor__filter-row">
            <Slider
              label="Resonance"
              value={0.3}
              min={0}
              max={1}
              color="#6B8EBF"
              onChange={(value) => console.log('Filter resonance:', value)}
            />
          </div>
          <div className="vasynth-editor__filter-row">
            <Slider
              label="Envelope Amount"
              value={0.5}
              min={0}
              max={1}
              color="#6B8EBF"
              onChange={(value) => console.log('Filter env:', value)}
            />
          </div>
        </div>
      </div>

      {/* Envelopes Section */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">Filter Envelope</div>
        </div>
        <div className="vasynth-editor__adsr">
          <Knob
            label="Attack"
            value={0.01}
            min={0.001}
            max={2}
            color="#6B8EBF"
            formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => console.log('Filter attack:', value)}
          />
          <Knob
            label="Decay"
            value={0.1}
            min={0.001}
            max={2}
            color="#6B8EBF"
            formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => console.log('Filter decay:', value)}
          />
          <Knob
            label="Sustain"
            value={0.7}
            min={0}
            max={1}
            color="#6B8EBF"
            onChange={(value) => console.log('Filter sustain:', value)}
          />
          <Knob
            label="Release"
            value={0.3}
            min={0.001}
            max={4}
            color="#6B8EBF"
            formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => console.log('Filter release:', value)}
          />
        </div>
      </div>

      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">Amplitude Envelope</div>
        </div>
        <div className="vasynth-editor__adsr">
          <Knob
            label="Attack"
            value={0.01}
            min={0.001}
            max={2}
            color="#B67BA3"
            formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => console.log('Amp attack:', value)}
          />
          <Knob
            label="Decay"
            value={0.2}
            min={0.001}
            max={2}
            color="#B67BA3"
            formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => console.log('Amp decay:', value)}
          />
          <Knob
            label="Sustain"
            value={0.8}
            min={0}
            max={1}
            color="#B67BA3"
            onChange={(value) => console.log('Amp sustain:', value)}
          />
          <Knob
            label="Release"
            value={0.5}
            min={0.001}
            max={4}
            color="#B67BA3"
            formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => console.log('Amp release:', value)}
          />
        </div>
      </div>

      {/* Preview Keyboard */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">Preview</div>
        </div>
        <div className="vasynth-editor__keyboard">
          {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((note) => {
            const pitch = note + '4';
            const isActive = activeNote === pitch;
            return (
              <button
                key={note}
                className={`vasynth-editor__key ${note.includes('#') ? 'vasynth-editor__key--black' : 'vasynth-editor__key--white'} ${isActive ? 'vasynth-editor__key--active' : ''}`}
                onMouseDown={() => handleNoteOn(note, '4')}
                onMouseUp={handleNoteOff}
                onMouseLeave={handleNoteOff}
              >
                {!note.includes('#') && <span className="vasynth-editor__key-label">{note}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VASynthEditor;
