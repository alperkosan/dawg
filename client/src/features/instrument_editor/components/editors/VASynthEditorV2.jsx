/**
 * VASynth Editor V2 - FL Studio Style
 *
 * Canvas-based visual controls for better UX and compact design
 */

import React, { useCallback, useEffect, useState } from 'react';
import useInstrumentEditorStore from '../../../../store/useInstrumentEditorStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { getPreset } from '@/lib/audio/synth/presets';
import { getPreviewManager } from '@/lib/audio/preview';
import { ADSRCanvas, OscillatorPanel } from '@/components/controls/canvas';
import { Knob } from '@/components/controls';
import './VASynthEditorV2.css';

const VASynthEditorV2 = ({ instrumentData: initialData }) => {
  const { updateParameter } = useInstrumentEditorStore();
  const [activeNotes, setActiveNotes] = useState(new Set()); // Multiple active notes
  const [pressedKeys, setPressedKeys] = useState(new Set()); // Track pressed keyboard keys

  const instrumentData = useInstrumentEditorStore((state) => state.instrumentData) || initialData;

  const presetName = instrumentData.presetName || 'Piano';
  const presetData = getPreset(presetName);

  // Initialize instrumentData with preset data
  useEffect(() => {
    if (presetData && instrumentData && !instrumentData.oscillators) {
      const mergedData = {
        ...instrumentData,
        oscillators: presetData.oscillators,
        filter: presetData.filter,
        filterEnvelope: presetData.filterEnvelope,
        amplitudeEnvelope: presetData.amplitudeEnvelope,
        lfo1: {
          ...presetData.lfo,
          target: presetData.lfoTarget || 'filter.cutoff' // ✅ LFO TARGET: Include target in lfo1
        },
      };
      useInstrumentEditorStore.setState({ instrumentData: mergedData });
    }
  }, [instrumentData.id]);

  const oscillators = instrumentData.oscillators || presetData?.oscillators || [];
  // ✅ FILTER DRIVE: Merge filter with defaults to ensure drive property exists
  const defaultFilter = {
    type: 'lowpass',
    cutoff: 2000,
    resonance: 1,
    envelopeAmount: 2000,
    drive: 0 // ✅ FILTER DRIVE: Default drive value
  };
  const filter = {
    ...defaultFilter,
    ...(presetData?.filter || {}),
    ...(instrumentData.filter || {})
  };
  // ✅ ENVELOPE DELAY/HOLD: Merge envelopes with defaults to ensure delay and hold properties exist
  const defaultFilterEnvelope = {
    delay: 0,
    attack: 0.01,
    hold: 0,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3
  };
  const defaultAmplitudeEnvelope = {
    delay: 0,
    attack: 0.01,
    hold: 0,
    decay: 0.2,
    sustain: 0.8,
    release: 0.5
  };
  const filterEnvelope = {
    ...defaultFilterEnvelope,
    ...(presetData?.filterEnvelope || {}),
    ...(instrumentData.filterEnvelope || {})
  };
  const amplitudeEnvelope = {
    ...defaultAmplitudeEnvelope,
    ...(presetData?.amplitudeEnvelope || {}),
    ...(instrumentData.amplitudeEnvelope || {})
  };
  const lfo1 = instrumentData.lfo1 || presetData?.lfo || { frequency: 4, depth: 0.5, waveform: 'sine', target: 'filter.cutoff', tempoSync: false, tempoSyncRate: '1/4' };
  
  // ✅ TEMPO SYNC: Get BPM from playback store
  const bpm = usePlaybackStore(state => state.bpm);

  // Helper: map note name like 'C', 'C#' with octave 4 to MIDI
  const noteNameToMidi = useCallback((name, octave = 4) => {
    const map = { 'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11 };
    const offset = map[name] ?? 0;
    return (octave + 1) * 12 + offset; // MIDI formula
  }, []);

  // Handle parameter updates
  const handleParameterChange = useCallback((path, value) => {
    updateParameter(path, value);

    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && instrumentData.id) {
      const instrument = audioEngine.instruments.get(instrumentData.id);
      if (instrument && typeof instrument.updateParameters === 'function') {
        const updateObj = {};
        const keys = path.split('.');
        
        // ✅ TEMPO SYNC: If tempo sync or rate changed, include BPM
        if (keys[0] === 'lfo1' && (keys[1] === 'tempoSync' || keys[1] === 'tempoSyncRate')) {
          if (!updateObj.lfo1) updateObj.lfo1 = {};
          updateObj.lfo1[keys[1]] = value;
          updateObj.lfo1.bpm = bpm; // ✅ TEMPO SYNC: Include current BPM
        }

        if (keys[0] === 'oscillators') {
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.oscillatorSettings = currentData?.oscillators;
        } else if (keys[0] === 'filter') {
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.filterSettings = currentData?.filter;
        } else if (keys[0] === 'filterEnvelope') {
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.filterEnvelope = currentData?.filterEnvelope;
        } else if (keys[0] === 'amplitudeEnvelope') {
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.amplitudeEnvelope = currentData?.amplitudeEnvelope;
        } else if (keys[0] === 'lfo1') {
          // ✅ LFO UI: Update LFO parameters
          const currentData = useInstrumentEditorStore.getState().instrumentData;
          updateObj.lfo1 = currentData?.lfo1;
        }

        instrument.updateParameters(updateObj);
      }
    }
  }, [updateParameter, instrumentData.id]);

  // Oscillator change handler
  const handleOscillatorChange = useCallback((index, updates) => {
    Object.entries(updates).forEach(([key, value]) => {
      handleParameterChange(`oscillators.${index}.${key}`, value);
    });
  }, [handleParameterChange]);

  // ADSR envelope change handler
  const handleEnvelopeChange = useCallback((type, values) => {
    Object.entries(values).forEach(([key, value]) => {
      handleParameterChange(`${type}.${key}`, value);
    });
  }, [handleParameterChange]);

  // Preview keyboard handlers - polyphonic support
  const handleNoteOn = useCallback((midiNote) => {
    const previewManager = getPreviewManager();
    if (previewManager && !activeNotes.has(midiNote)) {
      previewManager.previewNote(midiNote, 100, null);
      setActiveNotes(prev => new Set([...prev, midiNote]));
    }
  }, [activeNotes]);

  const handleNoteOff = useCallback((midiNote) => {
    const previewManager = getPreviewManager();
    if (previewManager && activeNotes.has(midiNote)) {
      previewManager.stopNote(midiNote);
      setActiveNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(midiNote);
        return newSet;
      });
    }
  }, [activeNotes]);

  // Keyboard event handlers for computer keyboard preview - polyphonic
  useEffect(() => {
    // Map of keyboard keys to MIDI notes (starting from C4 = 60)
    const keyToNote = {
      'a': 60,  // C4
      'w': 61,  // C#4
      's': 62,  // D4
      'e': 63,  // D#4
      'd': 64,  // E4
      'f': 65,  // F4
      't': 66,  // F#4
      'g': 67,  // G4
      'y': 68,  // G#4
      'h': 69,  // A4
      'u': 70,  // A#4
      'j': 71,  // B4
      'k': 72,  // C5
      'o': 73,  // C#5
      'l': 74,  // D5
    };

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (keyToNote[key] && !pressedKeys.has(key)) {
        e.preventDefault();
        setPressedKeys(prev => new Set([...prev, key]));
        handleNoteOn(keyToNote[key]);
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (keyToNote[key] && pressedKeys.has(key)) {
        e.preventDefault();
        setPressedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
        handleNoteOff(keyToNote[key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [pressedKeys, handleNoteOn, handleNoteOff]);

  // Setup PreviewManager
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.audioContext && instrumentData) {
      // ✅ FX CHAIN: Pass audioEngine to PreviewManager for mixer routing
      const previewManager = getPreviewManager(audioEngine.audioContext, audioEngine);
      previewManager.setInstrument(instrumentData);
    }
  }, [instrumentData.id]);

  return (
    <div className="vasynth-editor-v2">
      {/* Header */}
      <div className="vasynth-editor-v2__header">
        <h2 className="vasynth-editor-v2__title">{instrumentData.name}</h2>
        <span className="vasynth-editor-v2__preset">{presetName}</span>
      </div>

      {/* Oscillators Section */}
      <div className="vasynth-editor-v2__section">
        <div className="vasynth-editor-v2__section-title">OSCILLATORS</div>
        <div className="vasynth-editor-v2__oscillators">
          {oscillators.map((osc, index) => (
            <OscillatorPanel
              key={`osc-${index}`}
              index={index}
              enabled={osc.enabled}
              waveform={osc.waveform}
              level={osc.level}
              detune={osc.detune}
              octave={osc.octave}
              onChange={(updates) => handleOscillatorChange(index, updates)}
              width={180}
              height={100}
            />
          ))}
        </div>
      </div>

      {/* Filter Section */}
      <div className="vasynth-editor-v2__section">
        <div className="vasynth-editor-v2__section-title">FILTER</div>
        <div className="vasynth-editor-v2__filter-controls">
          <Knob
            label="Cutoff"
            value={filter.cutoff || 2000}
            min={20}
            max={20000}
            logarithmic
            sizeVariant="medium"
            color="#6B8EBF"
            valueFormatter={(v) => {
              if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
              return `${Math.round(v)}Hz`;
            }}
            onChange={(value) => handleParameterChange('filter.cutoff', value)}
          />
          <Knob
            label="Resonance"
            value={filter.resonance || 1}
            min={0.1}
            max={30}
            sizeVariant="medium"
            color="#6B8EBF"
            valueFormatter={(v) => v.toFixed(1)}
            onChange={(value) => handleParameterChange('filter.resonance', value)}
          />
          <Knob
            label="Env Amt"
            value={filter.envelopeAmount || 0}
            min={-12000}
            max={12000}
            sizeVariant="medium"
            color="#6B8EBF"
            valueFormatter={(v) => {
              const abs = Math.abs(v);
              return `${v >= 0 ? '+' : '-'}${abs >= 1000 ? (abs / 1000).toFixed(1) + 'k' : abs.toFixed(0)}`;
            }}
            onChange={(value) => handleParameterChange('filter.envelopeAmount', value)}
          />
          <Knob
            label="Drive"
            value={filter.drive || 0}
            min={0}
            max={1}
            step={0.01}
            sizeVariant="medium"
            color="#FF6B6B"
            valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(value) => handleParameterChange('filter.drive', value)}
          />
        </div>
      </div>

      {/* Preview Keyboard */}
      <div className="vasynth-editor-v2__section">
        <div className="vasynth-editor-v2__section-title">PREVIEW</div>
        <div className="vasynth-editor-v2__keyboard">
          {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((note) => {
            const midi = noteNameToMidi(note, 4);
            const isBlack = note.includes('#');
            const isActive = activeNotes.has(midi);

            return (
              <button
                key={note}
                className={`
                  vasynth-editor-v2__key
                  ${isBlack ? 'vasynth-editor-v2__key--black' : 'vasynth-editor-v2__key--white'}
                  ${isActive ? 'vasynth-editor-v2__key--active' : ''}
                `}
                onMouseDown={() => handleNoteOn(midi)}
                onMouseUp={() => handleNoteOff(midi)}
                onMouseLeave={() => handleNoteOff(midi)}
              >
                {!isBlack && <span className="vasynth-editor-v2__key-label">{note}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Envelopes Section */}
      <div className="vasynth-editor-v2__section">
        <div className="vasynth-editor-v2__section-title">ENVELOPES</div>
        <div className="vasynth-editor-v2__envelopes">
          <div className="vasynth-editor-v2__envelope-panel">
            <div className="vasynth-editor-v2__envelope-label">Filter Envelope</div>
            <ADSRCanvas
              attack={filterEnvelope.attack || 0.01}
              decay={filterEnvelope.decay || 0.1}
              sustain={filterEnvelope.sustain || 0.7}
              release={filterEnvelope.release || 0.3}
              onChange={(values) => handleEnvelopeChange('filterEnvelope', values)}
              width={400}
              height={150}
              color="#6B8EBF"
            />
            {/* ✅ ENVELOPE DELAY/HOLD: Delay and Hold controls */}
            <div className="vasynth-editor-v2__envelope-extra-controls">
              <Knob
                label="Delay"
                value={filterEnvelope.delay || 0}
                min={0}
                max={2}
                sizeVariant="small"
                color="#6B8EBF"
                valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                onChange={(value) => handleParameterChange('filterEnvelope.delay', value)}
              />
              <Knob
                label="Hold"
                value={filterEnvelope.hold || 0}
                min={0}
                max={2}
                sizeVariant="small"
                color="#6B8EBF"
                valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                onChange={(value) => handleParameterChange('filterEnvelope.hold', value)}
              />
            </div>
          </div>
          <div className="vasynth-editor-v2__envelope-panel">
            <div className="vasynth-editor-v2__envelope-label">Amplitude Envelope</div>
            <ADSRCanvas
              attack={amplitudeEnvelope.attack || 0.01}
              decay={amplitudeEnvelope.decay || 0.2}
              sustain={amplitudeEnvelope.sustain || 0.8}
              release={amplitudeEnvelope.release || 0.5}
              onChange={(values) => handleEnvelopeChange('amplitudeEnvelope', values)}
              width={400}
              height={150}
              color="#FF6B9D"
            />
            {/* ✅ ENVELOPE DELAY/HOLD: Delay and Hold controls */}
            <div className="vasynth-editor-v2__envelope-extra-controls">
              <Knob
                label="Delay"
                value={amplitudeEnvelope.delay || 0}
                min={0}
                max={2}
                sizeVariant="small"
                color="#FF6B9D"
                valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                onChange={(value) => handleParameterChange('amplitudeEnvelope.delay', value)}
              />
              <Knob
                label="Hold"
                value={amplitudeEnvelope.hold || 0}
                min={0}
                max={2}
                sizeVariant="small"
                color="#FF6B9D"
                valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                onChange={(value) => handleParameterChange('amplitudeEnvelope.hold', value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ✅ LFO UI: LFO Section */}
      <div className="vasynth-editor-v2__section">
        <div className="vasynth-editor-v2__section-title">LFO 1</div>
        <div className="vasynth-editor-v2__lfo-controls">
          <Knob
            label="Frequency"
            value={lfo1.frequency || 4}
            min={0.01}
            max={20}
            sizeVariant="medium"
            color="#9B59B6"
            valueFormatter={(v) => `${v.toFixed(2)} Hz`}
            onChange={(value) => handleParameterChange('lfo1.frequency', value)}
          />
          <Knob
            label="Depth"
            value={lfo1.depth || 0.5}
            min={0}
            max={1}
            sizeVariant="medium"
            color="#9B59B6"
            valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(value) => handleParameterChange('lfo1.depth', value)}
          />
          <div className="vasynth-editor-v2__lfo-waveform">
            <label className="vasynth-editor-v2__label">Waveform</label>
            <select
              value={lfo1.waveform || 'sine'}
              onChange={(e) => handleParameterChange('lfo1.waveform', e.target.value)}
              className="vasynth-editor-v2__select"
            >
              <option value="sine">Sine</option>
              <option value="triangle">Triangle</option>
              <option value="sawtooth">Sawtooth</option>
              <option value="square">Square</option>
            </select>
          </div>
          <div className="vasynth-editor-v2__lfo-target">
            <label className="vasynth-editor-v2__label">Target</label>
            <select
              value={lfo1.target || 'filter.cutoff'}
              onChange={(e) => handleParameterChange('lfo1.target', e.target.value)}
              className="vasynth-editor-v2__select"
            >
              <option value="filter.cutoff">Filter Cutoff</option>
              <option value="filter.resonance">Filter Resonance</option>
              <option value="osc.level">Oscillator Level</option>
              <option value="osc.detune">Oscillator Detune</option>
              <option value="osc.pitch">Oscillator Pitch</option>
            </select>
          </div>
        </div>
        {/* ✅ TEMPO SYNC: Tempo sync controls */}
        <div className="vasynth-editor-v2__lfo-tempo-sync">
          <label className="vasynth-editor-v2__tempo-sync-toggle">
            <input
              type="checkbox"
              checked={lfo1.tempoSync || false}
              onChange={(e) => handleParameterChange('lfo1.tempoSync', e.target.checked)}
              className="vasynth-editor-v2__checkbox"
            />
            <span className="vasynth-editor-v2__label">Tempo Sync</span>
          </label>
          {lfo1.tempoSync && (
            <div className="vasynth-editor-v2__lfo-rate">
              <label className="vasynth-editor-v2__label">Rate</label>
              <select
                value={lfo1.tempoSyncRate || '1/4'}
                onChange={(e) => handleParameterChange('lfo1.tempoSyncRate', e.target.value)}
                className="vasynth-editor-v2__select"
              >
                <option value="1/64">1/64</option>
                <option value="1/32">1/32</option>
                <option value="1/16">1/16</option>
                <option value="1/8">1/8</option>
                <option value="1/4">1/4</option>
                <option value="1/2">1/2</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="4">4</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VASynthEditorV2;
