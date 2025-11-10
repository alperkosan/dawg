/**
 * Chord Detector
 * Phase 5: Musical Intelligence - Chord Detection & Suggestions
 *
 * Analyzes selected notes to detect chords and suggest musical progressions
 */

import { SCALES, NOTE_NAMES } from './ScaleSystem';

// Chord type definitions: intervals from root in semitones
export const CHORD_TYPES = {
    major: {
        name: 'Major',
        symbol: '',
        intervals: [0, 4, 7],
        description: 'Happy, stable',
        color: '#3b82f6'
    },
    minor: {
        name: 'Minor',
        symbol: 'm',
        intervals: [0, 3, 7],
        description: 'Sad, emotional',
        color: '#8b5cf6'
    },
    diminished: {
        name: 'Diminished',
        symbol: 'dim',
        intervals: [0, 3, 6],
        description: 'Tense, unstable',
        color: '#ef4444'
    },
    augmented: {
        name: 'Augmented',
        symbol: 'aug',
        intervals: [0, 4, 8],
        description: 'Dreamy, suspended',
        color: '#f59e0b'
    },
    major7: {
        name: 'Major 7th',
        symbol: 'maj7',
        intervals: [0, 4, 7, 11],
        description: 'Jazzy, sophisticated',
        color: '#06b6d4'
    },
    minor7: {
        name: 'Minor 7th',
        symbol: 'm7',
        intervals: [0, 3, 7, 10],
        description: 'Smooth, jazzy',
        color: '#a855f7'
    },
    dominant7: {
        name: 'Dominant 7th',
        symbol: '7',
        intervals: [0, 4, 7, 10],
        description: 'Blues, tension',
        color: '#f97316'
    },
    diminished7: {
        name: 'Diminished 7th',
        symbol: 'dim7',
        intervals: [0, 3, 6, 9],
        description: 'Very tense',
        color: '#dc2626'
    },
    halfDiminished7: {
        name: 'Half-Diminished 7th',
        symbol: 'm7b5',
        intervals: [0, 3, 6, 10],
        description: 'Jazz, unstable',
        color: '#991b1b'
    },
    sus2: {
        name: 'Suspended 2nd',
        symbol: 'sus2',
        intervals: [0, 2, 7],
        description: 'Open, floating',
        color: '#10b981'
    },
    sus4: {
        name: 'Suspended 4th',
        symbol: 'sus4',
        intervals: [0, 5, 7],
        description: 'Tension, anticipation',
        color: '#84cc16'
    },
    major6: {
        name: 'Major 6th',
        symbol: '6',
        intervals: [0, 4, 7, 9],
        description: 'Sweet, jazzy',
        color: '#0ea5e9'
    },
    minor6: {
        name: 'Minor 6th',
        symbol: 'm6',
        intervals: [0, 3, 7, 9],
        description: 'Dark, jazzy',
        color: '#7c3aed'
    },
    add9: {
        name: 'Add 9th',
        symbol: 'add9',
        intervals: [0, 4, 7, 14],
        description: 'Rich, colorful',
        color: '#14b8a6'
    },
    minor9: {
        name: 'Minor 9th',
        symbol: 'm9',
        intervals: [0, 3, 7, 10, 14],
        description: 'Lush, sophisticated',
        color: '#9333ea'
    },
    major9: {
        name: 'Major 9th',
        symbol: 'maj9',
        intervals: [0, 4, 7, 11, 14],
        description: 'Very jazzy',
        color: '#0284c7'
    },
    dominant9: {
        name: 'Dominant 9th',
        symbol: '9',
        intervals: [0, 4, 7, 10, 14],
        description: 'Funky, complex',
        color: '#ea580c'
    }
};

// Common chord progressions by scale type
export const CHORD_PROGRESSIONS = {
    major: [
        { name: 'I-IV-V', degrees: [1, 4, 5], description: 'Classic pop/rock' },
        { name: 'I-V-vi-IV', degrees: [1, 5, 6, 4], description: 'Popular progression' },
        { name: 'I-vi-IV-V', degrees: [1, 6, 4, 5], description: '50s progression' },
        { name: 'ii-V-I', degrees: [2, 5, 1], description: 'Jazz turnaround' },
        { name: 'I-iii-IV-V', degrees: [1, 3, 4, 5], description: 'Doo-wop' }
    ],
    minor: [
        { name: 'i-iv-v', degrees: [1, 4, 5], description: 'Minor blues' },
        { name: 'i-VI-VII', degrees: [1, 6, 7], description: 'Modal progression' },
        { name: 'i-iv-VII-VI', degrees: [1, 4, 7, 6], description: 'Descending' },
        { name: 'i-v-VI-III', degrees: [1, 5, 6, 3], description: 'Dramatic' }
    ]
};

/**
 * ChordDetector Class
 * Detects chords from note selections and suggests progressions
 */
export class ChordDetector {
    constructor() {
        this.detectedChords = [];
    }

    /**
     * Detect chord from array of MIDI notes
     * @param {Array<number>} midiNotes - Array of MIDI note numbers
     * @returns {Object|null} Detected chord or null
     */
    detectChord(midiNotes) {
        if (!midiNotes || midiNotes.length < 2) return null;

        // Convert to pitch classes (0-11)
        const pitchClasses = [...new Set(midiNotes.map(note => note % 12))].sort((a, b) => a - b);

        if (pitchClasses.length < 2) return null;

        // Try each note as potential root
        let bestMatch = null;
        let maxMatchScore = 0;

        for (const root of pitchClasses) {
            // Calculate intervals from this root
            const intervals = pitchClasses.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b);

            // Compare with known chord types
            for (const [chordKey, chordType] of Object.entries(CHORD_TYPES)) {
                const score = this.matchChordType(intervals, chordType.intervals);

                if (score > maxMatchScore) {
                    maxMatchScore = score;
                    bestMatch = {
                        root,
                        rootName: NOTE_NAMES[root],
                        chordType: chordKey,
                        chordName: `${NOTE_NAMES[root]}${chordType.symbol}`,
                        intervals,
                        matchScore: score,
                        notes: pitchClasses,
                        color: chordType.color,
                        description: chordType.description
                    };
                }
            }
        }

        // Require at least 60% match
        if (maxMatchScore >= 0.6) {
            return bestMatch;
        }

        // No match - return generic info
        return {
            root: pitchClasses[0],
            rootName: NOTE_NAMES[pitchClasses[0]],
            chordType: 'unknown',
            chordName: `${NOTE_NAMES[pitchClasses[0]]} (custom)`,
            intervals: pitchClasses.map(pc => (pc - pitchClasses[0] + 12) % 12).sort((a, b) => a - b),
            matchScore: 0,
            notes: pitchClasses,
            color: '#6b7280',
            description: 'Custom chord'
        };
    }

    /**
     * Match intervals against chord type
     * @param {Array<number>} intervals - Actual intervals
     * @param {Array<number>} chordIntervals - Expected chord intervals
     * @returns {number} Match score (0-1)
     */
    matchChordType(intervals, chordIntervals) {
        // Check if all chord intervals are present
        let matches = 0;
        for (const interval of chordIntervals) {
            if (intervals.includes(interval)) {
                matches++;
            }
        }

        // Score based on required notes present
        const requiredScore = matches / chordIntervals.length;

        // Penalty for extra notes
        const extraNotes = intervals.length - chordIntervals.length;
        const penaltyFactor = extraNotes > 0 ? 0.9 : 1.0;

        return requiredScore * penaltyFactor;
    }

    /**
     * Suggest next chords based on current chord and scale
     * @param {Object} currentChord - Current detected chord
     * @param {Object} scale - Current scale { root, scaleType }
     * @returns {Array<Object>} Suggested chords
     */
    suggestNextChords(currentChord, scale) {
        if (!currentChord || !scale) return [];

        const suggestions = [];
        const scaleType = scale.scaleType;

        // Get scale intervals
        const scaleData = SCALES[scaleType];
        if (!scaleData) return [];

        // Build chords on each scale degree
        const scaleNotes = scaleData.intervals.map(interval => (scale.root + interval) % 12);

        // Try common progressions
        const progressions = CHORD_PROGRESSIONS[scaleType === 'major' ? 'major' : 'minor'] || [];

        // Find current chord's scale degree
        const currentDegree = this.getScaleDegree(currentChord.root, scale);

        if (currentDegree) {
            progressions.forEach(prog => {
                const currentIndex = prog.degrees.indexOf(currentDegree);
                if (currentIndex >= 0 && currentIndex < prog.degrees.length - 1) {
                    // Suggest next chord in progression
                    const nextDegree = prog.degrees[currentIndex + 1];
                    const nextRoot = scaleNotes[nextDegree - 1];

                    // Build chord on that degree
                    const chord = this.buildDiatonicChord(nextRoot, nextDegree, scaleType);
                    if (chord) {
                        suggestions.push({
                            ...chord,
                            reason: `${prog.name} progression`,
                            confidence: 0.9
                        });
                    }
                }
            });
        }

        // Add common resolutions
        if (currentChord.chordType === 'dominant7') {
            // V7 -> I resolution
            const tonicRoot = scale.root;
            suggestions.push({
                root: tonicRoot,
                rootName: NOTE_NAMES[tonicRoot],
                chordType: 'major',
                chordName: `${NOTE_NAMES[tonicRoot]}`,
                reason: 'Dominant resolution',
                confidence: 1.0,
                color: CHORD_TYPES.major.color
            });
        }

        // Remove duplicates
        const uniqueSuggestions = [];
        const seen = new Set();

        for (const suggestion of suggestions) {
            const key = `${suggestion.root}_${suggestion.chordType}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueSuggestions.push(suggestion);
            }
        }

        return uniqueSuggestions.slice(0, 5); // Top 5 suggestions
    }

    /**
     * Get scale degree of a note
     * @param {number} note - Pitch class (0-11)
     * @param {Object} scale - Scale object
     * @returns {number|null} Scale degree (1-7)
     */
    getScaleDegree(note, scale) {
        if (!scale) return null;

        const scaleData = SCALES[scale.scaleType];
        if (!scaleData) return null;

        const relativePitch = (note - scale.root + 12) % 12;
        const degreeIndex = scaleData.intervals.indexOf(relativePitch);

        return degreeIndex >= 0 ? degreeIndex + 1 : null;
    }

    /**
     * Build diatonic chord on scale degree
     * @param {number} root - Root note (0-11)
     * @param {number} degree - Scale degree (1-7)
     * @param {string} scaleType - Scale type
     * @returns {Object|null} Chord object
     */
    buildDiatonicChord(root, degree, scaleType) {
        // Diatonic chord qualities by scale degree
        const qualities = {
            major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'],
            minor: ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major']
        };

        const qualityMap = qualities[scaleType === 'major' ? 'major' : 'minor'];
        if (!qualityMap || degree < 1 || degree > 7) return null;

        const chordType = qualityMap[degree - 1];
        const chordData = CHORD_TYPES[chordType];

        if (!chordData) return null;

        return {
            root,
            rootName: NOTE_NAMES[root],
            chordType,
            chordName: `${NOTE_NAMES[root]}${chordData.symbol}`,
            intervals: chordData.intervals,
            color: chordData.color,
            description: chordData.description,
            degree
        };
    }

    /**
     * Get chord notes as MIDI numbers
     * @param {Object} chord - Chord object
     * @param {number} octave - Base octave (default 4)
     * @returns {Array<number>} MIDI note numbers
     */
    getChordNotes(chord, octave = 4) {
        if (!chord || !CHORD_TYPES[chord.chordType]) return [];

        const baseNote = chord.root + (octave + 1) * 12;
        const intervals = CHORD_TYPES[chord.chordType].intervals;

        return intervals.map(interval => baseNote + interval);
    }

    /**
     * Detect chord progression from array of chords
     * @param {Array<Object>} chords - Array of detected chords
     * @param {Object} scale - Current scale
     * @returns {Object|null} Detected progression
     */
    detectProgression(chords, scale) {
        if (!chords || chords.length < 2 || !scale) return null;

        // Get scale degrees for each chord
        const degrees = chords.map(chord => this.getScaleDegree(chord.root, scale)).filter(d => d !== null);

        if (degrees.length < 2) return null;

        // Match against known progressions
        const scaleType = scale.scaleType === 'major' ? 'major' : 'minor';
        const progressions = CHORD_PROGRESSIONS[scaleType] || [];

        for (const prog of progressions) {
            if (this.matchProgression(degrees, prog.degrees)) {
                return {
                    name: prog.name,
                    description: prog.description,
                    degrees: prog.degrees,
                    matchedDegrees: degrees
                };
            }
        }

        return {
            name: 'Custom',
            description: 'Custom chord progression',
            degrees: degrees,
            matchedDegrees: degrees
        };
    }

    /**
     * Match degree sequence against progression
     * @param {Array<number>} degrees - Actual degrees
     * @param {Array<number>} progDegrees - Expected progression degrees
     * @returns {boolean} True if match
     */
    matchProgression(degrees, progDegrees) {
        if (degrees.length !== progDegrees.length) return false;

        for (let i = 0; i < degrees.length; i++) {
            if (degrees[i] !== progDegrees[i]) return false;
        }

        return true;
    }

    /**
     * Get all available chord types
     * @returns {Array<Object>} Chord type info
     */
    static getAllChordTypes() {
        return Object.entries(CHORD_TYPES).map(([key, chord]) => ({
            key,
            name: chord.name,
            symbol: chord.symbol,
            description: chord.description,
            color: chord.color,
            intervalCount: chord.intervals.length
        }));
    }
}

// Export singleton instance
let chordDetectorInstance = null;

export function getChordDetector() {
    if (!chordDetectorInstance) {
        chordDetectorInstance = new ChordDetector();
    }
    return chordDetectorInstance;
}

export default ChordDetector;
