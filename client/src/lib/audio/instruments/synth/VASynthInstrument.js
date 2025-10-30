/**
 * VASynthInstrument - Wrapper for VASynth engine
 *
 * Implements BaseInstrument interface for VASynth
 * Provides unified interface for both playback and preview
 */

import { BaseInstrument } from '../base/BaseInstrument.js';
import { VASynth } from '../../synth/VASynth.js';
import { getPreset } from '../../synth/presets.js';

export class VASynthInstrument extends BaseInstrument {
    constructor(instrumentData, audioContext) {
        super(instrumentData, audioContext);

        // VASynth engine
        this.engine = null;
        this.presetName = instrumentData.presetName;
        this.preset = null;

        // Polyphony support
        this.maxVoices = 8; // Default polyphony
        this.voices = new Map(); // midiNote -> VASynth instance
        this.voiceTimeouts = new Map(); // midiNote -> timeoutId (for cleanup)

        // Master output
        this.masterGain = null;
    }

    /**
     * Initialize VASynth with preset
     */
    async initialize() {
        try {
            // Load preset
            this.preset = getPreset(this.presetName);

            if (!this.preset) {
                throw new Error(`Preset not found: ${this.presetName}`);
            }

            // Create master gain for all voices
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.setValueAtTime(0.7, this.audioContext.currentTime);

            // Set as output
            this.output = this.masterGain;

            this._isInitialized = true;

            console.log(`🎹 VASynth initialized: ${this.name} (${this.presetName})`);

        } catch (error) {
            console.error(`❌ VASynth init failed: ${this.name}:`, error);
            throw error;
        }
    }

    /**
     * Play a note (polyphonic or monophonic based on preset)
     */
    noteOn(midiNote, velocity = 100, startTime = null) {
        if (!this._isInitialized) {
            console.warn(`${this.name}: Not initialized, call initialize() first`);
            return;
        }

        const time = startTime !== null ? startTime : this.audioContext.currentTime;

        try {
            // ✅ Check if preset is in mono mode
            const isMono = this.preset?.voiceMode === 'mono';

            if (isMono) {
                // ✅ MONOPHONIC MODE: Use single shared voice
                let monoVoice = this.voices.get('mono');

                if (!monoVoice) {
                    // Create mono voice on first note
                    monoVoice = new VASynth(this.audioContext);
                    monoVoice.loadPreset(this.preset);
                    monoVoice.masterGain.connect(this.masterGain);
                    this.voices.set('mono', monoVoice);
                }

                // Trigger note on mono voice (handles portamento/legato internally)
                monoVoice.noteOn(midiNote, velocity, time);
                this.activeNotes.set(midiNote, { startTime: time, velocity });

            } else {
                // ✅ POLYPHONIC MODE: Create separate voice per note

                // If note is already playing, stop it first (cancel pending timeout)
                if (this.voices.has(midiNote)) {
                    this.noteOff(midiNote);
                }

                // Check polyphony limit
                if (this.voices.size >= this.maxVoices) {
                    // Voice stealing: stop oldest voice
                    const oldestNote = Array.from(this.voices.keys())[0];
                    this.noteOff(oldestNote);
                }

                // Create new voice for this note
                const voice = new VASynth(this.audioContext);
                voice.loadPreset(this.preset);
                voice.masterGain.connect(this.masterGain);

                // Start note
                voice.noteOn(midiNote, velocity, time);

                // Store voice
                this.voices.set(midiNote, voice);
                console.log(`🎹 VASynth noteOn: midiNote=${midiNote}, voices.size=${this.voices.size}, stored voice`);
            }

            // Track note
            this._trackNoteOn(midiNote, velocity, time);

        } catch (error) {
            console.error(`❌ VASynth noteOn failed:`, error);
        }
    }

    /**
     * Stop a note
     */
    noteOff(midiNote = null, stopTime = null) {
        if (!this._isInitialized) {
            return;
        }

        const time = stopTime !== null ? stopTime : this.audioContext.currentTime;
        const isMono = this.preset?.voiceMode === 'mono';

        try {
            if (midiNote !== null) {
                // ✅ Cancel any pending timeout for this note
                if (this.voiceTimeouts.has(midiNote)) {
                    clearTimeout(this.voiceTimeouts.get(midiNote));
                    this.voiceTimeouts.delete(midiNote);
                }

                if (isMono) {
                    // ✅ MONOPHONIC MODE: Only release if this is the last active note
                    this.activeNotes.delete(midiNote);

                    // If no more notes are pressed, release the mono voice
                    if (this.activeNotes.size === 0) {
                        const monoVoice = this.voices.get('mono');
                        if (monoVoice) {
                            monoVoice.noteOff(time);
                        }
                    }
                    // Otherwise, keep playing (mono voice handles note transitions)

                } else {
                    // ✅ POLYPHONIC MODE: Stop specific voice
                    const voice = this.voices.get(midiNote);

                    console.log(`🎹 VASynth noteOff: midiNote=${midiNote}, voice=${!!voice}, voices.size=${this.voices.size}, voices.keys=${Array.from(this.voices.keys()).join(',')}`);

                    if (voice) {
                        voice.noteOff(time);

                        // Schedule voice disposal after release
                        const releaseTime = voice.amplitudeEnvelope?.releaseTime || 0.5;
                        const timeoutId = setTimeout(() => {
                            voice.dispose();
                            this.voices.delete(midiNote);
                            this.voiceTimeouts.delete(midiNote);
                            this._trackNoteOff(midiNote);
                        }, (releaseTime + 0.1) * 1000);

                        this.voiceTimeouts.set(midiNote, timeoutId);
                    } else {
                        console.warn(`⚠️ VASynth noteOff: No voice found for midiNote=${midiNote}`);
                    }
                }
            } else {
                // ✅ Stop all notes - cancel all pending timeouts
                this.voiceTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
                this.voiceTimeouts.clear();

                // Release all voices
                this.voices.forEach((voice, note) => {
                    voice.noteOff(time);

                    // Schedule disposal
                    const releaseTime = voice.amplitudeEnvelope?.releaseTime || 0.5;
                    const timeoutId = setTimeout(() => {
                        voice.dispose();
                    }, (releaseTime + 0.1) * 1000);

                    this.voiceTimeouts.set(note, timeoutId);
                });

                // ✅ Don't clear voices immediately - let timeouts handle it
                // But clear tracking state
                this.activeNotes.clear();
                this._isPlaying = false;
            }

        } catch (error) {
            console.error(`❌ VASynth noteOff failed:`, error);
        }
    }

    /**
     * Release all notes gracefully (with release envelope)
     * Used for pause - notes fade out naturally
     */
    allNotesOff(time = null) {
        if (!this._isInitialized) return;

        const stopTime = time !== null ? time : this.audioContext.currentTime;

        console.log(`🎹 VASynth allNotesOff: ${this.name} (${this.voices.size} voices)`);

        // ✅ Cancel all pending timeouts
        this.voiceTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.voiceTimeouts.clear();

        // Release all voices with envelope
        this.voices.forEach((voice, midiNote) => {
            try {
                voice.noteOff(stopTime);

                // ✅ Schedule voice disposal after release completes
                const releaseTime = voice.amplitudeEnvelope?.releaseTime || 0.5;
                const timeoutId = setTimeout(() => {
                    voice.dispose();
                    this.voices.delete(midiNote);
                    this.voiceTimeouts.delete(midiNote);
                    this.activeNotes.delete(midiNote);
                }, (releaseTime + 0.1) * 1000);

                this.voiceTimeouts.set(midiNote, timeoutId);
            } catch (error) {
                console.error('Error releasing voice:', error);
            }
        });

        this._isPlaying = false;
    }

    /**
     * ✅ PANIC: Immediately stop all voices (no release)
     */
    stopAll() {
        if (!this._isInitialized) return;

        console.log(`🛑 VASynth stopAll: ${this.name} (${this.voices.size} voices)`);

        // ✅ Cancel ALL pending timeouts first
        this.voiceTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.voiceTimeouts.clear();

        // Immediately dispose all voices without waiting for release
        this.voices.forEach((voice) => {
            try {
                voice.dispose(); // Instant cleanup
            } catch (error) {
                console.error('Error disposing voice:', error);
            }
        });

        this.voices.clear();
        this.activeNotes.clear();
        this._isPlaying = false;
    }

    /**
     * Set master volume
     */
    setVolume(volume) {
        if (!this.masterGain) return;

        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.masterGain.gain.setValueAtTime(
            clampedVolume,
            this.audioContext.currentTime
        );
    }

    /**
     * Update preset (live parameter change)
     */
    setPreset(presetName) {
        const newPreset = getPreset(presetName);

        if (!newPreset) {
            console.warn(`Preset not found: ${presetName}`);
            return;
        }

        this.presetName = presetName;
        this.preset = newPreset;

        // Update all active voices with new preset
        this.voices.forEach(voice => {
            voice.loadPreset(this.preset);
        });
    }

    /**
     * Update multiple parameters at once (used by editor)
     * @param {Object} updates - { oscillatorSettings, filterSettings, filterEnvelope, amplitudeEnvelope }
     */
    updateParameters(updates) {
        console.log('🎛️ VASynth updateParameters called:', updates);

        // Update preset data first (for future voices)
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

        // Update all active voices with new settings
        this.voices.forEach(voice => {
            try {
                if (updates.oscillatorSettings) {
                    // ✅ FIX: Check if it's an array first
                    if (Array.isArray(updates.oscillatorSettings)) {
                        updates.oscillatorSettings.forEach((oscSettings, index) => {
                            if (oscSettings && voice.setOscillator) {
                                voice.setOscillator(index, oscSettings);
                            }
                        });
                    } else {
                        console.warn('oscillatorSettings is not an array:', typeof updates.oscillatorSettings);
                    }
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
            } catch (error) {
                console.error('Error updating voice parameters:', error);
            }
        });

        console.log('✅ VASynth parameters updated, active voices:', this.voices.size);
    }

    /**
     * Update specific parameter (legacy method)
     */
    setParameter(param, value) {
        // Update parameter on all voices
        this.voices.forEach(voice => {
            if (param.startsWith('osc')) {
                // Oscillator parameter
                const oscIndex = parseInt(param.match(/\d+/)[0]);
                const paramName = param.split('.')[1];
                voice.setOscillator(oscIndex, { [paramName]: value });

            } else if (param.startsWith('filter')) {
                // Filter parameter
                const paramName = param.replace('filter.', '');
                voice.setFilter({ [paramName]: value });

            } else if (param === 'masterVolume') {
                voice.setMasterVolume(value);
            }
        });
    }

    /**
     * Cleanup
     */
    dispose() {
        // ✅ Cancel ALL pending timeouts first to prevent memory leaks
        this.voiceTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.voiceTimeouts.clear();

        // Stop and dispose all voices
        this.voices.forEach(voice => {
            try {
                voice.noteOff();
                voice.dispose();
            } catch (e) {
                // Ignore
            }
        });

        this.voices.clear();

        // Disconnect master gain
        if (this.masterGain) {
            try {
                this.masterGain.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        super.dispose();

        console.log(`🗑️ VASynth disposed: ${this.name}`);
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
                amplitudeEnvelope: this.preset.amplitudeEnvelope
            } : null
        };
    }
}
