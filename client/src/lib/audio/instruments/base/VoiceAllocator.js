/**
 * VoiceAllocator - Handles mono/poly mode logic and portamento
 *
 * Wraps VoicePool with voice mode behavior:
 * - Polyphonic: Each note gets its own voice
 * - Monophonic: Single voice shared across notes with portamento/legato
 *
 * Professional DAW standard implementation
 */
export class VoiceAllocator {
    constructor(voicePool, config = {}) {
        this.pool = voicePool;

        // Voice mode configuration
        this.mode = config.mode || 'poly'; // 'mono' | 'poly'
        this.portamento = config.portamento || 0; // Glide time in seconds
        this.legato = config.legato || false; // Mono legato mode

        // Monophonic mode state
        this.monoVoice = null; // Currently active mono voice
        this.lastFrequency = null; // For portamento
        this.heldNotes = new Set(); // Notes currently pressed (mono priority)
        this.lastNote = null; // Most recent note

        if (import.meta.env.DEV) {
            console.log(`🎹 VoiceAllocator created: mode=${this.mode}, portamento=${this.portamento}s`);
        }
    }

    /**
     * Trigger a note
     *
     * @param {number} midiNote - MIDI note number
     * @param {number} velocity - Note velocity (0-127)
     * @param {number} time - AudioContext time
     * @returns {BaseVoice|null} Allocated voice
     */
    noteOn(midiNote, velocity, time) {
        const frequency = this.midiToFreq(midiNote);

        if (this.mode === 'mono') {
            return this.handleMonoNoteOn(midiNote, velocity, frequency, time);
        } else {
            return this.handlePolyNoteOn(midiNote, velocity, frequency, time);
        }
    }

    /**
     * Monophonic note handling
     * Single voice with portamento and legato support
     */
    handleMonoNoteOn(midiNote, velocity, frequency, time) {
        // Add to held notes set
        this.heldNotes.add(midiNote);
        this.lastNote = midiNote;

        if (!this.monoVoice || !this.monoVoice.isActive) {
            // First note or voice was released - allocate new voice
            // ✅ Pass allowPolyphony=false for mono mode (re-trigger same voice)
            this.monoVoice = this.pool.allocate(midiNote, false);

            if (!this.monoVoice) {
                console.warn('VoiceAllocator: Failed to allocate mono voice');
                return null;
            }

            // Trigger voice
            this.monoVoice.trigger(midiNote, velocity, frequency, time);
            this.lastFrequency = frequency;

        } else {
            // Voice already playing - glide to new note

            if (this.portamento > 0.001 && this.lastFrequency) {
                // Portamento: smooth glide
                this.monoVoice.glideToFrequency(
                    this.lastFrequency,
                    frequency,
                    time,
                    this.portamento
                );
            }

            // Retrigger envelope if legato is off
            if (!this.legato) {
                // Re-trigger envelopes for new note
                this.monoVoice.trigger(midiNote, velocity, frequency, time);
            } else {
                // Legato: just update frequency, don't retrigger envelopes
                // (glideToFrequency already updated frequency)
                this.monoVoice.currentNote = midiNote;
                this.monoVoice.currentVelocity = velocity;
            }

            this.lastFrequency = frequency;
        }

        return this.monoVoice;
    }

    /**
     * Polyphonic note handling
     * Each note gets its own voice
     */
    handlePolyNoteOn(midiNote, velocity, frequency, time) {
        // ✅ CRITICAL FIX: Pass allowPolyphony=true to enable multiple voices for same note
        const voice = this.pool.allocate(midiNote, true);

        if (!voice) {
            console.warn(`VoiceAllocator: Failed to allocate voice for note ${midiNote}`);
            return null;
        }

        // Trigger voice
        voice.trigger(midiNote, velocity, frequency, time);

        return voice;
    }

    /**
     * Release a note
     *
     * @param {number} midiNote - MIDI note number
     * @param {number} time - AudioContext time
     */
    noteOff(midiNote, time) {
        if (this.mode === 'mono') {
            this.handleMonoNoteOff(midiNote, time);
        } else {
            this.handlePolyNoteOff(midiNote, time);
        }
    }

    /**
     * Monophonic note release
     * Uses note priority: only release if no notes are held
     */
    handleMonoNoteOff(midiNote, time) {
        // Remove from held notes
        this.heldNotes.delete(midiNote);

        if (this.heldNotes.size === 0) {
            // No more notes held - release mono voice
            if (this.monoVoice) {
                this.pool.release(this.lastNote || midiNote, time);
                this.monoVoice = null;
                this.lastFrequency = null;
                this.lastNote = null;
            }
        } else {
            // Other notes still held - keep playing
            // Optionally: retrigger most recent note (mono priority)
            // For now: just keep current note playing
        }
    }

    /**
     * Polyphonic note release
     * Simply release the specific voice
     */
    handlePolyNoteOff(midiNote, time) {
        this.pool.release(midiNote, time);
    }

    /**
     * Release all notes
     *
     * @param {number} time - AudioContext time
     */
    releaseAll(time) {
        if (this.mode === 'mono') {
            this.heldNotes.clear();
            if (this.monoVoice) {
                this.pool.release(this.lastNote || 0, time);
                this.monoVoice = null;
                this.lastFrequency = null;
                this.lastNote = null;
            }
        } else {
            this.pool.releaseAll(time);
        }
    }

    /**
     * Emergency stop (instant silence)
     */
    stopAll() {
        this.heldNotes.clear();
        this.monoVoice = null;
        this.lastFrequency = null;
        this.lastNote = null;
        this.pool.stopAll();
    }

    /**
     * Update allocator configuration
     *
     * @param {Object} config - { mode, portamento, legato }
     */
    configure(config) {
        if (config.mode !== undefined) {
            // Mode change - reset state
            if (config.mode !== this.mode) {
                this.stopAll();
            }
            this.mode = config.mode;
        }

        if (config.portamento !== undefined) {
            this.portamento = config.portamento;
        }

        if (config.legato !== undefined) {
            this.legato = config.legato;
        }

        if (import.meta.env.DEV) {
            console.log(`🎹 VoiceAllocator reconfigured: mode=${this.mode}, portamento=${this.portamento}s, legato=${this.legato}`);
        }
    }

    /**
     * Get allocator statistics
     */
    getStats() {
        return {
            mode: this.mode,
            portamento: this.portamento,
            legato: this.legato,
            heldNotes: this.heldNotes.size,
            pool: this.pool.getStats()
        };
    }

    /**
     * Helper: MIDI to frequency
     */
    midiToFreq(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }
}
