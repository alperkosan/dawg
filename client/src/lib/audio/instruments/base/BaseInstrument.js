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
    /**
     * Start playing a note
     * @param {number} midiNote - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     * @param {number} startTime - AudioContext time to start
     * @param {Object} extendedParams - Extended note parameters (optional)
     */
    noteOn(midiNote, velocity = 100, startTime = null, extendedParams = null) {
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
     * @param {Object} extendedParams - Extended note parameters (optional)
     * @param {number} [extendedParams.pan] - Per-note pan (-1 to 1)
     * @param {number} [extendedParams.modWheel] - Mod wheel (CC1) value (0-127)
     * @param {number} [extendedParams.aftertouch] - Aftertouch value (0-127)
     * @param {Array} [extendedParams.pitchBend] - Pitch bend automation points
     */
    triggerNote(pitch, velocity = 1, time = null, duration = null, extendedParams = null) {
        const midiNote = this.pitchToMidi(pitch);

        // ✅ PHASE 4: Apply volume and expression automation to velocity
        let finalVelocity = velocity;

        // Volume (CC7) - master volume control
        if (extendedParams?.volume !== undefined) {
            finalVelocity = finalVelocity * extendedParams.volume;
        }

        // Expression (CC11) - dynamic volume control (like breath control)
        if (extendedParams?.expression !== undefined) {
            finalVelocity = finalVelocity * extendedParams.expression;
        }

        // 🔧 FIX: Auto-detect velocity format (MIDI 0-127 or normalized 0-1)
        // If velocity > 1, assume it's already in MIDI format (0-127)
        // Otherwise, convert normalized (0-1) to MIDI (0-127)
        const midiVelocity = finalVelocity > 1
            ? Math.round(Math.max(1, Math.min(127, finalVelocity)))  // Already MIDI format
            : Math.round(finalVelocity * 127);  // Convert normalized to MIDI

        const startTime = time !== null ? time : this.audioContext.currentTime;

        // ✅ FIX: Add duration to extendedParams so it reaches voice level
        const paramsWithDuration = extendedParams ? { ...extendedParams } : {};
        if (duration && duration > 0) {
            paramsWithDuration.duration = duration;
        }

        // 🐛 DEBUG: Always log for timeline preview debugging
        console.log(`🎵 ${this.name}.triggerNote:`, {
            pitch,
            midiNote,
            velocity: velocity.toFixed(2),
            volume: extendedParams?.volume?.toFixed(2) || 'none',
            finalVelocity: finalVelocity.toFixed(2),
            midiVelocity,
            duration: duration ? duration.toFixed(3) + 's' : 'null',
            startTime: startTime.toFixed(3) + 's',
            now: this.audioContext.currentTime.toFixed(3) + 's',
            isInitialized: this._isInitialized,
            hasBuffer: this.sampleBuffer ? 'YES' : 'NO',
            extendedParams: extendedParams ? 'YES' : 'NO'
        });

        // ✅ FIX: Pass duration via extendedParams to noteOn
        this.noteOn(midiNote, midiVelocity, startTime, Object.keys(paramsWithDuration).length > 0 ? paramsWithDuration : null);

        // Store for potential noteOff
        if (duration && duration > 0) {
            this.activeNotes.set(midiNote, { startTime, duration, pitch, extendedParams });
        }
    }

    /**
     * Release a note (PlaybackManager compatible interface)
     * Converts pitch string to MIDI note and calls noteOff
     *
     * @param {string} pitch - Note pitch (e.g., 'C4', 'A#3')
     * @param {number} time - AudioContext time to stop (optional)
     * @param {number} releaseVelocity - Release velocity (0-127, optional)
     */
    releaseNote(pitch, time = null, releaseVelocity = null) {
        const midiNote = this.pitchToMidi(pitch);
        const stopTime = time !== null ? time : this.audioContext.currentTime;
        // Debug: console.log(`📍 releaseNote: ${pitch} (MIDI ${midiNote}) at ${stopTime.toFixed(3)}s (now: ${this.audioContext.currentTime.toFixed(3)}s)`);
        this.noteOff(midiNote, stopTime, releaseVelocity);
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
     * Apply automation parameters to instrument
     * Called during playback to apply real-time automation
     *
     * @param {Object} params - Automation parameters
     * @param {number} params.volume - Volume (0-1, optional)
     * @param {number} params.pan - Pan (-1 to 1, optional)
     * @param {number} params.expression - Expression (0-1, optional)
     * @param {number} params.filterCutoff - Filter cutoff (0-127, optional)
     * @param {number} params.filterResonance - Filter resonance (0-127, optional)
     * @param {number} time - AudioContext time to apply (optional)
     */
    applyAutomation(params, time = null) {
        const now = time !== null ? time : this.audioContext.currentTime;

        // Volume automation
        if (params.volume !== undefined) {
            this.setVolume(params.volume, now);
        }

        // Expression automation (similar to volume but separate)
        if (params.expression !== undefined) {
            this.setExpression(params.expression, now);
        }

        // Pan automation
        if (params.pan !== undefined) {
            this.setPan(params.pan, now);
        }

        // Filter automation
        if (params.filterCutoff !== undefined) {
            this.setFilterCutoff(params.filterCutoff, now);
        }

        if (params.filterResonance !== undefined) {
            this.setFilterResonance(params.filterResonance, now);
        }

        // Other automation can be added here
    }

    /**
     * Set instrument volume
     *
     * @param {number} volume - Volume (0-1)
     * @param {number} time - AudioContext time (optional)
     */
    setVolume(volume, time = null) {
        // Override in subclass if volume control is supported
        // Default: no-op
    }

    /**
     * Set instrument expression (dynamic volume)
     *
     * @param {number} expression - Expression (0-1)
     * @param {number} time - AudioContext time (optional)
     */
    setExpression(expression, time = null) {
        // Override in subclass if expression control is supported
        // Default: no-op
    }

    /**
     * Set instrument pan
     *
     * @param {number} pan - Pan (-1 to 1)
     * @param {number} time - AudioContext time (optional)
     */
    setPan(pan, time = null) {
        // Override in subclass if pan control is supported
        // Default: no-op
    }

    /**
     * Set filter cutoff
     *
     * @param {number} cutoff - Cutoff (0-127)
     * @param {number} time - AudioContext time (optional)
     */
    setFilterCutoff(cutoff, time = null) {
        // Override in subclass if filter control is supported
        // Default: no-op
    }

    /**
     * Set filter resonance
     *
     * @param {number} resonance - Resonance (0-127)
     * @param {number} time - AudioContext time (optional)
     */
    setFilterResonance(resonance, time = null) {
        // Override in subclass if filter control is supported
        // Default: no-op
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
