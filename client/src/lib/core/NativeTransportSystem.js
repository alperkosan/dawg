// lib/core/NativeTransportSystem.js
// DAWG - Native Transport System - ToneJS'siz tam native implementasyon
import EventBus from './EventBus'; // YENİ: EventBus'ı import ediyoruz.
import { SampleAccurateTime } from './utils/SampleAccurateTime.js'; // ✅ NEW: Sample-accurate timing
import { LookaheadScheduler } from './utils/LookaheadScheduler.js'; // ✅ NEW: Advanced lookahead scheduling
import { EventBatcher } from './utils/EventBatcher.js'; // ✅ NEW: Event batching for performance
import { LoopState } from './LoopState.js'; // ✅ NEW: Unified loop state management

export class NativeTransportSystem {
    constructor(audioContext) {
        this.audioContext = audioContext;

        // ✅ CRITICAL: Initialize SharedArrayBuffer FIRST (before any state that writes to SAB)
        this._initSharedMemory();

        // State management
        this.isPlaying = false;
        this.isPaused = false; // ✅ ADD: Track pause state explicitly
        this.bpm = 120;
        this.timeSignature = [4, 4];

        // ✅ Timing constants - STEPS vs TICKS vs SECONDS clarification
        this.ppq = 96; // pulses per quarter note (ticks)
        this.stepsPerBar = 16; // 16th note steps per bar (4/4 time)
        this.ticksPerStep = this.ppq / 4; // 24 ticks per step (16th note)
        this.ticksPerBar = this.ppq * this.timeSignature[0]; // 384 ticks per bar

        // ✅ Position tracking - ALL IN TICKS
        this.currentTick = 0;
        this.nextTickTime = 0;

        // ✅ NEW: Advanced lookahead scheduler (adaptive, 100-200ms range)
        this.lookaheadScheduler = new LookaheadScheduler(audioContext, {
            baseLookahead: 0.12, // 120ms base (optimal)
            minLookahead: 0.05,  // 50ms minimum
            maxLookahead: 0.2     // 200ms maximum
        });

        // ⚡ CRITICAL: Tighter scheduling window for better timing accuracy
        // ✅ NEW: Use adaptive lookahead from LookaheadScheduler
        this.lookAhead = this.lookaheadScheduler.getLookahead() * 1000; // Convert to ms

        // ✅ FAZ 1: Adaptive schedule ahead time based on BPM
        // ✅ NEW: Now uses LookaheadScheduler for more sophisticated calculation
        // Yüksek BPM (140+): 100ms, Orta BPM (100-140): 120ms, Düşük BPM (<100): 150ms
        this.scheduleAheadTime = this._calculateAdaptiveScheduleAhead();

        // ✅ NEW: Unified Loop State Management
        // Initialize AFTER _initSharedMemory() so SAB is available
        this.loopState = new LoopState(this);
        this.loopState.setPoints(0, 64, true); // Default: 0-64 steps, enabled
        this.loopState.initializeSAB(); // Write to SAB

        // ⚡ LEGACY: Loop cache (kept for backward compatibility, not used by LoopState)
        this.loopCache = {
            lastBpm: null,
            lastLoopStart: null,
            lastLoopEnd: null,
            lastTimeSignature: null,
            cachedLoopSeconds: null,
            cachedLoopTicks: null,
            cacheValid: false
        };

        // Bar tracking
        this.currentBar = 0;

        this.callbacks = new Map();
        this.scheduledEvents = new Map();
        this.patterns = new Map(); // EKLENDİ
        this.activePatterns = new Set(); // EKLENDİ

        // ✅ NEW: Event batcher for performance optimization
        this.eventBatcher = new EventBatcher({
            batchSize: 32, // Process 32 events at once
            maxBatchTime: 0.001 // 1ms max batch processing time
        });

        // UI update throttling
        this.lastUIUpdate = 0;

        this._setupEventListeners();
    }

    _initSharedMemory() {
        try {
            // 32 floats/ints = 128 bytes
            this.sharedAudioState = new SharedArrayBuffer(128);
            this.sharedInt = new Int32Array(this.sharedAudioState);
            this.sharedFloat = new Float32Array(this.sharedAudioState);

            // Indices (Must match Rust SharedAudioState)
            this.SAB_IDX_PLAY_STATE = 0;
            this.SAB_IDX_MSG_COUNTER = 1;
            this.SAB_IDX_BPM = 16;
            this.SAB_IDX_POS_SAMPLES = 17;
            this.SAB_IDX_POS_TICKS = 18;
            this.SAB_IDX_SAMPLE_RATE = 19;
            this.SAB_IDX_SEEK_TARGET = 20; // Float32: Target Ticks
            this.SAB_IDX_SEEK_TRIGGER = 2; // Int32: 1 = Seek Requested

            // Loop Params
            this.SAB_IDX_LOOP_ENABLED = 21;
            this.SAB_IDX_LOOP_START = 22;
            this.SAB_IDX_LOOP_END = 23;

            console.log("✅ NativeTransportSystem: SharedArrayBuffer initialized");
        } catch (e) {
            console.error("❌ SharedArrayBuffer support missing! Fallback needed.", e);
        }
    }

    // =================== LOOP STATE GETTERS (Delegate to LoopState) ===================

    /** @returns {boolean} Loop enabled flag */
    get loop() {
        return this.loopState?.enabled ?? true;
    }

    /** @returns {number} Loop start position in ticks */
    get loopStartTick() {
        return this.loopState?.startTick ?? 0;
    }

    /** @returns {number} Loop end position in ticks */
    get loopEndTick() {
        return this.loopState?.endTick ?? 1536;
    }

    // Called by AudioContextService or AudioEngine
    linkAudioEngine(audioEngine) {
        this.audioEngine = audioEngine;
        let workletNode = null;

        // Handle both NativeAudioEngine (wrapper) and direct WorkletNode access
        if (audioEngine.unifiedMixer && audioEngine.unifiedMixer.workletNode) {
            workletNode = audioEngine.unifiedMixer.workletNode;
        } else if (audioEngine.unifiedMixerWorkletNode) {
            workletNode = audioEngine.unifiedMixerWorkletNode;
        }

        if (workletNode) {
            workletNode.port.postMessage({
                type: 'set-shared-state',
                sharedState: this.sharedAudioState
            });
            console.log("🔗 Transport linked to AudioEngine (SAB passed)");
        } else {
            console.warn("⚠️ Transport could not find UnifiedMixerWorkletNode to link!");
        }
    }

    /**
     * ✅ FAZ 1: Calculate adaptive schedule ahead time based on BPM
     * Yüksek BPM (140+): 120ms (optimized for better timing consistency)
     * Orta BPM (100-140): 120ms (optimal)
     * Düşük BPM (<100): 150ms (daha uzun, çünkü notalar daha yavaş)
     * @returns {number} Schedule ahead time in seconds
     */
    _calculateAdaptiveScheduleAhead() {
        if (this.bpm >= 140) {
            return 0.12; // ✅ OPTIMIZED: 120ms for high BPM
        } else if (this.bpm >= 100) {
            return 0.12; // 120ms for medium BPM
        } else {
            return 0.15; // 150ms for low BPM
        }
    }

    /**
     * Update schedule ahead time when BPM changes
     * ✅ NEW: Also updates LookaheadScheduler
     */
    _updateScheduleAheadTime() {
        this.scheduleAheadTime = this._calculateAdaptiveScheduleAhead();

        // ✅ NEW: Update lookahead scheduler with new BPM
        if (this.lookaheadScheduler) {
            const eventCount = this.scheduledEvents.size;
            this.lookaheadScheduler.updateLookahead(this.bpm, eventCount);
            this.lookAhead = this.lookaheadScheduler.getLookahead() * 1000;
        }
    }

    // YENİ: Tüm olay dinleyicilerini tek bir yerden yönetelim.
    _setupEventListeners() {
        EventBus.on('PLAY_REQUESTED', () => this.play());
        EventBus.on('STOP_REQUESTED', () => this.stop());
        EventBus.on('TEMPO_CHANGED', (payload) => {
            this.setBPM(payload.tempo); // ✅ FAZ 1: Use setBPM which updates schedule ahead time
        });
        // Gelecekte eklenebilecek diğer dinleyiciler:
        // EventBus.on('SEEK_REQUESTED', (payload) => this.seek(payload.tick));
    }

    // ✅ FAZ 1: Alias for setBPM (for compatibility)
    setTempo(tempo) {
        return this.setBPM(tempo);
    }

    // =================== BASIC TRANSPORT CONTROLS ===================

    start(when = null) {
        if (this.isPlaying) return;

        const startTime = when || this.audioContext.currentTime;
        this.isPlaying = true;

        // Logic for resume vs start from beginning handled by Rust/SAB mostly
        // But we write state to SAB
        if (!this.isPaused && (this.currentTick === this.loopStartTick || this.currentTick === 0)) {
            this.currentTick = this.loopStartTick;
        } else {
            this.isPaused = false;
        }

        const minDelay = SampleAccurateTime.getMinimumSafeOffset(this.audioContext, 64);
        const rawNextTickTime = Math.max(startTime + minDelay, this.audioContext.currentTime + minDelay);
        this.nextTickTime = SampleAccurateTime.toSampleAccurate(this.audioContext, rawNextTickTime);

        // ✅ COMMAND: PLAY (1)
        Atomics.store(this.sharedInt, this.SAB_IDX_PLAY_STATE, 1);
        // Note: Atomics cannot be used on Float32Array
        this.sharedFloat[this.SAB_IDX_BPM] = this.bpm;

        // Start Sync Loop
        this._startSyncLoop();

        this.triggerCallback('start', { time: startTime, position: this.currentTick });
        return this;
    }

    stop(when = null) {
        if (!this.isPlaying && !this.isPaused) return this;

        const stopTime = when || this.audioContext.currentTime;
        this.isPlaying = false;
        this.isPaused = false;

        // ✅ COMMAND: STOP (0)
        Atomics.store(this.sharedInt, this.SAB_IDX_PLAY_STATE, 0);

        this.currentTick = this.loopStartTick;
        this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);
        this.nextTickTime = stopTime;

        this.clearScheduledEvents();
        this._stopSyncLoop();

        this.triggerCallback('stop', { time: stopTime, position: this.currentTick });
        return this;
    }

    pause(when = null) {
        if (!this.isPlaying) return this;

        const pauseTime = when || this.audioContext.currentTime;
        this.isPlaying = false;
        this.isPaused = true;

        // ✅ COMMAND: PAUSE (2)
        Atomics.store(this.sharedInt, this.SAB_IDX_PLAY_STATE, 2);

        this._stopSyncLoop();

        this.triggerCallback('pause', { time: pauseTime, position: this.currentTick });
        return this;
    }

    _startSyncLoop() {
        if (this.syncAnimationFrame) cancelAnimationFrame(this.syncAnimationFrame);

        // ✅ FIX: JS-side tick calculation (WASM doesn't update SAB position)
        // WASM was supposed to update sharedFloat[SAB_IDX_POS_TICKS] but doesn't
        // So we calculate tick position based on AudioContext.currentTime
        this._lastWasmTick = 0;
        this._loopEventFired = false;
        this._loopEventCooldown = 0;

        // ✅ NEW: Track playback start time for accurate tick calculation
        this._playbackStartTime = this.audioContext.currentTime;
        this._playbackStartTick = this.currentTick;

        const loop = () => {
            if (!this.isPlaying) return;

            const now = performance.now();
            const audioTime = this.audioContext.currentTime;

            // ✅ FIX: Calculate current tick from elapsed time (JS-side, not WASM)
            // This replaces the broken WASM position reading
            const elapsedSeconds = audioTime - this._playbackStartTime;
            const ticksPerSecond = this.bpm / 60 * this.ppq; // ticks per second
            const calculatedTick = this._playbackStartTick + (elapsedSeconds * ticksPerSecond);

            // ✅ Write calculated position to SAB for other systems to read
            if (this.sharedFloat) {
                this.sharedFloat[this.SAB_IDX_POS_TICKS] = calculatedTick;
            }

            // Use the calculated tick as current position
            let currentWasmTick = calculatedTick;

            // 2. ✅ Loop Boundary Detection
            if (this.loop && this.loopEndTick > 0 && currentWasmTick >= this.loopEndTick) {
                // ✅ FIX: Increased cooldown to prevent double-trigger during async handler
                if (now - this._loopEventCooldown > 200) {
                    this._loopEventCooldown = now;

                    console.log(`🔁 [LOOP RESTART] Triggered @ ${audioTime.toFixed(3)}s, tick ${currentWasmTick.toFixed(1)} → ${this.loopStartTick}`);

                    // Calculate new position
                    const newTick = this.loopStartTick || 0;

                    // ✅ Reset playback reference for accurate timing after loop
                    this._playbackStartTime = audioTime;
                    this._playbackStartTick = newTick;

                    // Write new position to SAB
                    if (this.sharedFloat) {
                        this.sharedFloat[this.SAB_IDX_POS_TICKS] = newTick;
                    }

                    // Update JS state
                    this.currentTick = newTick;
                    this._lastWasmTick = newTick;

                    // Fire loop event
                    const loopStartTime = audioTime;
                    this.triggerCallback('loop', {
                        time: loopStartTime,
                        nextLoopStartTime: loopStartTime,
                        fromTick: currentWasmTick,
                        toTick: newTick,
                        needsReschedule: true
                    });

                    // Continue to next frame
                    this.syncAnimationFrame = requestAnimationFrame(loop);
                    return;
                }
            }

            // 3. Sync JS state with calculated position
            this.currentTick = currentWasmTick;
            this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);
            this._lastWasmTick = currentWasmTick;

            // 4. Throttled Visual Updates (60fps)
            if (now - this.lastUIUpdate > 16.67) {
                const step = this.ticksToSteps(currentWasmTick);
                this.triggerCallback('tick', {
                    time: audioTime,
                    position: this.currentTick,
                    formatted: this.formatPosition(this.currentTick),
                    bar: this.currentBar,
                    step: step
                });
                this.lastUIUpdate = now;
            }

            // 5. Process scheduled events
            this.processScheduledEvents(audioTime);

            this.syncAnimationFrame = requestAnimationFrame(loop);
        };
        this.syncAnimationFrame = requestAnimationFrame(loop);
    }

    _stopSyncLoop() {
        if (this.syncAnimationFrame) cancelAnimationFrame(this.syncAnimationFrame);
        this._lastWasmTick = 0;
        this._loopEventFired = false;
        this._loopEventCooldown = 0;
    }


    // =================== POSITION & TIMING ===================

    getPosition() {
        if (!this.isPlaying) return this.position;

        const elapsed = this.audioContext.currentTime - this.nextTickTime + this.getSecondsPerTick();
        const ticksElapsed = Math.floor(elapsed / this.getSecondsPerTick());
        return this.position + ticksElapsed;
    }

    /**
     * ✅ Get current position in steps (for AutomationScheduler compatibility)
     * Converts current tick position to steps with sub-step precision during playback
     */
    getCurrentStep() {
        if (!this.isPlaying) {
            return this.ticksToSteps(this.currentTick);
        }

        // ✅ FIX: Use consistent time anchor mechanism for precise position
        // This matches the logic in _startSyncLoop to ensure consistency
        if (this._playbackStartTime !== undefined) {
            const elapsedSeconds = this.audioContext.currentTime - this._playbackStartTime;
            const ticksPerSecond = this.bpm / 60 * this.ppq;
            const calculatedTick = this._playbackStartTick + (elapsedSeconds * ticksPerSecond);
            return this.ticksToSteps(calculatedTick);
        }

        // Fallback if _playbackStartTime not set (should not happen if playing)
        return this.ticksToSteps(this.currentTick);
    }

    /**
     * Get visual position in steps (alias for getCurrentStep for compatibility)
     */
    getVisualPosition() {
        return this.getCurrentStep();
    }

    setPosition(step) {
        const targetTick = this.stepsToTicks(step);
        this.currentTick = targetTick;
        this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);

        if (this.isPlaying) {
            this.nextTickTime = this.audioContext.currentTime;

            // ✅ FIX: Update playback anchor for JS-side tick calculation
            // If we don't update this, the _startSyncLoop will revert position based on old anchor
            this._playbackStartTime = this.audioContext.currentTime;
            this._playbackStartTick = targetTick;
        }

        // ✅ COMMAND: SEEK (Sync Wasm Clock)
        // Notify Wasm to jump to this position to prevent clock drift/glitches
        if (this.sharedInt && this.sharedFloat) {
            this.sharedFloat[this.SAB_IDX_SEEK_TARGET] = targetTick;
            Atomics.store(this.sharedInt, this.SAB_IDX_SEEK_TRIGGER, 1);
        }

        this.triggerCallback('position', { position: this.currentTick, step: step });
        return this;
    }


    setLoopPoints(startStep, endStep) {
        // ✅ NEW: Delegate to unified LoopState (validation happens there)
        this.loopState.setPoints(startStep, endStep, true);

        // ✅ Reset position if outside new loop range
        const currentTick = this.currentTick;
        if (currentTick < this.loopStartTick || currentTick >= this.loopEndTick) {
            this.currentTick = this.loopStartTick;
            this.nextTickTime = this.audioContext.currentTime;
        }
    }

    setLoopEnabled(enabled) {
        // ✅ FIX: Prevent undefined from being set (use current value if undefined)
        const validEnabled = enabled !== undefined ? enabled : this.loopState.enabled;

        // ✅ NEW: Delegate to unified LoopState
        this.loopState.setEnabled(validEnabled);
    }

    setBPM(bpm) {
        // ✅ FIX: Remove BPM restrictions - only ensure positive value
        if (bpm <= 0 || isNaN(bpm)) {
            console.warn('Invalid BPM value:', bpm);
            return this;
        }

        // Store old BPM for timing adjustment
        const oldBpm = this.bpm;
        const wasPlaying = this.isPlaying;

        // ⚡ OPTIMIZATION: Invalidate loop cache when BPM changes
        if (this.bpm !== bpm) {
            this._invalidateLoopCache();
        }

        this.bpm = bpm;

        // ✅ CRITICAL: Write BPM to SharedArrayBuffer for WASM/AudioWorklet sync
        if (this.sharedFloat) {
            this.sharedFloat[this.SAB_IDX_BPM] = bpm;
        }

        // ✅ FAZ 1: Update schedule ahead time when BPM changes
        this._updateScheduleAheadTime();

        // 🎯 CRITICAL: Adjust timing if playing to maintain smooth playback
        if (wasPlaying && oldBpm !== bpm) {
            // ✅ IMPROVED: Selective event clearing during BPM change
            // This prevents "latencies" from events scheduled with the old BPM
            this.clearScheduledEvents((event) => event.data?.type !== 'noteOff');

            // Recalibrate nextTickTime to current time
            // This effectively "restarts" the scheduler window from now
            const currentTime = this.audioContext.currentTime;
            this.nextTickTime = currentTime;

            // ✅ CRITICAL FIX: Reset playback timing anchor for _startSyncLoop
            // Without this, tick calculation continues using old BPM reference
            if (this._playbackStartTime !== undefined) {
                // Calculate current tick position using OLD BPM
                const elapsedSeconds = currentTime - this._playbackStartTime;
                const oldTicksPerSecond = oldBpm / 60 * this.ppq;
                const currentCalculatedTick = this._playbackStartTick + (elapsedSeconds * oldTicksPerSecond);

                // Reset anchor to NOW with current tick position
                // From this point, _startSyncLoop will use NEW BPM for calculations
                this._playbackStartTime = currentTime;
                this._playbackStartTick = currentCalculatedTick;
                this.currentTick = currentCalculatedTick;

                console.log(`⏱️ BPM anchor reset: tick ${currentCalculatedTick.toFixed(2)} @ ${currentTime.toFixed(3)}s (${oldBpm} → ${bpm})`);
            } else {
                console.log(`⏱️ BPM Change: ${oldBpm} -> ${bpm}. Scheduler window reset at tick ${this.currentTick}`);
            }
        }

        this.triggerCallback('bpm', { bpm: this.bpm, oldBpm, wasPlaying });
        return this;
    }

    setTimeSignature(numerator, denominator = 4) {
        // ⚡ OPTIMIZATION: Invalidate loop cache when time signature changes
        if (JSON.stringify(this.timeSignature) !== JSON.stringify([numerator, denominator])) {
            this._invalidateLoopCache();
        }

        this.timeSignature = [numerator, denominator];
        return this;
    }

    _calculatePatternLengthFromData(patternData) {
        let maxStep = 0;

        Object.values(patternData).forEach(notes => {
            if (Array.isArray(notes)) {
                notes.forEach(note => {
                    const noteTime = note.time || 0;
                    const noteDuration = 1; // Default 1 step
                    maxStep = Math.max(maxStep, noteTime + noteDuration);
                });
            }
        });

        // En az 64 step (4 bar), 16'nın katlarına yuvarla
        const calculatedLength = Math.max(64, Math.ceil(maxStep / 16) * 16);

        return calculatedLength;
    }

    // =================== SCHEDULING CORE ===================
    scheduler() {
        // ✅ NEW: Use sample-accurate time for scheduling window
        const currentTime = SampleAccurateTime.getCurrentSampleAccurateTime(this.audioContext);

        // ✅ NEW: Update lookahead based on current conditions
        let lookaheadSeconds = this.scheduleAheadTime; // Fallback

        if (this.lookaheadScheduler) {
            const eventCount = this.scheduledEvents.size;
            this.lookaheadScheduler.updateLookahead(this.bpm, eventCount);
            this.lookAhead = this.lookaheadScheduler.getLookahead() * 1000;
            lookaheadSeconds = this.lookaheadScheduler.getLookahead();
        }

        const scheduleUntil = SampleAccurateTime.toSampleAccurate(
            this.audioContext,
            currentTime + lookaheadSeconds
        );

        while (this.nextTickTime < scheduleUntil) {
            // ✅ NEW: Ensure nextTickTime is sample-accurate
            const sampleAccurateTickTime = SampleAccurateTime.toSampleAccurate(
                this.audioContext,
                this.nextTickTime
            );

            // 1. UI callbacks with position info (Throttled inside)
            this.scheduleCurrentTick(sampleAccurateTickTime);

            // 2. High-precision scheduling event (Unthrottled)
            // Used by NoteScheduler, AutomationScheduler, etc.
            this.triggerCallback('scheduler', {
                time: sampleAccurateTickTime,
                tick: this.currentTick,
                bar: this.currentBar,
                lookahead: lookaheadSeconds
            });

            // 3. ✅ FIXED: Process scheduled events at current time (sample-accurate)
            this.processScheduledEvents(sampleAccurateTickTime);

            this.advanceToNextTick();
        }
    }

    /**
     * @deprecated This method is no longer used in WASM Master Clock mode.
     * Loop detection is now handled in _startSyncLoop.
     * Kept for backward compatibility only.
     */
    advanceToNextTick() {
        const secondsPerTick = this.getSecondsPerTick();

        // ✅ DEPRECATED: This method is no longer called in WASM Master Clock mode
        // _startSyncLoop now handles all timing from WASM position
        // This only exists for backward compatibility if scheduler() is called externally

        this.currentTick++;

        // Just update nextTickTime for timing calculations
        this.nextTickTime = SampleAccurateTime.toSampleAccurate(
            this.audioContext,
            this.nextTickTime + secondsPerTick
        );

        // Bar tracking (existing code)
        const newBar = Math.floor(this.currentTick / this.ticksPerBar);
        if (newBar !== this.currentBar) {
            this.currentBar = newBar;

            this.triggerCallback('bar', {
                time: this.nextTickTime,
                bar: this.currentBar,
                tick: this.currentTick
            });
        }
    }

    /**
     * ✅ IMPROVED: Selective event clearing
     * Allows keeping certain events (like noteOff) during loop wraps or seeks.
     * 
     * @param {Function} filter - Optional filter function. If it returns true, the event is CLEARED.
     *                            If not provided, all events are cleared.
     */
    clearScheduledEvents(filter = null) {
        if (!filter) {
            this.scheduledEvents.clear();
            return;
        }

        // Apply filter: Delete only events that match the filter
        for (const [id, event] of this.scheduledEvents.entries()) {
            if (filter(event)) {
                this.scheduledEvents.delete(id);
            }
        }
    }

    // lib/core/NativeTransportSystem.js içinde scheduleCurrentTick metodunu güncelle
    scheduleCurrentTick(time) {
        // ⚡ PERFORMANS: Throttled UI updates - 60fps for smooth playhead
        const now = performance.now();
        if (now - this.lastUIUpdate > 16.67) { // 60fps for smooth UI
            this.triggerCallback('tick', {
                time: time,
                position: this.currentTick,
                formatted: this.formatPosition(this.currentTick),
                bar: this.currentBar,
                step: this.ticksToSteps(this.currentTick)
            });
            this.lastUIUpdate = now;
        }

        // Beat callback (her zaman trigger et - önemli)
        if (this.currentTick % this.ppq === 0) {
            const beat = Math.floor(this.currentTick / this.ppq) % this.timeSignature[0];
            this.triggerCallback('beat', { time, beat, tick: this.currentTick });
        }
    }

    /**
     * Dışarıdan bir olayı belirli bir zamanda çalınmak üzere sıraya alır.
     * @param {number} time - Olayın saniye cinsinden çalınacağı zaman.
     * @param {Function} callback - Zamanı geldiğinde çalıştırılacak fonksiyon.
     * @param {object} data - Callback'e gönderilecek ek veri.
     * @returns {string} - Zamanlanmış olayın benzersiz ID'si.
     */
    // ✅ CRITICAL FIX: Event scheduling with proper time conversion
    // ✅ NEW: Sample-accurate timing for professional precision
    scheduleEvent(timeInSeconds, callback, data = {}) {
        // ✅ NEW: Convert to sample-accurate time before scheduling
        const sampleAccurateTime = SampleAccurateTime.toSampleAccurate(
            this.audioContext,
            timeInSeconds
        );

        // ✅ NEW: Ensure time is in the future (avoid past-time errors)
        const safeTime = SampleAccurateTime.ensureFutureTime(
            this.audioContext,
            sampleAccurateTime
        );

        const eventId = `event_${Date.now()}_${Math.random()}`;

        // ✅ NEW: Use sample-accurate time as key for event storage
        if (!this.scheduledEvents.has(safeTime)) {
            this.scheduledEvents.set(safeTime, []);
        }

        this.scheduledEvents.get(safeTime).push({
            id: eventId,
            callback,
            data,
            originalTime: timeInSeconds, // Store original for debugging
            sampleAccurateTime: safeTime // Store sample-accurate time
        });

        return eventId;
    }

    processScheduledEvents(currentTime) {
        // ✅ NEW: Use event batching for better performance
        // Collect all due events first
        const dueEvents = [];
        for (const [scheduledTime, events] of this.scheduledEvents.entries()) {
            if (scheduledTime <= currentTime) {
                // Add events to batch queue with priority
                events.forEach(event => {
                    const priority = this._getEventPriority(event.data);
                    this.eventBatcher.addEvent(
                        event.callback,
                        scheduledTime,
                        event.data,
                        priority
                    );
                });
                dueEvents.push(scheduledTime);
            }
        }

        // Process batch
        const processedCount = this.eventBatcher.processDueEvents(currentTime);

        if (processedCount >= 50 && import.meta.env.DEV) {
            console.log(`⏰ Processed ${processedCount} events in batch (currentTime: ${currentTime.toFixed(4)}s)`);
        }

        // Remove processed events from scheduled events map
        dueEvents.forEach(scheduledTime => {
            this.scheduledEvents.delete(scheduledTime);
        });

        // ✅ LEAK FIX: Clean stale events (older than 5 seconds)
        // This prevents unbounded growth due to timing precision issues
        const staleThreshold = currentTime - 5.0;
        for (const [scheduledTime] of this.scheduledEvents.entries()) {
            if (scheduledTime < staleThreshold) {
                this.scheduledEvents.delete(scheduledTime);
            }
        }
    }

    /**
     * ✅ NEW: Get event priority for batching
     * Higher priority events are processed first
     * 
     * @param {Object} eventData - Event data
     * @returns {number} Priority (higher = more important)
     */
    _getEventPriority(eventData) {
        // Priority levels:
        // 100: Critical (note on/off, transport events)
        // 50: High (automation, effects)
        // 0: Normal (UI updates, callbacks)

        if (!eventData || !eventData.type) {
            return 0;
        }

        switch (eventData.type) {
            case 'noteOn':
            case 'noteOff':
            case 'loop':
            case 'start':
            case 'stop':
                return 100; // Critical priority
            case 'automation':
            case 'effect':
                return 50; // High priority
            case 'tick':
            case 'beat':
            case 'bar':
                return 10; // Medium priority (UI updates)
            default:
                return 0; // Normal priority
        }
    }

    // ✅ LEAK FIX: Add method to clear scheduled events
    clearScheduledEvents(predicate = null) {
        if (predicate) {
            // Remove events matching predicate
            for (const [time, events] of this.scheduledEvents.entries()) {
                const filtered = events.filter(e => !predicate(e.data));
                if (filtered.length === 0) {
                    this.scheduledEvents.delete(time);
                } else {
                    this.scheduledEvents.set(time, filtered);
                }
            }
        } else {
            this.scheduledEvents.clear();
        }
    }

    _secondsToTicks(seconds) {
        const secondsPerTick = this.getSecondsPerTick();
        if (secondsPerTick === 0) return 0;
        return Math.round(seconds / secondsPerTick);
    }

    // =================== PATTERN SCHEDULING ===================

    schedulePattern(patternId, pattern, startTime = null) {
        startTime = startTime || this.audioContext.currentTime;

        const processedPattern = this.preprocessPattern(pattern);
        this.patterns.set(patternId, {
            ...processedPattern,
            startTime,
            originalPattern: pattern
        });

        this.activePatterns.add(patternId);

        return this;
    }

    stopPattern(patternId, when = null) {
        const stopTime = when || this.audioContext.currentTime;

        if (this.patterns.has(patternId)) {
            this.patterns.delete(patternId);
            this.activePatterns.delete(patternId);

            this.triggerCallback('patternStop', { patternId, time: stopTime });
        }

        return this;
    }

    schedulePatternEvents(currentTime) {
        this.activePatterns.forEach(patternId => {
            const pattern = this.patterns.get(patternId);
            if (!pattern) return;

            pattern.events.forEach(event => {
                const eventTime = pattern.startTime + event.time;

                if (Math.abs(eventTime - currentTime) < 0.001) { // 1ms tolerance
                    this.triggerCallback('patternEvent', {
                        patternId,
                        event,
                        time: currentTime
                    });
                }
            });
        });
    }

    preprocessPattern(pattern) {
        // Pattern'ı schedule edilebilir events'lere çevir
        const events = [];

        if (Array.isArray(pattern)) {
            pattern.forEach((note) => {
                if (note && note.time !== undefined) {
                    events.push({
                        type: 'note',
                        time: this.parseTime(note.time),
                        data: note
                    });
                }
            });
        }

        return { events, duration: this.calculatePatternDuration(events) };
    }

    // =================== TIME UTILITIES ===================

    /**
     * Adımları (steps) tick'lere çevirir.
     * Varsayılan olarak 1 step = 1/16'lık nota = 24 tick (eğer ppq=96 ise).
     * @param {number} steps - Adım sayısı.
     * @returns {number} Tick cinsinden değer.
     */
    stepsToTicks(steps) {
        return steps * this.ticksPerStep;
    }
    /**
     * Tick'leri adımlara (steps) çevirir.
     * @param {number} ticks - Tick sayısı.
     * @returns {number} Adım cinsinden değer.
     */
    ticksToSteps(ticks) {
        return ticks / this.ticksPerStep;
    }

    /**
     * Adımları (steps) saniyeye çevirir.
     * @param {number} steps - Adım sayısı.
     * @returns {number} Saniye cinsinden değer.
     */
    stepsToSeconds(steps) {
        const ticks = this.stepsToTicks(steps);
        return ticks * this.getSecondsPerTick();
    }

    /**
     * Saniyeyi adımlara (steps) çevirir. Bu fonksiyon hatanın ana nedenidir.
     * @param {number} seconds - Saniye değeri.
     * @returns {number} Adım cinsinden en yakın değer.
     */
    secondsToSteps(seconds) {
        const ticks = seconds / this.getSecondsPerTick();
        return this.ticksToSteps(ticks);
    }
    parseTime(timeValue) {
        if (typeof timeValue === 'number') {
            return timeValue; // Assume seconds
        }

        if (typeof timeValue === 'string') {
            // Parse formats like "1:2:0" (bar:beat:sixteenth)
            if (timeValue.includes(':')) {
                const parts = timeValue.split(':').map(Number);
                const [bar = 0, beat = 0, sixteenth = 0] = parts;

                return this.barBeatSixteenthToSeconds(bar, beat, sixteenth);
            }

            // Parse note durations like "4n", "8n", "16n"
            if (timeValue.match(/\d+[ndt]/)) {
                return this.noteDurationToSeconds(timeValue);
            }
        }

        return 0;
    }

    barBeatSixteenthToSeconds(bar, beat, sixteenth) {
        const totalSixteenths = (bar * this.timeSignature[0] * 4) + (beat * 4) + sixteenth;
        const sixteenthDuration = (60 / this.bpm) / 4; // Duration of one sixteenth note
        return totalSixteenths * sixteenthDuration;
    }

    noteDurationToSeconds(notation) {
        // "4n" = quarter note, "8n" = eighth note, etc.
        const matches = notation.match(/(\d+)([ndt])/);
        if (!matches) return 0;

        const [, noteValue, type] = matches;
        let duration = (60 / this.bpm) * (4 / parseInt(noteValue));

        if (type === 't') duration *= 2 / 3; // Triplet
        if (type === 'd') duration *= 1.5; // Dotted

        return duration;
    }

    // ✅ Position formatting
    formatPosition(ticks) {
        const bar = Math.floor(ticks / this.ticksPerBar);
        const beat = Math.floor((ticks % this.ticksPerBar) / this.ppq);
        const sixteenth = Math.floor((ticks % this.ppq) / (this.ppq / 4));
        return `${bar}:${beat}:${sixteenth}`;
    }

    // ✅ DÜZELTME: getCurrentTime
    getCurrentTime() {
        return this.audioContext.currentTime;
    }

    // ✅ DÜZELTME: Tick to seconds conversion
    getSecondsPerTick() {
        const secondsPerBeat = 60.0 / this.bpm;
        return secondsPerBeat / this.ppq;
    }

    /**
     * ✅ NEW: Get steps per second (authoritative timing source)
     * This is the single source of truth for playhead speed calculations
     * Used by TransportController for visual interpolation
     * @returns {number} Steps per second at current BPM
     */
    getStepsPerSecond() {
        // 1 beat = 4 steps (16th notes in 4/4 time)
        // steps/second = (beats/minute / 60) * 4
        return (this.bpm / 60) * 4;
    }

    /**
     * ✅ NEW: Get seconds per step (inverse of stepsPerSecond)
     * @returns {number} Seconds per step
     */
    getSecondsPerStep() {
        return 1 / this.getStepsPerSecond();
    }

    // =================== EVENT SYSTEM ===================

    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, new Set());
        }
        this.callbacks.get(event).add(callback);
        return this;
    }

    off(event, callback) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event).delete(callback);
        }
        return this;
    }

    triggerCallback(event, data = {}) {
        if (this.callbacks.has(event)) {
            const callbacks = this.callbacks.get(event);
            // ✅ DEBUG: Log loop event callback count
            if (event === 'loop') {
                console.log(`🔄 [TRANSPORT] Triggering 'loop' event to ${callbacks.size} callbacks`);
            }
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    // ✅ FIX: Don't silently swallow errors - log them
                    console.error(`❌ [TRANSPORT] Error in '${event}' callback:`, error);
                }
            });
        } else if (event === 'loop') {
            // ✅ DEBUG: No callbacks registered for loop event
            console.warn(`⚠️ [TRANSPORT] No callbacks registered for 'loop' event!`);
        }
    }

    // =================== UTILITY METHODS ===================

    calculatePatternDuration(events) {
        if (events.length === 0) return 0;
        return Math.max(...events.map(event => event.time + (event.data.duration || 0)));
    }

    applySwing(time, position) {
        if (this.swingFactor === 0) return time;

        const sixteenthPosition = position % (this.ppq / 4);
        if (sixteenthPosition === this.ppq / 8) { // Off-beat sixteenth
            const swingDelay = (this.getSecondsPerTick() * 2) * this.swingFactor * 0.3;
            return time + swingDelay;
        }

        return time;
    }

    getStats() {
        return {
            isPlaying: this.isPlaying,
            bpm: this.bpm,
            position: this.getPosition(),
            formattedPosition: this.formatPosition(this.getPosition()),
            timeSignature: this.timeSignature,
            activePatterns: this.activePatterns.size,
            scheduledEvents: this.scheduledEvents.size,
            audioLatency: this.audioContext.baseLatency || 'unknown',
            audioContextState: this.audioContext.state
        };
    }

    // ⚡ OPTIMIZATION: Loop cache helper methods
    _isLoopCacheValid(startStep, endStep) {
        const cache = this.loopCache;
        return cache.cacheValid &&
            cache.lastBpm === this.bpm &&
            cache.lastLoopStart === startStep &&
            cache.lastLoopEnd === endStep &&
            JSON.stringify(cache.lastTimeSignature) === JSON.stringify(this.timeSignature);
    }

    _updateLoopCache(startStep, endStep) {
        const cache = this.loopCache;
        cache.lastBpm = this.bpm;
        cache.lastLoopStart = startStep;
        cache.lastLoopEnd = endStep;
        cache.lastTimeSignature = [...this.timeSignature];
        cache.cachedLoopTicks = this.loopEndTick - this.loopStartTick;
        cache.cachedLoopSeconds = cache.cachedLoopTicks * this.getSecondsPerTick();
        cache.cacheValid = true;

    }

    _invalidateLoopCache() {
        this.loopCache.cacheValid = false;
    }

    dispose() {
        // ✅ LEAK FIX: Comprehensive cleanup
        this.stop();

        // Cleanup worker timer
        if (this.timerWorker) {
            this.timerWorker.postMessage('stop'); // Stop internal timer first
            this.timerWorker.terminate();
            this.timerWorker = null;
        }

        // ✅ LEAK FIX: Revoke blob URL
        if (this.workerBlobUrl) {
            URL.revokeObjectURL(this.workerBlobUrl);
            this.workerBlobUrl = null;
        }

        // Clear data structures
        this.callbacks.clear();
        this.scheduledEvents.clear();

        // Nullify references
        this.audioContext = null;

        console.log('🗑️ NativeTransportSystem disposed');
    }
}