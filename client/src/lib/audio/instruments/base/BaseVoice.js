/**
 * BaseVoice - Abstract base class for all voice engines
 *
 * Single voice, no polyphony logic - just sound generation
 * Designed to be pooled and reused (no GC during playback)
 *
 * Subclasses: VASynthVoice, WavetableVoice, FMVoice, etc.
 */
export class BaseVoice {
    constructor(audioContext) {
        this.context = audioContext;
        this.output = null; // AudioNode - connect to mixer/master

        // Voice state
        this.isActive = false;
        this.currentNote = null;
        this.currentVelocity = 0;
        this.startTime = null;

        // For voice stealing priority calculation
        this.priority = 0;
    }

    /**
     * Initialize voice (create audio nodes)
     * Called once during voice pool creation
     *
     * Subclasses MUST:
     * 1. Create audio node graph
     * 2. Set this.output to final gain node
     * 3. Start oscillators (if any) immediately but silent
     */
    initialize() {
        throw new Error('BaseVoice.initialize() must be implemented by subclass');
    }

    /**
     * Start playing a note
     *
     * @param {number} midiNote - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     * @param {number} frequency - Calculated frequency in Hz (for portamento)
     * @param {number} time - AudioContext time to start
     *
     * Subclasses should:
     * 1. Set oscillator frequencies
     * 2. Trigger envelopes
     * 3. Update voice state
     */
    trigger(midiNote, velocity, frequency, time) {
        throw new Error('BaseVoice.trigger() must be implemented by subclass');
    }

    /**
     * Release note (start envelope release phase)
     *
     * @param {number} time - AudioContext time to release
     * @returns {number} Release duration in seconds
     *
     * Subclasses should:
     * 1. Trigger release phase of all envelopes
     * 2. Return the longest release time
     */
    release(time) {
        throw new Error('BaseVoice.release() must be implemented by subclass');
    }

    /**
     * Reset voice to initial state (for voice pool reuse)
     *
     * NO disposal - audio nodes persist!
     * Just reset parameters and state
     *
     * Subclasses should:
     * 1. Set all gains to 0
     * 2. Reset envelope states
     * 3. Clear parameter automation
     */
    reset() {
        this.isActive = false;
        this.currentNote = null;
        this.currentVelocity = 0;
        this.startTime = null;
        this.priority = 0;
    }

    /**
     * Dispose voice (cleanup audio nodes)
     * Called only when destroying voice pool
     *
     * Subclasses should:
     * 1. Stop and disconnect all audio nodes
     * 2. Dispose envelopes, LFOs, etc.
     */
    dispose() {
        if (this.output) {
            try {
                this.output.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }
    }

    /**
     * Get current amplitude (for voice stealing priority)
     *
     * @returns {number} Current amplitude (0-1)
     *
     * Subclasses should return current envelope amplitude
     */
    getAmplitude() {
        return 0;
    }

    /**
     * Glide to new frequency (for portamento/glide)
     *
     * @param {number} fromFreq - Starting frequency
     * @param {number} toFreq - Target frequency
     * @param {number} time - Start time
     * @param {number} duration - Glide duration in seconds
     *
     * Optional - only needed for instruments with portamento support
     */
    glideToFrequency(fromFreq, toFreq, time, duration) {
        // Default: no glide support
        // Override in subclass if needed
    }

    /**
     * Update voice priority (for voice stealing)
     * Higher priority = less likely to be stolen
     */
    updatePriority() {
        let priority = 0;

        // Active notes have higher priority
        if (this.isActive) {
            priority += 100;
        }

        // Recent notes have higher priority
        if (this.startTime) {
            const age = this.context.currentTime - this.startTime;
            priority += Math.max(0, 50 - age * 10);
        }

        // Louder notes have higher priority
        priority += this.getAmplitude() * 50;

        // Higher velocity has higher priority
        priority += (this.currentVelocity / 127) * 25;

        this.priority = priority;
        return priority;
    }

    /**
     * Helper: MIDI to frequency conversion
     */
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    /**
     * Helper: Get note name from MIDI number
     */
    midiToNoteName(midiNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const note = noteNames[midiNote % 12];
        return `${note}${octave}`;
    }
}
