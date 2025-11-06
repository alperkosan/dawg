/**
 * Piano Roll v7 - Extended Note Types
 * 
 * Phase 1: Foundation - Extended note data model with advanced properties
 * Supports pitch bend, mod wheel, pan, aftertouch, and slide notes
 */

/**
 * Pitch bend automation point
 * @typedef {Object} PitchBendPoint
 * @property {number} time - Time offset from note start (0-1, normalized)
 * @property {number} value - Pitch bend value (-8192 to 8191, MIDI standard)
 */

/**
 * Extended note properties for advanced MIDI features
 * @typedef {Object} ExtendedNoteProperties
 * @property {PitchBendPoint[]} [pitchBend] - Per-note pitch bend automation
 * @property {number} [modWheel] - Mod wheel (CC1) value (0-127)
 * @property {number} [aftertouch] - Aftertouch/pressure value (0-127)
 * @property {number} [pan] - Stereo panning (-1 to 1, left to right)
 * @property {number} [releaseVelocity] - Note-off velocity (0-127)
 * @property {string|null} [slideTo] - Next note ID for portamento/glissando
 * @property {number} [slideDuration] - Slide duration in steps (if slideTo is set)
 */

/**
 * Base note structure (existing)
 * @typedef {Object} BaseNote
 * @property {string} id - Unique note identifier
 * @property {number} startTime - Note start time in steps
 * @property {number} pitch - MIDI pitch (0-127)
 * @property {number} length - Audio length in steps
 * @property {number} [visualLength] - Visual length in steps (for oval notes)
 * @property {number} [velocity] - Note velocity (1-127)
 * @property {boolean} [isMuted] - Ghost note flag
 * @property {string} [instrumentId] - Associated instrument ID
 */

/**
 * Extended note with all properties
 * @typedef {BaseNote & ExtendedNoteProperties} ExtendedNote
 */

/**
 * Default values for extended note properties
 */
export const DEFAULT_EXTENDED_PROPERTIES = {
    pitchBend: [],
    modWheel: null,
    aftertouch: null,
    pan: 0,
    releaseVelocity: null,
    slideTo: null,
    slideDuration: null
};

/**
 * Check if a note has extended properties
 * @param {BaseNote} note - Note to check
 * @returns {boolean} True if note has extended properties
 */
export function hasExtendedProperties(note) {
    return note.pitchBend !== undefined ||
           note.modWheel !== undefined ||
           note.aftertouch !== undefined ||
           note.pan !== undefined ||
           note.releaseVelocity !== undefined ||
           note.slideTo !== undefined;
}

/**
 * Merge extended properties with base note
 * Ensures backward compatibility with existing notes
 * @param {BaseNote} baseNote - Base note structure
 * @param {Partial<ExtendedNoteProperties>} [extendedProps] - Extended properties to merge
 * @returns {ExtendedNote} Extended note with all properties
 */
export function createExtendedNote(baseNote, extendedProps = {}) {
    return {
        ...baseNote,
        ...DEFAULT_EXTENDED_PROPERTIES,
        ...extendedProps,
        // Ensure arrays are copies
        pitchBend: extendedProps.pitchBend ? [...extendedProps.pitchBend] : []
    };
}

/**
 * Normalize note to extended format (for backward compatibility)
 * @param {BaseNote} note - Note to normalize
 * @returns {ExtendedNote} Extended note with default values for missing properties
 */
export function normalizeToExtendedNote(note) {
    if (hasExtendedProperties(note)) {
        // Already extended, just ensure all properties exist
        return createExtendedNote(note, {
            pitchBend: note.pitchBend || [],
            modWheel: note.modWheel ?? null,
            aftertouch: note.aftertouch ?? null,
            pan: note.pan ?? 0,
            releaseVelocity: note.releaseVelocity ?? null,
            slideTo: note.slideTo ?? null,
            slideDuration: note.slideDuration ?? null
        });
    }
    
    // Legacy note, add default extended properties
    return createExtendedNote(note);
}

/**
 * Validate pitch bend point
 * @param {PitchBendPoint} point - Pitch bend point to validate
 * @returns {boolean} True if valid
 */
export function validatePitchBendPoint(point) {
    if (!point || typeof point.time !== 'number' || typeof point.value !== 'number') {
        return false;
    }
    
    // Time should be normalized (0-1)
    if (point.time < 0 || point.time > 1) {
        return false;
    }
    
    // Value should be in MIDI range (-8192 to 8191)
    if (point.value < -8192 || point.value > 8191) {
        return false;
    }
    
    return true;
}

/**
 * Validate extended note properties
 * @param {ExtendedNoteProperties} props - Properties to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateExtendedProperties(props) {
    const errors = [];
    
    // Validate pitch bend array
    if (props.pitchBend && Array.isArray(props.pitchBend)) {
        props.pitchBend.forEach((point, index) => {
            if (!validatePitchBendPoint(point)) {
                errors.push(`Invalid pitch bend point at index ${index}`);
            }
        });
    }
    
    // Validate mod wheel (0-127)
    if (props.modWheel !== null && props.modWheel !== undefined) {
        if (props.modWheel < 0 || props.modWheel > 127) {
            errors.push('Mod wheel must be between 0 and 127');
        }
    }
    
    // Validate aftertouch (0-127)
    if (props.aftertouch !== null && props.aftertouch !== undefined) {
        if (props.aftertouch < 0 || props.aftertouch > 127) {
            errors.push('Aftertouch must be between 0 and 127');
        }
    }
    
    // Validate pan (-1 to 1)
    if (props.pan !== null && props.pan !== undefined) {
        if (props.pan < -1 || props.pan > 1) {
            errors.push('Pan must be between -1 and 1');
        }
    }
    
    // Validate release velocity (0-127)
    if (props.releaseVelocity !== null && props.releaseVelocity !== undefined) {
        if (props.releaseVelocity < 0 || props.releaseVelocity > 127) {
            errors.push('Release velocity must be between 0 and 127');
        }
    }
    
    // Validate slide duration (positive number)
    if (props.slideDuration !== null && props.slideDuration !== undefined) {
        if (props.slideDuration < 0) {
            errors.push('Slide duration must be positive');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

