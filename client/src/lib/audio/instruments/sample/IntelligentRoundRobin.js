/**
 * Intelligent Round-Robin System
 * Smart variation selection based on timing and velocity
 * Prevents mechanical sound on repeated notes
 */

export class IntelligentRoundRobin {
    constructor() {
        // Timing tracking
        this.lastPlayedTime = new Map(); // note -> timestamp
        this.lastPlayedVariation = new Map(); // note -> variation index

        // Configuration
        this.minTimeBetweenSameVariation = 0.5; // 500ms - avoid same variation too quickly
        this.trillThreshold = 0.1; // 100ms - if faster, it's a trill/tremolo
        this.velocityVariationThreshold = 20; // velocity difference for variation preference

        // Statistics for adaptive behavior
        this.playHistory = new Map(); // note -> [{ time, velocity, variation }]
        this.maxHistoryLength = 10;
    }

    /**
     * Select the best variation for a note
     * @param {number} midiNote - MIDI note number
     * @param {number} velocity - Note velocity (0-127)
     * @param {Array} variations - Available variations
     * @param {number} currentTime - Current time in seconds
     * @returns {number} - Selected variation index
     */
    selectVariation(midiNote, velocity, variations, currentTime = null) {
        const now = currentTime || (performance.now() / 1000);

        // If only one variation, return it
        if (variations.length <= 1) {
            return 0;
        }

        // Get timing info
        const lastTime = this.lastPlayedTime.get(midiNote) || 0;
        const timeSinceLastPlay = now - lastTime;
        const lastVariation = this.lastPlayedVariation.get(midiNote);

        // CASE 1: Very fast repetition (trill/tremolo)
        // Use same variation for consistency
        if (timeSinceLastPlay < this.trillThreshold && lastVariation !== undefined) {
            this._updateHistory(midiNote, now, velocity, lastVariation);
            return lastVariation;
        }

        // CASE 2: Normal playing
        // Select variation based on multiple factors
        const selectedIndex = this._selectIntelligent(
            midiNote,
            velocity,
            variations,
            timeSinceLastPlay,
            lastVariation
        );

        // Update tracking
        this.lastPlayedTime.set(midiNote, now);
        this.lastPlayedVariation.set(midiNote, selectedIndex);
        this._updateHistory(midiNote, now, velocity, selectedIndex);

        return selectedIndex;
    }

    /**
     * Intelligent variation selection
     * @private
     */
    _selectIntelligent(midiNote, velocity, variations, timeSinceLastPlay, lastVariation) {
        const variationCount = variations.length;

        // Build candidate list with scores
        const candidates = variations.map((variation, index) => ({
            index,
            variation,
            score: 0
        }));

        // FACTOR 1: Avoid recent variations
        if (lastVariation !== undefined && timeSinceLastPlay < this.minTimeBetweenSameVariation) {
            candidates[lastVariation].score -= 100; // Heavy penalty
        }

        // FACTOR 2: Velocity-based preference
        // Higher velocity -> prefer brighter variations (later indices)
        // Lower velocity -> prefer softer variations (earlier indices)
        candidates.forEach((candidate, index) => {
            const velocityFactor = velocity / 127;
            const idealIndex = Math.floor(velocityFactor * (variationCount - 1));
            const distance = Math.abs(index - idealIndex);
            candidate.score += (variationCount - distance) * 10;
        });

        // FACTOR 3: Usage history - prefer less recently used
        const history = this.playHistory.get(midiNote) || [];
        const recentUse = new Map();

        history.forEach((entry, historyIndex) => {
            const recency = history.length - historyIndex; // More recent = higher value
            recentUse.set(entry.variation, (recentUse.get(entry.variation) || 0) + recency);
        });

        candidates.forEach(candidate => {
            const useCount = recentUse.get(candidate.index) || 0;
            candidate.score -= useCount * 5; // Penalty for recent use
        });

        // FACTOR 4: Randomization (small factor for natural variation)
        candidates.forEach(candidate => {
            candidate.score += (Math.random() - 0.5) * 3;
        });

        // Select highest scoring candidate
        candidates.sort((a, b) => b.score - a.score);

        return candidates[0].index;
    }

    /**
     * Update play history
     * @private
     */
    _updateHistory(midiNote, time, velocity, variation) {
        if (!this.playHistory.has(midiNote)) {
            this.playHistory.set(midiNote, []);
        }

        const history = this.playHistory.get(midiNote);
        history.push({ time, velocity, variation });

        // Keep only recent history
        if (history.length > this.maxHistoryLength) {
            history.shift();
        }
    }

    /**
     * Get statistics for a note
     * @param {number} midiNote - MIDI note number
     * @returns {Object} - Statistics
     */
    getStatistics(midiNote) {
        const history = this.playHistory.get(midiNote) || [];

        if (history.length === 0) {
            return { playCount: 0, variations: {} };
        }

        const variationCounts = {};
        history.forEach(entry => {
            variationCounts[entry.variation] = (variationCounts[entry.variation] || 0) + 1;
        });

        return {
            playCount: history.length,
            variations: variationCounts,
            lastPlayed: history[history.length - 1]
        };
    }

    /**
     * Reset tracking for a note
     * @param {number} midiNote - MIDI note number (optional, resets all if not provided)
     */
    reset(midiNote = null) {
        if (midiNote !== null) {
            this.lastPlayedTime.delete(midiNote);
            this.lastPlayedVariation.delete(midiNote);
            this.playHistory.delete(midiNote);
        } else {
            this.lastPlayedTime.clear();
            this.lastPlayedVariation.clear();
            this.playHistory.clear();
        }
    }

    /**
     * Update configuration
     */
    updateConfig(config) {
        if (config.minTimeBetweenSameVariation !== undefined) {
            this.minTimeBetweenSameVariation = config.minTimeBetweenSameVariation;
        }
        if (config.trillThreshold !== undefined) {
            this.trillThreshold = config.trillThreshold;
        }
        if (config.velocityVariationThreshold !== undefined) {
            this.velocityVariationThreshold = config.velocityVariationThreshold;
        }
    }
}
