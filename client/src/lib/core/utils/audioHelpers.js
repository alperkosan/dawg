/**
 * Audio Utilities - Shared helper functions
 * 
 * @module lib/core/utils/audioHelpers
 */

/**
 * Convert dB to linear gain
 * @param {number} db - Decibel value
 * @returns {number} Linear gain (0-1+)
 */
export function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

/**
 * Convert linear gain to dB
 * @param {number} linear - Linear gain value
 * @returns {number} Decibel value
 */
export function linearToDb(linear) {
    if (linear <= 0) return -Infinity;
    return 20 * Math.log10(linear);
}

/**
 * Clamp a value between min and max
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Convert MIDI note number to frequency
 * @param {number} note - MIDI note number (0-127)
 * @returns {number} Frequency in Hz
 */
export function midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Convert frequency to MIDI note number
 * @param {number} freq - Frequency in Hz
 * @returns {number} MIDI note number
 */
export function freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Convert BPM and step to time in seconds
 * @param {number} bpm - Beats per minute
 * @param {number} step - Step number (16th notes)
 * @returns {number} Time in seconds
 */
export function stepToTime(bpm, step) {
    const stepDuration = 60 / bpm / 4; // 16th note duration
    return step * stepDuration;
}

/**
 * Convert time to step
 * @param {number} bpm - Beats per minute
 * @param {number} time - Time in seconds
 * @returns {number} Step number
 */
export function timeToStep(bpm, time) {
    const stepDuration = 60 / bpm / 4;
    return time / stepDuration;
}

/**
 * Calculate steps per bar
 * @param {number} timeSignatureNumerator - e.g., 4 for 4/4
 * @param {number} timeSignatureDenominator - e.g., 4 for 4/4
 * @returns {number} Steps per bar
 */
export function stepsPerBar(timeSignatureNumerator = 4, timeSignatureDenominator = 4) {
    // For 4/4: 4 beats * 4 steps per beat = 16 steps
    return timeSignatureNumerator * (16 / timeSignatureDenominator);
}

/**
 * Generate unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string}
 */
export function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Throttle a function
 * @param {Function} fn - Function to throttle
 * @param {number} ms - Throttle interval in milliseconds
 * @returns {Function}
 */
export function throttle(fn, ms) {
    let lastCall = 0;
    let timeout = null;

    return function (...args) {
        const now = Date.now();
        const remaining = ms - (now - lastCall);

        if (remaining <= 0) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            lastCall = now;
            fn.apply(this, args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                lastCall = Date.now();
                timeout = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Debounce delay in milliseconds
 * @returns {Function}
 */
export function debounce(fn, ms) {
    let timeout = null;

    return function (...args) {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            timeout = null;
            fn.apply(this, args);
        }, ms);
    };
}

/**
 * Deep clone an object (JSON-safe)
 * @param {any} obj 
 * @returns {any}
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is a number
 * @param {any} value 
 * @returns {boolean}
 */
export function isNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Smooth exponential interpolation for audio parameters
 * @param {AudioParam} param - AudioParam to interpolate
 * @param {number} value - Target value
 * @param {number} time - Current audio context time
 * @param {number} duration - Interpolation duration in seconds
 */
export function smoothParam(param, value, time, duration = 0.02) {
    param.setTargetAtTime(value, time, duration / 3);
}

/**
 * Create audio context with fallback
 * @param {AudioContextOptions} options 
 * @returns {AudioContext}
 */
export function createAudioContext(options = {}) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        throw new Error('Web Audio API not supported');
    }

    return new AudioContextClass({
        latencyHint: 'interactive',
        sampleRate: 48000,
        ...options
    });
}

/**
 * Resume audio context (required for autoplay policy)
 * @param {AudioContext} context 
 * @returns {Promise<void>}
 */
export async function resumeAudioContext(context) {
    if (context.state === 'suspended') {
        await context.resume();
    }
}
