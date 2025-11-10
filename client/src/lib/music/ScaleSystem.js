/**
 * Scale System
 * Phase 5: Musical Intelligence - Scale & Music Theory System
 *
 * Provides music theory foundation for:
 * - Scale highlighting in Piano Roll
 * - Lock-to-scale mode
 * - Note snapping
 * - Chord detection basis
 */

// Scale definitions: intervals in semitones from root
export const SCALES = {
    major: {
        name: 'Major',
        intervals: [0, 2, 4, 5, 7, 9, 11],
        description: 'Happy, bright sound',
        color: '#3b82f6' // Blue
    },
    minor: {
        name: 'Natural Minor',
        intervals: [0, 2, 3, 5, 7, 8, 10],
        description: 'Sad, emotional sound',
        color: '#8b5cf6' // Purple
    },
    harmonicMinor: {
        name: 'Harmonic Minor',
        intervals: [0, 2, 3, 5, 7, 8, 11],
        description: 'Exotic, Middle Eastern sound',
        color: '#ec4899' // Pink
    },
    melodicMinor: {
        name: 'Melodic Minor',
        intervals: [0, 2, 3, 5, 7, 9, 11],
        description: 'Jazz, sophisticated sound',
        color: '#f59e0b' // Amber
    },
    dorian: {
        name: 'Dorian',
        intervals: [0, 2, 3, 5, 7, 9, 10],
        description: 'Jazzy, funky sound',
        color: '#10b981' // Emerald
    },
    phrygian: {
        name: 'Phrygian',
        intervals: [0, 1, 3, 5, 7, 8, 10],
        description: 'Spanish, flamenco sound',
        color: '#ef4444' // Red
    },
    lydian: {
        name: 'Lydian',
        intervals: [0, 2, 4, 6, 7, 9, 11],
        description: 'Dreamy, ethereal sound',
        color: '#06b6d4' // Cyan
    },
    mixolydian: {
        name: 'Mixolydian',
        intervals: [0, 2, 4, 5, 7, 9, 10],
        description: 'Blues, rock sound',
        color: '#f97316' // Orange
    },
    locrian: {
        name: 'Locrian',
        intervals: [0, 1, 3, 5, 6, 8, 10],
        description: 'Dark, unstable sound',
        color: '#6b7280' // Gray
    },
    pentatonicMajor: {
        name: 'Pentatonic Major',
        intervals: [0, 2, 4, 7, 9],
        description: 'Simple, uplifting sound',
        color: '#84cc16' // Lime
    },
    pentatonicMinor: {
        name: 'Pentatonic Minor',
        intervals: [0, 3, 5, 7, 10],
        description: 'Blues, rock sound',
        color: '#a855f7' // Violet
    },
    blues: {
        name: 'Blues Scale',
        intervals: [0, 3, 5, 6, 7, 10],
        description: 'Classic blues sound',
        color: '#3b82f6' // Blue
    },
    chromatic: {
        name: 'Chromatic',
        intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        description: 'All notes',
        color: '#ffffff' // White
    }
};

// Note names
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * ScaleSystem Class
 * Handles scale operations and note validation
 */
export class ScaleSystem {
    constructor() {
        this.currentScale = null; // { root: 0-11, scaleType: 'major' }
        this.lockToScale = false;
    }

    /**
     * Set the current scale
     * @param {number} root - Root note (0-11, where 0 = C)
     * @param {string} scaleType - Scale type key from SCALES
     */
    setScale(root, scaleType) {
        if (!SCALES[scaleType]) {
            console.error(`Invalid scale type: ${scaleType}`);
            return false;
        }

        this.currentScale = { root, scaleType };
        return true;
    }

    /**
     * Get the current scale
     * @returns {Object|null} Current scale or null
     */
    getScale() {
        return this.currentScale;
    }

    /**
     * Clear the current scale
     */
    clearScale() {
        this.currentScale = null;
    }

    /**
     * Enable/disable lock-to-scale mode
     * @param {boolean} enabled
     */
    setLockToScale(enabled) {
        this.lockToScale = enabled;
    }

    /**
     * Check if a MIDI note is in the current scale
     * @param {number} midiNote - MIDI note number (0-127)
     * @returns {boolean} True if note is in scale (or no scale set)
     */
    isNoteInScale(midiNote) {
        if (!this.currentScale) return true; // No scale = all notes allowed

        const scale = SCALES[this.currentScale.scaleType];
        const pitchClass = midiNote % 12;
        const relativePitch = (pitchClass - this.currentScale.root + 12) % 12;

        return scale.intervals.includes(relativePitch);
    }

    /**
     * Get all MIDI notes in the current scale
     * @param {number} minNote - Minimum MIDI note (default 0)
     * @param {number} maxNote - Maximum MIDI note (default 127)
     * @returns {Array<number>} Array of MIDI notes in scale
     */
    getScaleNotes(minNote = 0, maxNote = 127) {
        if (!this.currentScale) {
            // No scale = return all notes
            return Array.from({ length: maxNote - minNote + 1 }, (_, i) => minNote + i);
        }

        const scaleNotes = [];
        for (let note = minNote; note <= maxNote; note++) {
            if (this.isNoteInScale(note)) {
                scaleNotes.push(note);
            }
        }

        return scaleNotes;
    }

    /**
     * Snap a MIDI note to the nearest scale note
     * @param {number} midiNote - MIDI note number
     * @param {string} direction - 'nearest', 'up', or 'down'
     * @returns {number} Snapped MIDI note
     */
    snapToScale(midiNote, direction = 'nearest') {
        if (!this.currentScale) return midiNote; // No scale = no snapping

        // If already in scale, return as-is
        if (this.isNoteInScale(midiNote)) return midiNote;

        // Find nearest scale notes
        let searchRange = 12; // Search within an octave
        let nearestUp = null;
        let nearestDown = null;

        for (let i = 1; i <= searchRange; i++) {
            if (nearestUp === null && this.isNoteInScale(midiNote + i)) {
                nearestUp = midiNote + i;
            }
            if (nearestDown === null && this.isNoteInScale(midiNote - i)) {
                nearestDown = midiNote - i;
            }
            if (nearestUp !== null && nearestDown !== null) break;
        }

        // Apply direction preference
        if (direction === 'up') {
            return nearestUp !== null ? nearestUp : midiNote;
        } else if (direction === 'down') {
            return nearestDown !== null ? nearestDown : midiNote;
        } else { // nearest
            if (nearestUp === null && nearestDown === null) return midiNote;
            if (nearestUp === null) return nearestDown;
            if (nearestDown === null) return nearestUp;

            const distUp = nearestUp - midiNote;
            const distDown = midiNote - nearestDown;
            return distUp <= distDown ? nearestUp : nearestDown;
        }
    }

    /**
     * Get scale degree of a MIDI note (1-7, or null if not in scale)
     * @param {number} midiNote - MIDI note number
     * @returns {number|null} Scale degree (1-7) or null
     */
    getScaleDegree(midiNote) {
        if (!this.currentScale || !this.isNoteInScale(midiNote)) return null;

        const scale = SCALES[this.currentScale.scaleType];
        const pitchClass = midiNote % 12;
        const relativePitch = (pitchClass - this.currentScale.root + 12) % 12;
        const degreeIndex = scale.intervals.indexOf(relativePitch);

        return degreeIndex >= 0 ? degreeIndex + 1 : null;
    }

    /**
     * Get note name with optional flat/sharp preference
     * @param {number} midiNote - MIDI note number
     * @param {boolean} preferFlats - Use flat notation
     * @returns {string} Note name with octave (e.g., "C4", "Db3")
     */
    getNoteName(midiNote, preferFlats = false) {
        const pitchClass = midiNote % 12;
        const octave = Math.floor(midiNote / 12) - 1;
        const noteNames = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES;
        return `${noteNames[pitchClass]}${octave}`;
    }

    /**
     * Get scale info (name, color, description)
     * @returns {Object|null} Scale info or null
     */
    getScaleInfo() {
        if (!this.currentScale) return null;

        const scale = SCALES[this.currentScale.scaleType];
        const rootName = NOTE_NAMES[this.currentScale.root];

        return {
            name: `${rootName} ${scale.name}`,
            color: scale.color,
            description: scale.description,
            root: this.currentScale.root,
            scaleType: this.currentScale.scaleType,
            intervals: scale.intervals
        };
    }

    /**
     * Transpose scale to a new root
     * @param {number} semitones - Semitones to transpose (+/-)
     */
    transposeScale(semitones) {
        if (!this.currentScale) return;

        const newRoot = (this.currentScale.root + semitones + 12) % 12;
        this.currentScale.root = newRoot;
    }

    /**
     * Get all available scale types
     * @returns {Array<Object>} Array of scale type info
     */
    static getAllScales() {
        return Object.entries(SCALES).map(([key, scale]) => ({
            key,
            name: scale.name,
            description: scale.description,
            color: scale.color,
            intervalCount: scale.intervals.length
        }));
    }

    /**
     * Get all note names (roots)
     * @param {boolean} preferFlats - Use flat notation
     * @returns {Array<Object>} Array of note info
     */
    static getAllNotes(preferFlats = false) {
        const noteNames = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES;
        return noteNames.map((name, index) => ({
            value: index,
            name: name
        }));
    }
}

// Export singleton instance
let scaleSystemInstance = null;

export function getScaleSystem() {
    if (!scaleSystemInstance) {
        scaleSystemInstance = new ScaleSystem();
    }
    return scaleSystemInstance;
}

export default ScaleSystem;
