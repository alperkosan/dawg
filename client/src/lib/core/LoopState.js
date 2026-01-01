/**
 * LoopState - Unified Loop State Management
 * 
 * Manages loop state with SharedArrayBuffer as single source of truth.
 * Handles synchronization between JavaScript and WASM audio engine.
 */

export class LoopState {
    constructor(transport) {
        this.transport = transport;

        // ✅ Single JS-side storage (for getters only, SAB is source of truth)
        this._enabled = true;
        this._startTick = 0;
        this._endTick = 1536; // 64 steps @ PPQ=96, ticksPerStep=24

        // ✅ SAB indices (must match WASM SharedAudioState)
        this.SAB_IDX_LOOP_ENABLED = 21;
        this.SAB_IDX_LOOP_START = 22;
        this.SAB_IDX_LOOP_END = 23;

        // Flag to track if SAB is initialized
        this._sabInitialized = false;
    }

    // =================== GETTERS ===================

    /** Loop enabled flag */
    get enabled() {
        return this._enabled;
    }

    /** Loop start position in ticks */
    get startTick() {
        return this._startTick;
    }

    /** Loop end position in ticks */
    get endTick() {
        return this._endTick;
    }

    /** Loop start position in steps */
    get startStep() {
        return Math.floor(this._startTick / this.transport.ticksPerStep);
    }

    /** Loop end position in steps */
    get endStep() {
        return Math.floor(this._endTick / this.transport.ticksPerStep);
    }

    /** Loop length in ticks */
    get lengthTicks() {
        return this._endTick - this._startTick;
    }

    /** Loop length in steps */
    get lengthSteps() {
        return this.endStep - this.startStep;
    }

    // =================== SETTERS ===================

    /**
     * Set loop points (start and end positions)
     * @param {number} startStep - Loop start in steps
     * @param {number} endStep - Loop end in steps (exclusive)
     * @param {boolean} [enabled=true] - Whether loop is enabled
     */
    setPoints(startStep, endStep, enabled = true) {
        // ✅ Validate inputs
        if (endStep <= 0 || isNaN(endStep)) {
            console.warn(`⚠️ LoopState: Invalid endStep (${endStep}), using default 64`);
            endStep = 64;
        }

        if (startStep >= endStep || isNaN(startStep) || startStep < 0) {
            console.warn(`⚠️ LoopState: Invalid startStep (${startStep}), using default 0`);
            startStep = 0;
        }

        // Convert steps to ticks
        const startTick = startStep * this.transport.ticksPerStep;
        const endTick = endStep * this.transport.ticksPerStep;

        // ✅ Check if values actually changed
        if (this._startTick === startTick &&
            this._endTick === endTick &&
            this._enabled === enabled) {
            return; // No change, skip update
        }

        // Update JS cache
        this._startTick = startTick;
        this._endTick = endTick;
        this._enabled = enabled;

        // ✅ Sync to SAB
        this._syncToSAB();

        // ✅ Trigger callbacks for scheduler/UI updates
        this.transport.triggerCallback('loopchange', {
            enabled: this._enabled,
            startTick: this._startTick,
            endTick: this._endTick,
            startStep,
            endStep
        });

        console.log(`🔄 LoopState: Points updated - start=${startStep} (${startTick} ticks), end=${endStep} (${endTick} ticks), enabled=${enabled}`);
    }

    /**
     * Enable or disable looping
     * @param {boolean} enabled - Whether loop is enabled
     */
    setEnabled(enabled) {
        if (this._enabled === enabled) {
            return; // No change
        }

        this._enabled = enabled;
        this._syncToSAB();

        this.transport.triggerCallback('loopchange', { enabled });
        console.log(`🔄 LoopState: Enabled = ${enabled}`);
    }

    // =================== SAB SYNC ===================

    /**
     * Internal: Sync JS state to SharedArrayBuffer
     * This is the ONLY method that writes to SAB
     * @private
     */
    _syncToSAB() {
        const sab = this.transport.sharedFloat;

        if (!sab) {
            console.warn('⚠️ LoopState: SAB not initialized, cannot sync. Call initializeSAB() first.');
            return;
        }

        // ✅ Atomic write of all loop parameters
        sab[this.SAB_IDX_LOOP_ENABLED] = this._enabled ? 1.0 : 0.0;
        sab[this.SAB_IDX_LOOP_START] = this._startTick;
        sab[this.SAB_IDX_LOOP_END] = this._endTick;

        console.log(`🔄 LoopState→SAB: enabled=${this._enabled}, start=${this._startTick} ticks, end=${this._endTick} ticks`);
    }

    /**
     * Initialize SAB with current loop state
     * Called after SharedArrayBuffer is created
     */
    initializeSAB() {
        if (this._sabInitialized) {
            console.warn('⚠️ LoopState: SAB already initialized');
            return;
        }

        console.log('✅ LoopState: Initializing SAB with default state');
        this._syncToSAB();
        this._sabInitialized = true;
    }

    // =================== UTILITIES ===================

    /**
     * Check if a given tick is within the loop range
     * @param {number} tick - Tick position to check
     * @returns {boolean}
     */
    isInLoop(tick) {
        return tick >= this._startTick && tick < this._endTick;
    }

    /**
     * Wrap a tick position to loop start if it exceeds loop end
     * @param {number} tick - Tick position to wrap
     * @returns {number} Wrapped tick position
     */
    wrapTick(tick) {
        if (!this._enabled || this._endTick <= 0) {
            return tick;
        }

        if (tick >= this._endTick) {
            const loopLength = this._endTick - this._startTick;
            if (loopLength > 0) {
                const overshoot = tick - this._endTick;
                return this._startTick + (overshoot % loopLength);
            }
        }

        return tick;
    }

    /**
     * Get debug info about current loop state
     * @returns {object}
     */
    getDebugInfo() {
        return {
            enabled: this._enabled,
            startTick: this._startTick,
            endTick: this._endTick,
            startStep: this.startStep,
            endStep: this.endStep,
            lengthTicks: this.lengthTicks,
            lengthSteps: this.lengthSteps,
            sabInitialized: this._sabInitialized
        };
    }
}
