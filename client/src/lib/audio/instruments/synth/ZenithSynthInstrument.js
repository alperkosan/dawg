/**
 * ZenithSynthInstrument - Wrapper for ZenithSynth engine
 * 
 * Implements BaseInstrument interface for Zenith Synth
 * Provides unified interface for both playback and preview
 */

import { ZenithSynth } from '../../synth/ZenithSynth.js';
import { BaseInstrument } from '../base/BaseInstrument.js';
import { getZenithPreset } from '../../synth/zenithPresets.js';

export class ZenithSynthInstrument extends BaseInstrument {
    constructor(instrumentData, audioContext) {
        super(instrumentData, audioContext);

        // Zenith Synth engine
        this.engine = null;
        this.presetName = instrumentData.presetName || 'Deep Sub Bass';
        this.preset = null;

        // Polyphony support
        this.maxVoices = 16; // Zenith Synth supports 16 voices
        this.voices = new Map(); // midiNote -> ZenithSynth instance
        this.voiceTimeouts = new Map(); // midiNote -> timeoutId

        // Master output
        this.masterGain = null;
    }

    /**
     * Initialize Zenith Synth with preset
     */
    async initialize() {
        try {
            // Load preset
            this.preset = getZenithPreset(this.presetName);

            if (!this.preset) {
                throw new Error(`Zenith preset not found: ${this.presetName}`);
            }

            // Create master gain for all voices
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.setValueAtTime(0.7, this.audioContext.currentTime);

            // Set as output
            this.output = this.masterGain;

            this._isInitialized = true;

            console.log(`🎹 Zenith Synth initialized: ${this.name} (${this.presetName})`);

        } catch (error) {
            console.error(`❌ Zenith Synth init failed: ${this.name}:`, error);
            throw error;
        }
    }

    /**
     * Play a note
     */
    noteOn(midiNote, velocity = 100, startTime = null, extendedParams = null) {
        if (!this._isInitialized) {
            console.warn(`${this.name}: Not initialized, call initialize() first`);
            return;
        }

        const time = startTime !== null ? startTime : this.audioContext.currentTime;

        try {
            const isMono = this.preset?.voiceMode === 'mono';

            if (isMono) {
                // Monophonic mode: Use single shared voice
                let monoVoice = this.voices.get('mono');

                if (!monoVoice) {
                    // Create mono voice
                    monoVoice = new ZenithSynth(this.audioContext);
                    monoVoice.loadPreset(this.preset);
                    monoVoice.masterGain.connect(this.masterGain);
                    this.voices.set('mono', monoVoice);
                }

                monoVoice.noteOn(midiNote, velocity, time, extendedParams);
                this.activeNotes.set(midiNote, { startTime: time, velocity, extendedParams });

            } else {
                // Polyphonic mode: Create separate voice per note

                // Handle retriggering
                if (this.voices.has(midiNote)) {
                    const oldVoice = this.voices.get(midiNote);

                    // Cancel pending timeout
                    if (this.voiceTimeouts.has(midiNote)) {
                        clearTimeout(this.voiceTimeouts.get(midiNote));
                        this.voiceTimeouts.delete(midiNote);
                    }

                    if (oldVoice) {
                        // Release old voice
                        oldVoice.noteOff(time);

                        // ✅ OFFLINE RENDER FIX: Skip setTimeout in offline context
                        if (this.audioContext instanceof (window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
                            oldVoice.dispose();
                        } else {
                            // ✅ FIX: Define releaseTime before using it
                            const presetRelease = this.preset?.amplitudeEnvelope?.release || 1.0;
                            const releaseTime = oldVoice.amplitudeEnvelope?.releaseTime || presetRelease;

                            const timeoutId = setTimeout(() => {
                                oldVoice.dispose();
                            }, (releaseTime + 0.1) * 1000);

                            const timeoutKey = `retrigger_${midiNote}_${Date.now()}`;
                            this.voiceTimeouts.set(timeoutKey, timeoutId);
                        }
                    }

                    this.voices.delete(midiNote);
                }

                // Check polyphony limit
                if (this.voices.size >= this.maxVoices) {
                    // Voice stealing: stop oldest voice
                    const oldestNote = Array.from(this.voices.keys())[0];
                    this.noteOff(oldestNote);
                }

                // Create new voice
                const voice = new ZenithSynth(this.audioContext);
                voice.loadPreset(this.preset);
                voice.masterGain.connect(this.masterGain);
                voice.noteOn(midiNote, velocity, time, extendedParams);

                this.voices.set(midiNote, voice);
            }

            // Track note
            this._trackNoteOn(midiNote, velocity, time);

        } catch (error) {
            console.error(`❌ Zenith Synth noteOn failed:`, error);
        }
    }

    /**
     * Stop a note
     */
    noteOff(midiNote = null, stopTime = null) {
        if (!this._isInitialized) return;

        const time = stopTime !== null ? stopTime : this.audioContext.currentTime;
        const isMono = this.preset?.voiceMode === 'mono';

        try {
            if (midiNote !== null) {
                // Cancel pending timeout
                if (this.voiceTimeouts.has(midiNote)) {
                    clearTimeout(this.voiceTimeouts.get(midiNote));
                    this.voiceTimeouts.delete(midiNote);
                }

                if (isMono) {
                    // Monophonic mode: Only release if last note
                    this.activeNotes.delete(midiNote);

                    if (this.activeNotes.size === 0) {
                        const monoVoice = this.voices.get('mono');
                        if (monoVoice) {
                            monoVoice.noteOff(time);
                        }
                    }

                } else {
                    // Polyphonic mode: Stop specific voice
                    const voice = this.voices.get(midiNote);

                    if (voice) {
                        voice.noteOff(time);

                        // ✅ OFFLINE RENDER FIX: Skip setTimeout in offline context
                        if (this.audioContext instanceof (window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
                            voice.dispose();
                            this.voices.delete(midiNote);
                            this._trackNoteOff(midiNote);
                        } else {
                            const releaseTime = voice.amplitudeEnvelope?.releaseTime || 0.5;
                            const timeoutId = setTimeout(() => {
                                voice.dispose();
                                this.voices.delete(midiNote);
                                this.voiceTimeouts.delete(midiNote);
                                this._trackNoteOff(midiNote);
                            }, (releaseTime + 0.1) * 1000);

                            this.voiceTimeouts.set(midiNote, timeoutId);
                        }
                    }
                }
            } else {
                // Stop all notes
                this.voiceTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
                this.voiceTimeouts.clear();

                this.voices.forEach((voice, note) => {
                    voice.noteOff(time);

                    // ✅ OFFLINE RENDER FIX: Skip setTimeout in offline context
                    if (this.audioContext instanceof (window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
                        voice.dispose();
                    } else {
                        const releaseTime = voice.amplitudeEnvelope?.releaseTime || 0.5;
                        const timeoutId = setTimeout(() => {
                            voice.dispose();
                        }, (releaseTime + 0.1) * 1000);

                        this.voiceTimeouts.set(note, timeoutId);
                    }
                });

                this.activeNotes.clear();
                this._isPlaying = false;
            }

        } catch (error) {
            console.error(`❌ Zenith Synth noteOff failed:`, error);
        }
    }

    /**
     * Release all notes gracefully
     */
    allNotesOff(time = null) {
        if (!this._isInitialized) return;

        const stopTime = time !== null ? time : this.audioContext.currentTime;

        this.voiceTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.voiceTimeouts.clear();

        const isMono = this.preset?.voiceMode === 'mono';

        if (isMono && this.voices.has('mono')) {
            const monoVoice = this.voices.get('mono');
            monoVoice.dispose();
            this.voices.delete('mono');
            this.activeNotes.clear();
        } else {
            this.voices.forEach((voice, midiNote) => {
                voice.noteOff(stopTime);

                // ✅ OFFLINE RENDER FIX: Skip setTimeout in offline context
                if (this.audioContext instanceof (window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
                    voice.dispose();
                    this.voices.delete(midiNote);
                    this.activeNotes.delete(midiNote);
                } else {
                    const releaseTime = voice.amplitudeEnvelope?.releaseTime || 0.5;
                    const timeoutId = setTimeout(() => {
                        voice.dispose();
                        this.voices.delete(midiNote);
                        this.voiceTimeouts.delete(midiNote);
                        this.activeNotes.delete(midiNote);
                    }, (releaseTime + 0.1) * 1000);

                    this.voiceTimeouts.set(midiNote, timeoutId);
                }
            });
        }

        this._isPlaying = false;
    }

    /**
     * Called when the playback loop restarts
     * Pass notification to the underlying engine
     */
    onLoopRestart(loopStartTime, loopStartStep = 0) {
        if (!this._isInitialized) return;

        this.voices.forEach(voice => {
            if (voice && typeof voice.onLoopRestart === 'function') {
                try {
                    voice.onLoopRestart(loopStartTime);
                } catch (e) {
                    console.error('Error during Zenith voice onLoopRestart:', e);
                }
            }
        });
    }

    /**
     * Immediately stop all voices
     */
    stopAll() {
        if (!this._isInitialized) return;

        this.voiceTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.voiceTimeouts.clear();

        this.voices.forEach(voice => {
            try {
                voice.dispose();
            } catch (error) {
                console.error('Error disposing voice:', error);
            }
        });

        this.voices.clear();
        this.activeNotes.clear();
        this._isPlaying = false;
    }

    /**
     * ✅ PHASE 4: Set instrument volume (real-time automation)
     */
    setVolume(volume, time = null) {
        if (!this.masterGain) return;

        const now = time !== null ? time : this.audioContext.currentTime;
        const clampedVolume = Math.max(0, Math.min(1, volume));

        // ✅ IMPROVED: Linear ramping for smoother automation (Phase 2)
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(clampedVolume, now + 0.005);
    }

    /**
     * ✅ PHASE 4: Set instrument pan (real-time automation)
     */
    setPan(pan, time = null) {
        if (!this.masterGain) return;

        // Create panner node if it doesn't exist
        if (!this.panNode) {
            this.panNode = this.audioContext.createStereoPanner();

            // Reconnect: masterGain -> panNode -> output destination
            this.masterGain.disconnect();
            this.masterGain.connect(this.panNode);

            // Update output and reconnect to destinations
            const oldOutput = this.output;
            this.output = this.panNode;

            if (oldOutput && oldOutput !== this.panNode) {
                this.connectedDestinations.forEach(dest => {
                    try {
                        oldOutput.disconnect(dest);
                        this.output.connect(dest);
                    } catch (e) {
                        // Ignore
                    }
                });
            }
        }

        const now = time !== null ? time : this.audioContext.currentTime;
        const clampedPan = Math.max(-1, Math.min(1, pan));

        // ✅ IMPROVED: Linear ramping for smoother automation (Phase 2)
        this.panNode.pan.cancelScheduledValues(now);
        this.panNode.pan.setValueAtTime(this.panNode.pan.value, now);
        this.panNode.pan.linearRampToValueAtTime(clampedPan, now + 0.005);
    }

    /**
     * ✅ PHASE 4: Set filter cutoff (real-time automation)
     */
    setFilterCutoff(cutoff, time = null) {
        // Apply to all active voices
        this.voices.forEach(voice => {
            if (voice.filter && voice.filter.frequency) {
                const now = time !== null ? time : this.audioContext.currentTime;
                // Map CC 0-127 to Hz (approximate 20Hz - 20kHz)
                const freqHz = 20 + (cutoff / 127) * 19980;

                // ✅ IMPROVED: Linear ramping for smoother filter automation (Phase 2)
                voice.filter.frequency.cancelScheduledValues(now);
                voice.filter.frequency.setValueAtTime(voice.filter.frequency.value, now);
                voice.filter.frequency.linearRampToValueAtTime(freqHz, now + 0.005);
            }
        });
    }

    /**
     * Update preset
     */
    setPreset(presetName) {
        const newPreset = getZenithPreset(presetName);

        if (!newPreset) {
            console.warn(`Zenith preset not found: ${presetName}`);
            return;
        }

        this.presetName = presetName;
        this.preset = newPreset;

        // Update all active voices
        this.voices.forEach(voice => {
            voice.loadPreset(this.preset);
        });
    }

    /**
     * Update parameters
     */
    updateParameters(updates) {
        // Update preset data
        if (updates.oscillatorSettings) {
            this.preset.oscillators = updates.oscillatorSettings;
        }
        if (updates.filterSettings) {
            this.preset.filter = updates.filterSettings;
        }
        if (updates.filterEnvelope) {
            this.preset.filterEnvelope = updates.filterEnvelope;
        }
        if (updates.amplitudeEnvelope) {
            this.preset.amplitudeEnvelope = updates.amplitudeEnvelope;
        }
        if (updates.lfos) {
            this.preset.lfos = updates.lfos;
        }
        if (updates.modSlots) {
            this.preset.modulation = updates.modSlots;
        }
        if (updates.voiceMode !== undefined) {
            this.preset.voiceMode = updates.voiceMode;
        }
        if (updates.portamento !== undefined) {
            this.preset.portamento = updates.portamento;
        }
        if (updates.legato !== undefined) {
            this.preset.legato = updates.legato;
        }
        if (updates.masterVolume !== undefined) {
            this.preset.masterVolume = updates.masterVolume;
        }

        // Update all active voices
        this.voices.forEach(voice => {
            try {
                if (updates.oscillatorSettings && Array.isArray(updates.oscillatorSettings)) {
                    updates.oscillatorSettings.forEach((oscSettings, index) => {
                        if (oscSettings && voice.setOscillator) {
                            voice.setOscillator(index, oscSettings);
                        }
                    });
                }

                if (updates.filterSettings && voice.setFilter) {
                    voice.setFilter(updates.filterSettings);
                }

                if (updates.filterEnvelope && voice.setFilterEnvelope) {
                    voice.setFilterEnvelope(updates.filterEnvelope);
                }

                if (updates.amplitudeEnvelope && voice.setAmplitudeEnvelope) {
                    voice.setAmplitudeEnvelope(updates.amplitudeEnvelope);
                }

                if (updates.lfos && Array.isArray(updates.lfos)) {
                    updates.lfos.forEach((lfoSettings, index) => {
                        if (lfoSettings && voice.setLFO) {
                            voice.setLFO(index, lfoSettings);
                        }
                    });
                }

                if (updates.modSlots && voice._updateModulationSlots) {
                    voice._updateModulationSlots(updates.modSlots);
                }

                // Global voice parameters
                if (updates.voiceMode !== undefined) {
                    voice.voiceMode = updates.voiceMode;
                }
                if (updates.portamento !== undefined) {
                    voice.portamento = updates.portamento;
                }
                if (updates.legato !== undefined) {
                    voice.legato = updates.legato;
                }
                if (updates.masterVolume !== undefined) {
                    voice.setMasterVolume(updates.masterVolume);
                }
            } catch (error) {
                console.error('Error updating voice parameters:', error);
            }
        });
    }

    /**
     * Update BPM
     */
    updateBPM(bpm) {
        this.voices.forEach(voice => {
            try {
                if (voice && typeof voice.updateBPM === 'function') {
                    voice.updateBPM(bpm);
                }
            } catch (error) {
                console.warn(`Failed to update BPM for voice:`, error);
            }
        });
    }

    /**
     * Cleanup
     */
    dispose() {
        this.voiceTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.voiceTimeouts.clear();

        this.voices.forEach(voice => {
            try {
                voice.noteOff();
                voice.dispose();
            } catch (e) {
                // Ignore
            }
        });

        this.voices.clear();

        if (this.masterGain) {
            try {
                this.masterGain.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        super.dispose();

        console.log(`🗑️ Zenith Synth disposed: ${this.name}`);
    }

    /**
     * Get capabilities
     */
    get capabilities() {
        return {
            supportsPolyphony: true,
            supportsPitchBend: false,
            supportsVelocity: true,
            supportsAftertouch: false,
            maxVoices: this.maxVoices,
            supportsPresetChange: true,
            supportsParameterAutomation: true
        };
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...this.getDebugInfo(),
            presetName: this.presetName,
            activeVoices: this.voices.size,
            maxVoices: this.maxVoices,
            preset: this.preset ? {
                oscillators: this.preset.oscillators,
                filter: this.preset.filter,
                filterEnvelope: this.preset.filterEnvelope,
                amplitudeEnvelope: this.preset.amplitudeEnvelope,
                lfos: this.preset.lfos,
                modulation: this.preset.modulation,
                voiceMode: this.preset.voiceMode,
                portamento: this.preset.portamento,
                legato: this.preset.legato,
                masterVolume: this.preset.masterVolume || this.preset.masterGain
            } : null
        };
    }

    /**
     * Load preset (helper method)
     */
    loadPreset(preset) {
        // Set oscillators
        if (preset.oscillators && Array.isArray(preset.oscillators)) {
            preset.oscillators.forEach((oscSettings, index) => {
                this.setOscillator(index, oscSettings);
            });
        }

        // Set filter
        if (preset.filter) {
            this.setFilter(preset.filter);
        }

        // Set envelopes
        if (preset.filterEnvelope) {
            this.setFilterEnvelope(preset.filterEnvelope);
        }

        if (preset.amplitudeEnvelope) {
            this.setAmplitudeEnvelope(preset.amplitudeEnvelope);
        }

        // Set LFOs
        if (preset.lfos && Array.isArray(preset.lfos)) {
            preset.lfos.forEach((lfoSettings, index) => {
                this.setLFO(index, lfoSettings);
            });
        }

        // Set modulation slots
        if (preset.modulation && Array.isArray(preset.modulation)) {
            this.voices.forEach(voice => {
                if (voice._updateModulationSlots) {
                    voice._updateModulationSlots(preset.modulation);
                }
            });
        }

        // Set voice mode
        if (preset.voiceMode !== undefined) {
            this.voiceMode = preset.voiceMode;
        }

        if (preset.portamento !== undefined) {
            this.portamento = preset.portamento;
        }

        if (preset.legato !== undefined) {
            this.legato = preset.legato;
        }

        // Set master volume
        if (preset.masterVolume !== undefined) {
            this.setMasterVolume(preset.masterVolume);
        }
    }
}
