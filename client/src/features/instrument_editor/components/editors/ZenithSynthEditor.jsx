/**
 * ZenithSynthEditor - Premium Synthesizer Editor
 * 
 * Modern, glassmorphic UI for Zenith Synth
 * Features:
 * - 4 Oscillators (VA waveforms + PWM + Supersaw + Noise)
 * - Advanced Filter (10+ types, drive, key tracking)
 * - 4 LFOs (tempo-synced)
 * - DAHDSR Envelopes
 * - Real-time preview
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import useInstrumentEditorStore from '../../../../store/useInstrumentEditorStore';
import { getPreviewManager } from '@/lib/audio/preview';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
import { getZenithPreset } from '@/lib/audio/synth/zenithPresets';
import { ZenithKnob } from './zenith/ZenithKnob';
import { ZenithSlider } from './zenith/ZenithSlider';
import { ZenithLFOPanel } from './zenith/ZenithLFOPanel';
import { ZenithModMatrix } from './zenith/ZenithModMatrix';
import './ZenithSynthEditor.css';

const ZenithSynthEditor = ({ instrumentData: initialData }) => {
    const { updateParameter } = useInstrumentEditorStore();

    // Get live instrumentData from store
    const instrumentData = useInstrumentEditorStore((state) => state.instrumentData) || initialData;

    const [activeNote, setActiveNote] = useState(null);

    // Get preset data
    const presetName = instrumentData.presetName || 'Deep Sub Bass';
    const presetData = getZenithPreset(presetName);

    // Initialize instrumentData with preset on mount
    useEffect(() => {
        if (presetData && instrumentData && !instrumentData.oscillators) {
            const mergedData = {
                ...instrumentData,
                oscillators: presetData.oscillators,
                filter: presetData.filter,
                filterEnvelope: presetData.filterEnvelope,
                amplitudeEnvelope: presetData.amplitudeEnvelope,
                lfos: presetData.lfos,
            };
            useInstrumentEditorStore.setState({ instrumentData: mergedData });
        }
    }, [instrumentData.id]);

    // Default values for 4 oscillators
    const defaultOscillators = [
        { enabled: true, waveform: 'sawtooth', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
        { enabled: true, waveform: 'sawtooth', detune: -7, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
        { enabled: false, waveform: 'square', detune: 0, octave: -1, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
        { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
    ];

    const defaultFilter = {
        type: 'lowpass',
        cutoff: 2000,
        resonance: 1,
        envelopeAmount: 2000,
        velocitySensitivity: 0.5,
        keyTracking: 0,
        drive: 0
    };

    const defaultFilterEnvelope = {
        delay: 0,
        attack: 0.01,
        hold: 0,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        velocitySensitivity: 0.5
    };

    const defaultAmplitudeEnvelope = {
        delay: 0,
        attack: 0.01,
        hold: 0,
        decay: 0.2,
        sustain: 0.8,
        release: 0.5,
        velocitySensitivity: 0.7
    };

    // Get or initialize data from preset
    const oscillators = useMemo(() => {
        return Array.isArray(instrumentData.oscillators)
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
    }, [instrumentData.oscillators, presetData?.oscillators]);

    const filter = {
        ...defaultFilter,
        ...(presetData?.filter || {}),
        ...(instrumentData.filter || {})
    };

    const filterEnvelope = instrumentData.filterEnvelope || presetData?.filterEnvelope || defaultFilterEnvelope;
    const amplitudeEnvelope = instrumentData.amplitudeEnvelope || presetData?.amplitudeEnvelope || defaultAmplitudeEnvelope;

    // Default LFO values
    const defaultLFOs = [
        { waveform: 'sine', rate: 1, depth: 0, phase: 0, tempoSync: false },
        { waveform: 'sine', rate: 2, depth: 0, phase: 0, tempoSync: false },
        { waveform: 'triangle', rate: 4, depth: 0, phase: 0, tempoSync: false },
        { waveform: 'square', rate: 0.5, depth: 0, phase: 0, tempoSync: false }
    ];

    const lfos = useMemo(() => {
        return Array.isArray(instrumentData.lfos)
            ? instrumentData.lfos.map((lfo, index) => ({
                ...defaultLFOs[index],
                ...lfo,
            }))
            : (Array.isArray(presetData?.lfos)
                ? presetData.lfos.map((lfo, index) => ({
                    ...defaultLFOs[index],
                    ...lfo,
                }))
                : defaultLFOs);
    }, [instrumentData.lfos, presetData?.lfos]);

    // Default modulation slots (start with 2 enabled slots)
    const defaultModSlots = [
        { enabled: true, source: null, destination: null, amount: 0, curve: 'linear' },
        { enabled: true, source: null, destination: null, amount: 0, curve: 'linear' }
    ];

    const modSlots = useMemo(() => {
        return Array.isArray(instrumentData.modSlots)
            ? instrumentData.modSlots.map((slot, index) => ({
                ...defaultModSlots[index],
                ...slot,
            }))
            : (Array.isArray(presetData?.modSlots)
                ? presetData.modSlots.map((slot, index) => ({
                    ...defaultModSlots[index],
                    ...slot,
                }))
                : defaultModSlots);
    }, [instrumentData.modSlots, presetData?.modSlots]);

    // Setup PreviewManager
    useEffect(() => {
        const audioEngine = AudioEngineGlobal.get();
        if (audioEngine?.audioContext && instrumentData) {
            const previewManager = getPreviewManager(audioEngine.audioContext, audioEngine);
            previewManager.setInstrument(instrumentData);
        }
    }, [instrumentData.id]);

    // Handle parameter updates
    const handleParameterChange = useCallback((path, value) => {
        updateParameter(path, value);

        // Update audio engine directly (for playback)
        const audioEngine = AudioEngineGlobal.get();
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
                } else if (keys[0] === 'lfos') {
                    const currentData = useInstrumentEditorStore.getState().instrumentData;
                    updateObj.lfos = currentData?.lfos;
                } else if (keys[0] === 'modSlots') {
                    const currentData = useInstrumentEditorStore.getState().instrumentData;
                    updateObj.modSlots = currentData?.modSlots;
                }

                instrument.updateParameters(updateObj);
            }
        }

        // CRITICAL: Also update PreviewManager's instrument
        const previewManager = getPreviewManager();
        if (previewManager) {
            // Get updated instrument data
            const currentData = useInstrumentEditorStore.getState().instrumentData;
            previewManager.setInstrument(currentData);
        }
    }, [updateParameter, instrumentData.id]);

    // Handle LFO parameter changes
    const handleLFOChange = useCallback((lfoIndex, param, value) => {
        handleParameterChange(`lfos.${lfoIndex}.${param}`, value);
    }, [handleParameterChange]);

    // Handle modulation slot changes
    const handleModSlotChange = useCallback((slotIndex, updates) => {
        console.log(`🎛️ [MOD SLOT] Change requested:`, { slotIndex, updates });

        // Get current modSlots array
        const currentData = useInstrumentEditorStore.getState().instrumentData;
        const currentModSlots = currentData?.modSlots || [];

        // If adding a new slot beyond current array length, expand the array
        if (slotIndex >= currentModSlots.length) {
            console.log(`  ➕ Expanding modSlots array from ${currentModSlots.length} to ${slotIndex + 1}`);
            const newModSlots = [...currentModSlots];
            // Fill gaps with empty slots
            while (newModSlots.length <= slotIndex) {
                newModSlots.push({
                    enabled: false,
                    source: null,
                    destination: null,
                    amount: 0,
                    curve: 'linear'
                });
            }
            // Update the new slot
            newModSlots[slotIndex] = {
                ...newModSlots[slotIndex],
                ...updates
            };
            // Update entire array at once
            handleParameterChange('modSlots', newModSlots);
        } else {
            // Update existing slot fields individually
            Object.entries(updates).forEach(([key, value]) => {
                console.log(`  📝 Updating modSlots.${slotIndex}.${key} = ${value}`);
                handleParameterChange(`modSlots.${slotIndex}.${key}`, value);
            });
        }
    }, [handleParameterChange]);

    // Preview keyboard handlers
    const handleNoteOn = useCallback((midiNote) => {
        const previewManager = getPreviewManager();
        if (previewManager) {
            previewManager.previewNote(midiNote, 100, null);
            setActiveNote(midiNote);
        }
    }, []);

    const handleNoteOff = useCallback(() => {
        const previewManager = getPreviewManager();
        if (previewManager) {
            if (activeNote) {
                previewManager.stopNote(activeNote);
            } else {
                previewManager.stopPreview();
            }
            setActiveNote(null);
        }
    }, [activeNote]);

    return (
        <div className="zenith-synth-editor">
            {/* Header */}
            <div className="zenith-synth-editor__header">
                <div className="zenith-synth-editor__preset-info">
                    <div className="zenith-synth-editor__preset-icon">⚡</div>
                    <div>
                        <div className="zenith-synth-editor__preset-name">{presetName}</div>
                        <div className="zenith-synth-editor__preset-desc">
                            Premium synthesizer with 4 oscillators, advanced filter & modulation
                        </div>
                    </div>
                </div>
            </div>

            {/* Oscillators Section */}
            <div className="zenith-synth-editor__section">
                <div className="zenith-synth-editor__section-header">
                    <span className="zenith-synth-editor__section-icon">🎵</span>
                    <span className="zenith-synth-editor__section-title">Oscillators</span>
                </div>
                <div className="zenith-synth-editor__oscillators">
                    {oscillators.map((osc, index) => (
                        <div key={index} className={`zenith-synth-editor__oscillator ${!osc.enabled ? 'zenith-synth-editor__oscillator--disabled' : ''}`}>
                            <div className="zenith-synth-editor__oscillator-header">
                                <span>OSC {index + 1}</span>
                                <label className="zenith-synth-editor__toggle">
                                    <input
                                        type="checkbox"
                                        checked={osc.enabled}
                                        onChange={(e) => handleParameterChange(`oscillators.${index}.enabled`, e.target.checked)}
                                    />
                                    <span className="zenith-synth-editor__toggle-slider"></span>
                                </label>
                            </div>

                            {osc.enabled && (
                                <>
                                    <div className="zenith-synth-editor__oscillator-controls">
                                        <ZenithKnob
                                            label="Level"
                                            value={osc.level}
                                            min={0}
                                            max={1}
                                            size={60}
                                            color="#00d9ff"
                                            valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                            onChange={(value) => handleParameterChange(`oscillators.${index}.level`, value)}
                                        />
                                        <ZenithKnob
                                            label="Detune"
                                            value={osc.detune}
                                            min={-50}
                                            max={50}
                                            size={60}
                                            color="#00d9ff"
                                            valueFormatter={(v) => `${v.toFixed(1)}¢`}
                                            onChange={(value) => handleParameterChange(`oscillators.${index}.detune`, value)}
                                        />
                                        <ZenithKnob
                                            label="Octave"
                                            value={osc.octave}
                                            min={-2}
                                            max={2}
                                            step={1}
                                            size={60}
                                            color="#00d9ff"
                                            valueFormatter={(v) => `${v > 0 ? '+' : ''}${v}`}
                                            onChange={(value) => handleParameterChange(`oscillators.${index}.octave`, Math.round(value))}
                                        />
                                    </div>

                                    <div className="zenith-synth-editor__waveform-selector">
                                        {['sine', 'triangle', 'sawtooth', 'square', 'supersaw', 'noise'].map((waveform) => (
                                            <button
                                                key={waveform}
                                                className={`zenith-synth-editor__waveform-btn ${osc.waveform === waveform ? 'zenith-synth-editor__waveform-btn--active' : ''}`}
                                                onClick={() => handleParameterChange(`oscillators.${index}.waveform`, waveform)}
                                            >
                                                {waveform === 'sine' && '∿'}
                                                {waveform === 'triangle' && '△'}
                                                {waveform === 'sawtooth' && '⊿'}
                                                {waveform === 'square' && '⊓'}
                                                {waveform === 'supersaw' && '⊿⊿'}
                                                {waveform === 'noise' && '≋'}
                                            </button>
                                        ))}
                                    </div>

                                    {/* PWM for square wave */}
                                    {osc.waveform === 'square' && (
                                        <div className="zenith-synth-editor__pwm">
                                            <ZenithSlider
                                                label="Pulse Width"
                                                value={osc.pulseWidth}
                                                min={0.01}
                                                max={0.99}
                                                color="#a855f7"
                                                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                                onChange={(value) => handleParameterChange(`oscillators.${index}.pulseWidth`, value)}
                                            />
                                        </div>
                                    )}

                                    {/* Unison for supersaw */}
                                    {osc.waveform === 'supersaw' && (
                                        <div className="zenith-synth-editor__unison">
                                            <ZenithKnob
                                                label="Voices"
                                                value={osc.unisonVoices || 7}
                                                min={1}
                                                max={8}
                                                step={1}
                                                size={60}
                                                color="#ec4899"
                                                valueFormatter={(v) => `${Math.round(v)}`}
                                                onChange={(value) => handleParameterChange(`oscillators.${index}.unisonVoices`, Math.round(value))}
                                            />
                                            <ZenithKnob
                                                label="Detune"
                                                value={osc.unisonDetune || 50}
                                                min={0}
                                                max={100}
                                                size={60}
                                                color="#ec4899"
                                                valueFormatter={(v) => `${v.toFixed(0)}¢`}
                                                onChange={(value) => handleParameterChange(`oscillators.${index}.unisonDetune`, value)}
                                            />
                                            <ZenithKnob
                                                label="Spread"
                                                value={osc.unisonSpread || 50}
                                                min={0}
                                                max={100}
                                                size={60}
                                                color="#ec4899"
                                                valueFormatter={(v) => `${v.toFixed(0)}%`}
                                                onChange={(value) => handleParameterChange(`oscillators.${index}.unisonSpread`, value)}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Filter Section */}
            <div className="zenith-synth-editor__section">
                <div className="zenith-synth-editor__section-header">
                    <span className="zenith-synth-editor__section-icon">🎛️</span>
                    <span className="zenith-synth-editor__section-title">Filter</span>
                </div>
                <div className="zenith-synth-editor__filter">
                    <div className="zenith-synth-editor__filter-type">
                        <label>Type:</label>
                        <select
                            value={filter.type}
                            onChange={(e) => handleParameterChange('filter.type', e.target.value)}
                            className="zenith-synth-editor__select"
                        >
                            <option value="lowpass">Lowpass (LP12)</option>
                            <option value="lowpass24">Lowpass 24dB (LP24)</option>
                            <option value="highpass">Highpass (HP12)</option>
                            <option value="highpass24">Highpass 24dB (HP24)</option>
                            <option value="bandpass">Bandpass</option>
                            <option value="notch">Notch</option>
                        </select>
                    </div>

                    <div className="zenith-synth-editor__filter-controls">
                        <ZenithSlider
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
                        <ZenithSlider
                            label="Resonance"
                            value={filter.resonance}
                            min={0.0001}
                            max={30}
                            color="#6B8EBF"
                            valueFormatter={(v) => `${v.toFixed(1)} Q`}
                            onChange={(value) => handleParameterChange('filter.resonance', value)}
                        />
                        <ZenithSlider
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
                        <ZenithSlider
                            label="Drive"
                            value={filter.drive || 0}
                            min={0}
                            max={1}
                            step={0.01}
                            color="#FF6B6B"
                            valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                            onChange={(value) => handleParameterChange('filter.drive', value)}
                        />
                        <ZenithSlider
                            label="Key Tracking"
                            value={filter.keyTracking || 0}
                            min={0}
                            max={1}
                            step={0.01}
                            color="#a855f7"
                            valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                            onChange={(value) => handleParameterChange('filter.keyTracking', value)}
                        />
                    </div>
                </div>
            </div>

            {/* Envelopes Section */}
            <div className="zenith-synth-editor__section">
                <div className="zenith-synth-editor__section-header">
                    <span className="zenith-synth-editor__section-icon">📈</span>
                    <span className="zenith-synth-editor__section-title">Filter Envelope (DAHDSR)</span>
                </div>
                <div className="zenith-synth-editor__envelope">
                    <ZenithKnob
                        label="Delay"
                        value={filterEnvelope.delay || 0}
                        min={0}
                        max={2}
                        color="#6B8EBF"
                        valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                        onChange={(value) => handleParameterChange('filterEnvelope.delay', value)}
                    />
                    <ZenithKnob
                        label="Attack"
                        value={filterEnvelope.attack}
                        min={0.001}
                        max={2}
                        color="#6B8EBF"
                        valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                        onChange={(value) => handleParameterChange('filterEnvelope.attack', value)}
                    />
                    <ZenithKnob
                        label="Hold"
                        value={filterEnvelope.hold || 0}
                        min={0}
                        max={2}
                        color="#6B8EBF"
                        valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                        onChange={(value) => handleParameterChange('filterEnvelope.hold', value)}
                    />
                    <ZenithKnob
                        label="Decay"
                        value={filterEnvelope.decay}
                        min={0.001}
                        max={2}
                        color="#6B8EBF"
                        valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                        onChange={(value) => handleParameterChange('filterEnvelope.decay', value)}
                    />
                    <ZenithKnob
                        label="Sustain"
                        value={filterEnvelope.sustain}
                        min={0}
                        max={1}
                        color="#6B8EBF"
                        valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                        onChange={(value) => handleParameterChange('filterEnvelope.sustain', value)}
                    />
                    <ZenithKnob
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

            <div className="zenith-synth-editor__section">
                <div className="zenith-synth-editor__section-header">
                    <span className="zenith-synth-editor__section-icon">📊</span>
                    <span className="zenith-synth-editor__section-title">Amplitude Envelope (DAHDSR)</span>
                </div>
                <div className="zenith-synth-editor__envelope">
                    <ZenithKnob
                        label="Delay"
                        value={amplitudeEnvelope.delay || 0}
                        min={0}
                        max={2}
                        color="#B67BA3"
                        valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                        onChange={(value) => handleParameterChange('amplitudeEnvelope.delay', value)}
                    />
                    <ZenithKnob
                        label="Attack"
                        value={amplitudeEnvelope.attack}
                        min={0.001}
                        max={2}
                        color="#B67BA3"
                        valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                        onChange={(value) => handleParameterChange('amplitudeEnvelope.attack', value)}
                    />
                    <ZenithKnob
                        label="Hold"
                        value={amplitudeEnvelope.hold || 0}
                        min={0}
                        max={2}
                        color="#B67BA3"
                        valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                        onChange={(value) => handleParameterChange('amplitudeEnvelope.hold', value)}
                    />
                    <ZenithKnob
                        label="Decay"
                        value={amplitudeEnvelope.decay}
                        min={0.001}
                        max={2}
                        color="#B67BA3"
                        valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                        onChange={(value) => handleParameterChange('amplitudeEnvelope.decay', value)}
                    />
                    <ZenithKnob
                        label="Sustain"
                        value={amplitudeEnvelope.sustain}
                        min={0}
                        max={1}
                        color="#B67BA3"
                        valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                        onChange={(value) => handleParameterChange('amplitudeEnvelope.sustain', value)}
                    />
                    <ZenithKnob
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

            {/* LFO Section */}
            <div className="zenith-synth-editor__section">
                <ZenithLFOPanel
                    lfos={lfos}
                    onChange={handleLFOChange}
                />
            </div>

            {/* Modulation Matrix Section */}
            <div className="zenith-synth-editor__section">
                <ZenithModMatrix
                    slots={modSlots}
                    onChange={handleModSlotChange}
                />
            </div>

            {/* Preview Keyboard */}
            <div className="zenith-synth-editor__section">
                <div className="zenith-synth-editor__section-header">
                    <span className="zenith-synth-editor__section-icon">🎹</span>
                    <span className="zenith-synth-editor__section-title">Preview</span>
                </div>
                <div className="zenith-synth-editor__keyboard">
                    {[60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72].map((midiNote) => {
                        const isBlack = [61, 63, 66, 68, 70].includes(midiNote);
                        const isActive = activeNote === midiNote;
                        return (
                            <button
                                key={midiNote}
                                className={`zenith-synth-editor__key ${isBlack ? 'zenith-synth-editor__key--black' : 'zenith-synth-editor__key--white'} ${isActive ? 'zenith-synth-editor__key--active' : ''}`}
                                onMouseDown={() => handleNoteOn(midiNote)}
                                onMouseUp={handleNoteOff}
                                onMouseLeave={handleNoteOff}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ZenithSynthEditor;
