/**
 * Latency Compensator - Automatic Delay Compensation (ADC)
 * 
 * Compensates for plugin latency to ensure all tracks play in sync.
 * Industry Standard: All professional DAWs use ADC (Ableton Live, Logic Pro, Pro Tools, FL Studio)
 * 
 * How it works:
 * 1. Track latency for each plugin/effect
 * 2. Find maximum latency in signal path
 * 3. Delay all other tracks to match maximum latency
 * 4. Adjust scheduling times accordingly
 * 
 * Benefits:
 * - All tracks play in perfect sync
 * - No timing issues with effects
 * - Professional-quality playback
 */

export class LatencyCompensator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // Track latency for each insert/effect
        this.insertLatencies = new Map(); // insertId → latency in samples
        this.effectLatencies = new Map(); // effectId → latency in samples
        
        // Maximum latency across all inserts (used for compensation)
        this.maxLatency = 0; // in samples
        
        // Compensation delays (for tracks with less latency)
        this.compensationDelays = new Map(); // insertId → delay node
    }

    /**
     * Register latency for an effect
     * 
     * @param {string} effectId - Effect ID
     * @param {number} latencySamples - Latency in samples
     */
    registerEffectLatency(effectId, latencySamples) {
        if (latencySamples > 0) {
            this.effectLatencies.set(effectId, latencySamples);
            this._updateMaxLatency();
            
            if (import.meta.env.DEV) {
                const latencyMs = (latencySamples / this.audioContext.sampleRate) * 1000;
                console.log(`📊 LatencyCompensator: Registered ${latencyMs.toFixed(2)}ms latency for effect ${effectId}`);
            }
        }
    }

    /**
     * Register latency for an insert (sum of all effects in chain)
     * 
     * @param {string} insertId - Insert ID
     * @param {number} latencySamples - Total latency in samples
     */
    registerInsertLatency(insertId, latencySamples) {
        if (latencySamples > 0) {
            this.insertLatencies.set(insertId, latencySamples);
            this._updateMaxLatency();
            
            if (import.meta.env.DEV) {
                const latencyMs = (latencySamples / this.audioContext.sampleRate) * 1000;
                console.log(`📊 LatencyCompensator: Registered ${latencyMs.toFixed(2)}ms latency for insert ${insertId}`);
            }
        }
    }

    /**
     * Calculate total latency for an insert based on its effects
     * 
     * @param {Array<string>} effectIds - Array of effect IDs in the insert
     * @returns {number} Total latency in samples
     */
    calculateInsertLatency(effectIds) {
        let totalLatency = 0;
        
        effectIds.forEach(effectId => {
            const effectLatency = this.effectLatencies.get(effectId) || 0;
            totalLatency += effectLatency;
        });
        
        return totalLatency;
    }

    /**
     * Update maximum latency across all inserts
     */
    _updateMaxLatency() {
        let max = 0;
        
        // Find maximum insert latency
        this.insertLatencies.forEach(latency => {
            max = Math.max(max, latency);
        });
        
        this.maxLatency = max;
        
        if (import.meta.env.DEV && max > 0) {
            const maxLatencyMs = (max / this.audioContext.sampleRate) * 1000;
            console.log(`📊 LatencyCompensator: Max latency updated to ${maxLatencyMs.toFixed(2)}ms (${max} samples)`);
        }
    }

    /**
     * Get compensation delay for an insert
     * Inserts with less latency need to be delayed to match max latency
     * 
     * @param {string} insertId - Insert ID
     * @returns {number} Compensation delay in samples
     */
    getCompensationDelay(insertId) {
        const insertLatency = this.insertLatencies.get(insertId) || 0;
        return Math.max(0, this.maxLatency - insertLatency);
    }

    /**
     * Get compensation delay in seconds
     * 
     * @param {string} insertId - Insert ID
     * @returns {number} Compensation delay in seconds
     */
    getCompensationDelaySeconds(insertId) {
        const delaySamples = this.getCompensationDelay(insertId);
        return delaySamples / this.audioContext.sampleRate;
    }

    /**
     * Compensate scheduled time for latency
     * Events scheduled for tracks with latency need to be scheduled earlier
     * 
     * @param {string} insertId - Insert ID (optional, for track-specific compensation)
     * @param {number} scheduledTime - Original scheduled time in seconds
     * @returns {number} Compensated time in seconds
     */
    compensateTime(scheduledTime, insertId = null) {
        if (this.maxLatency === 0) {
            return scheduledTime; // No latency, no compensation needed
        }

        // If insertId is provided, use insert-specific latency
        // Otherwise, use maximum latency (worst case)
        const latencyToCompensate = insertId
            ? (this.insertLatencies.get(insertId) || 0)
            : this.maxLatency;

        if (latencyToCompensate === 0) {
            return scheduledTime; // No latency for this insert
        }

        // Schedule earlier by latency amount
        const latencySeconds = latencyToCompensate / this.audioContext.sampleRate;
        return scheduledTime - latencySeconds;
    }

    /**
     * Remove latency registration for an effect
     * 
     * @param {string} effectId - Effect ID
     */
    unregisterEffectLatency(effectId) {
        this.effectLatencies.delete(effectId);
        this._updateMaxLatency();
    }

    /**
     * Remove latency registration for an insert
     * 
     * @param {string} insertId - Insert ID
     */
    unregisterInsertLatency(insertId) {
        this.insertLatencies.delete(insertId);
        this.compensationDelays.delete(insertId);
        this._updateMaxLatency();
    }

    /**
     * Get maximum latency in samples
     * 
     * @returns {number} Maximum latency in samples
     */
    getMaxLatency() {
        return this.maxLatency;
    }

    /**
     * Get maximum latency in seconds
     * 
     * @returns {number} Maximum latency in seconds
     */
    getMaxLatencySeconds() {
        return this.maxLatency / this.audioContext.sampleRate;
    }

    /**
     * Get maximum latency in milliseconds
     * 
     * @returns {number} Maximum latency in milliseconds
     */
    getMaxLatencyMs() {
        return (this.maxLatency / this.audioContext.sampleRate) * 1000;
    }

    /**
     * Get statistics
     * 
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            maxLatency: this.maxLatency,
            maxLatencyMs: this.getMaxLatencyMs(),
            insertCount: this.insertLatencies.size,
            effectCount: this.effectLatencies.size,
            insertLatencies: Array.from(this.insertLatencies.entries()).map(([id, latency]) => ({
                insertId: id,
                latencySamples: latency,
                latencyMs: (latency / this.audioContext.sampleRate) * 1000
            })),
            effectLatencies: Array.from(this.effectLatencies.entries()).map(([id, latency]) => ({
                effectId: id,
                latencySamples: latency,
                latencyMs: (latency / this.audioContext.sampleRate) * 1000
            }))
        };
    }

    /**
     * Reset all latency tracking
     */
    reset() {
        this.insertLatencies.clear();
        this.effectLatencies.clear();
        this.compensationDelays.clear();
        this.maxLatency = 0;
    }
}

