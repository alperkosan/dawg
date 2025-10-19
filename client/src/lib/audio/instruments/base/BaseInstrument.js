/**
 * BaseInstrument - Abstract base class for all instrument types
 *
 * Provides common interface and shared functionality for:
 * - Sample instruments (single and multi-sampled)
 * - VASynth instruments (native Web Audio synth)
 * - ForgeSynth instruments (legacy worklet-based)
 *
 * Used by both playback (NativeAudioEngine) and preview (PreviewManager)
 */

export class BaseInstrument {
    constructor(instrumentData, audioContext) {
        if (this.constructor === BaseInstrument) {
            throw new Error('BaseInstrument is abstract and cannot be instantiated directly');
        }

        // Core properties
        this.id = instrumentData.id;
        this.name = instrumentData.name;
        this.type = instrumentData.type;
        this.data = instrumentData;
        this.audioContext = audioContext;

        // Audio routing
        this.output = null;
        this.connectedDestinations = new Set();

        // State
        this._isPlaying = false;
        this._isInitialized = false;

        // Active voices tracking
        this.activeNotes = new Map(); // midiNote -> { startTime, velocity }
    }

    /**
     * Initialize the instrument (async operations like sample loading)
     * MUST be implemented by subclasses if needed
     */
    async initialize() {
        // Override in subclass if async initialization needed
        this._isInitialized = true;
    }

    /**
     * Start playing a note
     * MUST be implemented by subclasses
     *
     * @param {number} midiNote - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     * @param {number} startTime - AudioContext time to start (optional)
     */
    noteOn(midiNote, velocity = 100, startTime = null) {
        throw new Error('noteOn() must be implemented by subclass');
    }

    /**
     * Stop playing a note
     * MUST be implemented by subclasses
     *
     * @param {number} midiNote - MIDI note number (optional, if null stops all)
     * @param {number} stopTime - AudioContext time to stop (optional)
     */
    noteOff(midiNote = null, stopTime = null) {
        throw new Error('noteOff() must be implemented by subclass');
    }

    /**
     * Trigger a note (PlaybackManager compatible interface)
     * Converts pitch string to MIDI note and calls noteOn
     *
     * @param {string} pitch - Note pitch (e.g., 'C4', 'A#3')
     * @param {number} velocity - Note velocity (0-1 normalized)
     * @param {number} time - AudioContext time to start
     * @param {number} duration - Note duration in seconds (optional)
     */
    triggerNote(pitch, velocity = 1, time = null, duration = null) {
        const midiNote = this.pitchToMidi(pitch);
        const midiVelocity = Math.round(velocity * 127);
        const startTime = time !== null ? time : this.audioContext.currentTime;

        console.log(`🎵 triggerNote: ${pitch} (MIDI ${midiNote}), vel: ${velocity.toFixed(2)}, duration: ${duration ? duration.toFixed(3) + 's' : 'null'}, time: ${startTime.toFixed(3)}s (now: ${this.audioContext.currentTime.toFixed(3)}s)`);

        this.noteOn(midiNote, midiVelocity, startTime);

        // Store for potential noteOff
        if (duration && duration > 0) {
            this.activeNotes.set(midiNote, { startTime, duration, pitch });
        }
    }

    /**
     * Release a note (PlaybackManager compatible interface)
     * Converts pitch string to MIDI note and calls noteOff
     *
     * @param {string} pitch - Note pitch (e.g., 'C4', 'A#3')
     * @param {number} time - AudioContext time to stop (optional)
     */
    releaseNote(pitch, time = null) {
        const midiNote = this.pitchToMidi(pitch);
        const stopTime = time !== null ? time : this.audioContext.currentTime;
        console.log(`📍 releaseNote: ${pitch} (MIDI ${midiNote}) at ${stopTime.toFixed(3)}s (now: ${this.audioContext.currentTime.toFixed(3)}s)`);
        this.noteOff(midiNote, stopTime);
    }

    /**
     * Stop all notes immediately
     * Used for pause/stop functionality
     */
    allNotesOff() {
        const now = this.audioContext.currentTime;
        this.noteOff(null, now); // null = all notes
    }

    /**
     * Connect instrument output to destination
     *
     * @param {AudioNode} destination - Destination node
     */
    connect(destination) {
        if (!this.output) {
            console.warn(`${this.name}: No output node to connect`);
            return;
        }

        try {
            this.output.connect(destination);
            this.connectedDestinations.add(destination);
            console.log(`✅ ${this.name} connected to destination`);
        } catch (error) {
            console.error(`❌ ${this.name}: Connection failed:`, error);
        }
    }

    /**
     * Disconnect instrument output
     *
     * @param {AudioNode} destination - Specific destination (optional)
     */
    disconnect(destination = null) {
        if (!this.output) return;

        try {
            if (destination) {
                this.output.disconnect(destination);
                this.connectedDestinations.delete(destination);
            } else {
                this.output.disconnect();
                this.connectedDestinations.clear();
            }
        } catch (error) {
            console.error(`❌ ${this.name}: Disconnect failed:`, error);
        }
    }

    /**
     * Cleanup and dispose resources
     * SHOULD be overridden by subclasses to cleanup specific resources
     */
    dispose() {
        // Stop all active notes
        this.activeNotes.forEach((_, midiNote) => {
            try {
                this.noteOff(midiNote);
            } catch (e) {
                // Ignore
            }
        });
        this.activeNotes.clear();

        // Disconnect all
        this.disconnect();

        this._isPlaying = false;
        this._isInitialized = false;

        console.log(`🗑️ ${this.name} disposed`);
    }

    /**
     * Set instrument volume
     *
     * @param {number} volume - Volume (0-1)
     */
    setVolume(volume) {
        // Override in subclass if volume control is supported
        console.warn(`${this.name}: setVolume() not implemented`);
    }

    /**
     * Set instrument pan
     *
     * @param {number} pan - Pan (-1 to 1)
     */
    setPan(pan) {
        // Override in subclass if pan control is supported
        console.warn(`${this.name}: setPan() not implemented`);
    }

    // =================== GETTERS ===================

    get isPlaying() {
        return this._isPlaying;
    }

    get isInitialized() {
        return this._isInitialized;
    }

    get instrumentType() {
        return this.type;
    }

    get instrumentId() {
        return this.id;
    }

    get instrumentName() {
        return this.name;
    }

    /**
     * Get instrument capabilities
     */
    get capabilities() {
        return {
            supportsPolyphony: false,
            supportsPitchBend: false,
            supportsVelocity: true,
            supportsAftertouch: false,
            maxVoices: 1
        };
    }

    // =================== UTILITY METHODS ===================

    /**
     * Convert MIDI note to frequency
     */
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    /**
     * Convert pitch string or MIDI number to MIDI note number
     * @param {string|number} pitch - Note pitch (e.g., 'C4', 'A#3', 'Db2') or MIDI number
     * @returns {number} MIDI note number (0-127)
     */
    pitchToMidi(pitch) {
        // ✅ NEW: If already a number, validate and return it
        if (typeof pitch === 'number') {
            const midiNote = Math.max(0, Math.min(127, Math.round(pitch)));
            if (pitch !== midiNote) {
                console.warn(`MIDI note out of range: ${pitch}, clamped to ${midiNote}`);
            }
            return midiNote;
        }

        // ✅ LEGACY: Parse string format
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };

        // Parse pitch (e.g., "C4" or "C#4")
        const match = pitch.match(/^([A-G][#b]?)(-?\d+)$/);
        if (!match) {
            console.warn(`Invalid pitch format: ${pitch}, defaulting to C4`);
            return 60; // C4
        }

        const [, noteName, octave] = match;
        const noteOffset = noteMap[noteName];
        if (noteOffset === undefined) {
            console.warn(`Unknown note name: ${noteName}, defaulting to C4`);
            return 60;
        }

        // MIDI note = (octave + 1) * 12 + noteOffset
        const midiNote = (parseInt(octave) + 1) * 12 + noteOffset;
        return Math.max(0, Math.min(127, midiNote)); // Clamp to valid MIDI range
    }

    /**
     * Convert frequency to MIDI note
     */
    frequencyToMidi(frequency) {
        return Math.round(69 + 12 * Math.log2(frequency / 440));
    }

    /**
     * Get note name from MIDI number
     */
    midiToNoteName(midiNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        return `${noteName}${octave}`;
    }

    /**
     * Track active note
     */
    _trackNoteOn(midiNote, velocity, startTime) {
        this.activeNotes.set(midiNote, {
            startTime: startTime || this.audioContext.currentTime,
            velocity
        });
        this._isPlaying = true;
    }

    /**
     * Untrack active note
     */
    _trackNoteOff(midiNote) {
        this.activeNotes.delete(midiNote);
        if (this.activeNotes.size === 0) {
            this._isPlaying = false;
        }
    }

    /**
     * Get debug info
     */
    getDebugInfo() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            isPlaying: this._isPlaying,
            isInitialized: this._isInitialized,
            activeNotes: Array.from(this.activeNotes.keys()),
            connectedDestinations: this.connectedDestinations.size
        };
    }
}
