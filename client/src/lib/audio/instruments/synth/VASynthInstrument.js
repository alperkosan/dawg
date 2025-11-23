/**
 * VASynthInstrument - Wrapper for VASynth engine
 *
 * Implements BaseInstrument interface for VASynth
 * Provides unified interface for both playback and preview
 */

import { BaseInstrument } from '../base/BaseInstrument.js';
import { VASynth } from '../../synth/VASynth.js';
import { getPreset } from '../../synth/presets.js';

const normalizeModulationMatrix = (matrix) => {
    if (!Array.isArray(matrix)) {
        return [];
    }

    return matrix
        .filter(Boolean)
        .map((slot) => {
            const destination = slot.destination || slot.target;
            if (!slot.source || !destination) {
                return null;
            }

            return {
                ...slot,
                target: slot.target ?? destination,
                destination
            };
        })
        .filter(Boolean);
};

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

        this.modulationMatrix = normalizeModulationMatrix(instrumentData?.modulationMatrix || []);
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

            if (this.modulationMatrix.length > 0) {
                this.preset = {
                    ...this.preset,
                    modulationMatrix: this.modulationMatrix
                };
            } else if (Array.isArray(this.preset?.modulationMatrix)) {
                this.modulationMatrix = normalizeModulationMatrix(this.preset.modulationMatrix);
                this.preset.modulationMatrix = this.modulationMatrix;
            }

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
    noteOn(midiNote, velocity = 100, startTime = null, extendedParams = null) {
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

                // ✅ BUG #2 FIX: Check if existing voice is in cleanup phase
                // If voice exists but is not playing and oscillators are null, it's in cleanup phase
                if (monoVoice && !monoVoice.isPlaying && 
                    (!monoVoice.oscillators || monoVoice.oscillators.every(osc => !osc))) {
                    // Voice is in cleanup phase - dispose it and create new one
                    try {
                        monoVoice.dispose();
                    } catch (e) {
                        // Ignore disposal errors
                    }
                    this.voices.delete('mono');
                    monoVoice = null;
                }

                if (!monoVoice) {
                    // Create mono voice on first note or after cleanup
                    monoVoice = new VASynth(this.audioContext);
                    monoVoice.loadPreset(this.preset);
                    if (this.modulationMatrix.length > 0) {
                        monoVoice.updateParameters({ modulationMatrix: this.modulationMatrix });
                    }

                    this.voices.set('mono', monoVoice);
                }

                // ✅ BUG #1 FIX: Reset routing for mono voice to prevent double connections
                // Check if voice is still valid and masterGain exists before disconnecting
                if (monoVoice && monoVoice.masterGain) {
                    try {
                        // Check if masterGain is still connected (has any connections)
                        // If already disconnected or disposed, this will throw, which is fine
                        monoVoice.masterGain.disconnect();
                    } catch (e) {
                        // Voice might be in cleanup phase or already disconnected - ignore
                    }
                }

                // ✅ PHASE 2: Apply per-note pan if present
                if (extendedParams?.pan !== undefined && extendedParams.pan !== 0) {
                    const panner = this.audioContext.createStereoPanner();
                    panner.pan.setValueAtTime(extendedParams.pan, time);
                    monoVoice.masterGain.connect(panner);
                    panner.connect(this.masterGain);
                } else {
                    monoVoice.masterGain.connect(this.masterGain);
                }

                // ✅ PHASE 2: Trigger note on mono voice with extended params
                console.log(`🎹 VASynth Mono noteOn: midiNote=${midiNote}, velocity=${velocity}, instrumentName=${this.name}`);
                monoVoice.noteOn(midiNote, velocity, time, extendedParams);
                this.activeNotes.set(midiNote, { startTime: time, velocity, extendedParams });

            } else {
                // ✅ POLYPHONIC MODE: Create separate voice per note

                // ✅ RETRIGGER HANDLING: Respect instrument's cutItself parameter
                if (this.voices.has(midiNote)) {
                    const oldVoice = this.voices.get(midiNote);

                    // ✅ BUG #4 FIX: Cancel ALL pending timeouts for this note (both regular and retrigger)
                    // Cancel regular timeout
                    if (this.voiceTimeouts.has(midiNote)) {
                        clearTimeout(this.voiceTimeouts.get(midiNote));
                        this.voiceTimeouts.delete(midiNote);
                    }
                    // Cancel all retrigger timeouts (they use unique keys like retrigger_${midiNote}_${timestamp})
                    const retriggerKeys = Array.from(this.voiceTimeouts.keys()).filter(key => 
                        typeof key === 'string' && key.startsWith(`retrigger_${midiNote}_`)
                    );
                    retriggerKeys.forEach(key => {
                        clearTimeout(this.voiceTimeouts.get(key));
                        this.voiceTimeouts.delete(key);
                    });

                    if (oldVoice) {
                        // ✅ Check cutItself parameter (default: false for natural release)
                        const cutItself = this.preset?.cutItself ?? false;

                        if (cutItself) {
                            // ✅ IMMEDIATE CUT: Quick fade-out for percussive/drum sounds
                            try {
                                const now = this.audioContext.currentTime;
                                const fadeTime = 0.01; // 10ms quick fade to prevent click

                                if (oldVoice.amplitudeGain) {
                                    oldVoice.amplitudeGain.gain.cancelScheduledValues(now);
                                    oldVoice.amplitudeGain.gain.setValueAtTime(oldVoice.amplitudeGain.gain.value, now);
                                    oldVoice.amplitudeGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeTime);
                                }

                                setTimeout(() => {
                                    oldVoice.dispose();
                                }, fadeTime * 1000 + 10);

                                console.log(`✂️ Retrigger (cut itself): Quick fade for note ${midiNote}`);
                            } catch (e) {
                                console.warn(`⚠️ Failed to cut voice:`, e);
                                // ✅ FIX: Use dispose() instead of cleanup()
                                try { oldVoice.dispose(); } catch (disposeError) { /* Already disposed */ }
                            }
                        } else {
                            // ✅ NATURAL RELEASE: Use instrument's ADSR release envelope
                            try {
                                oldVoice.noteOff(time);

                                // ✅ FIX: Use preset's actual release time, better fallback
                                const presetRelease = this.preset?.amplitudeEnvelope?.release || 1.0;
                                const releaseTime = oldVoice.amplitudeEnvelope?.releaseTime || presetRelease;
                                const timeoutId = setTimeout(() => {
                                    oldVoice.dispose();
                                    console.log(`♻️ Disposed retriggered voice for note ${midiNote} after ${releaseTime}s release`);
                                }, (releaseTime + 0.1) * 1000);

                                // ✅ FIX: Use unique timestamp to avoid collision
                                const timeoutKey = `retrigger_${midiNote}_${Date.now()}`;
                                this.voiceTimeouts.set(timeoutKey, timeoutId);

                                console.log(`🔄 Retrigger (natural release): ${releaseTime}s release for note ${midiNote}`);
                            } catch (e) {
                                console.warn(`⚠️ Failed to trigger noteOff on old voice:`, e);
                                // ✅ FIX: Use dispose() instead of cleanup()
                                try { oldVoice.dispose(); } catch (disposeError) { /* Already disposed */ }
                            }
                        }
                    }

                    // ✅ FIX: Remove from map AFTER setting up cleanup
                    // This ensures we don't lose the reference before disposal is scheduled
                    this.voices.delete(midiNote);
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
                if (this.modulationMatrix.length > 0) {
                    voice.updateParameters({ modulationMatrix: this.modulationMatrix });
                }

                // ✅ PHASE 2: Apply per-note pan if present
                if (extendedParams?.pan !== undefined && extendedParams.pan !== 0) {
                    const panner = this.audioContext.createStereoPanner();
                    panner.pan.setValueAtTime(extendedParams.pan, time);
                    voice.masterGain.connect(panner);
                    panner.connect(this.masterGain);
                } else {
                    voice.masterGain.connect(this.masterGain);
                }

                // ✅ PHASE 2: Start note with extended params
                voice.noteOn(midiNote, velocity, time, extendedParams);

                // Store voice
                this.voices.set(midiNote, voice);
                console.log(`🎹 VASynth noteOn: midiNote=${midiNote}, velocity=${velocity}, voices.size=${this.voices.size}, instrumentName=${this.name}`);
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

                    console.log(`🔴 VASynth noteOff: instrumentName=${this.name}, midiNote=${midiNote}, hasVoice=${!!voice}, voices.size=${this.voices.size}, voices.keys=[${Array.from(this.voices.keys()).join(',')}]`);

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

        // ✅ CRITICAL FIX: For mono mode, immediately dispose voice to prevent playback issues on loop restart
        // Mono voice reuse can cause problems when voice is in release phase during new loop
        const isMono = this.preset?.voiceMode === 'mono';
        
        if (isMono && this.voices.has('mono')) {
            // Mono mode: Immediately dispose to ensure clean state for next loop
            const monoVoice = this.voices.get('mono');
            try {
                monoVoice.dispose(); // Immediate cleanup
            } catch (error) {
                console.error('Error disposing mono voice:', error);
            }
            this.voices.delete('mono');
            this.activeNotes.clear();
        } else {
            // Polyphonic mode: Release all voices with envelope
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
        }

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

        // ✅ Dispose all voices (calls cleanup which lets envelopes finish naturally)
        this.voices.forEach((voice) => {
            try {
                voice.dispose();
            } catch (error) {
                console.error('Error disposing voice:', error);
            }
        });

        // Clear state
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
        // ✅ LFO PLAYBACK: Update LFO settings in preset
        if (updates.lfo1) {
            this.preset.lfo = updates.lfo1;
            // ✅ LFO TARGET: Update LFO target if provided
            if (updates.lfo1.target !== undefined) {
                this.preset.lfoTarget = updates.lfo1.target;
            }
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

                // ✅ LFO PLAYBACK: Update LFO settings in active voices
                if (updates.lfo1 && voice.updateParameters) {
                    voice.updateParameters({ lfo1: updates.lfo1 });
                }
            } catch (error) {
                console.error('Error updating voice parameters:', error);
            }
        });

        if (updates.modulationMatrix) {
            const normalizedMatrix = normalizeModulationMatrix(updates.modulationMatrix);
            this.modulationMatrix = normalizedMatrix;
            this.preset.modulationMatrix = normalizedMatrix;

            if (normalizedMatrix.length === 0) {
                console.log('ℹ️ VASynth modulation matrix cleared');
            }

            this.voices.forEach((voice) => {
                try {
                    voice.updateParameters({ modulationMatrix: normalizedMatrix });
                } catch (error) {
                    console.warn('⚠️ Failed to update modulation matrix on voice:', error);
                }
            });
        }

        console.log('✅ VASynth parameters updated, active voices:', this.voices.size);
    }

    /**
     * ✅ TEMPO SYNC: Update BPM for all active voices
     * Called when transport BPM changes
     */
    updateBPM(bpm) {
        this.voices.forEach(voice => {
            try {
                if (voice && voice.lfo && typeof voice.lfo.updateBPM === 'function') {
                    voice.lfo.updateBPM(bpm);
                }
                // ✅ TEMPO SYNC: Also update VASynth's internal BPM
                if (voice && typeof voice.bpm !== 'undefined') {
                    voice.bpm = bpm;
                }
            } catch (error) {
                console.warn(`Failed to update BPM for voice:`, error);
            }
        });
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

    /**
     * ✅ PHASE 4: Set instrument volume (real-time automation)
     */
    setVolume(volume, time = null) {
        if (!this.masterGain) return;

        const now = time !== null ? time : this.audioContext.currentTime;
        const clampedVolume = Math.max(0, Math.min(1, volume));

        // Smooth transition to avoid clicks
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(clampedVolume, now, 0.01);
    }

    /**
     * ✅ PHASE 4: Set instrument pan (real-time automation)
     * Note: This creates a shared panner for all voices
     */
    setPan(pan, time = null) {
        if (!this.masterGain) return;

        // Create panner node if doesn't exist
        if (!this.panNode) {
            this.panNode = this.audioContext.createStereoPanner();

            // Reconnect: masterGain -> panNode -> output destination
            this.masterGain.disconnect();
            this.masterGain.connect(this.panNode);

            // Update output to point to panner
            const oldOutput = this.output;
            this.output = this.panNode;

            // Reconnect to all existing destinations
            this.connectedDestinations.forEach(dest => {
                try {
                    this.output.connect(dest);
                } catch (e) {
                    console.warn('Failed to reconnect to destination:', e);
                }
            });
        }

        const now = time !== null ? time : this.audioContext.currentTime;
        const clampedPan = Math.max(-1, Math.min(1, pan));

        // Smooth transition to avoid clicks
        this.panNode.pan.cancelScheduledValues(now);
        this.panNode.pan.setTargetAtTime(clampedPan, now, 0.01);
    }

    /**
     * ✅ PHASE 4: Set filter cutoff (real-time automation)
     */
    setFilterCutoff(cutoff, time = null) {
        // Apply to all active voices
        this.voices.forEach(voice => {
            if (voice.filter && voice.filter.frequency) {
                const now = time !== null ? time : this.audioContext.currentTime;
                const freqHz = 20 + (cutoff / 127) * 20000; // Map 0-127 to 20Hz-20kHz
                voice.filter.frequency.setTargetAtTime(freqHz, now, 0.01);
            }
        });
    }

    /**
     * ✅ PHASE 4: Set filter resonance (real-time automation)
     */
    setFilterResonance(resonance, time = null) {
        // Apply to all active voices
        this.voices.forEach(voice => {
            if (voice.filter && voice.filter.Q) {
                const now = time !== null ? time : this.audioContext.currentTime;
                const qValue = 0.1 + (resonance / 127) * 30; // Map 0-127 to 0.1-30
                voice.filter.Q.setTargetAtTime(qValue, now, 0.01);
            }
        });
    }
}
