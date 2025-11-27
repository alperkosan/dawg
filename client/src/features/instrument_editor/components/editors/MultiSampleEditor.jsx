/**
 * Multi-Sample Editor
 * Editor for multi-sampled instruments (Piano, etc.)
 * Features: Sample list, waveform preview, keyboard
 */

import { useEffect, useCallback, useState } from 'react';
import { getPreviewManager } from '@/lib/audio/preview';
import { AudioContextService } from '@/lib/services/AudioContextService';
import useInstrumentEditorStore from '@/store/useInstrumentEditorStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { Slider } from '@/components/controls/base/Slider';
import WaveformDisplay from '../WaveformDisplay';
import './MultiSampleEditor.css';

const MultiSampleEditor = ({ instrumentData: initialData }) => {
  // Get live instrumentData from store (reactive to changes)
  const instrumentData = useInstrumentEditorStore((state) => state.instrumentData) || initialData;
  const { updateParameter } = useInstrumentEditorStore();
  const { updateInstrument } = useInstrumentsStore();
  
  const samples = instrumentData?.multiSamples || [];
  const [activeNote, setActiveNote] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  
  // ✅ TIME STRETCH: Get time stretch enabled state
  const timeStretchEnabled = instrumentData?.timeStretchEnabled || false;

  // ✅ SAMPLE START MODULATION: Get sample start modulation state
  const sampleStart = instrumentData?.sampleStart || 0;
  const sampleStartModulation = instrumentData?.sampleStartModulation || {
    enabled: false,
    source: 'envelope',
    depth: 0.5
  };


  // Setup PreviewManager with current instrument
  // ✅ FIX: Only update when instrument ID changes, not when parameters change
  // This prevents re-creating the instrument when time stretch toggle is changed
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.audioContext && instrumentData?.id) {
      // ✅ FX CHAIN: Pass audioEngine to PreviewManager for mixer routing
      const previewManager = getPreviewManager(audioEngine.audioContext, audioEngine);
      previewManager.setInstrument(instrumentData);
    }
  }, [instrumentData?.id]); // ✅ FIX: Only depend on instrument ID, not entire instrumentData

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
      if (activeNote) {
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
  }, [activeNote]);

  // ✅ TIME STRETCH: Handle time stretch toggle
  const handleTimeStretchToggle = useCallback(async (enabled) => {
    if (!instrumentData?.id) return;

    // Update store
    updateParameter('timeStretchEnabled', enabled);

    // Update instrument in store
    updateInstrument(instrumentData.id, { timeStretchEnabled: enabled });

    // Update audio engine instrument
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && instrumentData.id) {
      const instrument = audioEngine.instruments.get(instrumentData.id);
      if (instrument && typeof instrument.timeStretchEnabled !== 'undefined') {
        instrument.timeStretchEnabled = enabled;
        // Re-initialize time stretcher if needed
        if (enabled && !instrument.timeStretcher) {
          // ✅ FIX: Use dynamic import instead of require
          const { TimeStretcher } = await import('@/lib/audio/dsp/TimeStretcher');
          instrument.timeStretcher = new TimeStretcher(audioEngine.audioContext);
          // Inject into voices
          if (instrument.voicePool) {
            instrument.voicePool.voices.forEach(voice => {
              voice.timeStretcher = instrument.timeStretcher;
              voice.timeStretchEnabled = true;
            });
          }
        }
      }
    }

    console.log(`🎚️ Time stretch ${enabled ? 'enabled' : 'disabled'} for ${instrumentData.name}`);
  }, [instrumentData, updateParameter, updateInstrument]);

  // ✅ SAMPLE START MODULATION: Handle parameter changes
  const handleSampleStartChange = useCallback((value) => {
    if (!instrumentData?.id) return;
    updateParameter('sampleStart', value);
    updateInstrument(instrumentData.id, { sampleStart: value });
  }, [instrumentData, updateParameter, updateInstrument]);

  const handleSampleStartModulationChange = useCallback((updates) => {
    if (!instrumentData?.id) return;
    const newModulation = { ...sampleStartModulation, ...updates };
    updateParameter('sampleStartModulation', newModulation);
    updateInstrument(instrumentData.id, { sampleStartModulation: newModulation });
  }, [instrumentData, sampleStartModulation, updateParameter, updateInstrument]);

  return (
    <div className="multisample-editor">
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

          <div className="multisample-editor__section">
            <div className="multisample-editor__section-title">Sample Start</div>
            <div className="multisample-editor__sample-start">
              <Slider
                label="Start Offset"
                value={sampleStart}
                min={0}
                max={1}
                step={0.001}
                color="#6B8EBF"
                formatValue={(v) => `${(v * 100).toFixed(1)}%`}
                onChange={handleSampleStartChange}
              />

              <div className="multisample-editor__modulation-toggle">
                <label className="multisample-editor__modulation-label">
                  <input
                    type="checkbox"
                    checked={sampleStartModulation.enabled}
                    onChange={(e) => handleSampleStartModulationChange({ enabled: e.target.checked })}
                    className="multisample-editor__modulation-checkbox"
                  />
                  <span>Enable Modulation</span>
                </label>
              </div>

              {sampleStartModulation.enabled && (
                <div className="multisample-editor__modulation-controls">
                  <div className="multisample-editor__modulation-source">
                    <label>Source:</label>
                    <select
                      value={sampleStartModulation.source}
                      onChange={(e) => handleSampleStartModulationChange({ source: e.target.value })}
                      className="multisample-editor__modulation-select"
                    >
                      <option value="envelope">Envelope</option>
                      <option value="lfo" disabled>LFO (Coming Soon)</option>
                    </select>
                  </div>

                  <Slider
                    label="Modulation Depth"
                    value={sampleStartModulation.depth}
                    min={0}
                    max={1}
                    step={0.01}
                    color="#6B8EBF"
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                    onChange={(value) => handleSampleStartModulationChange({ depth: value })}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="multisample-editor__section">
            <div className="multisample-editor__section-title">Time Stretch</div>
            <div className="multisample-editor__time-stretch">
              <label className="multisample-editor__time-stretch-label">
                <input
                  type="checkbox"
                  checked={timeStretchEnabled}
                  onChange={(e) => handleTimeStretchToggle(e.target.checked)}
                  className="multisample-editor__time-stretch-checkbox"
                />
                <span>Enable Time Stretching</span>
              </label>
              <div className="multisample-editor__time-stretch-info">
                <p>When enabled, pitch changes won't affect sample duration.</p>
                <p>Reduces aliasing and maintains consistent timing.</p>
                <p className="multisample-editor__time-stretch-warning">
                  ⚠️ First playback may use playbackRate (fallback) while buffers are cached.
                </p>
              </div>
            </div>
          </div>

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
