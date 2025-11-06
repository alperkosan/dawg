/**
 * Piano Roll v7 - Note Migration Utilities
 * 
 * Phase 1: Foundation - Backward compatibility and migration
 * Handles migration from old note format to extended note format
 */

import { normalizeToExtendedNote, createExtendedNote } from '../types/NoteTypes.js';

/**
 * Migrate a single note to extended format
 * @param {Object} legacyNote - Legacy note format
 * @returns {Object} Extended note format
 */
export function migrateNoteToExtended(legacyNote) {
    // Already in extended format
    if (legacyNote.pitchBend !== undefined ||
        legacyNote.modWheel !== undefined ||
        legacyNote.aftertouch !== undefined ||
        legacyNote.pan !== undefined ||
        legacyNote.releaseVelocity !== undefined ||
        legacyNote.slideTo !== undefined) {
        return normalizeToExtendedNote(legacyNote);
    }

    // Legacy format - convert to extended
    return normalizeToExtendedNote({
        id: legacyNote.id,
        startTime: legacyNote.time || legacyNote.startTime || 0,
        pitch: legacyNote.pitch,
        length: legacyNote.length || (legacyNote.duration ? parseDuration(legacyNote.duration) : 1),
        visualLength: legacyNote.visualLength,
        velocity: legacyNote.velocity || 100,
        isMuted: legacyNote.isMuted || false,
        instrumentId: legacyNote.instrumentId
    });
}

/**
 * Migrate array of notes to extended format
 * @param {Object[]} legacyNotes - Array of legacy notes
 * @returns {Object[]} Array of extended notes
 */
export function migrateNotesToExtended(legacyNotes) {
    if (!Array.isArray(legacyNotes)) {
        console.warn('migrateNotesToExtended: Input is not an array', legacyNotes);
        return [];
    }

    return legacyNotes.map(note => migrateNoteToExtended(note));
}

/**
 * Convert extended note back to legacy format (for backward compatibility)
 * @param {Object} extendedNote - Extended note
 * @returns {Object} Legacy note format
 */
export function convertExtendedToLegacy(extendedNote) {
    return {
        id: extendedNote.id,
        time: extendedNote.startTime,
        pitch: extendedNote.pitch,
        length: extendedNote.length,
        visualLength: extendedNote.visualLength,
        velocity: extendedNote.velocity || 100,
        isMuted: extendedNote.isMuted || false,
        instrumentId: extendedNote.instrumentId,
        // Legacy format doesn't include extended properties
        // They will be lost in conversion
    };
}

/**
 * Parse duration string to length (for backward compatibility)
 * @param {string} duration - Duration string (e.g., '4n', '8n')
 * @returns {number} Length in steps
 */
function parseDuration(duration) {
    const durationMap = {
        '1n': 16,  // Whole note
        '2n': 8,   // Half note
        '4n': 4,   // Quarter note
        '8n': 2,   // Eighth note
        '16n': 1,  // Sixteenth note
        '32n': 0.5 // Thirty-second note
    };
    return durationMap[duration] || 1;
}

/**
 * Check if note needs migration
 * @param {Object} note - Note to check
 * @returns {boolean} True if note needs migration
 */
export function needsMigration(note) {
    if (!note) return false;
    
    // Check if it's already in extended format
    if (note.pitchBend !== undefined ||
        note.modWheel !== undefined ||
        note.aftertouch !== undefined ||
        note.pan !== undefined ||
        note.releaseVelocity !== undefined ||
        note.slideTo !== undefined) {
        return false; // Already migrated
    }

    // Check if it's using old format (time instead of startTime)
    if (note.time !== undefined && note.startTime === undefined) {
        return true; // Needs migration
    }

    return false;
}

/**
 * Batch migrate notes in a pattern
 * @param {Object} pattern - Pattern object
 * @param {string} instrumentId - Instrument ID
 * @returns {Object} Updated pattern
 */
export function migratePatternNotes(pattern, instrumentId) {
    if (!pattern || !pattern.data || !pattern.data[instrumentId]) {
        return pattern;
    }

    const notes = pattern.data[instrumentId];
    const migratedNotes = migrateNotesToExtended(notes);

    return {
        ...pattern,
        data: {
            ...pattern.data,
            [instrumentId]: migratedNotes
        }
    };
}

