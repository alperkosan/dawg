/**
 * Piano Roll v7 - Automation Lane
 * 
 * Phase 1: Foundation - Automation lane abstraction
 * Manages CC lanes, pitch bend, and aftertouch automation
 */

import { CCData } from './CCData.js';

/**
 * Automation Lane class
 * Manages a single automation lane (CC, pitch bend, or aftertouch)
 */
export class AutomationLane {
    /**
     * @param {number|string} ccNumber - CC number (1-127) or 'pitchBend' or 'aftertouch'
     * @param {string} [name] - Display name (auto-generated if not provided)
     * @param {CCData} [ccData] - Initial CC data
     */
    constructor(ccNumber, name = null, ccData = null) {
        if (!CCData.isValidCCNumber(ccNumber)) {
            throw new Error(`Invalid CC number: ${ccNumber}`);
        }

        this.ccNumber = ccNumber;
        this.name = name || AutomationLane.getDefaultName(ccNumber);
        this.ccData = ccData || new CCData(ccNumber);
        this.visible = true;
        this.height = 60; // Default lane height in pixels
        this.color = AutomationLane.getDefaultColor(ccNumber);
    }

    /**
     * Get default name for CC number
     * @param {number|string} ccNumber - CC number
     * @returns {string} Default name
     */
    static getDefaultName(ccNumber) {
        if (ccNumber === 'pitchBend') {
            return 'Pitch Bend';
        }
        if (ccNumber === 'aftertouch') {
            return 'Aftertouch';
        }

        // Common CC names
        const commonCCNames = {
            1: 'Mod Wheel',
            7: 'Volume',
            10: 'Pan',
            11: 'Expression',
            64: 'Sustain Pedal',
            91: 'Reverb',
            93: 'Chorus'
        };

        return commonCCNames[ccNumber] || `CC${ccNumber}`;
    }

    /**
     * Get value range for CC type
     * @param {number|string} ccNumber - CC number
     * @returns {{min: number, max: number}} Value range
     */
    static getValueRange(ccNumber) {
        return CCData.getValueRange(ccNumber);
    }

    /**
     * Get default color for CC number
     * @param {number|string} ccNumber - CC number
     * @returns {string} Color hex code
     */
    static getDefaultColor(ccNumber) {
        if (ccNumber === 'pitchBend') {
            return '#4A90E2'; // Blue
        }
        if (ccNumber === 'aftertouch') {
            return '#E24A4A'; // Red
        }

        // Color palette for common CCs
        const colorMap = {
            1: '#50C878', // Mod Wheel - Green
            7: '#FFD700', // Volume - Gold
            10: '#FF6B6B', // Pan - Coral
            11: '#9B59B6', // Expression - Purple
            64: '#3498DB', // Sustain - Blue
            91: '#E67E22', // Reverb - Orange
            93: '#1ABC9C' // Chorus - Teal
        };

        return colorMap[ccNumber] || '#95A5A6'; // Default gray
    }

    /**
     * Add automation point
     * @param {number} time - Time in steps
     * @param {number} value - Value
     * @returns {Object} Added event
     */
    addPoint(time, value) {
        return this.ccData.addEvent(time, value);
    }

    /**
     * Remove automation point
     * @param {number} index - Point index
     * @returns {boolean} True if removed
     */
    removePoint(index) {
        return this.ccData.removeEvent(index);
    }

    /**
     * Update automation point
     * @param {number} index - Point index
     * @param {Partial<Object>} updates - Updates
     * @returns {boolean} True if updated
     */
    updatePoint(index, updates) {
        return this.ccData.updateEvent(index, updates);
    }

    /**
     * Get value at time (interpolated)
     * @param {number} time - Time in steps
     * @param {string} [interpolation='linear'] - Interpolation method
     * @returns {number|null} Value or null
     */
    getValueAtTime(time, interpolation = 'linear') {
        return this.ccData.getValueAtTime(time, interpolation);
    }

    /**
     * Get all points
     * @returns {Array} Points array
     */
    getPoints() {
        return this.ccData.getEvents();
    }

    /**
     * Clear all points
     */
    clear() {
        this.ccData.clear();
    }

    /**
     * Set visibility
     * @param {boolean} visible - Visibility state
     */
    setVisible(visible) {
        this.visible = visible;
    }

    /**
     * Set lane height
     * @param {number} height - Height in pixels
     */
    setHeight(height) {
        this.height = Math.max(20, Math.min(200, height)); // Clamp 20-200px
    }

    /**
     * Clone lane
     * @returns {AutomationLane} New lane instance
     */
    clone() {
        const lane = new AutomationLane(this.ccNumber, this.name, this.ccData.clone());
        lane.visible = this.visible;
        lane.height = this.height;
        lane.color = this.color;
        return lane;
    }

    /**
     * Convert to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            ccNumber: this.ccNumber,
            name: this.name,
            ccData: this.ccData.toJSON(),
            visible: this.visible,
            height: this.height,
            color: this.color
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON representation
     * @returns {AutomationLane} New lane instance
     */
    static fromJSON(json) {
        const lane = new AutomationLane(
            json.ccNumber,
            json.name,
            CCData.fromJSON(json.ccData)
        );
        lane.visible = json.visible !== undefined ? json.visible : true;
        lane.height = json.height || 60;
        lane.color = json.color || AutomationLane.getDefaultColor(json.ccNumber);
        return lane;
    }
}

