/**
 * VASynth Editor v2
 * Full editor for Virtual Analog Synth instruments with advanced features
 *
 * Features:
 * - Unison mode (2-8 voices per oscillator)
 * - Modulation matrix
 * - Effects chain
 * - Visual feedback (oscilloscope)
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import useInstrumentEditorStore from '../../../../store/useInstrumentEditorStore';
import { getPreviewManager } from '@/lib/audio/preview';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { getPreset } from '@/lib/audio/synth/presets';
import { Knob, Slider } from '@/components/controls';
import './VASynthEditor.css';

const VASynthEditor = ({ instrumentData: initialData }) => {
  const { updateParameter, getParameter } = useInstrumentEditorStore();

  // Get live instrumentData from store (reactive to changes)
  const instrumentData = useInstrumentEditorStore((state) => {
    console.log('🔄 Store selector running, instrumentData:', state.instrumentData);
    return state.instrumentData;
  }) || initialData;

  const [activeNote, setActiveNote] = useState(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);

  // Get preset data
  const presetName = instrumentData.presetName || 'Piano';
  const presetData = getPreset(presetName);

  // ✅ FIX: Initialize instrumentData with preset data on mount
  useEffect(() => {
    if (presetData && instrumentData && !instrumentData.oscillators) {
      console.log('🔧 Initializing instrumentData with preset data:', presetData);

      // Merge preset into instrumentData
      const mergedData = {
        ...instrumentData,
        oscillators: presetData.oscillators,
        filter: presetData.filter,
        filterEnvelope: presetData.filterEnvelope,
        amplitudeEnvelope: presetData.amplitudeEnvelope,
        lfo1: presetData.lfo,
      };

      // Update store with merged data
      useInstrumentEditorStore.setState({ instrumentData: mergedData });
    }
  }, [instrumentData.id]); // Only run when instrument ID changes

  // Default fallback values with unison support
  const defaultOscillators = [
    { enabled: true, waveform: 'sawtooth', detune: 0, octave: 0, level: 0.5, unisonVoices: 1, unisonDetune: 10, unisonPan: 0.5 },
    { enabled: true, waveform: 'sawtooth', detune: -7, octave: 0, level: 0.5, unisonVoices: 1, unisonDetune: 10, unisonPan: 0.5 },
    { enabled: false, waveform: 'square', detune: 0, octave: -1, level: 0.3, unisonVoices: 1, unisonDetune: 10, unisonPan: 0.5 }
  ];

  const defaultFilter = {
    type: 'lowpass',
    cutoff: 2000,
    resonance: 1,
    envelopeAmount: 2000
  };

  const defaultFilterEnvelope = {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3
  };

  const defaultAmplitudeEnvelope = {
    attack: 0.01,
    decay: 0.2,
    sustain: 0.8,
    release: 0.5
  };

  // Get or initialize data from preset with safe fallbacks
  // Merge defaults with existing data to support new parameters
  // Use useMemo to ensure proper reactivity
  const oscillators = useMemo(() => {
    console.log('🔄 useMemo deps changed - instrumentData.oscillators:', instrumentData.oscillators);
    const result = Array.isArray(instrumentData.oscillators)
      ? instrumentData.oscillators.map((osc, index) => ({
          ...defaultOscillators[index],
          ...osc,
        }))
      : (Array.isArray(presetData?.oscillators)
          ? presetData.oscillators.map((osc, index) => ({
              ...defaultOscillators[index],
              ...osc,
            }))
          : defaultOscillators);
    console.log('🔄 Oscillators recomputed:', result);
    return result;
  }, [instrumentData.oscillators, presetData?.oscillators]);

  const filter = instrumentData.filter || presetData?.filter || defaultFilter;
  const filterEnvelope = instrumentData.filterEnvelope || presetData?.filterEnvelope || defaultFilterEnvelope;
  const amplitudeEnvelope = instrumentData.amplitudeEnvelope || presetData?.amplitudeEnvelope || defaultAmplitudeEnvelope;

  // Setup PreviewManager with current instrument (only when instrument ID changes)
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.audioContext && instrumentData) {
      const previewManager = getPreviewManager(audioEngine.audioContext);
      previewManager.setInstrument(instrumentData);
    }
  }, [instrumentData.id]); // Only re-run when instrument ID changes, not on every parameter change!

  // Handle parameter updates
  const handleParameterChange = useCallback((path, value) => {
    console.log(`📝 handleParameterChange called: ${path} =`, value);

    // 1. Update store (for UI state & undo/redo)
    updateParameter(path, value);

    // 2. Update audio engine DIRECTLY (bypassing store->engine chain)
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && instrumentData.id) {
      const instrument = audioEngine.instruments.get(instrumentData.id);
      if (instrument && typeof instrument.updateParameters === 'function') {
        // Build minimal update object based on path
        const updateObj = {};
        const keys = path.split('.');

        if (keys[0] === 'oscillators') {
          // oscillators.0.level -> update oscillator 0's level
          const oscIndex = parseInt(keys[1]);
          const paramName = keys[2];
          // ✅ FIX: Get fresh data from store to include the just-updated value
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.oscillatorSettings = currentData?.oscillators;
        } else if (keys[0] === 'filter') {
          // filter.cutoff -> update filter cutoff
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.filterSettings = currentData?.filter;
        } else if (keys[0] === 'filterEnvelope') {
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.filterEnvelope = currentData?.filterEnvelope;
        } else if (keys[0] === 'amplitudeEnvelope') {
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.amplitudeEnvelope = currentData?.amplitudeEnvelope;
        } else if (keys[0] === 'lfo1') {
          // LFO modulation parameters
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.lfo1 = currentData?.lfo1;
        } else if (keys[0] === 'effects') {
          // Effects toggle
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.effects = currentData?.effects;
        }

        // Call updateParameters DIRECTLY (not through updateInstrumentParameters)
        instrument.updateParameters(updateObj);
        console.log('✅ VASynth parameter updated (direct):', path, value);
      }
    }
  // ✅ FIX: Only depend on stable values, not derived state
  // oscillators/filter/etc are derived from instrumentData and change every render
  // We read fresh values from store inside the callback, so no need for deps
  }, [updateParameter, instrumentData.id]);

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
      // Stop only the last active note if available
      if (activeNote) {
        // Convert 'C4' style to MIDI locally
        const map = { 'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11 };
        const name = activeNote.replace(/[0-9-]/g, '');
        const octave = parseInt(activeNote.replace(/[^0-9-]/g, ''), 10) || 4;
        const midi = (octave + 1) * 12 + (map[name] ?? 0);
        previewManager.stopNote(midi);
      } else {
        previewManager.stopPreview();
      }
      setActiveNote(null);
    }
  }, []);

  // Oscilloscope visualization
  const drawOscilloscope = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      // Clear canvas
      ctx.fillStyle = 'rgba(20, 20, 30, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#667eea';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  // Setup oscilloscope when audio engine is available
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (!audioEngine?.audioContext || !canvasRef.current) return;

    // Create analyser
    const analyser = audioEngine.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    // Connect instrument to analyser
    if (instrumentData.id) {
      const instrument = audioEngine.instruments.get(instrumentData.id);
      if (instrument?.output) {
        try {
          instrument.output.connect(analyser);
          drawOscilloscope();
        } catch (err) {
          console.warn('Failed to connect oscilloscope:', err);
        }
      }
    }

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [instrumentData.id, drawOscilloscope]);

  return (
    <div className="vasynth-editor">
      {/* Preset Info */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">Preset</div>
        </div>
        <div className="vasynth-editor__preset-name">{presetName}</div>
        <div className="vasynth-editor__preset-hint">
          VASynth preset with 3 oscillators, multi-mode filter, and dual ADSR envelopes.
          <br />
          Adjust parameters below and hear changes in real-time!
        </div>
      </div>

      {/* Oscillators Section */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">Oscillators</div>
        </div>
        <div className="vasynth-editor__oscillators">
          {oscillators.map((osc, index) => (
            <div key={index} className="vasynth-editor__oscillator">
              <div className="vasynth-editor__oscillator-header">OSC {index + 1}</div>
              <div className="vasynth-editor__oscillator-controls">
                <Knob
                  key={`level-${index}`}
                  label="Level"
                  value={osc.level}
                  min={0}
                  max={1}
                  sizeVariant="small"
                  valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  onChange={(value) => handleParameterChange(`oscillators.${index}.level`, value)}
                />
                <Knob
                  key={`detune-${index}`}
                  label="Detune"
                  value={osc.detune}
                  min={-50}
                  max={50}
                  sizeVariant="small"
                  valueFormatter={(v) => `${v.toFixed(1)}¢`}
                  onChange={(value) => handleParameterChange(`oscillators.${index}.detune`, value)}
                />
                <Knob
                  key={`unison-${index}`}
                  label="Unison"
                  value={osc.unisonVoices || 1}
                  min={1}
                  max={8}
                  step={1}
                  sizeVariant="small"
                  color="#FFA500"
                  valueFormatter={(v) => `${Math.round(v)}v`}
                  onChange={(value) => handleParameterChange(`oscillators.${index}.unisonVoices`, Math.round(value))}
                />
                {(osc.unisonVoices || 1) > 1 && (
                  <React.Fragment key={`unison-controls-${index}`}>
                    <Knob
                      key={`unison-detune-${index}`}
                      label="U.Detune"
                      value={osc.unisonDetune || 10}
                      min={0}
                      max={50}
                      sizeVariant="small"
                      color="#FFA500"
                      valueFormatter={(v) => `${v.toFixed(1)}¢`}
                      onChange={(value) => handleParameterChange(`oscillators.${index}.unisonDetune`, value)}
                    />
                    <Knob
                      key={`unison-pan-${index}`}
                      label="U.Pan"
                      value={osc.unisonPan || 0.5}
                      min={0}
                      max={1}
                      sizeVariant="small"
                      color="#FFA500"
                      valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      onChange={(value) => handleParameterChange(`oscillators.${index}.unisonPan`, value)}
                    />
                  </React.Fragment>
                )}
              </div>
              <div className="vasynth-editor__waveform-selector">
                <button
                  className={`vasynth-editor__waveform-btn ${osc.waveform === 'sawtooth' ? 'vasynth-editor__waveform-btn--active' : ''}`}
                  onClick={() => handleParameterChange(`oscillators.${index}.waveform`, 'sawtooth')}
                >
                  Saw
                </button>
                <button
                  className={`vasynth-editor__waveform-btn ${osc.waveform === 'square' ? 'vasynth-editor__waveform-btn--active' : ''}`}
                  onClick={() => handleParameterChange(`oscillators.${index}.waveform`, 'square')}
                >
                  Sqr
                </button>
                <button
                  className={`vasynth-editor__waveform-btn ${osc.waveform === 'triangle' ? 'vasynth-editor__waveform-btn--active' : ''}`}
                  onClick={() => handleParameterChange(`oscillators.${index}.waveform`, 'triangle')}
                >
                  Tri
                </button>
                <button
                  className={`vasynth-editor__waveform-btn ${osc.waveform === 'sine' ? 'vasynth-editor__waveform-btn--active' : ''}`}
                  onClick={() => handleParameterChange(`oscillators.${index}.waveform`, 'sine')}
                >
                  Sin
                </button>
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
              value={filter.cutoff}
              min={20}
              max={20000}
              color="#6B8EBF"
              logarithmic
              valueFormatter={(v) => {
                if (v >= 1000) return `${(v / 1000).toFixed(1)} kHz`;
                return `${Math.round(v)} Hz`;
              }}
              onChange={(value) => handleParameterChange('filter.cutoff', value)}
            />
          </div>
          <div className="vasynth-editor__filter-row">
            <Slider
              label="Resonance"
              value={filter.resonance}
              min={0.0001}
              max={30}
              color="#6B8EBF"
              valueFormatter={(v) => `${v.toFixed(1)} Q`}
              onChange={(value) => handleParameterChange('filter.resonance', value)}
            />
          </div>
          <div className="vasynth-editor__filter-row">
            <Slider
              label="Envelope Amount"
              value={filter.envelopeAmount}
              min={-12000}
              max={12000}
              color="#6B8EBF"
              bipolar
              valueFormatter={(v) => {
                const abs = Math.abs(v);
                const sign = v >= 0 ? '+' : '-';
                if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)} kHz`;
                return `${sign}${abs.toFixed(0)} Hz`;
              }}
              onChange={(value) => handleParameterChange('filter.envelopeAmount', value)}
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
            value={filterEnvelope.attack}
            min={0.001}
            max={2}
            color="#6B8EBF"
            valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => handleParameterChange('filterEnvelope.attack', value)}
          />
          <Knob
            label="Decay"
            value={filterEnvelope.decay}
            min={0.001}
            max={2}
            color="#6B8EBF"
            valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => handleParameterChange('filterEnvelope.decay', value)}
          />
          <Knob
            label="Sustain"
            value={filterEnvelope.sustain}
            min={0}
            max={1}
            color="#6B8EBF"
            valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(value) => handleParameterChange('filterEnvelope.sustain', value)}
          />
          <Knob
            label="Release"
            value={filterEnvelope.release}
            min={0.001}
            max={4}
            color="#6B8EBF"
            valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => handleParameterChange('filterEnvelope.release', value)}
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
            value={amplitudeEnvelope.attack}
            min={0.001}
            max={2}
            color="#B67BA3"
            valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => handleParameterChange('amplitudeEnvelope.attack', value)}
          />
          <Knob
            label="Decay"
            value={amplitudeEnvelope.decay}
            min={0.001}
            max={2}
            color="#B67BA3"
            valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => handleParameterChange('amplitudeEnvelope.decay', value)}
          />
          <Knob
            label="Sustain"
            value={amplitudeEnvelope.sustain}
            min={0}
            max={1}
            color="#B67BA3"
            valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(value) => handleParameterChange('amplitudeEnvelope.sustain', value)}
          />
          <Knob
            label="Release"
            value={amplitudeEnvelope.release}
            min={0.001}
            max={4}
            color="#B67BA3"
            valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
            onChange={(value) => handleParameterChange('amplitudeEnvelope.release', value)}
          />
        </div>
      </div>

      {/* Modulation Section */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">🎛️ Modulation (LFO 1)</div>
        </div>
        <div className="vasynth-editor__modulation-panel">
          <div className="vasynth-editor__lfo-controls">
            <Knob
              label="Rate"
              value={instrumentData.lfo1?.rate || 0.5}
              min={0.1}
              max={20}
              sizeVariant="small"
              color="#9B59B6"
              valueFormatter={(v) => `${v.toFixed(2)} Hz`}
              onChange={(value) => handleParameterChange('lfo1.rate', value)}
            />
            <Knob
              label="Depth"
              value={instrumentData.lfo1?.depth || 0.5}
              min={0}
              max={1}
              sizeVariant="small"
              color="#9B59B6"
              valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              onChange={(value) => handleParameterChange('lfo1.depth', value)}
            />
            <div className="vasynth-editor__lfo-waveform">
              <select
                value={instrumentData.lfo1?.waveform || 'sine'}
                onChange={(e) => handleParameterChange('lfo1.waveform', e.target.value)}
                className="vasynth-editor__select"
              >
                <option value="sine">Sine</option>
                <option value="triangle">Triangle</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="square">Square</option>
              </select>
            </div>
          </div>
          <div className="vasynth-editor__mod-target">
            <label>Target:</label>
            <select
              value={instrumentData.lfo1?.target || 'filter.cutoff'}
              onChange={(e) => handleParameterChange('lfo1.target', e.target.value)}
              className="vasynth-editor__select"
            >
              <option value="filter.cutoff">Filter Cutoff</option>
              <option value="filter.resonance">Filter Resonance</option>
              <option value="osc.level">Oscillator Level</option>
              <option value="osc.detune">Oscillator Detune</option>
            </select>
          </div>
        </div>
      </div>

      {/* Effects Section */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">🎭 Effects</div>
        </div>
        <div className="vasynth-editor__effects-panel">
          <div className="vasynth-editor__effect-toggles">
            <button
              className={`vasynth-editor__effect-btn ${instrumentData.effects?.distortion ? 'vasynth-editor__effect-btn--active' : ''}`}
              onClick={() => handleParameterChange('effects.distortion', !(instrumentData.effects?.distortion))}
            >
              🔥 Distortion
            </button>
            <button
              className={`vasynth-editor__effect-btn ${instrumentData.effects?.chorus ? 'vasynth-editor__effect-btn--active' : ''}`}
              onClick={() => handleParameterChange('effects.chorus', !(instrumentData.effects?.chorus))}
            >
              🌊 Chorus
            </button>
            <button
              className={`vasynth-editor__effect-btn ${instrumentData.effects?.delay ? 'vasynth-editor__effect-btn--active' : ''}`}
              onClick={() => handleParameterChange('effects.delay', !(instrumentData.effects?.delay))}
            >
              ⏱️ Delay
            </button>
            <button
              className={`vasynth-editor__effect-btn ${instrumentData.effects?.reverb ? 'vasynth-editor__effect-btn--active' : ''}`}
              onClick={() => handleParameterChange('effects.reverb', !(instrumentData.effects?.reverb))}
            >
              🌌 Reverb
            </button>
          </div>
          <p className="vasynth-editor__hint">Click to toggle effects on/off</p>
        </div>
      </div>

      {/* Visual Feedback */}
      <div className="vasynth-editor__section">
        <div className="vasynth-editor__section-header">
          <div className="vasynth-editor__section-title">📊 Oscilloscope</div>
        </div>
        <div className="vasynth-editor__visualizer">
          <canvas
            ref={canvasRef}
            className="vasynth-editor__canvas"
            width={800}
            height={120}
          />
          <div className="vasynth-editor__visualizer-overlay">
            Real-time waveform
          </div>
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
