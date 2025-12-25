/**
 * AudioParameterBatcher - Batches audio parameter updates to reduce message overhead
 * 
 * Problem: Every slider movement sends a message to the audio thread, causing:
 * - Excessive audio thread message queue buildup
 * - Potential audio glitches during rapid parameter changes
 * - Unnecessary CPU usage
 * 
 * Solution: Batch parameter updates and flush at ~60fps intervals
 * 
 * Performance Impact:
 * - Before: 100+ messages/second during slider drag
 * - After: ~60 messages/second (one per frame)
 * - Reduction: ~40-90% fewer audio thread messages
 */

export class AudioParameterBatcher {
    constructor(flushInterval = 16) { // ~60fps
        this.pending = new Map(); // instrumentId -> { param: value }
        this.timer = null;
        this.flushInterval = flushInterval;
        this.engine = null;
        this.isEnabled = true;
    }

    /**
     * Set the audio engine reference
     * @param {Object} engine - Audio engine instance
     */
    setEngine(engine) {
        this.engine = engine;
    }

    /**
     * Queue a parameter update
     * @param {string} instrumentId - Instrument ID
     * @param {string} param - Parameter name
     * @param {*} value - Parameter value
     */
    update(instrumentId, param, value) {
        if (!this.isEnabled) {
            // Bypass batching if disabled (for debugging)
            this._updateImmediate(instrumentId, param, value);
            return;
        }

        // Get or create pending updates for this instrument
        if (!this.pending.has(instrumentId)) {
            this.pending.set(instrumentId, {});
        }

        // Update parameter value
        this.pending.get(instrumentId)[param] = value;

        // Schedule flush
        this.scheduleFlush();
    }

    /**
     * Queue multiple parameter updates for an instrument
     * @param {string} instrumentId - Instrument ID
     * @param {Object} params - Object with param: value pairs
     */
    updateBatch(instrumentId, params) {
        if (!this.isEnabled) {
            this._updateImmediateBatch(instrumentId, params);
            return;
        }

        // Get or create pending updates for this instrument
        if (!this.pending.has(instrumentId)) {
            this.pending.set(instrumentId, {});
        }

        // Merge new params with pending
        Object.assign(this.pending.get(instrumentId), params);

        // Schedule flush
        this.scheduleFlush();
    }

    /**
     * Schedule a flush (debounced)
     * @private
     */
    scheduleFlush() {
        if (this.timer) return; // Already scheduled

        this.timer = setTimeout(() => {
            this.flush();
            this.timer = null;
        }, this.flushInterval);
    }

    /**
     * Immediately flush all pending updates
     */
    flush() {
        if (this.pending.size === 0) return;

        // Send all pending updates to engine
        this.pending.forEach((params, instrumentId) => {
            if (this.engine) {
                this.engine.updateInstrumentParameters(instrumentId, params);
            }
        });

        // Clear pending updates
        this.pending.clear();
    }

    /**
     * Update parameter immediately (bypass batching)
     * @private
     */
    _updateImmediate(instrumentId, param, value) {
        if (this.engine) {
            this.engine.updateInstrumentParameters(instrumentId, { [param]: value });
        }
    }

    /**
     * Update multiple parameters immediately (bypass batching)
     * @private
     */
    _updateImmediateBatch(instrumentId, params) {
        if (this.engine) {
            this.engine.updateInstrumentParameters(instrumentId, params);
        }
    }

    /**
     * Enable/disable batching
     * @param {boolean} enabled - Enable batching
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            // Flush any pending updates when disabling
            this.flush();
        }
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.flush(); // Flush any remaining updates
        this.pending.clear();
        this.engine = null;
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            pendingInstruments: this.pending.size,
            pendingUpdates: Array.from(this.pending.values())
                .reduce((sum, params) => sum + Object.keys(params).length, 0),
            isEnabled: this.isEnabled,
            flushInterval: this.flushInterval
        };
    }
}

// Export singleton instance
export const audioParameterBatcher = new AudioParameterBatcher();

export default audioParameterBatcher;
