// lib/core/PositionTracker.js
// Centralized Position Tracking - Handles all tick ↔ BBT conversions

export class PositionTracker {
    constructor(transport) {
        this.transport = transport;

        // Constants from transport
        this.ppq = transport.ppq; // 96
        this.ticksPerStep = transport.ticksPerStep; // 24
        this.stepsPerBar = transport.stepsPerBar; // 16
        this.ticksPerBar = transport.ticksPerBar; // 384

        // Cached calculations to avoid repeated computation
        this.lastTick = -1;
        this.cachedPosition = null;

        console.log('🎯 PositionTracker initialized:', {
            ppq: this.ppq,
            ticksPerStep: this.ticksPerStep,
            stepsPerBar: this.stepsPerBar,
            ticksPerBar: this.ticksPerBar
        });
    }

    /**
     * Get current position in multiple formats
     * @returns {Object} Complete position info
     */
    getCurrentPosition() {
        const currentTick = this.transport.currentTick;

        // Use cache if tick hasn't changed
        if (currentTick === this.lastTick && this.cachedPosition) {
            return this.cachedPosition;
        }

        const position = {
            // Raw values
            tick: currentTick,

            // Step-based (for grid UI)
            step: Math.floor(currentTick / this.ticksPerStep),
            stepFloat: currentTick / this.ticksPerStep,

            // BBT format (for display)
            bar: Math.floor(currentTick / this.ticksPerBar) + 1,
            beat: Math.floor((currentTick % this.ticksPerBar) / (this.ticksPerStep * 4)) + 1,
            sixteenth: Math.floor((currentTick % (this.ticksPerStep * 4)) / this.ticksPerStep) + 1,

            // Formatted strings
            bbt: this._formatBBT(currentTick),
            display: this._formatDisplay(currentTick)
        };

        // Cache result
        this.lastTick = currentTick;
        this.cachedPosition = position;

        return position;
    }

    /**
     * Convert step to tick (integer step)
     */
    stepToTick(step) {
        return Math.floor(step) * this.ticksPerStep;
    }

    /**
     * Convert tick to exact step (may be float)
     */
    tickToStep(tick) {
        return tick / this.ticksPerStep;
    }

    /**
     * Convert tick to BBT components
     */
    tickToBBT(tick) {
        const bar = Math.floor(tick / this.ticksPerBar) + 1;
        const beat = Math.floor((tick % this.ticksPerBar) / (this.ticksPerStep * 4)) + 1;
        const sixteenth = Math.floor((tick % (this.ticksPerStep * 4)) / this.ticksPerStep) + 1;
        const subSixteenth = (tick % this.ticksPerStep) / this.ticksPerStep;

        return { bar, beat, sixteenth, subSixteenth };
    }

    /**
     * Convert BBT to tick
     */
    bbtToTick(bar, beat, sixteenth, subSixteenth = 0) {
        const tick =
            (bar - 1) * this.ticksPerBar +
            (beat - 1) * this.ticksPerStep * 4 +
            (sixteenth - 1) * this.ticksPerStep +
            Math.floor(subSixteenth * this.ticksPerStep);

        return tick;
    }

    /**
     * Format tick as BBT string (with display options)
     */
    _formatBBT(tick, precise = false) {
        const { bar, beat, sixteenth, subSixteenth } = this.tickToBBT(tick);

        if (!precise || subSixteenth < 0.1) {
            // Clean display for UI - no decimals
            return `${bar}:${beat}:${sixteenth}`;
        } else {
            // Include sub-sixteenth only when needed and requested
            const subSixteenthRounded = Math.round(subSixteenth * 4) / 4; // Round to quarter steps
            return `${bar}:${beat}:${sixteenth}.${Math.floor(subSixteenthRounded * 4)}`;
        }
    }

    /**
     * Format tick for UI display (clean, no decimals)
     */
    _formatDisplay(tick) {
        const { bar, beat, sixteenth } = this.tickToBBT(tick);
        return `${bar.toString().padStart(3, ' ')}:${beat}:${sixteenth}`;
    }

    /**
     * Get formatted position for UI display (rounded to nearest sixteenth)
     */
    getDisplayPosition() {
        const position = this.getCurrentPosition();

        // Round to nearest sixteenth for clean display
        const roundedTick = Math.round(position.tick / this.ticksPerStep) * this.ticksPerStep;

        return {
            ...position,
            bbt: this._formatBBT(roundedTick, false), // Clean format
            display: this._formatDisplay(roundedTick)
        };
    }

    /**
     * Get position for playhead (exact pixel positioning)
     * @param {number} stepWidth - Width of one step in pixels
     * @returns {number} X position in pixels
     */
    getPlayheadPosition(stepWidth) {
        const position = this.getCurrentPosition();
        return position.stepFloat * stepWidth;
    }

    /**
     * Jump to specific BBT position
     */
    jumpToBBT(bar, beat, sixteenth) {
        const tick = this.bbtToTick(bar, beat, sixteenth);
        const step = this.tickToStep(tick);

        // Clear cache
        this.lastTick = -1;
        this.cachedPosition = null;

        return { tick, step };
    }

    /**
     * Jump to step position
     */
    jumpToStep(step) {
        const tick = this.stepToTick(step);
        const position = this.getCurrentPosition();

        // Clear cache
        this.lastTick = -1;
        this.cachedPosition = null;

        return { tick, step, bbt: this._formatBBT(tick) };
    }

    /**
     * Check if position changed since last call
     */
    hasPositionChanged() {
        return this.transport.currentTick !== this.lastTick;
    }

    /**
     * Clear position cache (call when transport resets)
     */
    clearCache() {
        this.lastTick = -1;
        this.cachedPosition = null;
    }
}