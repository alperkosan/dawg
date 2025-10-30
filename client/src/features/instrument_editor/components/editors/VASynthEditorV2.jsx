/**
 * VASynth Editor V2 - FL Studio Style
 *
 * Canvas-based visual controls for better UX and compact design
 */

import React, { useCallback, useEffect, useState } from 'react';
import useInstrumentEditorStore from '../../../../store/useInstrumentEditorStore';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { getPreset } from '@/lib/audio/synth/presets';
import { getPreviewManager } from '@/lib/audio/preview';
import { ADSRCanvas, OscillatorPanel } from '@/components/controls/canvas';
import { Knob } from '@/components/controls';
import './VASynthEditorV2.css';

const VASynthEditorV2 = ({ instrumentData: initialData }) => {
  const { updateParameter } = useInstrumentEditorStore();
  const [activeNote, setActiveNote] = useState(null);

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
        lfo1: presetData.lfo,
      };
      useInstrumentEditorStore.setState({ instrumentData: mergedData });
    }
  }, [instrumentData.id]);

  const oscillators = instrumentData.oscillators || presetData?.oscillators || [];
  const filter = instrumentData.filter || presetData?.filter || {};
  const filterEnvelope = instrumentData.filterEnvelope || presetData?.filterEnvelope || {};
  const amplitudeEnvelope = instrumentData.amplitudeEnvelope || presetData?.amplitudeEnvelope || {};

  // Handle parameter updates
  const handleParameterChange = useCallback((path, value) => {
    updateParameter(path, value);

    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && instrumentData.id) {
      const instrument = audioEngine.instruments.get(instrumentData.id);
      if (instrument && typeof instrument.updateParameters === 'function') {
        const updateObj = {};
        const keys = path.split('.');

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

  // Preview keyboard handlers
  const handleNoteOn = useCallback((note, octave) => {
    const previewManager = getPreviewManager();
    if (previewManager) {
      const pitch = note + octave;
      previewManager.previewNote(pitch, 100, null);
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

  // Setup PreviewManager
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.audioContext && instrumentData) {
      const previewManager = getPreviewManager(audioEngine.audioContext);
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
        </div>
      </div>

      {/* Preview Keyboard */}
      <div className="vasynth-editor-v2__section">
        <div className="vasynth-editor-v2__section-title">PREVIEW</div>
        <div className="vasynth-editor-v2__keyboard">
          {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((note) => {
            const pitch = note + '4';
            const isBlack = note.includes('#');
            const isActive = activeNote === pitch;

            return (
              <button
                key={note}
                className={`
                  vasynth-editor-v2__key
                  ${isBlack ? 'vasynth-editor-v2__key--black' : 'vasynth-editor-v2__key--white'}
                  ${isActive ? 'vasynth-editor-v2__key--active' : ''}
                `}
                onMouseDown={() => handleNoteOn(note, '4')}
                onMouseUp={handleNoteOff}
                onMouseLeave={handleNoteOff}
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
              width={300}
              height={140}
              color="#6B8EBF"
            />
          </div>
          <div className="vasynth-editor-v2__envelope-panel">
            <div className="vasynth-editor-v2__envelope-label">Amplitude Envelope</div>
            <ADSRCanvas
              attack={amplitudeEnvelope.attack || 0.01}
              decay={amplitudeEnvelope.decay || 0.2}
              sustain={amplitudeEnvelope.sustain || 0.8}
              release={amplitudeEnvelope.release || 0.5}
              onChange={(values) => handleEnvelopeChange('amplitudeEnvelope', values)}
              width={300}
              height={140}
              color="#FF6B9D"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VASynthEditorV2;
