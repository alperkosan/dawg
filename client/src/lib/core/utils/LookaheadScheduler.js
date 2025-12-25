/**
 * Advanced Lookahead Scheduler
 * 
 * Provides adaptive lookahead scheduling based on BPM, complexity, and system load.
 * Industry Standard: FL Studio (50-100ms), Ableton Live (100-200ms), Logic Pro (100ms+)
 * 
 * Features:
 * - Adaptive lookahead based on BPM
 * - Complexity-based adjustment
 * - CPU load monitoring
 * - Priority queue for events
 */

export class LookaheadScheduler {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Base lookahead settings
        this.baseLookahead = options.baseLookahead || 0.1; // 100ms base
        this.minLookahead = options.minLookahead || 0.05; // 50ms minimum
        this.maxLookahead = options.maxLookahead || 0.2; // 200ms maximum
        
        // Adaptive factors
        this.bpmFactor = 1.0;
        this.complexityFactor = 1.0;
        this.cpuLoadFactor = 1.0;
        
        // Current lookahead (calculated)
        this.currentLookahead = this.baseLookahead;
        
        // Complexity tracking
        this.eventCount = 0;
        this.maxEventCount = 0;
        this.complexityHistory = []; // Sliding window of complexity measurements
        this.complexityHistorySize = 10; // Track last 10 measurements
        
        // CPU load tracking
        this.cpuLoadHistory = [];
        this.cpuLoadHistorySize = 5;
        this.currentCpuLoad = 0;
    }

    /**
     * Calculate adaptive lookahead based on BPM
     * Higher BPM = shorter lookahead (events come faster)
     * Lower BPM = longer lookahead (more time to prepare)
     * 
     * @param {number} bpm - Current BPM
     * @returns {number} BPM factor (0.8 - 1.5)
     */
    calculateBPMFactor(bpm) {
        if (bpm >= 160) {
            // Very high BPM: shorter lookahead (events come very fast)
            return 0.8;
        } else if (bpm >= 140) {
            // High BPM: slightly shorter lookahead
            return 0.9;
        } else if (bpm >= 100) {
            // Medium BPM: standard lookahead
            return 1.0;
        } else if (bpm >= 80) {
            // Low-medium BPM: slightly longer lookahead
            return 1.2;
        } else {
            // Very low BPM: longer lookahead (more time to prepare)
            return 1.5;
        }
    }

    /**
     * Calculate complexity factor based on event count
     * More events = longer lookahead (need more time to process)
     * 
     * @param {number} eventCount - Current event count
     * @param {number} maxEventCount - Maximum event count seen
     * @returns {number} Complexity factor (0.9 - 1.5)
     */
    calculateComplexityFactor(eventCount, maxEventCount) {
        if (maxEventCount === 0) {
            return 1.0; // No events, standard complexity
        }

        const complexityRatio = eventCount / Math.max(maxEventCount, 1);
        
        if (complexityRatio > 0.8) {
            // Very complex: need more lookahead
            return 1.5;
        } else if (complexityRatio > 0.6) {
            // High complexity
            return 1.3;
        } else if (complexityRatio > 0.4) {
            // Medium complexity
            return 1.1;
        } else if (complexityRatio > 0.2) {
            // Low complexity
            return 1.0;
        } else {
            // Very low complexity: can use shorter lookahead
            return 0.9;
        }
    }

    /**
     * Calculate CPU load factor
     * High CPU = longer lookahead (need more buffer time)
     * Low CPU = can use shorter lookahead
     * 
     * @param {number} cpuLoad - Current CPU load (0-100)
     * @returns {number} CPU factor (0.9 - 1.4)
     */
    calculateCPULoadFactor(cpuLoad) {
        if (cpuLoad >= 80) {
            // Very high CPU: need much more lookahead
            return 1.4;
        } else if (cpuLoad >= 60) {
            // High CPU: need more lookahead
            return 1.2;
        } else if (cpuLoad >= 40) {
            // Medium CPU: standard
            return 1.0;
        } else if (cpuLoad >= 20) {
            // Low CPU: can use shorter lookahead
            return 0.95;
        } else {
            // Very low CPU: can use shorter lookahead
            return 0.9;
        }
    }

    /**
     * Update lookahead based on current conditions
     * 
     * @param {number} bpm - Current BPM
     * @param {number} eventCount - Current event count
     * @param {number} cpuLoad - Current CPU load (0-100, optional)
     */
    updateLookahead(bpm, eventCount, cpuLoad = null) {
        // Update BPM factor
        this.bpmFactor = this.calculateBPMFactor(bpm);
        
        // Update complexity tracking
        this.eventCount = eventCount;
        this.maxEventCount = Math.max(this.maxEventCount, eventCount);
        
        // Add to complexity history
        this.complexityHistory.push(eventCount);
        if (this.complexityHistory.length > this.complexityHistorySize) {
            this.complexityHistory.shift();
        }
        
        // Calculate average complexity
        const avgComplexity = this.complexityHistory.length > 0
            ? this.complexityHistory.reduce((a, b) => a + b, 0) / this.complexityHistory.length
            : eventCount;
        
        // Update complexity factor
        this.complexityFactor = this.calculateComplexityFactor(avgComplexity, this.maxEventCount);
        
        // Update CPU load if provided
        if (cpuLoad !== null) {
            this.currentCpuLoad = cpuLoad;
            this.cpuLoadHistory.push(cpuLoad);
            if (this.cpuLoadHistory.length > this.cpuLoadHistorySize) {
                this.cpuLoadHistory.shift();
            }
            
            // Calculate average CPU load
            const avgCpuLoad = this.cpuLoadHistory.length > 0
                ? this.cpuLoadHistory.reduce((a, b) => a + b, 0) / this.cpuLoadHistory.length
                : cpuLoad;
            
            // Update CPU factor
            this.cpuLoadFactor = this.calculateCPULoadFactor(avgCpuLoad);
        }
        
        // Calculate new lookahead
        const calculatedLookahead = this.baseLookahead 
            * this.bpmFactor 
            * this.complexityFactor 
            * this.cpuLoadFactor;
        
        // Clamp to min/max
        this.currentLookahead = Math.max(
            this.minLookahead,
            Math.min(this.maxLookahead, calculatedLookahead)
        );
        
        return this.currentLookahead;
    }

    /**
     * Get current lookahead time
     * 
     * @returns {number} Lookahead time in seconds
     */
    getLookahead() {
        return this.currentLookahead;
    }

    /**
     * Get lookahead in milliseconds
     * 
     * @returns {number} Lookahead time in milliseconds
     */
    getLookaheadMs() {
        return this.currentLookahead * 1000;
    }

    /**
     * Reset complexity tracking
     */
    resetComplexity() {
        this.eventCount = 0;
        this.maxEventCount = 0;
        this.complexityHistory = [];
    }

    /**
     * Get scheduling statistics
     * 
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            currentLookahead: this.currentLookahead,
            lookaheadMs: this.getLookaheadMs(),
            bpmFactor: this.bpmFactor,
            complexityFactor: this.complexityFactor,
            cpuLoadFactor: this.cpuLoadFactor,
            eventCount: this.eventCount,
            maxEventCount: this.maxEventCount,
            avgComplexity: this.complexityHistory.length > 0
                ? this.complexityHistory.reduce((a, b) => a + b, 0) / this.complexityHistory.length
                : 0,
            currentCpuLoad: this.currentCpuLoad
        };
    }
}

