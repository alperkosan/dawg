/**
 * Piano Roll v7 - MIDI CC Data Structure
 * 
 * Phase 1: Foundation - MIDI CC (Control Change) data management
 * Supports CC1-127, Pitch Bend, and Aftertouch
 */

/**
 * MIDI CC Event
 * @typedef {Object} CCEvent
 * @property {number} time - Time in steps
 * @property {number} value - CC value (0-127, or -8192 to 8191 for pitch bend)
 */

/**
 * CC Data class for managing MIDI Control Change data
 */
import { AutomationInterpolation } from '../../../lib/core/utils/AutomationInterpolation.js'; // ✅ NEW: Advanced interpolation

export class CCData {
    /**
     * @param {number} ccNumber - CC number (1-127, or special: 'pitchBend', 'aftertouch')
     * @param {CCEvent[]} [events=[]] - Initial CC events
     */
    constructor(ccNumber, events = []) {
        this.ccNumber = ccNumber;
        this.events = [...events]; // Copy array
        this._validateEvents();
    }

    /**
     * Validate CC number
     * @param {number|string} ccNumber - CC number to validate
     * @returns {boolean} True if valid
     */
    static isValidCCNumber(ccNumber) {
        if (typeof ccNumber === 'string') {
            return ccNumber === 'pitchBend' || ccNumber === 'aftertouch';
        }
        return Number.isInteger(ccNumber) && ccNumber >= 1 && ccNumber <= 127;
    }

    /**
     * Get value range for CC type
     * @param {number|string} ccNumber - CC number
     * @returns {{min: number, max: number}} Value range
     */
    static getValueRange(ccNumber) {
        if (ccNumber === 'pitchBend') {
            return { min: -8192, max: 8191 };
        }
        return { min: 0, max: 127 };
    }

    /**
     * Validate events array
     * @private
     */
    _validateEvents() {
        if (!Array.isArray(this.events)) {
            throw new Error('CC events must be an array');
        }

        const { min, max } = CCData.getValueRange(this.ccNumber);

        this.events.forEach((event, index) => {
            if (!event || typeof event.time !== 'number' || typeof event.value !== 'number') {
                throw new Error(`Invalid CC event at index ${index}`);
            }

            if (event.time < 0) {
                throw new Error(`CC event time must be non-negative at index ${index}`);
            }

            if (event.value < min || event.value > max) {
                throw new Error(
                    `CC event value out of range at index ${index}: ` +
                    `expected ${min}-${max}, got ${event.value}`
                );
            }
        });

        // Sort events by time
        this.events.sort((a, b) => a.time - b.time);
    }

    /**
     * Add a CC event
     * @param {number} time - Time in steps
     * @param {number} value - CC value
     * @returns {CCEvent} Added event
     */
    addEvent(time, value) {
        const { min, max } = CCData.getValueRange(this.ccNumber);

        if (value < min || value > max) {
            throw new Error(`CC value out of range: expected ${min}-${max}, got ${value}`);
        }

        const event = { time, value };
        this.events.push(event);
        this._validateEvents();
        return event;
    }

    /**
     * Remove event at index
     * @param {number} index - Event index
     * @returns {boolean} True if removed
     */
    removeEvent(index) {
        if (index >= 0 && index < this.events.length) {
            this.events.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Update event at index
     * @param {number} index - Event index
     * @param {Partial<CCEvent>} updates - Updates to apply
     * @returns {boolean} True if updated
     */
    updateEvent(index, updates) {
        if (index >= 0 && index < this.events.length) {
            const event = { ...this.events[index], ...updates };
            
            // Validate updated event
            const { min, max } = CCData.getValueRange(this.ccNumber);
            if (event.value < min || event.value > max) {
                throw new Error(`CC value out of range: expected ${min}-${max}, got ${event.value}`);
            }

            this.events[index] = event;
            this._validateEvents();
            return true;
        }
        return false;
    }

    /**
     * Get value at specific time (interpolated)
     * @param {number} time - Time in steps
     * @param {string} [interpolation='linear'] - Interpolation method: 'linear', 'exponential', 'logarithmic', 'bezier', 'cubic', 'step', 'easeInOut', 'easeIn', 'easeOut'
     * @param {Object} [options={}] - Interpolation options (exponent, base, control1, control2, etc.)
     * @returns {number|null} Interpolated value or null if no events
     */
    getValueAtTime(time, interpolation = 'linear', options = {}) {
        if (this.events.length === 0) {
            return null;
        }

        // Find surrounding events
        let beforeIndex = -1;
        let afterIndex = -1;

        for (let i = 0; i < this.events.length; i++) {
            if (this.events[i].time <= time) {
                beforeIndex = i;
            }
            if (this.events[i].time >= time && afterIndex === -1) {
                afterIndex = i;
                break;
            }
        }

        // Exact match
        if (beforeIndex !== -1 && this.events[beforeIndex].time === time) {
            return this.events[beforeIndex].value;
        }

        // Before all events - return null (no automation yet)
        if (beforeIndex === -1) {
            return null;
        }

        // After all events - return null (automation ended, return to default)
        if (afterIndex === -1) {
            return null;
        }

        // Get interpolation method from event or use default
        const before = this.events[beforeIndex];
        const after = this.events[afterIndex];
        const effectiveInterpolation = before.interpolation || after.interpolation || interpolation;

        // Step interpolation (no interpolation)
        if (effectiveInterpolation === 'none' || effectiveInterpolation === 'step') {
            return before.value;
        }

        // Calculate progress ratio (0-1)
        const timeRange = after.time - before.time;
        if (timeRange <= 0) {
            return before.value;
        }
        const t = (time - before.time) / timeRange;

        // ✅ NEW: Use advanced interpolation methods
        const { min, max } = CCData.getValueRange(this.ccNumber);
        
        // Interpolate using advanced methods
        const interpolated = AutomationInterpolation.interpolate(
            before.value,
            after.value,
            t,
            effectiveInterpolation,
            options
        );
        
        // Clamp to valid range and round for MIDI values
        return Math.max(min, Math.min(max, Math.round(interpolated)));
    }

    /**
     * Get all events
     * @returns {CCEvent[]} Copy of events array
     */
    getEvents() {
        return [...this.events];
    }

    /**
     * Clear all events
     */
    clear() {
        this.events = [];
    }

    /**
     * Clone CC data
     * @returns {CCData} New CCData instance
     */
    clone() {
        return new CCData(this.ccNumber, this.events);
    }

    /**
     * Convert to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            ccNumber: this.ccNumber,
            events: this.events
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON representation
     * @returns {CCData} New CCData instance
     */
    static fromJSON(json) {
        return new CCData(json.ccNumber, json.events || []);
    }
}

